import { loginInputSchema, type LoginInput } from '@hattrictos-stats/shared';
import { type ValidationResult, zodIssuesToFieldErrors } from '../validation';

export function validateLoginInput(email: string, password: string): ValidationResult<LoginInput> {
  const result = loginInputSchema.safeParse({ email, password });
  if (!result.success) {
    return { ok: false, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { ok: true, value: result.data };
}
