import { Hono } from 'hono';
import { db } from '../db/client.js';
import { tasks, delegationSteps } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const app = new Hono();

// GET /api/fleet/tasks
app.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const assignedAgentId = c.req.query('assignedAgentId');
    const priority = c.req.query('priority');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const conditions = [];
    if (status) conditions.push(eq(tasks.status, status as any));
    if (assignedAgentId) conditions.push(eq(tasks.assignedAgentId, assignedAgentId));
    if (priority) conditions.push(eq(tasks.priority, priority as any));

    let query = db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(limit).offset(offset);
    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/fleet/tasks/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const task = await db.select().from(tasks).where(eq(tasks.id, id));
    if (task.length === 0) return c.json({ error: 'Task not found' }, 404);
    const steps = await db.select().from(delegationSteps).where(eq(delegationSteps.taskId, id));
    return c.json({ data: { ...task[0], delegationSteps: steps } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/fleet/tasks
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      taskCode: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'delegated', 'completed', 'failed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assignedAgentId: z.string().optional(),
      createdByAgentId: z.string().optional(),
      parentTaskId: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const existing = await db.select().from(tasks).where(eq(tasks.taskCode, parsed.data.taskCode));
    if (existing.length > 0) return c.json({ error: 'taskCode already exists' }, 400);

    const now = Date.now();
    const newTask = { id: uuid(), ...parsed.data, createdAt: now, updatedAt: now };
    await db.insert(tasks).values(newTask);
    return c.json({ data: newTask }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/tasks/:id
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.select().from(tasks).where(eq(tasks.id, id));
    if (existing.length === 0) return c.json({ error: 'Task not found' }, 404);

    const updates: any = { ...body, updatedAt: Date.now() };
    if (body.status === 'completed') updates.completedAt = Date.now();

    await db.update(tasks).set(updates).where(eq(tasks.id, id));
    const updated = await db.select().from(tasks).where(eq(tasks.id, id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
