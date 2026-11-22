"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, formString, type ActionState } from "@/lib/action";
import { requireUserForAction } from "@/modules/auth/session";

import { projectInputSchema } from "./schema";
import { createProject, deleteProject, updateProject } from "./service";

function revalidateProjectViews(projectId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  if (projectId !== undefined) revalidatePath(`/projects/${projectId}`);
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserForAction();

  const parsed = projectInputSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });

  if (!parsed.success) {
    return actionError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const project = await createProject(user.id, parsed.data);
  revalidateProjectViews(project.id);
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserForAction();
  const projectId = formString(formData, "projectId");

  if (projectId === "") return actionError("Missing project.");

  const parsed = projectInputSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });

  if (!parsed.success) {
    return actionError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    await updateProject(user.id, projectId, parsed.data);
  } catch {
    return actionError("Project not found.");
  }

  revalidateProjectViews(projectId);
  return { ok: true, message: "Project updated." };
}

export async function deleteProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserForAction();
  const projectId = formString(formData, "projectId");

  if (projectId === "") return actionError("Missing project.");

  try {
    await deleteProject(user.id, projectId);
  } catch {
    return actionError("Project not found.");
  }

  revalidateProjectViews(projectId);
  redirect("/projects");
}
