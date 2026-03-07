import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBedrockActiveChecks, useBedrockModels } from '../../queries/bedrock';
import type { BedrockModelCatalogEntry, BedrockWorkCategory } from '../../types';

type ViewMode = 'all' | 'active';
type ModelCapabilityKey = 'text' | 'vision' | 'streaming' | 'inferenceProfile';
type AdvisorUseCaseKey =
  | 'coding'
  | 'conversational'
  | 'creativeWriting'
  | 'mostPopular'
  | 'agentic'
  | 'budget'
  | 'longContext'
  | 'toolCalling';
type UseCaseScores = Record<AdvisorUseCaseKey, number>;
type RankedModel = BedrockModelCatalogEntry & { fit: number };
type GroupedRankedModel = {
  familyKey: string;
  name: string;
  provider: string;
  releaseTimestamp?: number;
  tags: BedrockWorkCategory[];
  quality: number;
  latency: number;
  cost: number;
  context: number;
  inputModalities: string[];
  outputModalities: string[];
  inferenceTypesSupported: string[];
  customizationsSupported: string[];
  responseStreamingSupported: boolean;
  lifecycleStatus: string;
  fit: number;
  useCaseScores: UseCaseScores;
  variants: RankedModel[];
};

const BEDROCK_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
];
const USE_CASE_SCORE_OPTIONS: Array<{ key: AdvisorUseCaseKey; label: string }> = [
  { key: 'coding', label: 'Coding' },
  { key: 'conversational', label: 'Conversational' },
  { key: 'creativeWriting', label: 'Creative Writing' },
  { key: 'mostPopular', label: 'Most Popular' },
  { key: 'agentic', label: 'Agentic' },
  { key: 'budget', label: 'Budget' },
  { key: 'longContext', label: 'Long Context' },
  { key: 'toolCalling', label: 'Tool Calling' },
];
const MODEL_CAPABILITY_OPTIONS: Array<{ key: ModelCapabilityKey; label: string }> = [
  { key: 'text', label: 'Text' },
  { key: 'vision', label: 'Vision' },
  { key: 'streaming', label: 'Streaming' },
  { key: 'inferenceProfile', label: 'Inference Profiles' },
];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatReleaseDate(timestamp?: number) {
  if (!timestamp) return 'Release date unavailable';
  return new Date(timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function clampScore(value: number) {
  return Math.max(35, Math.min(99, Math.round(value)));
}

function WorkCategoryChip({ active, label, onClick }: { active: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 rounded-full text-[11px] border transition-colors"
      style={{
        borderColor: active ? '#bcd0ff' : '#d9e0ee',
        background: active ? '#eaf0ff' : '#fff',
        color: active ? '#234fb2' : '#6b7280',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function UseCaseScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg px-2 py-2 text-center" style={{ borderColor: '#d9e0ee', background: '#fbfdff' }}>
      <div className="text-[10px] leading-4" style={{ color: '#6b7280' }}>{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: '#334155' }}>{value}</div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg px-2 py-2 text-center" style={{ borderColor: '#d9e0ee', background: '#fbfdff' }}>
      <div className="text-[11px]" style={{ color: '#6b7280' }}>{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: '#334155' }}>{value}</div>
    </div>
  );
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function getActualCapabilityLabels(model: Pick<GroupedRankedModel, 'inputModalities' | 'outputModalities' | 'inferenceTypesSupported' | 'customizationsSupported' | 'responseStreamingSupported'>) {
  const capabilities: string[] = [];

  if (model.inputModalities.includes('TEXT') && model.outputModalities.includes('TEXT')) {
    capabilities.push('Text');
  }
  if (model.inputModalities.includes('IMAGE') || model.outputModalities.includes('IMAGE')) {
    capabilities.push('Vision');
  }
  if (model.inputModalities.includes('AUDIO') || model.outputModalities.includes('AUDIO')) {
    capabilities.push('Audio');
  }
  if (model.responseStreamingSupported) {
    capabilities.push('Streaming');
  }
  if (model.inferenceTypesSupported.includes('ON_DEMAND')) {
    capabilities.push('On Demand');
  } else if (model.inferenceTypesSupported.includes('INFERENCE_PROFILE')) {
    capabilities.push('Inference Profile');
  }
  if (model.customizationsSupported.length > 0) {
    capabilities.push('Customizable');
  }

  return capabilities.slice(0, 4);
}

function modelSupportsCapability(
  model: Pick<GroupedRankedModel, 'inputModalities' | 'outputModalities' | 'inferenceTypesSupported' | 'responseStreamingSupported'>,
  capability: ModelCapabilityKey,
) {
  switch (capability) {
    case 'text':
      return model.inputModalities.includes('TEXT') || model.outputModalities.includes('TEXT');
    case 'vision':
      return model.inputModalities.includes('IMAGE') || model.outputModalities.includes('IMAGE');
    case 'streaming':
      return model.responseStreamingSupported;
    case 'inferenceProfile':
      return model.inferenceTypesSupported.includes('INFERENCE_PROFILE');
    default:
      return false;
  }
}

function buildReason(model: Pick<GroupedRankedModel, 'context' | 'latency' | 'cost' | 'responseStreamingSupported'>) {
  const reasons: string[] = [];

  if (model.context > 85) reasons.push('Large context signal for long prompts');
  if (model.latency > 85) reasons.push('Fast response profile inferred from model family');
  if (model.cost > 85) reasons.push('Cost-efficient profile inferred from model family');
  if (model.responseStreamingSupported) reasons.push('Streaming support is available for interactive workflows');
  if (reasons.length === 0) reasons.push('Balanced profile across quality, latency, and cost');

  return `${reasons.slice(0, 2).join('. ')}.`;
}

function inferPopularityScore(model: Pick<GroupedRankedModel, 'provider' | 'releaseTimestamp' | 'quality' | 'latency' | 'cost'>) {
  const providerBase: Record<string, number> = {
    Anthropic: 78,
    Amazon: 70,
    DeepSeek: 75,
    Google: 82,
    Meta: 73,
    Mistral: 72,
  };
  const ageDays = model.releaseTimestamp ? (Date.now() - model.releaseTimestamp) / (1000 * 60 * 60 * 24) : 999;
  const recencyBoost = ageDays < 45 ? 10 : ageDays < 120 ? 7 : ageDays < 240 ? 4 : 0;
  const capabilitySignal = (model.quality * 0.35) + (model.latency * 0.15) + (model.cost * 0.15);
  return clampScore((providerBase[model.provider] ?? 68) + recencyBoost + (capabilitySignal - 55) * 0.18);
}

function computeUseCaseScores(
  model: Pick<GroupedRankedModel, 'name' | 'provider' | 'tags' | 'quality' | 'latency' | 'cost' | 'context' | 'responseStreamingSupported' | 'releaseTimestamp'>,
) {
  const tagSet = new Set(model.tags);
  const textGeneralist = tagSet.has('chat') || tagSet.has('analysis') || tagSet.has('rag');

  const heuristicCoding = clampScore((model.quality * 0.44) + (model.context * 0.22) + (model.latency * 0.18) + (model.cost * 0.16) + (tagSet.has('code') ? 8 : 0));
  const heuristicConversational = clampScore((model.quality * 0.34) + (model.latency * 0.26) + (model.context * 0.2) + (model.cost * 0.12) + (tagSet.has('chat') ? 10 : 0));
  const heuristicCreative = clampScore((model.quality * 0.36) + (model.context * 0.24) + (model.latency * 0.16) + (model.cost * 0.12) + (tagSet.has('creative') ? 10 : 0));
  const heuristicAgentic = clampScore((model.quality * 0.38) + (model.context * 0.22) + (model.latency * 0.16) + (model.cost * 0.12) + (textGeneralist ? 6 : 0));
  const heuristicBudget = clampScore(model.cost);
  const heuristicLongContext = clampScore(model.context);
  const heuristicToolCalling = clampScore((model.quality * 0.28) + (model.context * 0.18) + (model.latency * 0.18) + (model.cost * 0.16) + (model.responseStreamingSupported ? 8 : 0) + (textGeneralist ? 6 : 0));
  const heuristicPopularity = inferPopularityScore(model);

  return {
    coding: heuristicCoding,
    conversational: heuristicConversational,
    creativeWriting: heuristicCreative,
    mostPopular: heuristicPopularity,
    agentic: heuristicAgentic,
    budget: heuristicBudget,
    longContext: heuristicLongContext,
    toolCalling: heuristicToolCalling,
  } satisfies UseCaseScores;
}

export function BedrockModelAdvisorView() {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<ModelCapabilityKey[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [region, setRegion] = useState('us-east-1');
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [capabilityMenuOpen, setCapabilityMenuOpen] = useState(false);
  const [activityNote, setActivityNote] = useState('');
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const capabilityMenuRef = useRef<HTMLDivElement | null>(null);
  const previousRegionRef = useRef<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useBedrockModels(region);
  const activeChecksEnabled = viewMode === 'active' && selectedProviders.length > 0;
  const {
    data: activeChecksData,
    isLoading: isCheckingActiveModels,
    isFetching: isRefreshingActiveModels,
    error: activeChecksError,
    refetch: refetchActiveChecks,
  } = useBedrockActiveChecks(region, selectedProviders, activeChecksEnabled);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const clickedProviderMenu = providerMenuRef.current?.contains(target);
      const clickedCapabilityMenu = capabilityMenuRef.current?.contains(target);

      if (!clickedProviderMenu) {
        setProviderMenuOpen(false);
      }
      if (!clickedCapabilityMenu) {
        setCapabilityMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!data) return;
    const providers = [...new Set(data.models.map(model => model.provider))];
    setSelectedProviders(current => {
      const regionChanged = previousRegionRef.current !== data.region;
      previousRegionRef.current = data.region;

      if (regionChanged) {
        return providers;
      }

      if (current.length === 0) {
        return current;
      }

      const filtered = current.filter(provider => providers.includes(provider));
      return filtered.length > 0 ? filtered : providers;
    });
  }, [data?.region, data?.fetchedAt]);

  function toggleProvider(provider: string) {
    setSelectedProviders(current =>
      current.includes(provider) ? current.filter(item => item !== provider) : [...current, provider]
    );
  }

  function toggleAllProviders() {
    setSelectedProviders(current => {
      if (providers.length === 0) return current;
      return current.length === providers.length ? [] : providers;
    });
  }

  function toggleCapability(capability: ModelCapabilityKey) {
    setSelectedCapabilities(current =>
      current.includes(capability)
        ? current.filter(item => item !== capability)
        : [...current, capability]
    );
  }

  function clearCapabilityFilters() {
    setSelectedCapabilities([]);
  }

  function importRequirementsPreset() {
    setViewMode('active');
    setSelectedCapabilities([]);
    setActivityNote('Loaded a balanced evaluation preset. Refine providers and model use cases to narrow the list.');
  }

  function saveEvaluation() {
    setActivityNote(`Evaluation saved at ${formatTime(new Date())}.`);
  }

  async function refreshCatalog() {
    const result = await refetch();
    const activeResult = viewMode === 'active' && selectedProviders.length > 0
      ? await refetchActiveChecks()
      : null;

    if (result.error || activeResult?.error) {
      setActivityNote(`Refresh failed at ${formatTime(new Date())}.`);
      return;
    }
    setActivityNote(`Catalog refreshed at ${formatTime(new Date())}.`);
  }

  function computeFit(model: BedrockModelCatalogEntry) {
    let base = (model.quality + model.latency + model.cost + model.context) / 4;

    base += (model.quality / 22) + (model.context / 30);

    if (model.responseStreamingSupported) base += 2;
    if (model.inputModalities.includes('IMAGE') || model.outputModalities.includes('IMAGE')) base += 1;

    return Math.min(99, Math.round(base));
  }

  const providers = useMemo(
    () => [...new Set((data?.models ?? []).map(model => model.provider))],
    [data?.models],
  );
  const allProvidersSelected = providers.length > 0 && selectedProviders.length === providers.length;
  const providerSummary = providers.length === 0
    ? 'Loading providers...'
    : allProvidersSelected
      ? 'All Providers'
      : selectedProviders.length > 0
        ? selectedProviders.join(', ')
        : 'No providers selected';
  const capabilitySummary = selectedCapabilities.length === 0
    ? 'All Use Cases'
    : MODEL_CAPABILITY_OPTIONS
      .filter(option => selectedCapabilities.includes(option.key))
      .map(option => option.label)
      .join(', ');

  const rankedModels = useMemo<RankedModel[]>(
    () => (data?.models ?? [])
      .filter(model => selectedProviders.includes(model.provider))
      .map(model => ({
        ...model,
        fit: computeFit(model),
      }))
      .sort((a, b) =>
        (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
        b.fit - a.fit ||
        a.name.localeCompare(b.name) ||
        a.modelId.localeCompare(b.modelId),
      ),
    [data?.models, selectedProviders],
  );

  const groupedModels = useMemo<GroupedRankedModel[]>(() => {
    const grouped = new Map<string, GroupedRankedModel>();

    for (const model of rankedModels) {
      const familyKey = `${model.provider}::${model.name}`;
      const existing = grouped.get(familyKey);

      if (!existing) {
        grouped.set(familyKey, {
          familyKey,
          name: model.name,
          provider: model.provider,
          releaseTimestamp: model.releaseTimestamp,
          tags: [...model.tags],
          quality: model.quality,
          latency: model.latency,
          cost: model.cost,
          context: model.context,
          inputModalities: [...model.inputModalities],
          outputModalities: [...model.outputModalities],
          inferenceTypesSupported: [...model.inferenceTypesSupported],
          customizationsSupported: [...model.customizationsSupported],
          responseStreamingSupported: model.responseStreamingSupported,
          lifecycleStatus: model.lifecycleStatus,
          fit: model.fit,
          useCaseScores: computeUseCaseScores({
            name: model.name,
            provider: model.provider,
            tags: model.tags,
            quality: model.quality,
            latency: model.latency,
            cost: model.cost,
            context: model.context,
            responseStreamingSupported: model.responseStreamingSupported,
            releaseTimestamp: model.releaseTimestamp,
          }),
          variants: [model],
        });
        continue;
      }

      existing.tags = uniqueValues([...existing.tags, ...model.tags]) as BedrockWorkCategory[];
      existing.releaseTimestamp = Math.max(existing.releaseTimestamp ?? 0, model.releaseTimestamp ?? 0) || undefined;
      existing.quality = Math.max(existing.quality, model.quality);
      existing.latency = Math.max(existing.latency, model.latency);
      existing.cost = Math.max(existing.cost, model.cost);
      existing.context = Math.max(existing.context, model.context);
      existing.inputModalities = uniqueValues([...existing.inputModalities, ...model.inputModalities]);
      existing.outputModalities = uniqueValues([...existing.outputModalities, ...model.outputModalities]);
      existing.inferenceTypesSupported = uniqueValues([...existing.inferenceTypesSupported, ...model.inferenceTypesSupported]);
      existing.customizationsSupported = uniqueValues([...existing.customizationsSupported, ...model.customizationsSupported]);
      existing.responseStreamingSupported = existing.responseStreamingSupported || model.responseStreamingSupported;
      existing.lifecycleStatus = existing.lifecycleStatus === 'ACTIVE' || model.lifecycleStatus !== 'ACTIVE'
        ? existing.lifecycleStatus
        : model.lifecycleStatus;
      existing.fit = Math.max(existing.fit, model.fit);
      existing.variants.push(model);
    }

    return [...grouped.values()]
      .map(model => ({
        ...model,
        variants: [...model.variants].sort((a, b) =>
          (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
          b.fit - a.fit ||
          b.inferenceTypesSupported.length - a.inferenceTypesSupported.length ||
          a.modelId.localeCompare(b.modelId),
        ),
      }))
      .sort((a, b) =>
        (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
        b.fit - a.fit ||
        a.name.localeCompare(b.name),
      );
  }, [rankedModels]);

  const activeModelIds = useMemo(
    () => new Set((activeChecksData?.checks ?? []).filter(check => check.isActive).map(check => check.modelId)),
    [activeChecksData?.checks],
  );

  const visibleModels = useMemo<GroupedRankedModel[]>(() => {
    const models: GroupedRankedModel[] = [];

    for (const model of groupedModels) {
      const variants = viewMode === 'active'
        ? model.variants.filter(variant => activeModelIds.has(variant.modelId))
        : model.variants;

      if (variants.length === 0) {
        continue;
      }

      const candidate = {
        ...model,
        releaseTimestamp: Math.max(...variants.map(variant => variant.releaseTimestamp ?? 0)) || undefined,
        inputModalities: uniqueValues(variants.flatMap(variant => variant.inputModalities)),
        outputModalities: uniqueValues(variants.flatMap(variant => variant.outputModalities)),
        inferenceTypesSupported: uniqueValues(variants.flatMap(variant => variant.inferenceTypesSupported)),
        customizationsSupported: uniqueValues(variants.flatMap(variant => variant.customizationsSupported)),
        responseStreamingSupported: variants.some(variant => variant.responseStreamingSupported),
        lifecycleStatus: variants.some(variant => variant.lifecycleStatus === 'ACTIVE') ? 'ACTIVE' : variants[0].lifecycleStatus,
        fit: Math.max(...variants.map(variant => variant.fit)),
        variants,
      };

      if (
        selectedCapabilities.length > 0 &&
        !selectedCapabilities.every(capability => modelSupportsCapability(candidate, capability))
      ) {
        continue;
      }

      models.push(candidate);
    }

    return models.sort((a, b) =>
      (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
      b.fit - a.fit ||
      a.name.localeCompare(b.name),
    );
  }, [activeModelIds, groupedModels, selectedCapabilities, viewMode]);

  useEffect(() => {
    if (visibleModels.length === 0) {
      setExpandedFamilies([]);
      return;
    }

    setExpandedFamilies(current => {
      const visibleKeys = new Set(visibleModels.map(model => model.familyKey));
      return current.filter(key => visibleKeys.has(key));
    });
  }, [visibleModels]);

  const catalogNote = viewMode === 'all'
    ? `Showing all ${visibleModels.length}/${groupedModels.length} model families from ${rankedModels.length} Bedrock entries in ${region}.`
    : `Showing ${visibleModels.length} active model families from ${activeChecksData?.activeCount ?? 0}/${activeChecksData?.checkedCount ?? rankedModels.length} checked Bedrock entries in ${region}.`;

  const pageError = error ?? (viewMode === 'active' ? activeChecksError : null);
  const checkingActiveMode = viewMode === 'active' && (isCheckingActiveModels || isRefreshingActiveModels);
  const lastRefreshedAt = viewMode === 'active' ? activeChecksData?.checkedAt : data?.fetchedAt;

  let bannerText = 'Connecting to Bedrock model discovery.';
  if (isLoading) {
    bannerText = `Discovering live Bedrock models in ${region}.`;
  } else if (checkingActiveMode) {
    bannerText = `Running a live Bedrock integration check for the selected providers in ${region}. Only models that answer the runtime probe will remain in the list.`;
  } else if (isFetching) {
    bannerText = `Refreshing live Bedrock catalog from ${region}.`;
  } else if (pageError) {
    bannerText = pageError.message;
  } else if (activityNote) {
    bannerText = activityNote;
  } else if (viewMode === 'active' && activeChecksData) {
    bannerText = 'Showing only models that responded to a live Bedrock runtime text probe. Models that fail integration or return no response are excluded.';
  } else if (data) {
    bannerText = `Using live Bedrock model discovery from ${data.region}. Results are grouped by model family, with Bedrock variants folded into each card.`;
  }

  function toggleFamily(familyKey: string) {
    setExpandedFamilies(current =>
      current.includes(familyKey)
        ? current.filter(key => key !== familyKey)
        : [...current, familyKey]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-white">Bedrock Model Advisor</h2>
          <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
            Choose region, providers, and Bedrock capabilities, then compare live models by release freshness, metadata, estimated fit, and integration readiness.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3 py-2 text-sm rounded-lg border" style={{ borderColor: '#3a3a4a', color: '#d1d5db', background: '#1e1e24' }} onClick={importRequirementsPreset}>
            Import Requirements
          </button>
          <button className="px-3 py-2 text-sm rounded-lg border" style={{ borderColor: '#3a3a4a', color: '#d1d5db', background: '#1e1e24' }} onClick={saveEvaluation}>
            Save Evaluation
          </button>
          <button className="px-3 py-2 text-sm rounded-lg text-white" style={{ background: '#2563eb' }} onClick={() => { void refreshCatalog(); }}>
            Refresh Bedrock Catalog
          </button>
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 border flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: '#2f3c56', background: 'linear-gradient(180deg, #111827, #0f172a)' }}>
        <div className="text-sm" style={{ color: pageError ? '#fecaca' : '#dbe4ff' }}>{bannerText}</div>
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          Last refreshed {lastRefreshedAt ? formatTime(new Date(lastRefreshedAt)) : 'n/a'}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside
          className="self-start rounded-xl border p-4 xl:sticky xl:top-28"
          style={{ borderColor: '#2a2a35', background: '#ffffff' }}
        >
          <h3 className="text-base font-semibold" style={{ color: '#1f2937' }}>1. Work Profile</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>AWS Region</label>
              <select
                value={region}
                onChange={event => setRegion(event.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#d9e0ee', color: '#1f2937', background: '#fff' }}
              >
                {BEDROCK_REGIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

          </div>

          <h3 className="mt-5 text-base font-semibold" style={{ color: '#1f2937' }}>2. Model Providers</h3>
          <div className="mt-3" ref={providerMenuRef}>
            <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Provider List (multi-select)</label>
            <div className="relative">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#d9e0ee', color: '#1f2937', background: '#fff' }}
                onClick={() => {
                  setCapabilityMenuOpen(false);
                  setProviderMenuOpen(open => !open);
                }}
              >
                {providerSummary}
              </button>
              {providerMenuOpen && (
                <div className="absolute left-0 right-0 mt-2 rounded-lg border p-2 z-20 shadow-lg max-h-64 overflow-auto" style={{ borderColor: '#d9e0ee', background: '#fff' }}>
                  <label className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer border-b" style={{ color: '#1f2937', borderColor: '#e5e7eb' }}>
                    <input
                      type="checkbox"
                      checked={allProvidersSelected}
                      onChange={toggleAllProviders}
                    />
                    <span className="font-medium">All Providers</span>
                  </label>
                  {providers.map(provider => (
                    <label key={provider} className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer" style={{ color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(provider)}
                        onChange={() => toggleProvider(provider)}
                      />
                      <span>{provider}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {allProvidersSelected ? (
                <WorkCategoryChip active label="All Providers" />
              ) : selectedProviders.length > 0 ? (
                selectedProviders.map(provider => <WorkCategoryChip key={provider} active label={provider} />)
              ) : (
                <WorkCategoryChip active={false} label="No providers selected" />
              )}
            </div>
            <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>
              All providers returned for this region are selected by default.
            </p>
          </div>

          <h3 className="mt-5 text-base font-semibold" style={{ color: '#1f2937' }}>3. Model Use Cases</h3>
          <div className="mt-3" ref={capabilityMenuRef}>
            <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Capability List (multi-select)</label>
            <div className="relative">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#d9e0ee', color: '#1f2937', background: '#fff' }}
                onClick={() => {
                  setProviderMenuOpen(false);
                  setCapabilityMenuOpen(open => !open);
                }}
              >
                {capabilitySummary}
              </button>
              {capabilityMenuOpen && (
                <div className="absolute left-0 right-0 mt-2 rounded-lg border p-2 z-20 shadow-lg max-h-64 overflow-auto" style={{ borderColor: '#d9e0ee', background: '#fff' }}>
                  <label className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer border-b" style={{ color: '#1f2937', borderColor: '#e5e7eb' }}>
                    <input
                      type="checkbox"
                      checked={selectedCapabilities.length === 0}
                      onChange={clearCapabilityFilters}
                    />
                    <span className="font-medium">All Use Cases</span>
                  </label>
                  {MODEL_CAPABILITY_OPTIONS.map(option => (
                    <label key={option.key} className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer" style={{ color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={selectedCapabilities.includes(option.key)}
                        onChange={() => toggleCapability(option.key)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {selectedCapabilities.length === 0 ? (
                <WorkCategoryChip active label="All Use Cases" />
              ) : (
                MODEL_CAPABILITY_OPTIONS
                  .filter(option => selectedCapabilities.includes(option.key))
                  .map(option => <WorkCategoryChip key={option.key} active label={option.label} />)
              )}
            </div>
            <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>
              Models must match all selected Bedrock capabilities. Leave this on All Use Cases to browse the full catalog.
            </p>
          </div>
        </aside>

        <section className="rounded-xl border p-4" style={{ borderColor: '#2a2a35', background: '#ffffff' }}>
          <h3 className="text-base font-semibold" style={{ color: '#1f2937' }}>Bedrock Models</h3>
          <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
            Ordered by most recent Bedrock release. Active Models runs a live Bedrock runtime probe and capability filters use Bedrock metadata only.
          </p>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-lg border"
                style={{
                  borderColor: viewMode === 'active' ? '#bcd0ff' : '#d9e0ee',
                  background: viewMode === 'active' ? '#eaf0ff' : '#fff',
                  color: viewMode === 'active' ? '#234fb2' : '#1f2937',
                  fontWeight: viewMode === 'active' ? 600 : 400,
                }}
                onClick={() => setViewMode('active')}
              >
                Active Models
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-lg border"
                style={{
                  borderColor: viewMode === 'all' ? '#bcd0ff' : '#d9e0ee',
                  background: viewMode === 'all' ? '#eaf0ff' : '#fff',
                  color: viewMode === 'all' ? '#234fb2' : '#1f2937',
                  fontWeight: viewMode === 'all' ? 600 : 400,
                }}
                onClick={() => setViewMode('all')}
              >
                Show All Models
              </button>
            </div>
            <div className="text-xs" style={{ color: '#6b7280' }}>{catalogNote}</div>
          </div>

          {pageError ? (
            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
              <div className="font-semibold">{viewMode === 'active' ? 'Bedrock active check failed' : 'Live Bedrock discovery failed'}</div>
              <div className="mt-1 text-sm">{pageError.message}</div>
              <div className="mt-2 text-sm">Check AWS credentials, Bedrock permissions, and region availability for the backend container.</div>
            </div>
          ) : isLoading ? (
            <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: '#d9e0ee', background: '#fafcff', color: '#475569' }}>
              Loading live Bedrock catalog for {region}...
            </div>
          ) : checkingActiveMode && !activeChecksData ? (
            <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: '#d9e0ee', background: '#fafcff', color: '#475569' }}>
              Running a Bedrock runtime probe for the selected providers in {region}...
            </div>
          ) : visibleModels.length === 0 ? (
            <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: '#d9e0ee', background: '#fafcff', color: '#475569' }}>
              {viewMode === 'active'
                ? `No models responded to the Bedrock runtime probe for the current provider selection in ${region}.`
                : `No models matched the current provider filters in ${region}.`}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {visibleModels.map((model, index) => {
                const isExpanded = expandedFamilies.includes(model.familyKey);
                const actualCapabilities = getActualCapabilityLabels(model);

                return (
                  <article key={model.familyKey} className="border rounded-xl p-4" style={{ borderColor: '#d9e0ee', background: '#fff' }}>
                    <button
                      type="button"
                      onClick={() => toggleFamily(model.familyKey)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-base font-semibold" style={{ color: '#1f2937' }}>{index + 1}. {model.name}</div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]" style={{ borderColor: '#d9e0ee', color: '#6b7280' }}>
                            {model.provider}
                          </span>
                        </div>
                        <div className="mt-1 text-sm" style={{ color: '#475569' }}>
                          <span className="font-medium">Available in Bedrock:</span> {actualCapabilities.length > 0 ? actualCapabilities.join(', ') : 'Metadata unavailable'}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: '#94a3b8' }}>
                          Latest release {formatReleaseDate(model.releaseTimestamp)}. {model.variants.length} variant{model.variants.length === 1 ? '' : 's'} discovered in Bedrock for this family
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold" style={{ background: '#eaf2ff', color: '#234fb2', border: '1px solid #bdd1ff' }}>
                          Fit {model.fit}/100
                        </span>
                        <span className="text-sm font-semibold" style={{ color: '#64748b' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <StatTile label="Quality" value={model.quality} />
                          <StatTile label="Latency" value={model.latency} />
                          <StatTile label="Cost" value={model.cost} />
                          <StatTile label="Context" value={model.context} />
                        </div>

                        <div className="rounded-lg border p-3" style={{ borderColor: '#e2e8f0', background: '#fbfdff' }}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>
                              Estimated Use Case Scores
                            </div>
                            <div className="text-xs" style={{ color: '#94a3b8' }}>
                              Heuristic fit scores from balanced advisor signals and live Bedrock metadata. These are not external market rankings.
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {USE_CASE_SCORE_OPTIONS.map(option => (
                              <UseCaseScoreTile
                                key={`${model.familyKey}-${option.key}`}
                                label={option.label}
                                value={model.useCaseScores[option.key]}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {model.inputModalities.length > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border" style={{ borderColor: '#d9e0ee', color: '#6b7280' }}>
                              Input: {model.inputModalities.join(', ')}
                            </span>
                          )}
                          {model.outputModalities.length > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border" style={{ borderColor: '#d9e0ee', color: '#6b7280' }}>
                              Output: {model.outputModalities.join(', ')}
                            </span>
                          )}
                          {model.responseStreamingSupported && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border" style={{ borderColor: '#d9e0ee', color: '#6b7280' }}>
                              Streaming
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border" style={{ borderColor: '#d9e0ee', color: '#6b7280' }}>
                            {model.lifecycleStatus}
                          </span>
                        </div>

                        <div className="rounded-lg border p-3" style={{ borderColor: '#e2e8f0', background: '#fbfdff' }}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>
                              Bedrock Variants
                            </div>
                            <div className="text-xs" style={{ color: '#94a3b8' }}>
                              Variants collapse duplicate names across on-demand, inference profile, and provisioned entries.
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {model.variants.map(variant => (
                              <div key={variant.modelId} className="rounded-lg border px-3 py-2" style={{ borderColor: '#d9e0ee', background: '#fff' }}>
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="text-xs font-medium break-all" style={{ color: '#334155' }}>
                                    {variant.modelId}
                                  </div>
                                  <div className="text-right text-[11px]" style={{ color: '#64748b' }}>
                                    <div>Fit {variant.fit}/100</div>
                                    <div>{formatReleaseDate(variant.releaseTimestamp)}</div>
                                  </div>
                                </div>
                                <div className="mt-2 flex gap-2 flex-wrap">
                                  {variant.inferenceTypesSupported.map(type => (
                                    <span
                                      key={`${variant.modelId}-${type}`}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border"
                                      style={{ borderColor: '#d9e0ee', color: '#6b7280' }}
                                    >
                                      {formatLabel(type)}
                                    </span>
                                  ))}
                                  {variant.customizationsSupported.map(type => (
                                    <span
                                      key={`${variant.modelId}-custom-${type}`}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border"
                                      style={{ borderColor: '#d9e0ee', color: '#6b7280' }}
                                    >
                                      {formatLabel(type)}
                                    </span>
                                  ))}
                                  {variant.responseStreamingSupported && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border" style={{ borderColor: '#d9e0ee', color: '#6b7280' }}>
                                      Streaming
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 text-sm" style={{ borderTop: '1px dashed #d9e0ee', color: '#334155' }}>
                          {buildReason(model)}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
