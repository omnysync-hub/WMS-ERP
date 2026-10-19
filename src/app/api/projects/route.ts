export const dynamic = "force-dynamic";
import { TaxSettingsService } from "@/lib/tax/TaxSettingsService";
import { computeTax, findRate } from "@/lib/tax/taxConfig";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { SubLedgerService } from "@/lib/services/SubLedgerService";
import { DocumentSequenceService } from "@/lib/services/DocumentSequenceService";
import { actorHasPermission, requireJobsPermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  const gate = await requireJobsPermission(req, "jobs.view_directory");
  if (gate.error) return gate.error;
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    if (id) {
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
        },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Fetch linked client invoices and requisitions
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

      return NextResponse.json({
        ...project,
        invoices,
        requisitions,
      });
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
  const gate = await requireJobsPermission(req, "jobs.manage");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    // ==========================================
    // 1. DIRECT PROCUREMENT LINKING
    // ==========================================
    if (action === "create_requisition_from_boq") {
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

      const count = await prisma.purchaseRequisition.count();
      const prNumber = `PR-PRJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

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

      const invoiceAmount = Number(amount) || 0;
      if (invoiceAmount <= 0) {
        return NextResponse.json({ error: "Invoice amount must be greater than zero." }, { status: 400 });
      }

      if (!project.customerId) {
        return NextResponse.json(
          { error: "Project billing requires a linked customer so AR and the customer sub-ledger remain synchronized." },
          { status: 400 }
        );
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

      let invoice;
      try {
      invoice = await prisma.$transaction(async (tx) => {
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
          memo: `Progress billing ${invoiceNumber} for Project: "${project.name}"`,
          refType: "project_revenue",
          refId: createdInvoice.id,
          idempotencyKey: milestoneId ? `project_milestone_bill:${milestoneId}` : null,
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
          notes: `Progress billing invoice for Project: ${project.name}`,
          tx,
        });
        return createdInvoice;
      });

      } catch (e: any) {
        if (e instanceof BillingConflict) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
      }

      return NextResponse.json({ invoice, message: "Progress billing invoice generated successfully" }, { status: 201 });
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

      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, projectNumber: true } });
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
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
      if (!actorHasPermission(gate.actor, "projects.approve_change_order")) {
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
      await prisma.projectTask.delete({
        where: { id: targetId },
      });
      return NextResponse.json({ success: true, deletedId: targetId });
    }

    // ==========================================
    // 8. BOQ ITEM ACTIONS (Existing & Extended)
    // ==========================================
    if (action === "add_boq_item") {
      const { projectId, itemCode, description, unit, plannedQty, unitRate, category } = payload;
      if (!projectId || !description) {
        return NextResponse.json({ error: "Project ID and description are required." }, { status: 400 });
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
        },
        include: { tasks: true },
      });
      return NextResponse.json(boqItem, { status: 201 });
    }

    if (action === "update_boq_item") {
      const { boqItemId, id, itemCode, description, unit, plannedQty, unitRate, category, actualQty, actualCost, completedQty, status } = payload;
      const targetId = boqItemId || id;
      if (!targetId) {
        return NextResponse.json({ error: "BOQ Item ID is required." }, { status: 400 });
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
      const { boqItemId, id } = payload;
      const targetId = boqItemId || id;
      if (!targetId) {
        return NextResponse.json({ error: "BOQ Item ID is required." }, { status: 400 });
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
    // 10. DEFAULT: CREATE PROJECT
    // ==========================================
    const { name, customerId, totalBudget, contractValue, retentionPercent, billingMethod, startDate, endDate, status, projectNumber: customNumber, boqItems = [] } = payload;
    if (!name || !customerId) {
      return NextResponse.json({ error: "Project name and customer are required." }, { status: 400 });
    }

    let projectNumber = customNumber?.trim();
    if (!projectNumber) {
      const count = await prisma.project.count();
      projectNumber = `PRJ-2026-${String(count + 1).padStart(3, "0")}`;
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
  const gate = await requireJobsPermission(req, "jobs.manage");
  if (gate.error) return gate.error;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const entity = searchParams.get("entity") || "project";

    if (!id) {
      return NextResponse.json({ error: "ID parameter is required." }, { status: 400 });
    }

    if (entity === "boq_item") {
      await prisma.projectTask.updateMany({
        where: { boqItemId: id },
        data: { boqItemId: null },
      });
      await prisma.bOQItem.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (entity === "task") {
      await prisma.projectTask.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (entity === "milestone") {
      await prisma.projectMilestone.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (entity === "change_order") {
      await prisma.bOQChangeOrder.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    }

    // Default: delete project
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("Error in DELETE /api/projects:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

class BillingConflict extends Error {}
