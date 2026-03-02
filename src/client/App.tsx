import React, { useState, useMemo } from 'react';
import { useAgents, useCreateAgent, useDeleteAgent, useRemoveAgentFromTeam, useDisableAgent, useEnableAgent, useNameSuggestions } from './queries/agents';
import { useTeams, useCreateTeam, useDeleteTeam, useAddAgentToTeam, useDisableTeam, useEnableTeam } from './queries/teams';
import { useTasks } from './queries/tasks';
import { useDelegationSteps } from './queries/delegation';
import { StatusDot } from './components/shared/StatusDot';
import { KanbanBoardView } from './components/board/KanbanBoard';
import type { Agent, Team, Task, DelegationStep } from './types';

type View = 'orgchart' | 'teams' | 'agents' | 'traces' | 'board';

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
};

// ─── Model Badge Mapping ───
function getModelBadge(model?: string): { label: string; color: string; bg: string; border: string } | null {
  if (!model) return null;
  if (model.includes('opus')) return { label: 'Opus 4.6', color: '#e8a030', bg: '#3a2a1a', border: '#5a4a2a' };
  if (model === 'claude-sonnet-4.6') return { label: 'Sonnet 4.6', color: '#60a5fa', bg: '#1a2a3a', border: '#2a3a5a' };
  if (model.includes('sonnet')) return { label: 'Sonnet 4.5', color: '#60a5fa', bg: '#1a2a3a', border: '#2a3a5a' };
  if (model.includes('kimi')) return { label: 'Kimi K2.5', color: '#14b8a6', bg: '#1a3a2a', border: '#2a5a3a' };
  if (model.includes('deepseek')) return { label: 'DeepSeek V3', color: '#a78bfa', bg: '#2a1a3a', border: '#3a2a5a' };
  return { label: model, color: '#999', bg: '#2a2a2a', border: '#3a3a3a' };
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

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: '#1a3a1a', color: '#4ade80', border: '1px solid #2a5a2a' }}>
      <span className="w-3 h-3 rounded-sm flex items-center justify-center text-[9px]" style={{ background: '#4ade80', color: '#111' }}>✓</span>
      Active
    </span>
  );
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

// ─── Org Chart View (Reference Match) ───
function OrgChartView({ agents }: { agents: Agent[]; teams: Team[] }) {
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

  if (!ceo || !coo) return <p className="text-gray-500">Loading agents...</p>;

  return (
    <div className="w-full min-h-[calc(100vh-80px)] relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, #1a5a4a 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8">
        {/* CEO Card */}
        <div className="flex flex-col items-center mb-0">
          <div className="rounded-2xl px-6 py-5 flex items-center gap-4 min-w-[340px]"
            style={{ background: 'linear-gradient(135deg, #2a2418 0%, #1e2a1e 100%)', border: '1px solid #8B7332' }}>
            <Avatar agentId="ceo" size={60} />
            <div>
              <div className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#c4a04a' }}>CEO</div>
              <div className="text-[24px] font-bold text-white leading-tight">{ceo.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <ModelBadge model={ceo.model} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div style={{ width: 2, height: 30, background: '#4a5a3a' }} />
          </div>
        </div>

        {/* COO Card */}
        <div className="flex flex-col items-center mb-0">
          <div className="rounded-2xl px-6 py-5 flex items-center gap-4 min-w-[340px]"
            style={{ background: 'linear-gradient(135deg, #1e2a1e 0%, #2a2418 100%)', border: '1px solid #3a4a2a' }}>
            <Avatar agentId="coo" size={60} />
            <div>
              <div className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#c4a04a' }}>COO</div>
              <div className="text-[24px] font-bold text-white leading-tight">{coo.name}</div>
              <div className="text-[13px] mt-0.5" style={{ color: '#8a9a7a' }}>
                Research · Delegation · Execution · Orchestration
              </div>
              <div className="mt-1"><ModelBadge model={coo.model} /></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div style={{ width: 2, height: 30, background: '#4a5a3a' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c4a04a', marginTop: -1 }} />
          </div>
        </div>

        {/* CTO / CPO Executive Row */}
        <div className="grid grid-cols-2 gap-5 mt-4 mb-8">
          {cto && <ExecCard agent={cto} />}
          {cpo && <ExecCard agent={cpo} />}
        </div>

        {/* Scrum Master — Jira */}
        {jira && (
          <div className="flex flex-col items-start mb-6" style={{ width: '50%' }}>
            <div className="flex flex-col items-center w-full">
              <div style={{ width: 2, height: 24, background: '#4a5a3a' }} />
            </div>
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
            <div className="flex flex-col items-center w-full">
              <div style={{ width: 2, height: 24, background: '#4a5a3a' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#60a5fa', marginTop: -1 }} />
            </div>
          </div>
        )}

        {/* Department Grid — 2 columns: CTO teams | CPO teams */}
        <div className="grid grid-cols-2 gap-5">
          {/* CTO Column */}
          <div>
            <TeamSection name="Backend & Security" description="APIs, business logic, data pipelines, vulnerability scanning, and code audits"
              agents={[linus, ada].filter(Boolean)} />
            <TeamSection name="Frontend & DevOps" description="UI/UX implementation, design systems, CI/CD, deployments, and infrastructure"
              agents={[pixel, terraform].filter(Boolean)} />
            <TeamSection name="QA Team" description="Test strategy, test automation, code quality reviews, and coverage enforcement"
              agents={[sentinel].filter(Boolean)} />
            {/* Direct CTO reports not in a team section */}
            {[turing, piper, vector].filter(Boolean).length > 0 && (
              <TeamSection name="AI & Data" description="AI/ML architecture, data pipelines, and retrieval systems"
                agents={[turing, piper, vector].filter(Boolean)} />
            )}
          </div>

          {/* CPO Column */}
          <div>
            <TeamSection name="Product Owner Team" description="Product intelligence, go-to-market strategy, and launch campaigns"
              agents={[nova].filter(Boolean)} />
          </div>
        </div>
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

// ─── Teams View ───
function TeamsView({ teams, agents }: { teams: Team[]; agents: Agent[] }) {
  const deleteTeam = useDeleteTeam();
  const addAgentToTeam = useAddAgentToTeam();
  const removeAgent = useRemoveAgentFromTeam();
  const disableTeam = useDisableTeam();
  const enableTeam = useEnableTeam();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [addToTeamId, setAddToTeamId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const unassignedAgents = agents.filter(a => !a.teamId);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(t => (
          <div key={t.id} className="rounded-lg p-4" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg text-white">{t.name}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => t.status === 'active' ? disableTeam.mutate(t.id) : enableTeam.mutate(t.id)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${t.status === 'active' ? 'text-green-400 border-green-700 hover:bg-green-900/30' : 'text-gray-500 border-gray-600 hover:bg-gray-700/30'}`}>
                  {t.status === 'active' ? 'Active' : 'Disabled'}
                </button>
                <button onClick={() => setAddToTeamId(t.id)} className="text-gray-500 hover:text-blue-400 text-lg" title="Add agent">＋</button>
                <button onClick={() => setConfirmDelete(t.id)} className="text-gray-500 hover:text-red-400" title="Delete team">🗑</button>
              </div>
            </div>
            {t.description && <p className="text-sm text-gray-500 mb-2">{t.description}</p>}
            <div className="space-y-1">
              {agents.filter(a => a.teamId === t.id).map(a => (
                <div key={a.id} className="group flex items-center justify-between py-1 px-2 rounded hover:bg-white/5">
                  <div className="flex items-center gap-2">
                    <StatusDot status={a.status} />
                    <span className="text-sm text-white">{a.name}</span>
                  </div>
                  <button onClick={() => removeAgent.mutate(a.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs" title="Remove">✕</button>
                </div>
              ))}
              {agents.filter(a => a.teamId === t.id).length === 0 && <p className="text-xs text-gray-600 italic">No agents</p>}
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteTeam.mutate(confirmDelete)} message="Delete this team?" />
      <Modal open={!!addToTeamId} onClose={() => { setAddToTeamId(null); setSelectedAgentId(''); }} title="Add Agent to Team">
        <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4" style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}>
          <option value="">Select an agent…</option>
          {unassignedAgents.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
        </select>
        <div className="flex justify-end">
          <button disabled={!selectedAgentId}
            onClick={() => { if (addToTeamId && selectedAgentId) { addAgentToTeam.mutate({ teamId: addToTeamId, agentId: selectedAgentId }); setAddToTeamId(null); setSelectedAgentId(''); }}}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Add</button>
        </div>
      </Modal>
    </>
  );
}

// ─── Agents View ───
function AgentsView({ agents, teams }: { agents: Agent[]; teams: Team[] }) {
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();
  const disableAgent = useDisableAgent();
  const enableAgent = useEnableAgent();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', role: '', teamId: '', specialization: '' });
  const { data: suggestions } = useNameSuggestions(form.specialization || null);
  const resetForm = () => { setForm({ name: '', role: '', teamId: '', specialization: '' }); setShowCreate(false); };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Agents <span className="text-gray-500 font-normal">({agents.length})</span></h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">+ Add Agent</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(a => (
          <div key={a.id} className="group rounded-lg p-4 hover:border-gray-500 transition-colors relative"
            style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }}>
            <button onClick={() => setConfirmDelete(a.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400" title="Delete">🗑</button>
            <div className="flex items-center gap-3 mb-2">
              <Avatar agentId={a.agentId} size={36} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">{a.name}</h3>
                  <StatusDot status={a.status} />
                </div>
                <p className="text-sm text-gray-500">{a.role}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <ModelBadge model={a.model} />
              <button onClick={() => a.status === 'disabled' ? enableAgent.mutate(a.id) : disableAgent.mutate(a.id)}
                className={`text-xs px-2 py-0.5 rounded-full border ${a.status === 'disabled' ? 'text-gray-500 border-gray-600' : 'text-green-400 border-green-700'}`}>
                {a.status === 'disabled' ? 'Disabled' : 'Enabled'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteAgent.mutate(confirmDelete)} message="Delete this agent?" />
      <Modal open={showCreate} onClose={resetForm} title="Add Agent">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-400">Specialization</label>
            <select value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value, name: '' }))}
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
                  <button key={n} onClick={() => setForm(f => ({ ...f, name: n }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${form.name === n ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'border-gray-600 text-gray-400 hover:bg-gray-700/30'}`}>{n}</button>
                ))}
              </div>
            )}
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }} placeholder="Agent name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Role</label>
            <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm text-white" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }} placeholder="e.g. Backend Engineer" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">Team</label>
            <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm mt-1" style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}>
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!form.name || !form.role}
              onClick={() => { createAgent.mutate({ agentId: form.name.toLowerCase().replace(/\s+/g, '-'), name: form.name, role: form.role, teamId: form.teamId || undefined, specialization: form.specialization || undefined } as any); resetForm(); }}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Create</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Task Traces View ───
function DelegationChain({ taskId }: { taskId: string }) {
  const { data: steps = [] } = useDelegationSteps(taskId);
  if (steps.length === 0) return <span className="text-xs text-gray-600 italic">No delegation</span>;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && <span className="text-gray-600">→</span>}
          <span className={`text-xs px-1.5 py-0.5 rounded ${s.status === 'completed' ? 'bg-green-900/30 text-green-400' : s.status === 'failed' ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
            {s.action}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function TaskTracesView({ tasks }: { tasks: Task[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-900/30 text-red-400', high: 'bg-orange-900/30 text-orange-400',
    medium: 'bg-yellow-900/30 text-yellow-400', low: 'bg-green-900/30 text-green-400',
  };
  const statusColors: Record<string, string> = {
    completed: 'text-green-400', in_progress: 'text-blue-400', pending: 'text-gray-500',
    failed: 'text-red-400', delegated: 'text-purple-400',
  };
  if (tasks.length === 0) return <p className="text-gray-500">No tasks yet.</p>;
  return (
    <div className="space-y-2">
      {tasks.map(t => (
        <div key={t.id} className="rounded-lg p-4" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => toggle(t.id)}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-500">{t.taskCode}</span>
              <span className="font-medium text-white">{t.title}</span>
              <span className={`text-sm font-medium ${statusColors[t.status] ?? ''}`}>{t.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority] ?? ''}`}>{t.priority}</span>
              <span className="text-gray-500 text-sm">{expanded.has(t.id) ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded.has(t.id) && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              {t.description && <p className="text-sm text-gray-400 mb-2">{t.description}</p>}
              <p className="text-xs text-gray-500 mb-1 font-medium">Delegation Chain:</p>
              <DelegationChain taskId={t.id} />
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
  { key: 'teams', label: 'Teams', icon: '👥' },
  { key: 'agents', label: 'Agents', icon: '🤖' },
  { key: 'traces', label: 'Task Traces', icon: '📋' },
  { key: 'board', label: 'Jira Board', icon: '🗂' },
];

export default function App() {
  const [view, setView] = useState<View>('orgchart');
  const { data: agents = [], isLoading: loadingAgents } = useAgents();
  const { data: teams = [], isLoading: loadingTeams } = useTeams();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  return (
    <div className="min-h-screen" style={{ background: '#111117', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <header className="px-6 py-4" style={{ background: '#111117', borderBottom: '1px solid #2a2a35' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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

      <main className="max-w-7xl mx-auto px-6 py-6">
        {(loadingAgents || loadingTeams || loadingTasks) && view !== 'orgchart' ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <>
            {view === 'orgchart' && <OrgChartView agents={agents} teams={teams} />}
            {view === 'teams' && <TeamsView teams={teams} agents={agents} />}
            {view === 'agents' && <AgentsView agents={agents} teams={teams} />}
            {view === 'traces' && <TaskTracesView tasks={tasks} />}
            {view === 'board' && <KanbanBoardView />}
          </>
        )}
      </main>
    </div>
  );
}
