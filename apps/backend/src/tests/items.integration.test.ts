import { describe, it, expect, beforeAll } from 'bun:test';
import { createTestApp, registerTestUser } from './test-helpers';

type App = Awaited<ReturnType<typeof createTestApp>>;

let app: App;
let token: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let userId: string;

beforeAll(async () => {
  app = await createTestApp();
  const result = await registerTestUser(app);
  token = result.token;
  userId = result.user.id;
});

function authHeader() {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Auth guard — all routes require a token
// ---------------------------------------------------------------------------
describe('Items auth guard', () => {
  it('GET /api/items should return 401 without token', async () => {
    const res = await app.request('/api/items');
    expect(res.status).toBe(401);
  });

  it('POST /api/items should return 401 without token', async () => {
    const res = await app.request('/api/items', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
describe('POST /api/items', () => {
  it('should create an item and return 201', async () => {
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Item', description: 'desc' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string; status: string };
    expect(body.name).toBe('My Item');
    expect(body.status).toBe('inactive');
    expect(body.id).toBeDefined();
  });

  it('should return 400 on invalid input', async () => {
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', description: 'desc' }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------
describe('GET /api/items/:id', () => {
  it('should return 200 for an owned item', async () => {
    const created = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fetch Me', description: '' }),
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(`/api/items/${id}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('Fetch Me');
  });

  it('should return 404 for a non-existent item', async () => {
    const res = await app.request('/api/items/non-existent-id', { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it("should return 404 when accessing another user's item", async () => {
    // Create item with main user
    const created = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Private', description: '' }),
    });
    const { id } = (await created.json()) as { id: string };

    // Access with another user
    const { token: otherToken } = await registerTestUser(app);
    const res = await app.request(`/api/items/${id}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
describe('GET /api/items', () => {
  it('should list items with pagination', async () => {
    // Create 3 items
    for (let i = 1; i <= 3; i++) {
      await app.request('/api/items', {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `List Item ${i}`, description: '' }),
      });
    }

    const res = await app.request('/api/items?page=1&limit=2', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
describe('PATCH /api/items/:id', () => {
  it('should update an item and return 200', async () => {
    const created = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Original Name', description: '' }),
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('Updated Name');
  });

  it("should return 404 when updating another user's item", async () => {
    const created = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Not Yours', description: '' }),
    });
    const { id } = (await created.json()) as { id: string };

    const { token: otherToken } = await registerTestUser(app);
    const res = await app.request(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hijacked' }),
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
describe('DELETE /api/items/:id', () => {
  it('should delete an item and return 204', async () => {
    const created = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'To Delete', description: '' }),
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(`/api/items/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    expect(res.status).toBe(204);

    // Verify it's gone
    const get = await app.request(`/api/items/${id}`, { headers: authHeader() });
    expect(get.status).toBe(404);
  });

  it("should return 404 when deleting another user's item", async () => {
    const created = await app.request('/api/items', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Not Yours Either', description: '' }),
    });
    const { id } = (await created.json()) as { id: string };

    const { token: otherToken } = await registerTestUser(app);
    const res = await app.request(`/api/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status).toBe(404);
  });
});
