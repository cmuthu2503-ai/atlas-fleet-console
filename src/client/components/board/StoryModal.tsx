import React, { useState } from 'react';
import type { UserStory, Bug, StoryHistoryEntry, StoryStatus, Agent } from '../../types';
import { useBugs, useCreateBug, useUpdateBug, useStoryHistory } from '../../queries/stories';

const STATUSES: StoryStatus[] = [
  'backlog', 'created', 'in_progress', 'code_review', 'qa_testing',
  'bug_fix', 'ready_to_deploy', 'deploying', 'post_deploy_qa', 'done',
];
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

const severityColors: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400',
};
const bugStatusColors: Record<string, string> = {
  open: 'bg-red-900/30 text-red-400', in_progress: 'bg-blue-900/30 text-blue-400',
  resolved: 'bg-green-900/30 text-green-400', verified: 'bg-emerald-900/30 text-emerald-400',
  wont_fix: 'bg-gray-800 text-gray-400',
};

const inputStyle: React.CSSProperties = { background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' };

// ─── Create Story Modal ───
export function CreateStoryModal({ open, onClose, onCreate, agents }: {
  open: boolean; onClose: () => void;
  onCreate: (data: any) => void; agents: Agent[];
}) {
  const [form, setForm] = useState({ title: '', description: '', acceptanceCriteria: '', priority: 'medium', assignedTo: '', sprint: '' });
  if (!open) return null;

  const handleSubmit = () => {
    if (!form.title) return;
    onCreate({
      title: form.title,
      description: form.description || undefined,
      acceptanceCriteria: form.acceptanceCriteria || undefined,
      priority: form.priority,
      assignedTo: form.assignedTo || undefined,
      sprint: form.sprint || undefined,
    });
    setForm({ title: '', description: '', acceptanceCriteria: '', priority: 'medium', assignedTo: '', sprint: '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-xl shadow-xl w-full max-w-lg p-6" style={{ background: '#1e1e24', border: '1px solid #3a3a4a' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Create Story</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl">&times;</button>
        </div>
        <div className="space-y-3">
          <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm h-20 resize-none" style={inputStyle} />
          <textarea placeholder="Acceptance Criteria" value={form.acceptanceCriteria} onChange={e => setForm(f => ({ ...f, acceptanceCriteria: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm h-16 resize-none" style={inputStyle} />
          <div className="grid grid-cols-3 gap-2">
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
              <option value="">Unassigned</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input placeholder="Sprint" value={form.sprint} onChange={e => setForm(f => ({ ...f, sprint: e.target.value }))}
              className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSubmit} disabled={!form.title}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Story Detail Modal ───
export function StoryDetailModal({ story, onClose, agents }: {
  story: UserStory | null; onClose: () => void; agents: Agent[];
}) {
  const { data: storyBugs = [] } = useBugs(story?.id || null);
  const { data: history = [] } = useStoryHistory(story?.id || null);
  const createBug = useCreateBug();
  const updateBug = useUpdateBug();
  const [showBugForm, setShowBugForm] = useState(false);
  const [bugForm, setBugForm] = useState({ title: '', description: '', severity: 'medium' });
  const [tab, setTab] = useState<'details' | 'bugs' | 'history'>('details');

  if (!story) return null;

  const handleAddBug = () => {
    if (!bugForm.title) return;
    createBug.mutate({ storyId: story.id, title: bugForm.title, description: bugForm.description || undefined, severity: bugForm.severity as any });
    setBugForm({ title: '', description: '', severity: 'medium' });
    setShowBugForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" style={{ background: '#1e1e24', border: '1px solid #3a3a4a' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{story.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2a2a35', color: '#c4a04a' }}>G:{story.gate}</span>
              <span className="text-xs text-gray-500">{story.status.replace(/_/g, ' ')}</span>
              {story.sprint && <span className="text-xs text-gray-500">• {story.sprint}</span>}
              {story.assignedToName && <span className="text-xs text-gray-400">• 👤 {story.assignedToName}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ background: '#111117' }}>
          {(['details', 'bugs', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-sm ${tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={tab === t ? { background: '#2a2a35' } : {}}>
              {t === 'bugs' ? `🐛 Bugs (${storyBugs.length})` : t === 'history' ? `📜 History (${history.length})` : '📋 Details'}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <div className="space-y-3">
            {story.description && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Description</div>
                <p className="text-sm text-gray-300">{story.description}</p>
              </div>
            )}
            {story.acceptanceCriteria && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Acceptance Criteria</div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{story.acceptanceCriteria}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">Priority</span><div className="text-white">{story.priority}</div></div>
              <div><span className="text-gray-500 text-xs">Bug Loop Count</span><div className="text-amber-400">{story.bugLoopCount}</div></div>
              <div><span className="text-gray-500 text-xs">Bug Count</span><div className="text-red-400">{story.bugCount}</div></div>
            </div>
          </div>
        )}

        {tab === 'bugs' && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">{storyBugs.length} bug{storyBugs.length !== 1 ? 's' : ''}</span>
              <button onClick={() => setShowBugForm(!showBugForm)} className="text-xs px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700">+ Add Bug</button>
            </div>
            {showBugForm && (
              <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }}>
                <input placeholder="Bug title" value={bugForm.title} onChange={e => setBugForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
                <div className="flex gap-2">
                  <select value={bugForm.severity} onChange={e => setBugForm(f => ({ ...f, severity: e.target.value }))}
                    className="rounded px-2 py-1.5 text-sm" style={inputStyle}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={handleAddBug} disabled={!bugForm.title}
                    className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">Add</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {storyBugs.map(bug => (
                <div key={bug.id} className="rounded-lg p-3 flex items-center justify-between" style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }}>
                  <div>
                    <div className="text-sm text-white">{bug.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] ${severityColors[bug.severity]}`}>{bug.severity}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${bugStatusColors[bug.status]}`}>{bug.status}</span>
                    </div>
                  </div>
                  {bug.status === 'open' && (
                    <button onClick={() => updateBug.mutate({ id: bug.id, status: 'resolved' as any })}
                      className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/50">Resolve</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 text-sm py-1.5" style={{ borderBottom: '1px solid #2a2a35' }}>
                <span className="text-gray-500 text-xs w-32 shrink-0">{new Date(h.changedAt).toLocaleString()}</span>
                <span className="text-gray-400">{h.changedBy || 'system'}</span>
                <span className="text-gray-600">→</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{h.fromStatus.replace(/_/g, ' ')}</span>
                <span className="text-gray-600">→</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">{h.toStatus.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-gray-600 italic">No history yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}
