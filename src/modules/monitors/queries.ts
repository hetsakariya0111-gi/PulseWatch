import { cache } from "react";

import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";

import { listMonitorsForProject, type MonitorListItem } from "./service";

/** Returns the current user's monitors in a project, or `[]` if they do not own it. */
export async function getMonitorsForCurrentUser(projectId: string): Promise<MonitorListItem[]> {
  const user = await requireUser();
  return listMonitorsForProject(user.id, projectId);
}

export interface MonitorDetail {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  url: string;
  description: string | null;
  type: "WEBSITE" | "API";
  method: "GET" | "HEAD" | "POST";
  expectedStatusCodes: number[];
  timeoutMs: number;
  intervalMinutes: number;
  enabled: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
  status: "UP" | "DOWN" | "UNKNOWN";
  lastCheckedAt: Date | null;
  nextCheckAt: Date | null;
  createdAt: Date;
}

/**
 * Loads a monitor for its owner. The `project: { userId }` relation filter is
 * what enforces authorization — a monitor id from another account returns null.
 *
 * Cached per request so the page body and `generateMetadata` share one query.
 */
export const getMonitorDetailForCurrentUser = cache(
  async (monitorId: string): Promise<MonitorDetail | null> => {
    const user = await requireUser();

    const monitor = await db.monitor.findFirst({
      where: { id: monitorId, project: { userId: user.id } },
      select: {
        id: true,
        projectId: true,
        name: true,
        url: true,
        description: true,
        type: true,
        method: true,
        expectedStatusCodes: true,
        timeoutMs: true,
        intervalMinutes: true,
        enabled: true,
        failureThreshold: true,
        recoveryThreshold: true,
        status: true,
        lastCheckedAt: true,
        nextCheckAt: true,
        createdAt: true,
        project: { select: { name: true } },
      },
    });

    if (monitor === null) return null;

    return {
      id: monitor.id,
      projectId: monitor.projectId,
      projectName: monitor.project.name,
      name: monitor.name,
      url: monitor.url,
      description: monitor.description,
      type: monitor.type,
      method: monitor.method,
      expectedStatusCodes: monitor.expectedStatusCodes,
      timeoutMs: monitor.timeoutMs,
      intervalMinutes: monitor.intervalMinutes,
      enabled: monitor.enabled,
      failureThreshold: monitor.failureThreshold,
      recoveryThreshold: monitor.recoveryThreshold,
      status: monitor.status,
      lastCheckedAt: monitor.lastCheckedAt,
      nextCheckAt: monitor.nextCheckAt,
      createdAt: monitor.createdAt,
    };
  },
);
