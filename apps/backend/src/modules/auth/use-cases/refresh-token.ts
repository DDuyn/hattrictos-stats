import { sign } from 'hono/jwt';
import {
  type Result,
  type AppError,
  type AuthResponse,
  ok,
  err,
  unauthorizedError,
} from '@repo/shared';
import type { AuthRepository } from '../infrastructure/auth.repository';
import { parseDurationToSeconds } from '../../../lib/duration';

export type RefreshToken = (userId: string) => Promise<Result<AuthResponse, AppError>>;

export function createRefreshToken(
  repository: AuthRepository,
  jwtSecret: string,
  expiresIn = '7d',
): RefreshToken {
  return async (userId) => {
    const user = await repository.findById(userId);
    if (!user) {
      return err(unauthorizedError('User not found'));
    }

    const exp = Math.floor(Date.now() / 1000) + parseDurationToSeconds(expiresIn);
    const token = await sign({ userId: user.id, email: user.email, exp }, jwtSecret);

    return ok({ token, user: user.toResponse() });
  };
}
