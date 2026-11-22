import { z } from "zod";

/**
 * Runtime environment validation.
 *
 * Fail fast: a missing or typo'd variable should crash at boot with a readable
 * message instead of surfacing as an obscure error inside a request handler.
 *
 * Fields are listed explicitly (rather than passing all of `process.env`) so
 * the schema documents exactly what the app depends on.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Pooled Postgres connection string (Neon "-pooler" host). */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Auth.js signing/encryption secret. Must be unique per environment. */
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),

  /** Shared secret required by POST /api/cron/run-checks. */
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),

  /** "debug" | "info" | "warn" | "error" — defaults to debug outside production. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof schema>;

const raw: Record<keyof Env, string | undefined> = {
  NODE_ENV: process.env.NODE_ENV,
  // `|| undefined` turns empty strings into "not provided" so an unfilled
  // entry in .env is treated the same as a missing one.
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  AUTH_SECRET: process.env.AUTH_SECRET || undefined,
  AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID || undefined,
  AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET || undefined,
  CRON_SECRET: process.env.CRON_SECRET || undefined,
  LOG_LEVEL: process.env.LOG_LEVEL || undefined,
};

// `next build` imports server modules without production secrets available
// (e.g. in CI). This explicit opt-in keeps the build working while still
// failing loudly at runtime, where the flag is never set.
const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  if (!skipValidation) {
    throw new Error(
      `Invalid environment variables:\n${details}\n\nCopy .env.example to .env and fill in the values.`,
    );
  }

  console.warn(`[env] SKIP_ENV_VALIDATION=1 — ignoring invalid environment:\n${details}`);
}

export const env: Env = parsed.success ? parsed.data : (raw as Env);
