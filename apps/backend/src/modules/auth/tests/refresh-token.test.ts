import { describe, it, expect } from 'bun:test';
import { decode } from 'hono/jwt';
import { isOk, isErr } from '@repo/shared';
import { createRegister } from '../use-cases/register';
import { createRefreshToken } from '../use-cases/refresh-token';
import { createMockAuthRepository } from './__helpers__/mock-auth-repository';

const JWT_SECRET = 'test-secret';

describe('RefreshToken', () => {
  it('should issue a new token for a valid user', async () => {
    const repo = createMockAuthRepository();
    const register = createRegister(repo, JWT_SECRET, '7d');
    const refresh = createRefreshToken(repo, JWT_SECRET, '7d');

    const registered = await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
    expect(isOk(registered)).toBe(true);
    if (!registered.ok) return;

    const { payload: registeredPayload } = decode(registered.value.token);
    const result = await refresh(registeredPayload.userId as string);

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.token).toBeDefined();
      const { payload } = decode(result.value.token);
      expect(payload.userId).toBe(registeredPayload.userId);
      expect(payload.email).toBe('test@example.com');
      expect(payload.exp).toBeDefined();
    }
  });

  it('should fail if user does not exist', async () => {
    const repo = createMockAuthRepository();
    const refresh = createRefreshToken(repo, JWT_SECRET, '7d');

    const result = await refresh('nonexistent-user-id');

    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should issue a token with exp claim', async () => {
    const repo = createMockAuthRepository();
    const register = createRegister(repo, JWT_SECRET, '7d');
    const refresh = createRefreshToken(repo, JWT_SECRET, '7d');

    const registered = await register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
    if (!registered.ok) return;

    const { payload } = decode(registered.value.token);
    const result = await refresh(payload.userId as string);

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      const { payload: newPayload } = decode(result.value.token);
      expect(newPayload.exp).toBeDefined();
      const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      expect(newPayload.exp as number).toBeGreaterThan(expectedExp - 5);
      expect(newPayload.exp as number).toBeLessThanOrEqual(expectedExp + 5);
    }
  });
});
