import { createMiddleware } from "hono/factory";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter keyed by IP address.
 * Uses `x-forwarded-for` header (first IP) or falls back to connection info.
 */
export function createRateLimit({ windowMs, max }: RateLimitOptions) {
  const store = new Map<string, WindowEntry>();

  // Periodic cleanup to avoid unbounded memory growth (every windowMs)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, windowMs);

  // Allow GC in tests / serverless environments
  if (cleanup.unref) cleanup.unref();

  return createMiddleware(async (c, next) => {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count < max) {
      entry.count++;
      return next();
    }

    // Limit exceeded
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    c.header("Retry-After", String(retryAfterSec));
    return c.json(
      {
        code: "RATE_LIMITED",
        message: "Too many requests, please try again later.",
      },
      429,
    );
  });
}
