import { Hono } from 'hono';
import { createUserInputSchema, updateUserInputSchema, type JwtPayload } from '@hattrictos-stats/shared';
import { db } from '../../infrastructure/db/client';
import { env } from '../../config/env';
import { ownerGuard, ownerOrCoOwnerGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import { createRateLimit } from '../../middleware/rate-limit';
import type { LoggerEnv } from '../../middleware/logger';
import { createChppClient } from '../../infrastructure/chpp/chpp-client';
import { createChppEncryption } from '../../infrastructure/chpp/chpp-encryption';
import { createChppTokenRepository } from './infrastructure/chpp-token.repository';
import { createStartOAuth } from './use-cases/start-oauth';
import { createHandleOAuthCallback } from './use-cases/handle-oauth-callback';
import { createVerifyConnection } from './use-cases/verify-connection';
import {
  createFetchMatchDetails,
  createFetchTournamentDetails,
  createFetchTournamentFixtures,
  createFetchTournamentLeagueTable,
  createFetchRaw,
} from './use-cases/explore-chpp';
import { createAuthRepository } from '../auth/infrastructure/auth.repository';
import { createCreateUser } from '../auth/use-cases/create-user';
import { createListUsers } from '../auth/use-cases/list-users';
import { createUpdateUser } from '../auth/use-cases/update-user';

type Env = { Variables: { jwtPayload: JwtPayload } } & LoggerEnv;

const admin = new Hono<Env>();

// ─── Dependency setup ─────────────────────────────────────────────────────────

function getChppConfig() {
  if (!env.CHPP_CONSUMER_KEY || !env.CHPP_CONSUMER_SECRET) {
    throw new Error(
      'CHPP_CONSUMER_KEY and CHPP_CONSUMER_SECRET must be set to use CHPP endpoints.',
    );
  }
  return { consumerKey: env.CHPP_CONSUMER_KEY, consumerSecret: env.CHPP_CONSUMER_SECRET };
}

function getEncryption() {
  if (!env.CHPP_ENCRYPTION_KEY) {
    throw new Error(
      'CHPP_ENCRYPTION_KEY must be set to store CHPP tokens. ' +
        'Generate one with: openssl rand -hex 32',
    );
  }
  return createChppEncryption(env.CHPP_ENCRYPTION_KEY);
}

// Rate limit for the connect endpoint — prevent spam (5 attempts per 15 min per IP)
const connectRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

// ─── User management ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 *
 * Returns a list of all registered users.
 * Only owner or co_owner may call this endpoint.
 */
admin.get('/users', ownerOrCoOwnerGuard, async (c) => {
  const repository = createAuthRepository(db);
  const listUsers = createListUsers(repository);
  const result = await listUsers();
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value);
});

/**
 * POST /api/admin/users
 *
 * Creates a new user with a server-generated password.
 * Only owner or co_owner may call this endpoint.
 * Returns the user data plus the generated plain-text password.
 */
admin.post('/users', ownerOrCoOwnerGuard, async (c) => {
  const body = await c.req.json();
  const parsed = createUserInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const repository = createAuthRepository(db);
  const createUser = createCreateUser(repository);

  const result = await createUser(parsed.data, c.var.log);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value, 201);
});

/**
 * PATCH /api/admin/users/:id
 *
 * Updates a user's role and/or htTeamId.
 * Only owner or co_owner may call this endpoint.
 */
admin.patch('/users/:id', ownerOrCoOwnerGuard, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateUserInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const repository = createAuthRepository(db);
  const updateUser = createUpdateUser(repository);

  const result = await updateUser(id, parsed.data);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value);
});

// ─── CHPP routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/chpp/connect
 *
 * Initiates the CHPP OAuth 1.0a flow. Requires owner or co_owner JWT.
 *
 * Returns a redirect URL to Hattrick's authorization page.
 * The admin must open that URL in their browser to authorize the app.
 */
admin.get('/chpp/connect', ownerOrCoOwnerGuard, connectRateLimit, async (c) => {
  const log = c.var.log;

  let chppConfig: { consumerKey: string; consumerSecret: string };
  try {
    chppConfig = getChppConfig();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const chppClient = createChppClient(chppConfig);
  const startOAuth = createStartOAuth(chppClient);

  const result = await startOAuth(env.APP_URL);
  if (!result.ok) {
    log?.error('chpp_connect_failed', { error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_oauth_started', { redirectUrl: result.value.authorizeUrl });
  return c.json({ authorizeUrl: result.value.authorizeUrl });
});

/**
 * GET /api/admin/chpp/callback?oauth_token=...&oauth_verifier=...&state=...
 *
 * OAuth callback — Hattrick redirects here after the admin authorizes the app.
 * No JWT required (the redirect comes from Hattrick's servers, not the admin's client).
 * CSRF is prevented via the `state` parameter validated against our in-memory store.
 *
 * On success: stores the encrypted access token in the database.
 */
admin.get('/chpp/callback', async (c) => {
  const log = c.var.log;

  const state = c.req.query('state');
  const oauthToken = c.req.query('oauth_token');
  const oauthVerifier = c.req.query('oauth_verifier');

  if (!state || !oauthToken || !oauthVerifier) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'Missing required OAuth callback parameters: state, oauth_token, oauth_verifier.',
      },
      400,
    );
  }

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const chppClient = createChppClient(chppConfig);
  const tokenRepository = createChppTokenRepository(db, encryption);
  const handleCallback = createHandleOAuthCallback(chppClient, tokenRepository);

  const result = await handleCallback({ state, oauthToken, oauthVerifier });
  if (!result.ok) {
    log?.warn('chpp_callback_failed', { error: result.error, state });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_connected', {
    htLoginName: result.value.htLoginName,
    htUserId: result.value.htUserId,
  });

  return c.json({
    message: 'CHPP connection established successfully.',
    htLoginName: result.value.htLoginName,
    htUserId: result.value.htUserId,
  });
});

/**
 * GET /api/admin/chpp/verify
 *
 * Verifies the stored CHPP token is valid by calling teamdetails.
 * Requires owner or co_owner JWT.
 *
 * Returns the team name and Hattrick user associated with the token.
 */
admin.get('/chpp/verify', ownerOrCoOwnerGuard, async (c) => {
  const log = c.var.log;

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const verifyConnection = createVerifyConnection(chppConfig, tokenRepository);

  const result = await verifyConnection();
  if (!result.ok) {
    log?.warn('chpp_verify_failed', { error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_verified', { teamName: result.value.teamName, htLoginName: result.value.htLoginName });
  return c.json(result.value);
});

/**
 * GET /api/admin/chpp/match/:matchId
 *
 * Returns the raw CHPP response for a match as JSON (matchdetails + events).
 * Exploration endpoint — no data is persisted.
 * Requires owner or co_owner JWT.
 */
admin.get('/chpp/match/:matchId', ownerGuard, async (c) => {
  const log = c.var.log;
  const matchId = Number(c.req.param('matchId'));

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'matchId must be a positive integer.' }, 400);
  }

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const fetchMatchDetails = createFetchMatchDetails(chppConfig, tokenRepository);

  const result = await fetchMatchDetails(matchId);
  if (!result.ok) {
    log?.warn('chpp_match_fetch_failed', { matchId, error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_match_fetched', { matchId });
  return c.json({ data: result.value });
});

/**
 * GET /api/admin/chpp/tournament/:tournamentId/fixtures
 *
 * Returns the full fixture calendar (all rounds + results) for a tournament.
 * Exploration endpoint — no data is persisted.
 * Requires owner or co_owner JWT.
 *
 * NOTE: must be registered before /:tournamentId to avoid Hono capturing
 * "98765/fixtures" as the tournamentId param.
 */
admin.get('/chpp/tournament/:tournamentId/fixtures', ownerGuard, async (c) => {
  const log = c.var.log;
  const tournamentId = Number(c.req.param('tournamentId'));

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'tournamentId must be a positive integer.' }, 400);
  }

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const fetchFixtures = createFetchTournamentFixtures(chppConfig, tokenRepository);

  const result = await fetchFixtures(tournamentId);
  if (!result.ok) {
    log?.warn('chpp_tournament_fixtures_failed', { tournamentId, error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_tournament_fixtures_fetched', { tournamentId });
  return c.json({ data: result.value });
});

/**
 * GET /api/admin/chpp/tournament/:tournamentId/table
 *
 * Returns the league standings table for a tournament (tournamentleaguetables).
 * Available for the current season and up to 2 seasons after the tournament finished.
 * Exploration endpoint — no data is persisted.
 * Requires owner or co_owner JWT.
 *
 * NOTE: must be registered before /:tournamentId to avoid Hono capturing
 * "98765/table" as the tournamentId param.
 */
admin.get('/chpp/tournament/:tournamentId/table', ownerGuard, async (c) => {
  const log = c.var.log;
  const tournamentId = Number(c.req.param('tournamentId'));

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'tournamentId must be a positive integer.' }, 400);
  }

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const fetchTable = createFetchTournamentLeagueTable(chppConfig, tokenRepository);

  const result = await fetchTable(tournamentId);
  if (!result.ok) {
    log?.warn('chpp_tournament_table_failed', { tournamentId, error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_tournament_table_fetched', { tournamentId });
  return c.json({ data: result.value });
});

/**
 * GET /api/admin/chpp/tournament/:tournamentId
 *
 * Returns the raw CHPP response for a tournament as JSON (tournamentdetails).
 * Exploration endpoint — no data is persisted.
 * Requires owner or co_owner JWT.
 */
admin.get('/chpp/tournament/:tournamentId', ownerGuard, async (c) => {
  const log = c.var.log;
  const tournamentId = Number(c.req.param('tournamentId'));

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'tournamentId must be a positive integer.' }, 400);
  }

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const fetchTournamentDetails = createFetchTournamentDetails(chppConfig, tokenRepository);

  const result = await fetchTournamentDetails(tournamentId);
  if (!result.ok) {
    log?.warn('chpp_tournament_fetch_failed', { tournamentId, error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_tournament_fetched', { tournamentId });
  return c.json({ data: result.value });
});

/**
 * POST /api/admin/chpp/raw
 *
 * Calls any CHPP endpoint with arbitrary parameters.
 * Useful for exploring undocumented endpoints (e.g. tournamentmatchdetails).
 * Exploration endpoint — no data is persisted.
 * Requires owner or co_owner JWT.
 *
 * Body: { file: string, params: Record<string, string | number | boolean> }
 */
admin.post('/chpp/raw', ownerGuard, async (c) => {
  const log = c.var.log;
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.file !== 'string' || !body.file.trim()) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Body must include a non-empty "file" string.' },
      400,
    );
  }

  const file = body.file.trim();
  const params: Record<string, string | number | boolean> =
    body.params && typeof body.params === 'object' && !Array.isArray(body.params)
      ? (body.params as Record<string, string | number | boolean>)
      : {};

  let chppConfig: { consumerKey: string; consumerSecret: string };
  let encryption: ReturnType<typeof createChppEncryption>;
  try {
    chppConfig = getChppConfig();
    encryption = getEncryption();
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: (e as Error).message }, 500);
  }

  const tokenRepository = createChppTokenRepository(db, encryption);
  const fetchRaw = createFetchRaw(chppConfig, tokenRepository);

  const result = await fetchRaw(file, params);
  if (!result.ok) {
    log?.warn('chpp_raw_fetch_failed', { file, params, error: result.error });
    return c.json(result.error, errorToStatus(result.error.code));
  }

  log?.info('chpp_raw_fetched', { file, params });
  return c.json({ data: result.value });
});

export { admin as adminApi };
