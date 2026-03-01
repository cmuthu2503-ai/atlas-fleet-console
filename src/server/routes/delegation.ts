import { Hono } from 'hono';
import { db } from '../db/client.js';
import { delegationSteps } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const app = new Hono();

// GET /api/fleet/tasks/:taskId/delegation-steps
app.get('/tasks/:taskId/delegation-steps', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const result = await db.select().from(delegationSteps).where(eq(delegationSteps.taskId, taskId));
    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/fleet/tasks/:taskId/delegation-steps
app.post('/tasks/:taskId/delegation-steps', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const body = await c.req.json();
    const schema = z.object({
      fromAgentId: z.string().min(1),
      toAgentId: z.string().min(1),
      action: z.enum(['assign', 'delegate', 'review', 'approve', 'reject', 'complete']),
      message: z.string().optional(),
      sessionId: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const now = Date.now();
    const newStep = { id: uuid(), taskId, ...parsed.data, createdAt: now };
    await db.insert(delegationSteps).values(newStep);
    return c.json({ data: newStep }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/delegation-steps/:id
app.patch('/delegation-steps/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.select().from(delegationSteps).where(eq(delegationSteps.id, id));
    if (existing.length === 0) return c.json({ error: 'Delegation step not found' }, 404);

    const updates: any = { ...body };
    if (body.status === 'completed') updates.completedAt = Date.now();

    await db.update(delegationSteps).set(updates).where(eq(delegationSteps.id, id));
    const updated = await db.select().from(delegationSteps).where(eq(delegationSteps.id, id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
