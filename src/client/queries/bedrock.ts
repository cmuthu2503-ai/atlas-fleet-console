import { useQuery } from '@tanstack/react-query';
import type { BedrockModelCatalogResponse } from '../types';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      message = json.error || message;
    } catch {
      // Ignore JSON parse failures and keep the HTTP error.
    }
    throw new Error(message);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useBedrockModels(region: string) {
  return useQuery<BedrockModelCatalogResponse>({
    queryKey: ['bedrock-models', region],
    queryFn: () => fetchJson(`/api/bedrock/models?region=${encodeURIComponent(region)}`),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
