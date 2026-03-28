import { eq, and, count } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import { itemsTable } from './items.table';
import { Item } from '../domain/item';

export interface ItemsRepository {
  findById(id: string, userId: string): Promise<Item | null>;
  findAllByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Item[]; total: number }>;
  create(item: Item): Promise<void>;
  update(item: Item): Promise<void>;
  delete(id: string, userId: string): Promise<boolean>;
}

export function createItemsRepository(db: DB): ItemsRepository {
  return {
    async findById(id, userId) {
      const row = await db
        .select()
        .from(itemsTable)
        .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, userId)))
        .get();
      if (!row) return null;
      return Item.fromPersistence(row);
    },

    async findAllByUser(userId, page, limit) {
      const offset = (page - 1) * limit;
      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(itemsTable)
          .where(eq(itemsTable.userId, userId))
          .limit(limit)
          .offset(offset)
          .all(),
        db
          .select({ count: count() })
          .from(itemsTable)
          .where(eq(itemsTable.userId, userId))
          .get(),
      ]);

      return {
        items: rows.map((row) => Item.fromPersistence(row)),
        total: totalResult?.count ?? 0,
      };
    },

    async create(item) {
      await db.insert(itemsTable).values({
        id: item.id,
        name: item.name,
        description: item.description,
        status: item.status,
        userId: item.userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    },

    async update(item) {
      await db
        .update(itemsTable)
        .set({
          name: item.name,
          description: item.description,
          status: item.status,
          updatedAt: item.updatedAt,
        })
        .where(and(eq(itemsTable.id, item.id), eq(itemsTable.userId, item.userId)));
    },

    async delete(id, userId) {
      const item = await db
        .select({ id: itemsTable.id })
        .from(itemsTable)
        .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, userId)))
        .get();
      if (!item) return false;

      await db
        .delete(itemsTable)
        .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, userId)));
      return true;
    },
  };
}
