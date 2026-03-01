/**
 * Atlas Fleet Console — Production Server
 * Serves the Vite production build and proxies /api/* to the backend.
 * Usage: tsx src/server/production.ts
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createServer, request as httpRequest } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';

const BACKEND_PORT = 3590;
const FRONTEND_PORT = 3000;
const DIST_DIR = join(import.meta.dirname, '../../dist/client');

const app = new Hono();

// Proxy /api/* to backend
app.all('/api/*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname + url.search;

  try {
    const backendRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}${path}`, {
      method: c.req.method,
      headers: Object.fromEntries(
        Object.entries(c.req.header()).filter(([k]) => !['host'].includes(k))
      ),
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.arrayBuffer(),
    });

    const headers: Record<string, string> = {};
    backendRes.headers.forEach((v, k) => { headers[k] = v; });

    return new Response(backendRes.body, {
      status: backendRes.status,
      headers,
    });
  } catch {
    return c.json({ error: 'Backend unavailable' }, 502);
  }
});

// Serve static assets from dist/client
app.use('/*', serveStatic({ root: './dist/client' }));

// SPA fallback — serve index.html for all unmatched routes
app.get('*', (c) => {
  const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8');
  return c.html(html);
});

console.log(`🚀 Fleet Console production server on http://0.0.0.0:${FRONTEND_PORT}`);
serve({ fetch: app.fetch, port: FRONTEND_PORT, hostname: '0.0.0.0' });
