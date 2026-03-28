import { Item } from '../../domain/item';
import type { ItemsRepository } from '../../infrastructure/items.repository';

/**
 * Creates an in-memory ItemsRepository for unit tests.
 */
export function createMockItemsRepository(items: Item[] = []): ItemsRepository {
  const store = new Map<string, Item>();

  for (const item of items) {
    store.set(item.id, item);
  }

  return {
    async findById(id, userId) {
      const item = store.get(id);
      if (!item || item.userId !== userId) return null;
      return item;
    },
    async findAllByUser(userId, page, limit) {
      const all = [...store.values()].filter((i) => i.userId === userId);
      const offset = (page - 1) * limit;
      return { items: all.slice(offset, offset + limit), total: all.length };
    },
    async create(item) {
      store.set(item.id, item);
    },
    async update(item) {
      store.set(item.id, item);
    },
    async delete(id, userId) {
      const item = store.get(id);
      if (!item || item.userId !== userId) return false;
      store.delete(id);
      return true;
    },
  };
}
