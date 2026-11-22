import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorForm } from "@/modules/monitors/components/monitor-form";
import { getMonitorDetailForCurrentUser } from "@/modules/monitors/queries";
import { toFormValues } from "@/modules/monitors/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const monitor = await getMonitorDetailForCurrentUser(id);
  return { title: monitor === null ? "Edit monitor" : `Edit · ${monitor.name}` };
}

export default async function EditMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const monitor = await getMonitorDetailForCurrentUser(id);
  if (monitor === null) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Edit monitor" description={monitor.url}>
        <Button asChild variant="ghost">
          <Link href={`/monitors/${monitor.id}`}>
            <ArrowLeft />
            Back to monitor
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Monitor settings</CardTitle>
          <CardDescription>
            Changing the interval reschedules the next check. Pausing a monitor clears its due time
            so the scheduler skips it completely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonitorForm
            mode="edit"
            monitorId={monitor.id}
            projectId={monitor.projectId}
            defaultValues={toFormValues(monitor)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
