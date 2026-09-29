export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { JobsService } from "@/lib/services/JobsService";
import { requireJobsPermission } from "@/lib/auth/erpActor";

/**
 * Auditor verification queue.
 * Shows Finalized jobs awaiting checklist verify (LOGICS: Verified follows Finalized).
 * CompletedPendingVerification is accountant finalize work — not listed here.
 */
export async function GET(req: NextRequest) {
  const gate = await requireJobsPermission(req, "jobs.verify");
  if (gate.error) return gate.error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const includeSentBack = searchParams.get("includeSentBack") === "true";
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const pendingCount = await JobsService.countPendingVerifications();
      return NextResponse.json({ pendingCount });
    }

    const queue = await JobsService.getVerificationQueue({ search, includeSentBack });
    const pendingCount = await JobsService.countPendingVerifications();
    return NextResponse.json({ queue, pendingCount, actor: gate.actor.role });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}