// This file is preloaded before any test file runs (configured in bunfig.toml).
// It sets required environment variables BEFORE any module import can touch env.ts,
// which performs top-level await and calls process.exit(1) if JWT_SECRET is missing.

process.env.JWT_SECRET = 'test-secret';
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.NODE_ENV = 'test';
// Disable rate limiting in tests to avoid 429s from sequential requests
process.env.RATE_LIMIT_MAX = '10000';
process.env.RATE_LIMIT_WINDOW_MS = '1';
