import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Team } from '../types';

const BASE = '/api/fleet';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJson(`${BASE}/teams`),
    refetchInterval: 30_000,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; leaderId?: string }) =>
      fetchJson<Team>(`${BASE}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${BASE}/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useAddAgentToTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, agentId }: { teamId: string; agentId: string }) =>
      fetchJson(`${BASE}/teams/${teamId}/add-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDisableTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${BASE}/teams/${id}/disable`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useEnableTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${BASE}/teams/${id}/enable`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
