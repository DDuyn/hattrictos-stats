import {
  type Result,
  type AppError,
  type CreateUserInput,
  type CreateUserResponse,
  ok,
  err,
  conflictError,
} from '@hattrictos-stats/shared';
import type { RequestLogger } from '../../../middleware/logger';
import { User } from '../domain/user';
import type { AuthRepository } from '../infrastructure/auth.repository';

export type CreateUser = (
  input: CreateUserInput,
  log?: RequestLogger,
) => Promise<Result<CreateUserResponse, AppError>>;

/** Generates a random password: 3 words from a short adjective+noun pool + 4 digits */
function generatePassword(): string {
  const words = [
    'amber', 'blue', 'cedar', 'delta', 'echo', 'frost', 'grove', 'haze',
    'iris', 'jade', 'kite', 'lime', 'mist', 'nova', 'opal', 'pine',
    'quest', 'reef', 'sage', 'tide', 'umbra', 'vine', 'wave', 'xylo',
    'yew', 'zinc',
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${pick()}-${pick()}-${digits}`;
}

export function createCreateUser(repository: AuthRepository): CreateUser {
  return async (input, log) => {
    const existing = await repository.findByEmail(input.email);
    if (existing) {
      log?.warn('create_user_conflict', { email: input.email });
      return err(conflictError('A user with this email already exists'));
    }

    const generatedPassword = generatePassword();
    const passwordHash = await Bun.password.hash(generatedPassword);
    const id = crypto.randomUUID();

    // Use email local-part as display name
    const name = input.email.split('@')[0];

    const result = User.create({
      id,
      email: input.email,
      name,
      passwordHash,
      role: input.role ?? null,
      createdAt: new Date(),
    });

    if (!result.ok) return result;

    const user = result.value;
    await repository.create(user);

    log?.info('user_created_by_admin', { userId: user.id, email: user.email, role: user.role });

    return ok({ user: user.toResponse(), generatedPassword });
  };
}
