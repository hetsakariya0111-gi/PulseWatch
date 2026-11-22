import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_MONITORS_PER_PROJECT } from "@/modules/monitors/constants";
import { MonitorTable } from "@/modules/monitors/components/monitor-table";
import { DeleteProjectButton } from "@/modules/projects/components/delete-project-button";
import { ProjectForm } from "@/modules/projects/components/project-form";
import { getProjectForCurrentUser } from "@/modules/projects/queries";
import { StatusPageForm } from "@/modules/status-pages/components/status-page-form";
import { UnpublishStatusPageButton } from "@/modules/status-pages/components/unpublish-status-page-button";
import { getStatusPageForCurrentProject } from "@/modules/status-pages/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectForCurrentUser(id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectForCurrentUser(id);

  // A missing project and a project owned by somebody else are the same thing
  // here: both return null, and both get a 404.
  if (project === null) notFound();

  const statusPage = await getStatusPageForCurrentProject(id);
  const canAddMonitor = project.monitors.length < MAX_MONITORS_PER_PROJECT;

  return (
    <div className="space-y-8">
      <PageHeader title={project.name} description={project.description ?? "No description."}>
        <Button asChild variant="ghost">
          <Link href="/projects">
            <ArrowLeft />
            Projects
          </Link>
        </Button>
        {canAddMonitor ? (
          <Button asChild>
            <Link href={`/projects/${project.id}/monitors/new`}>
              <Plus />
              Add monitor
            </Link>
          </Button>
        ) : (
          <Button disabled title={`Limit of ${MAX_MONITORS_PER_PROJECT} monitors reached`}>
            <Plus />
            Add monitor
          </Button>
        )}
        <DeleteProjectButton projectId={project.id} name={project.name} />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Monitors</CardTitle>
          <CardDescription>
            {project.monitors.length === 0
              ? "Nothing is being checked in this project yet."
              : `${project.monitors.length} of ${MAX_MONITORS_PER_PROJECT} slots used. Checks run on the fixed interval you chose for each monitor.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.monitors.length === 0 ? (
            <EmptyState
              title="No monitors"
              description="Add a URL and PulseWatch will start probing it on the next scheduler tick — usually within a minute."
            >
              <Button asChild size="sm">
                <Link href={`/projects/${project.id}/monitors/new`}>Add your first monitor</Link>
              </Button>
            </EmptyState>
          ) : (
            <MonitorTable monitors={project.monitors} redirectTo={`/projects/${project.id}`} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project settings</CardTitle>
            <CardDescription>Rename the project or change its description.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectForm
              mode="edit"
              projectId={project.id}
              defaultValues={{ name: project.name, description: project.description ?? "" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Public status page
              {statusPage !== null ? (
                <Badge variant={statusPage.isPublic ? "success" : "secondary"}>
                  {statusPage.isPublic ? "Live" : "Hidden"}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              {statusPage === null
                ? "Publish a page that shows this project's monitors, 90-day uptime and incident history."
                : `Served at /status/${statusPage.slug}. Re-rendered whenever checks update.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusPageForm
              projectId={project.id}
              projectName={project.name}
              defaultValues={
                statusPage === null
                  ? undefined
                  : {
                      slug: statusPage.slug,
                      title: statusPage.title,
                      description: statusPage.description ?? "",
                      isPublic: statusPage.isPublic,
                    }
              }
            />

            {statusPage !== null ? (
              <div className="border-t pt-4">
                <UnpublishStatusPageButton statusPageId={statusPage.id} projectId={project.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
