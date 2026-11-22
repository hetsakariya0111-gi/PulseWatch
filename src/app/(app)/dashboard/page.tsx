import { Activity, AlertTriangle, ChartLine, Globe, ListChecks } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card"; 
import { IncidentStatusBadge, StatusDot } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { getUserDashboardSummary } from "@/modules/checks/queries";
import { listActiveIncidentsForUser } from "@/modules/incidents/service";
import { listProjectsForUser } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  // Three independent reads, so they run in parallel rather than in series.
  const [summary, activeIncidents, projects] = await Promise.all([
    getUserDashboardSummary(user.id),
    listActiveIncidentsForUser(user.id),
    listProjectsForUser(user.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Health across every monitor you own, refreshed by the scheduler."
      >
        <Button asChild>
          <Link href="/projects">
            <ListChecks />
            Manage projects
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Monitors"
          value={summary.totalMonitors}
          hint={`${summary.activeMonitors} active · ${summary.pausedMonitors} paused`}
        />
        <StatCard
          icon={ChartLine}
          label="Uptime · 24h"
          value={summary.uptimeLast24h === null ? "—" : `${summary.uptimeLast24h.toFixed(2)}%`}
          hint={`${summary.checksLast24h.toLocaleString("en-US")} checks recorded`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Down now"
          value={summary.downMonitors}
          hint={summary.downMonitors === 0 ? "Everything is responding" : "Failing probes"}
        />
        <StatCard
          icon={Globe}
          label="Open incidents"
          value={summary.activeIncidents}
          hint={summary.activeIncidents === 0 ? "No ongoing incidents" : "Awaiting recovery"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {activeIncidents.length === 0 ? (
              <EmptyState
                title="All clear"
                description="No monitor is currently in an incident state."
              />
            ) : (
              <ul className="divide-y">
                {activeIncidents.map((incident) => (
                  <li key={incident.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <StatusDot status="DOWN" className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/monitors/${incident.monitor.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {incident.monitor.name}
                        </Link>
                        <IncidentStatusBadge status={incident.status} />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Started {formatRelativeTime(incident.startedAt)} · {incident.title}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="A project groups the monitors that belong together and owns their status page."
              >
                <Button asChild size="sm">
                  <Link href="/projects/new">Create a project</Link>
                </Button>
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {projects.map((project) => (
                  <li key={project.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {project.monitorCounts.total} monitor
                        {project.monitorCounts.total === 1 ? "" : "s"} · {project.monitorCounts.up} up
                        {project.monitorCounts.down > 0
                          ? ` · ${project.monitorCounts.down} down`
                          : ""}
                        {project.monitorCounts.paused > 0
                          ? ` · ${project.monitorCounts.paused} paused`
                          : ""}
                      </p>
                    </div>
                    {project.monitorCounts.down > 0 ? (
                      <StatusDot status="DOWN" />
                    ) : (
                      <StatusDot status="UP" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
