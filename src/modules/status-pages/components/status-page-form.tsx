"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveStatusPageAction } from "@/modules/status-pages/actions";
import { suggestSlug } from "@/modules/status-pages/schema";

function FieldError({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) return null;
  return <p className="text-destructive text-xs">{messages[0]}</p>;
}

/**
 * Publish/unpublish settings for a project's status page.
 *
 * A project has at most one status page, so this is always a save (upsert)
 * rather than a create — there is no "add a second page" case to design for.
 */
export function StatusPageForm({
  projectId,
  projectName,
  defaultValues,
}: {
  projectId: string;
  projectName: string;
  defaultValues?: { slug: string; title: string; description: string; isPublic: boolean };
}) {
  const [state, formAction, isPending] = useActionState(saveStatusPageAction, { ok: false });

  // The slug is controlled so the preview URL updates as the user types.
  const [slug, setSlug] = useState(defaultValues?.slug ?? suggestSlug(projectName));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />

      {state.message !== undefined ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">URL slug</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="acme-status"
          required
          maxLength={50}
          aria-invalid={state.fieldErrors?.slug !== undefined}
        />
        <p className="text-muted-foreground text-xs">
          Your page will live at{" "}
          <span className="font-mono">/status/{slug.trim().toLowerCase() || "your-slug"}</span>
        </p>
        <FieldError messages={state.fieldErrors?.slug} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultValues?.title ?? projectName}
          placeholder="Acme status"
          required
          maxLength={80}
          aria-invalid={state.fieldErrors?.title !== undefined}
        />
        <FieldError messages={state.fieldErrors?.title} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          placeholder="Current status of Acme's public services."
          rows={2}
          maxLength={280}
          aria-invalid={state.fieldErrors?.description !== undefined}
        />
        <FieldError messages={state.fieldErrors?.description} />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="isPublic">Publicly visible</Label>
          <p className="text-muted-foreground text-xs">
            When off, the page returns 404 for everyone. Use it to take the page offline without
            deleting it.
          </p>
        </div>
        <Switch id="isPublic" name="isPublic" defaultChecked={defaultValues?.isPublic ?? true} />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : defaultValues === undefined ? "Publish status page" : "Save page"}
        </Button>

        {defaultValues !== undefined && defaultValues.isPublic ? (
          <Button asChild type="button" variant="outline">
            <Link href={`/status/${defaultValues.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink />
              View page
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
