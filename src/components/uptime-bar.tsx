import type { DailyUptimePoint } from "@/modules/checks/queries";
import { bucketClassName, formatShortDate, formatUptime, uptimeBucket } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The 90-day uptime bar (one thin column per UTC day).
 *
 * Server component on purpose — it is pure presentation and rendering it on the
 * server keeps the public status page fast and dependency-free.
 */
export function UptimeBar({
  points,
  className,
}: {
  points: DailyUptimePoint[];
  className?: string;
}) {
  if (points.length === 0) {
    return <div className={cn("h-8 w-full rounded bg-muted", className)} />;
  }

  return (
    <div className={cn("flex h-8 w-full items-stretch gap-px", className)} role="img" aria-label="Daily uptime for the last 90 days">
      {points.map((point) => {
        const bucket = uptimeBucket(point.uptime);
        const tooltip =
          point.uptime === null
            ? `${formatShortDate(point.date)}: no data`
            : `${formatShortDate(point.date)}: ${formatUptime(point.successChecks, point.totalChecks)} uptime (${point.totalChecks} checks)`;

        return (
          <span
            key={point.date.toISOString()}
            title={tooltip}
            className={cn("min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-70", bucketClassName(bucket))}
          />
        );
      })}
    </div>
  );
}

/** Legend shown under an uptime bar: "90 days ago … Today". */
export function UptimeBarLegend({ days }: { days: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{days} days ago</span>
      <span>Today</span>
    </div>
  );
}
