import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { User } from '../domain/user';

describe('User domain', () => {
  it('should create a valid user', () => {
    const result = User.create({
      id: '1',
      email: 'test@example.com',
      name: 'Test',
      passwordHash: 'hash',
      createdAt: new Date(),
    });
    expect(isOk(result)).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = User.create({
      id: '1',
      email: 'invalid',
      name: 'Test',
      passwordHash: 'hash',
      createdAt: new Date(),
    });
    expect(isErr(result)).toBe(true);
  });

  it('should reject empty name', () => {
    const result = User.create({
      id: '1',
      email: 'test@example.com',
      name: '  ',
      passwordHash: 'hash',
      createdAt: new Date(),
    });
    expect(isErr(result)).toBe(true);
  });

  it('should produce a response without passwordHash', () => {
    const user = User.fromPersistence({
      id: '1',
      email: 'test@example.com',
      name: 'Test',
      passwordHash: 'hash',
      createdAt: new Date(),
    });
    const response = user.toResponse();
    expect(response).toEqual({ id: '1', email: 'test@example.com', name: 'Test' });
    expect((response as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});
