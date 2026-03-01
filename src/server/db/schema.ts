import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── Story Statuses ───
export const STORY_STATUSES = [
  'backlog', 'created', 'in_progress', 'code_review', 'qa_testing',
  'bug_fix', 'ready_to_deploy', 'deploying', 'post_deploy_qa', 'done'
] as const;

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  channelId: text('channel_id'),
  status: text('status', { enum: ['active', 'disabled'] }).default('active').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  persona: text('persona'),
  teamId: text('team_id').references(() => teams.id),
  status: text('status', { enum: ['online', 'busy', 'idle', 'offline', 'disabled'] }).default('offline').notNull(),
  specialization: text('specialization'),
  model: text('model'),
  capabilities: text('capabilities'),
  parentAgentId: text('parent_agent_id'),
  avatarUrl: text('avatar_url'),
  preTeamDisableStatus: text('pre_team_disable_status'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  taskCode: text('task_code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'in_progress', 'delegated', 'completed', 'failed'] }).default('pending').notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'critical'] }).default('medium').notNull(),
  assignedAgentId: text('assigned_agent_id').references(() => agents.id),
  createdByAgentId: text('created_by_agent_id').references(() => agents.id),
  parentTaskId: text('parent_task_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
});

// ─── User Stories (Jira Board) ───
export const userStories = sqliteTable('user_stories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  acceptanceCriteria: text('acceptance_criteria'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'critical'] }).default('medium').notNull(),
  status: text('status', { enum: STORY_STATUSES }).default('backlog').notNull(),
  assignedTo: text('assigned_to').references(() => agents.id),
  team: text('team').references(() => teams.id),
  gate: integer('gate').default(0).notNull(),
  sprint: text('sprint'),
  bugLoopCount: integer('bug_loop_count').default(0).notNull(),
  parentFeature: text('parent_feature'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
});

// ─── Bugs ───
export const bugs = sqliteTable('bugs', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => userStories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).default('medium').notNull(),
  foundBy: text('found_by').references(() => agents.id),
  assignedTo: text('assigned_to').references(() => agents.id),
  status: text('status', { enum: ['open', 'in_progress', 'resolved', 'verified', 'wont_fix'] }).default('open').notNull(),
  createdAt: integer('created_at').notNull(),
  resolvedAt: integer('resolved_at'),
});

// ─── Story History ───
export const storyHistory = sqliteTable('story_history', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => userStories.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  changedBy: text('changed_by'),
  changedAt: integer('changed_at').notNull(),
});

export const delegationSteps = sqliteTable('delegation_steps', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  fromAgentId: text('from_agent_id').notNull().references(() => agents.id),
  toAgentId: text('to_agent_id').notNull().references(() => agents.id),
  action: text('action', { enum: ['assign', 'delegate', 'review', 'approve', 'reject', 'complete'] }).notNull(),
  message: text('message'),
  sessionId: text('session_id'),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] }).default('pending').notNull(),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});
