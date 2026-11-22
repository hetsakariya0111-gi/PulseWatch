import { addUtcDays, startOfUtcDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Daily rollup + retention job.
 *
 * Two problems are solved here, and they are the same problem:
 *
 *  1. Storage. A single monitor on a 1-minute interval writes ~43,200 rows a
 *     month. Left alone, that table grows without bound and every dashboard
 *     query gets slower. We only need minute-level detail for recent history.
 *  2. Query cost. A 90-day uptime bar chart should not scan 100k+ rows.
 *
 * So once a day we collapse every finished UTC day into one `daily_rollups` row
 * per monitor (totals, latency min/avg/max, downtime) and then delete the raw
 * checks we have already summarised. Long-range charts read the rollup table;
 * recent charts and the check log still read raw rows.
 */

/** Raw checks are kept this long; anything older exists only as a rollup. */
export const RETENTION_DAYS = 90;

export interface RollupSummary {
  daysUpserted: number;
  checksDeleted: number;
  durationMs: number;
}

/**
 * Rewrites the rollup for every *finished* day that still has raw checks.
 *
 * Deliberately re-aggregates all retained days rather than only yesterday:
 * upserting is idempotent, it self-heals if a cron run was missed, and it
 * recomputes `downtimeMs` for an incident that was still open when the first
 * rollup ran. Bounded because raw checks are capped at RETENTION_DAYS.
 */
export async function runDailyRollup(now: Date = new Date()): Promise<RollupSummary> {
  const startedAt = Date.now();

  // Today is excluded: it is still being written to, and the analytics queries
  // aggregate today live from raw checks.
  const today = startOfUtcDay(now);
  const cutoff = addUtcDays(today, -RETENTION_DAYS);

  const daysUpserted = await db.$executeRaw`
    INSERT INTO "daily_rollups" (
      "id", "monitorId", "date",
      "totalChecks", "successChecks", "failChecks",
      "sumResponseTimeMs", "minResponseTimeMs", "maxResponseTimeMs", "downtimeMs"
    )
    SELECT
      a."monitorId" || ':' || to_char(a.day, 'YYYY-MM-DD')  AS "id",
      a."monitorId",
      a.day                                                 AS "date",
      a."totalChecks",
      a."successChecks",
      a."failChecks",
      a."sumResponseTimeMs",
      a."minResponseTimeMs",
      a."maxResponseTimeMs",
      COALESCE(d."downtimeMs", 0)                           AS "downtimeMs"
    FROM (
      SELECT
        cr."monitorId"                                                          AS "monitorId",
        date_trunc('day', cr."checkedAt" AT TIME ZONE 'UTC')                     AS day,
        COUNT(*)::int                                                            AS "totalChecks",
        COUNT(*) FILTER (WHERE cr."success")::int                                AS "successChecks",
        COUNT(*) FILTER (WHERE NOT cr."success")::int                            AS "failChecks",
        COALESCE(SUM(cr."responseTimeMs") FILTER (WHERE cr."success"), 0)::int   AS "sumResponseTimeMs",
        MIN(cr."responseTimeMs") FILTER (WHERE cr."success")::int                AS "minResponseTimeMs",
        MAX(cr."responseTimeMs") FILTER (WHERE cr."success")::int                AS "maxResponseTimeMs"
      FROM "check_results" cr
      WHERE cr."checkedAt" < ${today}
        AND cr."checkedAt" >= ${cutoff}
      GROUP BY 1, 2
    ) a
    -- Downtime is not derivable from check rows (an outage spans many minutes
    -- between two probes), so it is computed from incident intervals, split at
    -- UTC midnight with generate_series, and clipped to the day window.
    LEFT JOIN (
      SELECT
        i."monitorId" AS "monitorId",
        g.day         AS day,
        SUM(
          EXTRACT(EPOCH FROM (
            LEAST(
              COALESCE(i."resolvedAt", ${now}),
              (g.day AT TIME ZONE 'UTC') + interval '1 day'
            ) - GREATEST(i."startedAt", (g.day AT TIME ZONE 'UTC'))
          )) * 1000
        )::int AS "downtimeMs"
      FROM "incidents" i
      CROSS JOIN LATERAL generate_series(
        date_trunc('day', i."startedAt" AT TIME ZONE 'UTC'),
        date_trunc('day', COALESCE(i."resolvedAt", ${now}) AT TIME ZONE 'UTC'),
        interval '1 day'
      ) AS g(day)
      GROUP BY 1, 2
    ) d
      ON d."monitorId" = a."monitorId"
      AND d.day = a.day
    ON CONFLICT ("monitorId", "date") DO UPDATE SET
      "totalChecks"       = EXCLUDED."totalChecks",
      "successChecks"     = EXCLUDED."successChecks",
      "failChecks"        = EXCLUDED."failChecks",
      "sumResponseTimeMs" = EXCLUDED."sumResponseTimeMs",
      "minResponseTimeMs" = EXCLUDED."minResponseTimeMs",
      "maxResponseTimeMs" = EXCLUDED."maxResponseTimeMs",
      "downtimeMs"        = EXCLUDED."downtimeMs"
  `;

  // Delete only what we have already summarised: the EXISTS check means a day
  // that somehow failed to roll up keeps its raw rows and stays visible.
  const checksDeleted = await db.$executeRaw`
    DELETE FROM "check_results" cr
    WHERE cr."checkedAt" < ${cutoff}
      AND EXISTS (
        SELECT 1
        FROM "daily_rollups" r
        WHERE r."monitorId" = cr."monitorId"
          AND r."date" = date_trunc('day', cr."checkedAt" AT TIME ZONE 'UTC')
      )
  `;

  const summary: RollupSummary = {
    daysUpserted,
    checksDeleted,
    durationMs: Date.now() - startedAt,
  };

  logger.info("daily rollup finished", { ...summary });
  return summary;
}
