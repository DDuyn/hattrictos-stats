import { type AuthResponse, type AppError, ok, internalError } from '@repo/shared';
import { type FieldErrors } from '../validation';
import { validateLoginInput, validateRegisterInput } from './auth.validations';
import { authApi, type UserProfile } from './auth.api';

export type { UserProfile };

export type AuthServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; error: AppError };

export async function login(
  email: string,
  password: string,
): Promise<AuthServiceResult<AuthResponse>> {
  const validation = validateLoginInput(email, password);
  if (!validation.ok) return validation;

  try {
    const response = await authApi.login(validation.value);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthServiceResult<AuthResponse>> {
  const validation = validateRegisterInput(email, password, name);
  if (!validation.ok) return validation;

  try {
    const response = await authApi.register(validation.value);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}

export async function fetchMe(): Promise<
  { ok: true; value: UserProfile } | { ok: false; error: AppError }
> {
  try {
    const response = await authApi.me();
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}
