/**
 * Presentation helpers shared by the dashboard, monitor detail and public
 * status pages. Kept free of React so they can be unit-tested and reused on
 * the server.
 */

/** `0.9995` -> `"99.95%"`. Returns "—" when there is nothing to divide by. */
export function formatUptime(successChecks: number, totalChecks: number): string {
  if (totalChecks <= 0) return "—";
  const percentage = (successChecks / totalChecks) * 100;
  // Two decimals for values close to 100 so "99.99%" and "100%" stay distinct.
  return `${percentage.toFixed(2)}%`;
}

/** Numeric uptime ratio (0–100), or null when there is no data. */
export function uptimePercent(successChecks: number, totalChecks: number): number | null {
  if (totalChecks <= 0) return null;
  return (successChecks / totalChecks) * 100;
}

/** `1234` -> `"1.23 s"`, `87` -> `"87 ms"`. */
export function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Human-readable outage length: `"2h 15m"`, `"45s"`, `"—"`. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${totalSeconds % 60}s`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Fleet availability bucket used by status dots and bars. */
export type UptimeBucket = "none" | "down" | "degraded" | "up";

/**
 * Classifies a day's uptime. Anything below 100% but above 95% is "degraded"
 * so a mostly-healthy day is still visibly different from a perfect one.
 */
export function uptimeBucket(percent: number | null): UptimeBucket {
  if (percent === null) return "none";
  if (percent >= 99.99) return "up";
  if (percent >= 95) return "degraded";
  return "down";
}

/** Tailwind background class for a bucket. */
export function bucketClassName(bucket: UptimeBucket): string {
  switch (bucket) {
    case "up":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "down":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
}

/** `"12 Mar"` — compact axis label for charts. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** `"12 Mar, 14:05 UTC"` — used in tables where the exact instant matters. */
export function formatDateTimeUtc(date: Date | null | undefined): string {
  if (!date) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
}

/** `"just now"`, `"4 min ago"`, `"3 h ago"` — relative to `now`. */
export function formatRelativeTime(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "never";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}
