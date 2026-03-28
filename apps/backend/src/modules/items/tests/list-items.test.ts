import { describe, it, expect } from 'bun:test';
import { isOk } from '@repo/shared';
import { Item } from '../domain/item';
import { createListItems } from '../use-cases/list-items';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('ListItems', () => {
  it('should list items with pagination', async () => {
    const repo = createMockItemsRepository();
    const item1 = Item.create('Item 1', '', USER_ID);
    const item2 = Item.create('Item 2', '', USER_ID);
    const item3 = Item.create('Item 3', '', USER_ID);
    if (!item1.ok || !item2.ok || !item3.ok) return;
    await repo.create(item1.value);
    await repo.create(item2.value);
    await repo.create(item3.value);

    const listItems = createListItems(repo);
    const result = await listItems(USER_ID, 1, 2);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(2);
      expect(result.value.total).toBe(3);
    }
  });

  it('should return empty list for user with no items', async () => {
    const listItems = createListItems(createMockItemsRepository());

    const result = await listItems(USER_ID, 1, 20);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(0);
      expect(result.value.total).toBe(0);
    }
  });
});
