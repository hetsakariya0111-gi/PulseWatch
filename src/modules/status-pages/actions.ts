"use server";

import { revalidatePath } from "next/cache";

import { actionError, formBoolean, formString, type ActionState } from "@/lib/action";
import { requireUserForAction } from "@/modules/auth/session";

import { statusPageInputSchema } from "./schema";
import { deleteStatusPage, saveStatusPage, StatusPageError } from "./service";

function revalidateStatusPageViews(projectId: string, slug?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/status-pages");
  revalidatePath(`/projects/${projectId}`);
  if (slug !== undefined) revalidatePath(`/status/${slug}`);
}

export async function saveStatusPageAction(
  _prev: ActionState<{ slug: string }>,
  formData: FormData,
): Promise<ActionState<{ slug: string }>> {
  const user = await requireUserForAction();
  const projectId = formString(formData, "projectId");

  if (projectId === "") return actionError("Missing project.");

  const parsed = statusPageInputSchema.safeParse({
    slug: formString(formData, "slug"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    isPublic: formBoolean(formData, "isPublic"),
  });

  if (!parsed.success) {
    return actionError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const page = await saveStatusPage(user.id, projectId, parsed.data);
    revalidateStatusPageViews(projectId, page.slug);
    return { ok: true, message: "Status page saved.", data: { slug: page.slug } };
  } catch (error) {
    if (error instanceof StatusPageError) return actionError(error.message);
    throw error;
  }
}

export async function deleteStatusPageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserForAction();
  const statusPageId = formString(formData, "statusPageId");
  const projectId = formString(formData, "projectId");

  if (statusPageId === "") return actionError("Missing status page.");

  try {
    await deleteStatusPage(user.id, statusPageId);
  } catch (error) {
    if (error instanceof StatusPageError) return actionError(error.message);
    throw error;
  }

  revalidateStatusPageViews(projectId);
  return { ok: true, message: "Status page unpublished." };
}
