import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { User } from '../domain/user';
import { createGetMe } from '../use-cases/get-me';
import { createMockAuthRepository } from './__helpers__/mock-auth-repository';

const mockUser = User.fromPersistence({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: 'hash',
  createdAt: new Date(),
});

describe('GetMe', () => {
  it('should return user data for a valid userId', async () => {
    const repo = createMockAuthRepository([mockUser]);
    const getMe = createGetMe(repo);

    const result = await getMe('user-1');

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('user-1');
      expect(result.value.email).toBe('test@example.com');
      expect(result.value.name).toBe('Test User');
    }
  });

  it('should return NOT_FOUND for an unknown userId', async () => {
    const getMe = createGetMe(createMockAuthRepository());

    const result = await getMe('nonexistent-id');

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
