import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma 7 talks to Postgres through a *driver adapter*, so we hand it a `pg`
 * connection pool. Making the pool explicit also makes the connection limit
 * explicit — Neon's free tier caps concurrent connections, so we keep it small.
 *
 * The client is cached on `globalThis` in development because Next.js reloads
 * modules on every edit; without the cache each hot reload would open a new
 * pool and eventually exhaust the database's connection slots.
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: 5,
    // Prisma maps `DateTime` to `timestamp without time zone`, and several
    // analytics queries rely on raw SQL. Pinning the session timezone to UTC
    // makes every implicit `timestamp <-> timestamptz` conversion deterministic
    // instead of depending on whatever the database server defaults to.
    options: "-c timezone=UTC",
  });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
