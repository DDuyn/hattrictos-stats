import { sign } from 'hono/jwt';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolve } from 'node:path';
import { createApp } from '../app';
import { db } from '../infrastructure/db/client';

const MIGRATIONS_FOLDER = resolve(import.meta.dir, '../infrastructure/db/migrations');

let migrated = false;

/**
 * Returns the Hono app with migrations applied on the in-memory SQLite DB.
 * Migrations only run once per test process.
 */
export async function createTestApp() {
  if (!migrated) {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    migrated = true;
  }
  return createApp();
}

/**
 * Generates a valid JWT for the given user.
 */
export async function createTestToken(userId: string, email: string): Promise<string> {
  const secret = process.env.JWT_SECRET!;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  return sign({ userId, email, exp }, secret);
}

/**
 * Registers a test user via the API and returns the token + user.
 */
export async function registerTestUser(
  app: ReturnType<typeof createApp>,
  overrides?: { email?: string; password?: string; name?: string },
) {
  const email = overrides?.email ?? `test-${crypto.randomUUID()}@example.com`;
  const password = overrides?.password ?? 'password123';
  const name = overrides?.name ?? 'Test User';

  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (res.status !== 201) {
    throw new Error(`registerTestUser failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { token: string; user: { id: string; email: string; name: string } };
  return body;
}
