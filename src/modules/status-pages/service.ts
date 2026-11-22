import { db } from "@/lib/db";

import { normalizeStatusPageInput, statusPageInputSchema, type StatusPageInput } from "./schema";

/**
 * Status pages service.
 *
 * A status page belongs to exactly one project (`projectId` is unique), and
 * publishing one is therefore an *enable* operation rather than a create: the
 * project always owns the page, the user only decides whether it is public and
 * what it is called. That keeps the "one page per project" rule in the schema
 * instead of in application code.
 */

export class StatusPageError extends Error {
  readonly code: "PROJECT_NOT_FOUND" | "NOT_FOUND" | "SLUG_TAKEN";

  constructor(code: StatusPageError["code"], message: string) {
    super(message);
    this.name = "StatusPageError";
    this.code = code;
  }
}

/** Postgres unique-constraint violation, surfaced through Prisma as P2002. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export interface StatusPageDetail {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
}

export interface StatusPageWithProject extends StatusPageDetail {
  projectName: string;
}

export async function getStatusPageForProject(
  userId: string,
  projectId: string,
): Promise<StatusPageDetail | null> {
  const page = await db.statusPage.findFirst({
    where: { projectId, project: { userId } },
    select: {
      id: true,
      projectId: true,
      slug: true,
      title: true,
      description: true,
      isPublic: true,
      createdAt: true,
    },
  });

  return page;
}

export async function listStatusPagesForUser(userId: string): Promise<StatusPageWithProject[]> {
  const pages = await db.statusPage.findMany({
    where: { project: { userId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      slug: true,
      title: true,
      description: true,
      isPublic: true,
      createdAt: true,
      project: { select: { name: true } },
    },
  });

  return pages.map(({ project, ...page }) => ({ ...page, projectName: project.name }));
}

/**
 * Creates or updates the status page for a project.
 *
 * `upsert` on the unique `projectId` makes "publish" idempotent: clicking twice
 * updates the existing page instead of failing on a second insert.
 */
export async function saveStatusPage(
  userId: string,
  projectId: string,
  input: StatusPageInput,
): Promise<{ id: string; slug: string }> {
  const data = normalizeStatusPageInput(statusPageInputSchema.parse(input));

  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (project === null) {
    throw new StatusPageError("PROJECT_NOT_FOUND", "Project not found");
  }

  try {
    return await db.statusPage.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
      select: { id: true, slug: true },
    });
  } catch (error) {
    // The slug index is global, so a clash can come from another user's page.
    if (isUniqueViolation(error)) {
      throw new StatusPageError("SLUG_TAKEN", "That URL slug is already in use");
    }
    throw error;
  }
}

export async function deleteStatusPage(userId: string, statusPageId: string): Promise<void> {
  const result = await db.statusPage.deleteMany({ where: { id: statusPageId, project: { userId } } });
  if (result.count === 0) {
    throw new StatusPageError("NOT_FOUND", "Status page not found");
  }
}

/** Full status-page payload for the public page, or null if it is not public. */
export interface PublicStatusPageRecord {
  slug: string;
  title: string;
  description: string | null;
  projectName: string;
  updatedAt: Date;
  monitorIds: string[];
  monitors: {
    id: string;
    name: string;
    url: string;
    status: "UP" | "DOWN" | "UNKNOWN";
    enabled: boolean;
    lastCheckedAt: Date | null;
  }[];
}

/**
 * Deliberately unauthenticated — this backs `/status/<slug>`.
 *
 * Two conditions are enforced in the query itself so a private page can never
 * be rendered by mistake: the page must be marked public AND its project must
 * still exist. Returns null otherwise, and the page renders a 404.
 */
export async function getPublicStatusPageRecord(slug: string): Promise<PublicStatusPageRecord | null> {
  const page = await db.statusPage.findFirst({
    where: { slug: slug.toLowerCase(), isPublic: true },
    select: {
      slug: true,
      title: true,
      description: true,
      updatedAt: true,
      project: {
        select: {
          name: true,
          monitors: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              url: true,
              status: true,
              enabled: true,
              lastCheckedAt: true,
            },
          },
        },
      },
    },
  });

  if (page === null) return null;

  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    projectName: page.project.name,
    updatedAt: page.updatedAt,
    monitorIds: page.project.monitors.map((monitor) => monitor.id),
    monitors: page.project.monitors,
  };
}
