export const dynamic = "force-dynamic";
import { TaxSettingsService } from "@/lib/tax/TaxSettingsService";
import { computeTax, findRate } from "@/lib/tax/taxConfig";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { SubLedgerService } from "@/lib/services/SubLedgerService";
import { DocumentSequenceService } from "@/lib/services/DocumentSequenceService";
import { generateProjectCode, generateProjectPrNumber } from "@/lib/sequenceUtils";
import { actorHasPermission, requireJobsPermission, resolveJobsActor, type ErpActor } from "@/lib/auth/erpActor";

function permissionDenied(actor: ErpActor, what: string) {
  return NextResponse.json(
    {
      error: `Forbidden: role '${actor.role}' lacks permission '${what}'`,
      code: "PERMISSION_DENIED",
      role: actor.role,
    },
    { status: 403 }
  );
}

/**
 * Employee id behind an actor. Mobile actors carry the Employee id directly;
 * web actors carry the ErpUser id, which Employee.erpUserId links back to.
 */
async function resolveActorEmployeeId(actor: ErpActor): Promise<string | null> {
  if (!actor || !actor.id || actor.role === "anonymous") return null;
  const byId = await prisma.employee.findUnique({ where: { id: actor.id }, select: { id: true } });
  if (byId) return byId.id;
  const byUser = await prisma.employee.findUnique({ where: { erpUserId: actor.id }, select: { id: true } });
  return byUser?.id ?? null;
}

/** True when the actor is the assigned Project Manager of this project. */
async function isProjectPM(actor: ErpActor, project: { managerId?: string | null } | null): Promise<boolean> {
  if (!project?.managerId) return false;
  const empId = await resolveActorEmployeeId(actor);
  return !!empId && empId === project.managerId;
}

/** Full single-project payload (existing shape + team/documents/expenses/DOs + money rollups). */
async function fetchProjectDetail(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: true,
      boqItems: {
        include: { tasks: { include: { assignedTechnician: true } } },
        orderBy: { itemCode: "asc" },
      },
      tasks: {
        include: { assignedTechnician: true, boqItem: true },
        orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      },
      changeOrders: {
        orderBy: { createdAt: "desc" },
      },
      milestones: {
        orderBy: { targetDate: "asc" },
      },
      teamMembers: {
        include: { employee: { select: { id: true, name: true, designation: true } } },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        orderBy: { createdAt: "desc" },
      },
      expenses: {
        orderBy: { createdAt: "desc" },
      },
      deliveryOrders: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return null;

  const [invoices, requisitions] = await Promise.all([
    prisma.invoice.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseRequisition.findMany({
      where: { projectId: id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const expenses = (project as any).expenses as Array<{ kind: string; amount: number }>;
  const expensesTotal = expenses.filter((e) => e.kind === "expense").reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const pettyTopups = expenses.filter((e) => e.kind === "petty_topup").reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const pettySpends = expenses.filter((e) => e.kind === "petty_spend").reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return {
    ...project,
    invoices,
    requisitions,
    expensesTotal,
    pettyBalance: pettyTopups - pettySpends,
  };
}

/**
 * Shared billing core for progress invoices and the auditor-approved final bill:
 * sales tax, contract cap, invoice + GL posting + customer sub-ledger, atomically.
 */
async function billProjectInvoice(opts: {
  project: any;
  invoiceAmount: number;
  milestoneId?: string | null;
  milestoneTitle?: string;
  percentage?: number;
  memoLabel: string;
  idempotencyKey?: string | null;
}): Promise<{ invoice: any } | { errorResponse: NextResponse }> {
  const { project, milestoneId, milestoneTitle, percentage, memoLabel } = opts;
  const projectId = project.id;
  const invoiceAmount = Number(opts.invoiceAmount) || 0;
  if (invoiceAmount <= 0) {
    return { errorResponse: NextResponse.json({ error: "Invoice amount must be greater than zero." }, { status: 400 }) };
  }

  if (!project.customerId) {
    return {
      errorResponse: NextResponse.json(
        { error: "Project billing requires a linked customer so AR and the customer sub-ledger remain synchronized." },
        { status: 400 }
      ),
    };
  }

  // Sales tax on progress bills (Settings > Taxes). The contract/progress figure stays tax-free.
  const { rates: taxRates, policy: taxPolicy } = await TaxSettingsService.load();
  const projectRate =
    taxPolicy.projects.enabled && !project.customer?.taxExempt ? findRate(taxRates, taxPolicy.projects.rateCode) : null;
  const projectTax = computeTax({
    gross: invoiceAmount,
    ratePercent: projectRate?.rate || 0,
    inclusive: taxPolicy.projects.pricesIncludeTax,
    applyAfterDiscount: true,
    rounding: taxPolicy.rounding,
  });
  const projectTaxAccount =
    projectTax.tax > 0 && projectRate ? await TaxSettingsService.accountFor(projectRate, "sales_tax_payable") : null;
  const billedTotal = projectTax.total;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      // Idempotency: a milestone can be billed only once (conditional claim inside the tx).
      if (milestoneId) {
        const claimedMilestone = await tx.projectMilestone.updateMany({
          where: { id: milestoneId, projectId, status: { not: "billed" } },
          data: { status: "billed", billedAt: new Date() },
        });
        if (claimedMilestone.count !== 1) {
          throw new BillingConflict("This milestone has already been billed (or does not belong to this project).");
        }
      }
      // Cap: never invoice beyond the contract value (re-read inside the tx).
      const fresh = await tx.project.findUnique({ where: { id: projectId }, select: { invoicedAmount: true, contractValue: true } });
      const contract = Number(fresh?.contractValue) || 0;
      const alreadyInvoiced = Number(fresh?.invoicedAmount) || 0;
      if (contract > 0 && alreadyInvoiced + invoiceAmount > contract + 0.01) {
        throw new BillingConflict(
          `Invoice would exceed the contract value: already invoiced PKR ${alreadyInvoiced.toLocaleString()} of PKR ${contract.toLocaleString()}.`
        );
      }
      const [arAccount, revAccount] = await Promise.all([
        AccountMappingService.resolveAccount({
          transactionType: "job_revenue_receivable",
          prismaClient: tx,
        }),
        AccountMappingService.resolveAccount({
          transactionType: "job_revenue_sales",
          prismaClient: tx,
        }),
      ]);
      const invoiceNumber = await DocumentSequenceService.nextInvoiceNumber(tx);
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          projectId,
          customerId: project.customerId,
          customerName: project.customer?.name || "Client",
          amount: billedTotal,
          status: "unpaid",
          taxApplied: true,
          subtotal: invoiceAmount,
          taxAmount: projectTax.tax,
          taxRate: projectTax.tax > 0 ? projectTax.ratePercent : 0,
          taxCode: projectTax.tax > 0 ? projectRate?.code ?? null : null,
          taxName: projectTax.tax > 0 ? projectRate?.name ?? null : null,
          taxInclusive: projectTax.tax > 0 ? projectTax.inclusive : false,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { invoicedAmount: { increment: invoiceAmount } },
      });
      if (milestoneId) {
        await tx.projectMilestone.update({
          where: { id: milestoneId },
          data: { status: "billed", invoiceNumber, billedAt: new Date() },
        });
      } else if (milestoneTitle) {
        await tx.projectMilestone.create({
          data: {
            projectId,
            title: milestoneTitle,
            percentage: Number(percentage) || 0,
            amount: invoiceAmount,
            status: "billed",
            invoiceNumber,
            billedAt: new Date(),
          },
        });
      }

      const entry = await AccountsPostingService.post({
        memo: `${memoLabel} ${invoiceNumber} for Project: "${project.name}"`,
        refType: "project_revenue",
        refId: createdInvoice.id,
        idempotencyKey: opts.idempotencyKey ?? (milestoneId ? `project_milestone_bill:${milestoneId}` : null),
        postedBy: "Project Billing System",
        lines: [
          { accountId: arAccount.id, debit: billedTotal, credit: 0 },
          { accountId: revAccount.id, debit: 0, credit: Math.round((billedTotal - (projectTaxAccount ? projectTax.tax : 0)) * 100) / 100 },
          ...(projectTaxAccount ? [{ accountId: projectTaxAccount.id, debit: 0, credit: projectTax.tax }] : []),
        ],
        tx,
      });
      await SubLedgerService.recordCustomerEntry({
        customerId: project.customerId!,
        entryType: "invoice",
        documentNumber: invoiceNumber,
        journalEntryId: entry.id,
        debit: billedTotal,
        credit: 0,
        notes: `${memoLabel} invoice for Project: ${project.name}`,
        tx,
      });
      return createdInvoice;
    });

    return { invoice };
  } catch (e: any) {
    if (e instanceof BillingConflict) return { errorResponse: NextResponse.json({ error: e.message }, { status: 409 }) };
    throw e;
  }
}

export async function GET(req: NextRequest) {
  // Projects are their own module (client role spec): read access is
  // projects.view, NOT the jobs directory key. Actors without it fall back
  // to PM / team membership scoping below. (Battery finding 2026-11-17:
  // the jobs.view_directory fallback let the job-creation-only Creator role
  // read every project.)
  const gate = await requireJobsPermission(req, "projects.view");
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    // Actors without projects.view fall back to PM / team membership scoping.
    const canViewAll = !gate.error;
    let memberEmployeeId: string | null = null;
    if (!canViewAll) {
      // Auth failures (401/503 from token verification) are not curable by membership.
      if (!gate.error || gate.error.status !== 403) return gate.error;
      memberEmployeeId = await resolveActorEmployeeId(gate.actor);
      if (!memberEmployeeId) return gate.error;
    }

    if (id) {
      const detail = await fetchProjectDetail(id);
      if (!detail) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (!canViewAll) {
        const isMember =
          detail.managerId === memberEmployeeId ||
          ((detail as any).teamMembers || []).some((m: any) => m.employeeId === memberEmployeeId);
        if (!isMember) return gate.error;
      }
      return NextResponse.json(detail);
    }

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { projectNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (!canViewAll) {
      const membership = {
        OR: [{ managerId: memberEmployeeId }, { teamMembers: { some: { employeeId: memberEmployeeId } } }],
      };
      if (where.OR) {
        where.AND = [{ OR: where.OR }, membership];
        delete where.OR;
      } else {
        where.AND = [membership];
      }
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        customer: true,
        boqItems: {
          include: { tasks: true },
          orderBy: { itemCode: "asc" },
        },
        tasks: {
          include: { assignedTechnician: true, boqItem: true },
          orderBy: { createdAt: "desc" },
        },
        changeOrders: {
          orderBy: { createdAt: "desc" },
        },
        milestones: {
          orderBy: { targetDate: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err: any) {
    console.error("Error in GET /api/projects:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  const actor = resolved.actor;
  if (!actor.role || actor.role === "anonymous") {
    return NextResponse.json(
      {
        error:
          "Forbidden: missing actor role. Send x-actor-role (and optionally x-actor-name / x-user-id) or a mobile Bearer token.",
        code: "PERMISSION_DENIED",
      },
      { status: 403 }
    );
  }
  const has = (key: string) => actorHasPermission(actor, key);
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    // ==========================================
    // 1. DIRECT PROCUREMENT LINKING
    // ==========================================
    if (action === "create_requisition_from_boq") {
      // This creates a purchase requisition, so it follows PR-create rights
      // (storekeeper only) — projects.manage must not bypass that model.
      if (!has("procurement.pr.create")) {
        return permissionDenied(actor, "procurement.pr.create");
      }
      const { projectId, boqItemIds, requestedBy, department, priority, dateRequired, notes } = payload;
      if (!projectId || !boqItemIds || !Array.isArray(boqItemIds) || boqItemIds.length === 0) {
        return NextResponse.json({ error: "Project ID and at least one BOQ item are required." }, { status: 400 });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const boqItems = await prisma.bOQItem.findMany({
        where: { id: { in: boqItemIds } },
      });

      const prNumber = await generateProjectPrNumber();

      const requisition = await prisma.purchaseRequisition.create({
        data: {
          prNumber,
          requestedBy: requestedBy || "Project Manager",
          department: department || "HVAC Project Execution",
          site: `${project.name} (${project.projectNumber})`,
          dateRequired: dateRequired ? new Date(dateRequired) : null,
          projectCode: project.projectNumber,
          projectId: project.id,
          priority: priority || "Normal",
          notes: notes || `Direct procurement requisition generated from BOQ items for project ${project.projectNumber}`,
          status: "draft",
          items: {
            create: boqItems.map((item) => ({
              boqItemId: item.id,
              itemCode: item.itemCode,
              description: item.description,
              quantity: item.plannedQty,
              unit: item.unit,
              estimatedPrice: item.unitRate,
            })),
          },
        },
        include: { items: true },
      });

      // Update BOQ item status to procuring
      await prisma.bOQItem.updateMany({
        where: { id: { in: boqItemIds } },
        data: { status: "procuring" },
      });

      return NextResponse.json(requisition, { status: 201 });
    }

    // ==========================================
    // 2. MILESTONE & PROGRESS BILLING
    // ==========================================
    if (action === "generate_progress_invoice") {
      if (!has("projects.create_bill")) return permissionDenied(actor, "projects.create_bill");
      const { projectId, milestoneId, amount, milestoneTitle, percentage } = payload;
      if (!projectId) {
        return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { customer: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      const result = await billProjectInvoice({
        project,
        invoiceAmount: Number(amount) || 0,
        milestoneId: milestoneId || null,
        milestoneTitle,
        percentage,
        memoLabel: "Progress billing",
      });
      if ("errorResponse" in result) return result.errorResponse;

      return NextResponse.json({ invoice: result.invoice, message: "Progress billing invoice generated successfully" }, { status: 201 });
    }

    // ==========================================
    // 3. CHANGE ORDERS & BOQ REVISIONS
    // ==========================================
    if (action === "create_change_order") {
      const { projectId, title, description, requestedBy, amountImpact, daysImpact, newBoqItems = [] } = payload;
      if (!projectId || !title || !String(title).trim()) {
        return NextResponse.json({ error: "Project ID and change order title are required." }, { status: 400 });
      }
      const amount = Math.round((Number(amountImpact) || 0) * 100) / 100;
      const days = Math.trunc(Number(daysImpact) || 0);
      if (!Number.isFinite(amount) || Math.abs(amount) > 1_000_000_000) {
        return NextResponse.json({ error: "Invalid amount impact." }, { status: 400 });
      }

      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, projectNumber: true, managerId: true } });
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      if (!has("projects.manage") && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, "projects.manage' (or be the project manager");
      }

      // Change orders are created PENDING; budget/contract/BOQ change only on approval.
      // Numbering: per-project sequence, prefixed with the project number because changeNumber is
      // globally unique. A unique-constraint collision (concurrent create) retries with the next number.
      let changeOrder = null;
      for (let attempt = 0; attempt < 5 && !changeOrder; attempt++) {
        const coCount = await prisma.bOQChangeOrder.count({ where: { projectId } });
        const changeNumber = `${project.projectNumber}-CO-${String(coCount + 1 + attempt).padStart(2, "0")}`;
        try {
          changeOrder = await prisma.bOQChangeOrder.create({
            data: {
              projectId,
              changeNumber,
              title: String(title).trim().slice(0, 200),
              description: typeof description === "string" ? description.trim().slice(0, 4000) : "",
              requestedBy: typeof requestedBy === "string" && requestedBy.trim() ? requestedBy.trim().slice(0, 120) : "Client Representative",
              amountImpact: amount,
              daysImpact: days,
              status: "pending_client",
              approvedAt: null,
            },
          });
        } catch (e: any) {
          if (e?.code !== "P2002") throw e;
        }
      }
      if (!changeOrder) {
        return NextResponse.json({ error: "Could not allocate a change order number. Please retry." }, { status: 409 });
      }

      // Proposed BOQ lines are stored as pending, tagged with the CO, and only become part of the
      // revision when the CO is approved.
      if (Array.isArray(newBoqItems) && newBoqItems.length > 0) {
        for (let i = 0; i < newBoqItems.length; i++) {
          const item = newBoqItems[i];
          if (item?.description?.trim()) {
            await prisma.bOQItem.create({
              data: {
                projectId,
                itemCode: item.itemCode?.trim() || `${changeOrder.changeNumber}-${String(i + 1).padStart(2, "0")}`,
                description: item.description.trim(),
                unit: item.unit?.trim() || "unit",
                plannedQty: Number(item.plannedQty) || 1,
                unitRate: Number(item.unitRate) || 0,
                category: item.category || "material",
                version: 0, // set to the new revision on approval
                changeOrderRef: changeOrder.changeNumber,
                status: "pending",
              },
            });
          }
        }
      }

      return NextResponse.json(changeOrder, { status: 201 });
    }

    if (action === "approve_change_order" || action === "reject_change_order") {
      if (!actorHasPermission(actor, "projects.approve_change_order")) {
        return NextResponse.json(
          { error: "Forbidden: approving change orders requires a manager.", code: "PERMISSION_DENIED" },
          { status: 403 }
        );
      }
      const { changeOrderId } = payload;
      if (!changeOrderId) return NextResponse.json({ error: "changeOrderId is required." }, { status: 400 });
      const approve = action === "approve_change_order";

      try {
        const result = await prisma.$transaction(async (tx) => {
          const co = await tx.bOQChangeOrder.findUnique({ where: { id: changeOrderId } });
          if (!co) throw new BillingConflict("Change order not found.");
          const claimed = await tx.bOQChangeOrder.updateMany({
            where: { id: co.id, status: { in: ["draft", "pending_client"] } },
            data: approve ? { status: "approved", approvedAt: new Date() } : { status: "rejected" },
          });
          if (claimed.count !== 1) throw new BillingConflict(`Change order ${co.changeNumber} is already ${co.status}.`);
          if (!approve) {
            await tx.bOQItem.deleteMany({ where: { projectId: co.projectId, changeOrderRef: co.changeNumber, version: 0 } });
            return tx.bOQChangeOrder.findUnique({ where: { id: co.id } });
          }
          const project = await tx.project.update({
            where: { id: co.projectId },
            data: {
              revision: { increment: 1 },
              totalBudget: { increment: co.amountImpact },
              contractValue: { increment: co.amountImpact },
            },
            select: { revision: true },
          });
          await tx.bOQItem.updateMany({
            where: { projectId: co.projectId, changeOrderRef: co.changeNumber, version: 0 },
            data: { version: project.revision },
          });
          return tx.bOQChangeOrder.findUnique({ where: { id: co.id } });
        });
        return NextResponse.json(result);
      } catch (e: any) {
        if (e instanceof BillingConflict) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
      }
    }

    // ==========================================
    // 4. BOQ PROGRESS & ACTUAL COST TRACKING
    // ==========================================
    if (action === "update_boq_progress") {
      const { boqItemId, completedQty, actualQty, actualCost, status, category } = payload;
      if (!boqItemId) {
        return NextResponse.json({ error: "BOQ Item ID is required." }, { status: 400 });
      }

      const item = await prisma.bOQItem.findUnique({
        where: { id: boqItemId },
        include: { project: { select: { id: true, managerId: true } } },
      });
      if (!item) {
        return NextResponse.json({ error: "BOQ item not found." }, { status: 404 });
      }
      const pm = await isProjectPM(actor, item.project);
      if (!has("projects.tasks") && !pm) return permissionDenied(actor, "projects.tasks' (or be the project manager");

      // Overrun rule: actual usage above the BOQ norm (plannedQty) needs PM / approver
      // authority. Without it, the actuals are parked as pending until approved.
      if (actualQty !== undefined) {
        const requestedQty = Number(actualQty) || 0;
        const requestedCost = actualCost !== undefined ? Number(actualCost) || 0 : item.actualCost;
        const exceeds = item.plannedQty > 0 && requestedQty > item.plannedQty;
        if (exceeds && !pm && !has("projects.approve_overrun")) {
          const parked = await prisma.bOQItem.update({
            where: { id: boqItemId },
            data: { pendingActualQty: requestedQty, pendingActualCost: requestedCost, overrunStatus: "pending" },
            include: { tasks: true },
          });
          return NextResponse.json({
            success: true,
            parked: true,
            message: `Actual quantity ${requestedQty} exceeds the BOQ norm of ${item.plannedQty}; parked for PM/Manager overrun approval.`,
            boqItem: parked,
          });
        }
        if (exceeds) {
          const applied = await prisma.bOQItem.update({
            where: { id: boqItemId },
            data: {
              actualQty: requestedQty,
              actualCost: requestedCost,
              pendingActualQty: null,
              pendingActualCost: null,
              overrunStatus: "approved",
              ...(completedQty !== undefined ? { completedQty: Number(completedQty) } : {}),
              ...(status !== undefined ? { status } : {}),
              ...(category !== undefined ? { category } : {}),
            },
            include: { tasks: true },
          });
          return NextResponse.json(applied);
        }
      }

      const updateData: any = {};
      if (completedQty !== undefined) updateData.completedQty = Number(completedQty);
      if (actualQty !== undefined) updateData.actualQty = Number(actualQty);
      if (actualCost !== undefined) updateData.actualCost = Number(actualCost);
      if (status !== undefined) updateData.status = status;
      if (category !== undefined) updateData.category = category;

      const updated = await prisma.bOQItem.update({
        where: { id: boqItemId },
        data: updateData,
        include: { tasks: true },
      });

      return NextResponse.json(updated);
    }

    // ==========================================
    // 5. GANTT & TASK SCHEDULING
    // ==========================================
    if (action === "update_task_gantt") {
      const { taskId, id, startDate, dueDate, estimatedHours, actualHours, progressPercent, priority, dependencies, status } = payload;
      const targetId = taskId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
      }
      const ganttTask = await prisma.projectTask.findUnique({
        where: { id: targetId },
        select: { project: { select: { managerId: true } } },
      });
      if (!ganttTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if (!has("projects.tasks") && !(await isProjectPM(actor, ganttTask.project))) {
        return permissionDenied(actor, "projects.tasks' (or be the project manager");
      }

      const updateData: any = {};
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (estimatedHours !== undefined) updateData.estimatedHours = Number(estimatedHours) || 0;
      if (actualHours !== undefined) updateData.actualHours = Number(actualHours) || 0;
      if (progressPercent !== undefined) updateData.progressPercent = Math.min(100, Math.max(0, Number(progressPercent) || 0));
      if (priority !== undefined) updateData.priority = priority;
      if (dependencies !== undefined) updateData.dependencies = typeof dependencies === "string" ? dependencies : JSON.stringify(dependencies);
      if (status !== undefined) updateData.status = status;

      const task = await prisma.projectTask.update({
        where: { id: targetId },
        data: updateData,
        include: { assignedTechnician: true, boqItem: true },
      });

      return NextResponse.json(task);
    }

    // ==========================================
    // 6. MILESTONES CRUD
    // ==========================================
    if (action === "create_milestone") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { projectId, title, description, percentage, amount, targetDate } = payload;
      if (!projectId || !title) {
        return NextResponse.json({ error: "Project ID and title are required." }, { status: 400 });
      }

      const milestone = await prisma.projectMilestone.create({
        data: {
          projectId,
          title: title.trim(),
          description: description?.trim() || "",
          percentage: Number(percentage) || 0,
          amount: Number(amount) || 0,
          targetDate: targetDate ? new Date(targetDate) : null,
          status: "pending",
        },
      });

      return NextResponse.json(milestone, { status: 201 });
    }

    if (action === "update_milestone") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { milestoneId, id, title, description, percentage, amount, targetDate, status } = payload;
      const targetId = milestoneId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Milestone ID is required." }, { status: 400 });
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description?.trim() || "";
      if (percentage !== undefined) updateData.percentage = Number(percentage) || 0;
      if (amount !== undefined) updateData.amount = Number(amount) || 0;
      if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
      if (status !== undefined) updateData.status = status;

      const milestone = await prisma.projectMilestone.update({
        where: { id: targetId },
        data: updateData,
      });

      return NextResponse.json(milestone);
    }

    if (action === "delete_milestone") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { milestoneId, id } = payload;
      const targetId = milestoneId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Milestone ID is required." }, { status: 400 });
      }

      await prisma.projectMilestone.delete({ where: { id: targetId } });
      return NextResponse.json({ success: true, deletedId: targetId });
    }

    // ==========================================
    // 7. TASK ACTIONS (Existing)
    // ==========================================
    if (action === "create_task") {
      const { projectId, boqItemId, title, description, assignedTechnicianId, status, startDate, dueDate, estimatedHours, priority } = payload;
      if (!projectId || !title) {
        return NextResponse.json({ error: "Project ID and task title are required." }, { status: 400 });
      }
      const taskProject = await prisma.project.findUnique({ where: { id: projectId }, select: { managerId: true } });
      if (!has("projects.tasks") && !(await isProjectPM(actor, taskProject))) {
        return permissionDenied(actor, "projects.tasks' (or be the project manager");
      }
      const task = await prisma.projectTask.create({
        data: {
          projectId,
          boqItemId: boqItemId || null,
          title: title.trim(),
          description: description?.trim() || "",
          assignedTechnicianId: assignedTechnicianId || null,
          status: status || "Created",
          startDate: startDate ? new Date(startDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          estimatedHours: Number(estimatedHours) || 0,
          priority: priority || "normal",
        },
        include: { assignedTechnician: true, boqItem: true },
      });
      return NextResponse.json(task, { status: 201 });
    }

    if (action === "update_task") {
      const { taskId, id, title, description, boqItemId, assignedTechnicianId, status, startDate, dueDate, estimatedHours, actualHours, progressPercent, priority } = payload;
      const targetId = taskId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
      }
      const existingTask = await prisma.projectTask.findUnique({
        where: { id: targetId },
        select: { project: { select: { managerId: true } } },
      });
      if (!existingTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if (!has("projects.tasks") && !(await isProjectPM(actor, existingTask.project))) {
        return permissionDenied(actor, "projects.tasks' (or be the project manager");
      }
      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description?.trim() || "";
      if (boqItemId !== undefined) updateData.boqItemId = boqItemId || null;
      if (assignedTechnicianId !== undefined) updateData.assignedTechnicianId = assignedTechnicianId || null;
      if (status !== undefined) updateData.status = status;
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (estimatedHours !== undefined) updateData.estimatedHours = Number(estimatedHours) || 0;
      if (actualHours !== undefined) updateData.actualHours = Number(actualHours) || 0;
      if (progressPercent !== undefined) updateData.progressPercent = Number(progressPercent) || 0;
      if (priority !== undefined) updateData.priority = priority;

      const task = await prisma.projectTask.update({
        where: { id: targetId },
        data: updateData,
        include: { assignedTechnician: true, boqItem: true },
      });
      return NextResponse.json(task);
    }

    if (action === "update_task_status") {
      const { taskId, id, status } = payload;
      const targetId = taskId || id;
      if (!targetId || !status) {
        return NextResponse.json({ error: "Task ID and status are required." }, { status: 400 });
      }
      const existingTask = await prisma.projectTask.findUnique({
        where: { id: targetId },
        select: { project: { select: { managerId: true } } },
      });
      if (!existingTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if (!has("projects.tasks") && !(await isProjectPM(actor, existingTask.project))) {
        return permissionDenied(actor, "projects.tasks' (or be the project manager");
      }
      const task = await prisma.projectTask.update({
        where: { id: targetId },
        data: { status },
        include: { assignedTechnician: true, boqItem: true },
      });
      return NextResponse.json(task);
    }

    if (action === "delete_task") {
      const { taskId, id } = payload;
      const targetId = taskId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
      }
      const existingTask = await prisma.projectTask.findUnique({
        where: { id: targetId },
        select: { project: { select: { managerId: true } } },
      });
      if (!existingTask) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if (!has("projects.tasks") && !(await isProjectPM(actor, existingTask.project))) {
        return permissionDenied(actor, "projects.tasks' (or be the project manager");
      }
      await prisma.projectTask.delete({
        where: { id: targetId },
      });
      return NextResponse.json({ success: true, deletedId: targetId });
    }

    // ==========================================
    // 8. BOQ ITEM ACTIONS (Existing & Extended)
    // ==========================================
    if (action === "add_boq_item") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { projectId, itemCode, description, unit, plannedQty, unitRate, category } = payload;
      if (!projectId || !description) {
        return NextResponse.json({ error: "Project ID and description are required." }, { status: 400 });
      }
      const boqProject = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, boqStatus: true, revision: true },
      });
      if (!boqProject) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      if (boqProject.boqStatus === "approved") {
        return NextResponse.json({ error: "BOQ is approved — changes go through a change order." }, { status: 400 });
      }

      let finalCode = itemCode?.trim();
      if (!finalCode) {
        const count = await prisma.bOQItem.count({ where: { projectId } });
        finalCode = `BOQ-${String(count + 1).padStart(2, "0")}`;
      }

      const boqItem = await prisma.bOQItem.create({
        data: {
          projectId,
          itemCode: finalCode,
          description: description.trim(),
          unit: unit?.trim() || "unit",
          plannedQty: Number(plannedQty) || 1,
          unitRate: Number(unitRate) || 0,
          category: category || "material",
          version: boqProject.revision,
        },
        include: { tasks: true },
      });
      return NextResponse.json(boqItem, { status: 201 });
    }

    if (action === "update_boq_item") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { boqItemId, id, itemCode, description, unit, plannedQty, unitRate, category, actualQty, actualCost, completedQty, status } = payload;
      const targetId = boqItemId || id;
      if (!targetId) {
        return NextResponse.json({ error: "BOQ Item ID is required." }, { status: 400 });
      }
      const existingItem = await prisma.bOQItem.findUnique({
        where: { id: targetId },
        select: { project: { select: { boqStatus: true } } },
      });
      if (!existingItem) {
        return NextResponse.json({ error: "BOQ item not found." }, { status: 404 });
      }
      if (existingItem.project.boqStatus === "approved") {
        return NextResponse.json({ error: "BOQ is approved — changes go through a change order." }, { status: 400 });
      }
      const updateData: any = {};
      if (itemCode !== undefined) updateData.itemCode = itemCode.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (unit !== undefined) updateData.unit = unit.trim();
      if (plannedQty !== undefined) updateData.plannedQty = Number(plannedQty) || 0;
      if (unitRate !== undefined) updateData.unitRate = Number(unitRate) || 0;
      if (category !== undefined) updateData.category = category;
      if (actualQty !== undefined) updateData.actualQty = Number(actualQty) || 0;
      if (actualCost !== undefined) updateData.actualCost = Number(actualCost) || 0;
      if (completedQty !== undefined) updateData.completedQty = Number(completedQty) || 0;
      if (status !== undefined) updateData.status = status;

      const boqItem = await prisma.bOQItem.update({
        where: { id: targetId },
        data: updateData,
        include: { tasks: true },
      });
      return NextResponse.json(boqItem);
    }

    if (action === "delete_boq_item") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { boqItemId, id } = payload;
      const targetId = boqItemId || id;
      if (!targetId) {
        return NextResponse.json({ error: "BOQ Item ID is required." }, { status: 400 });
      }
      const existingItem = await prisma.bOQItem.findUnique({
        where: { id: targetId },
        select: { project: { select: { boqStatus: true } } },
      });
      if (!existingItem) {
        return NextResponse.json({ error: "BOQ item not found." }, { status: 404 });
      }
      if (existingItem.project.boqStatus === "approved") {
        return NextResponse.json({ error: "BOQ is approved — changes go through a change order." }, { status: 400 });
      }
      await prisma.projectTask.updateMany({
        where: { boqItemId: targetId },
        data: { boqItemId: null },
      });
      await prisma.bOQItem.delete({
        where: { id: targetId },
      });
      return NextResponse.json({ success: true, deletedId: targetId });
    }

    // ==========================================
    // 9. PROJECT ACTIONS (Existing & Extended)
    // ==========================================
    if (action === "update_project") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { projectId, id, name, customerId, status, totalBudget, contractValue, retentionPercent, billingMethod, startDate, endDate } = payload;
      const targetId = projectId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      }
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (customerId !== undefined) updateData.customerId = customerId;
      if (status !== undefined) updateData.status = status;
      if (totalBudget !== undefined) updateData.totalBudget = Number(totalBudget) || 0;
      if (contractValue !== undefined) updateData.contractValue = Number(contractValue) || 0;
      if (retentionPercent !== undefined) updateData.retentionPercent = Number(retentionPercent) || 0;
      if (billingMethod !== undefined) updateData.billingMethod = billingMethod;
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

      const project = await prisma.project.update({
        where: { id: targetId },
        data: updateData,
        include: {
          customer: true,
          boqItems: { include: { tasks: true } },
          tasks: { include: { assignedTechnician: true, boqItem: true } },
          changeOrders: true,
          milestones: true,
        },
      });
      return NextResponse.json(project);
    }

    if (action === "delete_project") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const { projectId, id } = payload;
      const targetId = projectId || id;
      if (!targetId) {
        return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      }
      await prisma.project.delete({
        where: { id: targetId },
      });
      return NextResponse.json({ success: true, deletedId: targetId });
    }

    // ==========================================
    // 10. ROLE-SPEC WORKFLOWS (BOQ approval, PM/team, documents,
    //     expenses & petty cash, overruns, hisaab, completion, DO)
    // ==========================================
    if (action === "submit_boq" || action === "approve_boq" || action === "reject_boq") {
      const { projectId } = payload;
      if (!projectId) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

      if (action === "submit_boq") {
        if (!has("projects.manage") && !(await isProjectPM(actor, project))) {
          return permissionDenied(actor, "projects.manage' (or be the project manager");
        }
        if (project.boqStatus !== "draft") {
          return NextResponse.json({ error: `BOQ cannot be submitted from status '${project.boqStatus}'.` }, { status: 400 });
        }
        const updated = await prisma.project.update({ where: { id: projectId }, data: { boqStatus: "submitted" } });
        return NextResponse.json(updated);
      }

      // approve_boq / reject_boq
      if (!has("projects.boq_approve")) return permissionDenied(actor, "projects.boq_approve");
      if (project.boqStatus !== "submitted") {
        return NextResponse.json({ error: `BOQ cannot be ${action === "approve_boq" ? "approved" : "rejected"} from status '${project.boqStatus}'.` }, { status: 400 });
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { boqStatus: action === "approve_boq" ? "approved" : "draft" },
      });
      return NextResponse.json(updated);
    }

    if (action === "assign_pm") {
      if (!has("projects.assign_team")) return permissionDenied(actor, "projects.assign_team");
      const { projectId, managerId } = payload;
      if (!projectId || !managerId) {
        return NextResponse.json({ error: "Project ID and managerId (Employee ID) are required." }, { status: 400 });
      }
      const employee = await prisma.employee.findUnique({ where: { id: managerId }, select: { id: true } });
      if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

      const updated = await prisma.$transaction(async (tx) => {
        await tx.projectTeamMember.updateMany({
          where: { projectId, projectRole: "pm", employeeId: { not: managerId } },
          data: { projectRole: "member" },
        });
        await tx.projectTeamMember.upsert({
          where: { projectId_employeeId: { projectId, employeeId: managerId } },
          create: { projectId, employeeId: managerId, projectRole: "pm" },
          update: { projectRole: "pm" },
        });
        return tx.project.update({ where: { id: projectId }, data: { managerId } });
      });
      return NextResponse.json(updated);
    }

    if (action === "set_team_member" || action === "remove_team_member") {
      const { projectId, employeeId, projectRole } = payload;
      if (!projectId || !employeeId) {
        return NextResponse.json({ error: "Project ID and employeeId are required." }, { status: 400 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (!has("projects.assign_team") && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, "projects.assign_team' (or be the project manager");
      }

      if (action === "set_team_member") {
        const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
        if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
        const member = await prisma.projectTeamMember.upsert({
          where: { projectId_employeeId: { projectId, employeeId } },
          create: { projectId, employeeId, projectRole: projectRole || "member" },
          update: { projectRole: projectRole || "member" },
          include: { employee: { select: { id: true, name: true, designation: true } } },
        });
        return NextResponse.json(member, { status: 201 });
      }

      // remove_team_member — the PM row goes away only by assigning a different PM.
      if (project.managerId === employeeId) {
        return NextResponse.json(
          { error: "This member is the Project Manager. Assign a different PM before removing them from the team." },
          { status: 400 }
        );
      }
      await prisma.projectTeamMember.deleteMany({ where: { projectId, employeeId } });
      return NextResponse.json({ success: true, projectId, employeeId });
    }

    if (action === "add_document") {
      const { projectId, kind, title, url, notes, signedByName, signedAt } = payload;
      if (!projectId || !title || !String(title).trim()) {
        return NextResponse.json({ error: "Project ID and document title are required." }, { status: 400 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, managerId: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (!has("projects.manage") && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, "projects.manage' (or be the project manager");
      }
      const doc = await prisma.projectDocument.create({
        data: {
          projectId,
          kind: kind || "drawing",
          title: String(title).trim(),
          url: url || null,
          notes: notes || null,
          status: "pending_approval",
          uploadedBy: actor.name,
          signedByName: signedByName || null,
          signedAt: signedAt ? new Date(signedAt) : null,
        },
      });
      return NextResponse.json(doc, { status: 201 });
    }

    if (action === "approve_document" || action === "reject_document" || action === "sign_document") {
      const { projectId, documentId, signedByName, signedAt } = payload;
      if (!projectId || !documentId) {
        return NextResponse.json({ error: "Project ID and documentId are required." }, { status: 400 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, managerId: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (!has("projects.documents_approve") && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, "projects.documents_approve' (or be the project manager");
      }
      const doc = await prisma.projectDocument.findFirst({ where: { id: documentId, projectId } });
      if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

      if (action === "sign_document") {
        if (!signedByName || !String(signedByName).trim()) {
          return NextResponse.json({ error: "signedByName is required for sign-off." }, { status: 400 });
        }
        const updated = await prisma.projectDocument.update({
          where: { id: documentId },
          data: { signedByName: String(signedByName).trim(), signedAt: signedAt ? new Date(signedAt) : new Date(), status: "approved" },
        });
        return NextResponse.json(updated);
      }

      const updated = await prisma.projectDocument.update({
        where: { id: documentId },
        data: { status: action === "approve_document" ? "approved" : "rejected", approvedBy: actor.name },
      });
      return NextResponse.json(updated);
    }

    if (action === "add_expense" || action === "petty_topup" || action === "petty_spend") {
      const { projectId, title, amount, category, notes, spentByName, spentById, expenseDate } = payload;
      if (!projectId || amount === undefined || amount === null) {
        return NextResponse.json({ error: "Project ID and amount are required." }, { status: 400 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, managerId: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      const isPetty = action !== "add_expense";
      const gateKey = isPetty ? "projects.petty_cash" : "projects.expenses";
      if (!has(gateKey) && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, `${gateKey}' (or be the project manager`);
      }
      const kind = action === "add_expense" ? "expense" : action;
      const fallbackTitle = action === "petty_topup" ? "Petty cash top-up" : action === "petty_spend" ? "Petty cash spend" : "";
      if (kind === "expense" && (!title || !String(title).trim())) {
        return NextResponse.json({ error: "Expense title is required." }, { status: 400 });
      }
      const expense = await prisma.projectExpense.create({
        data: {
          projectId,
          kind,
          title: title && String(title).trim() ? String(title).trim() : fallbackTitle,
          category: category || null,
          amount: Number(amount) || 0,
          spentById: spentById || null,
          spentByName: spentByName || null,
          expenseDate: expenseDate ? new Date(expenseDate) : undefined,
          notes: notes || null,
          createdBy: actor.name,
        },
      });
      return NextResponse.json(expense, { status: 201 });
    }

    if (action === "approve_overrun" || action === "reject_overrun") {
      const { projectId, boqItemId } = payload;
      if (!projectId || !boqItemId) {
        return NextResponse.json({ error: "Project ID and boqItemId are required." }, { status: 400 });
      }
      const item = await prisma.bOQItem.findFirst({
        where: { id: boqItemId, projectId },
        include: { project: { select: { managerId: true } } },
      });
      if (!item) return NextResponse.json({ error: "BOQ item not found." }, { status: 404 });
      if (!has("projects.approve_overrun") && !(await isProjectPM(actor, item.project))) {
        return permissionDenied(actor, "projects.approve_overrun' (or be the project manager");
      }
      if (action === "approve_overrun") {
        if (item.pendingActualQty === null && item.pendingActualCost === null) {
          return NextResponse.json({ error: "No pending overrun for this BOQ item." }, { status: 400 });
        }
        const updated = await prisma.bOQItem.update({
          where: { id: boqItemId },
          data: {
            actualQty: item.pendingActualQty ?? item.actualQty,
            actualCost: item.pendingActualCost ?? item.actualCost,
            pendingActualQty: null,
            pendingActualCost: null,
            overrunStatus: "approved",
          },
          include: { tasks: true },
        });
        return NextResponse.json(updated);
      }
      const updated = await prisma.bOQItem.update({
        where: { id: boqItemId },
        data: { pendingActualQty: null, pendingActualCost: null, overrunStatus: "rejected" },
        include: { tasks: true },
      });
      return NextResponse.json(updated);
    }

    if (action === "project_hisaab") {
      if (!has("projects.hisaab") && !has("projects.view")) return permissionDenied(actor, "projects.hisaab' or 'projects.view");
      const { projectId } = payload;
      if (!projectId) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { boqItems: true, expenses: true, _count: { select: { deliveryOrders: true } } },
      });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      const currentBoq = project.boqItems.filter((i) => i.version === project.revision);
      const boqPlannedTotal = currentBoq.reduce((s, i) => s + (Number(i.plannedQty) || 0) * (Number(i.unitRate) || 0), 0);
      const boqActualTotal = currentBoq.reduce((s, i) => s + (Number(i.actualCost) || 0), 0);
      const expensesTotal = project.expenses.filter((e) => e.kind === "expense").reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const pettyTopups = project.expenses.filter((e) => e.kind === "petty_topup").reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const pettySpends = project.expenses.filter((e) => e.kind === "petty_spend").reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return NextResponse.json({
        projectId: project.id,
        projectNumber: project.projectNumber,
        contractValue: project.contractValue,
        invoicedAmount: project.invoicedAmount,
        paidAmount: project.paidAmount,
        boqPlannedTotal,
        boqActualTotal,
        expensesTotal,
        pettyTopups,
        pettySpends,
        pettyBalance: pettyTopups - pettySpends,
        deliveryOrderCount: project._count.deliveryOrders,
        hisaabStatus: project.hisaabStatus,
      });
    }

    if (action === "settle_hisaab") {
      if (!has("projects.hisaab")) return permissionDenied(actor, "projects.hisaab");
      const { projectId, note } = payload;
      if (!projectId) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
          hisaabStatus: "settled",
          ...(note !== undefined ? { hisaabNote: note } : {}),
          hisaabSettledBy: actor.name,
          hisaabSettledAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "submit_completion") {
      const { projectId } = payload;
      if (!projectId) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (!has("projects.manage") && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, "projects.manage' (or be the project manager");
      }
      if (project.completionStatus !== "none" && project.completionStatus !== "auditor_rejected") {
        return NextResponse.json(
          { error: `Completion cannot be submitted from status '${project.completionStatus}'.` },
          { status: 400 }
        );
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { completionStatus: "submitted", completionSubmittedBy: actor.name, completionSubmittedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    if (action === "audit_completion") {
      if (!has("projects.audit_completion")) return permissionDenied(actor, "projects.audit_completion");
      const { projectId, decision } = payload;
      if (!projectId || (decision !== "approved" && decision !== "rejected")) {
        return NextResponse.json({ error: "Project ID and decision ('approved' | 'rejected') are required." }, { status: 400 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (project.completionStatus !== "submitted") {
        return NextResponse.json(
          { error: `Completion can only be audited from status 'submitted' (current: '${project.completionStatus}').` },
          { status: 400 }
        );
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
          completionStatus: decision === "approved" ? "auditor_approved" : "auditor_rejected",
          completionAuditedBy: actor.name,
          completionAuditedAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "create_final_bill") {
      if (!has("projects.create_bill")) return permissionDenied(actor, "projects.create_bill");
      const { projectId } = payload;
      if (!projectId) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { customer: true },
      });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (project.completionStatus !== "auditor_approved") {
        return NextResponse.json(
          { error: `Final bill requires an auditor-approved completion (current: '${project.completionStatus}').` },
          { status: 400 }
        );
      }
      const remaining = Math.round(((Number(project.contractValue) || 0) - (Number(project.invoicedAmount) || 0)) * 100) / 100;
      if (remaining <= 0) {
        return NextResponse.json({ error: "Nothing left to bill: the full contract value has already been invoiced." }, { status: 400 });
      }
      const result = await billProjectInvoice({
        project,
        invoiceAmount: remaining,
        memoLabel: "Final billing",
        idempotencyKey: `project_final_bill:${projectId}`,
      });
      if ("errorResponse" in result) return result.errorResponse;
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { completionStatus: "billed", finalBillInvoiceId: result.invoice.id, status: "completed" },
      });
      return NextResponse.json({ invoice: result.invoice, project: updated, message: "Final bill generated successfully" }, { status: 201 });
    }

    if (action === "create_delivery_order") {
      const { projectId, items, notes, doNumber } = payload;
      if (!projectId || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "Project ID and at least one delivery item are required." }, { status: 400 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, projectNumber: true, managerId: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      if (!has("projects.delivery_order") && !(await isProjectPM(actor, project))) {
        return permissionDenied(actor, "projects.delivery_order' (or be the project manager");
      }
      const cleanItems = items.map((it: any) => ({
        description: String(it?.description || "").trim(),
        productId: it?.productId || null,
        qty: Number(it?.qty) || 0,
        unit: it?.unit || "unit",
      }));
      let deliveryOrder = null;
      for (let attempt = 0; attempt < 5 && !deliveryOrder; attempt++) {
        const count = await prisma.projectDeliveryOrder.count({ where: { projectId } });
        const candidate = doNumber && String(doNumber).trim() ? String(doNumber).trim() : `DO-${project.projectNumber}-${count + 1 + attempt}`;
        try {
          deliveryOrder = await prisma.projectDeliveryOrder.create({
            data: { projectId, doNumber: candidate, items: cleanItems, status: "issued", issuedBy: actor.name, notes: notes || null },
          });
        } catch (e: any) {
          if (e?.code !== "P2002") throw e;
        }
      }
      if (!deliveryOrder) {
        return NextResponse.json({ error: "Could not allocate a delivery order number. Please retry." }, { status: 409 });
      }
      return NextResponse.json(deliveryOrder, { status: 201 });
    }

    // ==========================================
    // 11. DEFAULT: CREATE PROJECT
    // ==========================================
    if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
    const { name, customerId, totalBudget, contractValue, retentionPercent, billingMethod, startDate, endDate, status, projectNumber: customNumber, boqItems = [] } = payload;
    if (!name || !customerId) {
      return NextResponse.json({ error: "Project name and customer are required." }, { status: 400 });
    }

    let projectNumber = customNumber?.trim();
    if (!projectNumber) {
      projectNumber = await generateProjectCode();
    }

    const calculatedBudget = Number(totalBudget) || boqItems.reduce((acc: number, item: any) => acc + (Number(item.plannedQty) || 0) * (Number(item.unitRate) || 0), 0);
    const finalContractValue = Number(contractValue) || calculatedBudget;

    const project = await prisma.project.create({
      data: {
        projectNumber,
        name: name.trim(),
        customerId,
        status: status || "planning",
        totalBudget: calculatedBudget,
        contractValue: finalContractValue,
        retentionPercent: Number(retentionPercent) || 0,
        billingMethod: billingMethod || "milestone",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        boqItems: {
          create: boqItems
            .filter((item: any) => item.description?.trim())
            .map((item: any, idx: number) => ({
              itemCode: item.itemCode?.trim() || `BOQ-${String(idx + 1).padStart(2, "0")}`,
              description: item.description.trim(),
              unit: item.unit?.trim() || "unit",
              plannedQty: Number(item.plannedQty) || 1,
              unitRate: Number(item.unitRate) || 0,
              category: item.category || "material",
            })),
        },
      },
      include: {
        customer: true,
        boqItems: { include: { tasks: true } },
        tasks: { include: { assignedTechnician: true } },
        changeOrders: true,
        milestones: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err: any) {
    console.error("Error in POST /api/projects:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  const actor = resolved.actor;
  if (!actor.role || actor.role === "anonymous") {
    return NextResponse.json(
      {
        error:
          "Forbidden: missing actor role. Send x-actor-role (and optionally x-actor-name / x-user-id) or a mobile Bearer token.",
        code: "PERMISSION_DENIED",
      },
      { status: 403 }
    );
  }
  const has = (key: string) => actorHasPermission(actor, key);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const entity = searchParams.get("entity") || "project";

    if (!id) {
      return NextResponse.json({ error: "ID parameter is required." }, { status: 400 });
    }

    if (entity === "boq_item") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      const item = await prisma.bOQItem.findUnique({
        where: { id },
        select: { project: { select: { boqStatus: true } } },
      });
      if (!item) {
        return NextResponse.json({ error: "BOQ item not found." }, { status: 404 });
      }
      if (item.project.boqStatus === "approved") {
        return NextResponse.json({ error: "BOQ is approved — changes go through a change order." }, { status: 400 });
      }
      await prisma.projectTask.updateMany({
        where: { boqItemId: id },
        data: { boqItemId: null },
      });
      await prisma.bOQItem.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (entity === "task") {
      const task = await prisma.projectTask.findUnique({
        where: { id },
        select: { project: { select: { managerId: true } } },
      });
      if (!task) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if (!has("projects.tasks") && !(await isProjectPM(actor, task.project))) {
        return permissionDenied(actor, "projects.tasks' (or be the project manager");
      }
      await prisma.projectTask.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (entity === "milestone") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      await prisma.projectMilestone.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (entity === "change_order") {
      if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
      await prisma.bOQChangeOrder.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    // Default: delete project
    if (!has("projects.manage")) return permissionDenied(actor, "projects.manage");
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("Error in DELETE /api/projects:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

class BillingConflict extends Error {}
