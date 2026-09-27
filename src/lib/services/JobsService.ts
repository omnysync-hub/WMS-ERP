import { prisma } from "../prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";
import { InventoryService } from "./InventoryService";
import { MobilePushService } from "./MobilePushService";

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

    // Mid-job reassignment must use reassignTechnician (creates successor job)
    const midJobStatuses = ["Accepted", "InProgress", "Paused"];
    if (
      job.assignedTechnicianId &&
      job.assignedTechnicianId !== technicianId &&
      midJobStatuses.includes(job.status)
    ) {
      throw new Error(
        "Mid-job technician change requires reassignment (creates a new linked job). Use action 'reassign'."
      );
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        assignedTechnicianId: technicianId,
        status: job.status === "Created" || !job.assignedTechnicianId ? "Assigned" : job.status,
      },
      include: { assignedTechnician: true, customer: true, assignments: true },
    });

    await prisma.jobAssignment.upsert({
      where: { jobId_technicianId: { jobId, technicianId } },
      create: {
        jobId,
        technicianId,
        role: "primary",
        status: "Assigned",
        assignedBy,
      },
      update: {
        role: "primary",
        status: "Assigned",
        assignedBy,
        acceptedAt: null,
      },
    });

    // Demote any other primary assignments on this job
    await prisma.jobAssignment.updateMany({
      where: { jobId, technicianId: { not: technicianId }, role: "primary", status: { not: "Removed" } },
      data: { role: "assistant" },
    });

    await this.logStatusChange(jobId, job.status, updated.status, assignedBy, {
      assignedTechnicianId: technicianId,
      action: "assign_technician",
    });

    try {
      await MobilePushService.sendAppRequest({
        recipientId: technicianId,
        senderName: assignedBy,
        senderRole: "dispatcher",
        type: "JOB_DISPATCH",
        title: `New Job Assigned: ${updated.jobNumber}`,
        body: `You have been assigned to ${updated.customer?.name || "Customer"} for ${updated.jobType}. Tap to review and accept.`,
        priority: "high",
        actionRequired: true,
        payload: {
          jobId: updated.id,
          jobNumber: updated.jobNumber,
          customerName: updated.customer?.name,
          customerPhone: updated.customer?.phone,
          addressText: updated.customer?.addressText,
          lat: updated.customer?.lat,
          lng: updated.customer?.lng,
          jobType: updated.jobType,
          remarks: updated.remarks,
        },
      });
    } catch (e) {
      console.error("[JobsService] Failed to dispatch mobile push for job assignment:", e);
    }

    return updated;
  }

  /** Notify technician when a job is created already assigned to them. */
  static async notifyJobAssignedIfNeeded(
    job: {
      id: string;
      jobNumber: string;
      jobType: string;
      assignedTechnicianId: string | null;
      customer?: { name?: string | null; phone?: string | null; addressText?: string | null; lat?: number | null; lng?: number | null } | null;
      remarks?: string | null;
    },
    assignedBy = "Dispatcher"
  ) {
    if (!job.assignedTechnicianId) return;
    try {
      await MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: assignedBy,
        senderRole: "dispatcher",
        type: "JOB_DISPATCH",
        title: `New Job: ${job.jobNumber}`,
        body: `Assigned to ${job.customer?.name || "customer"} - ${job.jobType}. Open the app to accept.`,
        priority: "high",
        actionRequired: true,
        payload: {
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: job.customer?.name,
          jobType: job.jobType,
        },
      });
    } catch (e) {
      console.error("[JobsService] Failed to notify on job create:", e);
    }
  }

  /**
   * Technician accepts job
   */
  static async acceptJob(jobId: string, technicianId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { assignments: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.status === "TechnicianReassigned") {
      throw new Error("This job was reassigned to another work order. Open the successor job instead.");
    }
    if (job.status !== "Assigned") {
      throw new Error(`Cannot accept job with status '${job.status}'. Must be 'Assigned'.`);
    }

    const isPrimary = job.assignedTechnicianId === technicianId;
    const assignment = (job.assignments || []).find(
      (a) => a.technicianId === technicianId && a.status !== "Removed"
    );
    if (!isPrimary && !assignment) {
      throw new Error("You are not assigned to this job.");
    }

    // Primary accept moves job to Accepted; assistant accept only updates their assignment row
    let updated = job;
    if (isPrimary || assignment?.role === "primary" || !job.assignedTechnicianId) {
      updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "Accepted",
          assignedTechnicianId: job.assignedTechnicianId || technicianId,
        },
        include: { assignments: true, assignedTechnician: true, customer: true, items: true },
      });
      await this.logStatusChange(jobId, "Assigned", "Accepted", technicianId);
    } else {
      await this.logStatusChange(jobId, job.status, job.status, technicianId, {
        action: "assistant_accepted",
        technicianId,
      });
      updated = (await prisma.job.findUnique({
        where: { id: jobId },
        include: { assignments: true, assignedTechnician: true, customer: true, items: true },
      })) as any;
    }

    await prisma.jobAssignment.upsert({
      where: { jobId_technicianId: { jobId, technicianId } },
      create: {
        jobId,
        technicianId,
        role: isPrimary || assignment?.role === "primary" ? "primary" : "assistant",
        status: "Accepted",
        assignedBy: "self-accept",
        acceptedAt: new Date(),
      },
      update: {
        status: "Accepted",
        acceptedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Batch-accept multiple Assigned jobs for one technician (mobile multi-select).
   */
  static async acceptJobs(jobIds: string[], technicianId: string) {
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      throw new Error("jobIds required");
    }
    const results: { jobId: string; ok: boolean; error?: string; job?: any }[] = [];
    for (const jobId of jobIds) {
      try {
        const job = await this.acceptJob(jobId, technicianId);
        results.push({ jobId, ok: true, job });
      } catch (e: any) {
        results.push({ jobId, ok: false, error: e?.message || "Failed" });
      }
    }
    return {
      accepted: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  /**
   * Assign multiple technicians to one job. First id (or primaryTechnicianId) becomes primary
   * and is mirrored onto Job.assignedTechnicianId for backward compatibility.
   */
  static async assignTechnicians(
    jobId: string,
    technicianIds: string[],
    assignedBy: string,
    primaryTechnicianId?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");
    if (job.status === "TechnicianReassigned") {
      throw new Error("Cannot assign technicians to a reassigned (closed) job.");
    }
    const ids = Array.from(new Set((technicianIds || []).filter(Boolean)));
    if (ids.length === 0) throw new Error("At least one technicianId is required");

    const primaryId = primaryTechnicianId && ids.includes(primaryTechnicianId) ? primaryTechnicianId : ids[0];

    // Upsert all assignments
    for (const techId of ids) {
      await prisma.jobAssignment.upsert({
        where: { jobId_technicianId: { jobId, technicianId: techId } },
        create: {
          jobId,
          technicianId: techId,
          role: techId === primaryId ? "primary" : "assistant",
          status: "Assigned",
          assignedBy,
        },
        update: {
          role: techId === primaryId ? "primary" : "assistant",
          status: "Assigned",
          assignedBy,
          acceptedAt: null,
        },
      });
    }

    // Soft-remove assignments not in the new set
    await prisma.jobAssignment.updateMany({
      where: { jobId, technicianId: { notIn: ids }, status: { not: "Removed" } },
      data: { status: "Removed" },
    });

    const nextStatus =
      job.status === "Created" || job.status === "Assigned" ? "Assigned" : job.status;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        assignedTechnicianId: primaryId,
        status: nextStatus,
      },
      include: {
        assignedTechnician: true,
        customer: true,
        assignments: { where: { status: { not: "Removed" } }, include: { technician: true } },
        items: true,
      },
    });

    await this.logStatusChange(jobId, job.status, updated.status, assignedBy, {
      action: "assign_technicians",
      technicianIds: ids,
      primaryTechnicianId: primaryId,
    });

    for (const techId of ids) {
      try {
        await MobilePushService.sendAppRequest({
          recipientId: techId,
          senderName: assignedBy,
          senderRole: "dispatcher",
          type: "JOB_DISPATCH",
          title: `Job Assigned: ${updated.jobNumber}`,
          body: `You have been assigned (${techId === primaryId ? "lead" : "assistant"}) to ${updated.customer?.name || "Customer"} — ${updated.jobType}.`,
          priority: "high",
          actionRequired: true,
          payload: {
            jobId: updated.id,
            jobNumber: updated.jobNumber,
            customerName: updated.customer?.name,
            jobType: updated.jobType,
            role: techId === primaryId ? "primary" : "assistant",
          },
        });
      } catch (e) {
        console.error("[JobsService] multi-assign push failed:", e);
      }
    }

    return updated;
  }

  /**
   * Mid-job reassignment: do NOT overwrite the old job's technician.
   * Creates a NEW job copying relevant fields/items, assigns the new tech,
   * marks the OLD job TechnicianReassigned, and links via parentJobId / reassignedFromJobId.
   */
  static async reassignTechnician(
    jobId: string,
    newTechnicianId: string,
    assignedBy: string,
    opts?: { copyItems?: boolean; notes?: string }
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true, customer: true, assignments: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");
    if (job.status === "TechnicianReassigned") {
      throw new Error("Job was already reassigned. Use the successor job.");
    }
    if (["Finalized", "Verified"].includes(job.status)) {
      throw new Error(`Cannot reassign a ${job.status} job.`);
    }
    if (!newTechnicianId) throw new Error("newTechnicianId required");
    if (job.assignedTechnicianId === newTechnicianId) {
      throw new Error("New technician is already the primary assignee.");
    }

    const copyItems = opts?.copyItems !== false;
    const count = await prisma.job.count();
    const jobNumber = `JOB-2026-${String(count + 1).padStart(4, "0")}`;

    const newJob = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          jobNumber,
          customerId: job.customerId,
          careOfPartyId: job.careOfPartyId,
          manualJobNumber: job.manualJobNumber,
          jobType: job.jobType,
          remarks: [
            job.remarks || "",
            `Reassigned from ${job.jobNumber}`,
            opts?.notes ? `Note: ${opts.notes}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
          status: "Assigned",
          assignedTechnicianId: newTechnicianId,
          parentJobId: job.id,
          reassignedFromJobId: job.id,
          discountAmount: job.discountAmount || 0,
          discountReason: job.discountReason,
          ...(copyItems && job.items.length > 0
            ? {
                items: {
                  create: job.items.map((it) => ({
                    description: it.description,
                    quantityPlanned: it.quantityPlanned,
                    quantityActual: null,
                    unitRate: it.unitRate,
                  })),
                },
              }
            : {}),
          assignments: {
            create: {
              technicianId: newTechnicianId,
              role: "primary",
              status: "Assigned",
              assignedBy,
            },
          },
        },
        include: {
          customer: true,
          assignedTechnician: true,
          items: true,
          assignments: true,
        },
      });

      await tx.job.update({
        where: { id: job.id },
        data: { status: "TechnicianReassigned" },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: "TechnicianReassigned",
          changedBy: assignedBy,
          metaJson: JSON.stringify({
            action: "technician_reassigned",
            previousTechnicianId: job.assignedTechnicianId,
            newTechnicianId,
            successorJobId: created.id,
            successorJobNumber: created.jobNumber,
            notes: opts?.notes || null,
          }),
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: created.id,
          fromStatus: "None",
          toStatus: "Assigned",
          changedBy: assignedBy,
          metaJson: JSON.stringify({
            action: "created_via_reassignment",
            parentJobId: job.id,
            parentJobNumber: job.jobNumber,
            newTechnicianId,
          }),
        },
      });

      return created;
    });

    try {
      await MobilePushService.sendAppRequest({
        recipientId: newTechnicianId,
        senderName: assignedBy,
        senderRole: "dispatcher",
        type: "JOB_DISPATCH",
        title: `Reassigned Job: ${newJob.jobNumber}`,
        body: `You received work order ${newJob.jobNumber} (from ${job.jobNumber}) for ${newJob.customer?.name || "Customer"}. Tap to accept.`,
        priority: "high",
        actionRequired: true,
        payload: {
          jobId: newJob.id,
          jobNumber: newJob.jobNumber,
          parentJobId: job.id,
          parentJobNumber: job.jobNumber,
          customerName: newJob.customer?.name,
          jobType: newJob.jobType,
          reassigned: true,
        },
      });
    } catch (e) {
      console.error("[JobsService] reassign push failed:", e);
    }

    // Notify previous tech that job moved
    if (job.assignedTechnicianId) {
      try {
        await MobilePushService.sendAppRequest({
          recipientId: job.assignedTechnicianId,
          senderName: assignedBy,
          senderRole: "dispatcher",
          type: "JOB_RESCHEDULED",
          title: `Job ${job.jobNumber} reassigned`,
          body: `Work order ${job.jobNumber} was reassigned. Historical data is preserved; successor is ${newJob.jobNumber}.`,
          priority: "normal",
          actionRequired: false,
          payload: {
            jobId: job.id,
            successorJobId: newJob.id,
            successorJobNumber: newJob.jobNumber,
          },
        });
      } catch (e) {
        console.error("[JobsService] prior-tech notify failed:", e);
      }
    }

    return {
      oldJob: await prisma.job.findUnique({
        where: { id: job.id },
        include: { assignedTechnician: true, statusHistory: { orderBy: { changedAt: "desc" }, take: 3 } },
      }),
      newJob,
    };
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
      /** Proof-of-work photos as data URLs or remote URLs */
      photos?: string[];
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
      if (completionDetails.photos?.length) {
        parts.push(`Proof photos: ${completionDetails.photos.length}`);
      }
      if (parts.length > 0) {
        newRemarks = newRemarks ? `${newRemarks} | ${parts.join(" • ")}` : parts.join(" • ");
      }
    }

    // Cap + keep only image-ish strings (data: or http) - avoid blowing the row with junk
    const photos = (completionDetails?.photos ?? [])
      .filter((p) => typeof p === "string" && /^(data:image\/|https?:\/\/)/i.test(p))
      .slice(0, 12);

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "CompletedPendingVerification",
        remarks: newRemarks,
        ...(photos.length > 0
          ? { completionPhotos: JSON.stringify(photos) }
          : {}),
      },
      include: { items: true },
    });

    // Don't re-store full base64 blobs in history meta - count only
    const { photos: _photos, ...detailsSansPhotos } = completionDetails ?? {};
    await this.logStatusChange(
      jobId,
      "InProgress",
      "CompletedPendingVerification",
      technicianId,
      {
        actualItems,
        completionDetails: {
          ...detailsSansPhotos,
          photoCount: photos.length,
        },
      }
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

    if (job.assignedTechnicianId) {
      MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: accountantName,
        senderRole: "accountant",
        type: "DISCOUNT_DECISION",
        title: `Discount Approved for Job #${job.jobNumber}`,
        body: `Item discount of PKR ${discountAmount} was approved for '${cleanDesc}'. New rate is PKR ${newRate}.`,
        priority: "normal",
        actionRequired: false,
        payload: { jobId, itemId, discountAmount, newRate },
      }).catch((e) => console.error("[JobsService] Failed to send discount push:", e));
    }

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

    if (job.assignedTechnicianId) {
      MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: accountantName,
        senderRole: "accountant",
        type: "DISCOUNT_DECISION",
        title: `Discount Request Rejected for Job #${job.jobNumber}`,
        body: `Discount request for '${cleanDesc}' was declined: ${reason || "Standard pricing applies."}`,
        priority: "normal",
        actionRequired: false,
        payload: { jobId, itemId, reason },
      }).catch((e) => console.error("[JobsService] Failed to send discount rejection push:", e));
    }

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

    if (job.assignedTechnicianId) {
      MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: accountantName,
        senderRole: "accountant",
        type: "DISCOUNT_DECISION",
        title: `Discount approved - ${job.jobNumber}`,
        body: `PKR ${discountAmount} discount applied. Reason: ${reason}`,
        priority: "high",
        payload: { jobId, discountAmount, reason },
      }).catch((e) => console.error("[JobsService] discount push failed:", e));
    }

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

    // Post to Accounts Posting Engine via central AccountMappingService
    const arAccount = await AccountMappingService.resolveAccount({
      transactionType: "job_revenue_receivable",
      categoryScope: job.jobType,
    });
    const revAccount = await AccountMappingService.resolveAccount({
      transactionType: "job_revenue_sales",
      categoryScope: job.jobType,
    });
    const discountAccount = job.discountAmount > 0 
      ? await AccountMappingService.resolveAccount({
          transactionType: "job_revenue_discount",
          categoryScope: job.jobType,
        })
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

    // LOGICS section 1: Verified only follows Finalized (accountant lock). Require both status and finalizedAt.
    if (job.status !== "Finalized" || !job.finalizedAt) {
      throw new Error(
        `Job must be Finalized before it can be verified. Current status: ${job.status}.`
      );
    }

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
   * Supports selecting payment source (Cash on Hand, Meezan Bank, HBL, Petty Cash, etc.)
   * Supports partial clearance when resources are constrained:
   *  - Disburses partial amount now and records balanced double-entry in General Ledger
   *  - Retains the remaining balance as a pending claim so it can be cleared afterwards
   *  - Or clears full claim if paying in full
   */
  static async clearExpense(
    jobId: string,
    claimId: string,
    accountantName: string,
    disbursingAccountCode?: string,
    amountToPay?: number,
    paymentNotes?: string
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

    const totalClaimAmount = claim.amount;
    const paidNow =
      amountToPay !== undefined && amountToPay !== null && Number(amountToPay) > 0
        ? Math.min(Number(amountToPay), totalClaimAmount)
        : totalClaimAmount;

    if (paidNow <= 0) {
      throw new Error("Disbursement amount must be greater than 0");
    }

    const isPartial = paidNow < totalClaimAmount;
    const remainingBalance = Math.round((totalClaimAmount - paidNow) * 100) / 100;

    // 1. Resolve Disbursing Account (Cash / Bank / Float)
    let disbursingAccount;
    try {
      if (disbursingAccountCode) {
        disbursingAccount = await AccountsPostingService.getAccountByCode(disbursingAccountCode);
      } else {
        disbursingAccount = await AccountMappingService.resolveAccount({
          transactionType: "expense_reimbursement_disbursing",
        });
      }
    } catch {
      disbursingAccount = await AccountMappingService.resolveAccount({
        transactionType: "expense_reimbursement_disbursing",
      });
    }

    const expenseCostingAccount = await AccountMappingService.resolveAccount({
      transactionType: "expense_reimbursement_expense",
    });

    let updatedClaim;
    const paymentRefLabel = paymentNotes ? ` [Ref: ${paymentNotes}]` : "";

    if (isPartial) {
      // --- PARTIAL CLEARANCE ---
      // Update the current claim record to represent the paid portion
      const originalNote = claim.note;
      updatedClaim = await prisma.jobExpenseClaim.update({
        where: { id: claimId },
        data: {
          amount: paidNow,
          status: "paid",
          paidAt: new Date(),
          note: `${originalNote} [Partially Cleared: PKR ${paidNow.toLocaleString()} via ${disbursingAccount.name} (${disbursingAccount.code})${paymentRefLabel}]`,
        },
      });

      // Create a new pending claim for the remaining unpaid balance so it can be cleared afterwards
      const remainingClaim = await prisma.jobExpenseClaim.create({
        data: {
          jobId: claim.jobId,
          technicianId: claim.technicianId,
          amount: remainingBalance,
          note: `${originalNote} [Remaining Balance after PKR ${paidNow.toLocaleString()} partial payout]`,
          receiptUrl: claim.receiptUrl,
          status: "pending",
        },
      });

      // Post balanced General Ledger journal entry for the disbursed portion
      if (paidNow > 0) {
        await AccountsPostingService.post({
          memo: `Partial technician expense payout (PKR ${paidNow.toLocaleString()} of PKR ${totalClaimAmount.toLocaleString()}) for Job ${job.jobNumber}: ${originalNote}${paymentRefLabel}`,
          refType: "expense_reimbursement",
          refId: claim.id,
          lines: [
            { accountId: expenseCostingAccount.id, debit: paidNow, credit: 0 },
            { accountId: disbursingAccount.id, debit: 0, credit: paidNow },
          ],
        });
      }

      // Log status change history
      await this.logStatusChange(jobId, job.status, job.status, accountantName, {
        action: "expense_partially_cleared",
        claimId,
        amountPaid: paidNow,
        remainingBalance,
        newRemainingClaimId: remainingClaim.id,
        disbursingAccountCode: disbursingAccount.code,
        disbursingAccountName: disbursingAccount.name,
        paymentNotes,
      });
    } else {
      // --- FULL CLEARANCE ---
      updatedClaim = await prisma.jobExpenseClaim.update({
        where: { id: claimId },
        data: {
          status: "paid",
          paidAt: new Date(),
          note: paymentRefLabel ? `${claim.note}${paymentRefLabel}` : claim.note,
        },
      });

      if (paidNow > 0) {
        await AccountsPostingService.post({
          memo: `Technician expense clearance for Job ${job.jobNumber}: ${claim.note}${paymentRefLabel}`,
          refType: "expense_reimbursement",
          refId: claim.id,
          lines: [
            { accountId: expenseCostingAccount.id, debit: paidNow, credit: 0 },
            { accountId: disbursingAccount.id, debit: 0, credit: paidNow },
          ],
        });
      }

      await this.logStatusChange(jobId, job.status, job.status, accountantName, {
        action: "expense_cleared",
        claimId,
        amount: paidNow,
        note: claim.note,
        disbursingAccountCode: disbursingAccount.code,
        disbursingAccountName: disbursingAccount.name,
        paymentNotes,
      });
    }

    return updatedClaim;
  }

  /**
   * Clear all or partial pending technician expenses for a job in one single action:
   * Displays the aggregated total expense amount to the accountant.
   * If paying in full: all pending claims on the job are cleared.
   * If paying partially: allocates the available funds across claims, splits the partially covered claim,
   * leaves the remaining balance pending to be cleared afterwards, and posts balanced GL entries.
   */
  static async clearJobExpenses(
    jobId: string,
    accountantName: string,
    disbursingAccountCode?: string,
    amountToPay?: number,
    paymentNotes?: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        expenseClaims: {
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!job) throw new Error("Job not found");

    const pendingClaims = job.expenseClaims || [];
    if (pendingClaims.length === 0) {
      throw new Error("No pending expense claims to clear on this job");
    }

    const totalPending = pendingClaims.reduce((sum, c) => sum + c.amount, 0);
    const paidNow =
      amountToPay !== undefined && amountToPay !== null && Number(amountToPay) > 0
        ? Math.min(Number(amountToPay), totalPending)
        : totalPending;

    if (paidNow <= 0) {
      throw new Error("Disbursement amount must be greater than 0");
    }

    const isPartial = paidNow < totalPending;
    const remainingBalance = Math.round((totalPending - paidNow) * 100) / 100;

    // 1. Resolve Disbursing Account (Cash / Bank / Float)
    let disbursingAccount;
    try {
      if (disbursingAccountCode) {
        disbursingAccount = await AccountsPostingService.getAccountByCode(disbursingAccountCode);
      } else {
        disbursingAccount = await AccountMappingService.resolveAccount({
          transactionType: "expense_reimbursement_disbursing",
        });
      }
    } catch {
      disbursingAccount = await AccountMappingService.resolveAccount({
        transactionType: "expense_reimbursement_disbursing",
      });
    }

    const expenseCostingAccount = await AccountMappingService.resolveAccount({
      transactionType: "expense_reimbursement_expense",
    });

    const paymentRefLabel = paymentNotes ? ` [Ref: ${paymentNotes}]` : "";

    // 2. Allocate payment across pending claims in sequence
    let remainingToAllocate = paidNow;
    const updatedClaims = [];

    for (const claim of pendingClaims) {
      if (remainingToAllocate <= 0) {
        // No more funds available in this disbursement; remains pending
        break;
      }

      if (remainingToAllocate >= claim.amount) {
        // This claim is fully covered
        const updated = await prisma.jobExpenseClaim.update({
          where: { id: claim.id },
          data: {
            status: "paid",
            paidAt: new Date(),
            note: paymentRefLabel ? `${claim.note}${paymentRefLabel}` : claim.note,
          },
        });
        updatedClaims.push(updated);
        remainingToAllocate = Math.round((remainingToAllocate - claim.amount) * 100) / 100;
      } else {
        // This claim is partially covered by the remaining allocated funds
        const partialPaid = remainingToAllocate;
        const claimRemainder = Math.round((claim.amount - partialPaid) * 100) / 100;
        const originalNote = claim.note;

        // Update the paid portion
        const updated = await prisma.jobExpenseClaim.update({
          where: { id: claim.id },
          data: {
            amount: partialPaid,
            status: "paid",
            paidAt: new Date(),
            note: `${originalNote} [Partially Cleared: PKR ${partialPaid.toLocaleString()} via ${disbursingAccount.name} (${disbursingAccount.code})${paymentRefLabel}]`,
          },
        });
        updatedClaims.push(updated);

        // Create new pending claim for the remaining balance
        await prisma.jobExpenseClaim.create({
          data: {
            jobId: claim.jobId,
            technicianId: claim.technicianId,
            amount: claimRemainder,
            note: `${originalNote} [Remaining Balance after PKR ${partialPaid.toLocaleString()} partial payout]`,
            receiptUrl: claim.receiptUrl,
            status: "pending",
          },
        });

        remainingToAllocate = 0;
      }
    }

    // 3. Post General Ledger journal entry for the exact disbursed funds
    if (paidNow > 0) {
      await AccountsPostingService.post({
        memo: `Technician field expense payout (PKR ${paidNow.toLocaleString()}${isPartial ? ` of total PKR ${totalPending.toLocaleString()}` : ""}) for Job ${job.jobNumber}${paymentRefLabel}`,
        refType: "expense_reimbursement",
        refId: job.id,
        lines: [
          { accountId: expenseCostingAccount.id, debit: paidNow, credit: 0 },
          { accountId: disbursingAccount.id, debit: 0, credit: paidNow },
        ],
      });
    }

    // 4. Log status change history
    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      action: isPartial ? "job_expenses_partially_cleared" : "job_expenses_cleared",
      amountPaid: paidNow,
      totalPending,
      remainingBalance,
      disbursingAccountCode: disbursingAccount.code,
      disbursingAccountName: disbursingAccount.name,
      paymentNotes,
    });

    return {
      success: true,
      amountPaid: paidNow,
      remainingBalance,
      isPartial,
      totalPending,
      claimsClearedCount: updatedClaims.length,
    };
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

    if (job.assignedTechnicianId) {
      MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: storekeeperName,
        senderRole: "storekeeper",
        type: "INVENTORY_ISSUED",
        title: `Parts issued - ${job.jobNumber}`,
        body: `${qty}× ${product.name} ready for your job. Check stock on the job screen.`,
        priority: "high",
        payload: {
          jobId,
          productId,
          productName: product.name,
          quantity: qty,
        },
      }).catch((e) => console.error("[JobsService] inventory push failed:", e));
    }

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

  /**
   * Accountant or Admin adds services / items to the job even after creation.
   */
  static async addJobServiceOrItem(
    jobId: string,
    description: string,
    quantity: number,
    unitRate: number,
    addedBy: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    const qty = Number(quantity);
    const rate = Number(unitRate);
    if (!qty || qty <= 0) throw new Error("Quantity must be greater than zero");

    const newItem = await prisma.jobItem.create({
      data: {
        jobId,
        description: `${description} [Service Added by ${addedBy}]`,
        quantityPlanned: qty,
        quantityActual: qty,
        unitRate: rate,
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, addedBy, {
      action: "service_added",
      itemId: newItem.id,
      description,
      quantity: qty,
      unitRate: rate,
    });

    return newItem;
  }

  /**
   * Storekeeper records stock returned by technician upon job completion or pause.
   */
  static async recordStockReturn(
    jobId: string,
    technicianId: string,
    item: string,
    qtyReturned: number,
    storekeeperName: string,
    notes?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    const qty = Number(qtyReturned);
    if (!qty || qty <= 0) throw new Error("Quantity returned must be greater than zero");

    const record = await prisma.stockReturn.create({
      data: {
        jobId,
        technicianId: technicianId || job.assignedTechnicianId || "unknown",
        item,
        qtyReturned: qty,
        acknowledgedBy: storekeeperName,
        acknowledgedAt: new Date(),
      },
    });

    // Try to find matching Product in warehouse to restock
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: item } },
          { sku: { equals: item } },
        ],
      },
    });

    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: qty } },
      });

      await prisma.stockLedger.create({
        data: {
          productId: product.id,
          qty,
          direction: "in",
          refType: "stock_return",
          refId: record.id,
          notes: `Returned from Job ${job.jobNumber} by Tech via Storekeeper ${storekeeperName}${notes ? `: ${notes}` : ""}`,
        },
      });
    }

    await this.logStatusChange(jobId, job.status, job.status, storekeeperName, {
      action: "stock_return_recorded",
      returnId: record.id,
      item,
      qtyReturned: qty,
      notes,
    });

    return record;
  }

  /**
   * Storekeeper / Supervisor records misplaced or lost items by technician.
   */
  static async recordMisplacedItem(
    jobId: string,
    technicianId: string,
    item: string,
    qtyMisplaced: number,
    reportedBy: string,
    reason?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    const qty = Number(qtyMisplaced);

    await this.logStatusChange(jobId, job.status, job.status, reportedBy, {
      action: "misplaced_item_by_technician",
      technicianId: technicianId || job.assignedTechnicianId,
      item,
      qtyMisplaced: qty,
      reason: reason || "Item misplaced/lost on site during execution",
    });

    return {
      success: true,
      message: `Recorded ${qty}x ${item} as misplaced by technician. Logged in audit trail.`,
    };
  }

  /**
   * Generate an official Invoice with custom invoice number sequence.
   */
  static async generateCustomInvoice(
    jobId: string,
    customInvoiceNumber: string,
    createdBy: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true, items: true },
    });
    if (!job) throw new Error("Job not found");

    // Compute billable total
    let total = 0;
    for (const it of job.items) {
      const q = it.quantityActual !== null && it.quantityActual !== undefined ? it.quantityActual : it.quantityPlanned;
      total += q * it.unitRate;
    }
    const net = Math.max(0, total - (job.discountAmount || 0));

    const invoiceNum = customInvoiceNumber?.trim() || `INV-${job.jobNumber}`;

    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: invoiceNum } });
    if (existing) {
      const updated = await prisma.invoice.update({
        where: { invoiceNumber: invoiceNum },
        data: {
          amount: net,
          jobId: job.id,
          customerId: job.customerId,
          customerName: job.customer.name,
        },
      });
      return updated;
    }

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum,
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customer.name,
        amount: net,
        status: "unpaid",
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, createdBy, {
      action: "custom_invoice_generated",
      invoiceNumber: invoiceNum,
      amount: net,
    });

    return created;
  }
}

