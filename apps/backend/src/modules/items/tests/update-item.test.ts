import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Item } from '../domain/item';
import { createUpdateItem } from '../use-cases/update-item';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('UpdateItem', () => {
  it('should update an item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Original', 'desc', USER_ID);
    if (!item.ok) return;
    await repo.create(item.value);

    const updateItem = createUpdateItem(repo);
    const result = await updateItem(item.value.id, { name: 'Updated' }, USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Updated');
    }
  });

  it('should return not found for non-existent item', async () => {
    const updateItem = createUpdateItem(createMockItemsRepository());

    const result = await updateItem('non-existent', { name: 'Updated' }, USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
