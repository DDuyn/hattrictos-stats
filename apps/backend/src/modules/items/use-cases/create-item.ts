import {
  type Result,
  type AppError,
  type ItemResponse,
  type CreateItemInput,
  ok,
} from '@repo/shared';
import { Item } from '../domain/item';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type CreateItem = (
  input: CreateItemInput,
  userId: string,
) => Promise<Result<ItemResponse, AppError>>;

export function createCreateItem(repository: ItemsRepository): CreateItem {
  return async (input, userId) => {
    const result = Item.create(input.name, input.description ?? '', userId);
    if (!result.ok) return result;

    const item = result.value;
    await repository.create(item);
    return ok(item.toResponse());
  };
}
