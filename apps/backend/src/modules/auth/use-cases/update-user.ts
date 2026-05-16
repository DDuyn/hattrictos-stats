import {
  type Result,
  type AppError,
  type UpdateUserInput,
  ok,
  err,
  notFoundError,
} from '@hattrictos-stats/shared';
import type { AuthRepository } from '../infrastructure/auth.repository';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string | null;
  htTeamId: number | null;
}

export type UpdateUser = (
  id: string,
  input: UpdateUserInput,
) => Promise<Result<UserResponse, AppError>>;

/**
 * Updates a user's role and/or htTeamId.
 * Owner / co_owner only — enforced at the API layer.
 */
export function createUpdateUser(repository: AuthRepository): UpdateUser {
  return async (id, input) => {
    const user = await repository.findById(id);
    if (!user) {
      return err(notFoundError(`User ${id} not found.`));
    }

    await repository.update(id, {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.htTeamId !== undefined ? { htTeamId: input.htTeamId } : {}),
    });

    // Re-fetch to return the updated state
    const updated = await repository.findById(id);
    return ok(updated!.toResponse());
  };
}
