export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";
import { requireJobsPermission } from "@/lib/auth/erpActor";

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
        parentJob: { select: { id: true, jobNumber: true, status: true } },
        childJobs: { select: { id: true, jobNumber: true, status: true, assignedTechnicianId: true } },
        assignments: {
          where: { status: { not: "Removed" } },
          include: { technician: { select: { id: true, name: true, phone: true } } },
        },
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

    const invoice = await prisma.invoice.findFirst({
      where: { jobId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ...job, invoice });
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

      case "assign_technicians":
      case "assign_multiple": {
        const ids = payload.technicianIds || payload.technicians || [];
        result = await JobsService.assignTechnicians(
          params.id,
          ids,
          actor,
          payload.primaryTechnicianId || payload.primaryId
        );
        break;
      }

      case "reassign": {
        result = await JobsService.reassignTechnician(
          params.id,
          payload.technicianId || payload.newTechnicianId,
          actor,
          {
            copyItems: payload.copyItems !== false,
            notes: payload.notes || payload.reason,
          }
        );
        break;
      }

      case "accept":
        result = await JobsService.acceptJob(
          params.id,
          payload.technicianId || actor
        );
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

      case "verify": {
        const gate = requireJobsPermission(req, "jobs.verify");
        if (gate.error) return gate.error;
        const actorName = gate.actor.name || actor;
        result = await JobsService.verifyJob(params.id, actorName, payload.checklist);
        break;
      }

      case "send_back":
      case "send_back_verification":
      case "reject_verification": {
        const gate = requireJobsPermission(req, "jobs.verify");
        if (gate.error) return gate.error;
        const actorName = gate.actor.name || actor;
        result = await JobsService.sendBackFromVerification(
          params.id,
          actorName,
          payload.note || payload.reason || ""
        );
        break;
      }

      case "clear_expense":
      case "clear_job_expenses":
        if (payload.claimId) {
          result = await JobsService.clearExpense(
            params.id,
            payload.claimId,
            actor,
            payload.disbursingAccountCode,
            payload.amountToPay !== undefined && payload.amountToPay !== null && payload.amountToPay !== ""
              ? Number(payload.amountToPay)
              : undefined,
            payload.paymentNotes || payload.notes
          );
        } else {
          result = await JobsService.clearJobExpenses(
            params.id,
            actor,
            payload.disbursingAccountCode,
            payload.amountToPay !== undefined && payload.amountToPay !== null && payload.amountToPay !== ""
              ? Number(payload.amountToPay)
              : undefined,
            payload.paymentNotes || payload.notes
          );
        }
        break;

      case "issue_inventory":
        result = await JobsService.issueInventory(
          params.id,
          payload.productId,
          Number(payload.quantity),
          actor,
          payload.requestId
        );
        break;

      case "add_service":
        if (Array.isArray(payload.services) && payload.services.length > 0) {
          const addedItems = [];
          for (const s of payload.services) {
            if (s.description && Number(s.quantity) > 0) {
              addedItems.push(
                await JobsService.addJobServiceOrItem(
                  params.id,
                  s.description,
                  Number(s.quantity || 1),
                  Number(s.unitRate || 0),
                  actor
                )
              );
            }
          }
          result = addedItems;
        } else {
          result = await JobsService.addJobServiceOrItem(
            params.id,
            payload.description,
            Number(payload.quantity || 1),
            Number(payload.unitRate || 0),
            actor
          );
        }
        break;

      case "record_stock_return":
        result = await JobsService.recordStockReturn(
          params.id,
          payload.technicianId,
          payload.item,
          Number(payload.quantity || 1),
          actor,
          payload.notes
        );
        break;

      case "record_misplaced_item":
        if (Array.isArray(payload.items) && payload.items.length > 0) {
          const results = [];
          for (const itm of payload.items) {
            if (itm.item && Number(itm.quantity) > 0) {
              results.push(
                await JobsService.recordMisplacedItem(
                  params.id,
                  payload.technicianId,
                  itm.item,
                  Number(itm.quantity || 1),
                  actor,
                  itm.reason || payload.reason
                )
              );
            }
          }
          result = { success: true, count: results.length, items: results };
        } else {
          result = await JobsService.recordMisplacedItem(
            params.id,
            payload.technicianId,
            payload.item,
            Number(payload.quantity || 1),
            actor,
            payload.reason
          );
        }
        break;

      case "generate_custom_invoice":
        result = await JobsService.generateCustomInvoice(
          params.id,
          payload.invoiceNumber,
          actor
        );
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
