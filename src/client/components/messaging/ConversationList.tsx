import type { Conversation } from '../../types/messaging';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function ConversationList({ conversations, activeId, onSelect }: Props) {
  return (
    <nav
      className="h-full overflow-y-auto border-r border-gray-200 bg-white"
      aria-label="Conversations"
      role="listbox"
    >
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
      </div>
      {conversations.map((c) => (
        <button
          key={c.id}
          role="option"
          aria-selected={c.id === activeId}
          onClick={() => onSelect(c.id)}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
            c.id === activeId ? 'bg-blue-50' : ''
          }`}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {c.clientAvatar ? (
              <img
                src={c.clientAvatar}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                {c.clientName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium text-gray-900">
                {c.clientName}
              </span>
              <span className="ml-2 flex-shrink-0 text-xs text-gray-500">
                {timeAgo(c.lastMessageAt)}
              </span>
            </div>
            <p className="truncate text-sm text-gray-500">{c.lastMessage || 'No messages yet'}</p>
          </div>

          {/* Unread badge */}
          {c.unreadCount > 0 && (
            <span
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white"
              aria-label={`${c.unreadCount} unread messages`}
            >
              {c.unreadCount > 99 ? '99+' : c.unreadCount}
            </span>
          )}
        </button>
      ))}
      {conversations.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-gray-400">No conversations</p>
      )}
    </nav>
  );
}
