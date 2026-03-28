import { sign } from 'hono/jwt';
import {
  type Result,
  type AppError,
  type AuthResponse,
  type LoginInput,
  ok,
  err,
  unauthorizedError,
} from '@repo/shared';
import type { RequestLogger } from '../../../middleware/logger';
import type { AuthRepository } from '../infrastructure/auth.repository';
import { parseDurationToSeconds } from '../../../lib/duration';

export type Login = (
  input: LoginInput,
  log?: RequestLogger,
) => Promise<Result<AuthResponse, AppError>>;

export function createLogin(
  repository: AuthRepository,
  jwtSecret: string,
  expiresIn = '7d',
): Login {
  return async (input, log) => {
    const user = await repository.findByEmail(input.email);
    if (!user) {
      log?.warn('login_failed', { reason: 'email_not_found' });
      return err(unauthorizedError('Invalid email or password'));
    }

    const valid = await Bun.password.verify(input.password, user.passwordHash);
    if (!valid) {
      log?.warn('login_failed', { reason: 'wrong_password', userId: user.id });
      return err(unauthorizedError('Invalid email or password'));
    }

    const exp = Math.floor(Date.now() / 1000) + parseDurationToSeconds(expiresIn);
    const token = await sign({ userId: user.id, email: user.email, exp }, jwtSecret);

    log?.info('user_logged_in', { userId: user.id, email: user.email });

    return ok({ token, user: user.toResponse() });
  };
}
