import { sign } from 'hono/jwt';
import {
  type Result,
  type AppError,
  type AuthResponse,
  type RegisterInput,
  ok,
  err,
  conflictError,
} from '@repo/shared';
import type { RequestLogger } from '../../../middleware/logger';
import { User } from '../domain/user';
import type { AuthRepository } from '../infrastructure/auth.repository';
import { parseDurationToSeconds } from '../../../lib/duration';

export type Register = (
  input: RegisterInput,
  log?: RequestLogger,
) => Promise<Result<AuthResponse, AppError>>;

export function createRegister(
  repository: AuthRepository,
  jwtSecret: string,
  expiresIn = '7d',
): Register {
  return async (input, log) => {
    const existing = await repository.findByEmail(input.email);
    if (existing) {
      log?.warn('register_conflict', { email: input.email });
      return err(conflictError('A user with this email already exists'));
    }

    const passwordHash = await Bun.password.hash(input.password);
    const id = crypto.randomUUID();

    const result = User.create({
      id,
      email: input.email,
      name: input.name,
      passwordHash,
      createdAt: new Date(),
    });

    if (!result.ok) return result;

    const user = result.value;
    await repository.create(user);

    const exp = Math.floor(Date.now() / 1000) + parseDurationToSeconds(expiresIn);
    const token = await sign({ userId: user.id, email: user.email, exp }, jwtSecret);

    log?.info('user_registered', { userId: user.id, email: user.email });

    return ok({ token, user: user.toResponse() });
  };
}
