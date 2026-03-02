import { Hono } from 'hono';
import { db } from '../db/client.js';
import { bugs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const app = new Hono();

// GET /api/bugs — list all bugs
app.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const severity = c.req.query('severity');
    const conditions: any[] = [];
    if (status) conditions.push(eq(bugs.status, status as any));
    if (severity) conditions.push(eq(bugs.severity, severity as any));

    const { and, desc } = await import('drizzle-orm');
    let query = db.select().from(bugs).orderBy(desc(bugs.createdAt));
    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

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
