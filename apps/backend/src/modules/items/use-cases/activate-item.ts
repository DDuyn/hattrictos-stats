import {
  type Result,
  type AppError,
  type ItemResponse,
  ok,
  err,
  notFoundError,
} from '@repo/shared';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type ActivateItem = (
  id: string,
  userId: string,
) => Promise<Result<ItemResponse, AppError>>;

export function createActivateItem(repository: ItemsRepository): ActivateItem {
  return async (id, userId) => {
    const item = await repository.findById(id, userId);
    if (!item) {
      return err(notFoundError(`Item with id '${id}' not found`));
    }

    const activateResult = item.activate();
    if (!activateResult.ok) return activateResult;

    const activated = activateResult.value;
    await repository.update(activated);
    return ok(activated.toResponse());
  };
}
