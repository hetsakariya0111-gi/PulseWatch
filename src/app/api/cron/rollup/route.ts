import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { runDailyRollup } from "@/modules/checks/rollup";

/**
 * POST /api/cron/rollup
 *
 * Run once a day (00:15 UTC) by cron-job.org. Collapses finished days into
 * `daily_rollups` and prunes raw checks past the retention window.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const denied = authorizeCronRequest(request, "rollup");
  if (denied !== null) return denied;

  try {
    const summary = await runDailyRollup();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    logger.error("rollup crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Rollup failed" }, { status: 500 });
  }
}
