import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Shared guard for every /api/cron/* endpoint.
 *
 * These routes are reachable from the public internet — the scheduler has no
 * other way in — so the shared secret *is* the authentication. Three properties
 * matter:
 *
 *  - fail closed: if CRON_SECRET is missing we refuse to run rather than
 *    treating "no secret configured" as "no auth required";
 *  - constant time: `timingSafeEqual` on SHA-256 digests, so a caller cannot
 *    recover the secret byte-by-byte from response timing and the comparison
 *    never throws on a length mismatch;
 *  - no information leak: the failure response is identical for a missing and a
 *    wrong secret.
 */

function constantTimeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;

  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || value === undefined || value === "") return null;

  return value;
}

/**
 * Returns a response to short-circuit with when the request is not authorised,
 * or `null` when the caller may proceed.
 */
export function authorizeCronRequest(request: Request, route: string): NextResponse | null {
  const secret = env.CRON_SECRET;

  if (secret === undefined) {
    logger.error("cron request rejected: CRON_SECRET is not configured", { route });
    return NextResponse.json({ error: "Scheduler is not configured" }, { status: 500 });
  }

  const provided = bearerToken(request);
  if (provided === null || !constantTimeEqual(provided, secret)) {
    logger.warn("cron request rejected: invalid secret", { route });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
