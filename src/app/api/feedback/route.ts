import { NextRequest, NextResponse } from "next/server";
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
  try {
    const body = await req.json();
    const { jobId, calledBy = "Call Center Agent", outcome, remarks, followUpDate } = body;

    const call = await FeedbackService.recordFeedback({
      jobId,
      calledBy,
      outcome,
      remarks,
      followUpDate,
    });

    return NextResponse.json(call, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
