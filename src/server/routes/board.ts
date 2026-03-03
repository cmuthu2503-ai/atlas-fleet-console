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

// GET /api/board/stats
app.get('/stats', async (c) => {
  try {
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
