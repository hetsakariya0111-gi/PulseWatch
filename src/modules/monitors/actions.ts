"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionState } from "@/lib/action";
import { requireUserForAction } from "@/modules/auth/session";

import { monitorFormSchema, type MonitorFormValues } from "./schema";
import {
  MonitorValidationError,
  createMonitor,
  deleteMonitor,
  setMonitorEnabled,
  updateMonitor,
} from "./service";

/**
 * Monitor server actions.
 *
 * These take a plain object (not FormData) because the monitor form is built
 * with React Hook Form + Zod and already holds typed values. The values are
 * re-validated here: client-side validation is a convenience, never a
 * security boundary.
 */

function revalidateMonitorViews(): void {
  revalidatePath("/dashboard");
  // Revalidates /projects and every nested route (e.g. /projects/[id]).
  revalidatePath("/projects", "layout");
}

export async function createMonitorAction(
  projectId: string,
  values: MonitorFormValues,
): Promise<ActionState<{ id: string }>> {
  const user = await requireUserForAction();

  const parsed = monitorFormSchema.safeParse(values);
  if (!parsed.success) {
    return actionError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const monitor = await createMonitor(user.id, projectId, parsed.data);
    revalidateMonitorViews();
    return { ok: true, message: "Monitor created.", data: monitor };
  } catch (error) {
    if (error instanceof MonitorValidationError) return actionError(error.message);
    throw error;
  }
}

export async function updateMonitorAction(
  monitorId: string,
  values: MonitorFormValues,
): Promise<ActionState> {
  const user = await requireUserForAction();

  const parsed = monitorFormSchema.safeParse(values);
  if (!parsed.success) {
    return actionError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    await updateMonitor(user.id, monitorId, parsed.data);
    revalidatePath(`/monitors/${monitorId}`);
    revalidateMonitorViews();
    return { ok: true, message: "Monitor updated." };
  } catch (error) {
    if (error instanceof MonitorValidationError) return actionError(error.message);
    throw error;
  }
}

export async function deleteMonitorAction(monitorId: string): Promise<ActionState> {
  const user = await requireUserForAction();

  try {
    await deleteMonitor(user.id, monitorId);
    revalidateMonitorViews();
    return { ok: true, message: "Monitor deleted." };
  } catch (error) {
    if (error instanceof MonitorValidationError) return actionError(error.message);
    throw error;
  }
}

export async function toggleMonitorAction(monitorId: string, enabled: boolean): Promise<ActionState> {
  const user = await requireUserForAction();

  try {
    await setMonitorEnabled(user.id, monitorId, enabled);
    revalidatePath(`/monitors/${monitorId}`);
    revalidateMonitorViews();
    return { ok: true, message: enabled ? "Monitor resumed." : "Monitor paused." };
  } catch (error) {
    if (error instanceof MonitorValidationError) return actionError(error.message);
    throw error;
  }
}
