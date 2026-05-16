import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { structuredLogger } from './middleware/logger';
import { errorHandler } from './middleware/error-handler';
import { healthApi } from './modules/health/health.api';
import { authApi } from './modules/auth/auth.api';
import { adminApi } from './modules/admin/admin.api';
import { tournamentsApi } from './modules/tournaments/tournaments.api';
import { teamsApi } from './modules/teams/teams.api';
import { playersApi } from './modules/players/players.api';
import { announcementsApi } from './modules/announcements/announcements.api';
import { pressNotesApi } from './modules/press-notes/press-notes.api';
import { homeApi } from './modules/home/home.api';
import { contactApi } from './modules/contact/contact.api';
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

  // Static files — logos de equipos y avatares de jugadores subidos manualmente
  app.use('/logos/*', serveStatic({ root: './public' }));
  app.use('/avatars/*', serveStatic({ root: './public' }));

  // Root route — silences 404s from Render health checks and browser pre-requests
  app.get('/', (c) => c.redirect('/api/health', 301));

  // Routes
  app.route('/api/health', healthApi);
  app.route('/api/home', homeApi);
  app.route('/api/auth', authApi);
  app.route('/api/admin', adminApi);
  app.route('/api/admin/tournaments', tournamentsApi);
  app.route('/api/tournaments', tournamentsApi);
  app.route('/api/teams', teamsApi);
  app.route('/api/players', playersApi);
  app.route('/api/announcements', announcementsApi);
  // Press notes are nested under teams: /api/teams/:htTeamId/press-notes
  app.route('/api/teams/:htTeamId/press-notes', pressNotesApi);
  app.route('/api/contact', contactApi);

  return app;
}
