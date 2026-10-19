export const dynamic = "force-dynamic";
import { TaxSettingsService } from "@/lib/tax/TaxSettingsService";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";
import { actorHasPermission, requireJobsPermission, resolveJobsActor } from "@/lib/auth/erpActor";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const gate = await requireJobsPermission(req, "jobs.view_directory");
    if (gate.error) return gate.error;
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    // Technicians may only open jobs they are (or were) assigned to.
    if ((gate.actor.role || "").toLowerCase() === "technician") {
      const owned = await prisma.job.findFirst({
        where: {
          id: params.id,
          OR: [
            { assignedTechnicianId: gate.actor.id },
            { assignments: { some: { technicianId: gate.actor.id } } },
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
        discountRequests: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (resolved.viaMobileToken && gate.actor.role === "technician") {
      const assignedToCaller =
        job.assignedTechnicianId === gate.actor.id ||
        job.assignments.some((assignment) => assignment.technicianId === gate.actor.id);
      if (!assignedToCaller) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
    }

    const invoice = await prisma.invoice.findFirst({
      where: { jobId: params.id },
      orderBy: { createdAt: "desc" },
    });

    let customerJobHistory: any[] = [];
    if (job.customerId && !(resolved.viaMobileToken && gate.actor.role === "technician")) {
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

    // Server-side billing summary (same math as finalize) so ERP + app show one amount due.
    const totals = JobsService.computeJobTotals(job);
    const taxRes = job.isFoc ? null : await TaxSettingsService.forJob(job as any, totals.gross, totals.discount);
    const amountDue = taxRes ? taxRes.total : totals.net;
    const technicianCollects = JobsService.technicianCollectsPayment(job);
    const receivable = invoice ? await JobsService.getJobReceivableStatus(job.id) : null;
    const billingSummary = {
      gross: totals.gross,
      discount: totals.discount,
      net: totals.net,
      customerPays: job.isFoc ? 0 : amountDue,
      // Sales tax (Settings > Taxes); apps recompute with edited lines using these rules.
      tax: taxRes ? TaxSettingsService.describe(taxRes) : null,
      totalWithTax: job.isFoc ? 0 : amountDue,
      isFoc: job.isFoc,
      referringCompany: job.careOfParty?.companyName ?? null,
      focAmountReceived: job.focAmountReceived,
      focPaymentStatus: job.isFoc ? (job.focAmountReceived > 0 ? "received" : "awaiting_company_payment") : null,
      paymentCollectionMode: job.paymentCollectionMode,
      technicianCollects,
      technicianExpectedCollection: technicianCollects ? amountDue : 0,
      pendingDiscountRequests: job.discountRequests.filter((r) => r.status === "pending").length,
      receivable,
    };

    return NextResponse.json({ ...job, invoice, customerJobHistory, billingSummary });
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
  update_item_usage: "jobs.complete",
  request_item_discount: "jobs.request_discount",
  request_discount: "jobs.request_discount",
  approve_discount_request: "jobs.approve_discount",
  reject_discount_request: "jobs.approve_discount",
  set_billing: "jobs.edit_job",
  // also allowed with accounts.general_ledger (checked in the handler)
  record_foc_payment: "jobs.approve_foc",
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
  "update_item_usage",
  "request_item_discount",
  "request_discount",
  "add_service",
  "record_misplaced_item",
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
    const gate = await requireJobsPermission(
      req,
      action === "record_foc_payment" ? ["jobs.approve_foc", "accounts.general_ledger"] : permission
    );
    if (gate.error) return gate.error;

    // History label: explicit body actor (legacy UI/mobile send a display name) or resolved actor
    const actor: string = body.actor || gate.actor.name || "User";

    // Mobile technician sessions: identity comes from the verified token, and field actions
    // are restricted to jobs the technician is actually assigned to.
    if (gate.actor.role === "technician") {
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
            assistantTechnicianIds: payload.assistantTechnicianIds || payload.assistantIds,
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

      case "update_item_usage":
        result = await JobsService.updateItemUsage(
          params.id,
          payload.itemId,
          Number(payload.quantityActual),
          actor
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

      case "request_discount":
        result = await JobsService.requestJobDiscount(
          params.id,
          {
            discountType: payload.discountType,
            discountValue: Number(payload.discountValue),
            reason: payload.reason,
            itemId: payload.itemId || null,
            technicianId: gate.actor.role === "technician" ? gate.actor.id : payload.technicianId || null,
          },
          gate.actor.name || actor
        );
        break;

      case "approve_discount_request":
      case "reject_discount_request":
        if (!payload.requestId) {
          return NextResponse.json({ error: "requestId required" }, { status: 400 });
        }
        result = await JobsService.decideDiscountRequest(
          params.id,
          payload.requestId,
          action === "approve_discount_request" ? "approve" : "reject",
          gate.actor.name || actor,
          {
            note: payload.note || payload.reason,
            overrideAmount:
              payload.approvedAmount !== undefined && payload.approvedAmount !== null && payload.approvedAmount !== ""
                ? Number(payload.approvedAmount)
                : null,
          }
        );
        break;

      case "set_billing": {
        const current = await prisma.job.findUnique({
          where: { id: params.id },
          select: { isFoc: true },
        });
        if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });
        const nextIsFoc = payload.isFoc === undefined ? current.isFoc : Boolean(payload.isFoc);
        const focChanged = nextIsFoc !== current.isFoc;
        if (focChanged && !actorHasPermission(gate.actor, "jobs.approve_foc")) {
          return NextResponse.json(
            { error: "Forbidden: marking/unmarking FOC requires jobs.approve_foc.", code: "PERMISSION_DENIED" },
            { status: 403 }
          );
        }
        result = await JobsService.setBillingOptions(
          params.id,
          {
            isFoc: payload.isFoc === undefined ? undefined : Boolean(payload.isFoc),
            focReason: payload.focReason,
            careOfPartyId: payload.careOfPartyId,
            paymentCollectionMode: payload.paymentCollectionMode,
          },
          gate.actor.name || actor
        );
        break;
      }

      case "record_foc_payment":
        result = await JobsService.recordFocPayment(
          params.id,
          {
            amount: Number(payload.amount),
            receivingAccountCode: payload.receivingAccountCode || null,
            receivedDate: payload.receivedDate || null,
            reference: payload.reference || null,
            notes: payload.notes || null,
            paymentMethod: payload.paymentMethod || null,
          },
          gate.actor.name || actor
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
      case "disapprove_verification":
      case "reject_verification": {
        const actorName = gate.actor.name || actor;
        result = await JobsService.sendBackFromVerification(
          params.id,
          actorName,
          payload.note || payload.reason || "",
          payload.targetStatus
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
          actor,
          payload.items,
          payload.discountAmount
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
