export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";
import { requireJobsPermission } from "@/lib/auth/erpActor";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    let customerJobHistory: any[] = [];
    if (job.customerId) {
      customerJobHistory = await prisma.job.findMany({
        where: {
          customerId: job.customerId,
          id: { not: params.id },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          jobNumber: true,
          status: true,
          jobType: true,
          remarks: true,
          createdAt: true,
          finalizedAt: true,
          assignedTechnician: { select: { id: true, name: true, phone: true } },
          items: {
            select: {
              id: true,
              description: true,
              quantityPlanned: true,
              quantityActual: true,
              unitRate: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ ...job, invoice, customerJobHistory });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Every PATCH action is gated server-side with a jobs.* permission (see DEFAULT_ROLE_PERMISSIONS).
 * Actor = verified mobile Bearer token (DB role) or ERP demo headers (x-actor-role ...).
 */
const ACTION_PERMISSION: Record<string, string> = {
  assign: "jobs.reassign_tech",
  assign_technicians: "jobs.reassign_tech",
  assign_multiple: "jobs.reassign_tech",
  reassign: "jobs.reassign_tech",
  accept: "jobs.accept",
  start: "jobs.start",
  resume: "jobs.start",
  pause: "jobs.pause",
  complete: "jobs.complete",
  request_item_discount: "jobs.request_discount",
  give_item_discount: "jobs.discount",
  reject_item_discount: "jobs.discount",
  discount: "jobs.discount",
  finalize: "jobs.finalize",
  sync_and_lock: "jobs.finalize",
  verify: "jobs.verify",
  send_back: "jobs.verify",
  send_back_verification: "jobs.verify",
  reject_verification: "jobs.verify",
  clear_expense: "jobs.collect_payment",
  clear_job_expenses: "jobs.collect_payment",
  record_technician_cash_handover: "jobs.collect_payment",
  receive_technician_cash: "jobs.collect_payment",
  issue_inventory: "jobs.issue_stock",
  add_service: "jobs.add_service",
  record_stock_return: "jobs.stock_return",
  record_misplaced_item: "jobs.misplaced_item",
  generate_custom_invoice: "jobs.generate_invoice",
};

/** Field actions a technician may only perform on jobs they are assigned to. */
const TECH_OWNED_ACTIONS = new Set([
  "accept",
  "start",
  "resume",
  "pause",
  "complete",
  "request_item_discount",
  "add_service",
]);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = await req.json();
    const { action, ...payload } = body;

    const permission = ACTION_PERMISSION[action];
    if (!permission) {
      return NextResponse.json(
        { error: `Unknown action: '${action}'` },
        { status: 400 }
      );
    }
    const gate = await requireJobsPermission(req, permission);
    if (gate.error) return gate.error;

    // History label: explicit body actor (legacy UI/mobile send a display name) or resolved actor
    const actor: string = body.actor || gate.actor.name || "User";

    // Mobile technician sessions: identity comes from the verified token, and field actions
    // are restricted to jobs the technician is actually assigned to.
    const viaMobileToken = (req.headers.get("authorization") || "").startsWith("Bearer ");
    if (viaMobileToken && gate.actor.role === "technician") {
      payload.technicianId = gate.actor.id;
      if (payload.completionDetails && typeof payload.completionDetails === "object") {
        payload.completionDetails.technicianEmployeeId = gate.actor.id;
      }
      if (TECH_OWNED_ACTIONS.has(action)) {
        const owned = await prisma.job.findFirst({
          where: {
            id: params.id,
            OR: [
              { assignedTechnicianId: gate.actor.id },
              { assignments: { some: { technicianId: gate.actor.id, status: { not: "Removed" } } } },
            ],
          },
          select: { id: true },
        });
        if (!owned) {
          return NextResponse.json(
            { error: "Forbidden: you are not assigned to this job.", code: "PERMISSION_DENIED" },
            { status: 403 }
          );
        }
      }
    }

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
          {
            ...(payload.completionDetails || {}),
            technicianEmployeeId:
              payload.completionDetails?.technicianEmployeeId ||
              payload.technicianId ||
              payload.completionDetails?.technicianId,
          }
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
        const actorName = gate.actor.name || actor;
        result = await JobsService.verifyJob(params.id, actorName, payload.checklist);
        break;
      }

      case "send_back":
      case "send_back_verification":
      case "reject_verification": {
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

      case "record_technician_cash_handover":
      case "receive_technician_cash":
        result = await JobsService.recordTechnicianCashHandover(
          params.id,
          payload.settlementId || null,
          Number(payload.amountReceived),
          actor,
          {
            depositAccount: payload.depositAccount,
            notes: payload.notes,
            technicianId: payload.technicianId,
            amountExpected: payload.amountExpected ? Number(payload.amountExpected) : undefined,
          }
        );
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
          payload.notes,
          { productId: payload.productId || null, jobItemId: payload.jobItemId || null }
        );
        break;

      case "record_misplaced_item": {
        const cashCollection = payload.collectCashNow && Number(payload.cashAmount) > 0
          ? { amount: Number(payload.cashAmount), notes: payload.cashNotes }
          : undefined;

        if (Array.isArray(payload.items) && payload.items.length > 0) {
          const results = [];
          for (let i = 0; i < payload.items.length; i++) {
            const itm = payload.items[i];
            if (itm.item && Number(itm.quantity) > 0) {
              results.push(
                await JobsService.recordMisplacedItem(
                  params.id,
                  payload.technicianId,
                  itm.item,
                  Number(itm.quantity || 1),
                  actor,
                  itm.reason || payload.reason,
                  i === 0 ? cashCollection : undefined // apply cash recovery to the batch
                )
              );
            }
          }
          result = { success: true, count: results.length, items: results, cashRecovery: cashCollection };
        } else {
          result = await JobsService.recordMisplacedItem(
            params.id,
            payload.technicianId,
            payload.item,
            Number(payload.quantity || 1),
            actor,
            payload.reason,
            cashCollection
          );
        }
        break;
      }

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
