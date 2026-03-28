import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Item } from '../domain/item';
import { createActivateItem } from '../use-cases/activate-item';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('ActivateItem', () => {
  it('should activate an item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Test', 'desc', USER_ID);
    if (!item.ok) return;
    await repo.create(item.value);

    const activateItem = createActivateItem(repo);
    const result = await activateItem(item.value.id, USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('active');
    }
  });

  it('should fail to activate an already active item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Test', 'desc', USER_ID);
    if (!item.ok) return;
    item.value.activate();
    await repo.create(item.value);

    const activateItem = createActivateItem(repo);
    const result = await activateItem(item.value.id, USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should return not found for non-existent item', async () => {
    const activateItem = createActivateItem(createMockItemsRepository());

    const result = await activateItem('non-existent', USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
