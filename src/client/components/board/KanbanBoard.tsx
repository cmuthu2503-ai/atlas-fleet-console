import React, { useState, useMemo } from 'react';
import type { UserStory, StoryStatus, StoryFilters, Agent } from '../../types';
import { useStories, useCreateStory, useUpdateStory, useBoardStats } from '../../queries/stories';
import { useAgents } from '../../queries/agents';
import { KanbanColumn } from './KanbanColumn';
import { BoardStats } from './BoardStats';
import { BoardFilters } from './BoardFilters';
import { CreateStoryModal, StoryDetailModal } from './StoryModal';

const COLUMNS: StoryStatus[] = [
  'backlog', 'created', 'in_progress', 'code_review', 'qa_testing',
  'bug_fix', 'ready_to_deploy', 'deploying', 'post_deploy_qa', 'done',
];

export function KanbanBoardView() {
  const [filters, setFilters] = useState<StoryFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedStory, setSelectedStory] = useState<UserStory | null>(null);

  const { data: stories = [] } = useStories(filters);
  const { data: stats } = useBoardStats();
  const { data: agents = [] } = useAgents();
  const createStory = useCreateStory();
  const updateStory = useUpdateStory();

  const storiesByStatus = useMemo(() => {
    const map: Record<string, UserStory[]> = {};
    COLUMNS.forEach(c => { map[c] = []; });
    stories.forEach(s => {
      if (map[s.status]) map[s.status].push(s);
    });
    // Sort by priority within each column
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    Object.values(map).forEach(arr => arr.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)));
    return map;
  }, [stories]);

  const handleDrop = (storyId: string, newStatus: StoryStatus) => {
    updateStory.mutate({ id: storyId, status: newStatus });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">📋 Jira Board</h2>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">+ Create Story</button>
      </div>

      <BoardStats stats={stats} />
      <BoardFilters filters={filters} onChange={setFilters} agents={agents} />

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarColor: '#3a3a4a #111117' }}>
        {COLUMNS.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            stories={storiesByStatus[status] || []}
            onDrop={handleDrop}
            onCardClick={setSelectedStory}
          />
        ))}
      </div>

      <CreateStoryModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={data => createStory.mutate(data)}
        agents={agents}
      />
      <StoryDetailModal
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
        agents={agents}
      />
    </div>
  );
}
