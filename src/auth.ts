import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyPassword } from "@/modules/auth/password";
import { loginSchema } from "@/modules/auth/schema";

/**
 * Full Auth.js configuration (Node runtime only).
 *
 * Sessions use the JWT strategy rather than database sessions. Two reasons:
 * credentials sign-in does not fit database sessions cleanly, and JWT decoding
 * needs no database round-trip, which keeps middleware on the Edge runtime and
 * every authenticated request fast.
 *
 * The Prisma adapter is still used — it persists users and links OAuth
 * accounts on the GitHub flow.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // The adapter's type is written against the classic `@prisma/client`
  // `PrismaClient`; ours comes from the v7 generator. The shapes are
  // identical, so a structural cast is safe here.
  adapter: PrismaAdapter(db as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        // A user created only through GitHub has no password; treat that the
        // same as "wrong credentials" so we never reveal which is which.
        if (user?.hashedPassword == null) return null;

        const passwordMatches = await verifyPassword(parsed.data.password, user.hashedPassword);
        if (!passwordMatches) {
          logger.warn("failed sign-in attempt", { email: parsed.data.email });
          return null;
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user?.id !== undefined) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      return session;
    },
  },
});
