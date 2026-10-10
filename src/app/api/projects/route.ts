export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { SubLedgerService } from "@/lib/services/SubLedgerService";
import { requireJobsPermission } from "@/lib/auth/erpActor";

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

      const invoice = await prisma.$transaction(async (tx) => {
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
        const invoiceCount = await tx.invoice.count();
        const invoiceNumber = `INV-PRJ-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, "0")}`;
        const createdInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            projectId,
            customerId: project.customerId,
            customerName: project.customer?.name || "Client",
            amount: invoiceAmount,
            status: "unpaid",
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
          postedBy: "Project Billing System",
          lines: [
            { accountId: arAccount.id, debit: invoiceAmount, credit: 0 },
            { accountId: revAccount.id, debit: 0, credit: invoiceAmount },
          ],
          tx,
        });
        await SubLedgerService.recordCustomerEntry({
          customerId: project.customerId!,
          entryType: "invoice",
          documentNumber: invoiceNumber,
          journalEntryId: entry.id,
          debit: invoiceAmount,
          credit: 0,
          notes: `Progress billing invoice for Project: ${project.name}`,
          tx,
        });
        return createdInvoice;
      });

      return NextResponse.json({ invoice, message: "Progress billing invoice generated successfully" }, { status: 201 });
    }

    // ==========================================
    // 3. CHANGE ORDERS & BOQ REVISIONS
    // ==========================================
    if (action === "create_change_order") {
      const { projectId, title, description, requestedBy, amountImpact, daysImpact, newBoqItems = [] } = payload;
      if (!projectId || !title) {
        return NextResponse.json({ error: "Project ID and change order title are required." }, { status: 400 });
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      const coCount = await prisma.bOQChangeOrder.count({ where: { projectId } });
      const changeNumber = `CO-${String(coCount + 1).padStart(2, "0")}`;
      const amount = Number(amountImpact) || 0;
      const days = Number(daysImpact) || 0;
      const nextRevision = (project.revision || 1) + 1;

      const changeOrder = await prisma.bOQChangeOrder.create({
        data: {
          projectId,
          changeNumber,
          title: title.trim(),
          description: description?.trim() || "",
          requestedBy: requestedBy || "Client Representative",
          amountImpact: amount,
          daysImpact: days,
          status: "approved",
          approvedAt: new Date(),
        },
      });

      // Adjust project budget, contract value & revision
      await prisma.project.update({
        where: { id: projectId },
        data: {
          revision: nextRevision,
          totalBudget: { increment: amount },
          contractValue: { increment: amount },
        },
      });

      // Insert revision BOQ items if specified
      if (Array.isArray(newBoqItems) && newBoqItems.length > 0) {
        for (let i = 0; i < newBoqItems.length; i++) {
          const item = newBoqItems[i];
          if (item.description?.trim()) {
            await prisma.bOQItem.create({
              data: {
                projectId,
                itemCode: item.itemCode?.trim() || `BOQ-REV${nextRevision}-${String(i + 1).padStart(2, "0")}`,
                description: item.description.trim(),
                unit: item.unit?.trim() || "unit",
                plannedQty: Number(item.plannedQty) || 1,
                unitRate: Number(item.unitRate) || 0,
                category: item.category || "material",
                version: nextRevision,
                changeOrderRef: changeNumber,
                status: "pending",
              },
            });
          }
        }
      }

      return NextResponse.json(changeOrder, { status: 201 });
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
