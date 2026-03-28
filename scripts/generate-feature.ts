#!/usr/bin/env bun
/**
 * Feature Generator Script
 *
 * Generates a complete CRUD module (backend + shared) for a given feature name.
 *
 * Usage:
 *   bun run generate feature <name>
 *
 * Example:
 *   bun run generate feature task
 *
 * What it creates (using "task" as example):
 *   packages/shared/src/schemas/task.schema.ts
 *   apps/backend/src/modules/tasks/domain/task.ts
 *   apps/backend/src/modules/tasks/infrastructure/tasks.table.ts
 *   apps/backend/src/modules/tasks/infrastructure/tasks.repository.ts
 *   apps/backend/src/modules/tasks/use-cases/create-task.ts
 *   apps/backend/src/modules/tasks/use-cases/get-task.ts
 *   apps/backend/src/modules/tasks/use-cases/list-tasks.ts
 *   apps/backend/src/modules/tasks/use-cases/update-task.ts
 *   apps/backend/src/modules/tasks/use-cases/delete-task.ts
 *   apps/backend/src/modules/tasks/tasks.api.ts
 *   apps/backend/src/modules/tasks/tests/task.test.ts
 *   apps/backend/src/modules/tasks/tests/create-task.test.ts
 *
 * What it modifies:
 *   packages/shared/src/index.ts           — adds schema exports
 *   apps/backend/src/infrastructure/db/schema.ts — adds table export
 *   apps/backend/src/app.ts                — adds route
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args[0] !== 'feature' || !args[1]) {
  console.error('\nUsage: bun run generate feature <name>\n');
  console.error('  Example: bun run generate feature task\n');
  process.exit(1);
}

const rawName = args[1].trim().toLowerCase();

// Validate: only lowercase letters and hyphens
if (!/^[a-z][a-z0-9-]*$/.test(rawName)) {
  console.error(`\nError: feature name must start with a letter and contain only lowercase letters, digits, and hyphens.\n`);
  process.exit(1);
}

// ─── Naming conventions ───────────────────────────────────────────────────────

/**
 * Given "task" or "user-profile":
 *   singular = "task" | "user-profile"
 *   plural   = "tasks" | "user-profiles"
 *   Pascal   = "Task" | "UserProfile"
 *   PluralPascal = "Tasks" | "UserProfiles"
 */

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function pluralize(str: string): string {
  if (str.endsWith('y') && !str.endsWith('ay') && !str.endsWith('ey') && !str.endsWith('oy') && !str.endsWith('uy')) {
    return str.slice(0, -1) + 'ies';
  }
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('z') || str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es';
  }
  return str + 's';
}

const singular = rawName;                         // "task"
const plural = pluralize(rawName);                // "tasks"
const Pascal = toPascalCase(singular);            // "Task"
const PluralPascal = toPascalCase(plural);        // "Tasks"
const camelPlural = plural.charAt(0).toLowerCase() + toPascalCase(plural).slice(1); // "tasks"

// API export: tasksApi
const apiExport = `${camelPlural}Api`;

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dir, '..');
const BACKEND = resolve(ROOT, 'apps/backend');
const SHARED = resolve(ROOT, 'packages/shared');

const MODULE_DIR = resolve(BACKEND, `src/modules/${plural}`);

// Check for conflicts
if (existsSync(MODULE_DIR)) {
  console.error(`\nError: module "${plural}" already exists at ${MODULE_DIR}\n`);
  process.exit(1);
}

const SCHEMA_FILE = resolve(SHARED, `src/schemas/${singular}.schema.ts`);
if (existsSync(SCHEMA_FILE)) {
  console.error(`\nError: schema "${singular}.schema.ts" already exists at ${SCHEMA_FILE}\n`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let changes = 0;

function log(msg: string) {
  console.log(`  ✓ ${msg}`);
}

async function writeFile(filePath: string, content: string, label: string) {
  const dir = resolve(filePath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await Bun.write(filePath, content);
  log(label);
  changes++;
}

async function editFile(filePath: string, search: string, replacement: string, label: string) {
  if (!existsSync(filePath)) {
    console.error(`\nError: file not found for editing: ${filePath}\n`);
    process.exit(1);
  }
  const content = await Bun.file(filePath).text();
  if (!content.includes(search)) {
    console.error(`\nError: could not find insertion point in ${filePath}\nSearched for:\n${search}\n`);
    process.exit(1);
  }
  await Bun.write(filePath, content.replace(search, replacement));
  log(label);
  changes++;
}

// ─── Start ────────────────────────────────────────────────────────────────────

console.log(`\nGenerating feature "${singular}"...\n`);

// ─── 1. Shared schema ─────────────────────────────────────────────────────────

await writeFile(
  SCHEMA_FILE,
  `import { z } from 'zod';

export const create${Pascal}InputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
});

export const update${Pascal}InputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const ${singular}ResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Create${Pascal}Input = z.infer<typeof create${Pascal}InputSchema>;
export type Update${Pascal}Input = z.infer<typeof update${Pascal}InputSchema>;
export type ${Pascal}Response = z.infer<typeof ${singular}ResponseSchema>;
`,
  `Created packages/shared/src/schemas/${singular}.schema.ts`,
);

// ─── 2. Domain entity ─────────────────────────────────────────────────────────

await writeFile(
  resolve(MODULE_DIR, `domain/${singular}.ts`),
  `import {
  type Result,
  type AppError,
  ok,
  err,
  validationError,
} from '@repo/shared';
import type { ${Pascal}Response } from '@repo/shared';

export interface ${Pascal}Props {
  id: string;
  name: string;
  description: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ${Pascal} {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly userId: string;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ${Pascal}Props) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(
    name: string,
    description: string,
    userId: string,
  ): Result<${Pascal}, AppError> {
    if (name.trim().length === 0) {
      return err(validationError('${Pascal} name cannot be empty'));
    }
    if (name.length > 200) {
      return err(validationError('${Pascal} name cannot exceed 200 characters'));
    }
    if (description.length > 1000) {
      return err(validationError('${Pascal} description cannot exceed 1000 characters'));
    }

    const now = new Date();
    return ok(
      new ${Pascal}({
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromPersistence(props: ${Pascal}Props): ${Pascal} {
    return new ${Pascal}(props);
  }

  updateDetails(
    name?: string,
    description?: string,
  ): Result<${Pascal}, AppError> {
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return err(validationError('${Pascal} name cannot be empty'));
      }
      if (name.length > 200) {
        return err(validationError('${Pascal} name cannot exceed 200 characters'));
      }
    }
    if (description !== undefined && description.length > 1000) {
      return err(validationError('${Pascal} description cannot exceed 1000 characters'));
    }

    return ok(
      new ${Pascal}({
        id: this.id,
        name: name !== undefined ? name.trim() : this.name,
        description: description !== undefined ? description.trim() : this.description,
        userId: this.userId,
        createdAt: this.createdAt,
        updatedAt: new Date(),
      }),
    );
  }

  toResponse(): ${Pascal}Response {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      userId: this.userId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
`,
  `Created apps/backend/src/modules/${plural}/domain/${singular}.ts`,
);

// ─── 3. Drizzle table ─────────────────────────────────────────────────────────

await writeFile(
  resolve(MODULE_DIR, `infrastructure/${plural}.table.ts`),
  `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { usersTable } from '../../auth/infrastructure/auth.table';

export const ${camelPlural}Table = sqliteTable('${plural}', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .\$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .\$defaultFn(() => new Date()),
});
`,
  `Created apps/backend/src/modules/${plural}/infrastructure/${plural}.table.ts`,
);

// ─── 4. Repository ────────────────────────────────────────────────────────────

await writeFile(
  resolve(MODULE_DIR, `infrastructure/${plural}.repository.ts`),
  `import { eq, and, count } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import { ${camelPlural}Table } from './${plural}.table';
import { ${Pascal} } from '../domain/${singular}';

export interface ${PluralPascal}Repository {
  findById(id: string, userId: string): Promise<${Pascal} | null>;
  findAllByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ${Pascal}[]; total: number }>;
  create(${singular}: ${Pascal}): Promise<void>;
  update(${singular}: ${Pascal}): Promise<void>;
  delete(id: string, userId: string): Promise<boolean>;
}

export function create${PluralPascal}Repository(db: DB): ${PluralPascal}Repository {
  return {
    async findById(id, userId) {
      const row = await db
        .select()
        .from(${camelPlural}Table)
        .where(and(eq(${camelPlural}Table.id, id), eq(${camelPlural}Table.userId, userId)))
        .get();
      if (!row) return null;
      return ${Pascal}.fromPersistence(row);
    },

    async findAllByUser(userId, page, limit) {
      const offset = (page - 1) * limit;
      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(${camelPlural}Table)
          .where(eq(${camelPlural}Table.userId, userId))
          .limit(limit)
          .offset(offset)
          .all(),
        db
          .select({ count: count() })
          .from(${camelPlural}Table)
          .where(eq(${camelPlural}Table.userId, userId))
          .get(),
      ]);

      return {
        items: rows.map((row) => ${Pascal}.fromPersistence(row)),
        total: totalResult?.count ?? 0,
      };
    },

    async create(${singular}) {
      await db.insert(${camelPlural}Table).values({
        id: ${singular}.id,
        name: ${singular}.name,
        description: ${singular}.description,
        userId: ${singular}.userId,
        createdAt: ${singular}.createdAt,
        updatedAt: ${singular}.updatedAt,
      });
    },

    async update(${singular}) {
      await db
        .update(${camelPlural}Table)
        .set({
          name: ${singular}.name,
          description: ${singular}.description,
          updatedAt: ${singular}.updatedAt,
        })
        .where(and(eq(${camelPlural}Table.id, ${singular}.id), eq(${camelPlural}Table.userId, ${singular}.userId)));
    },

    async delete(id, userId) {
      const row = await db
        .select({ id: ${camelPlural}Table.id })
        .from(${camelPlural}Table)
        .where(and(eq(${camelPlural}Table.id, id), eq(${camelPlural}Table.userId, userId)))
        .get();
      if (!row) return false;

      await db
        .delete(${camelPlural}Table)
        .where(and(eq(${camelPlural}Table.id, id), eq(${camelPlural}Table.userId, userId)));
      return true;
    },
  };
}
`,
  `Created apps/backend/src/modules/${plural}/infrastructure/${plural}.repository.ts`,
);

// ─── 5. Use-cases ─────────────────────────────────────────────────────────────

await writeFile(
  resolve(MODULE_DIR, `use-cases/create-${singular}.ts`),
  `import {
  type Result,
  type AppError,
  ok,
} from '@repo/shared';
import type { ${Pascal}Response, Create${Pascal}Input } from '@repo/shared';
import { ${Pascal} } from '../domain/${singular}';
import type { ${PluralPascal}Repository } from '../infrastructure/${plural}.repository';

export type Create${Pascal} = (
  input: Create${Pascal}Input,
  userId: string,
) => Promise<Result<${Pascal}Response, AppError>>;

export function createCreate${Pascal}(repository: ${PluralPascal}Repository): Create${Pascal} {
  return async (input, userId) => {
    const result = ${Pascal}.create(input.name, input.description ?? '', userId);
    if (!result.ok) return result;

    const ${singular} = result.value;
    await repository.create(${singular});
    return ok(${singular}.toResponse());
  };
}
`,
  `Created apps/backend/src/modules/${plural}/use-cases/create-${singular}.ts`,
);

await writeFile(
  resolve(MODULE_DIR, `use-cases/get-${singular}.ts`),
  `import {
  type Result,
  type AppError,
  ok,
  err,
  notFoundError,
} from '@repo/shared';
import type { ${Pascal}Response } from '@repo/shared';
import type { ${PluralPascal}Repository } from '../infrastructure/${plural}.repository';

export type Get${Pascal} = (
  id: string,
  userId: string,
) => Promise<Result<${Pascal}Response, AppError>>;

export function createGet${Pascal}(repository: ${PluralPascal}Repository): Get${Pascal} {
  return async (id, userId) => {
    const ${singular} = await repository.findById(id, userId);
    if (!${singular}) {
      return err(notFoundError(\`${Pascal} with id '\${id}' not found\`));
    }
    return ok(${singular}.toResponse());
  };
}
`,
  `Created apps/backend/src/modules/${plural}/use-cases/get-${singular}.ts`,
);

await writeFile(
  resolve(MODULE_DIR, `use-cases/list-${plural}.ts`),
  `import {
  type Result,
  type AppError,
  type PaginatedResponse,
  ok,
} from '@repo/shared';
import type { ${Pascal}Response } from '@repo/shared';
import type { ${PluralPascal}Repository } from '../infrastructure/${plural}.repository';

export type List${PluralPascal} = (
  userId: string,
  page: number,
  limit: number,
) => Promise<Result<PaginatedResponse<${Pascal}Response>, AppError>>;

export function createList${PluralPascal}(repository: ${PluralPascal}Repository): List${PluralPascal} {
  return async (userId, page, limit) => {
    const { items, total } = await repository.findAllByUser(userId, page, limit);
    return ok({
      items: items.map((${singular}) => ${singular}.toResponse()),
      total,
      page,
      limit,
    });
  };
}
`,
  `Created apps/backend/src/modules/${plural}/use-cases/list-${plural}.ts`,
);

await writeFile(
  resolve(MODULE_DIR, `use-cases/update-${singular}.ts`),
  `import {
  type Result,
  type AppError,
  ok,
  err,
  notFoundError,
} from '@repo/shared';
import type { ${Pascal}Response, Update${Pascal}Input } from '@repo/shared';
import type { ${PluralPascal}Repository } from '../infrastructure/${plural}.repository';

export type Update${Pascal} = (
  id: string,
  input: Update${Pascal}Input,
  userId: string,
) => Promise<Result<${Pascal}Response, AppError>>;

export function createUpdate${Pascal}(repository: ${PluralPascal}Repository): Update${Pascal} {
  return async (id, input, userId) => {
    const ${singular} = await repository.findById(id, userId);
    if (!${singular}) {
      return err(notFoundError(\`${Pascal} with id '\${id}' not found\`));
    }

    const updateResult = ${singular}.updateDetails(input.name, input.description);
    if (!updateResult.ok) return updateResult;

    const updated = updateResult.value;
    await repository.update(updated);
    return ok(updated.toResponse());
  };
}
`,
  `Created apps/backend/src/modules/${plural}/use-cases/update-${singular}.ts`,
);

await writeFile(
  resolve(MODULE_DIR, `use-cases/delete-${singular}.ts`),
  `import { type Result, type AppError, ok, err, notFoundError } from '@repo/shared';
import type { ${PluralPascal}Repository } from '../infrastructure/${plural}.repository';

export type Delete${Pascal} = (
  id: string,
  userId: string,
) => Promise<Result<void, AppError>>;

export function createDelete${Pascal}(repository: ${PluralPascal}Repository): Delete${Pascal} {
  return async (id, userId) => {
    const deleted = await repository.delete(id, userId);
    if (!deleted) {
      return err(notFoundError(\`${Pascal} with id '\${id}' not found\`));
    }
    return ok(undefined);
  };
}
`,
  `Created apps/backend/src/modules/${plural}/use-cases/delete-${singular}.ts`,
);

// ─── 6. API router ────────────────────────────────────────────────────────────

await writeFile(
  resolve(MODULE_DIR, `${plural}.api.ts`),
  `import { Hono } from 'hono';
import {
  create${Pascal}InputSchema,
  update${Pascal}InputSchema,
  paginationSchema,
  type JwtPayload,
} from '@repo/shared';
import { db } from '../../infrastructure/db/client';
import { jwtGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import { create${PluralPascal}Repository } from './infrastructure/${plural}.repository';
import { createCreate${Pascal} } from './use-cases/create-${singular}';
import { createGet${Pascal} } from './use-cases/get-${singular}';
import { createList${PluralPascal} } from './use-cases/list-${plural}';
import { createUpdate${Pascal} } from './use-cases/update-${singular}';
import { createDelete${Pascal} } from './use-cases/delete-${singular}';

type Env = { Variables: { jwtPayload: JwtPayload } };

const ${camelPlural} = new Hono<Env>();
${camelPlural}.use('*', jwtGuard);

const repository = create${PluralPascal}Repository(db);
const create${Pascal} = createCreate${Pascal}(repository);
const get${Pascal} = createGet${Pascal}(repository);
const list${PluralPascal} = createList${PluralPascal}(repository);
const update${Pascal} = createUpdate${Pascal}(repository);
const delete${Pascal} = createDelete${Pascal}(repository);

// GET /api/${plural}
${camelPlural}.get('/', async (c) => {
  const { userId } = c.get('jwtPayload');
  const query = c.req.query();
  const parsed = paginationSchema.safeParse(query);
  const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };

  const result = await list${PluralPascal}(userId, page, limit);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// GET /api/${plural}/:id
${camelPlural}.get('/:id', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();

  const result = await get${Pascal}(id, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// POST /api/${plural}
${camelPlural}.post('/', async (c) => {
  const { userId } = c.get('jwtPayload');
  const body = await c.req.json();
  const parsed = create${Pascal}InputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }, 400);
  }

  const result = await create${Pascal}(parsed.data, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value, 201);
});

// PATCH /api/${plural}/:id
${camelPlural}.patch('/:id', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = update${Pascal}InputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }, 400);
  }

  const result = await update${Pascal}(id, parsed.data, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// DELETE /api/${plural}/:id
${camelPlural}.delete('/:id', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();

  const result = await delete${Pascal}(id, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.body(null, 204);
});

export { ${camelPlural} as ${apiExport} };
`,
  `Created apps/backend/src/modules/${plural}/${plural}.api.ts`,
);

// ─── 7. Tests ─────────────────────────────────────────────────────────────────

await writeFile(
  resolve(MODULE_DIR, `tests/${singular}.test.ts`),
  `import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { ${Pascal} } from '../domain/${singular}';

const USER_ID = 'user-1';

describe('${Pascal} domain', () => {
  it('should create a valid ${singular}', () => {
    const result = ${Pascal}.create('Test ${Pascal}', 'A description', USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Test ${Pascal}');
      expect(result.value.userId).toBe(USER_ID);
    }
  });

  it('should reject empty name', () => {
    const result = ${Pascal}.create('', 'desc', USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should update name and description', () => {
    const createResult = ${Pascal}.create('Original', 'Original desc', USER_ID);
    if (!createResult.ok) return;

    const updateResult = createResult.value.updateDetails('Updated', 'New desc');
    expect(isOk(updateResult)).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.value.name).toBe('Updated');
      expect(updateResult.value.description).toBe('New desc');
    }
  });

  it('should produce a valid response', () => {
    const createResult = ${Pascal}.create('Test', 'desc', USER_ID);
    if (!createResult.ok) return;

    const response = createResult.value.toResponse();
    expect(response.name).toBe('Test');
    expect(response.createdAt).toBeDefined();
    expect(response.updatedAt).toBeDefined();
  });
});
`,
  `Created apps/backend/src/modules/${plural}/tests/${singular}.test.ts`,
);

await writeFile(
  resolve(MODULE_DIR, `tests/create-${singular}.test.ts`),
  `import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { createCreate${Pascal} } from '../use-cases/create-${singular}';
import { createMock${PluralPascal}Repository } from './__helpers__/mock-${plural}-repository';

const USER_ID = 'user-1';

describe('Create${Pascal}', () => {
  it('should create a ${singular} successfully', async () => {
    const create${Pascal} = createCreate${Pascal}(createMock${PluralPascal}Repository());

    const result = await create${Pascal}({ name: 'My ${Pascal}', description: 'desc' }, USER_ID);
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('My ${Pascal}');
      expect(result.value.userId).toBe(USER_ID);
    }
  });

  it('should fail with empty name', async () => {
    const create${Pascal} = createCreate${Pascal}(createMock${PluralPascal}Repository());

    const result = await create${Pascal}({ name: '', description: 'desc' }, USER_ID);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
`,
  `Created apps/backend/src/modules/${plural}/tests/create-${singular}.test.ts`,
);

await writeFile(
  resolve(MODULE_DIR, `tests/__helpers__/mock-${plural}-repository.ts`),
  `import { ${Pascal} } from '../../domain/${singular}';
import type { ${PluralPascal}Repository } from '../../infrastructure/${plural}.repository';

/**
 * Creates an in-memory ${PluralPascal}Repository for unit tests.
 */
export function createMock${PluralPascal}Repository(${plural}: ${Pascal}[] = []): ${PluralPascal}Repository {
  const store = new Map<string, ${Pascal}>();

  for (const ${singular} of ${plural}) {
    store.set(${singular}.id, ${singular});
  }

  return {
    async findById(id, userId) {
      const ${singular} = store.get(id);
      if (!${singular} || ${singular}.userId !== userId) return null;
      return ${singular};
    },
    async findAllByUser(userId, page, limit) {
      const all = [...store.values()].filter((r) => r.userId === userId);
      const offset = (page - 1) * limit;
      return { items: all.slice(offset, offset + limit), total: all.length };
    },
    async create(${singular}) {
      store.set(${singular}.id, ${singular});
    },
    async update(${singular}) {
      store.set(${singular}.id, ${singular});
    },
    async delete(id, userId) {
      const ${singular} = store.get(id);
      if (!${singular} || ${singular}.userId !== userId) return false;
      store.delete(id);
      return true;
    },
  };
}
`,
  `Created apps/backend/src/modules/${plural}/tests/__helpers__/mock-${plural}-repository.ts`,
);

// ─── 8. Modify shared/src/index.ts ───────────────────────────────────────────

const sharedIndexPath = resolve(SHARED, 'src/index.ts');
const newSchemaExport = `\nexport {
  create${Pascal}InputSchema,
  update${Pascal}InputSchema,
  ${singular}ResponseSchema,
  type Create${Pascal}Input,
  type Update${Pascal}Input,
  type ${Pascal}Response,
} from './schemas/${singular}.schema';\n`;

{
  const currentContent = await Bun.file(sharedIndexPath).text();
  const appended = currentContent.trimEnd() + newSchemaExport;
  await Bun.write(sharedIndexPath, appended);
  log(`Updated packages/shared/src/index.ts — added ${singular} schema exports`);
  changes++;
}

// ─── 9. Modify infrastructure/db/schema.ts ───────────────────────────────────

const schemaPath = resolve(BACKEND, 'src/infrastructure/db/schema.ts');
const schemaContent = await Bun.file(schemaPath).text();
const newTableExport = `export { ${camelPlural}Table } from '../../modules/${plural}/infrastructure/${plural}.table';\n`;

await Bun.write(schemaPath, schemaContent.trimEnd() + '\n' + newTableExport);
log(`Updated apps/backend/src/infrastructure/db/schema.ts — added ${camelPlural}Table export`);
changes++;

// ─── 10. Modify app.ts ───────────────────────────────────────────────────────

const appPath = resolve(BACKEND, 'src/app.ts');
const appContent = await Bun.file(appPath).text();

// Find the last app.route(...) line to insert after
const lastRouteMatch = appContent.lastIndexOf("  app.route('");
if (lastRouteMatch === -1) {
  console.error('\nError: could not find app.route() in app.ts\n');
  process.exit(1);
}
const insertPos = appContent.indexOf('\n', lastRouteMatch) + 1;

// Build new import line (insert after last existing import from modules)
const lastImportFromModules = appContent.lastIndexOf("from './modules/");
const importLineEnd = appContent.indexOf('\n', lastImportFromModules) + 1;
const newImport = `import { ${apiExport} } from './modules/${plural}/${plural}.api';\n`;
const newRoute = `  app.route('/api/${plural}', ${apiExport});\n`;

let modified = appContent.slice(0, importLineEnd) + newImport + appContent.slice(importLineEnd);
// Recalculate insertPos after import insertion
const insertPosNew = modified.lastIndexOf("  app.route('");
const insertPosEnd = modified.indexOf('\n', insertPosNew) + 1;
modified = modified.slice(0, insertPosEnd) + newRoute + modified.slice(insertPosEnd);

await Bun.write(appPath, modified);
log(`Updated apps/backend/src/app.ts — added ${apiExport} route`);
changes++;

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\nDone! ${changes} files created/modified.\n`);
console.log('Next steps:');
console.log(`  1. bun run db:generate    # Generate migration for the new ${plural} table`);
console.log('  2. bun run db:migrate     # Apply migration to local database');
console.log(`  3. bun run typecheck      # Verify types`);
console.log(`  4. bun run test           # Run tests\n`);
