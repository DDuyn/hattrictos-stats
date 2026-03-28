// ---- Result Type ----

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Tried to unwrap an Err: ${JSON.stringify(result.error)}`);
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

// ---- Error Types ----

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
}

export function validationError(message: string): AppError {
  return { code: 'VALIDATION_ERROR', message };
}

export function notFoundError(message: string): AppError {
  return { code: 'NOT_FOUND', message };
}

export function unauthorizedError(message: string): AppError {
  return { code: 'UNAUTHORIZED', message };
}

export function conflictError(message: string): AppError {
  return { code: 'CONFLICT', message };
}

export function rateLimitedError(message: string): AppError {
  return { code: 'RATE_LIMITED', message };
}

export function internalError(message: string): AppError {
  return { code: 'INTERNAL_ERROR', message };
}
