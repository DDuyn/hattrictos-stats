import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { JwtPayload } from '@repo/shared';
import { env } from '../config/env';

type JwtEnv = {
  Variables: {
    jwtPayload: JwtPayload;
  };
};

export const jwtGuard = createMiddleware<JwtEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid token' }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256');
    c.set('jwtPayload', payload as unknown as JwtPayload);
    await next();
  } catch {
    return c.json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' }, 401);
  }
});
