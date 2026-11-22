import type { MonitorStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { normalizeProjectInput, projectInputSchema, type ProjectInput } from "./schema";

/**
 * Projects service — all Prisma access for projects lives here.
 *
 * Every function takes `userId` and scopes its query by it. That is the
 * authorization boundary: a caller cannot reach another user's project even if
 * it guesses the id, because the `where` clause simply will not match. Services
 * never read the session themselves, which keeps them trivially unit-testable.
 */

export interface MonitorStatusCounts {
  total: number;
  up: number;
  down: number;
  paused: number;
  unknown: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  monitorCounts: MonitorStatusCounts;
}

export interface ProjectWithMonitors {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  monitors: {
    id: string;
    name: string;
    url: string;
    status: MonitorStatus;
    enabled: boolean;
    intervalMinutes: number;
    lastCheckedAt: Date | null;
  }[];
}

function countStatuses(monitors: { status: MonitorStatus; enabled: boolean }[]): MonitorStatusCounts {
  const counts: MonitorStatusCounts = { total: monitors.length, up: 0, down: 0, paused: 0, unknown: 0 };
  for (const monitor of monitors) {
    if (!monitor.enabled) {
      counts.paused += 1;
      continue;
    }
    if (monitor.status === "UP") counts.up += 1;
    else if (monitor.status === "DOWN") counts.down += 1;
    else counts.unknown += 1;
  }
  return counts;
}

export async function listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const projects = await db.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      monitors: { select: { status: true, enabled: true } },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    monitorCounts: countStatuses(project.monitors),
  }));
}

export async function getProjectForUser(userId: string, projectId: string): Promise<ProjectWithMonitors | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      monitors: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          url: true,
          status: true,
          enabled: true,
          intervalMinutes: true,
          lastCheckedAt: true,
        },
      },
    },
  });

  return project;
}

/** Lightweight ownership check used by other services (e.g. monitors). */
export async function isProjectOwnedByUser(userId: string, projectId: string): Promise<boolean> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return project !== null;
}

export async function createProject(userId: string, input: ProjectInput): Promise<{ id: string }> {
  const data = normalizeProjectInput(projectInputSchema.parse(input));
  return db.project.create({
    data: { userId, name: data.name, description: data.description },
    select: { id: true },
  });
}

/**
 * Updates a project. `updateMany` + `count` is the ownership-safe update
 * pattern: it can only ever touch a row that belongs to `userId`.
 */
export async function updateProject(userId: string, projectId: string, input: ProjectInput): Promise<void> {
  const data = normalizeProjectInput(projectInputSchema.parse(input));
  const result = await db.project.updateMany({
    where: { id: projectId, userId },
    data: { name: data.name, description: data.description },
  });

  if (result.count === 0) {
    throw new Error("Project not found");
  }
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const result = await db.project.deleteMany({ where: { id: projectId, userId } });
  if (result.count === 0) {
    throw new Error("Project not found");
  }
}
