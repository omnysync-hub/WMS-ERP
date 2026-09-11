import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { InventoryService } from "./InventoryService";

export class JobsService {
  /**
   * Log transition immutably to JobStatusHistory
   */
  static async logStatusChange(
    jobId: string,
    fromStatus: string,
    toStatus: string,
    changedBy: string,
    meta?: Record<string, any>
  ) {
    return await prisma.jobStatusHistory.create({
      data: {
        jobId,
        fromStatus,
        toStatus,
        changedBy,
        metaJson: meta ? JSON.stringify(meta) : null,
      },
    });
  }

  /**
   * Transition job to Assigned
   */
  static async assignTechnician(jobId: string, technicianId: string, assignedBy: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (job.finalizedAt) {
      throw new Error("Job is finalized and locked. Edits are rejected.");
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        assignedTechnicianId: technicianId,
        status: "Assigned",
      },
      include: { assignedTechnician: true, customer: true },
    });

    await this.logStatusChange(jobId, job.status, "Assigned", assignedBy, {
      assignedTechnicianId: technicianId,
    });

    return updated;
  }

  /**
   * Technician accepts job
   */
  static async acceptJob(jobId: string, technicianId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "Assigned") {
      throw new Error(`Cannot accept job with status '${job.status}'. Must be 'Assigned'.`);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: "Accepted" },
    });

    await this.logStatusChange(jobId, "Assigned", "Accepted", technicianId);
    return updated;
  }

  /**
   * Technician starts job (capturing GPS & timestamp)
   */
  static async startJob(jobId: string, technicianId: string, lat?: number, lng?: number) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "Accepted" && job.status !== "Paused") {
      throw new Error(`Cannot start job with status '${job.status}'.`);
    }

    // If previously Paused, enforce server-side mandatory gate
    if (job.status === "Paused") {
      await this.verifyResumeAllowed(jobId);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: "InProgress" },
    });

    await this.logStatusChange(jobId, job.status, "InProgress", technicianId, {
      lat,
      lng,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Technician stops job (Day not finished -> Paused)
   */
  static async pauseJob(jobId: string, technicianId: string, note?: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "InProgress") {
      throw new Error(`Cannot pause job with status '${job.status}'.`);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: "Paused" },
    });

    await this.logStatusChange(jobId, "InProgress", "Paused", technicianId, { note });
    return updated;
  }

  /**
   * Check whether resume is permitted from Paused state:
   * Mandatory rule: Both StockReturn acknowledged by store keeper AND HisaabSettlement recorded by accountant.
   */
  static async verifyResumeAllowed(jobId: string) {
    // 1. Check stock returns acknowledged
    const unacknowledgedReturns = await prisma.stockReturn.findFirst({
      where: {
        jobId,
        acknowledgedAt: null,
      },
    });
    if (unacknowledgedReturns) {
      throw new Error(
        "Cannot resume: There is an unacknowledged stock return pending storekeeper sign-off."
      );
    }

    // 2. Check hisaab settlement exists
    const settlement = await prisma.hisaabSettlement.findFirst({
      where: { jobId },
      orderBy: { settledAt: "desc" },
    });
    if (!settlement) {
      throw new Error(
        "Cannot resume: Mandatory hisaab settlement has not been recorded by the accountant."
      );
    }

    return true;
  }

  /**
   * Technician completes job:
   * MANDATORY RULE: Must supply quantity_actual for every line item.
   * Also accepts working execution remarks and payment collection means.
   */
  static async completeJob(
    jobId: string,
    technicianId: string,
    actualItems: { id: string; quantityActual: number }[],
    completionDetails?: {
      workingRemarks?: string;
      paymentAmount?: number;
      paymentMeans?: string; // cash, online, cheque, unmarked
      paymentNotes?: string;
      unusedReason?: string;
    }
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.status !== "InProgress") {
      throw new Error(`Cannot complete job with status '${job.status}'. Must be InProgress.`);
    }

    // Validate that all items have actual quantities provided
    for (const item of job.items) {
      const match = actualItems.find((a) => a.id === item.id);
      if (!match || match.quantityActual === null || match.quantityActual === undefined) {
        throw new Error(
          `Cannot complete: Missing actual quantity for item '${item.description}'. Actual quantities are strictly required.`
        );
      }
    }

    // Save actual quantities
    for (const item of actualItems) {
      await prisma.jobItem.update({
        where: { id: item.id },
        data: { quantityActual: item.quantityActual },
      });
    }

    // Build consolidated job remarks
    let newRemarks = job.remarks || "";
    if (completionDetails) {
      const parts: string[] = [];
      if (completionDetails.workingRemarks) {
        parts.push(`Field Work Execution: ${completionDetails.workingRemarks}`);
      }
      if (completionDetails.paymentMeans) {
        const meansLabel =
          completionDetails.paymentMeans === "unmarked"
            ? "Unmarked / Unpaid (Pending)"
            : `${completionDetails.paymentMeans.toUpperCase()} ($${completionDetails.paymentAmount || 0})`;
        parts.push(`Customer Payment: ${meansLabel}${completionDetails.paymentNotes ? ` [${completionDetails.paymentNotes}]` : ""}`);
      }
      if (completionDetails.unusedReason) {
        parts.push(`Unused Stock Reason: ${completionDetails.unusedReason}`);
      }
      if (parts.length > 0) {
        newRemarks = newRemarks ? `${newRemarks} | ${parts.join(" • ")}` : parts.join(" • ");
      }
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "CompletedPendingVerification",
        remarks: newRemarks,
      },
      include: { items: true },
    });

    await this.logStatusChange(
      jobId,
      "InProgress",
      "CompletedPendingVerification",
      technicianId,
      { actualItems, completionDetails }
    );

    return updated;
  }

  /**
   * Technician requests an item-level discount from the field
   */
  static async requestItemDiscount(
    jobId: string,
    itemId: string,
    discountRequested: number,
    reason: string,
    technicianName: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");

    const item = job.items.find((it) => it.id === itemId);
    if (!item) throw new Error("Item not found on job.");

    const cleanDesc = item.description.replace(/\s*\[Discount.*?\]/gi, "");
    const updatedDesc = `${cleanDesc} [Discount Requested: $${discountRequested} - ${reason}]`;

    await prisma.jobItem.update({
      where: { id: itemId },
      data: { description: updatedDesc },
    });

    await this.logStatusChange(jobId, job.status, job.status, technicianName, {
      action: "item_discount_requested",
      itemId,
      discountRequested,
      reason,
    });

    return await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
  }

  /**
   * Accountant grants / approves item-level discount
   */
  static async giveItemDiscount(
    jobId: string,
    itemId: string,
    discountAmount: number,
    accountantName: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");

    const item = job.items.find((it) => it.id === itemId);
    if (!item) throw new Error("Item not found on job.");

    const oldRate = item.unitRate;
    const newRate = Math.max(0, oldRate - discountAmount);
    const cleanDesc = item.description.replace(/\s*\[Discount.*?\]/gi, "");
    const updatedDesc = `${cleanDesc} [Discount Approved: -$${discountAmount}, Rate: $${oldRate} -> $${newRate}]`;

    await prisma.jobItem.update({
      where: { id: itemId },
      data: {
        unitRate: newRate,
        description: updatedDesc,
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      action: "item_discount_approved",
      itemId,
      oldRate,
      discountAmount,
      newRate,
    });

    return await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
  }

  /**
   * Accountant rejects item-level discount request
   */
  static async rejectItemDiscount(
    jobId: string,
    itemId: string,
    accountantName: string,
    reason?: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");

    const item = job.items.find((it) => it.id === itemId);
    if (!item) throw new Error("Item not found on job.");

    const cleanDesc = item.description.replace(/\s*\[Discount.*?\]/gi, "");

    await prisma.jobItem.update({
      where: { id: itemId },
      data: {
        description: cleanDesc,
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      action: "item_discount_rejected",
      itemId,
      reason: reason || "Discount request declined by accounting",
    });

    return await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
  }

  /**
   * Mid-job discount approved by accountant (Job-level)
   */
  static async applyDiscount(
    jobId: string,
    discountAmount: number,
    reason: string,
    accountantName: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) {
      throw new Error("Job is finalized and locked. Cannot apply discount.");
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        discountAmount,
        discountReason: reason,
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      discountAmount,
      reason,
      action: "discount_applied",
    });

    return updated;
  }

  /**
   * Finalize Job by Accountant:
   * Locks the job (read-only from here), generates invoice, posts revenue/AR through AccountsPostingService.
   */
  static async finalizeJob(jobId: string, accountantName: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true, customer: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.status !== "CompletedPendingVerification") {
      throw new Error(`Job must be 'CompletedPendingVerification' to finalize.`);
    }

    // Compute expected total from ACTUAL quantities only
    let revenueTotal = 0;
    for (const item of job.items) {
      const qty = item.quantityActual ?? item.quantityPlanned;
      revenueTotal += qty * item.unitRate;
    }
    const finalAmount = Math.max(0, revenueTotal - (job.discountAmount || 0));

    // Post to Accounts Posting Engine (debit AR / credit Revenue, and debit Discount if applicable)
    const arAccount = await AccountsPostingService.getAccountByCode("1100"); // Accounts Receivable
    const revAccount = await AccountsPostingService.getAccountByCode("4000"); // Service Revenue
    const discountAccount = job.discountAmount > 0 
      ? await AccountsPostingService.getAccountByCode("4100") // Discounts Allowed
      : null;

    const postingLines = [];
    if (job.discountAmount > 0 && discountAccount) {
      postingLines.push({ accountId: arAccount.id, debit: finalAmount, credit: 0 });
      postingLines.push({ accountId: discountAccount.id, debit: job.discountAmount, credit: 0 });
      postingLines.push({ accountId: revAccount.id, debit: 0, credit: revenueTotal });
    } else {
      postingLines.push({ accountId: arAccount.id, debit: finalAmount, credit: 0 });
      postingLines.push({ accountId: revAccount.id, debit: 0, credit: finalAmount });
    }

    await AccountsPostingService.post({
      memo: `Revenue recognition for Job ${job.jobNumber} (${job.customer.name})`,
      refType: "job_revenue",
      refId: job.id,
      lines: postingLines,
    });

    // Create Invoice
    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, "0")}`;
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customer.name,
        amount: finalAmount,
        status: "unpaid",
      },
    });

    // Lock job to read-only
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "Finalized",
        finalizedAt: new Date(),
      },
    });

    await this.logStatusChange(jobId, "CompletedPendingVerification", "Finalized", accountantName, {
      invoiceNumber,
      finalAmount,
    });

    return updated;
  }

  /**
   * Admin verification:
   * Checklist-gated approval (work confirmed / payment reconciled / inventory returned).
   * Once verified, automatically routes into Call Center Feedback queue!
   */
  static async verifyJob(
    jobId: string,
    adminName: string,
    checklist: { workConfirmed: boolean; paymentReconciled: boolean; inventoryReturned: boolean }
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (!checklist.workConfirmed || !checklist.paymentReconciled || !checklist.inventoryReturned) {
      throw new Error(
        "All verification checklist items (Work Confirmed, Payment Reconciled, Inventory Returned) must be confirmed to verify the job."
      );
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "Verified",
        verifiedAt: new Date(),
        verifiedChecklist: JSON.stringify(checklist),
        qualityFlag: "clean",
      },
    });

    await this.logStatusChange(jobId, job.status, "Verified", adminName, { checklist });

    return updated;
  }

  /**
   * Clear technician expense claim by accountant:
   * Updates claim to paid, creates double-entry journal entry:
   * Debit 6100 (Tech Travel & Expenses)
   * Credit 1000 (Cash in Hand) or 1010 (Bank)
   */
  static async clearExpense(
    jobId: string,
    claimId: string,
    accountantName: string,
    disbursingAccountCode: string = "1000"
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { expenseClaims: true, customer: true },
    });
    if (!job) throw new Error("Job not found");

    const claim = await prisma.jobExpenseClaim.findUnique({
      where: { id: claimId },
    });
    if (!claim) throw new Error("Expense claim not found");
    if (claim.jobId !== jobId) throw new Error("Claim does not belong to this job");
    if (claim.status === "paid") throw new Error("Expense claim is already cleared/paid");

    // 1. Mark claim as paid
    const updatedClaim = await prisma.jobExpenseClaim.update({
      where: { id: claimId },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    // 2. Double-entry posting: Debit 6100 (Tech Expenses), Credit Cash/Bank
    const expenseCostingAccount = await AccountsPostingService.getAccountByCode("6100");
    const disbursingAccount = await AccountsPostingService.getAccountByCode(disbursingAccountCode);

    if (claim.amount > 0) {
      await AccountsPostingService.post({
        memo: `Technician expense clearance for Job ${job.jobNumber}: ${claim.note}`,
        refType: "expense_reimbursement",
        refId: claim.id,
        lines: [
          { accountId: expenseCostingAccount.id, debit: claim.amount, credit: 0 },
          { accountId: disbursingAccount.id, debit: 0, credit: claim.amount },
        ],
      });
    }

    // 3. Log status change history
    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      action: "expense_cleared",
      claimId,
      amount: claim.amount,
      note: claim.note,
      disbursingAccountCode,
    });

    return updatedClaim;
  }

  /**
   * Storekeeper issues physical inventory to a job:
   * Deducts warehouse inventory, records stock ledger, posts COGS to accounts,
   * adds the item to the job's line items, and marks matching inventory request as issued.
   */
  static async issueInventory(
    jobId: string,
    productId: string,
    quantity: number,
    storekeeperName: string,
    requestId?: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found in warehouse inventory");

    const qty = Number(quantity);
    if (!qty || qty <= 0) throw new Error("Quantity must be greater than zero");

    if (product.stockQuantity < qty) {
      throw new Error(
        `Insufficient stock for '${product.name}'. Available in warehouse: ${product.stockQuantity}, Requested: ${qty}`
      );
    }

    // 1. Consume stock through InventoryService (handles ledger and COGS journal entry)
    await InventoryService.consumeStock(
      productId,
      qty,
      "job_consumption",
      requestId || jobId,
      `Issued to Job ${job.jobNumber} by ${storekeeperName}`
    );

    // 2. If an inventory request ID was supplied or exists for this item/job, update it to issued
    if (requestId) {
      await prisma.inventoryRequest.update({
        where: { id: requestId },
        data: { status: "issued" },
      });
    } else {
      // Check if there was an open request for this product name
      const matchingReq = await prisma.inventoryRequest.findFirst({
        where: {
          jobId,
          status: "pending",
          item: { contains: product.name },
        },
      });
      if (matchingReq) {
        await prisma.inventoryRequest.update({
          where: { id: matchingReq.id },
          data: { status: "issued" },
        });
      }
    }

    // 3. Add item to JobItem line items
    const newItem = await prisma.jobItem.create({
      data: {
        jobId,
        description: `${product.name} (${product.sku}) [Issued by Storekeeper]`,
        quantityPlanned: qty,
        quantityActual: qty,
        unitRate: product.unitPrice,
      },
    });

    // 4. Log status history
    await this.logStatusChange(jobId, job.status, job.status, storekeeperName, {
      action: "inventory_issued",
      productId,
      productName: product.name,
      quantity: qty,
      requestId,
    });

    return {
      success: true,
      jobItem: newItem,
      product: {
        id: product.id,
        name: product.name,
        remainingStock: product.stockQuantity - qty,
      },
    };
  }
}

