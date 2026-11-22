import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ResponseTimeChart } from "@/components/response-time-chart";
import { MonitorStatusBadge, StatusDot } from "@/components/status-indicator";
import { UptimeBar, UptimeBarLegend } from "@/components/uptime-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeUtc, formatDuration, formatRelativeTime, formatResponseTime } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { CheckHistoryTable } from "@/modules/checks/components/check-history-table";
import {
  getCheckHistory,
  getDailyUptime,
  getResponseTimeSeries,
  getUptimeWindows,
  type UptimeStats,
} from "@/modules/checks/queries";
import { IncidentTimeline } from "@/modules/incidents/components/incident-timeline";
import { IncidentUpdateForm } from "@/modules/incidents/components/incident-update-form";
import { listIncidentsForMonitor } from "@/modules/incidents/service";
import { MonitorActions } from "@/modules/monitors/components/monitor-actions";
import { getMonitorDetailForCurrentUser } from "@/modules/monitors/queries";
import { formatStatusCodes } from "@/modules/monitors/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const monitor = await getMonitorDetailForCurrentUser(id);
  return { title: monitor?.name ?? "Monitor" };
}

/** One column in the 24h / 7d / 30d / 90d uptime strip. */
function UptimeWindow({ label, stats }: { label: string; stats: UptimeStats }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {stats.uptime === null ? "—" : `${stats.uptime.toFixed(2)}%`}
      </p>
      <p className="text-muted-foreground text-xs">
        {stats.totalChecks.toLocaleString("en-US")} checks
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

const DAY = 86_400_000;

export default async function MonitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { id } = await params;
  const { after } = await searchParams;

  const monitor = await getMonitorDetailForCurrentUser(id);
  // A missing monitor and one owned by somebody else are the same thing here.
  if (monitor === null) notFound();

  const user = await requireUser();
  const now = new Date();
  const since = new Date(now.getTime() - DAY);

  const [windows, daily, series, history, incidents] = await Promise.all([
    getUptimeWindows(id, now),
    getDailyUptime(id, 90),
    // Hourly buckets for the last 24 hours: fine-grained enough to spot a
    // latency regression without rendering 1,440 points on a 1-minute monitor.
    getResponseTimeSeries(id, since, "hour", now),
    getCheckHistory(id, { cursor: after }),
    listIncidentsForMonitor(user.id, id),
  ]);

  const openIncident = incidents.find((incident) => incident.resolvedAt === null) ?? null;
  const last24h = windows.last24h;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/projects/${monitor.projectId}`}>
            <ArrowLeft />
            {monitor.projectName}
          </Link>
        </Button>

        <PageHeader
          title={monitor.name}
          description={monitor.url}
        >
          <Button asChild variant="outline" size="sm">
            <Link href={`/monitors/${monitor.id}/edit`}>Edit</Link>
          </Button>
          <MonitorActions
            monitorId={monitor.id}
            enabled={monitor.enabled}
            name={monitor.name}
            redirectTo={`/projects/${monitor.projectId}`}
          />
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2">
            <StatusDot status={monitor.status} paused={!monitor.enabled} />
            <MonitorStatusBadge status={monitor.status} paused={!monitor.enabled} />
          </span>
          <Badge variant="outline">{monitor.type}</Badge>
          <Badge variant="outline">{monitor.method}</Badge>
          <span className="text-muted-foreground text-xs">
            every {monitor.intervalMinutes} min · timeout {formatDuration(monitor.timeoutMs)} · expects{" "}
            {formatStatusCodes(monitor.expectedStatusCodes)}
          </span>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <a href={monitor.url} target="_blank" rel="noreferrer noopener">
              Open site
              <ExternalLink />
            </a>
          </Button>
        </div>

        {monitor.description !== null && monitor.description !== "" ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{monitor.description}</p>
        ) : null}

        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span>Last check: {formatRelativeTime(monitor.lastCheckedAt, now)}</span>
          <span>
            Next check:{" "}
            {monitor.enabled
              ? monitor.nextCheckAt === null
                ? "scheduled"
                : formatDateTimeUtc(monitor.nextCheckAt)
              : "paused"}
          </span>
          <span>Created {formatDateTimeUtc(monitor.createdAt)}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uptime</CardTitle>
          <CardDescription>
            One column per UTC day. Hover a column for that day&apos;s success rate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UptimeBar points={daily} />
          <UptimeBarLegend days={90} />

          <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
            <UptimeWindow label="24 hours" stats={windows.last24h} />
            <UptimeWindow label="7 days" stats={windows.last7d} />
            <UptimeWindow label="30 days" stats={windows.last30d} />
            <UptimeWindow label="90 days" stats={windows.last90d} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response time · last 24 hours</CardTitle>
          <CardDescription>Average latency per hour, from successful checks only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ResponseTimeChart points={series} granularity="hour" />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Average" value={formatResponseTime(last24h.avgResponseTimeMs)} />
            <Metric label="p95" value={formatResponseTime(last24h.p95ResponseTimeMs)} />
            <Metric label="Fastest" value={formatResponseTime(last24h.minResponseTimeMs)} />
            <Metric label="Slowest" value={formatResponseTime(last24h.maxResponseTimeMs)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incidents</CardTitle>
          <CardDescription>
            Opened and resolved automatically by the check engine. Add an update to narrate what
            is happening.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {openIncident !== null ? (
            <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-sm font-medium">Post an update on the open incident</p>
              <IncidentUpdateForm incidentId={openIncident.id} monitorId={monitor.id} />
            </div>
          ) : null}

          <IncidentTimeline incidents={incidents} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check history</CardTitle>
          <CardDescription>The most recent raw results, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <CheckHistoryTable
            monitorId={monitor.id}
            items={history.items}
            nextCursor={history.nextCursor}
            after={after ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
