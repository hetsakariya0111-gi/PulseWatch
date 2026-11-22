"use client";

import { Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteMonitorAction, toggleMonitorAction } from "@/modules/monitors/actions";

/**
 * Pause/resume and delete for one monitor.
 *
 * Both operations are server actions that re-check ownership, so the buttons
 * carry no authority of their own — `router.refresh()` simply re-renders the
 * server component with the new state.
 */
export function MonitorActions({
  monitorId,
  enabled,
  name,
  redirectTo,
}: {
  monitorId: string;
  enabled: boolean;
  name: string;
  /** Where to go after a successful delete (e.g. back to the project). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle(): void {
    setError(null);
    startTransition(async () => {
      const result = await toggleMonitorAction(monitorId, !enabled);
      if (!result.ok) {
        setError(result.message ?? "Could not update the monitor.");
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(): void {
    setError(null);
    startTransition(async () => {
      const result = await deleteMonitorAction(monitorId);
      if (!result.ok) {
        setError(result.message ?? "Could not delete the monitor.");
        return;
      }
      if (redirectTo !== undefined) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {error !== null ? (
        <span className="text-destructive mr-2 hidden text-xs sm:inline">{error}</span>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
        title={enabled ? "Pause this monitor" : "Resume this monitor"}
      >
        {enabled ? <Pause /> : <Play />}
        <span className="hidden sm:inline">{enabled ? "Pause" : "Resume"}</span>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            title="Delete this monitor"
          >
            <Trash2 />
            <span className="sr-only">Delete</span>
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its check history and incidents will be removed as well. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? "Deleting…" : "Delete monitor"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
