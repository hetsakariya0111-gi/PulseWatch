import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * bcryptjs is a pure-JS implementation, which matters here: it has no native
 * build step, so it works unchanged on Vercel's serverless runtime and in CI.
 * The cost factor is the knob that matters — 12 keeps a single hash around
 * ~250ms on serverless hardware, which is expensive enough to make offline
 * cracking painful without hurting sign-in latency noticeably.
 */

const COST_FACTOR = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
