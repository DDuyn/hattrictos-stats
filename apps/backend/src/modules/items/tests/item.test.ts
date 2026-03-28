import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Item } from '../domain/item';

const USER_ID = 'user-1';

describe('Item domain', () => {
  it('should create a valid item with inactive status', () => {
    const result = Item.create('Test Item', 'A description', USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Test Item');
      expect(result.value.status).toBe('inactive');
      expect(result.value.isActive).toBe(false);
    }
  });

  it('should reject empty name', () => {
    const result = Item.create('', 'desc', USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should reject name exceeding 200 characters', () => {
    const result = Item.create('a'.repeat(201), 'desc', USER_ID);
    expect(isErr(result)).toBe(true);
  });

  it('should activate an inactive item', () => {
    const createResult = Item.create('Test', 'desc', USER_ID);
    expect(isOk(createResult)).toBe(true);
    if (!createResult.ok) return;

    const activateResult = createResult.value.activate();
    expect(isOk(activateResult)).toBe(true);
    if (activateResult.ok) {
      expect(activateResult.value.isActive).toBe(true);
    }
  });

  it('should fail to activate an already active item', () => {
    const createResult = Item.create('Test', 'desc', USER_ID);
    if (!createResult.ok) return;

    createResult.value.activate();
    const secondActivate = createResult.value.activate();
    expect(isErr(secondActivate)).toBe(true);
    if (!secondActivate.ok) {
      expect(secondActivate.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should deactivate an active item', () => {
    const createResult = Item.create('Test', 'desc', USER_ID);
    if (!createResult.ok) return;

    createResult.value.activate();
    const deactivateResult = createResult.value.deactivate();
    expect(isOk(deactivateResult)).toBe(true);
    if (deactivateResult.ok) {
      expect(deactivateResult.value.isActive).toBe(false);
    }
  });

  it('should fail to deactivate an already inactive item', () => {
    const createResult = Item.create('Test', 'desc', USER_ID);
    if (!createResult.ok) return;

    const deactivateResult = createResult.value.deactivate();
    expect(isErr(deactivateResult)).toBe(true);
  });

  it('should update name and description', () => {
    const createResult = Item.create('Original', 'Original desc', USER_ID);
    if (!createResult.ok) return;

    const updateResult = createResult.value.updateDetails('Updated', 'New desc');
    expect(isOk(updateResult)).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.value.name).toBe('Updated');
      expect(updateResult.value.description).toBe('New desc');
    }
  });

  it('should produce a valid response', () => {
    const createResult = Item.create('Test', 'desc', USER_ID);
    if (!createResult.ok) return;

    const response = createResult.value.toResponse();
    expect(response.name).toBe('Test');
    expect(response.status).toBe('inactive');
    expect(response.createdAt).toBeDefined();
    expect(response.updatedAt).toBeDefined();
  });
});
