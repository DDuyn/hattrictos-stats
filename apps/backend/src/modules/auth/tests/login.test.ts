import { describe, it, expect } from 'bun:test';
import { decode } from 'hono/jwt';
import { isOk, isErr } from '@repo/shared';
import { createRegister } from '../use-cases/register';
import { createLogin } from '../use-cases/login';
import { createMockAuthRepository } from './__helpers__/mock-auth-repository';

const JWT_SECRET = 'test-secret';

describe('Login', () => {
  it('should login with correct credentials', async () => {
    const repo = createMockAuthRepository();
    const register = createRegister(repo, JWT_SECRET);
    const login = createLogin(repo, JWT_SECRET);

    await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    const result = await login({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.user.email).toBe('test@example.com');
      expect(result.value.token).toBeDefined();
    }
  });

  it('should fail with wrong email', async () => {
    const login = createLogin(createMockAuthRepository(), JWT_SECRET);

    const result = await login({
      email: 'nonexistent@example.com',
      password: 'password123',
    });

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should fail with wrong password', async () => {
    const repo = createMockAuthRepository();
    const register = createRegister(repo, JWT_SECRET);
    const login = createLogin(repo, JWT_SECRET);

    await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    const result = await login({
      email: 'test@example.com',
      password: 'wrongpassword',
    });

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should issue a token with exp claim', async () => {
    const repo = createMockAuthRepository();
    const register = createRegister(repo, JWT_SECRET);
    const login = createLogin(repo, JWT_SECRET, '7d');

    await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    const result = await login({ email: 'test@example.com', password: 'password123' });

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      const { payload } = decode(result.value.token);
      expect(payload.exp).toBeDefined();
      // exp should be roughly 7 days from now (within a 5-second tolerance)
      const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      expect(payload.exp as number).toBeGreaterThan(expectedExp - 5);
      expect(payload.exp as number).toBeLessThanOrEqual(expectedExp + 5);
    }
  });
});
