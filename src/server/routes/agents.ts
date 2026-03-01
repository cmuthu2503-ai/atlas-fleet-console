import { Hono } from 'hono';
import { db } from '../db/client.js';
import { agents, tasks } from '../db/schema.js';
import { eq, and, sql, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const app = new Hono();

const SPECIALIZATION_NAMES: Record<string, string[]> = {
  'Backend': ['Atlas', 'Forge', 'Nexus', 'Bolt', 'Cipher', 'Rust', 'Onyx', 'Slate'],
  'Frontend': ['Prism', 'Canvas', 'Bloom', 'Spark', 'Ember', 'Hue', 'Flux', 'Palette'],
  'Security': ['Shield', 'Aegis', 'Bastion', 'Cipher', 'Knox', 'Vault', 'Ward', 'Sentry'],
  'DevOps': ['Pipeline', 'Harbor', 'Dock', 'Crane', 'Helm', 'Anchor', 'Relay', 'Stack'],
  'QA': ['Probe', 'Assert', 'Verify', 'Check', 'Audit', 'Trace', 'Scan', 'Lint'],
  'AI/ML': ['Neuron', 'Cortex', 'Synapse', 'Darwin', 'Tesla', 'Watson', 'Sage', 'Oracle'],
  'Data Engineering': ['Stream', 'Delta', 'Lake', 'Conduit', 'Funnel', 'Siphon', 'Tap', 'Flow'],
  'Retrieval': ['Seeker', 'Finder', 'Scout', 'Radar', 'Compass', 'Index', 'Query', 'Fetch'],
  'Product Management': ['Vision', 'Scope', 'Compass', 'Atlas', 'Guide', 'North', 'Beacon', 'Lens'],
  'Enterprise Architecture': ['Strategist', 'Govern', 'Mandate', 'Blueprint', 'Standard'],
  'Platform Architecture': ['Platform', 'Micro', 'Gateway', 'Mesh', 'Service'],
  'Data Architecture': ['Schema', 'Model', 'Catalog', 'Lineage', 'Govern'],
  'Technology Architecture': ['Stack', 'Cloud', 'Infra', 'Fabric', 'Core'],
};

// GET /api/fleet/agents
app.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const teamId = c.req.query('teamId');
    const specialization = c.req.query('specialization');

    let query = db.select().from(agents);
    const conditions = [];
    if (status) conditions.push(eq(agents.status, status as any));
    if (teamId) conditions.push(eq(agents.teamId, teamId));
    if (specialization) conditions.push(eq(agents.specialization, specialization));

    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/fleet/agents/suggest-name
app.post('/suggest-name', async (c) => {
  try {
    const body = await c.req.json();
    const specialization = body.specialization as string;
    if (!specialization) return c.json({ error: 'specialization is required' }, 400);

    const names = SPECIALIZATION_NAMES[specialization] || SPECIALIZATION_NAMES['Backend']!;
    const existing = await db.select({ name: agents.name }).from(agents);
    const existingNames = new Set(existing.map(a => a.name));
    const available = names.filter(n => !existingNames.has(n));
    return c.json({ data: available.slice(0, 3) });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/fleet/agents/name-suggestions
app.get('/name-suggestions', async (c) => {
  try {
    const specialization = c.req.query('specialization');
    if (!specialization) return c.json({ data: { names: [] } });
    const names = SPECIALIZATION_NAMES[specialization] || SPECIALIZATION_NAMES['Backend']!;
    const existing = await db.select({ name: agents.name }).from(agents);
    const existingNames = new Set(existing.map(a => a.name));
    const available = names.filter(n => !existingNames.has(n));
    return c.json({ data: { names: available.slice(0, 3) } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/fleet/agents/model-recommendation
app.get('/model-recommendation', async (c) => {
  try {
    const specialization = c.req.query('specialization');
    const MODEL_MAP: Record<string, { recommended: string; alternatives: string[] }> = {
      'Backend': { recommended: 'kimi-k2.5', alternatives: ['deepseek-v3'] },
      'Frontend': { recommended: 'kimi-k2.5', alternatives: ['claude-sonnet'] },
      'Security': { recommended: 'kimi-k2.5', alternatives: ['claude-opus'] },
      'DevOps': { recommended: 'deepseek-v3', alternatives: ['kimi-k2.5'] },
      'QA': { recommended: 'kimi-k2.5', alternatives: ['deepseek-v3'] },
      'AI/ML': { recommended: 'kimi-k2.5', alternatives: ['claude-opus'] },
      'Data Engineering': { recommended: 'deepseek-v3', alternatives: ['kimi-k2.5'] },
      'Retrieval': { recommended: 'kimi-k2.5', alternatives: ['claude-sonnet'] },
      'Product Management': { recommended: 'claude-sonnet', alternatives: ['claude-opus'] },
      'Enterprise Architecture': { recommended: 'claude-opus', alternatives: ['kimi-k2.5'] },
      'Platform Architecture': { recommended: 'claude-opus', alternatives: ['kimi-k2.5'] },
      'Data Architecture': { recommended: 'claude-opus', alternatives: ['deepseek-v3'] },
      'Technology Architecture': { recommended: 'claude-opus', alternatives: ['deepseek-v3'] },
    };
    const rec = MODEL_MAP[specialization || ''] || { recommended: 'claude-sonnet', alternatives: ['kimi-k2.5'] };
    return c.json({ data: rec });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/fleet/agents/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.select().from(agents).where(
      or(eq(agents.id, id), eq(agents.agentId, id))
    );
    if (result.length === 0) return c.json({ error: 'Agent not found' }, 404);
    return c.json({ data: result[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/fleet/agents
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      agentId: z.string().min(1),
      name: z.string().min(1),
      role: z.string().min(1),
      persona: z.string().optional(),
      teamId: z.string().optional(),
      specialization: z.string().optional(),
      model: z.string().optional(),
      capabilities: z.string().optional(),
      parentAgentId: z.string().optional(),
      avatarUrl: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

    // Check uniqueness
    const existingId = await db.select().from(agents).where(eq(agents.agentId, parsed.data.agentId));
    if (existingId.length > 0) return c.json({ error: 'agentId already exists' }, 400);
    const existingName = await db.select().from(agents).where(eq(agents.name, parsed.data.name));
    if (existingName.length > 0) return c.json({ error: 'name already exists' }, 400);

    const now = Date.now();
    const newAgent = { id: uuid(), ...parsed.data, status: 'offline' as const, createdAt: now, updatedAt: now };
    await db.insert(agents).values(newAgent);
    return c.json({ data: newAgent }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/agents/:id
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);

    await db.update(agents).set({ ...body, updatedAt: Date.now() }).where(eq(agents.id, existing[0]!.id));
    const updated = await db.select().from(agents).where(eq(agents.id, existing[0]!.id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/agents/:id/disable
app.patch('/:id/disable', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);

    const activeTasks = await db.select().from(tasks).where(
      and(eq(tasks.assignedAgentId, existing[0]!.id), inArray(tasks.status, ['pending', 'in_progress', 'delegated']))
    );

    await db.update(agents).set({ status: 'disabled', updatedAt: Date.now() }).where(eq(agents.id, existing[0]!.id));
    return c.json({ data: { id: existing[0]!.id, status: 'disabled', activeTasksCount: activeTasks.length } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/agents/:id/enable
app.patch('/:id/enable', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);

    await db.update(agents).set({ status: 'online', updatedAt: Date.now() }).where(eq(agents.id, existing[0]!.id));
    const updated = await db.select().from(agents).where(eq(agents.id, existing[0]!.id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/fleet/agents/:id
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);
    const agentRecord = existing[0]!;

    // Re-parent children to this agent's parent
    const children = await db.select().from(agents).where(eq(agents.parentAgentId, agentRecord.id));
    for (const child of children) {
      await db.update(agents).set({ parentAgentId: agentRecord.parentAgentId, updatedAt: Date.now() }).where(eq(agents.id, child.id));
    }

    // Unassign from tasks
    await db.update(tasks).set({ assignedAgentId: null, updatedAt: Date.now() }).where(eq(tasks.assignedAgentId, agentRecord.id));

    await db.delete(agents).where(eq(agents.id, agentRecord.id));
    return c.json({ data: { id: agentRecord.id, deleted: true, childrenReparented: children.length } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PATCH /api/fleet/agents/:id/remove-from-team
app.patch('/:id/remove-from-team', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);
    await db.update(agents).set({ teamId: null, updatedAt: Date.now() }).where(eq(agents.id, existing[0]!.id));
    const updated = await db.select().from(agents).where(eq(agents.id, existing[0]!.id));
    return c.json({ data: updated[0] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/fleet/agents/:id/tasks
app.get('/:id/tasks', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);

    const result = await db.select().from(tasks).where(
      or(eq(tasks.assignedAgentId, existing[0]!.id), eq(tasks.createdByAgentId, existing[0]!.id))
    );
    return c.json({ data: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
