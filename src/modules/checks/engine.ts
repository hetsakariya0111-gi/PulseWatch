import pLimit from "p-limit";

import type { HttpMethod, MonitorStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { openIncidentIfNone, resolveOpenIncident } from "@/modules/incidents/service";
import { LEASE_DURATION_MS } from "@/modules/monitors/constants";

import { performHttpCheck } from "./http-client";
import { computeNextState } from "./state";

/**
 * Check engine.
 *
 * Invoked by POST /api/cron/run-checks once a minute. One invocation does:
 *
 *   1. claim    — atomically lease the monitors that are due (see below),
 *   2. probe    — run each check with bounded concurrency,
 *   3. commit   — write the result and advance the monitor's state machine,
 *                 opening or resolving an incident as the thresholds dictate.
 *
 * The database is touched three times per monitor (claim, insert, update) and
 * the network probe happens *outside* the transaction, so we never hold a
 * pooled connection open while waiting on a slow third-party site.
 */

/** Monitors claimed per run. Bounds one invocation to a single function timeout. */
const CLAIM_BATCH_SIZE = 50;

/**
 * Probes in flight at once. Every probe owns a socket, and Neon's free tier
 * caps connections, so the ceiling is deliberately small: 10 concurrent probes
 * drain a 50-monitor batch in a few seconds without exhausting either budget.
 */
const PROBE_CONCURRENCY = 10;

/** Columns of `monitors` the engine needs. Raw SQL returns enum columns as strings. */
interface ClaimedMonitor {
  id: string;
  projectId: string;
  name: string;
  url: string;
  method: HttpMethod;
  expectedStatusCodes: number[];
  timeoutMs: number;
  intervalMinutes: number;
  failureThreshold: number;
  recoveryThreshold: number;
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface CheckRunSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  incidentsOpened: number;
  incidentsResolved: number;
  /** Claims that blew up before we could commit a result. */
  errored: number;
  durationMs: number;
}

/**
 * Claims the monitors that are due and stamps them with a lease.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes this safe to run concurrently: if two
 * cron invocations overlap (a slow run meets the next tick) each one locks a
 * disjoint set of rows instead of both checking the same monitor. The
 * `lockedUntil` column is the durable half of the lease — it survives the
 * process dying, so a monitor abandoned mid-check is retried after
 * LEASE_DURATION_MS instead of being stuck forever.
 */
async function claimDueMonitors(now: Date, batchSize: number): Promise<ClaimedMonitor[]> {
  const leaseUntil = new Date(now.getTime() + LEASE_DURATION_MS);

  return db.$queryRaw<ClaimedMonitor[]>`
    UPDATE "monitors"
    SET "lockedUntil" = ${leaseUntil}
    WHERE "id" IN (
      SELECT "id"
      FROM "monitors"
      WHERE "enabled" = true
        AND "nextCheckAt" IS NOT NULL
        AND "nextCheckAt" <= ${now}
        AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
      ORDER BY "nextCheckAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      "id",
      "projectId",
      "name",
      "url",
      "method",
      "expectedStatusCodes",
      "timeoutMs",
      "intervalMinutes",
      "failureThreshold",
      "recoveryThreshold",
      "status",
      "consecutiveFailures",
      "consecutiveSuccesses"
  `;
}

/**
 * Frees a lease without committing a result, so the monitor is retried on its
 * normal cadence instead of waiting out the full lease.
 */
async function releaseLease(monitorId: string, intervalMinutes: number): Promise<void> {
  await db.monitor.update({
    where: { id: monitorId },
    data: {
      lockedUntil: null,
      nextCheckAt: new Date(Date.now() + intervalMinutes * 60_000),
    },
  });
}

interface CheckOutcome {
  success: boolean;
  incidentOpened: boolean;
  incidentResolved: boolean;
}

/**
 * Probes one monitor and commits the outcome.
 *
 * The probe result and the monitor's new state are written in a single
 * transaction: a check that is recorded but never reflected in the monitor's
 * status would make the dashboard lie, and vice versa.
 */
async function executeCheck(monitor: ClaimedMonitor): Promise<CheckOutcome> {
  const result = await performHttpCheck({
    url: monitor.url,
    method: monitor.method,
    expectedStatusCodes: monitor.expectedStatusCodes,
    timeoutMs: monitor.timeoutMs,
  });

  const next = computeNextState(
    {
      status: monitor.status,
      consecutiveFailures: monitor.consecutiveFailures,
      consecutiveSuccesses: monitor.consecutiveSuccesses,
      failureThreshold: monitor.failureThreshold,
      recoveryThreshold: monitor.recoveryThreshold,
    },
    result.success,
  );

  const checkedAt = new Date();
  const nextCheckAt = new Date(checkedAt.getTime() + monitor.intervalMinutes * 60_000);

  await db.$transaction(async (tx) => {
    await tx.checkResult.create({
      data: {
        monitorId: monitor.id,
        success: result.success,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        errorType: result.errorType,
        errorMessage: result.errorMessage,
        checkedAt,
      },
    });

    await tx.monitor.update({
      where: { id: monitor.id },
      data: {
        status: next.status,
        consecutiveFailures: next.consecutiveFailures,
        consecutiveSuccesses: next.consecutiveSuccesses,
        lastCheckedAt: checkedAt,
        nextCheckAt,
        // Release the lease as part of the same commit, so the monitor becomes
        // claimable again exactly when its new result is visible.
        lockedUntil: null,
      },
    });

    if (next.incidentShouldOpen) {
      await openIncidentIfNone(tx, {
        monitorId: monitor.id,
        monitorName: monitor.name,
        reason: result.errorMessage ?? "The monitor failed its availability check.",
      });
    }

    if (next.incidentShouldResolve) {
      await resolveOpenIncident(tx, monitor.id);
    }
  });

  if (!result.success) {
    logger.warn("monitor check failed", {
      monitorId: monitor.id,
      errorType: result.errorType,
      statusCode: result.statusCode,
    });
  }

  return {
    success: result.success,
    incidentOpened: next.incidentShouldOpen,
    incidentResolved: next.incidentShouldResolve,
  };
}

/**
 * Claims and checks every monitor that is due right now.
 *
 * Safe to call concurrently and safe to call when nothing is due.
 */
export async function runScheduledChecks(): Promise<CheckRunSummary> {
  const startedAt = Date.now();

  const claimed = await claimDueMonitors(new Date(), CLAIM_BATCH_SIZE);

  const summary: CheckRunSummary = {
    claimed: claimed.length,
    succeeded: 0,
    failed: 0,
    incidentsOpened: 0,
    incidentsResolved: 0,
    errored: 0,
    durationMs: 0,
  };

  if (claimed.length === 0) {
    summary.durationMs = Date.now() - startedAt;
    return summary;
  }

  const limit = pLimit(PROBE_CONCURRENCY);

  const outcomes = await Promise.all(
    claimed.map((monitor) =>
      limit(async (): Promise<CheckOutcome | null> => {
        try {
          return await executeCheck(monitor);
        } catch (error) {
          // One bad monitor must never abort the run. Release its lease so it
          // is retried, and carry on with the rest of the batch.
          logger.error("check threw before commit", {
            monitorId: monitor.id,
            error: error instanceof Error ? error.message : String(error),
          });

          await releaseLease(monitor.id, monitor.intervalMinutes).catch(() => undefined);
          summary.errored += 1;
          return null;
        }
      }),
    ),
  );

  for (const outcome of outcomes) {
    if (outcome === null) continue;

    if (outcome.success) summary.succeeded += 1;
    else summary.failed += 1;

    if (outcome.incidentOpened) summary.incidentsOpened += 1;
    if (outcome.incidentResolved) summary.incidentsResolved += 1;
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}
