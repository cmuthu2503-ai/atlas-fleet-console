import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBedrockModels } from '../../queries/bedrock';
import type { BedrockModelCatalogEntry, BedrockWorkCategory } from '../../types';

type Scale = 'small' | 'medium' | 'large';
type ViewMode = 'all' | 'recommended';
type RankedModel = BedrockModelCatalogEntry & { fit: number; matchCount: number };
type GroupedRankedModel = {
  familyKey: string;
  name: string;
  provider: string;
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
  matchCount: number;
  variants: RankedModel[];
};

const CATEGORY_OPTIONS: Array<{ value: BedrockWorkCategory; label: string }> = [
  { value: 'chat', label: 'Conversational Assistant' },
  { value: 'code', label: 'Code Generation' },
  { value: 'analysis', label: 'Document Analysis' },
  { value: 'rag', label: 'RAG / Knowledge QA' },
  { value: 'creative', label: 'Creative Content' },
];

const BEDROCK_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

function buildReason(
  model: Pick<BedrockModelCatalogEntry, 'tags' | 'context' | 'latency' | 'cost'>,
  selectedCategories: BedrockWorkCategory[],
) {
  const reasons: string[] = [];
  const overlap = model.tags.filter(tag => selectedCategories.includes(tag));

  if (selectedCategories.length === 0) {
    reasons.push('Broad fit when ranking without a specific work category');
  } else if (overlap.length > 0) {
    reasons.push(`Matches selected categories: ${overlap.join(', ')}`);
  }

  if (model.context > 85) reasons.push('Large context signal for long prompts');
  if (model.latency > 85) reasons.push('Fast response profile inferred from model family');
  if (model.cost > 85) reasons.push('Cost-efficient profile inferred from model family');
  if (reasons.length === 0) reasons.push('Balanced profile across quality, latency, and cost');

  return `${reasons.slice(0, 2).join('. ')}.`;
}

export function BedrockModelAdvisorView() {
  const [selectedCategories, setSelectedCategories] = useState<BedrockWorkCategory[]>(['chat']);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [scale, setScale] = useState<Scale>('medium');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [quality, setQuality] = useState(70);
  const [latency, setLatency] = useState(55);
  const [cost, setCost] = useState(45);
  const [context, setContext] = useState(65);
  const [region, setRegion] = useState('us-east-1');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [activityNote, setActivityNote] = useState('');
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const previousRegionRef = useRef<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useBedrockModels(region);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
      if (!providerMenuRef.current?.contains(event.target as Node)) {
        setProviderMenuOpen(false);
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

  function toggleCategory(value: BedrockWorkCategory) {
    setSelectedCategories(current =>
      current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    );
  }

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

  function importRequirementsPreset() {
    setSelectedCategories(['analysis', 'rag']);
    setScale('medium');
    setQuality(72);
    setLatency(48);
    setCost(43);
    setContext(78);
    setActivityNote('Loaded sample requirements preset for document-heavy retrieval workflows.');
  }

  function saveEvaluation() {
    setActivityNote(`Evaluation saved at ${formatTime(new Date())}.`);
  }

  async function refreshCatalog() {
    const result = await refetch();
    if (result.error) {
      setActivityNote(`Refresh failed at ${formatTime(new Date())}.`);
      return;
    }
    setActivityNote(`Catalog refreshed at ${formatTime(new Date())}.`);
  }

  function computeFit(model: BedrockModelCatalogEntry) {
    const qualityWeight = quality / 100;
    const latencyWeight = latency / 100;
    const costWeight = cost / 100;
    const contextWeight = context / 100;
    const norm = qualityWeight + latencyWeight + costWeight + contextWeight || 1;

    let base = (
      (model.quality * qualityWeight) +
      (model.latency * latencyWeight) +
      (model.cost * costWeight) +
      (model.context * contextWeight)
    ) / norm;

    const overlap = model.tags.filter(tag => selectedCategories.includes(tag)).length;
    if (selectedCategories.length === 0) {
      base += 4;
    } else if (overlap > 0) {
      base += Math.min(14, 6 + (overlap * 4));
    }

    if (scale === 'large') base += (model.latency + model.cost) / 40;
    if (scale === 'small') base += model.quality / 25;

    return Math.min(99, Math.round(base));
  }

  const categorySummary = selectedCategories.length
    ? selectedCategories.map(value => CATEGORY_OPTIONS.find(option => option.value === value)?.label ?? value).join(', ')
    : 'Select one or more categories';

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

  const rankedModels = useMemo<RankedModel[]>(
    () => (data?.models ?? [])
      .filter(model => selectedProviders.includes(model.provider))
      .map(model => ({
        ...model,
        fit: computeFit(model),
        matchCount: selectedCategories.length === 0
          ? 1
          : model.tags.filter(tag => selectedCategories.includes(tag)).length,
      }))
      .sort((a, b) => b.fit - a.fit || a.name.localeCompare(b.name) || a.modelId.localeCompare(b.modelId)),
    [computeFit, data?.models, selectedCategories, selectedProviders],
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
          matchCount: model.matchCount,
          variants: [model],
        });
        continue;
      }

      existing.tags = uniqueValues([...existing.tags, ...model.tags]) as BedrockWorkCategory[];
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
      existing.matchCount = Math.max(existing.matchCount, model.matchCount);
      existing.variants.push(model);
    }

    return [...grouped.values()]
      .map(model => ({
        ...model,
        variants: [...model.variants].sort((a, b) =>
          b.fit - a.fit ||
          b.inferenceTypesSupported.length - a.inferenceTypesSupported.length ||
          a.modelId.localeCompare(b.modelId),
        ),
      }))
      .sort((a, b) => b.fit - a.fit || a.name.localeCompare(b.name));
  }, [rankedModels]);

  const visibleModels = viewMode === 'all'
    ? groupedModels
    : (groupedModels.filter(model => model.matchCount > 0).length > 0
        ? groupedModels.filter(model => model.matchCount > 0)
        : groupedModels.slice(0, 3));

  const catalogNote = viewMode === 'all'
    ? `Showing all ${visibleModels.length}/${groupedModels.length} model families from ${rankedModels.length} Bedrock entries in ${region}.`
    : `Showing ${visibleModels.length}/${groupedModels.length} recommended model families from ${rankedModels.length} Bedrock entries.`;

  let bannerText = 'Connecting to Bedrock model discovery.';
  if (isLoading) {
    bannerText = `Discovering live Bedrock models in ${region}.`;
  } else if (isFetching) {
    bannerText = `Refreshing live Bedrock catalog from ${region}.`;
  } else if (error) {
    bannerText = error.message;
  } else if (activityNote) {
    bannerText = activityNote;
  } else if (data) {
    bannerText = `Using live Bedrock model discovery from ${data.region}. Results are grouped by model family, with Bedrock variants folded into each card.`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-white">Bedrock Model Advisor</h2>
          <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
            Choose work categories and constraints, then compare live Bedrock models by fit.
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
        <div className="text-sm" style={{ color: error ? '#fecaca' : '#dbe4ff' }}>{bannerText}</div>
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          Last refreshed {data?.fetchedAt ? formatTime(new Date(data.fetchedAt)) : 'n/a'}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-xl border p-4" style={{ borderColor: '#2a2a35', background: '#ffffff' }}>
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

            <div ref={categoryMenuRef}>
              <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Category of Work (multi-select)</label>
              <div className="relative">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: '#d9e0ee', color: '#1f2937', background: '#fff' }}
                  onClick={() => setCategoryMenuOpen(open => !open)}
                >
                  {categorySummary}
                </button>
                {categoryMenuOpen && (
                  <div className="absolute left-0 right-0 mt-2 rounded-lg border p-2 z-20 shadow-lg" style={{ borderColor: '#d9e0ee', background: '#fff' }}>
                    {CATEGORY_OPTIONS.map(option => (
                      <label key={option.value} className="flex items-center gap-2 px-1 py-2 text-sm cursor-pointer" style={{ color: '#334155' }}>
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(option.value)}
                          onChange={() => toggleCategory(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {selectedCategories.length > 0 ? (
                  selectedCategories.map(value => {
                    const label = CATEGORY_OPTIONS.find(option => option.value === value)?.label ?? value;
                    return <WorkCategoryChip key={value} active label={label} />;
                  })
                ) : (
                  <WorkCategoryChip active={false} label="No category selected (showing broad ranking)" />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Team Size / Throughput</label>
              <select
                value={scale}
                onChange={event => setScale(event.target.value as Scale)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#d9e0ee', color: '#1f2937', background: '#fff' }}
              >
                <option value="small">Small team (low concurrency)</option>
                <option value="medium">Medium team</option>
                <option value="large">Large scale / high concurrency</option>
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
                onClick={() => setProviderMenuOpen(open => !open)}
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

          <h3 className="mt-5 text-base font-semibold" style={{ color: '#1f2937' }}>3. Priorities</h3>
          <div className="mt-3 space-y-3">
            {[
              { key: 'quality', label: 'Quality', value: quality, setValue: setQuality },
              { key: 'latency', label: 'Latency', value: latency, setValue: setLatency },
              { key: 'cost', label: 'Cost Efficiency', value: cost, setValue: setCost },
              { key: 'context', label: 'Context Window', value: context, setValue: setContext },
            ].map(item => (
              <div key={item.key} className="border rounded-lg p-3" style={{ borderColor: '#d9e0ee', background: '#fafcff' }}>
                <div className="flex items-center justify-between text-xs mb-2" style={{ color: '#6b7280' }}>
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={item.value}
                  onChange={event => item.setValue(Number(event.target.value))}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border p-4" style={{ borderColor: '#2a2a35', background: '#ffffff' }}>
          <h3 className="text-base font-semibold" style={{ color: '#1f2937' }}>Recommended Models</h3>
          <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
            Ranked by weighted fit to your selected categories and priorities.
          </p>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
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
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-lg border"
                style={{
                  borderColor: viewMode === 'recommended' ? '#bcd0ff' : '#d9e0ee',
                  background: viewMode === 'recommended' ? '#eaf0ff' : '#fff',
                  color: viewMode === 'recommended' ? '#234fb2' : '#1f2937',
                  fontWeight: viewMode === 'recommended' ? 600 : 400,
                }}
                onClick={() => setViewMode('recommended')}
              >
                Show Recommended Only
              </button>
            </div>
            <div className="text-xs" style={{ color: '#6b7280' }}>{catalogNote}</div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
              <div className="font-semibold">Live Bedrock discovery failed</div>
              <div className="mt-1 text-sm">{error.message}</div>
              <div className="mt-2 text-sm">Check AWS credentials, Bedrock permissions, and region availability for the backend container.</div>
            </div>
          ) : isLoading ? (
            <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: '#d9e0ee', background: '#fafcff', color: '#475569' }}>
              Loading live Bedrock catalog for {region}...
            </div>
          ) : visibleModels.length === 0 ? (
            <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: '#d9e0ee', background: '#fafcff', color: '#475569' }}>
              No models matched the current provider filters in {region}.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {visibleModels.map((model, index) => (
                <article key={model.familyKey} className="border rounded-xl p-4" style={{ borderColor: '#d9e0ee', background: '#fff' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-base font-semibold" style={{ color: '#1f2937' }}>{index + 1}. {model.name}</div>
                      <div className="mt-1 text-sm" style={{ color: '#6b7280' }}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]" style={{ borderColor: '#d9e0ee' }}>{model.provider}</span>
                        <span className="ml-2">Best for: {model.tags.join(', ')}</span>
                      </div>
                      <div className="mt-1 text-xs" style={{ color: '#94a3b8' }}>
                        {model.variants.length} variant{model.variants.length === 1 ? '' : 's'} discovered in Bedrock for this family
                      </div>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold" style={{ background: '#eaf2ff', color: '#234fb2', border: '1px solid #bdd1ff' }}>
                      Fit {model.fit}/100
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile label="Quality" value={model.quality} />
                    <StatTile label="Latency" value={model.latency} />
                    <StatTile label="Cost" value={model.cost} />
                    <StatTile label="Context" value={model.context} />
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
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

                  <div className="mt-3 rounded-lg border p-3" style={{ borderColor: '#e2e8f0', background: '#fbfdff' }}>
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
                            <div className="text-[11px]" style={{ color: '#64748b' }}>
                              Fit {variant.fit}/100
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

                  <div className="mt-3 pt-3 text-sm" style={{ borderTop: '1px dashed #d9e0ee', color: '#334155' }}>
                    {buildReason(model, selectedCategories)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
