import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SsrfError, resolveSafeTarget, validateUrlShape } from "@/lib/ssrf";

import { MAX_MONITORS_PER_PROJECT } from "./constants";
import {
  monitorFormSchema,
  toMonitorRecord,
  type MonitorFormValues,
} from "./schema";

/** Thrown for expected, user-facing monitor problems. */
export class MonitorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitorValidationError";
  }
}

/**
 * Validates a monitor URL for storage.
 *
 * Shape problems (bad scheme, credentials, private IP, blocked port) are
 * rejected outright. A DNS failure is *not* rejected: the domain may simply be
 * misconfigured or not yet live, and the check engine will record the failure
 * itself. This keeps "add a monitor for a site that is currently down"
 * working, which is exactly when people reach for a monitoring tool.
 */
async function validateMonitorUrl(rawUrl: string): Promise<string> {
  const shape = validateUrlShape(rawUrl);

  try {
    const target = await resolveSafeTarget(shape);
    return target.url.toString();
  } catch (error) {
    if (error instanceof SsrfError && error.code === "DNS_FAILURE") {
      return shape.toString();
    }
    throw error;
  }
}

function toUserFacingUrlError(error: unknown): MonitorValidationError {
  if (error instanceof SsrfError) {
    return new MonitorValidationError(error.message);
  }
  return new MonitorValidationError("The URL could not be validated");
}

export interface MonitorListItem {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  status: "UP" | "DOWN" | "UNKNOWN";
  intervalMinutes: number;
  lastCheckedAt: Date | null;
  nextCheckAt: Date | null;
}

export async function listMonitorsForProject(userId: string, projectId: string): Promise<MonitorListItem[]> {
  return db.monitor.findMany({
    where: { projectId, project: { userId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      enabled: true,
      status: true,
      intervalMinutes: true,
      lastCheckedAt: true,
      nextCheckAt: true,
    },
  });
}

export async function getMonitorForProjectOwner(userId: string, projectId: string, monitorId: string) {
  return db.monitor.findFirst({
    where: { id: monitorId, projectId, project: { userId } },
  });
}

export async function countMonitorsForUser(userId: string): Promise<number> {
  return db.monitor.count({ where: { project: { userId } } });
}

export async function countMonitorsInProject(userId: string, projectId: string): Promise<number> {
  return db.monitor.count({ where: { projectId, project: { userId } } });
}

export async function createMonitor(
  userId: string,
  projectId: string,
  values: MonitorFormValues,
): Promise<{ id: string }> {
  const parsed = monitorFormSchema.parse(values);

  const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (project === null) {
    throw new MonitorValidationError("Project not found");
  }

  const existingCount = await db.monitor.count({ where: { projectId } });
  if (existingCount >= MAX_MONITORS_PER_PROJECT) {
    throw new MonitorValidationError(
      `This project already has the maximum of ${MAX_MONITORS_PER_PROJECT} monitors`,
    );
  }

  let safeUrl: string;
  try {
    safeUrl = await validateMonitorUrl(parsed.url);
  } catch (error) {
    throw toUserFacingUrlError(error);
  }

  const record = toMonitorRecord(parsed);

  const monitor = await db.monitor.create({
    data: {
      ...record,
      projectId,
      url: safeUrl,
      status: "UNKNOWN",
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      // Due immediately: the next cron tick picks it up so the user sees a
      // result within about a minute of creating it.
      nextCheckAt: new Date(),
    },
    select: { id: true },
  });

  logger.info("monitor created", { monitorId: monitor.id, projectId, userId });
  return monitor;
}

export async function updateMonitor(
  userId: string,
  monitorId: string,
  values: MonitorFormValues,
): Promise<void> {
  const parsed = monitorFormSchema.parse(values);

  const existing = await db.monitor.findFirst({
    where: { id: monitorId, project: { userId } },
    select: { id: true, intervalMinutes: true, enabled: true, nextCheckAt: true },
  });

  if (existing === null) {
    throw new MonitorValidationError("Monitor not found");
  }

  let safeUrl: string;
  try {
    safeUrl = await validateMonitorUrl(parsed.url);
  } catch (error) {
    throw toUserFacingUrlError(error);
  }

  const record = toMonitorRecord(parsed);
  const intervalChanged = existing.intervalMinutes !== record.intervalMinutes;
  const wasDisabled = !existing.enabled;
  const nowEnabled = record.enabled;

  // Rescheduling rules:
  //  - Pausing clears the due time so the scheduler skips it entirely.
  //  - Re-enabling makes it due immediately.
  //  - Changing the interval schedules the next run one new interval away.
  let nextCheckAt: Date | null = existing.nextCheckAt;
  if (!nowEnabled) {
    nextCheckAt = null;
  } else if (wasDisabled) {
    nextCheckAt = new Date();
  } else if (intervalChanged) {
    nextCheckAt = new Date(Date.now() + record.intervalMinutes * 60_000);
  }

  const result = await db.monitor.updateMany({
    where: { id: monitorId, project: { userId } },
    data: {
      ...record,
      url: safeUrl,
      nextCheckAt,
      lockedUntil: nowEnabled ? undefined : null,
    },
  });

  if (result.count === 0) {
    throw new MonitorValidationError("Monitor not found");
  }
}

export async function deleteMonitor(userId: string, monitorId: string): Promise<void> {
  const result = await db.monitor.deleteMany({ where: { id: monitorId, project: { userId } } });
  if (result.count === 0) {
    throw new MonitorValidationError("Monitor not found");
  }
}

export async function setMonitorEnabled(userId: string, monitorId: string, enabled: boolean): Promise<void> {
  const result = await db.monitor.updateMany({
    where: { id: monitorId, project: { userId } },
    data: {
      enabled,
      nextCheckAt: enabled ? new Date() : null,
      lockedUntil: enabled ? undefined : null,
    },
  });

  if (result.count === 0) {
    throw new MonitorValidationError("Monitor not found");
  }
}
