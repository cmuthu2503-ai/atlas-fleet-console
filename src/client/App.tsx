import React, { useState, useMemo } from 'react';
import { useAgents, useCreateAgent, useDeleteAgent, useRemoveAgentFromTeam, useDisableAgent, useEnableAgent, useNameSuggestions, useAllAgentUsages, useUpdateAgent } from './queries/agents';
import { useBedrockActiveChecks, useBedrockModels } from './queries/bedrock';
import { useTeams, useCreateTeam, useDeleteTeam, useAddAgentToTeam, useDisableTeam, useEnableTeam } from './queries/teams';
import { useTasks } from './queries/tasks';
import { useDelegationSteps } from './queries/delegation';
import { StatusDot } from './components/shared/StatusDot';
import { KanbanBoardView } from './components/board/KanbanBoard';
import { BedrockModelAdvisorView } from './components/models/BedrockModelAdvisor';
import { ModelRankingsView } from './components/models/ModelRankingsView';
import type { Agent, Team, Task, DelegationStep, BedrockModelCatalogEntry } from './types';

type View = 'orgchart' | 'fleet' | 'traces' | 'board' | 'models' | 'rankings';

const SPECIALIZATIONS = [
  'Enterprise Architecture', 'Platform Architecture', 'Data Architecture', 'Technology Architecture',
  'Backend', 'Frontend', 'Security', 'DevOps', 'QA', 'AI/ML', 'Data Engineering', 'Retrieval', 'Product Management',
];

// ─── Avatar Emojis ───
const agentAvatars: Record<string, string> = {
  'ceo': '👔', 'coo': '🎯', 'cto': '⚡', 'cpo': '🔮', 'jira': '📋',
  'linus': '⚙️', 'pixel': '🎨', 'ada': '🔒', 'terraform': '🏗️',
  'sentinel': '🛡️', 'turing': '🧠', 'piper': '📊', 'vector': '🔍',
  'nova': '⭐',
  'atlas': '🏛️', 'nimbus': '☁️', 'prism': '💎',
  'bastion': '🏰', 'bridge': '🌉', 'forge': '🔥',
};

// ─── Model Badge Mapping ───
function getModelBadge(model?: string): { label: string; color: string; bg: string; border: string } | null {
  if (!model) return null;
  const normalized = model.toLowerCase();
  if (normalized.includes('opus 4.6') || normalized.includes('opus-4.6')) return { label: 'Opus 4.6', color: '#e8a030', bg: '#3a2a1a', border: '#5a4a2a' };
  if (normalized.includes('opus 4.5') || normalized.includes('opus-4.5')) return { label: 'Opus 4.5', color: '#e8a030', bg: '#3a2a1a', border: '#5a4a2a' };
  if (normalized.includes('opus')) return { label: 'Opus', color: '#e8a030', bg: '#3a2a1a', border: '#5a4a2a' };
  if (normalized.includes('sonnet 4.6') || normalized.includes('sonnet-4.6')) return { label: 'Sonnet 4.6', color: '#60a5fa', bg: '#1a2a3a', border: '#2a3a5a' };
  if (normalized.includes('sonnet 4.5') || normalized.includes('sonnet-4.5')) return { label: 'Sonnet 4.5', color: '#60a5fa', bg: '#1a2a3a', border: '#2a3a5a' };
  if (normalized.includes('sonnet 4') || normalized.includes('sonnet-4')) return { label: 'Sonnet 4', color: '#60a5fa', bg: '#1a2a3a', border: '#2a3a5a' };
  if (normalized.includes('sonnet')) return { label: 'Sonnet', color: '#60a5fa', bg: '#1a2a3a', border: '#2a3a5a' };
  if (normalized.includes('haiku')) return { label: 'Haiku', color: '#7dd3fc', bg: '#172554', border: '#1d4ed8' };
  if (normalized.includes('kimi')) return { label: 'Kimi K2.5', color: '#14b8a6', bg: '#1a3a2a', border: '#2a5a3a' };
  if (normalized.includes('deepseek') && normalized.includes('3.2')) return { label: 'DeepSeek V3.2', color: '#a78bfa', bg: '#2a1a3a', border: '#3a2a5a' };
  if (normalized.includes('deepseek')) return { label: 'DeepSeek V3', color: '#a78bfa', bg: '#2a1a3a', border: '#3a2a5a' };
  if (normalized.includes('nova')) return { label: model, color: '#f59e0b', bg: '#3a2d12', border: '#654318' };
  return { label: model, color: '#cbd5e1', bg: '#2a2a2a', border: '#3a3a3a' };
}

function ModelBadge({ model }: { model?: string }) {
  const badge = getModelBadge(model);
  if (!badge) return null;
  return (
    <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium">
      {badge.label}
    </span>
  );
}

type ModelRecommendation = {
  model: BedrockModelCatalogEntry;
  score: number;
  reasons: string[];
};

function describeAgentPersonality(agent: Agent) {
  if (agent.persona?.trim()) return agent.persona.trim();

  const parts = [agent.role, agent.specialization].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'General-purpose operational agent';
}

function scoreModelForAgent(agent: Agent, model: BedrockModelCatalogEntry): ModelRecommendation {
  const profile = `${agent.persona || ''} ${agent.role} ${agent.specialization || ''}`.toLowerCase();
  const reasons: string[] = [];
  const hasVision = model.inputModalities.includes('IMAGE') || model.outputModalities.includes('IMAGE');
  const hasInferenceProfile = model.inferenceTypesSupported.includes('INFERENCE_PROFILE');
  const strategic = /(ceo|coo|cto|cpo|chief|architect|owner|manager|lead|strategy|strategic|consult)/.test(profile);
  const productOrConversational = /(product|owner|coo|manager|scrum|consult|stakeholder|conversation|coordination)/.test(profile);
  const implementation = /(backend|frontend|engineer|security|devops|qa|retrieval|ai\/ml|data|developer|platform)/.test(profile);
  const creative = /(design|creative|ux|ui|brand|story|visual|frontend)/.test(profile);
  const longContext = /(architect|strategy|retrieval|data|product|chief|research|analysis|planning)/.test(profile);
  const budgetAware = /(qa|operations|ops|support|devops)/.test(profile);

  let score = (model.quality * 0.36) + (model.context * 0.24) + (model.latency * 0.18) + (model.cost * 0.12);

  if (strategic) {
    score += (model.quality * 0.12) + (model.context * 0.1);
    reasons.push('Strong reasoning and long-context fit');
  }
  if (productOrConversational) {
    score += (model.tags.includes('chat') ? 10 : 0) + (model.latency * 0.08);
    reasons.push('Good for conversational coordination');
  }
  if (implementation) {
    score += (model.tags.includes('code') ? 10 : 0) + (model.quality * 0.08) + (model.responseStreamingSupported ? 3 : 0);
    reasons.push('Suited to implementation-heavy work');
  }
  if (creative) {
    score += hasVision ? 8 : 0;
    if (hasVision) reasons.push('Supports visually oriented workflows');
  }
  if (longContext) {
    score += model.context * 0.1;
    reasons.push('Handles planning and large context well');
  }
  if (budgetAware) {
    score += model.cost * 0.08;
    reasons.push('Keeps cost efficiency in view');
  }
  if (hasInferenceProfile) {
    score += 2;
  }
  if (model.responseStreamingSupported) {
    score += 2;
  }

  return {
    model,
    score: Math.round(Math.min(99, score / 1.25)),
    reasons: [...new Set(reasons)].slice(0, 2),
  };
}

function getRecommendedModelsForAgent(agent: Agent, models: BedrockModelCatalogEntry[]) {
  return models
    .map(model => scoreModelForAgent(agent, model))
    .sort((a, b) =>
      b.score - a.score ||
      (b.model.releaseTimestamp ?? 0) - (a.model.releaseTimestamp ?? 0) ||
      a.model.provider.localeCompare(b.model.provider) ||
      a.model.name.localeCompare(b.model.name),
    );
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: '#1a3a1a', color: '#4ade80', border: '1px solid #2a5a2a' }}>
      <span className="w-3 h-3 rounded-sm flex items-center justify-center text-[9px]" style={{ background: '#4ade80', color: '#111' }}>✓</span>
      Active
    </span>
  );
}

function formatModelRate(usage?: {
  estimatedInputCostPer1M?: number;
  estimatedOutputCostPer1M?: number;
}) {
  const input = usage?.estimatedInputCostPer1M;
  const output = usage?.estimatedOutputCostPer1M;

  if (typeof input !== 'number' || typeof output !== 'number') {
    return '—';
  }

  return `I:$${input}/O:$${output}`;
}

function Avatar({ agentId, size = 48 }: { agentId: string; size?: number }) {
  const emoji = agentAvatars[agentId] || '🤖';
  return (
    <div className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: '#2a2a35', border: '2px solid #3a3a4a', fontSize: size * 0.45 }}>
      {emoji}
    </div>
  );
}

// ─── Collapsible Team Section ───
function TeamSection({ name, description, agents: teamAgents, defaultExpanded = true }: {
  name: string; description: string; agents: Agent[]; defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
      <div className="flex items-center justify-between mb-1 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <span className="text-[16px] font-bold text-white">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px]" style={{ color: '#777' }}>{teamAgents.length} agent{teamAgents.length !== 1 ? 's' : ''}</span>
          <span style={{ color: '#c4a04a', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      <p className="text-[12px] mb-4" style={{ color: '#888' }}>{description}</p>
      {expanded && (
        <div className="space-y-3">
          {teamAgents.map(agent => (
            <div key={agent.id} className="rounded-xl p-4" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }}>
              <div className="flex items-center gap-3 mb-1">
                <Avatar agentId={agent.agentId} size={32} />
                <span className="text-[15px] font-semibold text-white">{agent.name}</span>
              </div>
              <div className="text-[12px] mb-2" style={{ color: '#999' }}>{agent.role}</div>
              <div className="flex flex-wrap gap-1.5">
                {(agent.status === 'online' || agent.status === 'idle' || agent.status === 'busy') && <ActiveBadge />}
                <ModelBadge model={agent.model} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Executive Card ───
function ExecCard({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#1e1e24', border: '1px solid #8B7332' }}>
      <Avatar agentId={agent.agentId} size={56} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[18px] font-bold text-white">{agent.name}</span>
          <ModelBadge model={agent.model} />
        </div>
        <div className="text-[14px] font-semibold mt-0.5" style={{ color: '#D4A030' }}>{agent.role}</div>
        <div className="text-[12px] mt-1 leading-relaxed" style={{ color: '#999' }}>
          {agent.persona || `${agent.specialization} leadership and strategic direction`}
        </div>
      </div>
    </div>
  );
}

// ─── Collapse Toggle Icon ───
function CollapseToggle({ expanded, onClick }: { expanded: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} className="ml-2 p-1 rounded-md hover:bg-white/10 transition-colors" title={expanded ? 'Collapse' : 'Expand'}
      style={{ color: '#c4a04a', fontSize: 14, lineHeight: 1 }}>
      {expanded ? '▾' : '▸'}
    </button>
  );
}

// ─── Org Chart View (Reference Match) ───
function OrgChartView({ agents }: { agents: Agent[]; teams: Team[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const isExpanded = (key: string) => !collapsed[key];

  const byId = useMemo(() => {
    const m: Record<string, Agent> = {};
    agents.forEach(a => { m[a.agentId] = a; m[a.id] = a; });
    return m;
  }, [agents]);

  const ceo = agents.find(a => a.agentId === 'ceo');
  const coo = agents.find(a => a.agentId === 'coo');
  const cto = agents.find(a => a.agentId === 'cto');
  const cpo = agents.find(a => a.agentId === 'cpo');

  const jira = agents.find(a => a.agentId === 'jira');

  // CTO direct reports grouped into teams
  const linus = byId['linus'], ada = byId['ada'], pixel = byId['pixel'], terraform = byId['terraform'];
  const sentinel = byId['sentinel'], turing = byId['turing'], piper = byId['piper'], vector = byId['vector'];
  const nova = byId['nova'];

  // Technology Consulting Office (reports directly to CTO)
  const atlas = byId['atlas'], nimbus = byId['nimbus'], prism = byId['prism'];
  const bastion = byId['bastion'], bridge = byId['bridge'], forge = byId['forge'];

  if (!ceo || !coo) return <p className="text-gray-500">Loading agents...</p>;

  return (
    <div className="w-full min-h-[calc(100vh-80px)] relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, #1a5a4a 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8">
        {/* CEO Card */}
        <div className="flex flex-col items-center mb-0">
          <div className="rounded-2xl px-6 py-5 flex items-center gap-4 min-w-[340px] cursor-pointer select-none"
            onClick={() => toggle('ceo')}
            style={{ background: 'linear-gradient(135deg, #2a2418 0%, #1e2a1e 100%)', border: '1px solid #8B7332' }}>
            <Avatar agentId="ceo" size={60} />
            <div className="flex-1">
              <div className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#c4a04a' }}>CEO</div>
              <div className="flex items-center">
                <div className="text-[24px] font-bold text-white leading-tight">{ceo.name}</div>
                <CollapseToggle expanded={isExpanded('ceo')} onClick={(e) => { e.stopPropagation(); toggle('ceo'); }} />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <ModelBadge model={ceo.model} />
              </div>
            </div>
          </div>
          {isExpanded('ceo') && (
            <div className="flex flex-col items-center">
              <div style={{ width: 2, height: 30, background: '#4a5a3a' }} />
            </div>
          )}
        </div>

        {/* Everything below CEO */}
        {isExpanded('ceo') && (<>
        {/* COO Card */}
        <div className="flex flex-col items-center mb-0">
          <div className="rounded-2xl px-6 py-5 flex items-center gap-4 min-w-[340px] cursor-pointer select-none"
            onClick={() => toggle('coo')}
            style={{ background: 'linear-gradient(135deg, #1e2a1e 0%, #2a2418 100%)', border: '1px solid #3a4a2a' }}>
            <Avatar agentId="coo" size={60} />
            <div className="flex-1">
              <div className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#c4a04a' }}>COO</div>
              <div className="flex items-center">
                <div className="text-[24px] font-bold text-white leading-tight">{coo.name}</div>
                <CollapseToggle expanded={isExpanded('coo')} onClick={(e) => { e.stopPropagation(); toggle('coo'); }} />
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: '#8a9a7a' }}>
                Research · Delegation · Execution · Orchestration
              </div>
              <div className="mt-1"><ModelBadge model={coo.model} /></div>
            </div>
          </div>
          {isExpanded('coo') && (
            <div className="flex flex-col items-center">
              <div style={{ width: 2, height: 30, background: '#4a5a3a' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c4a04a', marginTop: -1 }} />
            </div>
          )}
        </div>

        {/* Everything below COO */}
        {isExpanded('coo') && (<>
        {/* CTO / CPO Executive Row */}
        <div className="grid grid-cols-2 gap-5 mt-4 mb-8">
          {cto && (
            <div className="rounded-xl p-5 flex items-start gap-4 cursor-pointer select-none"
              onClick={() => toggle('cto')}
              style={{ background: '#1e1e24', border: '1px solid #8B7332' }}>
              <Avatar agentId={cto.agentId} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[18px] font-bold text-white">{cto.name}</span>
                  <CollapseToggle expanded={isExpanded('cto')} onClick={(e) => { e.stopPropagation(); toggle('cto'); }} />
                  <ModelBadge model={cto.model} />
                </div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: '#D4A030' }}>{cto.role}</div>
                <div className="text-[12px] mt-1 leading-relaxed" style={{ color: '#999' }}>
                  {cto.persona || `${cto.specialization} leadership and strategic direction`}
                </div>
              </div>
            </div>
          )}
          {cpo && (
            <div className="rounded-xl p-5 flex items-start gap-4 cursor-pointer select-none"
              onClick={() => toggle('cpo')}
              style={{ background: '#1e1e24', border: '1px solid #8B7332' }}>
              <Avatar agentId={cpo.agentId} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[18px] font-bold text-white">{cpo.name}</span>
                  <CollapseToggle expanded={isExpanded('cpo')} onClick={(e) => { e.stopPropagation(); toggle('cpo'); }} />
                  <ModelBadge model={cpo.model} />
                </div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: '#D4A030' }}>{cpo.role}</div>
                <div className="text-[12px] mt-1 leading-relaxed" style={{ color: '#999' }}>
                  {cpo.persona || `${cpo.specialization} leadership and strategic direction`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Department Grid */}
        <div className="grid grid-cols-2 gap-5">
          {/* CTO Column */}
          {isExpanded('cto') && (
          <div>
            <TeamSection name="Backend & Security" description="APIs, business logic, data pipelines, vulnerability scanning, and code audits"
              agents={[linus, ada].filter(Boolean)} />
            <TeamSection name="Frontend & DevOps" description="UI/UX implementation, design systems, CI/CD, deployments, and infrastructure"
              agents={[pixel, terraform].filter(Boolean)} />
            <TeamSection name="QA Team" description="Test strategy, test automation, code quality reviews, and coverage enforcement"
              agents={[sentinel].filter(Boolean)} />
            {[turing, piper, vector].filter(Boolean).length > 0 && (
              <TeamSection name="AI & Data" description="AI/ML architecture, data pipelines, and retrieval systems"
                agents={[turing, piper, vector].filter(Boolean)} />
            )}
            {[atlas, nimbus, prism, bastion, bridge, forge].filter(Boolean).length > 0 && (
              <TeamSection name="Technology Consulting" description="Enterprise architecture, cloud, data, security, integration, and DevOps consulting"
                agents={[atlas, nimbus, prism, bastion, bridge, forge].filter(Boolean)} />
            )}
          </div>
          )}
          {!isExpanded('cto') && isExpanded('cpo') && <div />}

          {/* CPO Column + Scrum Master */}
          {isExpanded('cpo') && (
          <div>
            <TeamSection name="Product Owner Team" description="Product intelligence, go-to-market strategy, and launch campaigns"
              agents={[nova].filter(Boolean)} />

            {/* Scrum Master — Jira (cross-functional, reports to COO) */}
            {jira && (
              <div className="mt-5">
                <div className="rounded-2xl px-5 py-4 flex items-center gap-4 w-full"
                  style={{ background: 'linear-gradient(135deg, #1a2a3a 0%, #1e1e2a 100%)', border: '1px solid #2a3a5a' }}>
                  <Avatar agentId="jira" size={52} />
                  <div>
                    <div className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#60a5fa' }}>Scrum Master</div>
                    <div className="text-[20px] font-bold text-white leading-tight">{jira.name}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: '#8a9aaa' }}>{jira.role}</div>
                    <div className="mt-1"><ModelBadge model={jira.model} /></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
        </>)}
        </>)}
      </div>
    </div>
  );
}

// ─── Modal Shell ───
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-xl shadow-xl w-full max-w-md p-6" style={{ background: '#1e1e24', border: '1px solid #3a3a4a' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, onClose, onConfirm, message }: { open: boolean; onClose: () => void; onConfirm: () => void; message: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm">
      <p className="text-gray-400 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
      </div>
    </Modal>
  );
}

// ─── Unified Fleet View (Two-Panel: Teams Sidebar + Agents Table) ───
// ─── Stat Card ───
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-5 py-4 flex-1 min-w-[140px]" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
      <div className="text-[12px] font-medium" style={{ color: '#777' }}>{label}</div>
      <div className="text-[20px] font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function FleetView({ teams, agents }: { teams: Team[]; agents: Agent[] }) {
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const disableAgent = useDisableAgent();
  const enableAgent = useEnableAgent();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const disableTeam = useDisableTeam();
  const enableTeam = useEnableTeam();

  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState<string | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState({ name: '', role: '', model: '', teamId: '', specialization: '' });
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [draftModels, setDraftModels] = useState<Record<string, string>>({});
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<Record<string, string>>({});
  const { data: suggestions } = useNameSuggestions(agentForm.specialization || null);
  const { data: bedrockCatalog } = useBedrockModels('us-east-1');
  const bedrockProviders = useMemo(
    () => [...new Set((bedrockCatalog?.models ?? []).map(model => model.provider))].sort((a, b) => a.localeCompare(b)),
    [bedrockCatalog?.models],
  );
  const { data: activeChecksData, isLoading: checkingActiveModels } = useBedrockActiveChecks('us-east-1', bedrockProviders, bedrockProviders.length > 0);

  // Token usage for all agents
  const agentIds = useMemo(() => agents.map(a => a.id), [agents]);
  const { data: usageData } = useAllAgentUsages(agentIds);

  // Team agent counts
  const teamAgentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    agents.forEach(a => { if (a.teamId) counts[a.teamId] = (counts[a.teamId] || 0) + 1; });
    return counts;
  }, [agents]);

  // Find team lead for the selected team
  const findTeamLead = (teamName: string): Agent | undefined => {
    const nameLC = teamName.toLowerCase();
    const match = nameLC.match(/^(\w+)\s+team$/);
    if (match) return agents.find(a => a.agentId === match[1]);
    // Try matching agentId directly (e.g. "COO" → agentId "coo")
    return agents.find(a => a.agentId === nameLC || a.role.toLowerCase() === nameLC);
  };

  // Filtered agents with lead at top
  const { filteredAgents, teamLead } = useMemo(() => {
    if (!selectedTeamId) return { filteredAgents: agents, teamLead: undefined };
    const teamMembers = agents.filter(a => a.teamId === selectedTeamId);
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    if (!selectedTeam) return { filteredAgents: teamMembers, teamLead: undefined };

    const lead = findTeamLead(selectedTeam.name);
    if (!lead) return { filteredAgents: teamMembers, teamLead: undefined };

    // Lead may or may not be in this team's members; ensure they appear first
    const membersWithoutLead = teamMembers.filter(a => a.id !== lead.id);
    return { filteredAgents: [lead, ...membersWithoutLead], teamLead: lead };
  }, [agents, teams, selectedTeamId]);

  // Team name map
  const teamNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    teams.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [teams]);

  const resetAgentForm = () => { setAgentForm({ name: '', role: '', model: '', teamId: '', specialization: '' }); setShowCreateAgent(false); };
  const resetTeamForm = () => { setTeamForm({ name: '', description: '' }); setShowCreateTeam(false); };

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const liveModelOptions = useMemo(() => {
    const activeModelIds = new Set((activeChecksData?.checks ?? []).filter(check => check.isActive).map(check => check.modelId));
    const grouped = new Map<string, BedrockModelCatalogEntry>();

    for (const model of bedrockCatalog?.models ?? []) {
      if (!activeModelIds.has(model.modelId)) continue;
      if (!model.inputModalities.includes('TEXT') || !model.outputModalities.includes('TEXT')) continue;
      if (model.lifecycleStatus === 'LEGACY') continue;

      const key = `${model.provider}::${model.name}`;
      const existing = grouped.get(key);

      if (!existing || (model.releaseTimestamp ?? 0) > (existing.releaseTimestamp ?? 0)) {
        grouped.set(key, model);
      }
    }

    return [...grouped.values()]
      .sort((a, b) =>
        (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0) ||
        a.provider.localeCompare(b.provider) ||
        a.name.localeCompare(b.name),
      );
  }, [activeChecksData?.checks, bedrockCatalog?.models]);

  function updateDraftModel(agentId: string, value: string) {
    setDraftModels(current => ({ ...current, [agentId]: value }));
    setModelStatus(current => ({ ...current, [agentId]: '' }));
  }

  function assignAgentModel(agent: Agent) {
    const nextModel = (draftModels[agent.id] ?? agent.model ?? '').trim();

    if (nextModel === (agent.model ?? '')) {
      setModelStatus(current => ({ ...current, [agent.id]: 'Model is already assigned.' }));
      return;
    }

    setSavingAgentId(agent.id);
    updateAgent.mutate(
      { id: agent.id, model: nextModel || undefined },
      {
        onSuccess: () => {
          setModelStatus(current => ({
            ...current,
            [agent.id]: nextModel ? `Assigned ${nextModel}.` : 'Cleared model assignment.',
          }));
          setDraftModels(current => {
            const next = { ...current };
            delete next[agent.id];
            return next;
          });
          setSavingAgentId(null);
        },
        onError: (error: Error) => {
          setModelStatus(current => ({ ...current, [agent.id]: error.message || 'Failed to update model.' }));
          setSavingAgentId(null);
        },
      },
    );
  }

  // Fleet summary totals
  const totalTokens24h = useMemo(() => {
    if (!usageData) return 0;
    return Object.values(usageData).reduce((sum, u) => sum + (u.tokens24h || 0), 0);
  }, [usageData]);

  const totalActivityEvents = useMemo(() => {
    if (!usageData) return 0;
    return Object.values(usageData).reduce((sum, usage) => sum + (usage.activityEventCount || 0), 0);
  }, [usageData]);

  return (
    <>
      {/* Fleet Summary Cards */}
      <div className="flex gap-4 mb-5">
        <StatCard label="Teams" value={String(teams.length)} />
        <StatCard label="Agents" value={String(agents.length)} />
        <StatCard label="Tokens / 24h" value={totalActivityEvents === 0 ? 'No activity' : formatTokens(totalTokens24h)} />
      </div>

      <div className="grid gap-5 min-h-[calc(100vh-140px)] xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Teams Sidebar (30%) ── */}
        <div className="xl:w-[280px] xl:shrink-0">
          <div className="rounded-xl overflow-hidden" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2a2a35' }}>
              <span className="text-sm font-semibold text-white">Teams</span>
              <button onClick={() => setShowCreateTeam(true)} className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700">+ Team</button>
            </div>
            {/* All option */}
            <div onClick={() => setSelectedTeamId(null)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${!selectedTeamId ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}
              style={{ borderBottom: '1px solid #2a2a35' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">All</span>
              </div>
              <span className="text-xs text-gray-500 rounded-full px-2 py-0.5" style={{ background: '#2a2a35' }}>{agents.length}</span>
            </div>
            {/* Team list */}
            {teams.map(t => (
              <div key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selectedTeamId === t.id ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}
                style={{ borderBottom: '1px solid #2a2a35' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'active' ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <span className="text-sm font-medium text-white truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500 rounded-full px-2 py-0.5" style={{ background: '#2a2a35' }}>
                    {teamAgentCounts[t.id] || 0}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); t.status === 'active' ? disableTeam.mutate(t.id) : enableTeam.mutate(t.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-400 text-xs" title="Toggle status">
                    {t.status === 'active' ? '⏸' : '▶'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteTeam(t.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs" title="Delete">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Agents Table (70%) ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              {selectedTeamId ? teamNameMap[selectedTeamId] || 'Team' : 'All Agents'}
              <span className="text-gray-500 font-normal ml-2">({filteredAgents.length})</span>
              {selectedTeamId && usageData && (
                <span className="text-gray-400 font-normal ml-2">
                  — {filteredAgents.reduce((sum, a) => sum + (usageData[a.id]?.activityEventCount || 0), 0) === 0
                    ? 'No activity'
                    : `${formatTokens(filteredAgents.reduce((sum, a) => sum + (usageData[a.id]?.totalTokens || 0), 0))} tokens`}
                </span>
              )}
            </h2>
            <button onClick={() => { setAgentForm(f => ({ ...f, teamId: selectedTeamId || '' })); setShowCreateAgent(true); }}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">+ Add Agent</button>
          </div>

          <div className="rounded-xl overflow-x-auto" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
            <table className="w-full min-w-[1400px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: '220px' }} />
                <col style={{ width: '190px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '72px' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a35' }}>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Role</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Model</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Team</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Tokens</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Cost / Rate</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider w-16 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((a, idx) => {
                  const usage = usageData?.[a.id] ?? {
                    totalTokens: 0,
                    cost: 0,
                    tokens24h: 0,
                    tokens7d: 0,
                    tokensAllTime: 0,
                    inputTokens: 0,
                    outputTokens: 0,
                    activityEventCount: 0,
                    hasActivity: false,
                  };
                  const isExpanded = expandedAgentId === a.id;
                  const isLead = teamLead && a.id === teamLead.id;
                  const showDivider = isLead && filteredAgents.length > 1;
                  const recommendations = getRecommendedModelsForAgent(a, liveModelOptions).slice(0, 4);
                  const currentDraftModel = draftModels[a.id] ?? a.model ?? '';
                  const modelOptions = (() => {
                    const seen = new Set<string>();
                    const options: Array<{ name: string; provider: string }> = [];

                    if (a.model && !seen.has(a.model)) {
                      seen.add(a.model);
                      options.push({ name: a.model, provider: 'Current' });
                    }

                    for (const recommendation of getRecommendedModelsForAgent(a, liveModelOptions)) {
                      if (seen.has(recommendation.model.name)) continue;
                      seen.add(recommendation.model.name);
                      options.push({ name: recommendation.model.name, provider: recommendation.model.provider });
                    }

                    return options;
                  })();
                  return (
                    <React.Fragment key={a.id}>
                    <tr className="group hover:bg-white/[0.03] transition-colors cursor-pointer" style={{ borderBottom: isExpanded ? 'none' : showDivider ? '2px solid #555' : '1px solid #2a2a35', background: isLead ? '#1a1a28' : undefined }}
                      onClick={() => setExpandedAgentId(isExpanded ? null : a.id)}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span style={{ color: '#c4a04a', fontSize: 11 }}>{isExpanded ? '▾' : '▸'}</span>
                          <Avatar agentId={a.agentId} size={28} />
                          <span className="font-medium text-white">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <div className="truncate">{a.role}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><ModelBadge model={a.model} /></td>
                      <td className="px-4 py-3 text-gray-400">
                        <div className="truncate">{a.teamId ? (teamNameMap[a.teamId] || '—') : '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          a.status === 'disabled' ? 'bg-gray-600' :
                          a.status === 'online' || a.status === 'busy' || a.status === 'idle' ? 'bg-green-400' : 'bg-gray-500'
                        }`} title={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                        {usage.activityEventCount ? formatTokens(usage.totalTokens) : 'No activity'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                        {usage.activityEventCount ? `$${usage.cost.toFixed(4)}` : formatModelRate(usage)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => { e.stopPropagation(); a.status === 'disabled' ? enableAgent.mutate(a.id) : disableAgent.mutate(a.id); }}
                            className="text-gray-500 hover:text-yellow-400 text-xs" title="Toggle">
                            {a.status === 'disabled' ? '▶' : '⏸'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteAgent(a.id); }}
                            className="text-gray-500 hover:text-red-400 text-xs" title="Delete">🗑</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid #2a2a35' }}>
                        <td colSpan={8} className="px-4 pb-4 pt-1" style={{ background: '#1a1a20' }}>
                          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                            <div>
                              <div className="flex gap-3 mb-2">
                                <div className="rounded-lg px-4 py-3" style={{ background: '#1e1e24', border: '1px solid #2a2a35', minWidth: 120 }}>
                                  <div className="text-[12px] font-medium" style={{ color: '#777' }}>24h</div>
                                  <div className="text-[18px] font-bold text-white mt-0.5">{usage.activityEventCount ? (usage.tokens24h || 0).toLocaleString() : '—'}</div>
                                </div>
                                <div className="rounded-lg px-4 py-3" style={{ background: '#1e1e24', border: '1px solid #2a2a35', minWidth: 120 }}>
                                  <div className="text-[12px] font-medium" style={{ color: '#777' }}>7d</div>
                                  <div className="text-[18px] font-bold text-white mt-0.5">{usage.activityEventCount ? (usage.tokens7d || 0).toLocaleString() : '—'}</div>
                                </div>
                                <div className="rounded-lg px-4 py-3" style={{ background: '#1e1e24', border: '1px solid #2a2a35', minWidth: 120 }}>
                                  <div className="text-[12px] font-medium" style={{ color: '#777' }}>All-Time</div>
                                  <div className="text-[18px] font-bold text-white mt-0.5">{usage.activityEventCount ? formatTokens(usage.tokensAllTime || 0) : '—'}</div>
                                </div>
                              </div>
                              <div className="text-[12px]" style={{ color: '#666' }}>
                                Input / Output: {usage.activityEventCount ? `${(usage.inputTokens || 0).toLocaleString()} / ${(usage.outputTokens || 0).toLocaleString()}` : 'No activity yet'}
                              </div>
                              <div className="text-[12px] mt-1" style={{ color: '#666' }}>
                                Source: local task, story, bug, and delegation activity{typeof usage.activityEventCount === 'number' ? ` · ${usage.activityEventCount} events` : ''}
                              </div>
                              <div className="mt-3 rounded-lg px-4 py-3" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
                                <div className="text-[12px] font-medium" style={{ color: '#777' }}>Model Pricing Profile</div>
                                <div className="text-[16px] font-bold text-white mt-1">{formatModelRate(usage)}</div>
                                <div className="text-[12px] mt-1" style={{ color: '#666' }}>
                                  Input / output rate per 1M tokens for the currently assigned model.
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl p-4" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div className="text-sm font-semibold text-white">Model Assignment</div>
                                  <div className="mt-1 text-xs" style={{ color: '#8b93a7' }}>
                                    Personality profile: {describeAgentPersonality(a)}
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: '#666' }}>
                                    Updating this model changes the shared agent record used by Fleet, Org Chart, and task trace views.
                                  </div>
                                  <div className="mt-1 text-xs" style={{ color: '#666' }}>
                                    Source: active Bedrock text-capable model families from `us-east-1`.
                                  </div>
                                </div>
                                <div className="text-xs" style={{ color: '#94a3b8' }}>
                                  Current: {a.model || 'Unassigned'}
                                </div>
                              </div>

                              <div className="mt-4">
                                <div className="text-xs font-medium mb-2" style={{ color: '#8b93a7' }}>Suggested models for this personality</div>
                                <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
                                  {recommendations.map(recommendation => (
                                    <button
                                      key={`${a.id}-${recommendation.model.provider}-${recommendation.model.name}`}
                                      type="button"
                                      onClick={() => updateDraftModel(a.id, recommendation.model.name)}
                                      className="rounded-lg p-3 text-left transition-colors hover:bg-white/[0.04]"
                                      style={{
                                        background: currentDraftModel === recommendation.model.name ? '#20263a' : '#17171d',
                                        border: `1px solid ${currentDraftModel === recommendation.model.name ? '#3b82f6' : '#2a2a35'}`,
                                      }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-white truncate">{recommendation.model.name}</div>
                                          <div className="text-[11px]" style={{ color: '#8b93a7' }}>{recommendation.model.provider}</div>
                                        </div>
                                        <div className="text-xs font-semibold" style={{ color: '#93c5fd' }}>{recommendation.score}/100</div>
                                      </div>
                                      <div className="mt-2 text-[11px] leading-5" style={{ color: '#9ca3af' }}>
                                        {recommendation.reasons.length > 0 ? recommendation.reasons.join(' · ') : 'Balanced fit for this profile'}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                                {recommendations.length === 0 && (
                                  <div className="rounded-lg border px-3 py-3 text-xs" style={{ borderColor: '#2a2a35', color: '#8b93a7', background: '#17171d' }}>
                                    {checkingActiveModels
                                      ? 'Checking live Bedrock active models...'
                                      : 'No active text-capable Bedrock model families were returned for recommendation.'}
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 flex gap-2 flex-wrap">
                                <select
                                  value={currentDraftModel}
                                  onChange={e => updateDraftModel(a.id, e.target.value)}
                                  className="min-w-[320px] flex-1 rounded-lg px-3 py-2 text-sm"
                                  style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}
                                >
                                  <option value="">Unassigned</option>
                                  {modelOptions.map(option => (
                                    <option key={`${a.id}-${option.provider}-${option.name}`} value={option.name}>
                                      {option.name} ({option.provider})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => assignAgentModel(a)}
                                  disabled={savingAgentId === a.id || currentDraftModel === (a.model ?? '')}
                                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                  {savingAgentId === a.id ? 'Saving…' : 'Assign Model'}
                                </button>
                              </div>

                              {modelStatus[a.id] && (
                                <div className="mt-2 text-xs" style={{ color: modelStatus[a.id]?.startsWith('Assigned') || modelStatus[a.id]?.startsWith('Cleared') || modelStatus[a.id] === 'Model is already assigned.' ? '#93c5fd' : '#fca5a5' }}>
                                  {modelStatus[a.id]}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
                {filteredAgents.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600 italic">No agents{selectedTeamId ? ' in this team' : ''}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmDialog open={!!confirmDeleteAgent} onClose={() => setConfirmDeleteAgent(null)}
        onConfirm={() => confirmDeleteAgent && deleteAgent.mutate(confirmDeleteAgent)} message="Delete this agent?" />
      <ConfirmDialog open={!!confirmDeleteTeam} onClose={() => setConfirmDeleteTeam(null)}
        onConfirm={() => confirmDeleteTeam && deleteTeam.mutate(confirmDeleteTeam)} message="Delete this team and unassign its agents?" />

      {/* Create Team Modal */}
      <Modal open={showCreateTeam} onClose={resetTeamForm} title="Create Team">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-400">Name</label>
            <input value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white mt-1" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }} placeholder="Team name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Description</label>
            <input value={teamForm.description} onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white mt-1" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }} placeholder="Optional description" />
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!teamForm.name}
              onClick={() => { createTeam.mutate({ name: teamForm.name, description: teamForm.description || undefined }); resetTeamForm(); }}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Create</button>
          </div>
        </div>
      </Modal>

      {/* Create Agent Modal */}
      <Modal open={showCreateAgent} onClose={resetAgentForm} title="Add Agent">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-400">Specialization</label>
            <select value={agentForm.specialization} onChange={e => setAgentForm(f => ({ ...f, specialization: e.target.value, name: '' }))}
              className="w-full rounded-lg px-3 py-2 text-sm mt-1" style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}>
              <option value="">Select…</option>
              {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Name</label>
            {suggestions?.names && suggestions.names.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1 mb-1">
                {suggestions.names.map(n => (
                  <button key={n} onClick={() => setAgentForm(f => ({ ...f, name: n }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${agentForm.name === n ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'border-gray-600 text-gray-400 hover:bg-gray-700/30'}`}>{n}</button>
                ))}
              </div>
            )}
            <input value={agentForm.name} onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }} placeholder="Agent name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Role</label>
            <input value={agentForm.role} onChange={e => setAgentForm(f => ({ ...f, role: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }} placeholder="e.g. Backend Engineer" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Model</label>
            <select value={agentForm.model} onChange={e => setAgentForm(f => ({ ...f, model: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm mt-1" style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}>
              <option value="">Auto (based on specialization)</option>
              {liveModelOptions.map(model => (
                <option key={`${model.provider}-${model.name}`} value={model.name}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
            <div className="mt-1 text-[11px]" style={{ color: '#777' }}>
              {checkingActiveModels
                ? 'Checking active Bedrock model families from us-east-1.'
                : liveModelOptions.length > 0
                  ? 'Active Bedrock text-capable model families from us-east-1.'
                  : 'Active Bedrock model list is unavailable; leave this on Auto to avoid stale hardcoded values.'}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Team</label>
            <select value={agentForm.teamId} onChange={e => setAgentForm(f => ({ ...f, teamId: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm mt-1" style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}>
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!agentForm.name || !agentForm.role}
              onClick={() => {
                createAgent.mutate({
                  agentId: agentForm.name.toLowerCase().replace(/\s+/g, '-'),
                  name: agentForm.name,
                  role: agentForm.role,
                  model: agentForm.model || undefined,
                  teamId: agentForm.teamId || undefined,
                  specialization: agentForm.specialization || undefined,
                } as any);
                resetAgentForm();
              }}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Create</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Task Traces View ───
function DelegationChain({ taskId, agents }: { taskId: string; agents: Agent[] }) {
  const { data: steps = [] } = useDelegationSteps(taskId);

  const agentMap = useMemo(() => {
    const m: Record<string, Agent> = {};
    agents.forEach(a => { m[a.id] = a; m[a.agentId] = a; });
    return m;
  }, [agents]);

  if (steps.length === 0) return <span className="text-xs text-gray-600 italic">No delegation</span>;

  // Build chain: fromAgent → toAgent for each step
  const chain: { agentId: string; name: string; action?: string }[] = [];
  steps.forEach((s, i) => {
    if (i === 0) {
      const from = agentMap[s.fromAgentId];
      chain.push({ agentId: s.fromAgentId, name: from?.name || s.fromAgentId });
    }
    const to = agentMap[s.toAgentId];
    chain.push({ agentId: s.toAgentId, name: to?.name || s.toAgentId, action: s.action });
  });

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {chain.map((c, i) => (
        <React.Fragment key={`${c.agentId}-${i}`}>
          {i > 0 && <span className="text-gray-600">→</span>}
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 flex items-center gap-1" title={c.action || ''}>
            <span>{agentAvatars[c.agentId] || '🤖'}</span>
            <span>{c.name}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function StoryDelegationChain({ history, agents }: { history: { fromStatus: string; toStatus: string; changedBy?: string }[]; agents: Agent[] }) {
  const agentMap = useMemo(() => {
    const m: Record<string, Agent> = {};
    agents.forEach(a => { m[a.id] = a; m[a.agentId] = a; });
    return m;
  }, [agents]);

  if (history.length === 0) return <span className="text-xs text-gray-600 italic">No history</span>;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {history.map((h, i) => {
        const agent = h.changedBy ? (agentMap[h.changedBy] || null) : null;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-gray-600">→</span>}
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300" title={`${h.fromStatus} → ${h.toStatus}`}>
              {agent ? `${agentAvatars[agent.agentId] || '🤖'} ${agent.name}` : (h.changedBy || 'system')}
              <span className="text-gray-500 ml-1">({h.toStatus})</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TaskTracesView({ tasks, agents }: { tasks: Task[]; agents: Agent[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [storyHistories, setStoryHistories] = useState<Record<string, { fromStatus: string; toStatus: string; changedBy?: string }[]>>({});
  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-900/30 text-red-400', high: 'bg-orange-900/30 text-orange-400',
    medium: 'bg-yellow-900/30 text-yellow-400', low: 'bg-green-900/30 text-green-400',
  };
  const statusColors: Record<string, string> = {
    completed: 'text-green-400', done: 'text-green-400', in_progress: 'text-blue-400', pending: 'text-gray-500',
    failed: 'text-red-400', delegated: 'text-purple-400', backlog: 'text-gray-500',
    code_review: 'text-yellow-400', qa_testing: 'text-cyan-400', bug_fix: 'text-red-400',
    ready_to_deploy: 'text-emerald-400', deploying: 'text-blue-400', post_deploy_qa: 'text-teal-400',
    created: 'text-gray-400',
  };

  // Fetch stories and merge as traces
  const [stories, setStories] = useState<any[]>([]);
  React.useEffect(() => {
    fetch('/api/stories').then(r => r.json()).then(d => setStories(d.data || [])).catch(() => {});
  }, []);

  // Fetch story history on expand
  const loadStoryHistory = (storyId: string) => {
    if (storyHistories[storyId]) return;
    fetch(`/api/stories/${storyId}/history`).then(r => r.json()).then(d => {
      setStoryHistories(prev => ({ ...prev, [storyId]: d.data || [] }));
    }).catch(() => {});
  };

  // Merge tasks and stories into unified list
  const allTraces = useMemo(() => {
    const taskTraces = tasks.map(t => ({ ...t, source: 'task' as const }));
    const storyTraces = stories.map((s: any) => ({
      id: s.id,
      taskCode: `STORY-${s.id.slice(0, 6)}`,
      title: s.title,
      description: s.description,
      status: s.status,
      priority: s.priority,
      source: 'story' as const,
      createdAt: s.createdAt,
      assignedToName: s.assignedToName,
    }));
    return [...taskTraces, ...storyTraces].sort((a, b) => {
      const aTime = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
      const bTime = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [tasks, stories]);

  if (allTraces.length === 0) return <p className="text-gray-500">No tasks yet.</p>;
  return (
    <div className="space-y-2">
      {allTraces.map(t => (
        <div key={t.id} className="rounded-lg p-4" style={{ background: '#1e1e24', border: `1px solid ${t.source === 'story' ? '#2a3a2a' : '#2a2a35'}` }}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => { toggle(t.id); if (t.source === 'story') loadStoryHistory(t.id); }}>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.source === 'story' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                {t.source === 'story' ? 'STORY' : 'TASK'}
              </span>
              <span className="font-mono text-sm text-gray-500">{t.taskCode}</span>
              <span className="font-medium text-white">{t.title}</span>
              <span className={`text-sm font-medium ${statusColors[t.status] ?? ''}`}>{t.status.replace(/_/g, ' ')}</span>
              {t.source === 'story' && (t as any).assignedToName && (
                <span className="text-xs text-gray-500">→ {(t as any).assignedToName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority] ?? ''}`}>{t.priority}</span>
              <span className="text-gray-500 text-sm">{expanded.has(t.id) ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded.has(t.id) && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              {t.description && <p className="text-sm text-gray-400 mb-2">{t.description}</p>}
              <p className="text-xs text-gray-500 mb-1 font-medium">
                {t.source === 'task' ? 'Delegation Chain:' : 'Status History:'}
              </p>
              {t.source === 'task' ? (
                <DelegationChain taskId={t.id} agents={agents} />
              ) : (
                <StoryDelegationChain history={storyHistories[t.id] || []} agents={agents} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main App ───
const tabs: { key: View; label: string; icon: string }[] = [
  { key: 'orgchart', label: 'Org Chart', icon: '🏗' },
  { key: 'fleet', label: 'Fleet', icon: '🚀' },
  { key: 'traces', label: 'Task Traces', icon: '📋' },
  { key: 'board', label: 'Jira Board', icon: '🗂' },
  { key: 'models', label: 'Model Advisor', icon: '🧠' },
  { key: 'rankings', label: 'Model Rankings', icon: '📊' },
];

export default function App() {
  const [view, setView] = useState<View>('orgchart');
  const { data: agents = [], isLoading: loadingAgents } = useAgents();
  const { data: teams = [], isLoading: loadingTeams } = useTeams();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  return (
    <div className="min-h-screen" style={{ background: '#111117', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <header
        className="sticky top-0 z-40 px-6 py-4"
        style={{ background: 'rgba(17, 17, 23, 0.96)', borderBottom: '1px solid #2a2a35', backdropFilter: 'blur(12px)' }}
      >
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold text-white">Atlas Fleet Console</h1>
          </div>
          <nav className="flex gap-1 rounded-lg p-1" style={{ background: '#1e1e24' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setView(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === t.key ? 'text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                style={view === t.key ? { background: '#2a2a35' } : {}}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1920px] px-5 py-6">
        {(loadingAgents || loadingTeams || loadingTasks) && view !== 'orgchart' && view !== 'models' && view !== 'rankings' ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <>
            {view === 'orgchart' && <OrgChartView agents={agents} teams={teams} />}
            {view === 'fleet' && <FleetView teams={teams} agents={agents} />}
            {view === 'traces' && <TaskTracesView tasks={tasks} agents={agents} />}
            {view === 'board' && <KanbanBoardView />}
            {view === 'models' && <BedrockModelAdvisorView />}
            {view === 'rankings' && <ModelRankingsView />}
          </>
        )}
      </main>
    </div>
  );
}
