import {
  loginInputSchema,
  registerInputSchema,
  type LoginInput,
  type RegisterInput,
} from '@repo/shared';
import { type ValidationResult, zodIssuesToFieldErrors } from '../validation';

export function validateLoginInput(email: string, password: string): ValidationResult<LoginInput> {
  const result = loginInputSchema.safeParse({ email, password });
  if (!result.success) {
    return { ok: false, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { ok: true, value: result.data };
}

export function validateRegisterInput(
  email: string,
  password: string,
  name: string,
): ValidationResult<RegisterInput> {
  const result = registerInputSchema.safeParse({ email, password, name });
  if (!result.success) {
    return { ok: false, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { ok: true, value: result.data };
}
