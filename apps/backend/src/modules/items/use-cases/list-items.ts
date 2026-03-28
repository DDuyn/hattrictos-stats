import {
  type Result,
  type AppError,
  type ItemResponse,
  type PaginatedResponse,
  ok,
} from '@repo/shared';
import type { ItemsRepository } from '../infrastructure/items.repository';

export type ListItems = (
  userId: string,
  page: number,
  limit: number,
) => Promise<Result<PaginatedResponse<ItemResponse>, AppError>>;

export function createListItems(repository: ItemsRepository): ListItems {
  return async (userId, page, limit) => {
    const { items, total } = await repository.findAllByUser(userId, page, limit);
    return ok({
      items: items.map((item) => item.toResponse()),
      total,
      page,
      limit,
    });
  };
}
