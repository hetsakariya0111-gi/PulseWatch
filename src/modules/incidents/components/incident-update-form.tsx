"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action";
import { incidentStatusLabel } from "@/components/status-indicator";
import { addIncidentUpdateAction } from "@/modules/incidents/actions";

/** Statuses a human may set; RESOLVED also closes the incident. */
const STATUS_OPTIONS = ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"] as const;

/**
 * Lets the owner narrate an incident ("rolling back the deploy") while the
 * check engine keeps deciding up/down on its own. Posts through a server action,
 * so the incident ownership check happens on the server.
 */
export function IncidentUpdateForm({
  incidentId,
  monitorId,
}: {
  incidentId: string;
  monitorId: string;
}) {
  const [state, formAction, isPending] = useActionState(addIncidentUpdateAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea once the update is accepted. Done imperatively because
  // the fields are uncontrolled (they submit through FormData).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="incidentId" value={incidentId} />
      <input type="hidden" name="monitorId" value={monitorId} />

      {state.message !== undefined ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="incident-status">Status</Label>
        <Select name="status" defaultValue="INVESTIGATING">
          <SelectTrigger id="incident-status" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {incidentStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="incident-message">Update</Label>
        <Textarea
          id="incident-message"
          name="message"
          rows={2}
          maxLength={1000}
          required
          placeholder="We are rolling back the last deploy and monitoring recovery."
        />
      </div>

      <Button type="submit" size="sm" className="self-start" disabled={isPending}>
        {isPending ? "Posting…" : "Post update"}
      </Button>
    </form>
  );
}
