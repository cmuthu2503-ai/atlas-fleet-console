import React from 'react';
import type { BoardStats as BoardStatsType } from '../../types';

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog', created: 'Created', in_progress: 'In Progress',
  code_review: 'Code Review', qa_testing: 'QA Testing', bug_fix: 'Bug Fix',
  ready_to_deploy: 'Ready to Deploy', deploying: 'Deploying',
  post_deploy_qa: 'Post-Deploy QA', done: 'Done',
};

export function BoardStats({ stats }: { stats?: BoardStatsType }) {
  if (!stats) return null;
  return (
    <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-1">
      <div className="rounded-lg px-4 py-2 shrink-0" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: '#777' }}>Total</div>
        <div className="text-xl font-bold text-white">{stats.totalStories}</div>
      </div>
      <div className="rounded-lg px-4 py-2 shrink-0" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: '#777' }}>🐛 Bugs</div>
        <div className="text-xl font-bold text-red-400">{stats.totalBugs}</div>
      </div>
      <div className="rounded-lg px-4 py-2 shrink-0" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: '#777' }}>🔄 Avg Loop</div>
        <div className="text-xl font-bold text-amber-400">{stats.avgBugLoopCount}</div>
      </div>
      {Object.entries(stats.columns).filter(([, v]) => v > 0).map(([k, v]) => (
        <div key={k} className="rounded-lg px-3 py-2 shrink-0" style={{ background: '#1e1e24', border: '1px solid #2a2a35' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: '#777' }}>{COLUMN_LABELS[k] || k}</div>
          <div className="text-lg font-bold text-white">{v}</div>
        </div>
      ))}
    </div>
  );
}
