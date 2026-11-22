"use server";

import { revalidatePath } from "next/cache";

import { actionError, formString, type ActionState } from "@/lib/action";
import { requireUserForAction } from "@/modules/auth/session";

import { incidentUpdateSchema } from "./schema";
import { addIncidentUpdate } from "./service";

/**
 * Posts a user-authored update onto an incident.
 *
 * Incidents are normally opened and resolved by the check engine; this is the
 * escape hatch that lets a human narrate an outage ("we are rolling back the
 * deploy") without waiting for a probe to change state.
 */
export async function addIncidentUpdateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserForAction();

  const incidentId = formString(formData, "incidentId");
  const monitorId = formString(formData, "monitorId");

  if (incidentId === "") return actionError("Missing incident.");

  const parsed = incidentUpdateSchema.safeParse({
    message: formString(formData, "message"),
    status: formString(formData, "status"),
  });

  if (!parsed.success) {
    return actionError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    await addIncidentUpdate(user.id, incidentId, parsed.data);
  } catch {
    // The service scopes the lookup by owner, so "not found" also covers
    // "belongs to somebody else" — the caller learns nothing either way.
    return actionError("Incident not found.");
  }

  revalidatePath(`/monitors/${monitorId}`);
  revalidatePath("/incidents");
  revalidatePath("/dashboard");

  return { ok: true, message: "Update posted." };
}
