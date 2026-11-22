/**
 * Auth.js (NextAuth v5) module augmentation.
 *
 * The default `Session["user"]` has no `id`, but every authorization check in
 * the app needs it. Declaring it here (rather than casting at each call site)
 * keeps the rest of the codebase honest.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
