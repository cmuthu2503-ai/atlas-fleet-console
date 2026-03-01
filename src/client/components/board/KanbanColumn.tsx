import React, { useState } from 'react';
import type { UserStory, StoryStatus } from '../../types';
import { StoryCard } from './StoryCard';

const COLUMN_COLORS: Record<string, string> = {
  backlog: '#6b7280', created: '#8b5cf6', in_progress: '#3b82f6', code_review: '#6366f1',
  qa_testing: '#f59e0b', bug_fix: '#ef4444', ready_to_deploy: '#10b981', deploying: '#14b8a6',
  post_deploy_qa: '#f97316', done: '#22c55e',
};

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'BACKLOG', created: 'CREATED', in_progress: 'IN PROGRESS', code_review: 'CODE REVIEW',
  qa_testing: 'QA TESTING', bug_fix: 'BUG FIX', ready_to_deploy: 'READY TO DEPLOY',
  deploying: 'DEPLOYING', post_deploy_qa: 'POST-DEPLOY QA', done: 'DONE',
};

export function KanbanColumn({ status, stories, onDrop, onCardClick }: {
  status: StoryStatus;
  stories: UserStory[];
  onDrop: (storyId: string, status: StoryStatus) => void;
  onCardClick: (story: UserStory) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const color = COLUMN_COLORS[status] || '#6b7280';

  return (
    <div
      className="flex flex-col rounded-lg shrink-0"
      style={{ width: 260, minHeight: 400, background: dragOver ? '#252530' : '#1a1a22', border: `1px solid ${dragOver ? color : '#2a2a35'}`, transition: 'border-color 0.2s' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('storyId'); if (id) onDrop(id, status); }}
    >
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid #2a2a35' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color }}>{COLUMN_LABELS[status]}</span>
        <span className="text-[11px] ml-auto" style={{ color: '#666' }}>{stories.length}</span>
      </div>
      <div className="flex-1 p-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {stories.map(s => (
          <StoryCard key={s.id} story={s} onClick={() => onCardClick(s)} />
        ))}
      </div>
    </div>
  );
}
