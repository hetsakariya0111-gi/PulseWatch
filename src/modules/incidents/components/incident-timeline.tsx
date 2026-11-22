import type { IncidentStatus } from "@/generated/prisma/enums";
import { IncidentStatusBadge } from "@/components/status-indicator";
import { formatDateTimeUtc, formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface IncidentTimelineUpdate {
  id: string;
  message: string;
  status: IncidentStatus | null;
  createdAt: Date;
}

export interface IncidentTimelineIncident {
  id: string;
  title: string;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  durationMs: number | null;
  updates: IncidentTimelineUpdate[];
}

/**
 * Read-only incident history. Shared by the monitor detail page, the dashboard
 * and the public status page — the public page simply does not render the
 * compose form that sits next to it.
 */
export function IncidentTimeline({ incidents }: { incidents: IncidentTimelineIncident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No incidents recorded.
      </div>
    );
  }

  return (
    <ol className="space-y-6">
      {incidents.map((incident) => (
        <li key={incident.id} className="relative border-l pl-6">
          <span
            className={cn(
              "absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-2 ring-background",
              incident.resolvedAt === null ? "bg-red-500" : "bg-emerald-500",
            )}
            aria-hidden="true"
          />

          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium">{incident.title}</h4>
            <IncidentStatusBadge status={incident.status} />
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Started {formatDateTimeUtc(incident.startedAt)}
            {incident.resolvedAt === null
              ? " · ongoing"
              : ` · resolved ${formatRelativeTime(incident.resolvedAt)} · lasted ${formatDuration(incident.durationMs)}`}
          </p>

          {incident.updates.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {incident.updates.map((update) => (
                <li key={update.id} className="rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatDateTimeUtc(update.createdAt)}</span>
                    {update.status !== null ? <IncidentStatusBadge status={update.status} /> : null}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{update.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
