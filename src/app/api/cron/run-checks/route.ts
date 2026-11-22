import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { runScheduledChecks } from "@/modules/checks/engine";

/**
 * POST /api/cron/run-checks
 *
 * The only entry point into the check engine. cron-job.org hits it every minute
 * with `Authorization: Bearer $CRON_SECRET`.
 *
 * The Node runtime is a requirement, not a preference: the probe uses
 * node:http so it can pin the IP it validated, which the edge runtime does not
 * expose.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Give the run room to drain a full batch on Vercel. */
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const denied = authorizeCronRequest(request, "run-checks");
  if (denied !== null) return denied;

  try {
    const summary = await runScheduledChecks();
    logger.info("cron run finished", { ...summary });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    logger.error("cron run crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Check run failed" }, { status: 500 });
  }
}
