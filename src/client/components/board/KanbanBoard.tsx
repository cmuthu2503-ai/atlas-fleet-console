import React, { useState, useMemo } from 'react';
import type { UserStory, StoryStatus, StoryFilters, Agent } from '../../types';
import { useStories, useCreateStory, useUpdateStory, useBoardStats, useSearchStories } from '../../queries/stories';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: stories = [] } = useStories(filters);
  const { data: searchResults = [] } = useSearchStories(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setShowSearchResults(value.length > 0);
    }, 300);
  };
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Task ID (e.g. T-001)..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchQuery) setShowSearchResults(true); }}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              className="px-3 py-2 text-sm rounded-lg w-64"
              style={{ background: '#2a2a35', border: '1px solid #3a3a4a', color: '#fff' }}
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 w-80 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                style={{ background: '#1e1e24', border: '1px solid #3a3a4a' }}>
                {searchResults.map(s => (
                  <button key={s.id}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2"
                    onMouseDown={() => { setSelectedStory(s); setShowSearchResults(false); setSearchQuery(''); }}>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 font-mono">{s.taskCode}</span>
                    <span className="text-sm text-white truncate">{s.title}</span>
                    <span className="text-xs text-gray-500 ml-auto">{s.status.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}
            {showSearchResults && debouncedSearch && searchResults.length === 0 && (
              <div className="absolute top-full mt-1 left-0 w-80 rounded-lg shadow-xl z-50 px-3 py-2"
                style={{ background: '#1e1e24', border: '1px solid #3a3a4a' }}>
                <span className="text-sm text-gray-500">No results found</span>
              </div>
            )}
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">+ Create Story</button>
        </div>
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
