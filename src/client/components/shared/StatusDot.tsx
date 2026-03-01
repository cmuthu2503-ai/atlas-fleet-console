import type { Agent } from '../../types';

const colors: Record<Agent['status'], string> = {
  online: 'bg-status-online',
  busy: 'bg-status-busy',
  idle: 'bg-status-idle',
  offline: 'bg-status-offline',
  disabled: 'bg-gray-400',
};

export function StatusDot({ status, size = 'sm' }: { status: Agent['status']; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  return (
    <span
      className={`inline-block rounded-full ${s} ${colors[status]} ${status === 'online' ? 'animate-pulse' : ''}`}
      title={status}
    />
  );
}
