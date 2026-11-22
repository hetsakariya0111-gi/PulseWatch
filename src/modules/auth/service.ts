import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

import { hashPassword } from "./password";
import { registerSchema, type RegisterInput } from "./schema";

/** Thrown for expected, user-facing failures (as opposed to bugs). */
export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthServiceError";
  }
}

/** Postgres unique-constraint violation, surfaced through Prisma as P2002. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Creates a credentials-based account.
 *
 * The pre-check on `email` gives a friendly error in the common case, but two
 * concurrent sign-ups can still race past it — the database's unique index is
 * the real guard, so the `P2002` catch below is not redundant.
 */
export async function registerUser(input: RegisterInput): Promise<{ id: string; email: string }> {
  const data = registerSchema.parse(input);

  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing !== null) {
    throw new AuthServiceError("An account with this email already exists");
  }

  const hashedPassword = await hashPassword(data.password);

  try {
    const user = await db.user.create({
      data: { name: data.name, email: data.email, hashedPassword },
      select: { id: true, email: true },
    });
    logger.info("user registered", { userId: user.id });
    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthServiceError("An account with this email already exists");
    }
    throw error;
  }
}
