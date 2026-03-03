import type { ReceiptState } from '../../types/messaging';

interface Props {
  state: ReceiptState;
}

export default function ReadReceipt({ state }: Props) {
  const label =
    state === 'sent' ? 'Sent' : state === 'delivered' ? 'Delivered' : 'Read';
  const color = state === 'read' ? 'text-blue-500' : 'text-gray-400';

  return (
    <span className={`inline-flex items-center ${color}`} aria-label={label} title={label}>
      {state === 'sent' ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 8.5l4 4 8-8" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 8.5l4 4 8-8" />
          <path d="M6 8.5l4 4 8-8" />
        </svg>
      )}
    </span>
  );
}
