/**
 * Frontend-only validation types.
 * Per-field errors are a UI concern — AppError from @repo/shared remains unchanged.
 */

/** Map of field name → error message for inline form validation. */
export type FieldErrors = Record<string, string>;

/** Result of a validation-only operation (before any API call). */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors };

/** Extract the first error per field from Zod issues. */
export function zodIssuesToFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '_');
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
