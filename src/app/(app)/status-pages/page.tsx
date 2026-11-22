import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectsForCurrentUser } from "@/modules/projects/queries";
import { UnpublishStatusPageButton } from "@/modules/status-pages/components/unpublish-status-page-button";
import { getStatusPagesForCurrentUser } from "@/modules/status-pages/queries";

export const metadata: Metadata = { title: "Status pages" };

export default async function StatusPagesPage() {
  const [pages, projects] = await Promise.all([
    getStatusPagesForCurrentUser(),
    getProjectsForCurrentUser(),
  ]);

  const publishedIds = new Set(pages.map((page) => page.projectId));
  const unpublished = projects.filter((project) => !publishedIds.has(project.id));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Status pages"
        description="Every project owns one public page. Publish it to share live uptime with your users."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Status pages are published from a project, so create a project first."
        >
          <Button asChild size="sm">
            <Link href="/projects/new">Create a project</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-medium">Published · {pages.length}</h2>

            {pages.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
                You have not published a status page yet.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {pages.map((page) => (
                  <Card key={page.id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{page.title}</CardTitle>
                        <Badge variant={page.isPublic ? "success" : "secondary"}>
                          {page.isPublic ? "Live" : "Hidden"}
                        </Badge>
                      </div>
                      <CardDescription>
                        <Link
                          href={`/projects/${page.projectId}`}
                          className="hover:text-foreground underline-offset-4 hover:underline"
                        >
                          {page.projectName}
                        </Link>
                        {" · "}
                        <span className="font-mono">/status/{page.slug}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2">
                      {page.isPublic ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={`/status/${page.slug}`} target="_blank" rel="noreferrer noopener">
                            View page
                            <ExternalLink />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled title="This page is hidden">
                          Hidden
                        </Button>
                      )}

                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/projects/${page.projectId}`}>Manage</Link>
                      </Button>

                      <UnpublishStatusPageButton statusPageId={page.id} projectId={page.projectId} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {unpublished.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-medium">Not published · {unpublished.length}</h2>
              <div className="divide-y rounded-md border">
                {unpublished.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {project.monitorCounts.total} monitors
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/projects/${project.id}`}>Publish a page</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
