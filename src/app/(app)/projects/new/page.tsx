import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_PROJECTS_PER_USER } from "@/modules/monitors/constants";
import { ProjectForm } from "@/modules/projects/components/project-form";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="New project" description="Group the monitors that belong together.">
        <Button asChild variant="ghost">
          <Link href="/projects">
            <ArrowLeft />
            Back
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            You can have up to {MAX_PROJECTS_PER_USER} projects. Each project can hold 20 monitors
            and publish one status page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
