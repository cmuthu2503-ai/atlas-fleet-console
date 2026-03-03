import { useQuery } from '@tanstack/react-query';
import type { DelegationStep } from '../types';

const BASE = '/api/fleet';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useDelegationSteps(taskId: string | null) {
  return useQuery<DelegationStep[]>({
    queryKey: ['delegation', taskId],
    queryFn: () => fetchJson(`${BASE}/tasks/${taskId}/delegation-steps`),
    enabled: !!taskId,
  });
}
