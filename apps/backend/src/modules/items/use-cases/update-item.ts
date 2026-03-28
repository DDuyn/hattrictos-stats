import {
  type Result,
  type AppError,
  type ItemResponse,
  type UpdateItemInput,
  ok,
  err,
  notFoundError,
} from '@repo/shared';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type UpdateItem = (
  id: string,
  input: UpdateItemInput,
  userId: string,
) => Promise<Result<ItemResponse, AppError>>;

export function createUpdateItem(repository: ItemsRepository): UpdateItem {
  return async (id, input, userId) => {
    const item = await repository.findById(id, userId);
    if (!item) {
      return err(notFoundError(`Item with id '${id}' not found`));
    }

    const updateResult = item.updateDetails(input.name, input.description);
    if (!updateResult.ok) return updateResult;

    const updated = updateResult.value;
    await repository.update(updated);
    return ok(updated.toResponse());
  };
}
