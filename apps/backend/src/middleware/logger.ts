import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';

// ---- Tipos públicos ----

export type LogLevel = 'info' | 'warn' | 'error';

export interface AppLogEntry {
  level: LogLevel;
  timestamp: string;
  request_id: string;
  event: string;
  [key: string]: unknown;
}

/**
 * Logger contextual ligado a un request_id.
 * Se inyecta en c.var.log desde el middleware y se pasa
 * como parámetro opcional a los use-cases que necesiten logear
 * eventos de negocio.
 *
 * @example
 * // En un use-case:
 * log?.info('skill_applied', { userId, skillId, before: 80, after: 100 })
 * log?.warn('unexpected_result', { userId, expected: 20, actual: 0 })
 */
export interface RequestLogger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  readonly requestId: string;
}

// ---- Configuración interna ----

const isDev = process.env.NODE_ENV !== 'production';
const LEVEL_RANK: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };
const minLevel = LEVEL_RANK[env.LOG_LEVEL];

// ---- Buffer + flush a Betterstack ----

const buffer: AppLogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

if (env.BETTERSTACK_SOURCE_TOKEN) {
  flushTimer = setInterval(flushBuffer, 1000);
  if (flushTimer.unref) flushTimer.unref();

  process.on('beforeExit', () => {
    flushBuffer();
  });
}

function flushBuffer() {
  if (!env.BETTERSTACK_SOURCE_TOKEN || buffer.length === 0) return;

  const entries = buffer.splice(0, buffer.length);

  fetch(`https://${env.BETTERSTACK_HOST}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.BETTERSTACK_SOURCE_TOKEN}`,
    },
    body: JSON.stringify(
      entries.map((e) => ({
        dt: e.timestamp,
        level: e.level,
        request_id: e.request_id,
        event: e.event,
        ...Object.fromEntries(
          Object.entries(e).filter(
            ([k]) => !['level', 'timestamp', 'request_id', 'event'].includes(k),
          ),
        ),
      })),
    ),
  }).catch(() => {
    // Fire-and-forget: si falla el envío a Betterstack, no rompemos la app
  });
}

// ---- Salida a stdout ----

function writeToStdout(entry: AppLogEntry) {
  if (isDev) {
    const colors: Record<LogLevel, string> = {
      info: '\x1b[36m',   // cyan
      warn: '\x1b[33m',   // yellow
      error: '\x1b[31m',  // red
    };
    const reset = '\x1b[0m';
    const { level, request_id, event, timestamp: _t, ...rest } = entry;
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    console.log(`${colors[level]}[${level.toUpperCase()}]${reset} [${request_id}] ${event}${extra}`);
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

// ---- Factory del logger contextual ----

export function createRequestLogger(requestId: string): RequestLogger {
  function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
    const entry: AppLogEntry = {
      level,
      timestamp: new Date().toISOString(),
      request_id: requestId,
      event,
      ...data,
    };

    writeToStdout(entry);

    // Solo enviar a Betterstack si el nivel supera el umbral configurado
    if (env.BETTERSTACK_SOURCE_TOKEN && LEVEL_RANK[level] >= minLevel) {
      buffer.push(entry);
      if (buffer.length >= 10) flushBuffer();
    }
  }

  return {
    requestId,
    info: (event, data) => log('info', event, data),
    warn: (event, data) => log('warn', event, data),
    error: (event, data) => log('error', event, data),
  };
}

// ---- Tipo Hono para c.var.log ----

export type LoggerEnv = {
  Variables: { log: RequestLogger };
};

// Paths that generate noise without value (browser auto-requests, static assets)
const SILENT_PATHS = new Set(['/favicon.ico', '/robots.txt']);

// ---- Middleware de request logging ----

export const structuredLogger = createMiddleware<LoggerEnv>(async (c, next) => {
  const requestId = randomUUID();
  const start = Date.now();

  c.header('X-Request-Id', requestId);

  const requestLog = createRequestLogger(requestId);
  c.set('log', requestLog);

  await next();

  // Skip logging for noisy paths that carry no business value
  if (SILENT_PATHS.has(c.req.path)) return;

  const duration = Date.now() - start;
  const status = c.res.status;
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  requestLog[level]('request', {
    method: c.req.method,
    path: c.req.path,
    status,
    duration_ms: duration,
  });
});
