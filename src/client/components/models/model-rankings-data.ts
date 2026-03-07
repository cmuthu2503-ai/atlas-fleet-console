export type ModelRankingView = 'popularity' | 'preference' | 'capability' | 'operations';
export type ModelRankingCategory =
  | 'coding'
  | 'creative'
  | 'conversational'
  | 'power'
  | 'agentic'
  | 'budget'
  | 'longContext'
  | 'toolCalling';

export interface ModelRankingEntry {
  id: string;
  name: string;
  provider: string;
  family: string;
  tagline: string;
  useCases: ModelRankingCategory[];
  bedrockAliases: string[];
  releaseLabel: string;
  sourceScores: Record<ModelRankingView, number>;
  categoryScores: Record<ModelRankingCategory, number>;
  stats: {
    marketShare: string;
    arena: string;
    intelligence: string;
    latency: string;
    priceBand: string;
    contextWindow: string;
  };
  sourceRationales: Record<ModelRankingView, string>;
  evidence: {
    openrouter: string;
    arena: string;
    analysis: string;
    operations: string;
  };
  bedrockNote: string;
}

export const MODEL_RANKING_CATEGORY_OPTIONS: Array<{ id: ModelRankingCategory; label: string }> = [
  { id: 'coding', label: 'Coding' },
  { id: 'creative', label: 'Creative Writing' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'power', label: 'Most Powerful' },
  { id: 'agentic', label: 'Agentic' },
  { id: 'budget', label: 'Budget' },
  { id: 'longContext', label: 'Long Context' },
  { id: 'toolCalling', label: 'Tool Calling' },
];

export const MODEL_RANKING_VIEW_OPTIONS: Array<{ id: ModelRankingView; label: string; sourceLabel: string }> = [
  { id: 'popularity', label: 'Popularity', sourceLabel: 'OpenRouter Usage' },
  { id: 'preference', label: 'Human Preference', sourceLabel: 'Arena' },
  { id: 'capability', label: 'Capability', sourceLabel: 'Artificial Analysis + LiveBench' },
  { id: 'operations', label: 'Operations', sourceLabel: 'Operational Composite' },
];

export const MODEL_RANKINGS: ModelRankingEntry[] = [
  {
    id: 'claude-sonnet-45',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    family: 'Claude Sonnet',
    tagline: 'High-trust generalist for coding, agentic workflows, and long-form business reasoning.',
    useCases: ['coding', 'conversational', 'power', 'agentic', 'longContext'],
    bedrockAliases: ['Claude Sonnet 4.5'],
    releaseLabel: 'Sep 2025',
    sourceScores: {
      popularity: 94,
      preference: 96,
      capability: 97,
      operations: 79,
    },
    categoryScores: {
      coding: 97,
      creative: 86,
      conversational: 95,
      power: 97,
      agentic: 96,
      budget: 60,
      longContext: 93,
      toolCalling: 95,
    },
    stats: {
      marketShare: '18.2%',
      arena: 'Top 3 overall',
      intelligence: '97/100',
      latency: 'Medium',
      priceBand: '$$$',
      contextWindow: '1M',
    },
    sourceRationales: {
      popularity: 'Strong share in production coding and general-purpose workloads.',
      preference: 'Ranks highly in coding, multi-turn, and hard-prompt preference tests.',
      capability: 'Near-frontier capability with strong reasoning and agentic execution.',
      operations: 'Premium cost profile; acceptable latency for deep work, weaker for chat-at-scale.',
    },
    evidence: {
      openrouter: 'Strong share in production coding and general-purpose workloads.',
      arena: 'Ranks highly in coding, multi-turn, and hard-prompt preference tests.',
      analysis: 'Near-frontier capability with strong reasoning and agentic execution.',
      operations: 'Premium cost profile; acceptable latency for deep work, weaker for chat-at-scale.',
    },
    bedrockNote: 'Listed in the Bedrock catalog, but active support depends on the current account channel and entitlements.',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    family: 'Claude Sonnet',
    tagline: 'Balanced frontier model with strong code quality and dependable conversational behavior.',
    useCases: ['coding', 'conversational', 'power', 'agentic'],
    bedrockAliases: ['Claude Sonnet 4'],
    releaseLabel: 'May 2025',
    sourceScores: {
      popularity: 92,
      preference: 94,
      capability: 95,
      operations: 82,
    },
    categoryScores: {
      coding: 96,
      creative: 84,
      conversational: 93,
      power: 95,
      agentic: 94,
      budget: 64,
      longContext: 89,
      toolCalling: 94,
    },
    stats: {
      marketShare: '16.8%',
      arena: 'Top 5 overall',
      intelligence: '95/100',
      latency: 'Medium',
      priceBand: '$$$',
      contextWindow: '1M',
    },
    sourceRationales: {
      popularity: 'Widely adopted across coding assistants and internal copilots.',
      preference: 'Strong head-to-head wins in coding and conversational categories.',
      capability: 'Frontier-level capability with broad task coverage.',
      operations: 'Better balance than larger premium models; still not cost-first.',
    },
    evidence: {
      openrouter: 'Widely adopted across coding assistants and internal copilots.',
      arena: 'Strong head-to-head wins in coding and conversational categories.',
      analysis: 'Frontier-level capability with broad task coverage.',
      operations: 'Better balance than larger premium models; still not cost-first.',
    },
    bedrockNote: 'Responds through a Bedrock inference profile in supported regions when the account has access.',
  },
  {
    id: 'gemini-25-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    family: 'Gemini',
    tagline: 'Broad reasoning model with strong multimodal support and long-context handling.',
    useCases: ['coding', 'creative', 'conversational', 'power', 'longContext'],
    bedrockAliases: ['Gemini 2.5 Pro'],
    releaseLabel: 'Jan 2026',
    sourceScores: {
      popularity: 89,
      preference: 90,
      capability: 96,
      operations: 81,
    },
    categoryScores: {
      coding: 93,
      creative: 90,
      conversational: 91,
      power: 96,
      agentic: 90,
      budget: 58,
      longContext: 98,
      toolCalling: 88,
    },
    stats: {
      marketShare: '11.4%',
      arena: 'Top 10 overall',
      intelligence: '96/100',
      latency: 'Medium',
      priceBand: '$$$',
      contextWindow: '2M',
    },
    sourceRationales: {
      popularity: 'Popular for multimodal and document-heavy reasoning flows.',
      preference: 'Strong on long-form and nuanced instruction following.',
      capability: 'Excellent context, reasoning, and multimodal capability.',
      operations: 'High-context strength offsets a premium cost profile.',
    },
    evidence: {
      openrouter: 'Popular for multimodal and document-heavy reasoning flows.',
      arena: 'Strong on long-form and nuanced instruction following.',
      analysis: 'Excellent context, reasoning, and multimodal capability.',
      operations: 'High-context strength offsets a premium cost profile.',
    },
    bedrockNote: 'This entry remains in the rankings for decision context even when it is not available in the selected Bedrock region.',
  },
  {
    id: 'deepseek-v32',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    family: 'DeepSeek',
    tagline: 'High-value coding and reasoning model with strong price-performance.',
    useCases: ['coding', 'power', 'budget', 'agentic'],
    bedrockAliases: ['DeepSeek V3.2'],
    releaseLabel: 'Feb 2026',
    sourceScores: {
      popularity: 83,
      preference: 84,
      capability: 89,
      operations: 93,
    },
    categoryScores: {
      coding: 92,
      creative: 74,
      conversational: 78,
      power: 89,
      agentic: 87,
      budget: 95,
      longContext: 82,
      toolCalling: 84,
    },
    stats: {
      marketShare: '8.7%',
      arena: 'Rising in code arenas',
      intelligence: '89/100',
      latency: 'Fast',
      priceBand: '$',
      contextWindow: '256k',
    },
    sourceRationales: {
      popularity: 'Usage is rising quickly in coding and cost-sensitive teams.',
      preference: 'Competitive in coding, weaker in style-sensitive creative tasks.',
      capability: 'Strong capability relative to price; not the top conversational model.',
      operations: 'Excellent cost and throughput profile.',
    },
    evidence: {
      openrouter: 'Usage is rising quickly in coding and cost-sensitive teams.',
      arena: 'Competitive in coding, weaker in style-sensitive creative tasks.',
      analysis: 'Strong capability relative to price; not the top conversational model.',
      operations: 'Excellent cost and throughput profile.',
    },
    bedrockNote: 'When the active overlay is enabled, this entry should survive only if the live Bedrock probe succeeds.',
  },
  {
    id: 'nova-premier',
    name: 'Amazon Nova Premier',
    provider: 'Amazon',
    family: 'Nova',
    tagline: 'Enterprise-friendly Bedrock-native option with strong governance fit.',
    useCases: ['conversational', 'creative', 'budget', 'toolCalling'],
    bedrockAliases: ['Amazon Nova Premier'],
    releaseLabel: 'Dec 2025',
    sourceScores: {
      popularity: 74,
      preference: 78,
      capability: 80,
      operations: 90,
    },
    categoryScores: {
      coding: 76,
      creative: 84,
      conversational: 86,
      power: 79,
      agentic: 80,
      budget: 89,
      longContext: 85,
      toolCalling: 91,
    },
    stats: {
      marketShare: '5.1%',
      arena: 'Mid-pack overall',
      intelligence: '80/100',
      latency: 'Fast',
      priceBand: '$$',
      contextWindow: '300k',
    },
    sourceRationales: {
      popularity: 'Adoption is driven more by enterprise stack fit than public share.',
      preference: 'Better in practical dialog than in frontier-comparison leaderboards.',
      capability: 'Solid, not frontier-leading, but operationally dependable.',
      operations: 'Strong Bedrock alignment and practical deployment profile.',
    },
    evidence: {
      openrouter: 'Adoption is driven more by enterprise stack fit than public share.',
      arena: 'Better in practical dialog than in frontier-comparison leaderboards.',
      analysis: 'Solid, not frontier-leading, but operationally dependable.',
      operations: 'Strong Bedrock alignment and practical deployment profile.',
    },
    bedrockNote: 'This is the benchmark entry for a Bedrock-native operationally safe default.',
  },
  {
    id: 'llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    family: 'Llama',
    tagline: 'Flexible large-scale model with strong open-ecosystem momentum.',
    useCases: ['creative', 'conversational', 'budget', 'longContext'],
    bedrockAliases: ['Llama 4 Maverick'],
    releaseLabel: 'Nov 2025',
    sourceScores: {
      popularity: 80,
      preference: 79,
      capability: 84,
      operations: 88,
    },
    categoryScores: {
      coding: 80,
      creative: 87,
      conversational: 84,
      power: 83,
      agentic: 79,
      budget: 90,
      longContext: 88,
      toolCalling: 77,
    },
    stats: {
      marketShare: '7.4%',
      arena: 'Strong in open-model comparisons',
      intelligence: '84/100',
      latency: 'Fast',
      priceBand: '$',
      contextWindow: '512k',
    },
    sourceRationales: {
      popularity: 'Strong community and open-stack usage.',
      preference: 'Performs well in conversational and creative preference tests for an open model.',
      capability: 'Capable but below frontier proprietary models on hard reasoning.',
      operations: 'Very attractive for cost-sensitive scaling.',
    },
    evidence: {
      openrouter: 'Strong community and open-stack usage.',
      arena: 'Performs well in conversational and creative preference tests for an open model.',
      analysis: 'Capable but below frontier proprietary models on hard reasoning.',
      operations: 'Very attractive for cost-sensitive scaling.',
    },
    bedrockNote: 'Listed models may exist in Bedrock, but active status can still vary by account access and runtime support.',
  },
  {
    id: 'mistral-large-2',
    name: 'Mistral Large 2',
    provider: 'Mistral',
    family: 'Mistral Large',
    tagline: 'European enterprise choice with balanced reasoning and deployment profile.',
    useCases: ['coding', 'conversational', 'budget', 'toolCalling'],
    bedrockAliases: ['Mistral Large 2'],
    releaseLabel: 'Aug 2025',
    sourceScores: {
      popularity: 72,
      preference: 75,
      capability: 82,
      operations: 87,
    },
    categoryScores: {
      coding: 83,
      creative: 76,
      conversational: 81,
      power: 82,
      agentic: 81,
      budget: 86,
      longContext: 80,
      toolCalling: 85,
    },
    stats: {
      marketShare: '4.9%',
      arena: 'Solid enterprise-grade results',
      intelligence: '82/100',
      latency: 'Fast',
      priceBand: '$$',
      contextWindow: '256k',
    },
    sourceRationales: {
      popularity: 'Steady usage in enterprise and region-sensitive deployments.',
      preference: 'Generally competitive, though not a category leader.',
      capability: 'Balanced profile with good deployment economics.',
      operations: 'Strong operations score due to cost, latency, and region flexibility.',
    },
    evidence: {
      openrouter: 'Steady usage in enterprise and region-sensitive deployments.',
      arena: 'Generally competitive, though not a category leader.',
      analysis: 'Balanced profile with good deployment economics.',
      operations: 'Strong operations score due to cost, latency, and region flexibility.',
    },
    bedrockNote: 'This entry is useful as a deployable alternative when premium frontier models are too expensive or restricted.',
  },
  {
    id: 'claude-haiku-45',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    family: 'Claude Haiku',
    tagline: 'Fast, lightweight assistant for conversational tasks and high-throughput workflows.',
    useCases: ['conversational', 'budget', 'toolCalling'],
    bedrockAliases: ['Claude Haiku 4.5'],
    releaseLabel: 'Oct 2025',
    sourceScores: {
      popularity: 78,
      preference: 77,
      capability: 74,
      operations: 95,
    },
    categoryScores: {
      coding: 72,
      creative: 73,
      conversational: 88,
      power: 73,
      agentic: 76,
      budget: 94,
      longContext: 76,
      toolCalling: 89,
    },
    stats: {
      marketShare: '6.6%',
      arena: 'Strong for speed-oriented tasks',
      intelligence: '74/100',
      latency: 'Very fast',
      priceBand: '$',
      contextWindow: '200k',
    },
    sourceRationales: {
      popularity: 'Popular where responsiveness matters more than frontier depth.',
      preference: 'Competitive for dialog, weaker on hard reasoning and coding.',
      capability: 'Lightweight model optimized for speed and scale.',
      operations: 'Top-tier operating profile for high-volume usage.',
    },
    evidence: {
      openrouter: 'Popular where responsiveness matters more than frontier depth.',
      arena: 'Competitive for dialog, weaker on hard reasoning and coding.',
      analysis: 'Lightweight model optimized for speed and scale.',
      operations: 'Top-tier operating profile for high-volume usage.',
    },
    bedrockNote: 'This is the strongest candidate when the decision is primarily about throughput and response time.',
  },
];
