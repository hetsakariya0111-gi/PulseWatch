"use client";

import { Trash2 } from "lucide-react";
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
import { deleteProjectAction } from "@/modules/projects/actions";

/**
 * Destructive action behind a confirmation dialog.
 *
 * The confirmation exists because deleting a project cascades to every monitor,
 * check result and incident underneath it — there is no undo.
 */
export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [state, formAction, isPending] = useActionState(deleteProjectAction, initialActionState);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the project, all of its monitors, their check history, incidents
            and the public status page. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.message !== undefined && !state.ok ? (
          <p className="text-destructive text-sm">{state.message}</p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting…" : "Delete project"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
