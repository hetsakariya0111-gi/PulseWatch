import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_PROJECTS_PER_USER } from "@/modules/monitors/constants";
import { getProjectsForCurrentUser } from "@/modules/projects/queries";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await getProjectsForCurrentUser();
  const atLimit = projects.length >= MAX_PROJECTS_PER_USER;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="A project groups related monitors and owns one public status page."
      >
        {atLimit ? (
          <Button disabled title={`Limit of ${MAX_PROJECTS_PER_USER} projects reached`}>
            <Plus />
            New project
          </Button>
        ) : (
          <Button asChild>
            <Link href="/projects/new">
              <Plus />
              New project
            </Link>
          </Button>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project first, then add the websites and APIs you want to watch."
        >
          <Button asChild size="sm">
            <Link href="/projects/new">Create your first project</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="transition-colors hover:border-ring">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {project.monitorCounts.down > 0 ? (
                    <StatusDot status="DOWN" />
                  ) : (
                    <StatusDot status="UP" />
                  )}
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {project.description ?? "No description."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{project.monitorCounts.total} monitors</span>
                <span>{project.monitorCounts.up} up</span>
                {project.monitorCounts.down > 0 ? (
                  <span className="text-destructive font-medium">
                    {project.monitorCounts.down} down
                  </span>
                ) : null}
                {project.monitorCounts.paused > 0 ? (
                  <span>{project.monitorCounts.paused} paused</span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
