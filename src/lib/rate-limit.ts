/**
 * Tiny in-memory rate limiter.
 *
 * Scope is intentionally limited: it protects a single server instance. On
 * Vercel each serverless instance has its own memory, so a determined attacker
 * hitting many instances gets a larger effective budget. That is an accepted
 * trade-off for a free-tier project — the alternative (Redis / Upstash) adds a
 * dependency and a bill. Document the limit; do not pretend it is global.
 *
 * Used for: sign-in attempts, sign-up, and the cron endpoint.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Evict expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  /** `false` means the caller is over the limit and should be rejected. */
  ok: boolean;
  remaining: number;
  /** Epoch millis at which the window resets. */
  resetAt: number;
}

/**
 * Fixed-window counter. Simple and predictable: `limit` requests per
 * `windowMs`, per `key`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (existing === undefined || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return { ok: existing.count <= limit, remaining, resetAt: existing.resetAt };
}

/** Best-effort client IP from proxy headers, falling back to `unknown`. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    if (first !== undefined) return first.trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
