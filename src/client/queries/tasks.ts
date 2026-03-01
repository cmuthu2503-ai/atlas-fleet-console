import { useQuery } from '@tanstack/react-query';
import type { Task } from '../types';

const BASE = '/api/fleet';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => fetchJson(`${BASE}/tasks`),
    refetchInterval: 30_000,
  });
}

export function useTask(id: string | null) {
  return useQuery<Task>({
    queryKey: ['tasks', id],
    queryFn: () => fetchJson(`${BASE}/tasks/${id}`),
    enabled: !!id,
  });
}

export function useAgentTasks(agentId: string | null) {
  return useQuery<Task[]>({
    queryKey: ['tasks', 'agent', agentId],
    queryFn: () => fetchJson(`${BASE}/tasks?agentId=${agentId}`),
    enabled: !!agentId,
  });
}
