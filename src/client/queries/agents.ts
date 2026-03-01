import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Agent } from '../types';

const BASE = '/api/fleet';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => fetchJson(`${BASE}/agents`),
    refetchInterval: 30_000,
  });
}

export function useAgent(id: string | null) {
  return useQuery<Agent>({
    queryKey: ['agents', id],
    queryFn: () => fetchJson(`${BASE}/agents/${id}`),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Agent>) =>
      fetchJson<Agent>(`${BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Agent> & { id: string }) =>
      fetchJson<Agent>(`${BASE}/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDisableAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<Agent>(`${BASE}/agents/${id}/disable`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useEnableAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<Agent>(`${BASE}/agents/${id}/enable`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${BASE}/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useRemoveAgentFromTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${BASE}/agents/${id}/remove-from-team`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useNameSuggestions(specialization: string | null) {
  return useQuery<{ names: string[] }>({
    queryKey: ['nameSuggestions', specialization],
    queryFn: () => fetchJson(`${BASE}/agents/name-suggestions?specialization=${specialization}`),
    enabled: !!specialization,
  });
}

export function useModelRecommendation(specialization: string | null) {
  return useQuery<{ recommended: string; alternatives: string[] }>({
    queryKey: ['modelRecommendation', specialization],
    queryFn: () => fetchJson(`${BASE}/agents/model-recommendation?specialization=${specialization}`),
    enabled: !!specialization,
  });
}
