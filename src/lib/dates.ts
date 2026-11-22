/** UTC date arithmetic. All buckets in PulseWatch are UTC-aligned days. */

/** Midnight UTC of the day `date` falls in. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Adds whole days. Uses the UTC setter rather than `+ n * 86_400_000` so the
 * result stays exactly midnight across DST-less UTC months.
 */
export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** True when both instants fall in the same UTC day. */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}
