export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // requisitions | candidates
    const stage = searchParams.get("stage") || undefined;
    const requisitionId = searchParams.get("requisitionId") || undefined;

    if (view === "requisitions") {
      const requisitions = await HrmService.listRequisitions();
      return NextResponse.json({ requisitions });
    }

    const [candidates, requisitions] = await Promise.all([
      HrmService.listCandidates({ stage, requisitionId }),
      HrmService.listRequisitions(),
    ]);

    return NextResponse.json({ candidates, requisitions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "create_requisition") {
      const reqRecord = await HrmService.createRequisition({
        role: body.role,
        department: body.department,
        headcount: body.headcount,
        reason: body.reason,
      });
      return NextResponse.json({ requisition: reqRecord }, { status: 201 });
    } else if (action === "approve_requisition") {
      const reqRecord = await HrmService.approveRequisition(
        body.requisitionId,
        body.approverName || "Haris Qureshi (Executive Director)"
      );
      return NextResponse.json({ requisition: reqRecord });
    } else if (action === "create_candidate") {
      const candidate = await HrmService.createCandidate({
        requisitionId: body.requisitionId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        stage: body.stage || "Applied",
        resumeUrl: body.resumeUrl,
        notes: body.notes,
      });
      return NextResponse.json({ candidate }, { status: 201 });
    } else if (action === "update_stage") {
      const candidate = await HrmService.updateCandidateStage(
        body.candidateId,
        body.stage
      );
      return NextResponse.json({ candidate });
    } else if (action === "schedule_interview") {
      const interview = await HrmService.scheduleInterview({
        candidateId: body.candidateId,
        scheduledAt: body.scheduledAt,
        interviewer: body.interviewer,
        notes: body.notes,
      });
      return NextResponse.json({ interview }, { status: 201 });
    } else if (action === "create_offer") {
      const offer = await HrmService.createOffer({
        candidateId: body.candidateId,
        role: body.role,
        salary: body.salary,
        startDate: body.startDate,
      });
      return NextResponse.json({ offer }, { status: 201 });
    } else if (action === "accept_offer") {
      const result = await HrmService.acceptOffer(body.offerId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
