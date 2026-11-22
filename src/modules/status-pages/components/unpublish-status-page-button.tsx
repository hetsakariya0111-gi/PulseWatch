"use client";

import { useActionState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/action";
import { deleteStatusPageAction } from "@/modules/status-pages/actions";

/** Removes a project's status page entirely (removing, not just hiding it). */
export function UnpublishStatusPageButton({
  statusPageId,
  projectId,
}: {
  statusPageId: string;
  projectId: string;
}) {
  const [state, formAction, isPending] = useActionState(deleteStatusPageAction, initialActionState);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">
          Remove status page
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove the status page?</AlertDialogTitle>
          <AlertDialogDescription>
            The public URL will start returning 404. Your monitors and history are not affected, and
            you can publish a page again at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.message !== undefined && !state.ok ? (
          <p className="text-destructive text-sm">{state.message}</p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="statusPageId" value={statusPageId} />
            <input type="hidden" name="projectId" value={projectId} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Removing…" : "Remove page"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
