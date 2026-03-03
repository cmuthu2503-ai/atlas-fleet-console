import { useRef, useEffect, useCallback } from 'react';
import type { Message, Attachment, TypingEvent, UploadingFile } from '../../types/messaging';
import { CURRENT_USER_ID } from '../../hooks/useMessaging';
import ReadReceipt from './ReadReceipt';
import FileCard from './FileCard';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import UploadPreview from './UploadPreview';

interface Props {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  typingUsers: TypingEvent[];
  uploads: UploadingFile[];
  onLoadMore: () => void;
  onSend: (content: string) => void;
  onTyping: () => void;
  onAttach: (files: FileList) => void;
  onPreview: (attachment: Attachment) => void;
  onCancelUpload: (id: string) => void;
  onRemoveUpload: (id: string) => void;
  onMarkRead: (sequenceId: number) => void;
  conversationId: string | null;
  clientName?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function groupByDate(messages: Message[]): [string, Message[]][] {
  const groups = new Map<string, Message[]>();
  for (const msg of messages) {
    const key = new Date(msg.createdAt).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(msg);
  }
  return Array.from(groups.entries());
}

export default function ChatThread({
  messages,
  loading,
  hasMore,
  typingUsers,
  uploads,
  onLoadMore,
  onSend,
  onTyping,
  onAttach,
  onPreview,
  onCancelUpload,
  onRemoveUpload,
  onMarkRead,
  conversationId,
  clientName,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Mark last message as read when visible
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId !== CURRENT_USER_ID) {
      onMarkRead(last.sequenceId);
    }
  }, [messages, onMarkRead]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 100) {
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 text-gray-400">
        <svg className="mb-4 h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-lg">Select a conversation to start messaging</p>
      </div>
    );
  }

  const grouped = groupByDate(messages);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">{clientName || 'Chat'}</h2>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-label="Message history"
        aria-live="polite"
      >
        {loading && hasMore && (
          <div className="py-2 text-center text-sm text-gray-400">Loading...</div>
        )}

        {grouped.map(([dateKey, msgs]) => (
          <div key={dateKey}>
            {/* Date divider */}
            <div className="my-4 flex items-center gap-4" role="separator">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium text-gray-500">
                {formatDate(msgs[0].createdAt)}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {msgs.map((msg) => {
              const isOwn = msg.senderId === CURRENT_USER_ID;
              return (
                <div
                  key={msg.id}
                  className={`mb-3 flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isOwn
                          ? 'rounded-br-md bg-blue-600 text-white'
                          : 'rounded-bl-md bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Attachments */}
                    {msg.attachments.map((att) => (
                      <FileCard key={att.id} attachment={att} onPreview={onPreview} />
                    ))}

                    {/* Meta: time + receipt */}
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                      {isOwn && <ReadReceipt state={msg.receiptState} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <TypingIndicator typingUsers={typingUsers} />
        <div ref={bottomRef} />
      </div>

      {/* Upload previews */}
      <UploadPreview uploads={uploads} onCancel={onCancelUpload} onRemove={onRemoveUpload} />

      {/* Input */}
      <MessageInput onSend={onSend} onTyping={onTyping} onAttach={onAttach} />
    </div>
  );
}
