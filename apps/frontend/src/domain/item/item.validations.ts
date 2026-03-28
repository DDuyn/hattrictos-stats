import { createItemInputSchema, type CreateItemInput } from '@repo/shared';
import { type ValidationResult, zodIssuesToFieldErrors } from '../validation';

export function validateCreateItemInput(
  name: string,
  description?: string,
): ValidationResult<CreateItemInput> {
  const result = createItemInputSchema.safeParse({ name, description });
  if (!result.success) {
    return { ok: false, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { ok: true, value: result.data };
}
