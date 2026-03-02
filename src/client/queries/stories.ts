import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserStory, Bug, StoryHistoryEntry, StoryFilters, BoardStats } from '../types';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

async function mutateJson<T>(url: string, method: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useStories(filters?: StoryFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.sprint) params.set('sprint', filters.sprint);
  const qs = params.toString();
  return useQuery<UserStory[]>({
    queryKey: ['stories', filters],
    queryFn: () => fetchJson(`/api/stories${qs ? '?' + qs : ''}`),
    refetchInterval: 5000,
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserStory>) => mutateJson<UserStory>('/api/stories', 'POST', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stories'] }); qc.invalidateQueries({ queryKey: ['board-stats'] }); },
  });
}

export function useUpdateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<UserStory> & { id: string }) =>
      mutateJson<UserStory>(`/api/stories/${id}`, 'PATCH', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stories'] }); qc.invalidateQueries({ queryKey: ['board-stats'] }); },
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mutateJson<any>(`/api/stories/${id}`, 'DELETE'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stories'] }); qc.invalidateQueries({ queryKey: ['board-stats'] }); },
  });
}

export function useBugs(storyId: string | null) {
  return useQuery<Bug[]>({
    queryKey: ['bugs', storyId],
    queryFn: () => fetchJson(`/api/stories/${storyId}/bugs`),
    enabled: !!storyId,
  });
}

export function useCreateBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, ...data }: Partial<Bug> & { storyId: string }) =>
      mutateJson<Bug>(`/api/stories/${storyId}/bugs`, 'POST', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bugs'] }); qc.invalidateQueries({ queryKey: ['stories'] }); },
  });
}

export function useUpdateBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Bug> & { id: string }) =>
      mutateJson<Bug>(`/api/bugs/${id}`, 'PATCH', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bugs'] }); },
  });
}

export function useStoryHistory(storyId: string | null) {
  return useQuery<StoryHistoryEntry[]>({
    queryKey: ['story-history', storyId],
    queryFn: () => fetchJson(`/api/stories/${storyId}/history`),
    enabled: !!storyId,
  });
}

export function useBoardStats() {
  return useQuery<BoardStats>({
    queryKey: ['board-stats'],
    queryFn: () => fetchJson('/api/board/stats'),
    refetchInterval: 5000,
  });
}
