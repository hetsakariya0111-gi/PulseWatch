import { Prisma } from "@/generated/prisma/client";
import type { CheckErrorType } from "@/generated/prisma/enums";
import { addUtcDays, startOfUtcDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { uptimePercent } from "@/lib/format";

/**
 * Analytics queries.
 *
 * Every aggregate here runs in Postgres rather than in JavaScript. A monitor on
 * a 1-minute interval accumulates ~43k rows a month; pulling those into Node to
 * average them would be both slow and memory-hungry, and it would break the
 * moment a project has 20 monitors. `FILTER (WHERE ...)` lets one pass compute
 * totals, successes and latency percentiles together.
 *
 * `$queryRaw` is used precisely because these are the queries Prisma's
 * `groupBy` cannot express (percentiles, filtered counts, date_trunc buckets).
 */

export interface UptimeStats {
  totalChecks: number;
  successChecks: number;
  failedChecks: number;
  avgResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  p95ResponseTimeMs: number | null;
  /** Success ratio as a percentage, or null when no checks were recorded. */
  uptime: number | null;
}

const EMPTY_STATS: UptimeStats = {
  totalChecks: 0,
  successChecks: 0,
  failedChecks: 0,
  avgResponseTimeMs: null,
  minResponseTimeMs: null,
  maxResponseTimeMs: null,
  p95ResponseTimeMs: null,
  uptime: null,
};

/** Aggregate check health for one monitor since `since`. */
export async function getUptimeStats(monitorId: string, since: Date): Promise<UptimeStats> {
  const rows = await db.$queryRaw<Omit<UptimeStats, "uptime">[]>`
    SELECT
      COUNT(*)::int                                                   AS "totalChecks",
      COUNT(*) FILTER (WHERE "success")::int                          AS "successChecks",
      COUNT(*) FILTER (WHERE NOT "success")::int                      AS "failedChecks",
      ROUND(AVG("responseTimeMs") FILTER (WHERE "success"))::int       AS "avgResponseTimeMs",
      MIN("responseTimeMs") FILTER (WHERE "success")::int              AS "minResponseTimeMs",
      MAX("responseTimeMs") FILTER (WHERE "success")::int              AS "maxResponseTimeMs",
      ROUND(
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "responseTimeMs")
          FILTER (WHERE "success"))::numeric
      )::int                                                          AS "p95ResponseTimeMs"
    FROM "check_results"
    WHERE "monitorId" = ${monitorId}
      AND "checkedAt" >= ${since}
  `;

  const row = rows[0];
  if (row === undefined) return EMPTY_STATS;

  return {
    ...row,
    uptime: uptimePercent(row.successChecks, row.totalChecks),
  };
}

/** Uptime for the standard windows shown on the monitor detail header. */
export interface UptimeWindows {
  last24h: UptimeStats;
  last7d: UptimeStats;
  last30d: UptimeStats;
  last90d: UptimeStats;
}

export async function getUptimeWindows(monitorId: string, now: Date = new Date()): Promise<UptimeWindows> {
  const day = 86_400_000;
  const [last24h, last7d, last30d, last90d] = await Promise.all([
    getUptimeStats(monitorId, new Date(now.getTime() - day)),
    getUptimeStats(monitorId, new Date(now.getTime() - 7 * day)),
    getUptimeStats(monitorId, new Date(now.getTime() - 30 * day)),
    getUptimeStats(monitorId, new Date(now.getTime() - 90 * day)),
  ]);

  return { last24h, last7d, last30d, last90d };
}

export interface ResponseTimePoint {
  bucket: Date;
  avgResponseTimeMs: number | null;
  totalChecks: number;
  failedChecks: number;
}

export type SeriesBucket = "hour" | "day";

/**
 * Average response time per time bucket, over a dense set of buckets.
 *
 * `generate_series` fills gaps so the chart has an even x-axis. Without it a
 * quiet period would simply vanish and the line would jump, which reads as a
 * latency spike that never happened.
 */
export async function getResponseTimeSeries(
  monitorId: string,
  since: Date,
  bucket: SeriesBucket,
  now: Date = new Date(),
): Promise<ResponseTimePoint[]> {
  // `bucket` is a TS union, so `Prisma.raw` here cannot inject anything; it is
  // only used because Postgres cannot infer the type of `date_trunc($1, ...)`.
  const unit = Prisma.raw(bucket === "hour" ? "'hour'" : "'day'");
  const step =
    bucket === "hour" ? Prisma.sql`make_interval(hours => 1)` : Prisma.sql`make_interval(days => 1)`;

  return db.$queryRaw<ResponseTimePoint[]>`
    WITH bounds AS (
      SELECT
        date_trunc(${unit}, ${since}::timestamptz AT TIME ZONE 'UTC') AS start_at,
        date_trunc(${unit}, ${now}::timestamptz AT TIME ZONE 'UTC')   AS end_at
    ),
    buckets AS (
      SELECT generate_series(b.start_at, b.end_at, ${step}) AS bucket
      FROM bounds b
    )
    SELECT
      -- Cast back to timestamptz: AT TIME ZONE yields a naive timestamp, which
      -- the driver would otherwise interpret in the server's local timezone.
      (b.bucket AT TIME ZONE 'UTC')::timestamptz                         AS "bucket",
      ROUND(AVG(c."responseTimeMs") FILTER (WHERE c."success"))::int   AS "avgResponseTimeMs",
      COUNT(c."id")::int                                              AS "totalChecks",
      COUNT(c."id") FILTER (WHERE NOT c."success")::int                AS "failedChecks"
    FROM buckets b
    LEFT JOIN "check_results" c
      ON c."monitorId" = ${monitorId}
      AND c."checkedAt" >= (b.bucket AT TIME ZONE 'UTC')
      AND c."checkedAt" < (b.bucket AT TIME ZONE 'UTC') + ${step}
    GROUP BY b.bucket
    ORDER BY b.bucket ASC
  `;
}

export interface CheckLogItem {
  id: string;
  success: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorType: CheckErrorType | null;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface CheckPage {
  items: CheckLogItem[];
  /** Pass back as `cursor` to fetch the next page; null when at the end. */
  nextCursor: string | null;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Paginated check history.
 *
 * Keyset pagination (cursor on a unique column) instead of `OFFSET`: paging by
 * offset degrades linearly because Postgres still has to walk the skipped rows,
 * and rows inserted during paging shift the window.
 */
export async function getCheckHistory(
  monitorId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<CheckPage> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const rows = await db.checkResult.findMany({
    where: { monitorId },
    orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
    // Fetch one extra row to learn whether another page exists, without a count.
    take: limit + 1,
    ...(options.cursor === undefined ? {} : { cursor: { id: options.cursor }, skip: 1 }),
    select: {
      id: true,
      success: true,
      statusCode: true,
      responseTimeMs: true,
      errorType: true,
      errorMessage: true,
      checkedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return { items, nextCursor: hasMore && last !== undefined ? last.id : null };
}

export interface DailyUptimePoint {
  date: Date;
  totalChecks: number;
  successChecks: number;
  uptime: number | null;
}

/**
 * Per-day uptime for the last `days` UTC days, oldest first, for many monitors
 * at once. This is the batched form: a status page renders 90-day bars for up
 * to 20 monitors, and doing that per monitor would be 20 round-trips.
 *
 * Finished days come from `daily_rollups` (one row per day per monitor — see
 * the rollup job), while today is aggregated live from raw checks because the
 * rollup for today does not exist until tomorrow. Days with no data at all are
 * returned with `uptime: null` so the status bar can render a "no data" cell
 * instead of silently claiming 100%.
 */
export async function getDailyUptimeForMonitors(
  monitorIds: string[],
  days: number,
): Promise<Map<string, DailyUptimePoint[]>> {
  const series = new Map<string, DailyUptimePoint[]>();
  if (monitorIds.length === 0) return series;

  const today = startOfUtcDay(new Date());
  const firstDay = addUtcDays(today, -(days - 1));

  const [rollups, todayRows] = await Promise.all([
    db.dailyRollup.findMany({
      where: { monitorId: { in: monitorIds }, date: { gte: firstDay, lt: today } },
      select: { monitorId: true, date: true, totalChecks: true, successChecks: true },
    }),
    db.$queryRaw<{ monitorId: string; totalChecks: number; successChecks: number }[]>`
      SELECT
        "monitorId"                            AS "monitorId",
        COUNT(*)::int                          AS "totalChecks",
        COUNT(*) FILTER (WHERE "success")::int AS "successChecks"
      FROM "check_results"
      WHERE "monitorId" IN (${Prisma.join(monitorIds)})
        AND "checkedAt" >= ${today}
      GROUP BY "monitorId"
    `,
  ]);

  type DayStats = { totalChecks: number; successChecks: number };
  const byMonitor = new Map<string, Map<number, DayStats>>();

  const put = (monitorId: string, day: Date, stats: DayStats): void => {
    const existing = byMonitor.get(monitorId) ?? new Map<number, DayStats>();
    existing.set(day.getTime(), stats);
    byMonitor.set(monitorId, existing);
  };

  for (const rollup of rollups) put(rollup.monitorId, startOfUtcDay(rollup.date), rollup);
  for (const row of todayRows) {
    if (row.totalChecks > 0) put(row.monitorId, today, row);
  }

  for (const monitorId of monitorIds) {
    const statsByDay = byMonitor.get(monitorId);
    const points: DailyUptimePoint[] = [];

    for (let offset = 0; offset < days; offset += 1) {
      const day = addUtcDays(firstDay, offset);
      const stats = statsByDay?.get(day.getTime());

      points.push({
        date: day,
        totalChecks: stats?.totalChecks ?? 0,
        successChecks: stats?.successChecks ?? 0,
        uptime: stats === undefined ? null : uptimePercent(stats.successChecks, stats.totalChecks),
      });
    }

    series.set(monitorId, points);
  }

  return series;
}

export async function getDailyUptime(monitorId: string, days: number): Promise<DailyUptimePoint[]> {
  const series = await getDailyUptimeForMonitors([monitorId], days);
  return series.get(monitorId) ?? [];
}

export interface DashboardSummary {
  totalMonitors: number;
  activeMonitors: number;
  upMonitors: number;
  downMonitors: number;
  pausedMonitors: number;
  activeIncidents: number;
  checksLast24h: number;
  uptimeLast24h: number | null;
}

/**
 * Everything the dashboard header needs, in three round-trips instead of one
 * query per monitor.
 */
export async function getUserDashboardSummary(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardSummary> {
  const since = new Date(now.getTime() - 86_400_000);

  const [monitorRows, checkRows, incidentRows] = await Promise.all([
    db.$queryRaw<
      {
        totalMonitors: number;
        activeMonitors: number;
        upMonitors: number;
        downMonitors: number;
        pausedMonitors: number;
      }[]
    >`
      SELECT
        COUNT(m."id")::int                                    AS "totalMonitors",
        COUNT(m."id") FILTER (WHERE m."enabled")::int          AS "activeMonitors",
        COUNT(m."id") FILTER (WHERE m."enabled" AND m."status" = 'UP')::int   AS "upMonitors",
        COUNT(m."id") FILTER (WHERE m."status" = 'DOWN')::int  AS "downMonitors",
        COUNT(m."id") FILTER (WHERE NOT m."enabled")::int      AS "pausedMonitors"
      FROM "monitors" m
      JOIN "projects" p ON p."id" = m."projectId"
      WHERE p."userId" = ${userId}
    `,
    db.$queryRaw<{ totalChecks: number; successChecks: number }[]>`
      SELECT
        COUNT(cr."id")::int                            AS "totalChecks",
        COUNT(cr."id") FILTER (WHERE cr."success")::int AS "successChecks"
      FROM "check_results" cr
      JOIN "monitors" m ON m."id" = cr."monitorId"
      JOIN "projects" p ON p."id" = m."projectId"
      WHERE p."userId" = ${userId}
        AND cr."checkedAt" >= ${since}
    `,
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(i."id")::int AS "count"
      FROM "incidents" i
      JOIN "monitors" m ON m."id" = i."monitorId"
      JOIN "projects" p ON p."id" = m."projectId"
      WHERE p."userId" = ${userId}
        AND i."resolvedAt" IS NULL
    `,
  ]);

  const monitors = monitorRows[0];
  const checks = checkRows[0];
  const incidents = incidentRows[0];

  return {
    totalMonitors: monitors?.totalMonitors ?? 0,
    activeMonitors: monitors?.activeMonitors ?? 0,
    upMonitors: monitors?.upMonitors ?? 0,
    downMonitors: monitors?.downMonitors ?? 0,
    pausedMonitors: monitors?.pausedMonitors ?? 0,
    activeIncidents: incidents?.count ?? 0,
    checksLast24h: checks?.totalChecks ?? 0,
    uptimeLast24h: checks === undefined ? null : uptimePercent(checks.successChecks, checks.totalChecks),
  };
}
