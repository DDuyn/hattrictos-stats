import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { JwtPayload } from '@hattrictos-stats/shared';
import { env } from '../config/env';

type JwtEnv = {
  Variables: {
    jwtPayload: JwtPayload;
  };
};

async function extractAndVerifyJwt(authHeader: string | undefined): Promise<JwtPayload | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256');
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export const jwtGuard = createMiddleware<JwtEnv>(async (c, next) => {
  const payload = await extractAndVerifyJwt(c.req.header('Authorization'));
  if (!payload) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }
  c.set('jwtPayload', payload);
  await next();
});

/** Only `owner` */
export const ownerGuard = createMiddleware<JwtEnv>(async (c, next) => {
  const payload = await extractAndVerifyJwt(c.req.header('Authorization'));
  if (!payload) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }
  if (payload.role !== 'owner') {
    return c.json({ code: 'FORBIDDEN', message: 'Insufficient permissions' }, 403);
  }
  c.set('jwtPayload', payload);
  await next();
});

/** `owner` or `co_owner` */
export const ownerOrCoOwnerGuard = createMiddleware<JwtEnv>(async (c, next) => {
  const payload = await extractAndVerifyJwt(c.req.header('Authorization'));
  if (!payload) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }
  if (payload.role !== 'owner' && payload.role !== 'co_owner') {
    return c.json({ code: 'FORBIDDEN', message: 'Insufficient permissions' }, 403);
  }
  c.set('jwtPayload', payload);
  await next();
});

/** `owner`, `co_owner`, or `admin` */
export const staffGuard = createMiddleware<JwtEnv>(async (c, next) => {
  const payload = await extractAndVerifyJwt(c.req.header('Authorization'));
  if (!payload) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }
  if (payload.role !== 'owner' && payload.role !== 'co_owner' && payload.role !== 'admin') {
    return c.json({ code: 'FORBIDDEN', message: 'Insufficient permissions' }, 403);
  }
  c.set('jwtPayload', payload);
  await next();
});
