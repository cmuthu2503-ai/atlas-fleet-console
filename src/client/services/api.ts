import type { Conversation, Message, Attachment } from '../types/messaging';

const BASE = '/api/v1';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getConversations(): Promise<Conversation[]> {
  return fetchJSON(`${BASE}/conversations`);
}

export async function getMessages(
  conversationId: string,
  before?: number,
  limit = 50
): Promise<Message[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before !== undefined) params.set('before', String(before));
  return fetchJSON(`${BASE}/conversations/${conversationId}/messages?${params}`);
}

export async function sendMessageREST(
  conversationId: string,
  content: string,
  attachmentIds?: string[]
): Promise<Message> {
  return fetchJSON(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachmentIds }),
  });
}

export async function uploadAttachment(
  messageId: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/attachments/upload`);

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')));

    const fd = new FormData();
    fd.append('file', file);
    fd.append('messageId', messageId);
    xhr.send(fd);
  });
}

export async function getDownloadUrl(attachmentId: string): Promise<string> {
  const data = await fetchJSON<{ url: string }>(`${BASE}/attachments/${attachmentId}/download`);
  return data.url;
}

export async function markRead(messageId: string): Promise<void> {
  await fetch(`${BASE}/messages/${messageId}/read`, { method: 'PUT' });
}
