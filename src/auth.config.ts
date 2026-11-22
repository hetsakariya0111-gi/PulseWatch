import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Edge-safe slice of the Auth.js configuration.
 *
 * `middleware.ts` runs on the Edge runtime, which cannot load Prisma (it pulls
 * in `pg` and Node built-ins). This file therefore contains only things that
 * are safe there — the OAuth provider config, page routes and callbacks — and
 * `src/auth.ts` layers the Prisma adapter and the credentials provider on top
 * for the Node runtime.
 */

/** Routes that can be viewed without signing in. */
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up"]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Public status pages are meant to be shared openly.
  return pathname.startsWith("/status/");
}

export const authConfig = {
  providers: [GitHub],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    /**
     * Drives middleware. Returning `false` sends the visitor to the sign-in
     * page with a `callbackUrl`. This is a UX guard, not the security
     * boundary — every server action and data loader re-checks the session.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
