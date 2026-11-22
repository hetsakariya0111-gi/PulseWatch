import { cache } from "react";

import { requireUser } from "@/modules/auth/session";

import { getProjectForUser, listProjectsForUser, type ProjectSummary, type ProjectWithMonitors } from "./service";

/**
 * Page-facing read helpers. They resolve the current user themselves so a page
 * can never accidentally read another user's data by forgetting to pass an id.
 */

export async function getProjectsForCurrentUser(): Promise<ProjectSummary[]> {
  const user = await requireUser();
  return listProjectsForUser(user.id);
}

/**
 * Wrapped in `cache()` so `generateMetadata` and the page body share one query
 * per request instead of hitting the database twice for the same project.
 */
export const getProjectForCurrentUser = cache(
  async (projectId: string): Promise<ProjectWithMonitors | null> => {
    const user = await requireUser();
    return getProjectForUser(user.id, projectId);
  },
);
