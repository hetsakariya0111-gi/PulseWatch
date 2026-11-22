import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

/**
 * Route guard. Uses only the edge-safe config (no Prisma), so the middleware
 * bundle stays small and Edge-compatible. The `authorized` callback in
 * `auth.config.ts` decides what is allowed.
 *
 * This is a convenience layer: unauthenticated visitors get bounced to
 * `/sign-in` before a page renders. Actual authorization still happens in
 * server components and server actions, which is where it must be enforced.
 */
const { auth } = NextAuth(authConfig);

/**
 * Exported as its own binding rather than destructured straight into
 * `export const { auth: middleware } = ...`: Next.js detects the middleware
 * entry point by reading the export's identifier, and a destructuring pattern
 * has none, so the build fails with "must export a function".
 */
export const middleware = auth;

export const config = {
  // Run on every route except API handlers, Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
