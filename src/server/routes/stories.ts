import { Hono } from 'hono';
import { db } from '../db/client.js';
import { userStories, bugs, storyHistory, agents, tasks, STORY_STATUSES } from '../db/schema.js';
import { eq, and, desc, sql, count, like } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const app = new Hono();

// Status → Gate mapping
const STATUS_GATE_MAP: Record<string, number> = {
  backlog: 0, created: 0, in_progress: 1, code_review: 2,
  qa_testing: 3, bug_fix: 3, ready_to_deploy: 4, deploying: 4,
  post_deploy_qa: 6, done: 7,
};

// ─── Stories CRUD ───

// GET /api/stories
app.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const assignedTo = c.req.query('assignedTo');
    const priority = c.req.query('priority');
    const sprint = c.req.query('sprint');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    const conditions: any[] = [];
    if (status) conditions.push(eq(userStories.status, status as any));
    if (assignedTo) conditions.push(eq(userStories.assignedTo, assignedTo));
    if (priority) conditions.push(eq(userStories.priority, priority as any));
    if (sprint) conditions.push(eq(userStories.sprint, sprint));

    let query = db.select({
      id: userStories.id, title: userStories.title, description: userStories.description,
      acceptanceCriteria: userStories.acceptanceCriteria, priority: userStories.priority,
      status: userStories.status, assignedTo: userStories.assignedTo, team: userStories.team,
      gate: userStories.gate, sprint: userStories.sprint, bugLoopCount: userStories.bugLoopCount,
      parentFeature: userStories.parentFeature, taskId: userStories.taskId,
      createdAt: userStories.createdAt, updatedAt: userStories.updatedAt, completedAt: userStories.completedAt,
      taskCode: tasks.taskCode,
    }).from(userStories).leftJoin(tasks, eq(userStories.taskId, tasks.id)).orderBy(desc(userStories.createdAt)).limit(limit).offset(offset);
    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Get bug counts per story
    const bugCounts = await db.select({
      storyId: bugs.storyId,
      count: count(),
    }).from(bugs).groupBy(bugs.storyId);

    const bugCountMap: Record<string, number> = {};
    bugCounts.forEach(bc => { bugCountMap[bc.storyId] = bc.count; });

    // Get agent names for assigned stories
    const agentList = await db.select({ id: agents.id, name: agents.name, agentId: agents.agentId }).from(agents);
    const agentMap: Record<string, string> = {};
    agentList.forEach(a => { agentMap[a.id] = a.name; });

    const data = result.map(s => ({
      ...s,
      bugCount: bugCountMap[s.id] || 0,
      assignedToName: s.assignedTo ? agentMap[s.assignedTo] || null : null,
    }));

    return c.json({ data });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/stories/search
app.get('/search', async (c) => {
  try {
    const q = c.req.query('q') || '';
    if (!q) return c.json({ data: [] });

    const result = await db.select({
      id: userStories.id, title: userStories.title, description: userStories.description,
      acceptanceCriteria: userStories.acceptanceCriteria, priority: userStories.priority,
      status: userStories.status, assignedTo: userStories.assignedTo, team: userStories.team,
      gate: userStories.gate, sprint: userStories.sprint, bugLoopCount: userStories.bugLoopCount,
      parentFeature: userStories.parentFeature, taskId: userStories.taskId,
      createdAt: userStories.createdAt, updatedAt: userStories.updatedAt, completedAt: userStories.completedAt,
      taskCode: tasks.taskCode,
    }).from(userStories)
      .innerJoin(tasks, eq(userStories.taskId, tasks.id))
      .where(like(tasks.taskCode, `%${q.toUpperCase()}%`));

    const agentList = await db.select({ id: agents.id, name: agents.name }).from(agents);
    const agentMap: Record<string, string> = {};
    agentList.forEach(a => { agentMap[a.id] = a.name; });

    const data = result.map(s => ({
      ...s,
      bugCount: 0,
      assignedToName: s.assignedTo ? agentMap[s.assignedTo] || null : null,
    }));

    return c.json({ data });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/stories
const createStorySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(STORY_STATUSES).optional(),
  assignedTo: z.string().optional(),
  team: z.string().optional(),
  sprint: z.string().optional(),
  parentFeature: z.string().optional(),
});

app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createStorySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const now = Date.now();
    const status = parsed.data.status || 'backlog';
    const newStory = {
      id: uuid(),
      ...parsed.data,
      status,
      priority: parsed.data.priority || 'medium',
      gate: STATUS_GATE_MAP[status] || 0,
      bugLoopCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(userStories).values(newStory);
    return c.json({ data: newStory }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/stories/:id
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.select().from(userStories).where(eq(userStories.id, id));
    if (existing.length === 0) return c.json({ error: 'Story not found' }, 404);

    const story = existing[0];
    const now = Date.now();
    const updates: any = { ...body, updatedAt: now };

    // Status transition logic
    if (body.status && body.status !== story.status) {
      // Record history
      await db.insert(storyHistory).values({
        id: uuid(),
        storyId: id,
        fromStatus: story.status,
        toStatus: body.status,
        changedBy: body.changedBy || 'system',
        changedAt: now,
      });

      // Update gate
      updates.gate = STATUS_GATE_MAP[body.status] ?? story.gate;

      // Bug loop: qa_testing -> bug_fix increments count
      if (body.status === 'bug_fix' && story.status === 'qa_testing') {
        updates.bugLoopCount = story.bugLoopCount + 1;
      }

      // Done: set completedAt
      if (body.status === 'done') {
        updates.completedAt = now;
      }
    }

    // Remove changedBy from updates (not a column)
    delete updates.changedBy;

    await db.update(userStories).set(updates).where(eq(userStories.id, id));
    const updated = await db.select().from(userStories).where(eq(userStories.id, id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/stories/:id
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    // Delete children first (SQLite cascade may not work with Drizzle)
    await db.delete(storyHistory).where(eq(storyHistory.storyId, id));
    await db.delete(bugs).where(eq(bugs.storyId, id));
    await db.delete(userStories).where(eq(userStories.id, id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ─── Bugs ───

// GET /api/stories/:id/bugs
app.get('/:id/bugs', async (c) => {
  try {
    const storyId = c.req.param('id');
    const result = await db.select().from(bugs).where(eq(bugs.storyId, storyId)).orderBy(desc(bugs.createdAt));
    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/stories/:id/bugs
const createBugSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  foundBy: z.string().optional(),
  assignedTo: z.string().optional(),
});

app.post('/:id/bugs', async (c) => {
  try {
    const storyId = c.req.param('id');
    const body = await c.req.json();
    const parsed = createBugSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const now = Date.now();
    const newBug = {
      id: uuid(),
      storyId,
      ...parsed.data,
      severity: parsed.data.severity || 'medium',
      status: 'open' as const,
      createdAt: now,
    };
    await db.insert(bugs).values(newBug);
    return c.json({ data: newBug }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ─── History ───

// GET /api/stories/:id/history
app.get('/:id/history', async (c) => {
  try {
    const storyId = c.req.param('id');
    const result = await db.select().from(storyHistory).where(eq(storyHistory.storyId, storyId)).orderBy(desc(storyHistory.changedAt));
    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
