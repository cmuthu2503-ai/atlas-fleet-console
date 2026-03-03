import { useState, useEffect, useCallback, useRef } from 'react';
import type { Conversation, Message, TypingEvent, UploadingFile } from '../types/messaging';
import { getConversations, getMessages, uploadAttachment } from '../services/api';
import { messagingSocket } from '../services/websocket';

// Simulated current user — replace with auth context
export const CURRENT_USER_ID = 'advisor-1';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = messagingSocket.subscribe((msg) => {
      if (msg.type === 'message') {
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === msg.payload.conversationId
                ? {
                    ...c,
                    lastMessage: msg.payload.content,
                    lastMessageAt: msg.payload.createdAt,
                    unreadCount:
                      msg.payload.senderId !== CURRENT_USER_ID
                        ? c.unreadCount + 1
                        : c.unreadCount,
                  }
                : c
            )
            .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        );
      }
    });
    return () => { unsub(); };
  }, []);

  const clearUnread = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  return { conversations, loading, clearUnread };
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load initial messages
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setHasMore(true);
    getMessages(conversationId)
      .then((msgs) => {
        setMessages(msgs);
        if (msgs.length < 50) setHasMore(false);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || loading) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoading(true);
    try {
      const older = await getMessages(conversationId, oldest.sequenceId);
      if (older.length < 50) setHasMore(false);
      setMessages((prev) => [...older, ...prev]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, hasMore, loading, messages]);

  // WebSocket: new messages, receipts, typing
  useEffect(() => {
    const unsub = messagingSocket.subscribe((msg) => {
      if (msg.type === 'message' && msg.payload.conversationId === conversationId) {
        setMessages((prev) => [...prev, msg.payload]);
      }
      if (msg.type === 'ack') {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.payload.tempId ? msg.payload.message : m))
        );
      }
      if (msg.type === 'receipt') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.payload.messageId ? { ...m, receiptState: msg.payload.state } : m
          )
        );
      }
      if (msg.type === 'typing' && msg.payload.conversationId === conversationId) {
        const { userId } = msg.payload;
        if (userId === CURRENT_USER_ID) return;
        setTypingUsers((prev) => {
          if (prev.some((t) => t.userId === userId)) return prev;
          return [...prev, msg.payload];
        });
        // Clear after 3s
        const existing = typingTimers.current.get(userId);
        if (existing) clearTimeout(existing);
        typingTimers.current.set(
          userId,
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((t) => t.userId !== userId));
            typingTimers.current.delete(userId);
          }, 3000)
        );
      }
    });
    return () => { unsub(); };
  }, [conversationId]);

  // Send message (optimistic)
  const sendMessage = useCallback(
    (content: string, attachmentIds?: string[]) => {
      if (!conversationId) return;
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimistic: Message = {
        id: tempId,
        conversationId,
        senderId: CURRENT_USER_ID,
        content,
        sequenceId: Date.now(),
        createdAt: new Date().toISOString(),
        receiptState: 'sent',
        attachments: [],
      };
      setMessages((prev) => [...prev, optimistic]);
      messagingSocket.send({
        type: 'message',
        payload: { conversationId, content, tempId, attachmentIds },
      });
    },
    [conversationId]
  );

  // Send typing indicator (debounced)
  const sendTyping = useCallback(() => {
    if (!conversationId) return;
    messagingSocket.send({ type: 'typing', payload: { conversationId } });
  }, [conversationId]);

  // Mark read
  const markRead = useCallback(
    (upToSequenceId: number) => {
      if (!conversationId) return;
      messagingSocket.send({
        type: 'read',
        payload: { conversationId, upToSequenceId },
      });
    },
    [conversationId]
  );

  return { messages, loading, hasMore, loadMore, sendMessage, sendTyping, markRead, typingUsers };
}

export function useFileUpload() {
  const [uploads, setUploads] = useState<UploadingFile[]>([]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newUploads: UploadingFile[] = Array.from(files).map((file) => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      abortController: new AbortController(),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setUploads((prev) => [...prev, ...newUploads]);
    return newUploads;
  }, []);

  const startUpload = useCallback(async (upload: UploadingFile): Promise<string | null> => {
    try {
      const attachment = await uploadAttachment(
        'pending',
        upload.file,
        (pct) => {
          setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, progress: pct } : u)));
        },
        upload.abortController.signal
      );
      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
      return attachment.id;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setUploads((prev) => prev.filter((u) => u.id !== upload.id));
        return null;
      }
      throw e;
    }
  }, []);

  const cancelUpload = useCallback((uploadId: string) => {
    setUploads((prev) => {
      const upload = prev.find((u) => u.id === uploadId);
      if (upload) {
        upload.abortController.abort();
        if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      }
      return prev.filter((u) => u.id !== uploadId);
    });
  }, []);

  const removeUpload = useCallback((uploadId: string) => {
    setUploads((prev) => {
      const upload = prev.find((u) => u.id === uploadId);
      if (upload?.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      return prev.filter((u) => u.id !== uploadId);
    });
  }, []);

  return { uploads, addFiles, startUpload, cancelUpload, removeUpload };
}
