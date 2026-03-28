import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { structuredLogger } from './middleware/logger';
import { errorHandler } from './middleware/error-handler';
import { healthApi } from './modules/health/health.api';
import { authApi } from './modules/auth/auth.api';
import { itemsApi } from './modules/items/items.api';
import { env } from './config/env';

export function createApp() {
  const app = new Hono();

  if (process.env.NODE_ENV === 'production' && env.CORS_ORIGIN === '*') {
    console.warn(
      '[WARN] CORS_ORIGIN is set to wildcard "*" in production. ' +
      'Set CORS_ORIGIN to your frontend domain to restrict cross-origin access.',
    );
  }

  // Global middleware
  app.use('*', structuredLogger);
  app.use('*', cors({ origin: env.CORS_ORIGIN }));
  app.use('*', errorHandler);

  // Root route — silences 404s from Render health checks and browser pre-requests
  app.get('/', (c) => c.redirect('/api/health', 301));

  // Routes
  app.route('/api/health', healthApi);
  app.route('/api/auth', authApi);
  app.route('/api/items', itemsApi);

  return app;
}
