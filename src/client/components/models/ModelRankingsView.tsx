import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBedrockActiveChecks, useBedrockModels } from '../../queries/bedrock';
import type { BedrockModelCatalogEntry } from '../../types';
import {
  MODEL_RANKINGS,
  MODEL_RANKING_CATEGORY_OPTIONS,
  MODEL_RANKING_VIEW_OPTIONS,
  type ModelRankingCategory,
  type ModelRankingEntry,
  type ModelRankingView,
} from './model-rankings-data';

type BedrockOverlayState = 'active' | 'listed' | 'unavailable';
type RankedModel = ModelRankingEntry & {
  finalScore: number;
  useCaseScore: number;
  bedrockState: BedrockOverlayState;
};
type SupplementalBedrockFamily = {
  key: string;
  name: string;
  provider: string;
  releaseTimestamp?: number;
  bedrockState: BedrockOverlayState;
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

const KNOWN_BEDROCK_PROVIDER_OPTIONS = [
  'AI21 Labs',
  'Amazon',
  'Anthropic',
  'Cohere',
  'DeepSeek',
  'Google',
  'Meta',
  'MiniMax',
  'Mistral',
  'Moonshot AI',
  'NVIDIA',
  'OpenAI',
  'Qwen',
  'Stability AI',
  'TwelveLabs',
  'Writer',
  'Z.AI',
];

const PROVIDER_ALIASES: Record<string, string> = {
  'mistral ai': 'Mistral',
};

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalizeProvider(provider: string) {
  return PROVIDER_ALIASES[normalizeKey(provider)] ?? provider;
}

function buildBedrockKey(provider: string, name: string) {
  return `${normalizeKey(canonicalizeProvider(provider))}::${normalizeKey(name)}`;
}

function formatTime(timestamp?: number) {
  if (!timestamp) return 'Pending';
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatReleaseTimestamp(timestamp?: number) {
  if (!timestamp) return 'Release date unavailable';
  return new Date(timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function selectedViewMeta(view: ModelRankingView) {
  return MODEL_RANKING_VIEW_OPTIONS.find(option => option.id === view) ?? MODEL_RANKING_VIEW_OPTIONS[0];
}

function selectedCategoryMeta(category: ModelRankingCategory) {
  return MODEL_RANKING_CATEGORY_OPTIONS.find(option => option.id === category) ?? MODEL_RANKING_CATEGORY_OPTIONS[0];
}

function StatusBadge({ status }: { status: BedrockOverlayState }) {
  const style = status === 'active'
    ? { background: '#edf9f1', color: '#1f8d53', borderColor: '#bae4ca' }
    : status === 'listed'
      ? { background: '#fff5e5', color: '#b26b0a', borderColor: '#f5d49f' }
      : { background: '#fff0ef', color: '#b42318', borderColor: '#f1b6b6' };

  const label = status === 'active'
    ? 'Bedrock Active'
    : status === 'listed'
      ? 'Bedrock Listed'
      : 'Not in Bedrock';

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-medium"
      style={style}
    >
      {label}
    </span>
  );
}

function EvidenceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border p-3.5" style={{ background: '#fbfdff', borderColor: '#d6deef' }}>
      <div className="mb-1 text-[13px] font-semibold" style={{ color: '#234fb2' }}>{title}</div>
      <p className="m-0 text-[14px] leading-6" style={{ color: '#596989' }}>{body}</p>
    </div>
  );
}

function SummaryCard({ title, model, subtitle }: { title: string; model?: RankedModel; subtitle: string }) {
  return (
    <div
      className="rounded-[20px] border px-4 py-4"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.05))', borderColor: 'rgba(151,168,214,0.16)' }}
    >
      <div className="text-[13px]" style={{ color: '#9dadcc' }}>{title}</div>
      <div className="mt-2 text-[20px] font-semibold text-white">{model?.name ?? 'No match'}</div>
      <div className="mt-1 text-[13px]" style={{ color: '#c1cdef' }}>
        {model ? `${model.provider} · ${model.finalScore}/100` : subtitle}
      </div>
      {model && <div className="mt-1 text-[12px]" style={{ color: '#97a8ca' }}>{subtitle}</div>}
    </div>
  );
}

export function ModelRankingsView() {
  const [view, setView] = useState<ModelRankingView>('popularity');
  const [category, setCategory] = useState<ModelRankingCategory>('coding');
  const [region, setRegion] = useState('us-east-1');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showBedrockActiveOnly, setShowBedrockActiveOnly] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(MODEL_RANKINGS[0]?.id ?? '');
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const previousRegionRef = useRef<string | null>(null);
  const previousProviderOptionsRef = useRef<string[]>([]);

  const { data: bedrockCatalog, isLoading: isLoadingCatalog, isFetching: isFetchingCatalog, error: catalogError, refetch } = useBedrockModels(region);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!providerMenuRef.current?.contains(event.target as Node)) {
        setProviderMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const bedrockEntries = bedrockCatalog?.models ?? [];
  const providerOptions = useMemo(() => {
    const liveProviders = bedrockEntries.map(entry => canonicalizeProvider(entry.provider));
    const curatedProviders = MODEL_RANKINGS.map(model => model.provider);
    return [...new Set([...KNOWN_BEDROCK_PROVIDER_OPTIONS, ...liveProviders, ...curatedProviders])].sort((a, b) => a.localeCompare(b));
  }, [bedrockEntries]);
  const selectedProviderProbeTargets = useMemo(() => {
    if (selectedProviders.length === 0) return [];

    const canonicalSelections = new Set(selectedProviders.map(provider => canonicalizeProvider(provider)));
    const targets = new Set<string>();

    for (const entry of bedrockEntries) {
      if (canonicalSelections.has(canonicalizeProvider(entry.provider))) {
        targets.add(entry.provider);
      }
    }

    if (targets.size === 0) {
      return [...canonicalSelections].sort((a, b) => a.localeCompare(b));
    }

    return [...targets].sort((a, b) => a.localeCompare(b));
  }, [bedrockEntries, selectedProviders]);
  const activeChecksEnabled = showBedrockActiveOnly && selectedProviderProbeTargets.length > 0;
  const {
    data: activeChecks,
    isLoading: isLoadingActiveChecks,
    isFetching: isFetchingActiveChecks,
    error: activeChecksError,
    refetch: refetchActiveChecks,
  } = useBedrockActiveChecks(region, selectedProviderProbeTargets, activeChecksEnabled);
  const curatedBedrockKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const model of MODEL_RANKINGS) {
      for (const alias of model.bedrockAliases) {
        keys.add(buildBedrockKey(model.provider, alias));
      }
    }
    return keys;
  }, []);

  const bedrockEntryById = useMemo(
    () => new Map(bedrockEntries.map(entry => [entry.modelId, entry] as const)),
    [bedrockEntries],
  );

  const listedBedrockKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of bedrockEntries) {
      keys.add(buildBedrockKey(entry.provider, entry.name));
    }
    return keys;
  }, [bedrockEntries]);

  const activeBedrockKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const check of activeChecks?.checks ?? []) {
      if (!check.isActive) continue;
      const entry = bedrockEntryById.get(check.modelId);
      if (!entry) continue;
      keys.add(buildBedrockKey(entry.provider, entry.name));
    }
    return keys;
  }, [activeChecks?.checks, bedrockEntryById]);

  useEffect(() => {
    if (providerOptions.length === 0) return;

    setSelectedProviders(current => {
      const regionChanged = previousRegionRef.current !== region;
      const previousOptions = previousProviderOptionsRef.current;
      const hadAllPreviously =
        previousOptions.length > 0 &&
        current.length === previousOptions.length &&
        previousOptions.every(provider => current.includes(provider));

      previousRegionRef.current = region;
      previousProviderOptionsRef.current = providerOptions;

      if (regionChanged || current.length === 0 || hadAllPreviously) {
        return providerOptions;
      }

      const filtered = current.filter(provider => providerOptions.includes(provider));
      return filtered.length > 0 ? filtered : providerOptions;
    });
  }, [providerOptions, region]);
  const selectedProviderStats = useMemo(() => {
    return selectedProviders.map(provider => {
      const listedFamilies = new Set<string>();
      const activeFamilies = new Set<string>();
      const canonicalProvider = canonicalizeProvider(provider);

      for (const entry of bedrockEntries) {
        if (canonicalizeProvider(entry.provider) !== canonicalProvider) continue;
        listedFamilies.add(buildBedrockKey(entry.provider, entry.name));
      }

      for (const key of activeBedrockKeys) {
        if (key.startsWith(`${normalizeKey(canonicalProvider)}::`)) {
          activeFamilies.add(key);
        }
      }

      return {
        provider,
        listedCount: listedFamilies.size,
        activeCount: activeFamilies.size,
      };
    });
  }, [activeBedrockKeys, bedrockEntries, selectedProviders]);

  function resolveBedrockState(model: ModelRankingEntry): BedrockOverlayState {
    for (const alias of model.bedrockAliases) {
      const key = buildBedrockKey(model.provider, alias);
      if (activeBedrockKeys.has(key)) return 'active';
    }
    for (const alias of model.bedrockAliases) {
      const key = buildBedrockKey(model.provider, alias);
      if (listedBedrockKeys.has(key)) return 'listed';
    }
    return 'unavailable';
  }

  function computeFinalScore(model: ModelRankingEntry) {
    const sourceScore = model.sourceScores[view];
    const useCaseScore = model.categoryScores[category];
    return Math.round((sourceScore * 0.65) + (useCaseScore * 0.35));
  }

  const rankedModels = useMemo<RankedModel[]>(() => {
    const base = MODEL_RANKINGS
      .filter(model => selectedProviders.includes(model.provider))
      .map(model => ({
        ...model,
        useCaseScore: model.categoryScores[category],
        finalScore: computeFinalScore(model),
        bedrockState: resolveBedrockState(model),
      }))
      .sort((a, b) => b.finalScore - a.finalScore || b.useCaseScore - a.useCaseScore || a.name.localeCompare(b.name));

    if (!showBedrockActiveOnly || !activeChecks) {
      return base;
    }

    return base.filter(model => model.bedrockState === 'active');
  }, [activeChecks, category, selectedProviders, showBedrockActiveOnly, view, activeBedrockKeys, listedBedrockKeys]);

  useEffect(() => {
    if (rankedModels.length === 0) return;
    if (!rankedModels.some(model => model.id === selectedModelId)) {
      setSelectedModelId(rankedModels[0].id);
    }
  }, [rankedModels, selectedModelId]);

  const selectedModel = rankedModels.find(model => model.id === selectedModelId) ?? rankedModels[0];
  const categoryMeta = selectedCategoryMeta(category);
  const viewMeta = selectedViewMeta(view);
  const allProvidersSelected = providerOptions.length > 0 && selectedProviders.length === providerOptions.length;
  const providerSummary = allProvidersSelected
    ? 'All Providers'
    : selectedProviders.length > 0
      ? selectedProviders.join(', ')
      : 'No providers selected';

  const loadingActiveOnly = showBedrockActiveOnly && !activeChecks && (isLoadingActiveChecks || isFetchingActiveChecks);
  const unavailableSelectedProviders = selectedProviderStats.filter(stat => stat.activeCount === 0);
  const supplementalFamilies = useMemo<SupplementalBedrockFamily[]>(() => {
    const grouped = new Map<string, SupplementalBedrockFamily>();

    for (const entry of bedrockEntries) {
      if (!selectedProviders.includes(entry.provider)) continue;

      const key = buildBedrockKey(entry.provider, entry.name);
      if (curatedBedrockKeys.has(key)) continue;

      const current = grouped.get(key);
      const bedrockState: BedrockOverlayState = activeBedrockKeys.has(key) ? 'active' : 'listed';

      if (!current) {
        grouped.set(key, {
          key,
          name: entry.name,
          provider: entry.provider,
          releaseTimestamp: entry.releaseTimestamp,
          bedrockState,
        });
        continue;
      }

      current.releaseTimestamp = Math.max(current.releaseTimestamp ?? 0, entry.releaseTimestamp ?? 0) || undefined;
      if (bedrockState === 'active') current.bedrockState = 'active';
    }

    const values = [...grouped.values()].sort((a, b) =>
      (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) || a.name.localeCompare(b.name),
    );

    return showBedrockActiveOnly
      ? values.filter(model => model.bedrockState === 'active')
      : values;
  }, [activeBedrockKeys, bedrockEntries, curatedBedrockKeys, selectedProviders, showBedrockActiveOnly]);
  const budgetCandidate = useMemo(
    () => [...rankedModels].sort((a, b) => b.categoryScores.budget - a.categoryScores.budget || b.sourceScores.operations - a.sourceScores.operations)[0],
    [rankedModels],
  );
  const summaryCards = useMemo(() => {
    const cards: Array<{ key: string; title: string; model?: RankedModel; subtitle: string }> = [];

    if (rankedModels[0]) {
      cards.push({ key: 'best', title: 'Best overall fit', model: rankedModels[0], subtitle: categoryMeta.label });
    }
    if (rankedModels[1]) {
      cards.push({ key: 'alt', title: 'Strong alternative', model: rankedModels[1], subtitle: viewMeta.label });
    }
    if (budgetCandidate && !cards.some(card => card.model?.id === budgetCandidate.id)) {
      cards.push({ key: 'value', title: 'Best value / tradeoff', model: budgetCandidate, subtitle: 'Budget + operations' });
    }

    return cards;
  }, [budgetCandidate, categoryMeta.label, rankedModels, viewMeta.label]);
  const supplementalSectionTitle = showBedrockActiveOnly ? 'Additional Active Bedrock Families' : 'Latest From Bedrock Catalog';
  const supplementalSectionCopy = showBedrockActiveOnly
    ? 'These families respond in Bedrock for the selected provider and region, but they are not yet covered by the curated public-ranking dataset. They stay outside the ranked list to avoid inventing unsupported scores.'
    : 'These model families were discovered live in Bedrock but are not yet represented in the curated public-ranking dataset. They are shown separately to avoid assigning fake leaderboard scores.';

  async function refreshOverlay() {
    await refetch();
    if (showBedrockActiveOnly) {
      await refetchActiveChecks();
    }
  }

  function toggleProvider(provider: string) {
    setSelectedProviders(current => {
      if (provider === '__all__') {
        return current.length === providerOptions.length ? [] : providerOptions;
      }

      if (current.includes(provider)) {
        return current.filter(item => item !== provider);
      }

      return [...current, provider].sort((a, b) => a.localeCompare(b));
    });
  }

  const selectedBedrockEntry = selectedModel
    ? bedrockEntries.find((entry: BedrockModelCatalogEntry) => selectedModel.bedrockAliases.includes(entry.name))
    : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold text-white">Model Rankings</h1>
          <p className="mt-2 max-w-4xl text-[15px] leading-6" style={{ color: '#9dadcc' }}>
            Compare models by usage, preference, capability, and operations. Ranking data is curated from public leaderboards; Bedrock listing and active checks are verified live in {region}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refreshOverlay()}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ background: '#2f6df6', border: '1px solid #3d7aff' }}
          >
            Refresh Bedrock Overlay
          </button>
        </div>
      </div>

      <div
        className="rounded-[22px] border px-5 py-4"
        style={{ background: 'rgba(9, 18, 40, 0.82)', borderColor: 'rgba(129, 168, 255, 0.22)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-[14px]" style={{ color: '#dbe5ff' }}>
          <span>Source tabs stay explicit. Bedrock overlay is live for the selected region; rankings themselves are not pretending to be a real-time external API feed.</span>
          <span style={{ color: '#9db1de' }}>
            Catalog refreshed {formatTime(bedrockCatalog?.fetchedAt)}
            {activeChecks?.checkedAt ? ` · Active probe ${formatTime(activeChecks.checkedAt)}` : ''}
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside
          className="rounded-[24px] border p-6 xl:sticky xl:self-start"
          style={{ top: 96, background: 'rgba(14, 20, 38, 0.88)', borderColor: 'rgba(151,168,214,0.14)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.22)' }}
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-[13px] uppercase tracking-[0.14em]" style={{ color: '#8da1cf' }}>View</p>
              <div className="flex flex-wrap gap-2">
                {MODEL_RANKING_VIEW_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setView(option.id)}
                    className="rounded-full border px-3.5 py-2 text-sm transition-colors"
                    style={option.id === view
                      ? { background: 'rgba(47,109,246,0.18)', borderColor: 'rgba(129, 168, 255, 0.68)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(151,168,214,0.2)', color: '#d8e1ff' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px]" style={{ color: '#9dadcc' }}>Use Case</label>
              <select
                value={category}
                onChange={event => setCategory(event.target.value as ModelRankingCategory)}
                className="w-full rounded-2xl border px-3.5 py-3 text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(151,168,214,0.18)' }}
              >
                {MODEL_RANKING_CATEGORY_OPTIONS.map(option => (
                  <option key={option.id} value={option.id} style={{ color: '#111827' }}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[13px]" style={{ color: '#9dadcc' }}>AWS Region</label>
              <select
                value={region}
                onChange={event => setRegion(event.target.value)}
                className="w-full rounded-2xl border px-3.5 py-3 text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(151,168,214,0.18)' }}
              >
                {BEDROCK_REGIONS.map(option => (
                  <option key={option} value={option} style={{ color: '#111827' }}>{option}</option>
                ))}
              </select>
            </div>

            <div ref={providerMenuRef} className="relative">
              <label className="mb-2 block text-[13px]" style={{ color: '#9dadcc' }}>Providers</label>
              <button
                type="button"
                onClick={() => setProviderMenuOpen(open => !open)}
                className="flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm text-white"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(151,168,214,0.18)' }}
              >
                <span className="truncate pr-3">{providerSummary}</span>
                <span style={{ color: '#93a7d0' }}>{providerMenuOpen ? '▴' : '▾'}</span>
              </button>
              {providerMenuOpen && (
                <div
                  className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-[20px] border p-2"
                  style={{ background: '#0f1730', borderColor: 'rgba(151,168,214,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
                >
                  <button
                    type="button"
                    onClick={() => toggleProvider('__all__')}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                    style={{ color: '#dbe5ff' }}
                  >
                    <input readOnly type="checkbox" checked={allProvidersSelected} className="h-4 w-4" />
                    <span>All Providers</span>
                  </button>
                  {providerOptions.map(provider => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => toggleProvider(provider)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                      style={{ color: '#dbe5ff' }}
                    >
                      <input readOnly type="checkbox" checked={selectedProviders.includes(provider)} className="h-4 w-4" />
                      <span>{provider}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 text-[12px]" style={{ color: '#8ea0c5' }}>
                {bedrockEntries.length > 0
                  ? `Showing ${providerOptions.length} provider options from live Bedrock discovery.`
                  : isLoadingCatalog || isFetchingCatalog
                    ? 'Loading live Bedrock providers for this region…'
                    : catalogError
                      ? 'Live Bedrock provider list is unavailable. Showing fallback provider options.'
                      : `Showing ${providerOptions.length} provider options.`}
              </div>
            </div>

            <div>
              <label
                className="flex items-center justify-between rounded-[18px] border px-4 py-3 text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(151,168,214,0.16)', color: '#d8e1ff' }}
              >
                <span>Show active in Bedrock only</span>
                <input
                  type="checkbox"
                  checked={showBedrockActiveOnly}
                  onChange={event => setShowBedrockActiveOnly(event.target.checked)}
                  className="h-4 w-4"
                  style={{ accentColor: '#2f6df6' }}
                />
              </label>
            </div>

            {showBedrockActiveOnly && (
              <div className="rounded-[18px] border px-4 py-4 text-[12px] leading-5" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(151,168,214,0.12)', color: '#9eb0d4' }}>
                <div className="mb-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: '#8da1cf' }}>Provider availability in {region}</div>
                <div className="space-y-1.5">
                  {selectedProviderStats.map(stat => (
                    <div key={stat.provider} className="flex items-center justify-between gap-3">
                      <span>{stat.provider}</span>
                      <span style={{ color: '#dbe5ff' }}>
                        {stat.activeCount} active / {stat.listedCount} listed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[18px] border px-4 py-4 text-[12px] leading-5" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(151,168,214,0.12)', color: '#9eb0d4' }}>
              `Popularity`, `Human Preference`, `Capability`, and `Operations` are different measurement systems. This page keeps them separate on purpose so users do not confuse usage with benchmark strength.
            </div>
          </div>
        </aside>

        <main
          className="min-w-0 rounded-[24px] border p-6"
          style={{ background: 'rgba(14, 20, 38, 0.88)', borderColor: 'rgba(151,168,214,0.14)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.22)' }}
        >
          {summaryCards.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-3">
              {summaryCards.map(card => (
                <SummaryCard key={card.key} title={card.title} model={card.model} subtitle={card.subtitle} />
              ))}
            </div>
          )}

          {showBedrockActiveOnly && unavailableSelectedProviders.length > 0 && (
            <div className="mt-6 rounded-[20px] border px-5 py-4 text-[13px] leading-6" style={{ background: 'rgba(255, 245, 229, 0.92)', borderColor: '#f5d49f', color: '#8a5408' }}>
              {unavailableSelectedProviders.map(stat => `${stat.provider}: 0 active / ${stat.listedCount} listed in ${region}`).join(' · ')}.
              These providers are selected, but they will not appear in the ranked results while `Show active in Bedrock only` is enabled.
            </div>
          )}

          {supplementalFamilies.length > 0 && (
            <div className="mt-6 rounded-[24px] border px-5 py-5" style={{ background: 'rgba(9, 18, 40, 0.82)', borderColor: 'rgba(129, 168, 255, 0.18)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-white">{supplementalSectionTitle}</h2>
                  <p className="mt-1 max-w-3xl text-[13px] leading-6" style={{ color: '#9db1de' }}>
                    {supplementalSectionCopy}
                  </p>
                </div>
                <div className="text-[12px]" style={{ color: '#8ea0c5' }}>
                  {showBedrockActiveOnly ? 'Sorted by release date among active families' : 'Sorted by release date, newest first'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {supplementalFamilies.map(model => (
                  <div
                    key={model.key}
                    className="rounded-[20px] border px-4 py-4"
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(151,168,214,0.16)' }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={model.bedrockState} />
                      <span className="inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium" style={{ background: '#eef3ff', borderColor: '#c7d9ff', color: '#234fb2' }}>
                        Catalog Only
                      </span>
                    </div>
                    <div className="mt-3 text-[22px] font-semibold text-white">{model.name}</div>
                    <div className="mt-2 text-[13px]" style={{ color: '#c1cdef' }}>
                      {model.provider} · {formatReleaseTimestamp(model.releaseTimestamp)}
                    </div>
                    <div className="mt-3 text-[13px] leading-6" style={{ color: '#9db1de' }}>
                      Live Bedrock discovery found this family, but the page does not yet have source-backed popularity, preference, capability, or operations ranking data for it.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-[24px] border" style={{ background: '#f5f7fb', borderColor: '#d6deef' }}>
            <div
              className="grid min-w-[1060px] items-center gap-4 border-b px-5 py-4 text-[12px] uppercase tracking-[0.12em]"
              style={{ color: '#60708f', background: '#eef3fb', borderColor: '#d6deef', gridTemplateColumns: '70px minmax(360px,1.75fr) minmax(280px,1.2fr) 130px 150px' }}
            >
              <div>Rank</div>
              <div>Model</div>
              <div>Reason</div>
              <div>Score</div>
              <div>Source</div>
            </div>

            {loadingActiveOnly ? (
              <div className="px-5 py-10 text-center text-[15px]" style={{ color: '#60708f' }}>
                Checking live Bedrock integration for the selected providers in {region}…
              </div>
            ) : rankedModels.length === 0 ? (
              <div className="px-5 py-10 text-center text-[15px]" style={{ color: '#60708f' }}>
                {selectedProviders.length === 0
                  ? 'No providers selected.'
                  : showBedrockActiveOnly
                    ? 'No ranked models passed the live Bedrock active check for this filter set.'
                    : 'No models match the selected filters.'}
              </div>
            ) : (
              rankedModels.map((model, index) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModelId(model.id)}
                  className="grid min-w-[1060px] w-full items-start gap-4 border-b px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[#eef4ff]"
                  style={{
                    color: '#111a31',
                    background: model.id === selectedModelId ? '#eef4ff' : '#f5f7fb',
                    borderColor: '#e7edf8',
                    gridTemplateColumns: '70px minmax(360px,1.75fr) minmax(280px,1.2fr) 130px 150px',
                  }}
                >
                  <div className="flex items-center">
                    <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] font-bold" style={{ background: '#e8efff', color: '#204fb1' }}>
                      {index + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[20px] font-semibold" style={{ color: '#121a31' }}>{model.name}</div>
                    <div className="mt-1 text-[13px] leading-5" style={{ color: '#6a7996' }}>
                      {model.provider} · {model.releaseLabel} · {model.tagline}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={model.bedrockState} />
                      <span className="inline-flex rounded-full border px-2.5 py-1 text-[12px]" style={{ background: '#fff', borderColor: '#d6deef', color: '#5d6e8e' }}>
                        {categoryMeta.label} {model.useCaseScore}/100
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] leading-6" style={{ color: '#4d5d7f' }}>
                      {model.sourceRationales[view]}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="min-w-[104px] whitespace-nowrap rounded-[16px] px-3 py-3 text-center text-[16px] font-semibold" style={{ background: '#eef3ff', color: '#234fb2' }}>
                      {model.finalScore}/100
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium" style={{ background: '#edf3ff', borderColor: '#c7d9ff', color: '#234fb2' }}>
                      {viewMeta.sourceLabel}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {(catalogError || activeChecksError) && (
            <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ background: 'rgba(255, 240, 239, 0.88)', borderColor: '#f1b6b6', color: '#8f2d26' }}>
              {catalogError ? `Bedrock catalog error: ${catalogError.message}. ` : ''}
              {activeChecksError ? `Active check error: ${activeChecksError.message}.` : ''}
            </div>
          )}
        </main>

        <aside
          className="rounded-[24px] border p-6 xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:self-start"
          style={{ top: 96, background: 'rgba(14, 20, 38, 0.88)', borderColor: 'rgba(151,168,214,0.14)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.22)' }}
        >
          {selectedModel ? (
            <div className="overflow-hidden rounded-[24px] border" style={{ background: '#f5f7fb', borderColor: '#d6deef', color: '#111a31' }}>
              <div className="border-b px-5 py-5" style={{ background: 'linear-gradient(180deg, #fafdff 0%, #edf3ff 100%)', borderColor: '#d6deef' }}>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selectedModel.bedrockState} />
                  <span className="inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium" style={{ background: '#edf3ff', borderColor: '#c7d9ff', color: '#234fb2' }}>
                    {viewMeta.sourceLabel}
                  </span>
                </div>
                <h2 className="mt-3 text-[28px] font-semibold" style={{ color: '#111a31' }}>{selectedModel.name}</h2>
                <p className="mt-2 text-[14px] leading-6" style={{ color: '#60708f' }}>{selectedModel.tagline}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b px-5 py-5" style={{ borderColor: '#d6deef' }}>
                {([
                  ['Popularity', selectedModel.sourceScores.popularity],
                  ['Preference', selectedModel.sourceScores.preference],
                  ['Capability', selectedModel.sourceScores.capability],
                  ['Operations', selectedModel.sourceScores.operations],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-[18px] border px-3 py-3" style={{ background: '#fbfdff', borderColor: '#d6deef' }}>
                    <div className="text-[11px] uppercase tracking-[0.08em]" style={{ color: '#73819f' }}>{label}</div>
                    <div className="mt-2 text-[19px] font-semibold" style={{ color: '#111a31' }}>{value}/100</div>
                  </div>
                ))}
              </div>

              <div className="border-b px-5 py-5" style={{ borderColor: '#d6deef' }}>
                <div className="mb-3 text-[13px] uppercase tracking-[0.12em]" style={{ color: '#6d7c99' }}>Selected Use Case</div>
                <div className="flex flex-wrap gap-2">
                  {selectedModel.useCases.map(useCase => {
                    const option = selectedCategoryMeta(useCase);
                    return (
                      <span
                        key={useCase}
                        className="inline-flex rounded-full border px-2.5 py-1 text-[12px]"
                        style={useCase === category
                          ? { background: '#edf3ff', borderColor: '#c7d9ff', color: '#234fb2' }
                          : { background: '#fff', borderColor: '#d6deef', color: '#5d6e8e' }}
                      >
                        {option.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="border-b px-5 py-5" style={{ borderColor: '#d6deef' }}>
                <div className="mb-3 text-[13px] uppercase tracking-[0.12em]" style={{ color: '#6d7c99' }}>Operational Snapshot</div>
                <div className="space-y-3">
                  <EvidenceCard title="Market Share" body={`${selectedModel.stats.marketShare} · ${selectedModel.stats.arena}`} />
                  <EvidenceCard title="Cost / Latency / Context" body={`${selectedModel.stats.priceBand} · ${selectedModel.stats.latency} · ${selectedModel.stats.contextWindow} context window`} />
                  <EvidenceCard
                    title="Bedrock Overlay"
                    body={`${selectedModel.bedrockNote} Latest catalog release: ${selectedBedrockEntry?.releaseTimestamp ? formatReleaseTimestamp(selectedBedrockEntry.releaseTimestamp) : 'not returned by Bedrock for this family.'}`}
                  />
                </div>
              </div>

              <div className="border-b px-5 py-5" style={{ borderColor: '#d6deef' }}>
                <div className="mb-3 text-[13px] uppercase tracking-[0.12em]" style={{ color: '#6d7c99' }}>Why It Ranks</div>
                <div className="space-y-3">
                  <EvidenceCard title="OpenRouter Usage" body={selectedModel.evidence.openrouter} />
                  <EvidenceCard title="Arena Preference" body={selectedModel.evidence.arena} />
                  <EvidenceCard title="Capability Benchmarks" body={selectedModel.evidence.analysis} />
                  <EvidenceCard title="Ops View" body={selectedModel.evidence.operations} />
                </div>
              </div>

              <div className="px-5 py-5 text-[12px] leading-5" style={{ color: '#8ea0c5' }}>
                This page is intentionally explicit about source type. Usage, human preference, benchmark capability, and operations are not merged into a hidden composite.
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border px-5 py-10 text-center text-sm" style={{ background: '#f5f7fb', borderColor: '#d6deef', color: '#60708f' }}>
              Select a model to inspect source evidence and Bedrock status.
            </div>
          )}
        </aside>
      </div>

      {(isLoadingCatalog || isFetchingCatalog || isFetchingActiveChecks) && (
        <div className="text-right text-[12px]" style={{ color: '#8ea0c5' }}>
          {isLoadingCatalog || isFetchingCatalog ? 'Refreshing Bedrock catalog… ' : ''}
          {isFetchingActiveChecks ? 'Running live active checks…' : ''}
        </div>
      )}
    </div>
  );
}
