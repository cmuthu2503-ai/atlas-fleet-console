import { Hono } from 'hono';
import { db } from '../db/client.js';
import { teams, agents } from '../db/schema.js';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const app = new Hono();

// GET /api/fleet/teams
app.get('/', async (c) => {
  try {
    const result = await db.select().from(teams);
    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/fleet/teams/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const team = await db.select().from(teams).where(eq(teams.id, id));
    if (team.length === 0) return c.json({ error: 'Team not found' }, 404);
    const teamAgents = await db.select().from(agents).where(eq(agents.teamId, id));
    return c.json({ data: { ...team[0], agents: teamAgents } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/fleet/teams
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      name: z.string().min(3).max(50),
      description: z.string().optional(),
      channelId: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    const existing = await db.select().from(teams).where(eq(teams.name, parsed.data.name));
    if (existing.length > 0) return c.json({ error: 'Team name already exists' }, 400);

    const now = Date.now();
    const newTeam = { id: uuid(), ...parsed.data, status: 'active' as const, createdAt: now, updatedAt: now };
    await db.insert(teams).values(newTeam);
    return c.json({ data: newTeam }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/teams/:id
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.select().from(teams).where(eq(teams.id, id));
    if (existing.length === 0) return c.json({ error: 'Team not found' }, 404);

    await db.update(teams).set({ ...body, updatedAt: Date.now() }).where(eq(teams.id, id));
    const updated = await db.select().from(teams).where(eq(teams.id, id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/teams/:id/disable
app.patch('/:id/disable', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(teams).where(eq(teams.id, id));
    if (existing.length === 0) return c.json({ error: 'Team not found' }, 404);

    const teamAgents = await db.select().from(agents).where(eq(agents.teamId, id));
    for (const agent of teamAgents) {
      await db.update(agents).set({
        preTeamDisableStatus: agent.status,
        status: 'disabled',
        updatedAt: Date.now(),
      }).where(eq(agents.id, agent.id));
    }

    await db.update(teams).set({ status: 'disabled', updatedAt: Date.now() }).where(eq(teams.id, id));
    return c.json({ data: { id, status: 'disabled', agentsDisabled: teamAgents.length } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/teams/:id/enable
app.patch('/:id/enable', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(teams).where(eq(teams.id, id));
    if (existing.length === 0) return c.json({ error: 'Team not found' }, 404);

    const teamAgents = await db.select().from(agents).where(eq(agents.teamId, id));
    for (const agent of teamAgents) {
      const restoreStatus = agent.preTeamDisableStatus || 'offline';
      await db.update(agents).set({
        status: restoreStatus as any,
        preTeamDisableStatus: null,
        updatedAt: Date.now(),
      }).where(eq(agents.id, agent.id));
    }

    await db.update(teams).set({ status: 'active', updatedAt: Date.now() }).where(eq(teams.id, id));
    return c.json({ data: { id, status: 'active', agentsRestored: teamAgents.length } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/fleet/teams/:id
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(teams).where(eq(teams.id, id));
    if (existing.length === 0) return c.json({ error: 'Team not found' }, 404);

    // Unassign all agents from this team
    const teamAgents = await db.select().from(agents).where(eq(agents.teamId, id));
    for (const agent of teamAgents) {
      await db.update(agents).set({ teamId: null, updatedAt: Date.now() }).where(eq(agents.id, agent.id));
    }

    await db.delete(teams).where(eq(teams.id, id));
    return c.json({ data: { id, deleted: true, agentsUnassigned: teamAgents.length } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/fleet/teams/:id/add-agent
app.post('/:id/add-agent', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { agentId } = body;
    if (!agentId) return c.json({ error: 'agentId is required' }, 400);

    const team = await db.select().from(teams).where(eq(teams.id, id));
    if (team.length === 0) return c.json({ error: 'Team not found' }, 404);

    const agent = await db.select().from(agents).where(or(eq(agents.id, agentId), eq(agents.agentId, agentId)));
    if (agent.length === 0) return c.json({ error: 'Agent not found' }, 404);

    await db.update(agents).set({ teamId: id, updatedAt: Date.now() }).where(eq(agents.id, agent[0]!.id));
    const updated = await db.select().from(agents).where(eq(agents.id, agent[0]!.id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
