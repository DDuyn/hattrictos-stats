import { type Result, type AppError, ok, err, notFoundError } from '@repo/shared';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type DeleteItem = (
  id: string,
  userId: string,
) => Promise<Result<void, AppError>>;

export function createDeleteItem(repository: ItemsRepository): DeleteItem {
  return async (id, userId) => {
    const deleted = await repository.delete(id, userId);
    if (!deleted) {
      return err(notFoundError(`Item with id '${id}' not found`));
    }
    return ok(undefined);
  };
}
