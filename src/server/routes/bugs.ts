import { Hono } from 'hono';
import { db } from '../db/client.js';
import { bugs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const app = new Hono();

// PATCH /api/bugs/:id
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.select().from(bugs).where(eq(bugs.id, id));
    if (existing.length === 0) return c.json({ error: 'Bug not found' }, 404);

    const updates: any = { ...body };
    if (body.status === 'resolved' || body.status === 'verified') {
      updates.resolvedAt = Date.now();
    }

    await db.update(bugs).set(updates).where(eq(bugs.id, id));
    const updated = await db.select().from(bugs).where(eq(bugs.id, id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
