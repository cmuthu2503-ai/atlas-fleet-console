import { existsSync } from 'fs';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { db } from '../db/client.js';
import { userStories, bugs, agents, STORY_STATUSES } from '../db/schema.js';
import { eq, and, count, sql } from 'drizzle-orm';

const app = new Hono();
const truthy = new Set(['1', 'true', 'yes', 'on']);
function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  return truthy.has(value.toLowerCase());
}

const LIVE_JIRA_DB_PATH = process.env.LIVE_JIRA_DB_PATH || '/host-openclaw/workspace-jira/memory.db';
const STRICT_STATUS_COLUMNS = [
  { key: 'INTAKE', label: 'INTAKE', color: '#64748b' },
  { key: 'CLASSIFIED', label: 'CLASSIFIED', color: '#8b5cf6' },
  { key: 'PRD_REQUIRED', label: 'PRD REQUIRED', color: '#a855f7' },
  { key: 'PRD_IN_PROGRESS', label: 'PRD IN PROGRESS', color: '#7c3aed' },
  { key: 'PRD_CTO_REVIEW', label: 'PRD CTO REVIEW', color: '#6366f1' },
  { key: 'READY_FOR_DEV', label: 'READY FOR DEV', color: '#0ea5e9' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: '#3b82f6' },
  { key: 'CODE_REVIEW', label: 'CODE REVIEW', color: '#2563eb' },
  { key: 'CI_VALIDATION', label: 'CI VALIDATION', color: '#06b6d4' },
  { key: 'QA_PRE_DEPLOY', label: 'QA PRE-DEPLOY', color: '#f59e0b' },
  { key: 'READY_FOR_DEPLOY', label: 'READY FOR DEPLOY', color: '#10b981' },
  { key: 'DEPLOYING', label: 'DEPLOYING', color: '#14b8a6' },
  { key: 'QA_POST_DEPLOY', label: 'QA POST-DEPLOY', color: '#f97316' },
  { key: 'DONE', label: 'DONE', color: '#22c55e' },
  { key: 'BLOCKED', label: 'BLOCKED', color: '#ef4444' },
  { key: 'EXCEPTION_PENDING', label: 'EXCEPTION PENDING', color: '#d97706' },
] as const;

type LiveStoryRow = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: string;
  priority: string | null;
  team: string | null;
  updated_at: number | null;
};

function openLiveJiraDb() {
  if (!existsSync(LIVE_JIRA_DB_PATH)) return null;
  return new Database(LIVE_JIRA_DB_PATH, { readonly: true, fileMustExist: true });
}

function priorityToBoardPriority(priority: string | null | undefined) {
  if (!priority) return 'P2';
  const normalized = String(priority).trim().toUpperCase();
  if (['P0', 'P1', 'P2', 'P3'].includes(normalized)) return normalized;

  const aliasMap: Record<string, string> = {
    CRITICAL: 'P0',
    HIGH: 'P1',
    MEDIUM: 'P2',
    LOW: 'P3',
  };
  return aliasMap[normalized] || normalized;
}

function buildLiveBoardResponse() {
  const liveDb = openLiveJiraDb();
  if (!liveDb) return null;

  try {
    const rows = liveDb
      .prepare(`
        SELECT id, title, description, assigned_to, status, priority, team, updated_at
        FROM user_stories
        ORDER BY updated_at DESC
      `)
      .all() as LiveStoryRow[];

    const tasks = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      assignedTo: row.assigned_to,
      status: row.status,
      priority: priorityToBoardPriority(row.priority),
      team: row.team,
      updatedAt: row.updated_at,
    }));

    return {
      columns: STRICT_STATUS_COLUMNS.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.key),
      })),
      totalTasks: tasks.length,
    };
  } finally {
    liveDb.close();
  }
}

async function buildLocalBoardResponse() {
  const localStories = await db.select({
    id: userStories.id,
    title: userStories.title,
    description: userStories.description,
    assignedTo: userStories.assignedTo,
    status: userStories.status,
    priority: userStories.priority,
    team: userStories.team,
  }).from(userStories);

  const columns = STORY_STATUSES.map((status) => ({
    key: status,
    label: status.replace(/_/g, ' ').toUpperCase(),
    color: '#6b7280',
    tasks: localStories.filter((story) => story.status === status),
  }));

  return {
    columns,
    totalTasks: localStories.length,
  };
}

// GET /api/board - full board with columns and tasks
app.get('/', async (c) => {
  try {
    const liveBoard = buildLiveBoardResponse();
    if (liveBoard) {
      return c.json(liveBoard);
    }

    return c.json(await buildLocalBoardResponse());
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/board/stats
app.get('/stats', async (c) => {
  try {
    const liveBoard = buildLiveBoardResponse();
    if (liveBoard) {
      const columns: Record<string, number> = {};
      liveBoard.columns.forEach((column) => {
        columns[column.key] = column.tasks.length;
      });

      const agentsMap: Record<string, number> = {};
      for (const column of liveBoard.columns) {
        for (const task of column.tasks) {
          if (!task.assignedTo) continue;
          agentsMap[task.assignedTo] = (agentsMap[task.assignedTo] || 0) + 1;
        }
      }

      return c.json({
        data: {
          columns,
          agents: agentsMap,
          totalStories: liveBoard.totalTasks,
          totalBugs: 0,
          avgBugLoopCount: 0,
        },
      });
    }

    const status = c.req.query('status');
    const assignedTo = c.req.query('assignedTo');
    const priority = c.req.query('priority');
    const sprint = c.req.query('sprint');
    const linkedOnly = parseBoolean(c.req.query('linkedOnly'), true);

    const conditions: any[] = [];
    if (status) conditions.push(eq(userStories.status, status as any));
    if (assignedTo) conditions.push(eq(userStories.assignedTo, assignedTo));
    if (priority) conditions.push(eq(userStories.priority, priority as any));
    if (sprint) conditions.push(eq(userStories.sprint, sprint));
    if (linkedOnly) conditions.push(sql`${userStories.taskId} IS NOT NULL`);

    // Counts per column
    const columnCountsQuery = db.select({
      status: userStories.status,
      count: count(),
    }).from(userStories).groupBy(userStories.status);
    const columnCounts = conditions.length > 0
      ? await columnCountsQuery.where(and(...conditions))
      : await columnCountsQuery;

    const columns: Record<string, number> = {};
    STORY_STATUSES.forEach(s => { columns[s] = 0; });
    columnCounts.forEach(cc => { columns[cc.status] = cc.count; });

    // Counts per agent
    const agentQuery = db.select({
      assignedTo: userStories.assignedTo,
      count: count(),
    }).from(userStories).groupBy(userStories.assignedTo);
    const agentConditions = [...conditions, sql`${userStories.assignedTo} IS NOT NULL`];
    const agentCounts = await agentQuery.where(and(...agentConditions));

    const agentsList = await db.select({ id: agents.id, name: agents.name }).from(agents);
    const agentNameMap: Record<string, string> = {};
    agentsList.forEach(a => { agentNameMap[a.id] = a.name; });

    const agentsMap: Record<string, number> = {};
    agentCounts.forEach(ac => {
      const name = ac.assignedTo ? agentNameMap[ac.assignedTo] || ac.assignedTo : 'unassigned';
      agentsMap[name] = ac.count;
    });

    // Total bugs
    const bugCountQuery = db.select({ count: count() })
      .from(bugs)
      .innerJoin(userStories, eq(bugs.storyId, userStories.id));
    const totalBugsResult = conditions.length > 0
      ? await bugCountQuery.where(and(...conditions))
      : await bugCountQuery;
    const totalBugs = totalBugsResult[0]?.count || 0;

    // Avg bug loop count
    const avgQuery = db.select({
      avg: sql<number>`AVG(${userStories.bugLoopCount})`,
    }).from(userStories);
    const avgResult = conditions.length > 0
      ? await avgQuery.where(and(...conditions))
      : await avgQuery;
    const avgBugLoopCount = Math.round((avgResult[0]?.avg || 0) * 100) / 100;

    const total = Object.values(columns).reduce((a, b) => a + b, 0);

    return c.json({
      data: { columns, agents: agentsMap, totalStories: total, totalBugs, avgBugLoopCount },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
