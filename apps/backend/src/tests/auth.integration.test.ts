import { describe, it, expect, beforeAll } from 'bun:test';
import { decode } from 'hono/jwt';
import { createTestApp, createTestToken, registerTestUser } from './test-helpers';

type App = Awaited<ReturnType<typeof createTestApp>>;

let app: App;

beforeAll(async () => {
  app = await createTestApp();
});

// ---------------------------------------------------------------------------
// Register (REGISTRATION_ENABLED=false by default in tests)
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  it('should return 401 without a token when registration is closed', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'anon@example.com', password: 'password123', name: 'Anon' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 403 when caller has no role (null)', async () => {
    const callerToken = await createTestToken('some-id', 'caller@test', null);
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callerToken}`,
      },
      body: JSON.stringify({ email: 'anon@example.com', password: 'password123', name: 'Anon' }),
    });
    expect(res.status).toBe(403);
  });

  it('should return 403 when caller has admin role', async () => {
    const callerToken = await createTestToken('some-id', 'caller@test', 'admin');
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callerToken}`,
      },
      body: JSON.stringify({ email: 'anon@example.com', password: 'password123', name: 'Anon' }),
    });
    expect(res.status).toBe(403);
  });

  it('should register a new user when caller is owner', async () => {
    const email = `reg-${crypto.randomUUID()}@example.com`;
    const res = await registerTestUser(app, { email }, 'owner');
    expect(res.user.email).toBe(email);
    expect(res.token).toBeDefined();
  });

  it('should register a new user when caller is co_owner', async () => {
    const email = `reg-${crypto.randomUUID()}@example.com`;
    const res = await registerTestUser(app, { email }, 'co_owner');
    expect(res.user.email).toBe(email);
  });

  it('should return 409 if email is already registered', async () => {
    const { user } = await registerTestUser(app);

    const callerToken = await createTestToken('some-id', 'caller@test', 'owner');
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callerToken}`,
      },
      body: JSON.stringify({ email: user.email, password: 'password123', name: 'Dup User' }),
    });
    expect(res.status).toBe(409);
  });

  it('should return 400 if input is invalid', async () => {
    const callerToken = await createTestToken('some-id', 'caller@test', 'owner');
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callerToken}`,
      },
      body: JSON.stringify({ email: 'not-an-email', password: '123', name: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('should include exp claim and role in the returned token', async () => {
    const { token, user } = await registerTestUser(app);
    const { payload } = decode(token);
    expect(payload.exp).toBeDefined();
    expect(payload.exp as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload.role).toBeNull();
    expect(user.role).toBeNull();
  });

  it('should persist the role when provided by the caller', async () => {
    const email = `owner-${crypto.randomUUID()}@example.com`;
    const { user, token } = await registerTestUser(app, { email, role: 'admin' }, 'owner');
    expect(user.role).toBe('admin');
    const { payload } = decode(token);
    expect(payload.role).toBe('admin');
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

  it('should include role in the login token', async () => {
    const email = `login-role-${crypto.randomUUID()}@example.com`;
    await registerTestUser(app, { email, role: 'admin' }, 'owner');

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    const { payload } = decode(body.token);
    expect(payload.role).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me', () => {
  it('should return 200 with user data including role when authenticated', async () => {
    const { token, user } = await registerTestUser(app);

    const res = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string; role: string | null };
    expect(body.id).toBe(user.id);
    expect(body.email).toBe(user.email);
    expect('role' in body).toBe(true);
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

// ---------------------------------------------------------------------------
// Guards — ownerOrCoOwnerGuard via /api/admin/chpp routes
// ---------------------------------------------------------------------------
describe('ownerOrCoOwnerGuard (via /api/admin/chpp/verify)', () => {
  it('should return 401 without token', async () => {
    const res = await app.request('/api/admin/chpp/verify');
    expect(res.status).toBe(401);
  });

  it('should return 403 when role is null', async () => {
    const token = await createTestToken('u1', 'u@test', null);
    const res = await app.request('/api/admin/chpp/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('should return 403 when role is admin', async () => {
    const token = await createTestToken('u2', 'u@test', 'admin');
    const res = await app.request('/api/admin/chpp/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('should pass guard when role is owner (may still fail downstream without CHPP config)', async () => {
    const token = await createTestToken('u3', 'u@test', 'owner');
    const res = await app.request('/api/admin/chpp/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Guard passed: status is NOT 401/403 (downstream may return 500 without CHPP config)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('should pass guard when role is co_owner', async () => {
    const token = await createTestToken('u4', 'u@test', 'co_owner');
    const res = await app.request('/api/admin/chpp/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users
// ---------------------------------------------------------------------------
describe('POST /api/admin/users', () => {
  it('should return 401 without token', async () => {
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@x.com', role: 'admin' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 403 when caller is admin', async () => {
    const token = await createTestToken('u5', 'u@test', 'admin');
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: 'x@x.com', role: 'admin' }),
    });
    expect(res.status).toBe(403);
  });

  it('should create a user and return generatedPassword when caller is owner', async () => {
    const token = await createTestToken('u6', 'u@test', 'owner');
    const email = `admin-user-${crypto.randomUUID()}@example.com`;
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, role: 'admin' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { email: string; role: string }; generatedPassword: string };
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('admin');
    expect(body.generatedPassword).toBeDefined();
    expect(body.generatedPassword.length).toBeGreaterThan(8);
  });
});
