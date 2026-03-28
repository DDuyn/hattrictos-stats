import { describe, it, expect } from 'bun:test';
import { decode } from 'hono/jwt';
import { isOk, isErr } from '@repo/shared';
import { User } from '../domain/user';
import { createRegister } from '../use-cases/register';
import { createMockAuthRepository } from './__helpers__/mock-auth-repository';

const JWT_SECRET = 'test-secret';

describe('Register', () => {
  it('should register a new user successfully', async () => {
    const register = createRegister(createMockAuthRepository(), JWT_SECRET);

    const result = await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.user.email).toBe('test@example.com');
      expect(result.value.user.name).toBe('Test User');
      expect(result.value.token).toBeDefined();
    }
  });

  it('should fail if email already exists', async () => {
    const existingUser = User.fromPersistence({
      id: '1',
      email: 'test@example.com',
      name: 'Existing',
      passwordHash: 'hash',
      createdAt: new Date(),
    });
    const register = createRegister(createMockAuthRepository([existingUser]), JWT_SECRET);

    const result = await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'New User',
    });

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });

  it('should issue a token with exp claim', async () => {
    const register = createRegister(createMockAuthRepository(), JWT_SECRET, '7d');

    const result = await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      const { payload } = decode(result.value.token);
      expect(payload.exp).toBeDefined();
      const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      expect(payload.exp as number).toBeGreaterThan(expectedExp - 5);
      expect(payload.exp as number).toBeLessThanOrEqual(expectedExp + 5);
    }
  });
});
