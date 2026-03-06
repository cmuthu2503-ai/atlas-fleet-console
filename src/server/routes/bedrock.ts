import { Hono } from 'hono';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

const app = new Hono();

const clientCache = new Map<string, BedrockClient>();

function getClient(region: string) {
  const cached = clientCache.get(region);
  if (cached) return cached;
  const client = new BedrockClient({ region });
  clientCache.set(region, client);
  return client;
}

function inferTags(modelId: string, modelName: string, inputModalities: string[], outputModalities: string[]) {
  const haystack = `${modelId} ${modelName}`.toLowerCase();
  const tags = new Set<string>();
  const textGenerator = inputModalities.includes('TEXT') && outputModalities.includes('TEXT');

  if (outputModalities.includes('TEXT')) {
    tags.add('chat');
    tags.add('analysis');
  }
  if (inputModalities.includes('TEXT') && outputModalities.includes('TEXT')) {
    tags.add('rag');
  }
  if (/command|claude|llama|mistral|jamba|nova|titan-text|text/.test(haystack)) {
    tags.add('chat');
  }
  if (/code|coder|q-developer|qdeveloper|devstral/.test(haystack)) {
    tags.add('code');
  }
  if (textGenerator && /claude|llama|mistral|deepseek|qwen|gpt|gemma|jamba|palmyra|nova-pro|nova-premier|kimi/.test(haystack)) {
    tags.add('code');
  }
  if (/embed|embedding|command-r|knowledge|retrieve|rerank/.test(haystack)) {
    tags.add('rag');
  }
  if (/image|canvas|diffusion|nova-reel|reel|stable/.test(haystack) || outputModalities.includes('IMAGE')) {
    tags.add('creative');
  }
  if (inputModalities.includes('IMAGE')) {
    tags.add('analysis');
  }

  if (tags.size === 0) tags.add('analysis');
  return [...tags] as Array<'chat' | 'code' | 'analysis' | 'rag' | 'creative'>;
}

function parseDateValue(value: Date | string | undefined) {
  if (!value) return undefined;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function parseModelIdReleaseTimestamp(modelId: string) {
  const match = modelId.match(/-(\d{8})(?=-v\d|:|$)/);
  if (!match) return undefined;

  const [, rawDate] = match;
  const year = Number(rawDate.slice(0, 4));
  const month = Number(rawDate.slice(4, 6)) - 1;
  const day = Number(rawDate.slice(6, 8));
  const timestamp = Date.UTC(year, month, day);

  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function getReleaseTimestamp(summary: { modelLifecycle?: { startOfLifeTime?: Date | string } | undefined; modelId?: string | undefined }) {
  return parseDateValue(summary.modelLifecycle?.startOfLifeTime) ?? parseModelIdReleaseTimestamp(summary.modelId ?? '');
}

function inferSignals(modelId: string, modelName: string, provider: string) {
  const haystack = `${modelId} ${modelName} ${provider}`.toLowerCase();
  let quality = 76;
  let latency = 72;
  let cost = 62;
  let context = 72;

  if (/opus|ultra|70b|large|premier|pro|sonnet-4|sonnet 4|sonnet/.test(haystack)) {
    quality += 12;
    latency -= 8;
    cost -= 12;
    context += 10;
  }
  if (/haiku|mini|lite|micro|8b|small|instant/.test(haystack)) {
    quality -= 6;
    latency += 18;
    cost += 18;
  }
  if (/embed|embedding|rerank/.test(haystack)) {
    quality -= 4;
    latency += 8;
    cost += 10;
    context += 4;
  }
  if (/command-r\+|command-r-plus|jamba|long|200k|1m/.test(haystack)) {
    context += 14;
  }
  if (/amazon/.test(haystack)) {
    cost += 8;
  }

  return {
    quality: Math.max(45, Math.min(97, quality)),
    latency: Math.max(40, Math.min(97, latency)),
    cost: Math.max(35, Math.min(97, cost)),
    context: Math.max(50, Math.min(98, context)),
  };
}

function getStatusCode(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'AccessDeniedException' || name === 'UnrecognizedClientException') return 403;
  if (name === 'ValidationException') return 400;
  if (name === 'ExpiredTokenException') return 401;
  return 500;
}

function getFriendlyError(error: unknown, region: string) {
  const message = (error as { message?: string })?.message || 'Unknown Bedrock error';
  const name = (error as { name?: string })?.name || 'BedrockError';

  if (name === 'CredentialsProviderError') {
    return `AWS credentials were not available for Bedrock discovery in ${region}.`;
  }
  if (name === 'AccessDeniedException' || name === 'UnrecognizedClientException') {
    return `AWS credentials do not have access to Bedrock model discovery in ${region}.`;
  }
  if (name === 'ValidationException') {
    return `Bedrock model discovery request was rejected for region ${region}.`;
  }
  if (name === 'ExpiredTokenException') {
    return `AWS session token expired for Bedrock discovery in ${region}.`;
  }

  return `${name}: ${message}`;
}

app.get('/models', async (c) => {
  const region = c.req.query('region') || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  try {
    const client = getClient(region);
    const response = await client.send(new ListFoundationModelsCommand({}));
    const models = (response.modelSummaries ?? [])
      .map(summary => {
        const modelId = summary.modelId ?? 'unknown-model';
        const modelName = summary.modelName ?? modelId;
        const provider = summary.providerName ?? 'Unknown';
        const inputModalities = summary.inputModalities ?? [];
        const outputModalities = summary.outputModalities ?? [];

        return {
          modelId,
          name: modelName,
          provider,
          releaseTimestamp: getReleaseTimestamp(summary),
          inputModalities,
          outputModalities,
          inferenceTypesSupported: summary.inferenceTypesSupported ?? [],
          customizationsSupported: summary.customizationsSupported ?? [],
          responseStreamingSupported: summary.responseStreamingSupported ?? false,
          lifecycleStatus: summary.modelLifecycle?.status ?? 'ACTIVE',
          tags: inferTags(modelId, modelName, inputModalities, outputModalities),
          ...inferSignals(modelId, modelName, provider),
        };
      })
      .sort((a, b) =>
        a.provider.localeCompare(b.provider) ||
        (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.modelId.localeCompare(b.modelId),
      );

    return c.json({
      data: {
        region,
        source: 'aws-bedrock-live',
        fetchedAt: Date.now(),
        models,
      },
    });
  } catch (error) {
    return c.json({
      error: getFriendlyError(error, region),
      details: (error as { message?: string })?.message || 'Unknown error',
      region,
    }, getStatusCode(error));
  }
});

export default app;
