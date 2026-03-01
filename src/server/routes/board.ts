import { Hono } from 'hono';
import { db } from '../db/client.js';
import { userStories, bugs, agents, STORY_STATUSES } from '../db/schema.js';
import { eq, count, sql } from 'drizzle-orm';

const app = new Hono();

// GET /api/board/stats
app.get('/stats', async (c) => {
  try {
    // Counts per column
    const columnCounts = await db.select({
      status: userStories.status,
      count: count(),
    }).from(userStories).groupBy(userStories.status);

    const columns: Record<string, number> = {};
    STORY_STATUSES.forEach(s => { columns[s] = 0; });
    columnCounts.forEach(cc => { columns[cc.status] = cc.count; });

    // Counts per agent
    const agentCounts = await db.select({
      assignedTo: userStories.assignedTo,
      count: count(),
    }).from(userStories).where(sql`${userStories.assignedTo} IS NOT NULL`).groupBy(userStories.assignedTo);

    const agentsList = await db.select({ id: agents.id, name: agents.name }).from(agents);
    const agentNameMap: Record<string, string> = {};
    agentsList.forEach(a => { agentNameMap[a.id] = a.name; });

    const agentsMap: Record<string, number> = {};
    agentCounts.forEach(ac => {
      const name = ac.assignedTo ? agentNameMap[ac.assignedTo] || ac.assignedTo : 'unassigned';
      agentsMap[name] = ac.count;
    });

    // Total bugs
    const totalBugsResult = await db.select({ count: count() }).from(bugs);
    const totalBugs = totalBugsResult[0]?.count || 0;

    // Avg bug loop count
    const avgResult = await db.select({
      avg: sql<number>`AVG(${userStories.bugLoopCount})`,
    }).from(userStories);
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
