import Link from "next/link";

import type { MonitorStatus } from "@/generated/prisma/enums";
import { MonitorStatusBadge, StatusDot } from "@/components/status-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/format";
import { MonitorActions } from "@/modules/monitors/components/monitor-actions";

/**
 * Only the columns this table renders. Declaring it structurally keeps the
 * table usable from both the project detail page (which selects fewer fields)
 * and the monitors list, without either query having to fetch the other's.
 */
export interface MonitorTableItem {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  enabled: boolean;
  intervalMinutes: number;
  lastCheckedAt: Date | null;
}

/** Formats a fixed interval ("every 5 min") for the table. */
function formatInterval(minutes: number): string {
  return minutes === 60 ? "every 60 min" : `every ${minutes} min`;
}

/**
 * Monitor list for a project. Server component — the only interactive part is
 * the actions column, which is a small client island.
 */
export function MonitorTable({
  monitors,
  redirectTo,
}: {
  monitors: MonitorTableItem[];
  redirectTo?: string;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Monitor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Interval</TableHead>
            <TableHead>Last check</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {monitors.map((monitor) => (
            <TableRow key={monitor.id}>
              <TableCell>
                <Link href={`/monitors/${monitor.id}`} className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <StatusDot status={monitor.status} paused={!monitor.enabled} />
                    {monitor.name}
                  </span>
                  <span className="text-muted-foreground truncate font-mono text-xs">
                    {monitor.url}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <MonitorStatusBadge status={monitor.status} paused={!monitor.enabled} />
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {monitor.enabled ? formatInterval(monitor.intervalMinutes) : "paused"}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatRelativeTime(monitor.lastCheckedAt)}
              </TableCell>
              <TableCell>
                <MonitorActions
                  monitorId={monitor.id}
                  enabled={monitor.enabled}
                  name={monitor.name}
                  redirectTo={redirectTo}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
