import {
  type Result,
  type AppError,
  type ItemResponse,
  ok,
  err,
  notFoundError,
} from '@repo/shared';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type GetItem = (
  id: string,
  userId: string,
) => Promise<Result<ItemResponse, AppError>>;

export function createGetItem(repository: ItemsRepository): GetItem {
  return async (id, userId) => {
    const item = await repository.findById(id, userId);
    if (!item) {
      return err(notFoundError(`Item with id '${id}' not found`));
    }
    return ok(item.toResponse());
  };
}
