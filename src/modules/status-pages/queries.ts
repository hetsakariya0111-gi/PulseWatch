import type { IncidentStatus, MonitorStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { uptimePercent } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { getDailyUptimeForMonitors, type DailyUptimePoint } from "@/modules/checks/queries";

import {
  getPublicStatusPageRecord,
  getStatusPageForProject,
  listStatusPagesForUser,
  type StatusPageDetail,
  type StatusPageWithProject,
} from "./service";

/** How many days of history the public status bar shows. */
export const STATUS_PAGE_HISTORY_DAYS = 90;

/** How many resolved incidents the public page lists below the fold. */
const RECENT_INCIDENT_LIMIT = 5;

export interface PublicStatusMonitor {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  enabled: boolean;
  lastCheckedAt: Date | null;
  uptime90d: number | null;
  /** One entry per day, oldest first — rendered as the uptime bar. */
  history: DailyUptimePoint[];
}

export interface PublicIncidentUpdate {
  id: string;
  message: string;
  status: IncidentStatus | null;
  createdAt: Date;
}

export interface PublicIncident {
  id: string;
  title: string;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  durationMs: number | null;
  monitorName: string;
  updates: PublicIncidentUpdate[];
}

export type OverallStatus = "operational" | "degraded" | "outage";

export interface PublicStatusPage {
  slug: string;
  title: string;
  description: string | null;
  projectName: string;
  updatedAt: Date;
  overallStatus: OverallStatus;
  monitors: PublicStatusMonitor[];
  activeIncidents: PublicIncident[];
  recentIncidents: PublicIncident[];
}

/**
 * Anything enabled that is not confirmed UP keeps the banner off "operational":
 * an UNKNOWN monitor has simply never been checked, and claiming it is healthy
 * would be a lie on a page whose entire job is honesty.
 */
function overallStatusFor(monitors: PublicStatusMonitor[]): OverallStatus {
  const active = monitors.filter((monitor) => monitor.enabled);

  if (active.some((monitor) => monitor.status === "DOWN")) return "outage";
  if (active.some((monitor) => monitor.status !== "UP")) return "degraded";
  return "operational";
}

const INCIDENT_SELECT = {
  id: true,
  title: true,
  status: true,
  startedAt: true,
  resolvedAt: true,
  durationMs: true,
  updates: {
    orderBy: { createdAt: "asc" },
    select: { id: true, message: true, status: true, createdAt: true },
  },
  monitor: { select: { name: true } },
} as const;

/**
 * Full payload for `/status/<slug>`.
 *
 * Returns null when the page does not exist or is private, so the caller can
 * render a 404 without ever leaking whether the slug is taken.
 */
export async function getPublicStatusPage(slug: string): Promise<PublicStatusPage | null> {
  const record = await getPublicStatusPageRecord(slug);
  if (record === null) return null;

  const [dailyUptime, activeIncidents, recentIncidents] = await Promise.all([
    getDailyUptimeForMonitors(record.monitorIds, STATUS_PAGE_HISTORY_DAYS),
    db.incident.findMany({
      where: { monitorId: { in: record.monitorIds }, resolvedAt: null },
      orderBy: { startedAt: "desc" },
      select: INCIDENT_SELECT,
    }),
    db.incident.findMany({
      where: { monitorId: { in: record.monitorIds }, resolvedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: RECENT_INCIDENT_LIMIT,
      select: INCIDENT_SELECT,
    }),
  ]);

  const monitors: PublicStatusMonitor[] = record.monitors.map((monitor) => {
    const history = dailyUptime.get(monitor.id) ?? [];

    const totals = history.reduce(
      (accumulator, point) => ({
        total: accumulator.total + point.totalChecks,
        success: accumulator.success + point.successChecks,
      }),
      { total: 0, success: 0 },
    );

    return {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      status: monitor.status,
      enabled: monitor.enabled,
      lastCheckedAt: monitor.lastCheckedAt,
      uptime90d: uptimePercent(totals.success, totals.total),
      history,
    };
  });

  const toIncident = (incident: (typeof activeIncidents)[number]): PublicIncident => ({
    id: incident.id,
    title: incident.title,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationMs: incident.durationMs,
    monitorName: incident.monitor.name,
    updates: incident.updates,
  });

  return {
    slug: record.slug,
    title: record.title,
    description: record.description,
    projectName: record.projectName,
    updatedAt: record.updatedAt,
    overallStatus: overallStatusFor(monitors),
    monitors,
    activeIncidents: activeIncidents.map(toIncident),
    recentIncidents: recentIncidents.map(toIncident),
  };
}

export async function getStatusPagesForCurrentUser(): Promise<StatusPageWithProject[]> {
  const user = await requireUser();
  return listStatusPagesForUser(user.id);
}

export async function getStatusPageForCurrentProject(projectId: string): Promise<StatusPageDetail | null> {
  const user = await requireUser();
  return getStatusPageForProject(user.id, projectId);
}
