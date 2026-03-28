import type { ErrorCode } from "@repo/shared";
import type { Context, Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const STATUS_MAP: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function errorToStatus(code: ErrorCode): ContentfulStatusCode {
  return STATUS_MAP[code] ?? 500;
}

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const log = c.var.log;
    if (log) {
      log.error("unhandled_exception", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } else {
      console.error("Unhandled error:", error);
    }
    return c.json(
      { code: "INTERNAL_ERROR", message: "Internal server error" },
      500,
    );
  }
}
