# Adding a Feature Module

This guide walks through adding a full-stack feature module from scratch. We'll use a hypothetical `tags` module as the example — a simple entity with a name and color that belongs to a user.

## Overview of steps

**Backend**
1. Define Zod schemas in `@repo/shared`
2. Create the Drizzle table
3. Export the table from the schema barrel
4. Build the domain entity
5. Create the repository
6. Create use-cases (one per operation)
7. Create the Hono sub-app (wires use-cases)
8. Mount the route in `app.ts`
9. Write tests (one file per use-case + one for the entity)
10. Generate and apply migration

**Frontend**
11. Create the domain layer (API client + validations + service)
12. Create the controller
13. Create the view
14. Add the route

## Step 1: Shared schemas

Create `packages/shared/src/schemas/tag.schema.ts`:

```ts
import { z } from 'zod';

export const createTagInputSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color'),
});

export const updateTagInputSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
});

export type CreateTagInput = z.infer<typeof createTagInputSchema>;
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;
export type TagResponse = z.infer<typeof tagResponseSchema>;
```

Then add the exports to `packages/shared/src/index.ts`:

```ts
export {
  createTagInputSchema,
  updateTagInputSchema,
  tagResponseSchema,
  type CreateTagInput,
  type UpdateTagInput,
  type TagResponse,
} from './schemas/tag.schema';
```

## Step 2: Drizzle table

Create `apps/backend/src/modules/tags/infrastructure/tags.table.ts`:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { usersTable } from '../../auth/infrastructure/auth.table';

export const tagsTable = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

## Step 3: Export from schema barrel

Add the table to `apps/backend/src/infrastructure/db/schema.ts`:

```ts
export { usersTable } from '../../modules/auth/infrastructure/auth.table';
export { itemsTable } from '../../modules/items/infrastructure/items.table';
export { tagsTable } from '../../modules/tags/infrastructure/tags.table';  // ← add this
```

This is necessary for Drizzle's migration generator to discover your table.

## Step 4: Domain entity

Create `apps/backend/src/modules/tags/domain/tag.ts`:

```ts
import { type Result, type AppError, ok, err, validationError } from '@repo/shared';
import type { TagResponse } from '@repo/shared';

export interface TagProps {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: Date;
}

export class Tag {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly userId: string;
  readonly createdAt: Date;

  private constructor(props: TagProps) {
    this.id = props.id;
    this.name = props.name;
    this.color = props.color;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
  }

  static create(name: string, color: string, userId: string): Result<Tag, AppError> {
    if (name.trim().length === 0) {
      return err(validationError('Tag name cannot be empty'));
    }
    if (name.length > 50) {
      return err(validationError('Tag name cannot exceed 50 characters'));
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return err(validationError('Color must be a valid hex color'));
    }

    return ok(new Tag({
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      userId,
      createdAt: new Date(),
    }));
  }

  static fromPersistence(props: TagProps): Tag {
    return new Tag(props);
  }

  updateDetails(name?: string, color?: string): Result<Tag, AppError> {
    if (name !== undefined && name.trim().length === 0) {
      return err(validationError('Tag name cannot be empty'));
    }

    return ok(new Tag({
      id: this.id,
      name: name !== undefined ? name.trim() : this.name,
      color: color ?? this.color,
      userId: this.userId,
      createdAt: this.createdAt,
    }));
  }

  toResponse(): TagResponse {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
```

**Key points:**
- The constructor is `private`. The only ways to create a `Tag` are `Tag.create()` (validates) and `Tag.fromPersistence()` (trusts existing data).
- `create()` returns `Result`, so callers must handle the failure case.
- `toResponse()` produces the shape defined by `TagResponse` in the shared schemas — no `userId` exposed to the client.

## Step 5: Repository

Create `apps/backend/src/modules/tags/infrastructure/tags.repository.ts`:

```ts
import { eq, and } from 'drizzle-orm';
import type { DB } from '../../../infrastructure/db/client';
import { tagsTable } from './tags.table';
import { Tag } from '../domain/tag';

export interface TagsRepository {
  findById(id: string, userId: string): Promise<Tag | null>;
  findAllByUser(userId: string): Promise<Tag[]>;
  create(tag: Tag): Promise<void>;
  update(tag: Tag): Promise<void>;
  delete(id: string, userId: string): Promise<boolean>;
}

export function createTagsRepository(db: DB): TagsRepository {
  return {
    async findById(id, userId) {
      const row = await db
        .select()
        .from(tagsTable)
        .where(and(eq(tagsTable.id, id), eq(tagsTable.userId, userId)))
        .get();
      if (!row) return null;
      return Tag.fromPersistence(row);
    },

    async findAllByUser(userId) {
      const rows = await db
        .select()
        .from(tagsTable)
        .where(eq(tagsTable.userId, userId))
        .all();
      return rows.map((row) => Tag.fromPersistence(row));
    },

    async create(tag) {
      await db.insert(tagsTable).values({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        userId: tag.userId,
        createdAt: tag.createdAt,
      });
    },

    async update(tag) {
      await db
        .update(tagsTable)
        .set({ name: tag.name, color: tag.color })
        .where(and(eq(tagsTable.id, tag.id), eq(tagsTable.userId, tag.userId)));
    },

    async delete(id, userId) {
      const existing = await db
        .select({ id: tagsTable.id })
        .from(tagsTable)
        .where(and(eq(tagsTable.id, id), eq(tagsTable.userId, userId)))
        .get();
      if (!existing) return false;

      await db.delete(tagsTable).where(and(eq(tagsTable.id, id), eq(tagsTable.userId, userId)));
      return true;
    },
  };
}
```

**Pattern:** The repository interface uses domain types (`Tag`), not raw DB rows. This keeps the use-cases decoupled from Drizzle. The factory function receives the `db` instance — same manual DI pattern used everywhere.

## Step 6: Use-cases

Create one file per operation in `apps/backend/src/modules/tags/use-cases/`. Each use-case is a **type alias for the function signature** plus a **factory function** that receives the repository.

### `create-tag.ts`

```ts
import {
  type Result, type AppError, type TagResponse,
  type CreateTagInput, ok,
} from '@repo/shared';
import { Tag } from '../domain/tag';
import type { TagsRepository } from '../infrastructure/tags.repository';

export type CreateTag = (
  input: CreateTagInput,
  userId: string,
) => Promise<Result<TagResponse, AppError>>;

export function createCreateTag(repository: TagsRepository): CreateTag {
  return async (input, userId) => {
    const result = Tag.create(input.name, input.color ?? '#6b7280', userId);
    if (!result.ok) return result;

    await repository.create(result.value);
    return ok(result.value.toResponse());
  };
}
```

### `get-tag.ts`

```ts
import {
  type Result, type AppError, type TagResponse,
  ok, err, notFoundError,
} from '@repo/shared';
import type { TagsRepository } from '../infrastructure/tags.repository';

export type GetTag = (
  id: string,
  userId: string,
) => Promise<Result<TagResponse, AppError>>;

export function createGetTag(repository: TagsRepository): GetTag {
  return async (id, userId) => {
    const tag = await repository.findById(id, userId);
    if (!tag) return err(notFoundError(`Tag with id '${id}' not found`));
    return ok(tag.toResponse());
  };
}
```

Follow the same pattern for `list-tags.ts`, `update-tag.ts`, `delete-tag.ts`.

**Key pattern:**
- Each file exports a **type** (the function signature) and a **factory** (creates the function with injected dependencies).
- The use-case function is a plain async function, not a method on an object.
- Domain logic stays in the entity; the use-case orchestrates repository calls and entity methods.

## Step 7: API routes

Create `apps/backend/src/modules/tags/tags.api.ts`:

```ts
import { Hono } from 'hono';
import { createTagInputSchema, updateTagInputSchema, type JwtPayload } from '@repo/shared';
import { db } from '../../infrastructure/db/client';
import { jwtGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import { createTagsRepository } from './infrastructure/tags.repository';
import { createCreateTag } from './use-cases/create-tag';
import { createGetTag } from './use-cases/get-tag';
import { createListTags } from './use-cases/list-tags';
import { createUpdateTag } from './use-cases/update-tag';
import { createDeleteTag } from './use-cases/delete-tag';

type Env = { Variables: { jwtPayload: JwtPayload } };

const tags = new Hono<Env>();
tags.use('*', jwtGuard);

// Wire use-cases
const repository = createTagsRepository(db);
const createTag = createCreateTag(repository);
const getTag = createGetTag(repository);
const listTags = createListTags(repository);
const updateTag = createUpdateTag(repository);
const deleteTag = createDeleteTag(repository);

tags.get('/', async (c) => {
  const { userId } = c.get('jwtPayload');
  const result = await listTags(userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

tags.post('/', async (c) => {
  const { userId } = c.get('jwtPayload');
  const body = await c.req.json();
  const parsed = createTagInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }, 400);
  }
  const result = await createTag(parsed.data, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value, 201);
});

// PATCH /:id, DELETE /:id — same pattern

export { tags as tagsApi };
```

The API file is the **composition root** for the module: it creates the repository, wires use-cases, and maps HTTP to use-case calls.

## Step 8: Mount in app.ts

Add one line to `apps/backend/src/app.ts`:

```ts
import { tagsApi } from './modules/tags/tags.api';

// Inside createApp():
app.route('/api/tags', tagsApi);
```

## Step 9: Write tests

Create test files in `apps/backend/src/modules/tags/tests/`:

### `tag.test.ts` — Entity tests

```ts
import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Tag } from '../domain/tag';

describe('Tag domain', () => {
  it('should create a valid tag', () => {
    const result = Tag.create('Important', '#ff0000', 'user-1');
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Important');
      expect(result.value.color).toBe('#ff0000');
    }
  });

  it('should reject empty name', () => {
    const result = Tag.create('', '#ff0000', 'user-1');
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
```

### `create-tag.test.ts` — Use-case test

```ts
import { describe, it, expect } from 'bun:test';
import { isOk, isErr } from '@repo/shared';
import { Tag } from '../domain/tag';
import type { TagsRepository } from '../infrastructure/tags.repository';
import { createCreateTag } from '../use-cases/create-tag';

function createMockRepository(): TagsRepository {
  const store = new Map<string, Tag>();
  return {
    async findById(id, userId) {
      const tag = store.get(id);
      if (!tag || tag.userId !== userId) return null;
      return tag;
    },
    async findAllByUser(userId) {
      return [...store.values()].filter((t) => t.userId === userId);
    },
    async create(tag) { store.set(tag.id, tag); },
    async update(tag) { store.set(tag.id, tag); },
    async delete(id, userId) {
      const tag = store.get(id);
      if (!tag || tag.userId !== userId) return false;
      store.delete(id);
      return true;
    },
  };
}

describe('CreateTag', () => {
  it('should create a tag successfully', async () => {
    const createTag = createCreateTag(createMockRepository());
    const result = await createTag({ name: 'Bug', color: '#ff0000' }, 'user-1');
    expect(isOk(result)).toBe(true);
  });

  it('should fail with empty name', async () => {
    const createTag = createCreateTag(createMockRepository());
    const result = await createTag({ name: '', color: '#ff0000' }, 'user-1');
    expect(isErr(result)).toBe(true);
  });
});
```

Create similar test files for each use-case: `get-tag.test.ts`, `list-tags.test.ts`, `update-tag.test.ts`, `delete-tag.test.ts`.

**Pattern:** Each test file creates a fresh mock repository and tests only the behavior of that specific use-case. The mock repository is a `Map`-based in-memory implementation of the interface.

## Step 10: Generate and apply migration

```bash
bun run --filter backend db:generate   # Generates a SQL migration file from schema changes
bun run --filter backend db:migrate    # Applies pending migrations to the local database
```

---

## Step 11: Domain layer (frontend)

Create three files under `apps/frontend/src/domain/tags/`.

### `tags.api.ts` — raw fetch calls

```ts
import { request } from '../../lib/api-client';
import type { TagResponse, CreateTagInput } from '@repo/shared';

export const tagsApi = {
  list: () => request<TagResponse[]>('/tags'),
  create: (data: CreateTagInput) =>
    request<TagResponse>('/tags', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tags/${id}`, { method: 'DELETE' }),
};
```

### `tags.validations.ts` — client-side Zod validation

```ts
import { createTagInputSchema } from '@repo/shared';
import { zodIssuesToFieldErrors, type ValidationResult } from '../validation';
import type { CreateTagInput } from '@repo/shared';

export function validateCreateTagInput(
  name: string,
  color: string,
): ValidationResult<CreateTagInput> {
  const result = createTagInputSchema.safeParse({ name, color });
  if (!result.success) {
    return { ok: false, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { ok: true, value: result.data };
}
```

### `tags.service.ts` — orchestrates validation + API

```ts
import { type TagResponse, type AppError, ok, internalError } from '@repo/shared';
import { type FieldErrors } from '../validation';
import { validateCreateTagInput } from './tags.validations';
import { tagsApi } from './tags.api';

export type TagServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; error: AppError };

export async function listTags(): Promise<
  { ok: true; value: TagResponse[] } | { ok: false; error: AppError }
> {
  try {
    return ok(await tagsApi.list());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}

export async function createTag(
  name: string,
  color: string,
): Promise<TagServiceResult<TagResponse>> {
  const validation = validateCreateTagInput(name, color);
  if (!validation.ok) return validation;

  try {
    return ok(await tagsApi.create(validation.value));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}
```

**Pattern:** The service is the only layer that calls both validation and API. Controllers never call `tagsApi` directly.

## Step 12: Controller (frontend)

Create `apps/frontend/src/pages/tags/tags.ctrl.ts`:

```ts
import { createStore } from 'solid-js/store';
import type { Navigator } from '@solidjs/router';
import { clearToken, isAuthenticated } from '../../lib/api-client';
import { listTags, createTag } from '../../domain/tags/tags.service';
import type { TagResponse } from '@repo/shared';
import type { FieldErrors } from '../../domain/validation';

export function createTagsCtrl(navigate: Navigator) {
  const [state, setState] = createStore({
    tags: [] as TagResponse[],
    newName: '',
    newColor: '#6b7280',
    loading: true,
    errors: {} as FieldErrors,
    generalError: '',
  });

  async function init() {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    await loadTags();
  }

  async function loadTags() {
    setState('loading', true);
    const result = await listTags();
    if (!result.ok) {
      clearToken();
      navigate('/login', { replace: true });
      return;
    }
    setState({ tags: result.value, loading: false });
  }

  async function handleCreate(e: Event) {
    e.preventDefault();
    setState({ errors: {}, generalError: '' });

    const result = await createTag(state.newName, state.newColor);
    if (!result.ok) {
      if ('fieldErrors' in result) {
        setState({ errors: result.fieldErrors });
      } else {
        setState({ generalError: result.error.message });
      }
      return;
    }
    setState('newName', '');
    await loadTags();
  }

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return { state, setState, init, handleCreate, handleLogout };
}
```

**Key points:**
- `createStore` for all page state — access without parentheses (`state.tags`, not `tags()`)
- `errors: {} as FieldErrors` — per-field validation errors populated by the service
- `generalError: ''` — for API/server errors that don't map to a specific field
- Always clear both at the start of a new submission
- Controllers never import from `*.api.ts` directly — only from `*.service.ts`

## Step 13: View (frontend)

Create `apps/frontend/src/pages/tags/Tags.tsx`:

```tsx
import { onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createTagsCtrl } from './tags.ctrl';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function Tags() {
  const navigate = useNavigate();
  const ctrl = createTagsCtrl(navigate);

  onMount(() => ctrl.init());

  return (
    <>
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Tags</h1>
        <Button variant="ghost" onClick={ctrl.handleLogout}>Sign out</Button>
      </div>

      {ctrl.state.generalError && (
        <div class="bg-danger-light text-danger text-sm rounded-lg px-4 py-3 mb-5">
          {ctrl.state.generalError}
        </div>
      )}

      <form onSubmit={ctrl.handleCreate} noValidate class="flex gap-3 mb-6">
        <Input
          value={ctrl.state.newName}
          onInput={(v) => ctrl.setState('newName', v)}
          placeholder="Tag name..."
          error={ctrl.state.errors.name}
          class="flex-1"
        />
        <Button type="submit">Add</Button>
      </form>

      <Show when={!ctrl.state.loading} fallback={<p class="text-gray-400 text-sm">Loading...</p>}>
        <Show when={ctrl.state.tags.length > 0} fallback={<p class="text-gray-400 text-sm">No tags yet.</p>}>
          <ul class="space-y-2">
            <For each={ctrl.state.tags}>
              {(tag) => (
                <li class="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <span class="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                  <span class="text-sm font-medium text-gray-900">{tag.name}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </>
  );
}
```

**Key points:**
- `noValidate` on the form — prevents the browser's native validation tooltip from appearing
- The view only reads `ctrl.state.*` and calls `ctrl.handle*` functions — no logic of its own
- `error={ctrl.state.errors.name}` — passes the per-field error directly to `<Input>`

## Step 14: Add the route

In `apps/frontend/src/index.tsx`, import the new page and add a `<Route>`:

```tsx
import Tags from './pages/tags/Tags';

// Inside the <Router>:
<Route path="/tags" component={Tags} />
```

## Final directory structure

```
modules/tags/                             # Backend
├── domain/
│   └── tag.ts                           # Entity class
├── infrastructure/
│   ├── tags.table.ts                    # Drizzle table definition
│   └── tags.repository.ts               # Interface + factory
├── use-cases/
│   ├── create-tag.ts                    # One factory function per operation
│   ├── get-tag.ts
│   ├── list-tags.ts
│   ├── update-tag.ts
│   └── delete-tag.ts
├── tests/
│   ├── tag.test.ts                      # Entity tests
│   ├── create-tag.test.ts               # One test file per use-case
│   ├── get-tag.test.ts
│   ├── list-tags.test.ts
│   ├── update-tag.test.ts
│   └── delete-tag.test.ts
└── tags.api.ts                          # Hono sub-app (composition root)

domain/tags/                             # Frontend
├── tags.api.ts                          # Raw fetch calls
├── tags.validations.ts                  # Client-side Zod validation
└── tags.service.ts                      # Orchestrates validation + API

pages/tags/                              # Frontend
├── tags.ctrl.ts                         # Controller (state + handlers)
└── Tags.tsx                             # View (renders ctrl state)
```

## Checklist

**Backend**
- [ ] Zod schemas in `packages/shared/src/schemas/`
- [ ] Schemas exported from `packages/shared/src/index.ts`
- [ ] Drizzle table in `modules/[feature]/infrastructure/[feature].table.ts`
- [ ] Table exported from `infrastructure/db/schema.ts`
- [ ] Domain entity in `modules/[feature]/domain/` with `create()`, `fromPersistence()`, `toResponse()`
- [ ] Repository interface + factory in `modules/[feature]/infrastructure/`
- [ ] Use-cases in `modules/[feature]/use-cases/` (one file per operation, returns `Result<T, AppError>`)
- [ ] Hono sub-app in `modules/[feature]/[feature].api.ts` wiring use-cases
- [ ] Route mounted in `app.ts`
- [ ] Tests in `modules/[feature]/tests/` (entity + one per use-case)
- [ ] Migration generated and applied (`db:generate` + `db:migrate`)

**Frontend**
- [ ] Domain API file in `domain/[feature]/[feature].api.ts` using `request()`
- [ ] Validations file in `domain/[feature]/[feature].validations.ts` returning `ValidationResult<T>`
- [ ] Service file in `domain/[feature]/[feature].service.ts` returning tagged union result
- [ ] Controller in `pages/[feature]/[feature].ctrl.ts` with `createStore`, `errors`, `generalError`
- [ ] View in `pages/[feature]/[feature].tsx` with `noValidate`, per-field `error` props
- [ ] Route added in `src/index.tsx`
