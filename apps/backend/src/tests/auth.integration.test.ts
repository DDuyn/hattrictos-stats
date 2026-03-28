import { describe, it, expect, beforeAll } from 'bun:test';
import { decode } from 'hono/jwt';
import { createTestApp, registerTestUser } from './test-helpers';

type App = Awaited<ReturnType<typeof createTestApp>>;

let app: App;

beforeAll(async () => {
  app = await createTestApp();
});

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  it('should register a new user and return 201 with token + user', async () => {
    const email = `reg-${crypto.randomUUID()}@example.com`;
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: 'Test User' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { token: string; user: { id: string; email: string } };
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(email);
  });

  it('should return 409 if email is already registered', async () => {
    const { user } = await registerTestUser(app);

    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'password123', name: 'Dup User' }),
    });

    expect(res.status).toBe(409);
  });

  it('should return 400 if input is invalid', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '123', name: '' }),
    });

    expect(res.status).toBe(400);
  });

  it('should include exp claim in the returned token', async () => {
    const { token } = await registerTestUser(app);
    const { payload } = decode(token);
    expect(payload.exp).toBeDefined();
    expect(payload.exp as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  it('should return 200 with token on valid credentials', async () => {
    const { user } = await registerTestUser(app);

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { email: string } };
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(user.email);
  });

  it('should return 401 on wrong password', async () => {
    const { user } = await registerTestUser(app);

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'wrong-password' }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 401 on unknown email', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 400 if input is invalid', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad', password: '' }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me', () => {
  it('should return 200 with user data when authenticated', async () => {
    const { token, user } = await registerTestUser(app);

    const res = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.id).toBe(user.id);
    expect(body.email).toBe(user.email);
  });

  it('should return 401 without a token', async () => {
    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------
describe('POST /api/auth/refresh', () => {
  it('should return 200 with a new token when authenticated', async () => {
    const { token } = await registerTestUser(app);

    const res = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token).toBeDefined();
    // Decoded payload should carry the same userId
    const { payload: orig } = decode(token);
    const { payload: refreshed } = decode(body.token);
    expect(refreshed.userId).toBe(orig.userId);
  });

  it('should return 401 without a token', async () => {
    const res = await app.request('/api/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
