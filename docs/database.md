# Database

## Stack

- **Turso** — managed SQLite-compatible database (libSQL) with local dev support
- **Drizzle ORM** — type-safe query builder and schema definition
- **@libsql/client** — Turso's JavaScript/TypeScript client
- **drizzle-kit** — CLI for schema migrations and introspection

## Connection setup

The database client is configured in `apps/backend/src/infrastructure/db/client.ts`:

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../../config/env';
import * as schema from './schema';

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

### Environment variables

| Variable             | Required | Default           | Description                          |
| -------------------- | -------- | ----------------- | ------------------------------------ |
| `TURSO_DATABASE_URL` | No       | `file:./local.db` | libSQL connection URL                |
| `TURSO_AUTH_TOKEN`   | No       | —                 | Auth token for remote Turso database |

### Local development

In development, `TURSO_DATABASE_URL=file:./local.db` tells the libSQL client to use a local SQLite file. No Turso account or internet connection is needed. The file is created automatically on first use.

### Production

In production, set `TURSO_DATABASE_URL` to your Turso database URL (e.g. `libsql://your-db-name-your-org.turso.io`) and `TURSO_AUTH_TOKEN` to a valid auth token. See the [deployment guide](./deployment.md) for setup instructions.

## Table definitions

Tables are defined using Drizzle's schema API in each module's `[feature].table.ts` file. All tables are re-exported from a single barrel file so Drizzle can discover them.

### Users table (`auth.table.ts`)

```ts
export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### Items table (`items.table.ts`)

```ts
export const itemsTable = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('inactive'),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### Design decisions

**UUIDs as primary keys** (`text('id').primaryKey()`): We generate IDs in application code with `crypto.randomUUID()` rather than using SQLite's `INTEGER PRIMARY KEY AUTOINCREMENT`. This means IDs are assigned before insertion, which simplifies the domain layer — `Item.create()` can set the ID immediately without a round-trip to the database.

**Timestamps as integers** (`integer(..., { mode: 'timestamp' })`): SQLite doesn't have a native datetime type. Drizzle's `mode: 'timestamp'` stores dates as Unix timestamps (integers) and automatically converts to/from JavaScript `Date` objects.

**`$defaultFn` for defaults**: `.$defaultFn(() => new Date())` sets the default in application code, not in SQL. This is intentional — our domain entities set these values explicitly, so the SQL default is only a safety net.

**Foreign keys**: The `items.userId` references `usersTable.id`. libSQL enforces foreign keys by default.

**Enums as text**: `text('status', { enum: ['active', 'inactive'] })` stores status as a string. SQLite doesn't have native enums, but Drizzle generates TypeScript types from the enum array, giving you compile-time safety.

## Schema barrel file

All table definitions must be exported from `apps/backend/src/infrastructure/db/schema.ts`:

```ts
export { usersTable } from '../../modules/auth/auth.table';
export { itemsTable } from '../../modules/items/items.table';
```

This file serves two purposes:
1. **Drizzle client** — passed to `drizzle(client, { schema })` so the ORM knows about all tables
2. **drizzle-kit** — the `db:generate` command reads this file to detect schema changes

When you add a new module, you must add its table export here.

## Migrations

### Drizzle Kit configuration

Defined in `apps/backend/drizzle.config.ts`:

```ts
export default {
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

### Workflow

Schema changes use file-based migrations. This gives you a versioned history of every change, committed to Git alongside the code.

```bash
# 1. Make changes to table definitions in [feature].table.ts
# 2. Export new tables from schema.ts (if adding a new module)

# 3. Generate a migration file
bun run --filter backend db:generate

# 4. Review the generated SQL in src/infrastructure/db/migrations/
# 5. Apply the migration locally
bun run --filter backend db:migrate

# 6. Run tests to verify everything works
bun test

# 7. Commit the migration file + schema changes and push
```

`db:generate` compares your current schema code against the previous snapshot and creates a new `.sql` file in `src/infrastructure/db/migrations/`. `db:migrate` applies all pending migrations to the database, tracking which ones have been applied in a `__drizzle_migrations` table.

### Production deployment

Migrations run automatically in the CD pipeline. The `deploy-api.yml` workflow executes `db:migrate` against the Turso production database before triggering the Render deploy. If a migration fails, the deploy is aborted.

This requires two GitHub repository secrets:
- `TURSO_DATABASE_URL` — your Turso database URL
- `TURSO_AUTH_TOKEN` — your Turso auth token

### Important notes

- Always review generated migration SQL before committing. `db:generate` does not connect to the database — it only compares schema files against local snapshots.
- Migrations are applied in order and only once. Drizzle tracks applied migrations in the `__drizzle_migrations` table.
- Migrations are **not reversible** by default. To roll back, create a new migration that undoes the change.
- For local development, you can delete `local.db` and re-run `db:migrate` to recreate the database from scratch.

## Querying patterns

Repositories use Drizzle's query builder. Common patterns:

```ts
// Select one row
const row = await db.select().from(usersTable).where(eq(usersTable.email, email)).get();

// Select multiple with pagination
const rows = await db
  .select()
  .from(itemsTable)
  .where(eq(itemsTable.userId, userId))
  .limit(limit)
  .offset(offset)
  .all();

// Count
const result = await db
  .select({ count: count() })
  .from(itemsTable)
  .where(eq(itemsTable.userId, userId))
  .get();

// Insert
await db.insert(usersTable).values({ id, email, name, passwordHash, createdAt });

// Update
await db
  .update(itemsTable)
  .set({ name, description, status, updatedAt })
  .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, userId)));

// Delete
await db
  .delete(itemsTable)
  .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, userId)));
```

Note the use of `and()` to scope queries by both `id` and `userId`. This ensures user isolation at the query level — a user can never accidentally access another user's data.

## Why Turso

- **Local dev, cloud prod**: Uses a local SQLite file in development (zero setup) and Turso's managed service in production.
- **Free tier**: 9 GB storage, 500M row reads/month — more than enough for personal projects and small apps.
- **SQLite compatible**: Same query semantics as SQLite. If you outgrow Turso, migrating to another SQLite-compatible service or self-hosted libSQL is straightforward.
- **Edge-ready**: Turso supports embedded replicas for low-latency reads at the edge, though this template doesn't use that feature.
- **Easy to swap**: Since repositories abstract the data layer, migrating to PostgreSQL later means changing the Drizzle driver and table definitions, not business logic.
