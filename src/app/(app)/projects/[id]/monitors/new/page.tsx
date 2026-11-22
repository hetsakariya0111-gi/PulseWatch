import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorForm } from "@/modules/monitors/components/monitor-form";
import { getProjectForCurrentUser } from "@/modules/projects/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectForCurrentUser(id);
  return { title: project === null ? "New monitor" : `New monitor · ${project.name}` };
}

export default async function NewMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectForCurrentUser(id);
  if (project === null) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add monitor"
        description={`New monitor in ${project.name}. It becomes due immediately, so the first result usually lands within a minute.`}
      >
        <Button asChild variant="ghost">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft />
            {project.name}
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Monitor settings</CardTitle>
          <CardDescription>
            Failures and recoveries are only recorded as incidents once the thresholds below are
            crossed, which filters out single-packet flakiness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonitorForm mode="create" projectId={project.id} />
        </CardContent>
      </Card>
    </div>
  );
}
