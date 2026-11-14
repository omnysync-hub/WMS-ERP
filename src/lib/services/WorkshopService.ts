import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

export type WorkshopType = "bike" | "hvac";

export type WorkshopJobStatus =
  | "Open"
  | "Assigned"
  | "Under Inspection"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Closed";

export interface CreateWorkshopJobCardInput {
  workshopType: WorkshopType;
  // Bike Fields
  bikeRegNo?: string;
  chassisNumber?: string;
  engineNumber?: string;
  currentKm?: number;
  bikeMakeModel?: string;
  // HVAC Fields
  unitType?: string;
  brandModel?: string;
  serialNumber?: string;
  customerSite?: string;
  compressorSpec?: string;
  refrigerantType?: string;
  // Customer
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  // Intake
  complaint: string;
  supervisorName?: string;
  supervisorId?: string;
  // Initial assignment (optional)
  assignedStaffId?: string;
  assignedStaffName?: string;
}

export class WorkshopService {
  /**
   * Generates next sequential job card number:
   * Bike: BJC-2026-0001
   * HVAC: HJC-2026-0001
   */
  static async generateJobCardNumber(workshopType: WorkshopType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = workshopType === "bike" ? `BJC-${year}-` : `HJC-${year}-`;

    const count = await prisma.workshopJobCard.count({
      where: {
        workshopType,
        jobNumber: { startsWith: prefix },
      },
    });

    const seq = String(count + 1).padStart(4, "0");
    return `${prefix}${seq}`;
  }

  /**
   * Step 1: Create Job Card (Responsible: Workshop Supervisor)
   */
  static async createJobCard(data: CreateWorkshopJobCardInput, actorName = "Workshop Supervisor") {
    if (!data.complaint || !data.complaint.trim()) {
      throw new Error("Complaint / Initial Fault Description is required.");
    }

    if (data.workshopType === "bike") {
      if (!data.bikeRegNo?.trim()) {
        throw new Error("Bike Registration Number is required for Bike Workshop job cards.");
      }
    } else {
      if (!data.unitType?.trim() || !data.brandModel?.trim()) {
        throw new Error("Unit Type and Brand/Model are required for HVAC Workshop job cards.");
      }
    }

    const jobNumber = await this.generateJobCardNumber(data.workshopType);

    const initialStatus: WorkshopJobStatus = data.assignedStaffId ? "Assigned" : "Open";

    const jobCard = await prisma.workshopJobCard.create({
      data: {
        jobNumber,
        workshopType: data.workshopType,
        status: initialStatus,
        bikeRegNo: data.bikeRegNo?.trim().toUpperCase() || null,
        chassisNumber: data.chassisNumber?.trim().toUpperCase() || null,
        engineNumber: data.engineNumber?.trim().toUpperCase() || null,
        currentKm: data.currentKm != null ? Number(data.currentKm) : null,
        bikeMakeModel: data.bikeMakeModel?.trim() || null,
        unitType: data.unitType?.trim() || null,
        brandModel: data.brandModel?.trim() || null,
        serialNumber: data.serialNumber?.trim().toUpperCase() || null,
        customerSite: data.customerSite?.trim() || null,
        compressorSpec: data.compressorSpec?.trim() || null,
        refrigerantType: data.refrigerantType?.trim() || null,
        customerId: data.customerId || null,
        customerName: data.customerName?.trim() || null,
        customerPhone: data.customerPhone?.trim() || null,
        complaint: data.complaint.trim(),
        supervisorName: data.supervisorName || actorName,
        supervisorId: data.supervisorId || null,
        assignedStaffId: data.assignedStaffId || null,
        assignedStaffName: data.assignedStaffName || null,
        assignedStaffRole: data.workshopType === "bike" ? "mechanic" : "technician",
        assignedAt: data.assignedStaffId ? new Date() : null,
        statusLogs: {
          create: {
            fromStatus: "None",
            toStatus: initialStatus,
            changedBy: actorName,
            notes: `Job Card created by ${actorName}`,
          },
        },
      },
      include: {
        customer: true,
        assignedEmployee: true,
        requisitions: true,
        scrapItems: true,
        toolIssues: true,
      },
    });

    return jobCard;
  }

  /**
   * Step 2: Assign Mechanic / Technician (Responsible: Workshop Supervisor)
   */
  static async assignStaff(
    jobCardId: string,
    staffId: string,
    staffName: string,
    actorName = "Workshop Supervisor"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    if (jobCard.status === "Closed") {
      throw new Error("Cannot reassign a closed Job Card.");
    }

    const updated = await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        assignedStaffId: staffId,
        assignedStaffName: staffName,
        assignedStaffRole: jobCard.workshopType === "bike" ? "mechanic" : "technician",
        assignedAt: new Date(),
        status: jobCard.status === "Open" ? "Assigned" : jobCard.status,
        statusLogs: {
          create: {
            fromStatus: jobCard.status,
            toStatus: jobCard.status === "Open" ? "Assigned" : jobCard.status,
            changedBy: actorName,
            notes: `Assigned to ${staffName}`,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Step 3: Inspection & Diagnosis (Responsible: Mechanic / Technician)
   */
  static async saveDiagnosis(
    jobCardId: string,
    data: {
      inspectionFindings: string;
      workRequired: string;
      estimatedHours?: number;
      estimatedCost?: number;
    },
    mechanicName = "Technician"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    if (jobCard.status === "Closed") {
      throw new Error("Cannot modify diagnosis on a closed Job Card.");
    }

    const updated = await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        inspectionFindings: data.inspectionFindings.trim(),
        workRequired: data.workRequired.trim(),
        estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : null,
        estimatedCost: data.estimatedCost ? Number(data.estimatedCost) : 0,
        diagnosedAt: new Date(),
        diagnosedBy: mechanicName,
        approvalStatus: "pending",
        status: "Pending Approval",
        statusLogs: {
          create: {
            fromStatus: jobCard.status,
            toStatus: "Pending Approval",
            changedBy: mechanicName,
            notes: `Diagnosis submitted for Manager Approval: ${data.workRequired.slice(0, 100)}`,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Step 4: Manager Approval (Responsible: Workshop Manager)
   * Hard Control: Work cannot start before Manager approval!
   */
  static async approveOrRejectDiagnosis(
    jobCardId: string,
    action: "approve" | "reject",
    reason?: string,
    managerName = "Workshop Manager"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    if (jobCard.status !== "Pending Approval" && jobCard.status !== "Under Inspection") {
      throw new Error(
        `Job Card #${jobCard.jobNumber} is currently in status "${jobCard.status}". Approval can only be made on pending diagnosis.`
      );
    }

    const nextStatus: WorkshopJobStatus = action === "approve" ? "Approved" : "Rejected";

    const updated = await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        approvalStatus: action === "approve" ? "approved" : "rejected",
        managerApprovedAt: new Date(),
        managerApprovedBy: managerName,
        rejectionReason: action === "reject" ? reason || "Diagnosis rejected by manager" : null,
        status: nextStatus,
        statusLogs: {
          create: {
            fromStatus: jobCard.status,
            toStatus: nextStatus,
            changedBy: managerName,
            notes:
              action === "approve"
                ? `Diagnosis approved by ${managerName}`
                : `Diagnosis rejected by ${managerName}: ${reason || "No reason specified"}`,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Step 5: Store Requisition (Responsible: Mechanic / Technician)
   * Hard Control: No material can be requisitioned without Manager Approval!
   */
  static async requestMaterial(
    jobCardId: string,
    items: Array<{
      productId?: string;
      itemCode?: string;
      description: string;
      requestedQty: number;
      unit?: string;
      unitCost?: number;
    }>,
    mechanicName = "Technician"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    if (!["Approved", "In Progress", "On Hold"].includes(jobCard.status)) {
      throw new Error(
        `Control Policy: Work / Material Requisition cannot start without Manager approval. Current status is "${jobCard.status}".`
      );
    }

    if (!items || items.length === 0) {
      throw new Error("At least one material item must be specified.");
    }

    const requisitionsData = items.map((it) => ({
      jobCardId,
      productId: it.productId || null,
      itemCode: it.itemCode || null,
      description: it.description.trim(),
      unit: it.unit || "unit",
      requestedQty: Math.max(0.01, Number(it.requestedQty) || 1),
      unitCost: Number(it.unitCost) || 0,
      totalCost: 0,
      status: "requested",
      requestedBy: mechanicName,
    }));

    await prisma.workshopMaterialRequisition.createMany({
      data: requisitionsData,
    });

    // Advance Job Card to In Progress if it was Approved
    if (jobCard.status === "Approved") {
      await prisma.workshopJobCard.update({
        where: { id: jobCardId },
        data: {
          status: "In Progress",
          statusLogs: {
            create: {
              fromStatus: "Approved",
              toStatus: "In Progress",
              changedBy: mechanicName,
              notes: `Material requisition raised for ${items.length} item(s). Job moved to In Progress.`,
            },
          },
        },
      });
    }

    return await prisma.workshopMaterialRequisition.findMany({
      where: { jobCardId },
      include: { product: true },
    });
  }

  /**
   * Step 6: Inventory Issue (Responsible: Store Keeper)
   * Hard Control: No material is issued without a Job Card No.
   * Stock is reduced in ERP and cost is charged to the job.
   */
  static async issueMaterial(
    requisitionId: string,
    issuedQty: number,
    storeKeeperName = "Store Keeper"
  ) {
    const req = await prisma.workshopMaterialRequisition.findUnique({
      where: { id: requisitionId },
      include: { jobCard: true, product: true },
    });

    if (!req) throw new Error("Material requisition item not found");

    if (req.jobCard.status === "Closed" || req.jobCard.status === "Rejected") {
      throw new Error(`Cannot issue material for Job Card in status "${req.jobCard.status}".`);
    }

    const qty = Math.max(0.01, Number(issuedQty) || 0);

    // If product is linked to ERP warehouse inventory, check stock and record out movement
    let effectiveCost = req.unitCost;
    if (req.productId) {
      const prod = await prisma.product.findUnique({ where: { id: req.productId } });
      if (prod) {
        effectiveCost = prod.costPrice > 0 ? prod.costPrice : prod.unitPrice || effectiveCost;

        if (prod.stockQuantity < qty) {
          throw new Error(
            `Insufficient warehouse stock for '${prod.name}'. Available: ${prod.stockQuantity} ${prod.unit}, Requested Issue: ${qty} ${prod.unit}`
          );
        }

        // Deduct from ERP Product Stock
        await prisma.product.update({
          where: { id: prod.id },
          data: { stockQuantity: { decrement: qty } },
        });

        // Record stock ledger out
        await prisma.stockLedger.create({
          data: {
            productId: prod.id,
            qty,
            direction: "out",
            refType: "workshop_consumption",
            refId: req.jobCard.jobNumber,
          },
        });
      }
    }

    const newIssuedQty = (req.issuedQty || 0) + qty;
    const netUsed = Math.max(0, newIssuedQty - (req.returnedQty || 0));
    const totalCost = Math.round(netUsed * effectiveCost * 100) / 100;

    const updated = await prisma.workshopMaterialRequisition.update({
      where: { id: requisitionId },
      data: {
        issuedQty: newIssuedQty,
        unitCost: effectiveCost,
        totalCost,
        status: newIssuedQty >= req.requestedQty ? "issued" : "partially_issued",
        issuedAt: new Date(),
        issuedBy: storeKeeperName,
      },
    });

    // Recompute total job material cost
    await this.recalculateJobCost(req.jobCardId);

    return updated;
  }

  /**
   * Step 9: Return of Unused Material (Responsible: Mechanic / Technician -> Store)
   * Unused / returnable items (e.g. remaining gas cylinder weight, extra parts) returned against Job Card;
   * stock and job cost adjusted.
   */
  static async returnMaterial(
    requisitionId: string,
    returnedQty: number,
    returnReason: string,
    storeKeeperName = "Store Keeper"
  ) {
    const req = await prisma.workshopMaterialRequisition.findUnique({
      where: { id: requisitionId },
      include: { jobCard: true, product: true },
    });

    if (!req) throw new Error("Material requisition item not found");

    const returnQty = Math.max(0.01, Number(returnedQty) || 0);

    const availableToReturn = Math.max(0, req.issuedQty - (req.returnedQty || 0));
    if (returnQty > availableToReturn + 0.001) {
      throw new Error(
        `Cannot return ${returnQty} ${req.unit}. Only ${availableToReturn} ${req.unit} of issued material is unreturned.`
      );
    }

    // Return to ERP inventory stock
    if (req.productId) {
      await prisma.product.update({
        where: { id: req.productId },
        data: { stockQuantity: { increment: returnQty } },
      });

      await prisma.stockLedger.create({
        data: {
          productId: req.productId,
          qty: returnQty,
          direction: "in",
          refType: "workshop_return",
          refId: req.jobCard.jobNumber,
        },
      });
    }

    const newReturnedQty = (req.returnedQty || 0) + returnQty;
    const netUsed = Math.max(0, req.issuedQty - newReturnedQty);
    const totalCost = Math.round(netUsed * req.unitCost * 100) / 100;

    const updated = await prisma.workshopMaterialRequisition.update({
      where: { id: requisitionId },
      data: {
        returnedQty: newReturnedQty,
        totalCost,
        status: netUsed === 0 ? "returned" : "reconciled",
        returnedAt: new Date(),
        returnedBy: storeKeeperName,
        returnReason: returnReason.trim(),
      },
    });

    await this.recalculateJobCost(req.jobCardId);

    return updated;
  }

  /**
   * Step 7 & 8: Testing & Quality Checks (HVAC & Bike)
   */
  static async recordTesting(
    jobCardId: string,
    data: {
      testingPressurePsi?: number;
      testingLeakTest?: string;
      testingRunTestAmps?: number;
      testingNotes?: string;
    },
    technicianName = "Technician"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    const updated = await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        testingPressurePsi: data.testingPressurePsi != null ? Number(data.testingPressurePsi) : null,
        testingLeakTest: data.testingLeakTest || "Pass",
        testingRunTestAmps: data.testingRunTestAmps != null ? Number(data.testingRunTestAmps) : null,
        testingNotes: data.testingNotes?.trim() || null,
        testedAt: new Date(),
        testedBy: technicianName,
      },
    });

    return updated;
  }

  /**
   * Step 8: Job Completion (Responsible: Mechanic / Technician)
   */
  static async completeJob(
    jobCardId: string,
    workDoneSummary: string,
    technicianName = "Technician"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({
      where: { id: jobCardId },
      include: { requisitions: true },
    });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    if (jobCard.status === "Closed") {
      throw new Error("Job Card is already closed.");
    }

    if (!workDoneSummary || !workDoneSummary.trim()) {
      throw new Error("Work Done Summary is required to complete the Job Card.");
    }

    const updated = await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        status: "Completed",
        workDoneSummary: workDoneSummary.trim(),
        completedAt: new Date(),
        completedBy: technicianName,
        statusLogs: {
          create: {
            fromStatus: jobCard.status,
            toStatus: "Completed",
            changedBy: technicianName,
            notes: `Work completed: ${workDoneSummary.slice(0, 100)}`,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Scrap Management: Record replaced parts & scrap against Job Card
   */
  static async recordScrapItem(
    jobCardId: string,
    data: {
      itemDescription: string;
      quantity?: number;
      unit?: string;
      customerKept?: boolean;
    },
    actorName = "Technician"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    if (!jobCard) throw new Error("Workshop Job Card not found");

    const scrap = await prisma.workshopScrapItem.create({
      data: {
        jobCardId,
        workshopType: jobCard.workshopType,
        itemDescription: data.itemDescription.trim(),
        quantity: Math.max(0.1, Number(data.quantity) || 1),
        unit: data.unit?.trim() || (jobCard.workshopType === "bike" ? "pcs" : "kg"),
        customerKept: Boolean(data.customerKept),
        status: data.customerKept ? "disposed" : "recorded",
        disposalNotes: data.customerKept ? "Customer retained replaced parts upon delivery." : null,
      },
    });

    return scrap;
  }

  /**
   * Scrap Return to Store: Handover to Storekeeper and entry in Scrap Register
   */
  static async returnScrapToStore(scrapId: string, storeKeeperName = "Store Keeper") {
    const scrap = await prisma.workshopScrapItem.findUnique({ where: { id: scrapId } });
    if (!scrap) throw new Error("Scrap record not found");

    if (scrap.customerKept) {
      throw new Error("This scrap item was retained by the customer.");
    }

    const updated = await prisma.workshopScrapItem.update({
      where: { id: scrapId },
      data: {
        returnedToStore: true,
        returnedToStoreAt: new Date(),
        storeKeeperName,
        status: "in_store",
      },
    });

    return updated;
  }

  /**
   * Scrap Disposal / Sale: Sold or disposed with Manager Approval, posting scrap income to accounts
   */
  static async disposeOrSellScrap(
    scrapId: string,
    data: {
      saleAmount?: number;
      disposalNotes?: string;
      actionType: "sold" | "disposed";
    },
    managerName = "Workshop Manager"
  ) {
    const scrap = await prisma.workshopScrapItem.findUnique({
      where: { id: scrapId },
      include: { jobCard: true },
    });
    if (!scrap) throw new Error("Scrap record not found");

    const saleAmount = Math.max(0, Number(data.saleAmount) || 0);

    let journalId: string | null = null;

    // Post to GL if sold for cash value
    if (data.actionType === "sold" && saleAmount > 0) {
      try {
        const cashAccount = await AccountMappingService.resolveAccount({
          transactionType: "pos_cash_receipt",
        });
        const scrapIncomeAccount = await prisma.account.findFirst({
          where: {
            OR: [{ code: "42100" }, { code: "4200" }, { name: { contains: "Other Income", mode: "insensitive" } }],
            isActive: true,
          },
        });

        if (scrapIncomeAccount) {
          const journal = await AccountsPostingService.post({
            memo: `Workshop Scrap Sale (${scrap.workshopType.toUpperCase()} Job #${scrap.jobCard.jobNumber}): ${scrap.itemDescription} (${scrap.quantity} ${scrap.unit})`,
            refType: "scrap_sale",
            refId: scrap.id,
            postedBy: managerName,
            lines: [
              { accountId: cashAccount.id, debit: saleAmount, credit: 0 },
              { accountId: scrapIncomeAccount.id, debit: 0, credit: saleAmount },
            ],
          });
          journalId = journal.id;
        }
      } catch (err) {
        console.error("Could not post scrap sale journal:", err);
      }
    }

    const updated = await prisma.workshopScrapItem.update({
      where: { id: scrapId },
      data: {
        status: data.actionType === "sold" ? "sold" : "disposed",
        disposalValue: saleAmount,
        disposalNotes: data.disposalNotes?.trim() || null,
        disposedAt: new Date(),
        disposedBy: managerName,
        approvedBy: managerName,
        journalEntryId: journalId,
      },
    });

    return updated;
  }

  /**
   * Step 10: Final Check & Close (Responsible: Workshop Manager)
   * Hard Controls:
   * 1. A Job Card cannot be closed until all unused / returnable material is reconciled.
   * 2. Must be in Completed status.
   */
  static async closeJobCard(
    jobCardId: string,
    data?: { closeNotes?: string; deliveryStatus?: string; deliveredTo?: string },
    managerName = "Workshop Manager"
  ) {
    const jobCard = await prisma.workshopJobCard.findUnique({
      where: { id: jobCardId },
      include: {
        requisitions: true,
        scrapItems: true,
        toolIssues: { where: { status: "issued" } },
      },
    });

    if (!jobCard) throw new Error("Workshop Job Card not found");

    if (jobCard.status === "Closed") {
      throw new Error(`Job Card #${jobCard.jobNumber} is already closed.`);
    }

    if (jobCard.status !== "Completed") {
      throw new Error(
        `Job Card must be marked "Completed" by the technician before manager closure. Current status is "${jobCard.status}".`
      );
    }

    // Check 1: Tool issues must be returned
    if (jobCard.toolIssues && jobCard.toolIssues.length > 0) {
      throw new Error(
        `Cannot close Job Card: ${jobCard.toolIssues.length} workshop tool(s) are still checked out to this job. All tools must be returned to Store first.`
      );
    }

    // Check 2: All material requests must be fully accounted for
    const pendingRequests = jobCard.requisitions.filter((r) => r.status === "requested");
    if (pendingRequests.length > 0) {
      throw new Error(
        `Cannot close Job Card: ${pendingRequests.length} material requisition(s) are pending at Store. Fulfill or cancel them first.`
      );
    }

    const updated = await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        status: "Closed",
        closedAt: new Date(),
        closedBy: managerName,
        closeNotes: data?.closeNotes?.trim() || "Work and material reconciliation verified.",
        deliveryStatus: data?.deliveryStatus || "ready_for_delivery",
        deliveredAt: data?.deliveryStatus === "delivered" ? new Date() : null,
        deliveredTo: data?.deliveredTo?.trim() || null,
        statusLogs: {
          create: {
            fromStatus: jobCard.status,
            toStatus: "Closed",
            changedBy: managerName,
            notes: `Final check completed, material reconciled, Job Card closed by ${managerName}.`,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Helper: Recalculate material and job cost
   */
  private static async recalculateJobCost(jobCardId: string) {
    const requisitions = await prisma.workshopMaterialRequisition.findMany({
      where: { jobCardId },
    });

    const totalMaterialCost = Math.round(
      requisitions.reduce((sum, r) => sum + (r.totalCost || 0), 0) * 100
    ) / 100;

    const job = await prisma.workshopJobCard.findUnique({ where: { id: jobCardId } });
    const labourCost = job?.totalLabourCost || 0;
    const totalJobCost = Math.round((totalMaterialCost + labourCost) * 100) / 100;

    await prisma.workshopJobCard.update({
      where: { id: jobCardId },
      data: {
        totalMaterialCost,
        totalJobCost,
      },
    });
  }

  // ==========================================================================
  // WORKSHOP TOOLS MANAGEMENT
  // ==========================================================================

  static async listTools(workshopType?: string) {
    const where: any = {};
    if (workshopType && workshopType !== "all") {
      where.OR = [{ workshopType }, { workshopType: "general" }];
    }

    return await prisma.workshopTool.findMany({
      where,
      include: {
        issues: {
          where: { status: "issued" },
          include: { jobCard: true },
        },
      },
      orderBy: { toolCode: "asc" },
    });
  }

  static async createTool(data: {
    toolCode: string;
    name: string;
    category: string;
    workshopType: string;
    totalQuantity: number;
    location?: string;
  }) {
    return await prisma.workshopTool.create({
      data: {
        toolCode: data.toolCode.trim().toUpperCase(),
        name: data.name.trim(),
        category: data.category.trim(),
        workshopType: data.workshopType || "general",
        totalQuantity: Math.max(1, Number(data.totalQuantity) || 1),
        availableQuantity: Math.max(1, Number(data.totalQuantity) || 1),
        location: data.location?.trim() || null,
        condition: "Operational",
      },
    });
  }

  static async issueTool(data: {
    toolId: string;
    staffId?: string;
    staffName: string;
    jobCardId?: string;
    quantity: number;
    expectedReturnDate?: Date;
    notes?: string;
    issuedBy: string;
  }) {
    const tool = await prisma.workshopTool.findUnique({ where: { id: data.toolId } });
    if (!tool) throw new Error("Tool not found");

    const qty = Math.max(1, Number(data.quantity) || 1);
    if (tool.availableQuantity < qty) {
      throw new Error(
        `Insufficient tool quantity available. Available: ${tool.availableQuantity}, Requested: ${qty}`
      );
    }

    const issue = await prisma.$transaction(async (tx) => {
      await tx.workshopTool.update({
        where: { id: data.toolId },
        data: { availableQuantity: { decrement: qty } },
      });

      return await tx.workshopToolIssue.create({
        data: {
          toolId: data.toolId,
          jobCardId: data.jobCardId || null,
          staffId: data.staffId || null,
          staffName: data.staffName.trim(),
          quantity: qty,
          issuedBy: data.issuedBy,
          expectedReturnDate: data.expectedReturnDate || null,
          notes: data.notes?.trim() || null,
          status: "issued",
        },
      });
    });

    return issue;
  }

  static async returnTool(
    issueId: string,
    data: {
      returnCondition: "Operational" | "Damaged" | "Under Repair" | "Lost";
      notes?: string;
      returnedBy: string;
    }
  ) {
    const issue = await prisma.workshopToolIssue.findUnique({
      where: { id: issueId },
      include: { tool: true },
    });
    if (!issue) throw new Error("Tool issue record not found");

    if (issue.status !== "issued") {
      throw new Error("This tool issue is already marked returned or closed.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If returned in operational condition, restore available quantity
      const isAvailableAgain = data.returnCondition === "Operational";

      await tx.workshopTool.update({
        where: { id: issue.toolId },
        data: {
          availableQuantity: isAvailableAgain
            ? { increment: issue.quantity }
            : undefined,
          condition: data.returnCondition,
          conditionNotes: data.notes?.trim() || null,
        },
      });

      return await tx.workshopToolIssue.update({
        where: { id: issueId },
        data: {
          status: data.returnCondition === "Operational" ? "returned" : (data.returnCondition.toLowerCase() as any),
          returnedAt: new Date(),
          returnedBy: data.returnedBy,
          returnCondition: data.returnCondition,
          notes: data.notes?.trim() || issue.notes,
        },
      });
    });

    return updated;
  }

  static async recordToolAudit(data: {
    workshopType: string;
    auditMonth: string;
    countedBy: string;
    verifiedBy?: string;
    totalToolsCounted: number;
    discrepancyCount: number;
    notes?: string;
  }) {
    return await prisma.workshopToolCount.create({
      data: {
        auditMonth: data.auditMonth,
        workshopType: data.workshopType,
        countedBy: data.countedBy,
        verifiedBy: data.verifiedBy || null,
        totalToolsCounted: data.totalToolsCounted,
        discrepancyCount: data.discrepancyCount,
        notes: data.notes?.trim() || null,
        status: "completed",
      },
    });
  }

  // ==========================================================================
  // 8 WORKSHOP ENTERPRISE REPORTS
  // ==========================================================================

  static async getReports(
    reportType:
      | "bike_history"
      | "hvac_history"
      | "mechanic_productivity"
      | "job_costing"
      | "material_flow"
      | "pending_jobs"
      | "tools_report"
      | "scrap_report",
    params?: { workshopType?: string; search?: string; startDate?: Date; endDate?: Date }
  ) {
    switch (reportType) {
      case "bike_history": {
        const where: any = { workshopType: "bike" };
        if (params?.search) {
          where.OR = [
            { bikeRegNo: { contains: params.search, mode: "insensitive" } },
            { chassisNumber: { contains: params.search, mode: "insensitive" } },
            { customerName: { contains: params.search, mode: "insensitive" } },
          ];
        }
        return await prisma.workshopJobCard.findMany({
          where,
          include: { requisitions: true, scrapItems: true },
          orderBy: { createdAt: "desc" },
        });
      }

      case "hvac_history": {
        const where: any = { workshopType: "hvac" };
        if (params?.search) {
          where.OR = [
            { serialNumber: { contains: params.search, mode: "insensitive" } },
            { brandModel: { contains: params.search, mode: "insensitive" } },
            { customerSite: { contains: params.search, mode: "insensitive" } },
          ];
        }
        return await prisma.workshopJobCard.findMany({
          where,
          include: { requisitions: true, scrapItems: true },
          orderBy: { createdAt: "desc" },
        });
      }

      case "mechanic_productivity": {
        const jobs = await prisma.workshopJobCard.findMany({
          where: params?.workshopType ? { workshopType: params.workshopType } : {},
          include: { requisitions: true },
        });

        const staffMap: Record<string, any> = {};
        for (const j of jobs) {
          const staff = j.assignedStaffName || "Unassigned";
          if (!staffMap[staff]) {
            staffMap[staff] = {
              staffName: staff,
              role: j.assignedStaffRole || "technician",
              totalJobs: 0,
              completedJobs: 0,
              inProgressJobs: 0,
              totalEstHours: 0,
              totalMaterialCost: 0,
            };
          }
          staffMap[staff].totalJobs++;
          if (j.status === "Completed" || j.status === "Closed") staffMap[staff].completedJobs++;
          if (j.status === "In Progress" || j.status === "Assigned") staffMap[staff].inProgressJobs++;
          staffMap[staff].totalEstHours += j.estimatedHours || 0;
          staffMap[staff].totalMaterialCost += j.totalMaterialCost || 0;
        }

        return Object.values(staffMap);
      }

      case "job_costing": {
        return await prisma.workshopJobCard.findMany({
          where: params?.workshopType ? { workshopType: params.workshopType } : {},
          select: {
            id: true,
            jobNumber: true,
            workshopType: true,
            status: true,
            bikeRegNo: true,
            serialNumber: true,
            brandModel: true,
            customerName: true,
            totalMaterialCost: true,
            totalLabourCost: true,
            totalJobCost: true,
            createdAt: true,
            closedAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }

      case "material_flow": {
        return await prisma.workshopMaterialRequisition.findMany({
          where: params?.workshopType ? { jobCard: { workshopType: params.workshopType } } : {},
          include: { jobCard: true, product: true },
          orderBy: { createdAt: "desc" },
        });
      }

      case "pending_jobs": {
        return await prisma.workshopJobCard.findMany({
          where: {
            status: { notIn: ["Closed", "Rejected"] },
            ...(params?.workshopType ? { workshopType: params.workshopType } : {}),
          },
          include: { requisitions: true },
          orderBy: { createdAt: "asc" },
        });
      }

      case "tools_report": {
        const tools = await prisma.workshopTool.findMany({
          where: params?.workshopType ? { OR: [{ workshopType: params.workshopType }, { workshopType: "general" }] } : {},
          include: { issues: { where: { status: "issued" } } },
        });
        return tools;
      }

      case "scrap_report": {
        return await prisma.workshopScrapItem.findMany({
          where: params?.workshopType ? { workshopType: params.workshopType } : {},
          include: { jobCard: true },
          orderBy: { createdAt: "desc" },
        });
      }

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }
}
