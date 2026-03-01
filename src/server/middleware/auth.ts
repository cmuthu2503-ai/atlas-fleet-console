import { createMiddleware } from 'hono/factory';

// Placeholder auth middleware - passes through for now
export const auth = createMiddleware(async (c, next) => {
  await next();
});
