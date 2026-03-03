import React from 'react';
import type { UserStory } from '../../types';

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: '#3a1a1a', color: '#ef4444', border: '#5a2a2a' },
  high: { bg: '#3a2a1a', color: '#f97316', border: '#5a3a1a' },
  medium: { bg: '#3a3a1a', color: '#eab308', border: '#5a5a1a' },
  low: { bg: '#1a3a1a', color: '#22c55e', border: '#2a5a2a' },
};

export function StoryCard({ story, onClick }: { story: UserStory; onClick: () => void }) {
  const pc = PRIORITY_COLORS[story.priority] || PRIORITY_COLORS.medium;
  const gateLabel = story.gate === 3 && story.status === 'bug_fix' ? 'G:3a' : `G:${story.gate}`;

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('storyId', story.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={onClick}
      className="rounded-lg p-3 mb-2 cursor-pointer hover:brightness-110 transition-all"
      style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }}
    >
      {story.taskCode && (
        <span className="text-[11px] font-mono text-blue-400 mb-0.5 block">{story.taskCode}</span>
      )}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-white leading-tight line-clamp-2">{story.title}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
          style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>
          {story.priority === 'critical' ? 'P0' : story.priority === 'high' ? 'P1' : story.priority === 'medium' ? 'P2' : 'P3'}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {story.assignedToName && (
          <span className="text-[11px] text-gray-400">👤 {story.assignedToName}</span>
        )}
        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#1e1e24', color: '#c4a04a' }}>
          {gateLabel}
        </span>
        {story.bugCount > 0 && (
          <span className="text-[11px] text-red-400">🐛 {story.bugCount}</span>
        )}
        {story.bugLoopCount > 0 && (
          <span className="text-[11px] text-amber-400">🔄 {story.bugLoopCount}</span>
        )}
      </div>
    </div>
  );
}
