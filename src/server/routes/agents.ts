import { Hono } from 'hono';
import { db } from '../db/client.js';
import { agents, tasks, delegationSteps, userStories, bugs, storyHistory } from '../db/schema.js';
import { eq, and, or, inArray } from 'drizzle-orm';
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

type UsageContribution = {
  at: number;
  input: number;
  output: number;
};

function normalizeModel(model?: string | null) {
  return (model || '').toLowerCase();
}

function getModelRates(model?: string | null) {
  const normalized = normalizeModel(model);

  if (normalized.includes('opus')) return { input: 15, output: 75 };
  if (normalized.includes('sonnet')) return { input: 3, output: 15 };
  if (normalized.includes('haiku')) return { input: 0.8, output: 4 };
  if (normalized.includes('nova')) return { input: 0.8, output: 3 };
  if (normalized.includes('kimi')) return { input: 1, output: 5 };
  if (normalized.includes('deepseek')) return { input: 0.5, output: 2 };
  if (normalized.includes('mistral') || normalized.includes('devstral')) return { input: 0.4, output: 1.5 };
  if (normalized.includes('llama')) return { input: 0.35, output: 1.2 };
  return { input: 1.5, output: 7 };
}

function pushContribution(contributions: UsageContribution[], at: number | null | undefined, input: number, output: number) {
  if (!at) return;
  contributions.push({ at, input, output });
}

function sumUsage(contributions: UsageContribution[]) {
  return contributions.reduce((acc, contribution) => {
    acc.input += contribution.input;
    acc.output += contribution.output;
    return acc;
  }, { input: 0, output: 0 });
}

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

// GET /api/fleet/agents/:id/usage
app.get('/:id/usage', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await db.select().from(agents).where(or(eq(agents.id, id), eq(agents.agentId, id)));
    if (existing.length === 0) return c.json({ error: 'Agent not found' }, 404);
    const agent = existing[0]!;
    const [agentTasks, agentDelegations, assignedStories, relatedBugs, historyEntries] = await Promise.all([
      db.select().from(tasks).where(
        or(eq(tasks.assignedAgentId, agent.id), eq(tasks.createdByAgentId, agent.id))
      ),
      db.select().from(delegationSteps).where(
        or(eq(delegationSteps.fromAgentId, agent.id), eq(delegationSteps.toAgentId, agent.id))
      ),
      db.select().from(userStories).where(eq(userStories.assignedTo, agent.id)),
      db.select().from(bugs).where(
        or(eq(bugs.foundBy, agent.id), eq(bugs.assignedTo, agent.id))
      ),
      db.select().from(storyHistory),
    ]);

    const contributions: UsageContribution[] = [];
    const completedTasks = agentTasks.filter(task => task.status === 'completed').length;
    const totalTasks = agentTasks.length;
    const normalizedAgentNames = new Set([agent.name.toLowerCase(), agent.agentId.toLowerCase()]);

    for (const task of agentTasks) {
      if (task.createdByAgentId === agent.id) {
        pushContribution(contributions, task.createdAt, 180, 40);
      }

      if (task.assignedAgentId === agent.id) {
        const taskStatusWeights: Record<string, { input: number; output: number }> = {
          pending: { input: 220, output: 60 },
          delegated: { input: 260, output: 90 },
          in_progress: { input: 600, output: 180 },
          completed: { input: 820, output: 260 },
          failed: { input: 520, output: 140 },
        };
        const weights = taskStatusWeights[task.status] ?? { input: 260, output: 80 };
        pushContribution(contributions, task.updatedAt ?? task.createdAt, weights.input, weights.output);

        if (task.completedAt) {
          pushContribution(contributions, task.completedAt, 260, 320);
        }
      }
    }

    for (const step of agentDelegations) {
      const fromAgentWeights: Record<string, { input: number; output: number }> = {
        assign: { input: 160, output: 45 },
        delegate: { input: 170, output: 55 },
        review: { input: 120, output: 55 },
        approve: { input: 110, output: 60 },
        reject: { input: 140, output: 50 },
        complete: { input: 90, output: 80 },
      };
      const toAgentWeights: Record<string, { input: number; output: number }> = {
        assign: { input: 220, output: 60 },
        delegate: { input: 230, output: 70 },
        review: { input: 150, output: 60 },
        approve: { input: 120, output: 50 },
        reject: { input: 130, output: 40 },
        complete: { input: 80, output: 70 },
      };

      if (step.fromAgentId === agent.id) {
        const weights = fromAgentWeights[step.action] ?? { input: 120, output: 45 };
        pushContribution(contributions, step.createdAt, weights.input, weights.output);
        if (step.completedAt) {
          pushContribution(contributions, step.completedAt, Math.round(weights.input * 0.35), Math.round(weights.output * 1.2));
        }
      }

      if (step.toAgentId === agent.id) {
        const weights = toAgentWeights[step.action] ?? { input: 140, output: 55 };
        pushContribution(contributions, step.createdAt, weights.input, weights.output);
        if (step.completedAt) {
          pushContribution(contributions, step.completedAt, Math.round(weights.input * 0.3), Math.round(weights.output * 1.1));
        }
      }
    }

    for (const story of assignedStories) {
      const storyStatusWeights: Record<string, { input: number; output: number }> = {
        backlog: { input: 120, output: 30 },
        created: { input: 160, output: 50 },
        in_progress: { input: 420, output: 120 },
        code_review: { input: 220, output: 90 },
        qa_testing: { input: 200, output: 80 },
        bug_fix: { input: 260, output: 120 },
        ready_to_deploy: { input: 160, output: 60 },
        done: { input: 280, output: 140 },
      };
      const weights = storyStatusWeights[story.status] ?? { input: 180, output: 60 };
      const bugPenalty = Math.max(0, story.bugLoopCount) * 45;

      pushContribution(contributions, story.updatedAt ?? story.createdAt, weights.input + bugPenalty, weights.output + Math.round(bugPenalty * 0.6));

      if (story.completedAt) {
        pushContribution(contributions, story.completedAt, 120, 180);
      }
    }

    for (const bug of relatedBugs) {
      if (bug.foundBy === agent.id) {
        pushContribution(contributions, bug.createdAt, 90, 20);
      }
      if (bug.assignedTo === agent.id) {
        pushContribution(contributions, bug.createdAt, 140, 40);
        if (bug.resolvedAt) {
          pushContribution(contributions, bug.resolvedAt, 80, 120);
        }
      }
    }

    for (const entry of historyEntries) {
      if (!entry.changedBy) continue;
      if (!normalizedAgentNames.has(entry.changedBy.toLowerCase())) continue;

      pushContribution(
        contributions,
        entry.changedAt,
        100,
        entry.toStatus === 'done' ? 110 : entry.toStatus === 'bug_fix' ? 75 : 35,
      );
    }

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const allTimeUsage = sumUsage(contributions);
    const usage24h = sumUsage(contributions.filter(contribution => contribution.at >= dayAgo));
    const usage7d = sumUsage(contributions.filter(contribution => contribution.at >= weekAgo));
    const inputTokens = allTimeUsage.input;
    const outputTokens = allTimeUsage.output;
    const totalTokens = inputTokens + outputTokens;
    const tokens24h = usage24h.input + usage24h.output;
    const tokens7d = usage7d.input + usage7d.output;
    const tokensAllTime = totalTokens;

    const rate = getModelRates(agent.model);
    const cost = ((inputTokens / 1_000_000) * rate.input) + ((outputTokens / 1_000_000) * rate.output);
    const hasActivity = contributions.length > 0;

    return c.json({
      data: {
        agentId: agent.agentId,
        inputTokens,
        outputTokens,
        totalTokens,
        tokens24h,
        tokens7d,
        tokensAllTime,
        cost: Math.round(cost * 10000) / 10000,
        taskCount: totalTasks,
        completedTaskCount: completedTasks,
        activityEventCount: contributions.length,
        hasActivity,
        estimatedInputCostPer1M: rate.input,
        estimatedOutputCostPer1M: rate.output,
        source: 'local-operational-rollup',
      }
    });
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
