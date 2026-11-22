import { Activity, BellRing, ChartLine, Globe } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Marketing landing page. Public and statically rendered — it reads no session
 * and touches no database, so it can be served straight from the edge cache.
 */
const FEATURES = [
  {
    icon: Activity,
    title: "Scheduled checks",
    description: "HTTP/HTTPS probes with timeouts, expected status codes and SSRF protection.",
  },
  {
    icon: BellRing,
    title: "Incident tracking",
    description: "Downtime and recovery are detected automatically and recorded as incidents.",
  },
  {
    icon: ChartLine,
    title: "Uptime analytics",
    description: "Response-time charts, uptime percentages and longest downtime, computed in SQL.",
  },
  {
    icon: Globe,
    title: "Public status pages",
    description: "Publish a status page per project on a unique slug, server-rendered and cached.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="flex items-center gap-2 font-semibold">
          <Activity className="size-5" />
          PulseWatch
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Uptime monitoring, self-hosted.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            PulseWatch checks your websites and APIs on a schedule, records status codes and
            response times, detects downtime and recovery, and publishes a public status page.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/sign-up">Get started free</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Free for up to 10 projects and 20 monitors each. No credit card required.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="size-5 text-muted-foreground" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground" />
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-sm text-muted-foreground">
        PulseWatch · Next.js · Prisma · Auth.js
      </footer>
    </div>
  );
}
