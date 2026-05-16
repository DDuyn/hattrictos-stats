import { type Result, type AppError, ok } from '@hattrictos-stats/shared';
import type { AuthRepository } from '../infrastructure/auth.repository';

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: string | null;
  htTeamId: number | null;
}

export type ListUsers = () => Promise<Result<UserListItem[], AppError>>;

/**
 * Returns all registered users.
 * Owner / co_owner only — enforced at the API layer.
 */
export function createListUsers(repository: AuthRepository): ListUsers {
  return async () => {
    const users = await repository.findAll();
    return ok(users.map((u) => u.toResponse()));
  };
}
