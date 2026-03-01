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

// ─── Jira Board Types ───
export type StoryStatus = 'backlog' | 'created' | 'in_progress' | 'code_review' |
  'qa_testing' | 'bug_fix' | 'ready_to_deploy' | 'deploying' | 'post_deploy_qa' | 'done';

export interface UserStory {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: StoryStatus;
  assignedTo?: string;
  assignedToName?: string;
  team?: string;
  gate: number;
  sprint?: string;
  bugLoopCount: number;
  bugCount: number;
  parentFeature?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface Bug {
  id: string;
  storyId: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  foundBy?: string;
  assignedTo?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'verified' | 'wont_fix';
  createdAt: number;
  resolvedAt?: number;
}

export interface StoryHistoryEntry {
  id: string;
  storyId: string;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
  changedAt: number;
}

export interface StoryFilters {
  status?: StoryStatus;
  assignedTo?: string;
  priority?: string;
  sprint?: string;
}

export interface BoardStats {
  columns: Record<string, number>;
  agents: Record<string, number>;
  totalStories: number;
  totalBugs: number;
  avgBugLoopCount: number;
}

export type ViewMode = 'fleet' | 'tasks';

export interface ContextMenuState {
  x: number;
  y: number;
  agentId?: string;
  isLeader?: boolean;
}
