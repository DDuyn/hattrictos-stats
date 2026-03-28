import { Hono } from 'hono';
import { loginInputSchema, registerInputSchema, changePasswordInputSchema, type JwtPayload } from '@hattrictos-stats/shared';
import { db } from '../../infrastructure/db/client';
import { env } from '../../config/env';
import { jwtGuard, ownerOrCoOwnerGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import { createRateLimit } from '../../middleware/rate-limit';
import type { LoggerEnv } from '../../middleware/logger';
import { createAuthRepository } from './infrastructure/auth.repository';
import { createRegister } from './use-cases/register';
import { createLogin } from './use-cases/login';
import { createGetMe } from './use-cases/get-me';
import { createRefreshToken } from './use-cases/refresh-token';
import { createChangePassword } from './use-cases/change-password';

type Env = { Variables: { jwtPayload: JwtPayload } } & LoggerEnv;

const auth = new Hono<Env>();

const repository = createAuthRepository(db);
const register = createRegister(repository, env.JWT_SECRET, env.JWT_EXPIRES_IN);
const login = createLogin(repository, env.JWT_SECRET, env.JWT_EXPIRES_IN);
const getMe = createGetMe(repository);
const refreshToken = createRefreshToken(repository, env.JWT_SECRET, env.JWT_EXPIRES_IN);
const changePassword = createChangePassword(repository);

const authRateLimit = createRateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
});

/**
 * POST /api/auth/register
 *
 * When REGISTRATION_ENABLED=false (default), registration is closed and requires
 * an authenticated owner or co_owner to create new users.
 * When REGISTRATION_ENABLED=true, registration is open to anyone (rate-limited).
 */
auth.post('/register', authRateLimit, async (c, next) => {
  if (!env.REGISTRATION_ENABLED) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ownerOrCoOwnerGuard(c as any, next);
  }
  await next();
}, async (c) => {
  const body = await c.req.json();
  const parsed = registerInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const result = await register(parsed.data, c.var.log);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value, 201);
});

auth.post('/login', authRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const result = await login(parsed.data, c.var.log);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value);
});

auth.get('/me', jwtGuard, async (c) => {
  const { userId } = c.get('jwtPayload');
  const result = await getMe(userId);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value);
});

auth.post('/refresh', jwtGuard, async (c) => {
  const { userId } = c.get('jwtPayload');
  const result = await refreshToken(userId);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.json(result.value);
});

auth.post('/change-password', jwtGuard, async (c) => {
  const body = await c.req.json();
  const parsed = changePasswordInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      400,
    );
  }

  const { userId } = c.get('jwtPayload');
  const result = await changePassword(userId, parsed.data);
  if (!result.ok) {
    return c.json(result.error, errorToStatus(result.error.code));
  }
  return c.body(null, 204);
});

export { auth as authApi };
