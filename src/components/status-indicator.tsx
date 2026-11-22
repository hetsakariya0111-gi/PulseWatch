import type { IncidentStatus, MonitorStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for how a monitor or incident state is presented.
 *
 * Status colours live here rather than at each call site so the dashboard, the
 * monitor detail page and the public status page can never disagree about what
 * "degraded" looks like.
 */

const MONITOR_STATUS_META: Record<
  MonitorStatus,
  { label: string; dot: string; text: string; badge: "success" | "destructive" | "secondary" }
> = {
  UP: { label: "Operational", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", badge: "success" },
  DOWN: { label: "Down", dot: "bg-red-500", text: "text-red-600 dark:text-red-400", badge: "destructive" },
  UNKNOWN: { label: "Pending", dot: "bg-muted-foreground", text: "text-muted-foreground", badge: "secondary" },
};

const INCIDENT_STATUS_META: Record<
  IncidentStatus,
  { label: string; badge: "destructive" | "warning" | "secondary" | "success" }
> = {
  INVESTIGATING: { label: "Investigating", badge: "destructive" },
  IDENTIFIED: { label: "Identified", badge: "warning" },
  MONITORING: { label: "Monitoring", badge: "warning" },
  RESOLVED: { label: "Resolved", badge: "success" },
};

export function StatusDot({
  status,
  paused = false,
  className,
}: {
  status: MonitorStatus;
  paused?: boolean;
  className?: string;
}) {
  const color = paused ? "bg-muted-foreground" : MONITOR_STATUS_META[status].dot;

  return (
    <span className={cn("relative flex size-2.5 shrink-0", className)} aria-hidden="true">
      {!paused && status === "DOWN" ? (
        // A soft halo only for DOWN: it is the one state a glance must catch.
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", color)} />
      ) : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", color)} />
    </span>
  );
}

export function MonitorStatusBadge({
  status,
  paused = false,
  className,
}: {
  status: MonitorStatus;
  paused?: boolean;
  className?: string;
}) {
  const meta = MONITOR_STATUS_META[status];

  if (paused) {
    return (
      <Badge variant="outline" className={className}>
        Paused
      </Badge>
    );
  }

  return (
    <Badge variant={meta.badge} className={className}>
      {meta.label}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const meta = INCIDENT_STATUS_META[status];
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

/** Human label for an incident state, e.g. in a <Select>. */
export function incidentStatusLabel(status: IncidentStatus): string {
  return INCIDENT_STATUS_META[status].label;
}
