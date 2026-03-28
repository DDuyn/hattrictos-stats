import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Item } from '../domain/item';
import { createDeleteItem } from '../use-cases/delete-item';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('DeleteItem', () => {
  it('should delete an existing item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('To Delete', 'desc', USER_ID);
    if (!item.ok) return;
    await repo.create(item.value);

    const deleteItem = createDeleteItem(repo);
    const result = await deleteItem(item.value.id, USER_ID);
    expect(isOk(result)).toBe(true);

    // Verify it's gone
    const findResult = await repo.findById(item.value.id, USER_ID);
    expect(findResult).toBeNull();
  });

  it('should return not found for non-existent item', async () => {
    const deleteItem = createDeleteItem(createMockItemsRepository());

    const result = await deleteItem('non-existent', USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
