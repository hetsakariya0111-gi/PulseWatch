import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { IncidentStatusBadge } from "@/components/status-indicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { IncidentTimeline } from "@/modules/incidents/components/incident-timeline";
import { IncidentUpdateForm } from "@/modules/incidents/components/incident-update-form";
import { listIncidentsForUser } from "@/modules/incidents/service";

export const metadata: Metadata = { title: "Incidents" };

export default async function IncidentsPage() {
  const user = await requireUser();
  const incidents = await listIncidentsForUser(user.id);
  const active = incidents.filter((incident) => incident.resolvedAt === null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Incidents"
        description="Outages opened automatically by the check engine, newest first."
      />

      {incidents.length === 0 ? (
        <EmptyState
          title="No incidents yet"
          description="When a monitor crosses its failure threshold an incident opens here automatically."
        />
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-medium">
              Open {active.length === 1 ? "incident" : "incidents"} · {active.length}
            </h2>

            {active.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
                Everything is operational right now.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {active.map((incident) => (
                  <Card key={incident.id} className="gap-4 py-5">
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{incident.title}</CardTitle>
                        <IncidentStatusBadge status={incident.status} />
                      </div>
                      <CardDescription>
                        <Link
                          href={`/monitors/${incident.monitor.id}`}
                          className="hover:text-foreground underline-offset-4 hover:underline"
                        >
                          {incident.monitor.name}
                        </Link>
                        {" · started "}
                        {formatRelativeTime(incident.startedAt)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <IncidentUpdateForm incidentId={incident.id} monitorId={incident.monitor.id} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium">History</h2>
            <Card>
              <CardContent className="pt-6">
                <IncidentTimeline incidents={incidents} />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
