import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

async function loadDotEnvFromRoot() {
  const rootEnv = resolve(import.meta.dir, "../../../../.env");
  if (existsSync(rootEnv)) {
    const file = Bun.file(rootEnv);
    const text = await file.text();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

await loadDotEnvFromRoot();

const localDbDefault = `file:${resolve(import.meta.dir, "../../../local.db")}`;

const isDev = process.env.NODE_ENV !== "production";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  TURSO_DATABASE_URL: z.string().default(localDbDefault),
  TURSO_AUTH_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(10),
  BETTERSTACK_SOURCE_TOKEN: z.string().optional(),
  BETTERSTACK_HOST: z.string().default("in.logs.betterstack.com"),
  LOG_LEVEL: z.enum(["info", "warn", "error"]).default(isDev ? "info" : "warn"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
