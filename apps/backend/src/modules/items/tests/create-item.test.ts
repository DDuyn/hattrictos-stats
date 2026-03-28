import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { createCreateItem } from '../use-cases/create-item';
import { createMockItemsRepository } from './__helpers__/mock-items-repository';

const USER_ID = 'user-1';

describe('CreateItem', () => {
  it('should create an item successfully', async () => {
    const createItem = createCreateItem(createMockItemsRepository());

    const result = await createItem({ name: 'My Item', description: 'desc' }, USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('My Item');
      expect(result.value.status).toBe('inactive');
    }
  });

  it('should fail with empty name', async () => {
    const createItem = createCreateItem(createMockItemsRepository());

    const result = await createItem({ name: '', description: 'desc' }, USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
