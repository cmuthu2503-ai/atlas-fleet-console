import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
