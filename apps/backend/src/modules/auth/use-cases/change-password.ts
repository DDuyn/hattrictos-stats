import {
  type Result,
  type AppError,
  ok,
  err,
  unauthorizedError,
  notFoundError,
} from '@hattrictos-stats/shared';
import type { ChangePasswordInput } from '@hattrictos-stats/shared';
import type { AuthRepository } from '../infrastructure/auth.repository';

export function createChangePassword(repository: AuthRepository) {
  return async (
    userId: string,
    input: ChangePasswordInput,
  ): Promise<Result<void, AppError>> => {
    const user = await repository.findById(userId);
    if (!user) {
      return err(notFoundError('User not found'));
    }

    const valid = await Bun.password.verify(input.currentPassword, user.passwordHash);
    if (!valid) {
      return err(unauthorizedError('Current password is incorrect'));
    }

    const newHash = await Bun.password.hash(input.newPassword);
    await repository.updatePasswordHash(userId, newHash);

    return ok(undefined);
  };
}
