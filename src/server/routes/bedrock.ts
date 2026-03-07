import { Hono } from 'hono';
import { BedrockClient, ListFoundationModelsCommand, ListInferenceProfilesCommand } from '@aws-sdk/client-bedrock';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const app = new Hono();

const ACTIVE_CHECK_TTL_MS = 15 * 60_000;
const ACTIVE_CHECK_TIMEOUT_MS = 5_000;
const ACTIVE_CHECK_CONCURRENCY = 4;
const ACTIVE_CHECK_PROMPT = 'Reply with OK only.';

type BedrockCatalogEntry = {
  modelId: string;
  name: string;
  provider: string;
  releaseTimestamp?: number;
  inputModalities: string[];
  outputModalities: string[];
  inferenceTypesSupported: string[];
  customizationsSupported: string[];
  responseStreamingSupported: boolean;
  lifecycleStatus: string;
  tags: Array<'chat' | 'code' | 'analysis' | 'rag' | 'creative'>;
  quality: number;
  latency: number;
  cost: number;
  context: number;
};

type ActiveCheckResult = {
  modelId: string;
  provider: string;
  isActive: boolean;
  checkedAt: number;
  probeTargetId?: string;
  error?: string;
};

type InferenceProfileSummary = {
  inferenceProfileId: string;
  models: string[];
  status?: string;
};

const clientCache = new Map<string, BedrockClient>();
const runtimeClientCache = new Map<string, BedrockRuntimeClient>();
const activeCheckCache = new Map<string, ActiveCheckResult>();
const inferenceProfileCache = new Map<string, { fetchedAt: number; profiles: InferenceProfileSummary[] }>();

function getClient(region: string) {
  const cached = clientCache.get(region);
  if (cached) return cached;
  const client = new BedrockClient({ region });
  clientCache.set(region, client);
  return client;
}

function getRuntimeClient(region: string) {
  const cached = runtimeClientCache.get(region);
  if (cached) return cached;
  const client = new BedrockRuntimeClient({ region });
  runtimeClientCache.set(region, client);
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

function getFriendlyProbeError(error: unknown, modelId: string) {
  const name = (error as { name?: string })?.name || 'BedrockRuntimeError';
  const message = (error as { message?: string })?.message || 'Unknown Bedrock runtime error';

  if (name === 'AccessDeniedException' || name === 'ValidationException' || name === 'ResourceNotFoundException') {
    return `${name}: ${message}`;
  }
  if (name === 'ModelTimeoutException' || name === 'ThrottlingException') {
    return `${name}: ${message}`;
  }
  if (name === 'AbortError' || /aborted/i.test(message)) {
    return `ProbeTimeout: Timed out while checking ${modelId}.`;
  }

  return `${name}: ${message}`;
}

function parseProviders(rawProviders?: string) {
  if (!rawProviders) return [];
  return rawProviders
    .split(',')
    .map(provider => provider.trim())
    .filter(Boolean);
}

function supportsTextProbe(model: BedrockCatalogEntry) {
  return model.inputModalities.includes('TEXT') && model.outputModalities.includes('TEXT');
}

async function listInferenceProfiles(region: string) {
  const cached = inferenceProfileCache.get(region);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < ACTIVE_CHECK_TTL_MS) {
    return cached.profiles;
  }

  const client = getClient(region);
  const profiles: InferenceProfileSummary[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(new ListInferenceProfilesCommand({
      maxResults: 100,
      typeEquals: 'SYSTEM_DEFINED',
      nextToken,
    }));

    for (const summary of response.inferenceProfileSummaries ?? []) {
      const inferenceProfileId = summary.inferenceProfileId;
      if (!inferenceProfileId) continue;

      profiles.push({
        inferenceProfileId,
        models: (summary.models ?? [])
          .map(model => model.modelArn ?? '')
          .filter(Boolean),
        status: summary.status,
      });
    }

    nextToken = response.nextToken;
  } while (nextToken);

  inferenceProfileCache.set(region, { fetchedAt: now, profiles });
  return profiles;
}

async function resolveProbeTarget(region: string, model: BedrockCatalogEntry) {
  if (!model.inferenceTypesSupported.includes('INFERENCE_PROFILE')) {
    return model.modelId;
  }

  const profiles = await listInferenceProfiles(region);
  const modelSuffix = `/${model.modelId}`;
  const matchingProfile = profiles.find(profile =>
    profile.status === 'ACTIVE' &&
    profile.models.some(modelArn => modelArn.endsWith(modelSuffix)),
  );

  return matchingProfile?.inferenceProfileId ?? model.modelId;
}

async function mapWithConcurrency<T, U>(items: T[], limit: number, worker: (item: T) => Promise<U>) {
  const results = new Array<U>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function listModels(region: string) {
  const client = getClient(region);
  const response = await client.send(new ListFoundationModelsCommand({}));

  return (response.modelSummaries ?? [])
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
      } satisfies BedrockCatalogEntry;
    })
    .sort((a, b) =>
      a.provider.localeCompare(b.provider) ||
      (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
      a.name.localeCompare(b.name) ||
      a.modelId.localeCompare(b.modelId),
    );
}

async function runActiveCheck(region: string, model: BedrockCatalogEntry): Promise<ActiveCheckResult> {
  const cacheKey = `${region}:${model.modelId}`;
  const cached = activeCheckCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.checkedAt < ACTIVE_CHECK_TTL_MS) {
    return cached;
  }

  if (!supportsTextProbe(model)) {
    const result = {
      modelId: model.modelId,
      provider: model.provider,
      isActive: false,
      checkedAt: now,
      error: 'TextProbeUnsupported: Model does not support TEXT input and TEXT output.',
    };
    activeCheckCache.set(cacheKey, result);
    return result;
  }

  const probeTargetId = await resolveProbeTarget(region, model);

  try {
    const runtimeClient = getRuntimeClient(region);
    const response = await runtimeClient.send(
      new ConverseCommand({
        modelId: probeTargetId,
        messages: [
          {
            role: 'user',
            content: [{ text: ACTIVE_CHECK_PROMPT }],
          },
        ],
        inferenceConfig: {
          maxTokens: 8,
          temperature: 0,
        },
      }),
      { abortSignal: AbortSignal.timeout(ACTIVE_CHECK_TIMEOUT_MS) },
    );

    const hasTextResponse = (response.output?.message?.content ?? []).some(block => {
      const text = (block as { text?: string }).text;
      return typeof text === 'string' && text.trim().length > 0;
    });

    const result = {
      modelId: model.modelId,
      provider: model.provider,
      isActive: hasTextResponse,
      checkedAt: now,
      probeTargetId,
      error: hasTextResponse ? undefined : 'EmptyResponse: Model returned no text content for the probe.',
    };
    activeCheckCache.set(cacheKey, result);
    return result;
  } catch (error) {
    const result = {
      modelId: model.modelId,
      provider: model.provider,
      isActive: false,
      checkedAt: now,
      probeTargetId,
      error: getFriendlyProbeError(error, model.modelId),
    };
    activeCheckCache.set(cacheKey, result);
    return result;
  }
}

app.get('/models', async (c) => {
  const region = c.req.query('region') || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  try {
    const models = await listModels(region);
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

app.get('/active-models', async (c) => {
  const region = c.req.query('region') || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const selectedProviders = parseProviders(c.req.query('providers'));

  try {
    const allModels = await listModels(region);
    const models = selectedProviders.length > 0
      ? allModels.filter(model => selectedProviders.includes(model.provider))
      : allModels;

    const checks = await mapWithConcurrency(models, ACTIVE_CHECK_CONCURRENCY, model => runActiveCheck(region, model));
    const activeCount = checks.filter(check => check.isActive).length;

    return c.json({
      data: {
        region,
        source: 'bedrock-runtime-probe',
        checkedAt: Date.now(),
        checkedCount: checks.length,
        activeCount,
        checks,
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
