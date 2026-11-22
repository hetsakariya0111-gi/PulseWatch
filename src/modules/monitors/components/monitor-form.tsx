"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createMonitorAction, updateMonitorAction } from "@/modules/monitors/actions";
import {
  MAX_THRESHOLD,
  MAX_TIMEOUT_MS,
  MIN_THRESHOLD,
  MIN_TIMEOUT_MS,
  MONITOR_INTERVAL_STRINGS,
} from "@/modules/monitors/constants";
import {
  defaultMonitorValues,
  monitorFormSchema,
  type MonitorFormValues,
} from "@/modules/monitors/schema";

function FieldError({ message }: { message?: string }) {
  if (message === undefined) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

function intervalLabel(value: string): string {
  return value === "60" ? "Every 60 minutes" : `Every ${value} minute${value === "1" ? "" : "s"}`;
}

/**
 * Create/edit form for a monitor.
 *
 * React Hook Form is used here (unlike the project form) because the monitor
 * actions take a typed object rather than FormData — so the form owns the
 * values and validates them client-side with the exact same Zod schema the
 * server re-runs. Client validation is only a convenience; the action always
 * re-parses, and the URL is re-checked for SSRF safety on the server.
 */
export function MonitorForm({
  mode,
  projectId,
  monitorId,
  defaultValues,
}: {
  mode: "create" | "edit";
  projectId?: string;
  monitorId?: string;
  defaultValues?: MonitorFormValues;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<MonitorFormValues>({
    resolver: zodResolver(monitorFormSchema),
    defaultValues: defaultValues ?? defaultMonitorValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);

    startTransition(async () => {
      if (mode === "edit") {
        if (monitorId === undefined) {
          setServerError("Missing monitor id.");
          return;
        }

        const result = await updateMonitorAction(monitorId, values);
        if (!result.ok) {
          setServerError(result.message ?? "Could not save the monitor.");
          return;
        }

        router.push(`/monitors/${monitorId}`);
        router.refresh();
        return;
      }

      if (projectId === undefined) {
        setServerError("Missing project id.");
        return;
      }

      const result = await createMonitorAction(projectId, values);
      if (!result.ok) {
        setServerError(result.message ?? "Could not create the monitor.");
        return;
      }

      if (result.data !== undefined) {
        router.push(`/monitors/${result.data.id}`);
      } else {
        router.push(`/projects/${projectId}`);
      }
      router.refresh();
    });
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {serverError !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Marketing homepage" aria-invalid={errors.name !== undefined} {...form.register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          placeholder="https://example.com/health"
          aria-invalid={errors.url !== undefined}
          {...form.register("url")}
        />
        <p className="text-muted-foreground text-xs">
          Must be a public http(s) address. Private, loopback and cloud-metadata addresses are
          rejected.
        </p>
        <FieldError message={errors.url?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Type</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="API">API endpoint</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.type?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="method">HTTP method</Label>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="HEAD">HEAD</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.method?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="intervalMinutes">Check interval</Label>
          <Controller
            control={form.control}
            name="intervalMinutes"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="intervalMinutes" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONITOR_INTERVAL_STRINGS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {intervalLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.intervalMinutes?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="timeoutMs">Timeout (ms)</Label>
          <Input
            id="timeoutMs"
            type="number"
            inputMode="numeric"
            min={MIN_TIMEOUT_MS}
            max={MAX_TIMEOUT_MS}
            step={500}
            aria-invalid={errors.timeoutMs !== undefined}
            {...form.register("timeoutMs")}
          />
          <FieldError message={errors.timeoutMs?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expectedStatusCodes">Expected status codes</Label>
          <Input
            id="expectedStatusCodes"
            placeholder="200, 204"
            aria-invalid={errors.expectedStatusCodes !== undefined}
            {...form.register("expectedStatusCodes")}
          />
          <FieldError message={errors.expectedStatusCodes?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="failureThreshold">Failures before incident</Label>
          <Input
            id="failureThreshold"
            type="number"
            inputMode="numeric"
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            aria-invalid={errors.failureThreshold !== undefined}
            {...form.register("failureThreshold")}
          />
          <FieldError message={errors.failureThreshold?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recoveryThreshold">Successes before recovery</Label>
          <Input
            id="recoveryThreshold"
            type="number"
            inputMode="numeric"
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            aria-invalid={errors.recoveryThreshold !== undefined}
            {...form.register("recoveryThreshold")}
          />
          <FieldError message={errors.recoveryThreshold?.message} />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="enabled">Enabled</Label>
            <p className="text-muted-foreground text-xs">Pausing stops all scheduled checks.</p>
          </div>
          <Controller
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={2}
          placeholder="What this monitor covers."
          aria-invalid={errors.description !== undefined}
          {...form.register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create monitor" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            router.back();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
