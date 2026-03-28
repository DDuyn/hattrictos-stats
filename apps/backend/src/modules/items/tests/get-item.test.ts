import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Item } from '../domain/item';
import { createGetItem } from '../use-cases/get-item';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('GetItem', () => {
  it('should retrieve an existing item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Test', 'desc', USER_ID);
    if (!item.ok) return;
    await repo.create(item.value);

    const getItem = createGetItem(repo);
    const result = await getItem(item.value.id, USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Test');
    }
  });

  it('should return not found for non-existent item', async () => {
    const getItem = createGetItem(createMockItemsRepository());

    const result = await getItem('non-existent', USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('should not access items from another user', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Private', 'desc', USER_ID);
    if (!item.ok) return;
    await repo.create(item.value);

    const getItem = createGetItem(repo);
    const result = await getItem(item.value.id, 'other-user');
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
