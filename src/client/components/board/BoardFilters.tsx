import React from 'react';
import type { StoryFilters, StoryStatus, Agent } from '../../types';

const STATUSES: StoryStatus[] = [
  'backlog', 'created', 'in_progress', 'code_review', 'qa_testing',
  'bug_fix', 'ready_to_deploy', 'deploying', 'post_deploy_qa', 'done',
];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];

const selectStyle: React.CSSProperties = {
  background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff',
};

export function BoardFilters({ filters, onChange, agents }: {
  filters: StoryFilters;
  onChange: (f: StoryFilters) => void;
  agents: Agent[];
}) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <select value={filters.status || ''} onChange={e => onChange({ ...filters, status: (e.target.value || undefined) as any })}
        className="rounded-lg px-3 py-1.5 text-sm" style={selectStyle}>
        <option value="">All Statuses</option>
        {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
      </select>
      <select value={filters.priority || ''} onChange={e => onChange({ ...filters, priority: e.target.value || undefined })}
        className="rounded-lg px-3 py-1.5 text-sm" style={selectStyle}>
        <option value="">All Priorities</option>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={filters.assignedTo || ''} onChange={e => onChange({ ...filters, assignedTo: e.target.value || undefined })}
        className="rounded-lg px-3 py-1.5 text-sm" style={selectStyle}>
        <option value="">All Agents</option>
        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {(filters.status || filters.priority || filters.assignedTo) && (
        <button onClick={() => onChange({})} className="text-xs text-gray-500 hover:text-gray-300 px-2">✕ Clear</button>
      )}
    </div>
  );
}
