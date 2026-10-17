export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { FeedbackService } from "@/lib/services/FeedbackService";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const queue = await FeedbackService.getFeedbackQueue();
    const allFeedbackCalls = await prisma.feedbackCall.findMany({
      include: {
        job: {
          include: { customer: true, assignedTechnician: true },
        },
      },
      orderBy: { calledAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ queue, calls: allFeedbackCalls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireJobsPermission(req, "jobs.feedback");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { jobId, calledBy = gate.actor.name || "Call Center Agent", outcome, remarks, technicianRemarks, followUpDate } = body;

    const call = await FeedbackService.recordFeedback({
      jobId,
      calledBy,
      outcome,
      remarks,
      technicianRemarks,
      followUpDate,
    });

    return NextResponse.json(call, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
