import { Hono } from 'hono';
import { createUserInputSchema, type JwtPayload } from '@hattrictos-stats/shared';
import { db } from '../../infrastructure/db/client';
import { env } from '../../config/env';
import { ownerOrCoOwnerGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import { createRateLimit } from '../../middleware/rate-limit';
import type { LoggerEnv } from '../../middleware/logger';
import { createChppClient } from '../../infrastructure/chpp/chpp-client';
import { createChppEncryption } from '../../infrastructure/chpp/chpp-encryption';
import { createChppTokenRepository } from './infrastructure/chpp-token.repository';
import { createStartOAuth } from './use-cases/start-oauth';
import { createHandleOAuthCallback } from './use-cases/handle-oauth-callback';
import { createVerifyConnection } from './use-cases/verify-connection';
import { createAuthRepository } from '../auth/infrastructure/auth.repository';
import { createCreateUser } from '../auth/use-cases/create-user';

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

export { admin as adminApi };
