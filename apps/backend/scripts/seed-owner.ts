/**
 * seed:owner
 *
 * Marks the first user with email admin@hattrictos.local as `owner`.
 * Run once after initial setup:
 *
 *   bun run scripts/seed-owner.ts
 */
import { eq } from 'drizzle-orm';
import { env } from '../src/config/env';
import { db } from '../src/infrastructure/db/client';
import { usersTable } from '../src/modules/auth/infrastructure/auth.table';

const TARGET_EMAIL = 'admin@hattrictos.local';

const row = await db
  .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
  .from(usersTable)
  .where(eq(usersTable.email, TARGET_EMAIL))
  .get();

if (!row) {
  console.error(`User not found: ${TARGET_EMAIL}`);
  process.exit(1);
}

if (row.role === 'owner') {
  process.stdout.write(`User ${TARGET_EMAIL} is already owner — nothing to do.\n`);
  process.exit(0);
}

await db
  .update(usersTable)
  .set({ role: 'owner' })
  .where(eq(usersTable.email, TARGET_EMAIL));

process.stdout.write(`Done: ${TARGET_EMAIL} is now owner.\n`);

// Suppress unused import warning
void env;
