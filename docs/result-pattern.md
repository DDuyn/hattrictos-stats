# The Result Pattern

## What it is

Instead of throwing exceptions for expected failures (validation errors, not-found, unauthorized), every service method returns a `Result<T, E>` — a discriminated union that is either a success value or an error value.

Defined in `packages/shared/src/result.ts`:

```ts
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
```

## Why we use it

**Throws are invisible.** When a function signature says `login(input: LoginInput): Promise<AuthResponse>`, you have no idea it might throw `UnauthorizedError` or `ConflictError`. You'd have to read the implementation or hope the docs are accurate. With `Result`, the signature tells you: `login(input: LoginInput): Promise<Result<AuthResponse, AppError>>` — failure is part of the type.

**Forced handling.** TypeScript won't let you access `result.value` without first checking `result.ok`. This eliminates an entire class of bugs where you forget to handle an error case.

**No try/catch chains.** Services call other services and domain methods. With throws, you'd need nested try/catch blocks to handle different error types. With Result, you simply check `if (!result.ok) return result;` and the error propagates naturally.

**Testing is simpler.** You assert on the returned Result value instead of catching exceptions:

```ts
const result = await service.login({ email: 'wrong@test.com', password: 'x' });
expect(isErr(result)).toBe(true);
if (!result.ok) {
  expect(result.error.code).toBe('UNAUTHORIZED');
}
```

## The API

### Constructors

```ts
import { ok, err } from '@repo/shared';

ok(value)    // → { ok: true, value }
err(error)   // → { ok: false, error }
```

### Type guards

```ts
import { isOk, isErr } from '@repo/shared';

if (isOk(result)) {
  // TypeScript narrows: result.value is available
}
if (isErr(result)) {
  // TypeScript narrows: result.error is available
}
```

### Utilities

```ts
import { unwrap, map } from '@repo/shared';

// unwrap — get the value or throw (use sparingly, mainly in tests)
const value = unwrap(result);

// map — transform the success value
const mapped = map(result, (user) => user.toResponse());
```

## AppError

Every error in the system is an `AppError`:

```ts
export interface AppError {
  code: ErrorCode;
  message: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';
```

Factory functions make creating errors concise:

```ts
import { validationError, notFoundError, unauthorizedError, conflictError, internalError } from '@repo/shared';

validationError('Name cannot be empty')    // { code: 'VALIDATION_ERROR', message: '...' }
notFoundError('Item not found')            // { code: 'NOT_FOUND', message: '...' }
unauthorizedError('Invalid credentials')   // { code: 'UNAUTHORIZED', message: '...' }
conflictError('Email already exists')      // { code: 'CONFLICT', message: '...' }
internalError('Something went wrong')      // { code: 'INTERNAL_ERROR', message: '...' }
```

## Mapping ErrorCode to HTTP status

The error handler middleware (`middleware/error-handler.ts:6`) maps each `ErrorCode` to an HTTP status code:

```ts
const STATUS_MAP: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};
```

In the API layer, this mapping is used when a service returns an error:

```ts
const result = await service.create(parsed.data, userId);
if (!result.ok) {
  return c.json(result.error, errorToStatus(result.error.code));
}
return c.json(result.value, 201);
```

The `AppError` object (`{ code, message }`) is sent directly as the JSON response body. This gives the client a machine-readable `code` and a human-readable `message`.

## Usage patterns

### In domain entities

Domain entities return `Result` from factory methods and state transitions:

```ts
// items.domain.ts
static create(name: string, description: string, userId: string): Result<Item, AppError> {
  if (name.trim().length === 0) {
    return err(validationError('Item name cannot be empty'));
  }
  return ok(new Item({ /* ... */ }));
}

activate(): Result<Item, AppError> {
  if (this._status === 'active') {
    return err(validationError('Item is already active'));
  }
  this._status = 'active';
  return ok(this);
}
```

### In services

Services chain Results, propagating errors up:

```ts
// items.service.ts
async update(id, input, userId) {
  // Step 1: Find the item (might be NOT_FOUND)
  const result = await getItemOrFail(id, userId);
  if (!result.ok) return result;  // propagate error

  // Step 2: Update details (might be VALIDATION_ERROR)
  const updateResult = result.value.updateDetails(input.name, input.description);
  if (!updateResult.ok) return updateResult;  // propagate error

  // Step 3: Persist and return success
  await repository.update(updateResult.value);
  return ok(updateResult.value.toResponse());
}
```

### In API handlers

The API layer is the boundary where Results become HTTP responses:

```ts
// items.api.ts
const result = await service.activate(id, userId);
if (!result.ok) {
  return c.json(result.error, errorToStatus(result.error.code));
}
return c.json(result.value);
```

## When exceptions are still appropriate

The Result pattern is for **expected** business failures. Unexpected errors (database connection lost, out of memory, corrupted state) should still throw. The global error handler middleware catches these:

```ts
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Unhandled error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
  }
}
```

This gives us the best of both worlds: explicit error handling for business logic, and a safety net for truly exceptional situations.
