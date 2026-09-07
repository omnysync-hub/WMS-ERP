import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        items: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
        },
        inventoryRequests: {
          orderBy: { createdAt: "desc" },
        },
        stockReturns: {
          orderBy: { createdAt: "desc" },
        },
        expenseClaims: {
          orderBy: { createdAt: "desc" },
        },
        hisaabSettlements: {
          orderBy: { settledAt: "desc" },
        },
        feedbackCalls: {
          orderBy: { calledAt: "desc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { action, actor = "User", ...payload } = body;

    let result;

    switch (action) {
      case "assign":
        result = await JobsService.assignTechnician(
          params.id,
          payload.technicianId,
          actor
        );
        break;

      case "accept":
        result = await JobsService.acceptJob(params.id, actor);
        break;

      case "start":
      case "resume":
        result = await JobsService.startJob(
          params.id,
          actor,
          payload.lat,
          payload.lng
        );
        break;

      case "pause":
        result = await JobsService.pauseJob(params.id, actor, payload.note);
        break;

      case "complete":
        result = await JobsService.completeJob(
          params.id,
          actor,
          payload.actualItems,
          payload.completionDetails
        );
        break;

      case "request_item_discount":
        result = await JobsService.requestItemDiscount(
          params.id,
          payload.itemId,
          Number(payload.discountRequested),
          payload.reason || "Technician on-site request",
          actor
        );
        break;

      case "give_item_discount":
        result = await JobsService.giveItemDiscount(
          params.id,
          payload.itemId,
          Number(payload.discountAmount),
          actor
        );
        break;

      case "reject_item_discount":
        result = await JobsService.rejectItemDiscount(
          params.id,
          payload.itemId,
          actor,
          payload.reason
        );
        break;

      case "discount":
        result = await JobsService.applyDiscount(
          params.id,
          Number(payload.discountAmount),
          payload.reason || "Customer requested discount",
          actor
        );
        break;

      case "finalize":
      case "sync_and_lock":
        result = await JobsService.finalizeJob(params.id, actor);
        break;

      case "verify":
        result = await JobsService.verifyJob(params.id, actor, payload.checklist);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: '${action}'` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
