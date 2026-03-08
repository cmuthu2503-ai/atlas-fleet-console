import React, { useCallback, useEffect, useState } from 'react';

type BoardTask = {
  id: string;
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  status: string;
  priority?: string | null;
  team?: string | null;
  originAdvisoryTaskId?: string | null;
  originAdvisoryTitle?: string | null;
};

type BoardColumn = {
  key: string;
  label: string;
  color: string;
  tasks: BoardTask[];
};

type BoardSnapshot = {
  totalTasks: number;
  columns: BoardColumn[];
};

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  P0: { bg: '#3a1a1a', color: '#ef4444', border: '#5a2a2a' },
  P1: { bg: '#3a2a1a', color: '#f97316', border: '#5a3a1a' },
  P2: { bg: '#3a3a1a', color: '#eab308', border: '#5a5a1a' },
  P3: { bg: '#1a3a1a', color: '#22c55e', border: '#2a5a2a' },
};

function priorityBadge(priority?: string | null) {
  return PRIORITY_COLORS[priority || 'P2'] || PRIORITY_COLORS.P2;
}

function StoryPreviewModal({ task, onClose }: { task: BoardTask | null; onClose: () => void }) {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="rounded-xl shadow-xl w-full max-w-2xl p-6"
        style={{ background: '#1e1e24', border: '1px solid #3a3a4a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-blue-400">{task.id}</span>
              <h3 className="text-lg font-semibold text-white">{task.title}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-500">{task.status.replace(/_/g, ' ')}</span>
              {task.assignedTo && <span className="text-xs text-gray-400">• 👤 {task.assignedTo}</span>}
              {task.team && <span className="text-xs text-gray-500">• 🏷 {task.team}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl">&times;</button>
        </div>

        {task.description && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-1">Description</div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {task.originAdvisoryTaskId && (
          <div className="rounded-lg p-3" style={{ background: '#17171d', border: '1px solid #2a2a35' }}>
            <div className="text-xs font-medium text-gray-500 mb-1">Origin Advisory Task</div>
            <div className="text-sm text-blue-400 font-mono">{task.originAdvisoryTaskId}</div>
            {task.originAdvisoryTitle && (
              <div className="text-sm text-gray-300 mt-1">{task.originAdvisoryTitle}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoardView() {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);

  const fetchBoard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const res = await fetch('/api/board', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBoard(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'failed to load board');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  if (loading && !board) {
    return <div style={{ padding: 32, color: '#9ca3af' }}>Loading board…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">📋 Jira Board</h2>
          <button
            onClick={() => fetchBoard(true)}
            disabled={refreshing}
            title="Refresh tasks from API"
            className="px-3 py-1.5 text-sm rounded-lg font-medium transition-all"
            style={{
              background: refreshing ? '#4b5563' : '#3b82f6',
              color: '#fff',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <span style={{ display: 'inline-block', animation: refreshing ? 'refresh-spin 1s linear infinite' : 'none' }}>🔄</span>
            {' '}{refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <style>{`@keyframes refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          {lastRefresh && <span className="text-xs text-gray-500">Updated {lastRefresh.toLocaleTimeString()}</span>}
        </div>
        <div className="text-xs text-gray-500">
          {board ? `${board.totalTasks} execution task${board.totalTasks === 1 ? '' : 's'}` : null}
        </div>
      </div>

      <div className="rounded-lg px-4 py-3 mb-4" style={{ background: '#1a1a22', border: '1px solid #2a2a35' }}>
        <div className="text-sm text-gray-300">
          This board shows execution work only. If a task originated from `RESEARCH` or `ANALYSIS`, the card includes its source advisory task.
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 mb-4" style={{ background: '#3a1a1a', border: '1px solid #5a2a2a', color: '#fca5a5' }}>
          Error: {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarColor: '#3a3a4a #111117' }}>
        {board?.columns.map((column) => (
          <div
            key={column.key}
            className="flex flex-col rounded-lg shrink-0"
            style={{ width: 280, minHeight: 420, background: '#1a1a22', border: '1px solid #2a2a35' }}
          >
            <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid #2a2a35' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: column.color }} />
              <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: column.color }}>
                {column.label}
              </span>
              <span className="text-[11px] ml-auto" style={{ color: '#666' }}>{column.tasks.length}</span>
            </div>

            <div className="flex-1 p-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {column.tasks.map((task) => {
                const badge = priorityBadge(task.priority);
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left rounded-lg p-3 mb-2 hover:brightness-110 transition-all"
                    style={{ background: '#2a2a35', border: '1px solid #3a3a4a' }}
                  >
                    <span className="text-[11px] font-mono text-blue-400 mb-0.5 block">{task.id}</span>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-white leading-tight">{task.title}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                        style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                      >
                        {task.priority || 'P2'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.assignedTo && <span className="text-[11px] text-gray-400">👤 {task.assignedTo}</span>}
                      {task.team && <span className="text-[11px] text-gray-500">🏷 {task.team}</span>}
                      {task.originAdvisoryTaskId && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#172554', color: '#93c5fd' }}>
                          🔗 {task.originAdvisoryTaskId}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {column.tasks.length === 0 && (
                <div className="text-xs text-gray-600 italic text-center py-6">No tasks</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <StoryPreviewModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
