import { sign } from 'hono/jwt';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { createApp } from '../app';
import { db } from '../infrastructure/db/client';
import type { UserRole } from '@hattrictos-stats/shared';

const MIGRATIONS_FOLDER = resolve(import.meta.dir, '../infrastructure/db/migrations');

let migrated = false;

function splitSqlStatements(content: string): string[] {
  return content
    .split('--> statement-breakpoint')
    .flatMap((chunk) =>
      chunk
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => `${statement};`),
    );
}

async function applySqlMigrations() {
  const files = readdirSync(MIGRATIONS_FOLDER)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const content = readFileSync(resolve(MIGRATIONS_FOLDER, file), 'utf8');
    const statements = splitSqlStatements(content);

    for (const statement of statements) {
      try {
        await db.run(sql.raw(statement));
      } catch (error) {
        throw new Error(`Failed migration ${file}: ${statement}`, { cause: error });
      }
    }
  }
}

/**
 * Returns the Hono app with migrations applied on the in-memory SQLite DB.
 * Migrations only run once per test process.
 */
export async function createTestApp() {
  if (!migrated) {
    await applySqlMigrations();
    migrated = true;
  }
  return createApp();
}

/**
 * Generates a valid JWT for the given user, optionally with a role.
 */
export async function createTestToken(
  userId: string,
  email: string,
  role: UserRole | null = null,
): Promise<string> {
  const secret = process.env.JWT_SECRET!;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  return sign({ userId, email, role, exp }, secret);
}

/**
 * Registers a test user via the API and returns the token + user.
 * When `asRole` is provided, the request is made with a JWT bearing that role
 * (needed when REGISTRATION_ENABLED=false).
 */
export async function registerTestUser(
  app: ReturnType<typeof createApp>,
  overrides?: { email?: string; password?: string; name?: string; role?: UserRole | null },
  asRole: UserRole = 'owner',
) {
  const email = overrides?.email ?? `test-${crypto.randomUUID()}@example.com`;
  const password = overrides?.password ?? 'password123';
  const name = overrides?.name ?? 'Test User';

  // Create a synthetic caller token so the endpoint accepts the request
  const callerToken = await createTestToken(`system-${crypto.randomUUID()}`, 'system@test', asRole);

  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${callerToken}`,
    },
    body: JSON.stringify({ email, password, name, role: overrides?.role ?? null }),
  });

  if (res.status !== 201) {
    throw new Error(`registerTestUser failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    token: string;
    user: { id: string; email: string; name: string; role: UserRole | null };
  };
  return body;
}
