export interface Agent {
  id: string;
  agentId: string;
  name: string;
  role: string;
  persona?: string;
  teamId?: string;
  status: 'online' | 'busy' | 'idle' | 'offline' | 'disabled';
  specialization?: string;
  model?: string;
  capabilities?: string[];
  parentAgentId?: string;
  avatarUrl?: string;
  preTeamDisableStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  channelId?: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  agents?: Agent[];
}

export interface Task {
  id: string;
  taskCode: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'delegated' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgentId?: string;
  createdByAgentId?: string;
  parentTaskId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  delegationSteps?: DelegationStep[];
}

export interface DelegationStep {
  id: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  action: 'assign' | 'delegate' | 'review' | 'approve' | 'reject' | 'complete';
  message?: string;
  sessionId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export type ViewMode = 'fleet' | 'tasks';

export interface ContextMenuState {
  x: number;
  y: number;
  agentId?: string;
  isLeader?: boolean;
}
