import React from 'react';
import { useAgents } from './queries/agents';
import { useTeams } from './queries/teams';
import { useTasks } from './queries/tasks';
import { StatusDot } from './components/shared/StatusDot';

function AgentCard({ agent }: { agent: any }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <StatusDot status={agent.status} />
        <h3 className="font-semibold text-lg">{agent.name}</h3>
      </div>
      <p className="text-sm text-gray-500">{agent.role}</p>
      {agent.specialization && (
        <span className="inline-block mt-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
          {agent.specialization}
        </span>
      )}
      {agent.model && <p className="text-xs text-gray-400 mt-1">Model: {agent.model}</p>}
    </div>
  );
}

function TaskRow({ task }: { task: any }) {
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };
  const statusColors: Record<string, string> = {
    completed: 'text-green-600',
    in_progress: 'text-blue-600',
    pending: 'text-gray-500',
    failed: 'text-red-600',
    delegated: 'text-purple-600',
  };
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-3 font-mono text-sm">{task.taskCode}</td>
      <td className="py-2 px-3">{task.title}</td>
      <td className="py-2 px-3">
        <span className={`text-sm font-medium ${statusColors[task.status] ?? ''}`}>
          {task.status}
        </span>
      </td>
      <td className="py-2 px-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority] ?? ''}`}>
          {task.priority}
        </span>
      </td>
    </tr>
  );
}

export default function App() {
  const [view, setView] = React.useState<'fleet' | 'tasks'>('fleet');
  const { data: agents = [], isLoading: loadingAgents } = useAgents();
  const { data: teams = [], isLoading: loadingTeams } = useTeams();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold text-gray-900">Atlas Fleet Console</h1>
          </div>
          <nav className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('fleet')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'fleet' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Fleet
            </button>
            <button
              onClick={() => setView('tasks')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'tasks' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tasks
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === 'fleet' ? (
          <>
            {/* Teams */}
            {teams.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Teams</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {teams.map((t: any) => (
                    <div key={t.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h3 className="font-semibold">{t.name}</h3>
                      {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
                      <span className={`text-xs mt-2 inline-block ${t.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Agents */}
            <section>
              <h2 className="text-lg font-semibold mb-4">
                Agents {!loadingAgents && <span className="text-gray-400 font-normal">({agents.length})</span>}
              </h2>
              {loadingAgents ? (
                <p className="text-gray-400">Loading agents…</p>
              ) : agents.length === 0 ? (
                <p className="text-gray-400">No agents registered yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((a: any) => (
                    <AgentCard key={a.id} agent={a} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              Tasks {!loadingTasks && <span className="text-gray-400 font-normal">({tasks.length})</span>}
            </h2>
            {loadingTasks ? (
              <p className="text-gray-400">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <p className="text-gray-400">No tasks yet.</p>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-600">
                    <tr>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t: any) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
