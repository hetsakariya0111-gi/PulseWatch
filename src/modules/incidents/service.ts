import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import type { IncidentUpdateInput } from "./schema";

/**
 * Incidents service.
 *
 * Two audiences share this module:
 *  - the check engine, which opens and resolves incidents automatically inside
 *    the same transaction that updates the monitor (system functions below);
 *  - the user, who can post status updates to an incident (user functions).
 */

/** The subset of the Prisma client available inside `db.$transaction`. */
type TxClient = Prisma.TransactionClient;

export interface OpenIncidentInput {
  monitorId: string;
  monitorName: string;
  reason: string;
}

/**
 * Opens an incident unless one is already open for this monitor.
 *
 * The "already open?" check makes this idempotent, so a retried check run can
 * never produce duplicate incidents.
 */
export async function openIncidentIfNone(tx: TxClient, input: OpenIncidentInput): Promise<void> {
  const existing = await tx.incident.findFirst({
    where: { monitorId: input.monitorId, resolvedAt: null },
    select: { id: true },
  });
  if (existing !== null) return;

  const incident = await tx.incident.create({
    data: {
      monitorId: input.monitorId,
      status: "INVESTIGATING",
      title: `${input.monitorName} is down`,
      description: input.reason,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  await tx.incidentUpdate.create({
    data: {
      incidentId: incident.id,
      message: input.reason,
      status: "INVESTIGATING",
      authorId: null, // system-generated
    },
  });
}

/** Marks the monitor's open incident resolved. No-op when there is none. */
export async function resolveOpenIncident(tx: TxClient, monitorId: string): Promise<void> {
  const open = await tx.incident.findFirst({
    where: { monitorId, resolvedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open === null) return;

  const resolvedAt = new Date();
  await tx.incident.update({
    where: { id: open.id },
    data: {
      status: "RESOLVED",
      resolvedAt,
      durationMs: resolvedAt.getTime() - open.startedAt.getTime(),
    },
  });

  await tx.incidentUpdate.create({
    data: {
      incidentId: open.id,
      message: "Service recovered and is responding normally again.",
      status: "RESOLVED",
      authorId: null,
    },
  });
}

// ---------------------------------------------------------------------------
// User-facing operations
// ---------------------------------------------------------------------------

export async function listIncidentsForMonitor(userId: string, monitorId: string) {
  return db.incident.findMany({
    where: { monitorId, monitor: { project: { userId } } },
    orderBy: { startedAt: "desc" },
    include: { updates: { orderBy: { createdAt: "asc" } } },
  });
}

export async function listActiveIncidentsForUser(userId: string) {
  return db.incident.findMany({
    where: { resolvedAt: null, monitor: { project: { userId } } },
    orderBy: { startedAt: "desc" },
    include: { monitor: { select: { id: true, name: true, projectId: true } } },
  });
}

/**
 * Recent incidents across every project the user owns, newest first. Capped by
 * `limit` because a long-lived account accumulates a lot of history and the
 * page only ever renders the top of the list.
 */
export async function listIncidentsForUser(userId: string, limit = 50) {
  return db.incident.findMany({
    where: { monitor: { project: { userId } } },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      monitor: { select: { id: true, name: true, projectId: true } },
      updates: { orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Records a user-authored update. When the new status is RESOLVED the incident
 * is closed and its duration stamped, mirroring what the check engine does.
 */
export async function addIncidentUpdate(
  userId: string,
  incidentId: string,
  input: IncidentUpdateInput,
): Promise<void> {
  const incident = await db.incident.findFirst({
    where: { id: incidentId, monitor: { project: { userId } } },
    select: { id: true, startedAt: true, resolvedAt: true },
  });

  if (incident === null) {
    throw new Error("Incident not found");
  }

  const isResolving = input.status === "RESOLVED";

  await db.$transaction(async (tx) => {
    await tx.incidentUpdate.create({
      data: {
        incidentId: incident.id,
        message: input.message,
        status: input.status,
        authorId: userId,
      },
    });

    if (isResolving && incident.resolvedAt === null) {
      const resolvedAt = new Date();
      await tx.incident.update({
        where: { id: incident.id },
        data: {
          status: "RESOLVED",
          resolvedAt,
          durationMs: resolvedAt.getTime() - incident.startedAt.getTime(),
        },
      });
    } else if (!isResolving && incident.resolvedAt === null) {
      await tx.incident.update({ where: { id: incident.id }, data: { status: input.status } });
    }
    // Once resolved, further user updates are recorded but do not reopen the
    // incident — reopening is a deliberate action, not a side effect.
  });
}
