import { type Result, type AppError, type AuthResponse, ok, err, notFoundError } from '@repo/shared';
import type { AuthRepository } from '../infrastructure/auth.repository';

export type UserResponse = AuthResponse['user'];

export type GetMe = (userId: string) => Promise<Result<UserResponse, AppError>>;

export function createGetMe(repository: AuthRepository): GetMe {
  return async (userId) => {
    const user = await repository.findById(userId);
    if (!user) {
      return err(notFoundError('User not found'));
    }
    return ok(user.toResponse());
  };
}
