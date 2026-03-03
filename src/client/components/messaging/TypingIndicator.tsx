import type { TypingEvent } from '../../types/messaging';

interface Props {
  typingUsers: TypingEvent[];
}

export default function TypingIndicator({ typingUsers }: Props) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((t) => t.userName).join(', ');

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500"
      role="status"
      aria-live="polite"
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span>{names} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
    </div>
  );
}
