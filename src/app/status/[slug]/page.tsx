import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { MonitorStatusBadge, StatusDot } from "@/components/status-indicator";
import { UptimeBar, UptimeBarLegend } from "@/components/uptime-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { IncidentTimeline } from "@/modules/incidents/components/incident-timeline";
import {
  getPublicStatusPage,
  STATUS_PAGE_HISTORY_DAYS,
  type OverallStatus,
} from "@/modules/status-pages/queries";

/**
 * The public, unauthenticated status page at `/status/<slug>`.
 *
 * It lives outside the `(app)` route group on purpose: that group's layout calls
 * `requireUser()`, and this page must be reachable by anyone. `getPublicStatusPage`
 * returns null for a missing *or* hidden page, so both produce a plain 404 and a
 * private page never hints that its slug exists.
 *
 * Rendering is cached for a short window: a status page is embedded on customer
 * sites and polled, so serving a one-minute-old snapshot is fine and keeps the
 * database free during a traffic spike.
 */

export const revalidate = 60;

// `generateMetadata` and the page body both need the record; memoising per
// request means the database is queried once, not twice.
const getSharedPage = cache(getPublicStatusPage);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getSharedPage(slug);

  if (page === null) return { title: "Status page not found" };

  return {
    title: page.title,
    description: page.description ?? `Live status for ${page.projectName}.`,
  };
}

const OVERALL_META: Record<OverallStatus, { label: string; className: string }> = {
  operational: { label: "All systems operational", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  degraded: { label: "Partially degraded service", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  outage: { label: "Major outage", className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" },
};

export default async function PublicStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getSharedPage(slug);
  if (page === null) notFound();

  const overall = OVERALL_META[page.overallStatus];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold">{page.title}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-10">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
          {page.description !== null && page.description !== "" ? (
            <p className="text-muted-foreground text-sm">{page.description}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {page.projectName} · updated {formatRelativeTime(page.updatedAt)}
          </p>
        </div>

        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${overall.className}`}>
          {overall.label}
        </div>

        {page.activeIncidents.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-sm font-medium">Active incidents</h2>
            <Card>
              <CardContent className="pt-6">
                <IncidentTimeline incidents={page.activeIncidents} />
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-sm font-medium">Components</h2>

          {page.monitors.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
              No components are being monitored yet.
            </div>
          ) : (
            <div className="space-y-4">
              {page.monitors.map((monitor) => (
                <Card key={monitor.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <StatusDot status={monitor.status} paused={!monitor.enabled} />
                        <span className="font-mono text-sm">{monitor.name}</span>
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {monitor.uptime90d === null
                            ? "no data"
                            : `${monitor.uptime90d.toFixed(2)}% uptime`}
                        </span>
                        <MonitorStatusBadge status={monitor.status} paused={!monitor.enabled} />
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      Last checked {formatRelativeTime(monitor.lastCheckedAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <UptimeBar points={monitor.history} />
                    <UptimeBarLegend days={STATUS_PAGE_HISTORY_DAYS} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {page.recentIncidents.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-sm font-medium">Past incidents</h2>
            <Card>
              <CardContent className="pt-6">
                <IncidentTimeline incidents={page.recentIncidents} />
              </CardContent>
            </Card>
          </section>
        ) : null}
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4 text-xs">
          <span>Powered by PulseWatch</span>
          <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
            Uptime monitoring
          </Link>
        </div>
      </footer>
    </div>
  );
}
