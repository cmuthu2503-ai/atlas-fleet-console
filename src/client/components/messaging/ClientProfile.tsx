import type { Conversation } from '../../types/messaging';

interface Props {
  conversation: Conversation | null;
  onClose: () => void;
}

export default function ClientProfile({ conversation, onClose }: Props) {
  if (!conversation) return null;

  return (
    <aside
      className="h-full overflow-y-auto border-l border-gray-200 bg-white"
      aria-label="Client profile"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Client Profile</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close profile panel"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center px-4 py-6">
        {conversation.clientAvatar ? (
          <img
            src={conversation.clientAvatar}
            alt={conversation.clientName}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-700">
            {conversation.clientName.charAt(0).toUpperCase()}
          </div>
        )}
        <h4 className="mt-3 text-base font-semibold text-gray-900">{conversation.clientName}</h4>
        <p className="mt-1 text-sm text-gray-500">Client</p>
      </div>

      <div className="border-t border-gray-200 px-4 py-4">
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Conversation Info
        </h5>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">Client ID</dt>
            <dd className="font-medium text-gray-900">{conversation.clientId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Advisor ID</dt>
            <dd className="font-medium text-gray-900">{conversation.advisorId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Activity</dt>
            <dd className="font-medium text-gray-900">
              {new Date(conversation.lastMessageAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
