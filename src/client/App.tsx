import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';

import { useAgents, useCreateAgent, useDeleteAgent, useRemoveAgentFromTeam, useDisableAgent, useEnableAgent, useNameSuggestions } from './queries/agents';
import { useTeams, useCreateTeam, useDeleteTeam, useAddAgentToTeam, useDisableTeam, useEnableTeam } from './queries/teams';
import { useTasks } from './queries/tasks';
import { useDelegationSteps } from './queries/delegation';
import { StatusDot } from './components/shared/StatusDot';
import type { Agent, Team, Task, DelegationStep } from './types';

type View = 'orgchart' | 'teams' | 'agents' | 'traces';

const SPECIALIZATIONS = [
  'Enterprise Architecture', 'Platform Architecture', 'Data Architecture', 'Technology Architecture',
  'Backend', 'Frontend', 'Security', 'DevOps', 'QA', 'AI/ML', 'Data Engineering', 'Retrieval', 'Product Management',
];

const specColors: Record<string, string> = {
  Backend: 'bg-blue-100 text-blue-700',
  Frontend: 'bg-purple-100 text-purple-700',
  Security: 'bg-red-100 text-red-700',
  DevOps: 'bg-orange-100 text-orange-700',
  QA: 'bg-green-100 text-green-700',
  'AI/ML': 'bg-cyan-100 text-cyan-700',
  'Data Engineering': 'bg-yellow-100 text-yellow-700',
  Retrieval: 'bg-teal-100 text-teal-700',
  'Product Management': 'bg-pink-100 text-pink-700',
  'Enterprise Architecture': 'bg-indigo-100 text-indigo-700',
  'Platform Architecture': 'bg-violet-100 text-violet-700',
  'Data Architecture': 'bg-amber-100 text-amber-700',
  'Technology Architecture': 'bg-sky-100 text-sky-700',
};

// ─── Modal Shell ───
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, onClose, onConfirm, message }: { open: boolean; onClose: () => void; onConfirm: () => void; message: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm">
      <p className="text-gray-600 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
      </div>
    </Modal>
  );
}

// ─── Org Chart ───
function OrgChartView({ agents }: { agents: Agent[] }) {
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

    const nodeWidth = 200, nodeHeight = 60;
    agents.forEach(a => g.setNode(a.id, { width: nodeWidth, height: nodeHeight }));
    agents.forEach(a => {
      if (a.parentAgentId) g.setEdge(a.parentAgentId, a.id);
    });
    dagre.layout(g);

    const flowNodes: Node[] = agents.map(a => {
      const pos = g.node(a.id);
      return {
        id: a.id,
        position: { x: (pos?.x ?? 0) - nodeWidth / 2, y: (pos?.y ?? 0) - nodeHeight / 2 },
        data: { label: (
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-center min-w-[180px]">
            <div className="flex items-center justify-center gap-1.5">
              <StatusDot status={a.status} />
              <span className="font-semibold text-sm">{a.name}</span>
            </div>
            <p className="text-xs text-gray-500">{a.role}</p>
            {a.specialization && <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded-full ${specColors[a.specialization] ?? 'bg-gray-100 text-gray-600'}`}>{a.specialization}</span>}
          </div>
        )},
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        type: 'default',
      };
    });

    const flowEdges: Edge[] = agents.filter(a => a.parentAgentId).map(a => ({
      id: `${a.parentAgentId}-${a.id}`,
      source: a.parentAgentId!,
      target: a.id,
      type: 'smoothstep',
      style: { stroke: '#94a3b8' },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [agents]);

  if (agents.length === 0) return <p className="text-gray-400">No agents registered yet.</p>;

  return (
    <div className="w-full h-[calc(100vh-140px)] bg-white rounded-lg border border-gray-200">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
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
          <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">{t.name}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => t.status === 'active' ? disableTeam.mutate(t.id) : enableTeam.mutate(t.id)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${t.status === 'active' ? 'text-green-600 border-green-300 hover:bg-green-50' : 'text-gray-400 border-gray-300 hover:bg-gray-50'}`}>
                  {t.status === 'active' ? 'Active' : 'Disabled'}
                </button>
                <button onClick={() => setAddToTeamId(t.id)} className="text-gray-400 hover:text-blue-600 text-lg" title="Add agent">＋</button>
                <button onClick={() => setConfirmDelete(t.id)} className="text-gray-400 hover:text-red-600" title="Delete team">🗑</button>
              </div>
            </div>
            {t.description && <p className="text-sm text-gray-500 mb-2">{t.description}</p>}
            <div className="space-y-1">
              {(t.agents ?? []).map(a => (
                <div key={a.id} className="group flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <StatusDot status={a.status} />
                    <span className="text-sm">{a.name}</span>
                    {a.specialization && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${specColors[a.specialization] ?? 'bg-gray-100 text-gray-600'}`}>{a.specialization}</span>}
                  </div>
                  <button onClick={() => removeAgent.mutate(a.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs" title="Remove from team">✕</button>
                </div>
              ))}
              {(t.agents ?? []).length === 0 && <p className="text-xs text-gray-400 italic">No agents</p>}
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-gray-400">No teams yet.</p>}
      </div>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteTeam.mutate(confirmDelete)}
        message="Delete this team? All agents will be unassigned." />

      <Modal open={!!addToTeamId} onClose={() => { setAddToTeamId(null); setSelectedAgentId(''); }} title="Add Agent to Team">
        <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4">
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
        <h2 className="text-lg font-semibold">Agents <span className="text-gray-400 font-normal">({agents.length})</span></h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">+ Add Agent</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(a => (
          <div key={a.id} className="group bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
            <button onClick={() => setConfirmDelete(a.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500" title="Delete agent">🗑</button>
            <div className="flex items-center gap-2 mb-1">
              <StatusDot status={a.status} />
              <h3 className="font-semibold">{a.name}</h3>
            </div>
            <p className="text-sm text-gray-500">{a.role}</p>
            {a.specialization && <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${specColors[a.specialization] ?? 'bg-gray-100 text-gray-600'}`}>{a.specialization}</span>}
            {a.model && <p className="text-xs text-gray-400 mt-1">Model: {a.model}</p>}
            <div className="mt-2">
              <button onClick={() => a.status === 'disabled' ? enableAgent.mutate(a.id) : disableAgent.mutate(a.id)}
                className={`text-xs px-2 py-0.5 rounded-full border ${a.status === 'disabled' ? 'text-gray-400 border-gray-300 hover:bg-gray-50' : 'text-green-600 border-green-300 hover:bg-green-50'}`}>
                {a.status === 'disabled' ? 'Disabled' : 'Enabled'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteAgent.mutate(confirmDelete)}
        message="Delete this agent? Children will be re-parented." />

      <Modal open={showCreate} onClose={resetForm} title="Add Agent">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Specialization</label>
            <select value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value, name: '' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select…</option>
              {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Name</label>
            {suggestions?.names && suggestions.names.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1 mb-1">
                {suggestions.names.map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, name: n }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${form.name === n ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>{n}</button>
                ))}
              </div>
            )}
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Agent name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Backend Engineer" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Team</label>
            <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!form.name || !form.role}
              onClick={() => { createAgent.mutate({ name: form.name, role: form.role, teamId: form.teamId || undefined, specialization: form.specialization || undefined } as any); resetForm(); }}
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
  if (steps.length === 0) return <span className="text-xs text-gray-400 italic">No delegation</span>;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && <span className="text-gray-300">→</span>}
          <span className={`text-xs px-1.5 py-0.5 rounded ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
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
    critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700',
  };
  const statusColors: Record<string, string> = {
    completed: 'text-green-600', in_progress: 'text-blue-600', pending: 'text-gray-500',
    failed: 'text-red-600', delegated: 'text-purple-600',
  };

  if (tasks.length === 0) return <p className="text-gray-400">No tasks yet.</p>;

  return (
    <div className="space-y-2">
      {tasks.map(t => (
        <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => toggle(t.id)}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-500">{t.taskCode}</span>
              <span className="font-medium">{t.title}</span>
              <span className={`text-sm font-medium ${statusColors[t.status] ?? ''}`}>{t.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority] ?? ''}`}>{t.priority}</span>
              <span className="text-gray-400 text-sm">{expanded.has(t.id) ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded.has(t.id) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {t.description && <p className="text-sm text-gray-600 mb-2">{t.description}</p>}
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
];

export default function App() {
  const [view, setView] = useState<View>('orgchart');
  const { data: agents = [], isLoading: loadingAgents } = useAgents();
  const { data: teams = [], isLoading: loadingTeams } = useTeams();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold text-gray-900">Atlas Fleet Console</h1>
          </div>
          <nav className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setView(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {(loadingAgents || loadingTeams || loadingTasks) && view !== 'orgchart' ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <>
            {view === 'orgchart' && <OrgChartView agents={agents} />}
            {view === 'teams' && <TeamsView teams={teams} agents={agents} />}
            {view === 'agents' && <AgentsView agents={agents} teams={teams} />}
            {view === 'traces' && <TaskTracesView tasks={tasks} />}
          </>
        )}
      </main>
    </div>
  );
}
