import {
  type Result,
  type AppError,
  type ItemResponse,
  ok,
  err,
  notFoundError,
} from '@repo/shared';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type DeactivateItem = (
  id: string,
  userId: string,
) => Promise<Result<ItemResponse, AppError>>;

export function createDeactivateItem(repository: ItemsRepository): DeactivateItem {
  return async (id, userId) => {
    const item = await repository.findById(id, userId);
    if (!item) {
      return err(notFoundError(`Item with id '${id}' not found`));
    }

    const deactivateResult = item.deactivate();
    if (!deactivateResult.ok) return deactivateResult;

    const deactivated = deactivateResult.value;
    await repository.update(deactivated);
    return ok(deactivated.toResponse());
  };
}
