export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MobilePushService } from "@/lib/services/MobilePushService";
import { JobsService } from "@/lib/services/JobsService";
import { resolveCaller } from "@/lib/auth/mobileAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    const requestId = params.id;
    const body = await req.json();
    const { employeeId = caller.id, actionStatus, notes, reason, etaMinutes } = body;

    if (!actionStatus) {
      return NextResponse.json(
        { error: "actionStatus ('accepted' | 'rejected' | 'acknowledged') is required." },
        { status: 400 }
      );
    }

    const request = await prisma.mobileAppRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.recipientId !== caller.id && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: Request does not belong to this employee." },
        { status: 403 }
      );
    }

    const updatedRequest = await MobilePushService.respondToRequest(
      requestId,
      employeeId,
      actionStatus,
      { notes, reason, etaMinutes }
    );

    // If this was a JOB_DISPATCH and the technician accepted, advance Job status to "Accepted"
    let jobUpdateResult = null;
    if (request.type === "JOB_DISPATCH" && actionStatus === "accepted") {
      try {
        const payload = request.payloadJson ? JSON.parse(request.payloadJson) : {};
        if (payload.jobId) {
          jobUpdateResult = await JobsService.acceptJob(payload.jobId, employeeId);
        }
      } catch (err: any) {
        console.warn("[MobileGateway] Job acceptance transition notice:", err.message);
      }
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      job: jobUpdateResult,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
