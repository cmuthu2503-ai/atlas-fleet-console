import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import agentRoutes from './routes/agents.js';
import teamRoutes from './routes/teams.js';
import taskRoutes from './routes/tasks.js';
import delegationRoutes from './routes/delegation.js';

const app = new Hono();

app.use('*', cors());

const SPECIALIZATIONS = [
  { name: 'Backend', description: 'Server-side APIs, databases, business logic', recommendedModels: ['kimi-k2.5', 'deepseek-v3'] },
  { name: 'Frontend', description: 'User interfaces, React, CSS, accessibility', recommendedModels: ['kimi-k2.5', 'claude-sonnet'] },
  { name: 'Security', description: 'Security audits, penetration testing, compliance', recommendedModels: ['kimi-k2.5', 'claude-opus'] },
  { name: 'DevOps', description: 'CI/CD, infrastructure, containers, deployment', recommendedModels: ['deepseek-v3', 'kimi-k2.5'] },
  { name: 'QA', description: 'Testing, quality assurance, test automation', recommendedModels: ['kimi-k2.5', 'deepseek-v3'] },
  { name: 'AI/ML', description: 'Machine learning, NLP, model training', recommendedModels: ['kimi-k2.5', 'claude-opus'] },
  { name: 'Data Engineering', description: 'ETL pipelines, data warehousing, analytics', recommendedModels: ['deepseek-v3', 'kimi-k2.5'] },
  { name: 'Retrieval', description: 'Vector search, RAG, embeddings, information retrieval', recommendedModels: ['kimi-k2.5', 'claude-sonnet'] },
  { name: 'Product Management', description: 'Product strategy, user research, roadmapping', recommendedModels: ['claude-sonnet', 'claude-opus'] },
];

// Mount routes
app.route('/api/fleet/agents', agentRoutes);
app.route('/api/fleet/teams', teamRoutes);
app.route('/api/fleet/tasks', taskRoutes);
app.route('/api/fleet', delegationRoutes);

// Specializations endpoint
app.get('/api/fleet/specializations', (c) => {
  return c.json({ data: SPECIALIZATIONS });
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

const port = 3590;
console.log(`🚀 Atlas Fleet Console API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
