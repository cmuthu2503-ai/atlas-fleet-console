import { db, sqlite } from './client.js';
import { teams, agents, tasks, delegationSteps, userStories, bugs, storyHistory } from './schema.js';
import { v4 as uuid } from 'uuid';

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user_stories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'backlog',
    assigned_to TEXT REFERENCES agents(id),
    team TEXT REFERENCES teams(id),
    gate INTEGER NOT NULL DEFAULT 0,
    sprint TEXT,
    bug_loop_count INTEGER NOT NULL DEFAULT 0,
    parent_feature TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS bugs (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES user_stories(id),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    found_by TEXT REFERENCES agents(id),
    assigned_to TEXT REFERENCES agents(id),
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS story_history (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES user_stories(id),
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_by TEXT,
    changed_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    channel_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    persona TEXT,
    team_id TEXT REFERENCES teams(id),
    status TEXT NOT NULL DEFAULT 'offline',
    specialization TEXT,
    model TEXT,
    capabilities TEXT,
    parent_agent_id TEXT,
    avatar_url TEXT,
    pre_team_disable_status TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    task_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_agent_id TEXT REFERENCES agents(id),
    created_by_agent_id TEXT REFERENCES agents(id),
    parent_task_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS delegation_steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    from_agent_id TEXT NOT NULL REFERENCES agents(id),
    to_agent_id TEXT NOT NULL REFERENCES agents(id),
    action TEXT NOT NULL,
    message TEXT,
    session_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );
`);

// Clear existing data
sqlite.exec('DELETE FROM story_history; DELETE FROM bugs; DELETE FROM user_stories; DELETE FROM delegation_steps; DELETE FROM tasks; DELETE FROM agents; DELETE FROM teams;');

const now = Date.now();

// Teams
const leadershipTeamId = uuid();
const ctoTeamId = uuid();
const cpoTeamId = uuid();

db.insert(teams).values([
  { id: leadershipTeamId, name: 'Leadership', description: 'Executive leadership team', channelId: '#leadership', status: 'active', createdAt: now, updatedAt: now },
  { id: ctoTeamId, name: 'CTO Team', description: 'Engineering team under CTO', channelId: '#engineering', status: 'active', createdAt: now, updatedAt: now },
  { id: cpoTeamId, name: 'CPO Team', description: 'Product team under CPO', channelId: '#product', status: 'active', createdAt: now, updatedAt: now },
]).run();

// Leadership agents
const ceoId = uuid(), cooId = uuid(), ctoId = uuid(), cpoId = uuid();

db.insert(agents).values([
  { id: ceoId, agentId: 'ceo', name: 'Chandramouli', role: 'CEO', persona: 'Visionary leader', teamId: leadershipTeamId, status: 'online', specialization: 'Executive Leadership', model: 'claude-opus', capabilities: '["strategy","decision-making"]', parentAgentId: null, createdAt: now, updatedAt: now },
  { id: cooId, agentId: 'coo', name: 'Muddy', role: 'COO', persona: 'Operations expert', teamId: leadershipTeamId, status: 'online', specialization: 'Operations', model: 'claude-opus', capabilities: '["operations","coordination"]', parentAgentId: ceoId, createdAt: now, updatedAt: now },
  { id: ctoId, agentId: 'cto', name: 'Elon Musk', role: 'CTO', persona: 'Technical visionary', teamId: leadershipTeamId, status: 'online', specialization: 'Technology', model: 'claude-opus', capabilities: '["architecture","engineering"]', parentAgentId: cooId, createdAt: now, updatedAt: now },
  { id: cpoId, agentId: 'cpo', name: 'Sundar Pichai', role: 'CPO', persona: 'Product strategist', teamId: leadershipTeamId, status: 'online', specialization: 'Product', model: 'claude-opus', capabilities: '["product-strategy","user-experience"]', parentAgentId: cooId, createdAt: now, updatedAt: now },
]).run();

// Scrum Master
const jiraId = uuid();

db.insert(agents).values([
  { id: jiraId, agentId: 'jira', name: 'Jira', role: 'Program Manager & Scrum Master', persona: 'Relentless coordinator and process enforcer', teamId: ctoTeamId, status: 'online', specialization: 'Program Management', model: 'claude-sonnet-4.6', capabilities: '["coordination","sprint-planning","task-tracking","process-enforcement"]', parentAgentId: ctoId, createdAt: now, updatedAt: now },
]).run();

// CTO Team agents
const linusId = uuid(), pixelId = uuid(), adaId = uuid(), terraformId = uuid();
const sentinelId = uuid(), turingId = uuid(), piperId = uuid(), vectorId = uuid();

db.insert(agents).values([
  { id: linusId, agentId: 'linus', name: 'Linus', role: 'Backend Engineer', persona: 'Methodical backend specialist', teamId: ctoTeamId, status: 'online', specialization: 'Backend', model: 'kimi-k2.5', capabilities: '["api-design","databases","node.js","typescript"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: pixelId, agentId: 'pixel', name: 'Pixel', role: 'Frontend Engineer', persona: 'Creative UI builder', teamId: ctoTeamId, status: 'online', specialization: 'Frontend', model: 'kimi-k2.5', capabilities: '["react","tailwind","ui-design"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: adaId, agentId: 'ada', name: 'Ada', role: 'Security Engineer', persona: 'Security-first mindset', teamId: ctoTeamId, status: 'idle', specialization: 'Security', model: 'kimi-k2.5', capabilities: '["security-audit","penetration-testing","compliance"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: terraformId, agentId: 'terraform', name: 'Terraform', role: 'DevOps Engineer', persona: 'Infrastructure automation expert', teamId: ctoTeamId, status: 'idle', specialization: 'DevOps', model: 'deepseek-v3', capabilities: '["ci-cd","docker","kubernetes","terraform"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: sentinelId, agentId: 'sentinel', name: 'Sentinel', role: 'Quality Lead', persona: 'Quality guardian', teamId: ctoTeamId, status: 'idle', specialization: 'QA', model: 'kimi-k2.5', capabilities: '["testing","automation","quality-assurance"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: turingId, agentId: 'turing', name: 'Turing', role: 'AI/ML Engineer', persona: 'AI research enthusiast', teamId: ctoTeamId, status: 'idle', specialization: 'AI/ML', model: 'kimi-k2.5', capabilities: '["machine-learning","nlp","model-training"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: piperId, agentId: 'piper', name: 'Piper', role: 'Data Engineer', persona: 'Data pipeline architect', teamId: ctoTeamId, status: 'idle', specialization: 'Data Engineering', model: 'deepseek-v3', capabilities: '["etl","data-pipelines","analytics"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
  { id: vectorId, agentId: 'vector', name: 'Vector', role: 'Retrieval Engineer', persona: 'Search and retrieval specialist', teamId: ctoTeamId, status: 'idle', specialization: 'Retrieval', model: 'kimi-k2.5', capabilities: '["vector-search","rag","embeddings"]', parentAgentId: jiraId, createdAt: now, updatedAt: now },
]).run();

// CPO Team agent
const novaId = uuid();
db.insert(agents).values([
  { id: novaId, agentId: 'nova', name: 'Nova', role: 'Product Manager', persona: 'User-centric product thinker', teamId: cpoTeamId, status: 'online', specialization: 'Product Management', model: 'claude-sonnet', capabilities: '["product-strategy","user-research","roadmapping"]', parentAgentId: cpoId, createdAt: now, updatedAt: now },
]).run();

// Sample tasks
const task1Id = uuid(), task2Id = uuid(), task3Id = uuid();

db.insert(tasks).values([
  { id: task1Id, taskCode: 'T-001', title: 'Design Fleet API Schema', description: 'Design the REST API schema for the fleet management console', status: 'completed', priority: 'high', assignedAgentId: linusId, createdByAgentId: ctoId, createdAt: now - 86400000, updatedAt: now, completedAt: now },
  { id: task2Id, taskCode: 'T-002', title: 'Build Agent Dashboard UI', description: 'Create the frontend dashboard for agent management', status: 'in_progress', priority: 'high', assignedAgentId: pixelId, createdByAgentId: ctoId, createdAt: now - 43200000, updatedAt: now },
  { id: task3Id, taskCode: 'T-003', title: 'Security Audit - API Endpoints', description: 'Review all API endpoints for security vulnerabilities', status: 'pending', priority: 'medium', assignedAgentId: adaId, createdByAgentId: ctoId, parentTaskId: task1Id, createdAt: now, updatedAt: now },
]).run();

// Delegation steps
db.insert(delegationSteps).values([
  { id: uuid(), taskId: task1Id, fromAgentId: ceoId, toAgentId: ctoId, action: 'assign', message: 'Build the fleet management API', status: 'completed', createdAt: now - 86400000, completedAt: now - 82800000 },
  { id: uuid(), taskId: task1Id, fromAgentId: ctoId, toAgentId: linusId, action: 'delegate', message: 'Design and implement the API schema', status: 'completed', createdAt: now - 82800000, completedAt: now },
  { id: uuid(), taskId: task1Id, fromAgentId: linusId, toAgentId: ctoId, action: 'complete', message: 'API schema designed and implemented', status: 'completed', createdAt: now, completedAt: now },
  { id: uuid(), taskId: task2Id, fromAgentId: ctoId, toAgentId: pixelId, action: 'delegate', message: 'Build the dashboard UI based on API spec', status: 'in_progress', createdAt: now - 43200000 },
  { id: uuid(), taskId: task3Id, fromAgentId: ctoId, toAgentId: adaId, action: 'assign', message: 'Audit API endpoints after T-001 completion', status: 'pending', createdAt: now },
]).run();

// ─── Sample User Stories ───
const story1 = uuid(), story2 = uuid(), story3 = uuid(), story4 = uuid();
const story5 = uuid(), story6 = uuid(), story7 = uuid(), story8 = uuid();

db.insert(userStories).values([
  { id: story1, title: 'Design Fleet API Schema', description: 'Design REST API schema for fleet management console', acceptanceCriteria: 'All CRUD endpoints documented and typed', priority: 'high', status: 'done', assignedTo: linusId, team: ctoTeamId, gate: 7, sprint: 'Sprint-1', bugLoopCount: 1, parentFeature: 'Fleet Console', createdAt: now - 172800000, updatedAt: now, completedAt: now - 3600000 },
  { id: story2, title: 'Build Agent Dashboard UI', description: 'Create frontend dashboard for agent management with status indicators', acceptanceCriteria: 'Agent cards with status, model badges, team grouping', priority: 'high', status: 'qa_testing', assignedTo: pixelId, team: ctoTeamId, gate: 3, sprint: 'Sprint-1', bugLoopCount: 0, parentFeature: 'Fleet Console', createdAt: now - 86400000, updatedAt: now },
  { id: story3, title: 'Implement Security Audit Pipeline', description: 'Automated security scanning for all API endpoints', acceptanceCriteria: 'Zero critical vulnerabilities, automated CI check', priority: 'critical', status: 'in_progress', assignedTo: adaId, team: ctoTeamId, gate: 1, sprint: 'Sprint-2', bugLoopCount: 0, parentFeature: 'Security', createdAt: now - 43200000, updatedAt: now },
  { id: story4, title: 'Setup CI/CD Pipeline', description: 'Docker-based deployment pipeline with staging and production', acceptanceCriteria: 'Auto-deploy on merge to main, rollback capability', priority: 'high', status: 'code_review', assignedTo: terraformId, team: ctoTeamId, gate: 2, sprint: 'Sprint-1', bugLoopCount: 0, parentFeature: 'DevOps', createdAt: now - 64800000, updatedAt: now },
  { id: story5, title: 'RAG Knowledge Base Integration', description: 'Vector search integration for agent knowledge retrieval', acceptanceCriteria: 'Sub-200ms retrieval, >0.85 relevance score', priority: 'medium', status: 'backlog', assignedTo: vectorId, team: ctoTeamId, gate: 0, sprint: 'Sprint-2', bugLoopCount: 0, parentFeature: 'AI Platform', createdAt: now - 21600000, updatedAt: now },
  { id: story6, title: 'Task Delegation Tracing', description: 'Visual trace of task delegation chain across agents', acceptanceCriteria: 'Interactive delegation chain view with status colors', priority: 'medium', status: 'bug_fix', assignedTo: pixelId, team: ctoTeamId, gate: 3, sprint: 'Sprint-1', bugLoopCount: 2, parentFeature: 'Fleet Console', createdAt: now - 129600000, updatedAt: now },
  { id: story7, title: 'Product Roadmap Dashboard', description: 'Visual roadmap for product features and milestones', acceptanceCriteria: 'Timeline view with drag-and-drop milestone management', priority: 'low', status: 'created', assignedTo: novaId, team: cpoTeamId, gate: 0, sprint: 'Sprint-2', bugLoopCount: 0, parentFeature: 'Product', createdAt: now - 10800000, updatedAt: now },
  { id: story8, title: 'ML Model Training Pipeline', description: 'Automated model training with experiment tracking', acceptanceCriteria: 'MLflow integration, auto hyperparameter tuning', priority: 'medium', status: 'ready_to_deploy', assignedTo: turingId, team: ctoTeamId, gate: 4, sprint: 'Sprint-1', bugLoopCount: 1, parentFeature: 'AI Platform', createdAt: now - 259200000, updatedAt: now },
]).run();

// Sample bugs
db.insert(bugs).values([
  { id: uuid(), storyId: story6, title: 'Delegation arrows misaligned on mobile', description: 'Arrow connectors overflow on viewport < 768px', severity: 'medium', foundBy: sentinelId, assignedTo: pixelId, status: 'open', createdAt: now - 7200000 },
  { id: uuid(), storyId: story6, title: 'Status color not updating after transition', description: 'Badge color stays gray after completing step', severity: 'high', foundBy: sentinelId, assignedTo: pixelId, status: 'in_progress', createdAt: now - 3600000 },
  { id: uuid(), storyId: story1, title: 'Missing validation on team name', description: 'Empty string accepted as team name', severity: 'low', foundBy: sentinelId, assignedTo: linusId, status: 'resolved', createdAt: now - 86400000, resolvedAt: now - 43200000 },
  { id: uuid(), storyId: story2, title: 'Avatar not rendering for new agents', description: 'Default emoji missing for agents not in avatar map', severity: 'medium', foundBy: sentinelId, assignedTo: pixelId, status: 'open', createdAt: now - 1800000 },
]).run();

// Sample history
db.insert(storyHistory).values([
  { id: uuid(), storyId: story1, fromStatus: 'backlog', toStatus: 'in_progress', changedBy: 'Jira', changedAt: now - 172800000 },
  { id: uuid(), storyId: story1, fromStatus: 'in_progress', toStatus: 'code_review', changedBy: 'Linus', changedAt: now - 129600000 },
  { id: uuid(), storyId: story1, fromStatus: 'code_review', toStatus: 'qa_testing', changedBy: 'Jira', changedAt: now - 86400000 },
  { id: uuid(), storyId: story1, fromStatus: 'qa_testing', toStatus: 'bug_fix', changedBy: 'Sentinel', changedAt: now - 64800000 },
  { id: uuid(), storyId: story1, fromStatus: 'bug_fix', toStatus: 'qa_testing', changedBy: 'Linus', changedAt: now - 43200000 },
  { id: uuid(), storyId: story1, fromStatus: 'qa_testing', toStatus: 'done', changedBy: 'Sentinel', changedAt: now - 3600000 },
  { id: uuid(), storyId: story6, fromStatus: 'backlog', toStatus: 'in_progress', changedBy: 'Jira', changedAt: now - 129600000 },
  { id: uuid(), storyId: story6, fromStatus: 'in_progress', toStatus: 'qa_testing', changedBy: 'Pixel', changedAt: now - 86400000 },
  { id: uuid(), storyId: story6, fromStatus: 'qa_testing', toStatus: 'bug_fix', changedBy: 'Sentinel', changedAt: now - 43200000 },
]).run();

console.log('✅ Seed complete: 3 teams, 14 agents, 3 tasks, 5 delegation steps, 8 stories, 4 bugs, 9 history entries');
