import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Item } from '../domain/item';
import { createDeactivateItem } from '../use-cases/deactivate-item';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('DeactivateItem', () => {
  it('should deactivate an active item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Test', 'desc', USER_ID);
    if (!item.ok) return;
    item.value.activate();
    await repo.create(item.value);

    const deactivateItem = createDeactivateItem(repo);
    const result = await deactivateItem(item.value.id, USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('inactive');
    }
  });

  it('should fail to deactivate an already inactive item', async () => {
    const repo = createMockItemsRepository();
    const item = Item.create('Test', 'desc', USER_ID);
    if (!item.ok) return;
    await repo.create(item.value);

    const deactivateItem = createDeactivateItem(repo);
    const result = await deactivateItem(item.value.id, USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should return not found for non-existent item', async () => {
    const deactivateItem = createDeactivateItem(createMockItemsRepository());

    const result = await deactivateItem('non-existent', USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
