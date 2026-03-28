import type { Config } from 'drizzle-kit';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// import.meta.dir is Bun-only and unavailable when Drizzle Kit bundles this
// file as CJS. We fall back to __dirname (always available in CJS) or derive
// the directory from import.meta.url when running as ESM.
const dir: string =
  typeof __dirname !== 'undefined'
    ? __dirname
    : typeof import.meta.url !== 'undefined'
      ? fileURLToPath(new URL('.', import.meta.url))
      : process.cwd();

const localDb = `file:${resolve(dir, 'local.db')}`;

export default {
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || localDb,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
