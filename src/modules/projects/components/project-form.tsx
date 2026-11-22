"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action";
import { createProjectAction, updateProjectAction } from "@/modules/projects/actions";

function FieldError({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) return null;
  return <p className="text-destructive text-xs">{messages[0]}</p>;
}

/**
 * Create/edit form for a project.
 *
 * Both modes share one component because the fields are identical; only the
 * server action and the hidden id differ. `useActionState` is used rather than
 * React Hook Form here because the project actions already speak FormData.
 */
export function ProjectForm({
  mode,
  projectId,
  defaultValues,
}: {
  mode: "create" | "edit";
  projectId?: string;
  defaultValues?: { name: string; description: string };
}) {
  const [state, formAction, isPending] = useActionState(
    mode === "create" ? createProjectAction : updateProjectAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {projectId !== undefined ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : null}

      {state.message !== undefined ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          placeholder="Marketing site"
          required
          maxLength={80}
          aria-invalid={state.fieldErrors?.name !== undefined}
        />
        <FieldError messages={state.fieldErrors?.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          placeholder="Public pages and the marketing API."
          rows={3}
          maxLength={280}
          aria-invalid={state.fieldErrors?.description !== undefined}
        />
        <FieldError messages={state.fieldErrors?.description} />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create project"
              : "Save changes"}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href={projectId === undefined ? "/projects" : `/projects/${projectId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
