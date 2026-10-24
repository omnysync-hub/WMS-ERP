import { pktTodayStart } from "@/lib/pktTime";
import { loadExpenseCategoryAccounts } from "@/lib/expenseCategoryAccount";
import { goodsShareOfItems, jobRevenueRole } from "@/lib/jobRevenue";
import { prisma } from "../prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";
import { InventoryService } from "./InventoryService";
import { SubLedgerService } from "./SubLedgerService";
import { DocumentSequenceService } from "./DocumentSequenceService";
import { MobilePushService } from "./MobilePushService";
import { AuditService } from "./AuditService";
import { TaxSettingsService } from "../tax/TaxSettingsService";
import { computeTax, jobTaxRate } from "../tax/taxConfig";
import type { Prisma } from "@prisma/client";
import {
  JOB_REASSIGNABLE_STATUSES,
  canAddServiceOrItem,
  canChangeTechnician,
  isPreStartStatus,
  isReassignableStatus,
} from "../jobStatus";

/** Interactive transaction options: remote Postgres (Vercel) needs more than Prisma's 5s default. */
const TX_OPTS = { maxWait: 10000, timeout: 30000 } as const;

/** Settlement money-movement JE ref types (vault Dr / AR Cr and their adjustments). */
const SETTLEMENT_GL_REF_TYPES = [
  "settlement_collection",
  "settlement_handover",
  "settlement_adjustment",
];

/** Technician-declared collection not yet confirmed / GL-posted by the accountant. */
export function isFieldReportedSettlement(s: {
  status?: string | null;
  settledBy?: string | null;
  accountantReceivedAt?: Date | string | null;
}): boolean {
  if (s.status === "field_reported") return true;
  // Legacy rows (before the status column) created by completeJob
  return (
    (s.status === undefined || s.status === null || s.status === "posted") &&
    /\(field app/i.test(s.settledBy || "") &&
    !s.accountantReceivedAt
  );
}

export class JobsService {
  /**
   * Log transition immutably to JobStatusHistory and persist an audit rollback snapshot.
   */
  static async logStatusChange(
    jobId: string,
    fromStatus: string,
    toStatus: string,
    changedBy: string,
    meta?: Record<string, any>
  ) {
    const history = await prisma.jobStatusHistory.create({
      data: {
        jobId,
        fromStatus,
        toStatus,
        changedBy,
        metaJson: meta ? JSON.stringify(meta) : null,
      },
    });

    // Automatically record to Audit Trail & Reversible Rollback Engine
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          jobNumber: true,
          assignedTechnicianId: true,
          discountAmount: true,
          discountReason: true,
          finalizedAt: true,
          verifiedAt: true,
          qualityFlag: true,
          remarks: true,
        },
      });

      if (job) {
        await AuditService.recordCrudAction({
          actorName: changedBy || "System",
          actorRole: "user",
          entityType: "Job",
          entityId: jobId,
          entityNumber: job.jobNumber,
          actionType: "STATUS_CHANGE",
          description: `Work Order ${job.jobNumber} status transition: ${fromStatus} → ${toStatus}${
            meta?.action ? ` (${meta.action})` : ""
          }`,
          stateBefore: {
            status: fromStatus,
            assignedTechnicianId: meta?.previousTechnicianId || job.assignedTechnicianId,
            discountAmount: job.discountAmount,
            discountReason: job.discountReason,
            qualityFlag: job.qualityFlag,
            meta,
          },
          stateAfter: {
            status: toStatus,
            assignedTechnicianId: meta?.assignedTechnicianId || job.assignedTechnicianId,
            discountAmount: job.discountAmount,
            discountReason: job.discountReason,
            qualityFlag: job.qualityFlag,
            meta,
          },
          metadata: meta,
          canRollback: true,
        });
      }
    } catch (err) {
      console.error("[JobsService] Failed recording audit rollback for status change:", err);
    }

    return history;
  }

  /**
   * Transition job to Assigned
   */
  /**
   * Verify that technician(s) are checked in today (present) and not checked out / off duty.
   */
  static async assertTechniciansCheckedIn(technicianIds: string[]) {
    const ids = Array.from(new Set(technicianIds.filter(Boolean)));
    if (ids.length === 0) return;

    // "Today" is the Pakistan calendar day (server clock is UTC).
    const startOfToday = pktTodayStart();

    const employees = await prisma.employee.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        attendanceLogs: {
          where: { timestamp: { gte: startOfToday } },
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    const found = new Set(employees.map((e) => e.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new Error(`Cannot assign job: technician not found (${missing.join(", ")}).`);
    }

    for (const emp of employees) {
      const latestPunch = emp.attendanceLogs[0];
      const isCheckedIn = latestPunch ? !latestPunch.notes?.includes("[CHECK_OUT]") : false;
      if (!isCheckedIn) {
        throw new Error(
          `Cannot assign job: Technician "${emp.name}" is off duty and has not checked in today. Only present technicians can be assigned to jobs.`
        );
      }
    }
  }

  static async assignTechnician(jobId: string, technicianId: string, assignedBy: string) {
    await this.assertTechniciansCheckedIn([technicianId]);
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (job.finalizedAt) {
      throw new Error("Job is finalized and locked. Edits are rejected.");
    }
    if (!canChangeTechnician(job)) {
      throw new Error(
        `Cannot assign a technician to a job in status '${job.status}'. Assignment is only allowed before start (Created/Assigned) or via reassign mid-job (${JOB_REASSIGNABLE_STATUSES.join("/")}).`
      );
    }

    // If a technician is already assigned and is being changed to a new technician:
    // Create a new successor job for the new technician, and end the old job with intact history
    if (job.assignedTechnicianId && job.assignedTechnicianId !== technicianId) {
      return await this.reassignTechnician(jobId, technicianId, assignedBy, {
        copyItems: true,
        notes: `Technician changed by ${assignedBy}`,
      });
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
        title: `New job — ${updated.jobNumber}`,
        body: `${updated.customer?.name || "Customer"} · ${updated.jobType}. Tap to accept.`,
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
        title: `New job — ${job.jobNumber}`,
        body: `${job.customer?.name || "Customer"} · ${job.jobType}. Tap to accept.`,
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
    if (!canChangeTechnician(job)) {
      throw new Error(
        `Cannot change technicians on a job in status '${job.status}'. Allowed before start (Created/Assigned) or mid-job (${JOB_REASSIGNABLE_STATUSES.join("/")}).`
      );
    }
    const ids = Array.from(new Set((technicianIds || []).filter(Boolean)));
    if (ids.length === 0) throw new Error("At least one technicianId is required");
    await this.assertTechniciansCheckedIn(ids);

    const primaryId = primaryTechnicianId && ids.includes(primaryTechnicianId) ? primaryTechnicianId : ids[0];
    // If primary technician is already assigned and is being changed to another technician:
    // Create a new successor job for the new crew, and end the old job with intact history
    if (job.assignedTechnicianId && primaryId !== job.assignedTechnicianId) {
      const assistantIds = ids.filter((id) => id !== primaryId);
      return await this.reassignTechnician(jobId, primaryId, assignedBy, {
        copyItems: true,
        notes: `Technicians changed by ${assignedBy}`,
        assistantTechnicianIds: assistantIds,
      });
    }

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
          title: `New job — ${updated.jobNumber}`,
          body: `${updated.customer?.name || "Customer"} · ${updated.jobType} (${techId === primaryId ? "lead" : "helper"}). Tap to accept.`,
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
    opts?: {
      copyItems?: boolean;
      notes?: string;
      assistantTechnicianIds?: string[];
    }
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
    if (!isReassignableStatus(job.status)) {
      throw new Error(`Cannot reassign a job in status '${job.status}'. Reassignment is only permitted while the job is active.`);
    }
    if (!newTechnicianId) throw new Error("newTechnicianId required");
    await this.assertTechniciansCheckedIn([newTechnicianId, ...(opts?.assistantTechnicianIds || [])]);
    if (job.assignedTechnicianId === newTechnicianId) {
      throw new Error("New technician is already the primary assignee.");
    }

    const copyItems = opts?.copyItems !== false;
    const count = await prisma.job.count();
    let jobNumber = `JOB-2026-${String(count + 1).padStart(4, "0")}`;
    let collision = await prisma.job.findUnique({ where: { jobNumber } });
    let attempts = 1;
    while (collision) {
      jobNumber = `JOB-2026-${String(count + 1 + attempts).padStart(4, "0")}`;
      collision = await prisma.job.findUnique({ where: { jobNumber } });
      attempts++;
    }

    const newJob = await prisma.$transaction(async (tx) => {
      const assistantIds = (opts?.assistantTechnicianIds || []).filter(
        (id: string) => id && id !== newTechnicianId
      );

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
            create: [
              {
                technicianId: newTechnicianId,
                role: "primary",
                status: "Assigned",
                assignedBy,
              },
              ...assistantIds.map((astId: string) => ({
                technicianId: astId,
                role: "assistant",
                status: "Assigned",
                assignedBy,
              })),
            ],
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
        title: `New job — ${newJob.jobNumber}`,
        body: `${newJob.customer?.name || "Customer"} · reassigned from ${job.jobNumber}. Tap to accept.`,
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
          title: `Job moved — ${job.jobNumber}`,
          body: `This job was given to someone else. New job is ${newJob.jobNumber}.`,
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
   * Save the quantity consumed on site while work is still in progress.
   * Consumption may exceed the originally issued quantity: this is retained as
   * an auditable over-consumption instead of silently capping the technician.
   */
  static async updateItemUsage(
    jobId: string,
    itemId: string,
    quantityActual: number,
    technicianName: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.status !== "InProgress") {
      throw new Error("Used quantity can only be updated while the job is in progress.");
    }

    const item = job.items.find((row) => row.id === itemId);
    if (!item) throw new Error("Item not found on this job.");

    const quantity = Number(quantityActual);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error("Used quantity must be a valid non-negative number.");
    }

    const updated = await prisma.jobItem.update({
      where: { id: itemId },
      data: { quantityActual: quantity },
    });

    await this.logStatusChange(jobId, job.status, job.status, technicianName, {
      action: "item_usage_updated",
      itemId,
      issuedQuantity: item.quantityPlanned,
      usedQuantity: quantity,
      overConsumedQuantity: Math.max(0, quantity - Number(item.quantityPlanned || 0)),
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
   * Resume gate from Paused state:
   * Enforces that any outstanding stock returns have been acknowledged by storekeeper,
   * and accountant hisaab settlement has been recorded.
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
      /** Prefer employee UUID when available (mobile app). */
      technicianEmployeeId?: string;
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

    // Validate that all items have actual quantities provided and non-negative
    for (const item of job.items) {
      const match = actualItems.find((a) => a.id === item.id);
      if (!match || match.quantityActual === null || match.quantityActual === undefined) {
        throw new Error(
          `Cannot complete: Missing actual quantity for item '${item.description}'. Actual quantities are strictly required.`
        );
      }
      const actualQuantity = Number(match.quantityActual);
      if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
        throw new Error(
          `Cannot complete: Actual quantity for item '${item.description}' must be a valid non-negative number.`
        );
      }
    }

    if (completionDetails?.paymentAmount !== undefined && completionDetails.paymentAmount !== null) {
      const paymentAmount = Number(completionDetails.paymentAmount);
      if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
        throw new Error("Cannot complete: Collected payment amount must be a valid non-negative number.");
      }
    }

    const allowedPaymentMeans = new Set(["cash", "online", "cheque", "unmarked"]);
    if (completionDetails?.paymentMeans && !allowedPaymentMeans.has(completionDetails.paymentMeans)) {
      throw new Error("Cannot complete: Payment means must be cash, online, cheque, or unmarked.");
    }

    // FOC jobs and office-collected jobs: the technician must not take any money.
    const technicianCollects = JobsService.technicianCollectsPayment(job);
    if (!technicianCollects) {
      const attempted =
        completionDetails?.paymentMeans && completionDetails.paymentMeans !== "unmarked"
          ? Number(completionDetails?.paymentAmount) || 0
          : 0;
      if (attempted > 0) {
        throw new Error(
          job.isFoc
            ? "Cannot complete: this is a Free-of-Charge (FOC) job. No payment should be collected from the customer."
            : "Cannot complete: payment for this job is collected by the office/accounts. Do not collect cash — submit with no payment."
        );
      }
    }

    // Proof-of-work photos are mandatory (server-side; mobile no longer offers "Finish without")
    // Cap + keep only image-ish strings (data: or http) - avoid blowing the row with junk
    const photos = (completionDetails?.photos ?? [])
      .filter((p) => typeof p === "string" && /^(data:image\/|https?:\/\/)/i.test(p))
      .slice(0, 4);
    if (photos.length === 0) {
      throw new Error(
        "Cannot complete: at least one proof-of-work photo is required (data:image/... or https URL)."
      );
    }
    if (photos.some((photo) => photo.startsWith("data:image/") && photo.length > 2_700_000)) {
      throw new Error("Cannot complete: each proof photo must be smaller than 2 MB.");
    }
    if (photos.reduce((sum, photo) => sum + photo.length, 0) > 8_000_000) {
      throw new Error("Cannot complete: proof photos are too large together. Remove one and retry.");
    }

    // Build consolidated job remarks
    let newRemarks = job.remarks || "";
    if (completionDetails) {
      const parts: string[] = [];
      if (completionDetails.workingRemarks) {
        parts.push(`Field Work Execution: ${completionDetails.workingRemarks}`);
      }
      if (!technicianCollects) {
        parts.push(
          `Customer Payment: Not collected by technician (${job.isFoc ? "FOC job" : "office/accounts collection"})`
        );
      } else if (completionDetails.paymentMeans) {
        const meansLabel =
          completionDetails.paymentMeans === "unmarked"
            ? "Unmarked / Unpaid (Pending)"
            : `${completionDetails.paymentMeans.toUpperCase()} (PKR ${completionDetails.paymentAmount || 0})`;
        parts.push(`Customer Payment: ${meansLabel}${completionDetails.paymentNotes ? ` [${completionDetails.paymentNotes}]` : ""}`);
      }
      if (completionDetails.unusedReason) {
        parts.push(`Unused Stock Reason: ${completionDetails.unusedReason}`);
      }
      parts.push(`Proof photos: ${photos.length}`);
      if (parts.length > 0) {
        newRemarks = newRemarks ? `${newRemarks} | ${parts.join(" • ")}` : parts.join(" • ");
      }
    }

    const means = completionDetails?.paymentMeans;
    const collected =
      technicianCollects && means && means !== "unmarked" ? Number(completionDetails?.paymentAmount) || 0 : 0;

    await prisma.$transaction(async (tx) => {
      // Status guard: only one completion wins (double-tap / offline replay safe)
      const claimed = await tx.job.updateMany({
        where: { id: jobId, status: "InProgress" },
        data: {
          status: "CompletedPendingVerification",
          remarks: newRemarks,
          completionPhotos: JSON.stringify(photos),
        },
      });
      if (claimed.count === 0) {
        throw new Error("Job is no longer InProgress (already completed or changed). Refresh and retry.");
      }

      // Save actual quantities — services maintain planned quantity
      for (const item of actualItems) {
        const row = job.items.find((i) => i.id === item.id);
        if (!row) continue;
        const isService =
          /\[Service/i.test(row.description) || /\[Service Added by/i.test(row.description);
        await tx.jobItem.update({
          where: { id: item.id },
          data: { quantityActual: isService ? (row.quantityPlanned || 1) : Math.max(0, Number(item.quantityActual) || 0) },
        });
      }

      // Field collection → FIELD-REPORTED settlement only (no GL). The accountant hisaab POST /
      // cash handover confirms it, posts GL once and updates this same row (never a 2nd settlement).
      if (collected > 0) {
        const techId =
          completionDetails?.technicianEmployeeId || job.assignedTechnicianId || "";
        if (techId) {
          const items = await tx.jobItem.findMany({ where: { jobId } });
          // Amount due = lines - discount (+ sales tax when Settings > Taxes charges it on jobs)
          const t = JobsService.computeJobTotals({ items, discountAmount: job.discountAmount });
          const expected = (await TaxSettingsService.forJob(job, t.gross, t.discount, tx)).total;

          await tx.hisaabSettlement.create({
            data: {
              jobId,
              technicianId: techId,
              amountExpected: expected,
              amountCollected: collected,
              isFull: collected >= expected,
              balanceDue: Math.max(0, expected - collected),
              settledBy: `${technicianId} (field app · ${means})`,
              status: "field_reported",
            },
          });
        }
      }
    }, TX_OPTS);

    // Don't re-store full base64 blobs in history meta - count only
    const { photos: _photos, ...detailsSansPhotos } = completionDetails ?? {};
    await this.logStatusChange(
      jobId,
      "InProgress",
      "AwaitingFeedback",
      technicianId,
      {
        actualItems,
        completionDetails: {
          ...detailsSansPhotos,
          photoCount: photos.length,
          fieldCollectionLogged: collected > 0,
        },
      }
    );

    return prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true, hisaabSettlements: true },
    });
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

    const discount = Number(discountAmount);
    if (!Number.isFinite(discount) || discount <= 0) {
      throw new Error("Discount amount must be a positive number.");
    }
    const oldRate = item.unitRate;
    if (discount > oldRate) {
      throw new Error(`Discount amount ($${discount}) cannot exceed the item rate ($${oldRate}).`);
    }
    const newRate = Math.round((oldRate - discount) * 100) / 100;
    const cleanDesc = item.description
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
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
        title: `Discount approved — ${job.jobNumber}`,
        body: `${cleanDesc || "Item"}: PKR ${discountAmount} off. New price PKR ${newRate}.`,
        priority: "high",
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

    const cleanDesc = item.description
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

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
        title: `Discount declined — ${job.jobNumber}`,
        body: `${cleanDesc || "Item"} — ${reason || "office kept the normal price."}`,
        priority: "high",
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
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) {
      throw new Error("Job is finalized and locked. Cannot apply discount.");
    }

    const discount = Number(discountAmount);
    if (!Number.isFinite(discount) || discount < 0) {
      throw new Error("Discount amount must be a non-negative number.");
    }
    const { gross } = this.computeJobTotals(job);
    if (discount > gross) {
      throw new Error(`Discount amount ($${discount}) cannot exceed the gross total ($${gross}) of this job.`);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        discountAmount: discount,
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
        title: `Discount approved — ${job.jobNumber}`,
        body: `PKR ${discountAmount} off this job. ${reason}`,
        priority: "high",
        payload: { jobId, discountAmount, reason },
      }).catch((e) => console.error("[JobsService] discount push failed:", e));
    }

    return updated;
  }


  /** Technician collects from the customer only for normal (non-FOC) technician-collection jobs. */
  static technicianCollectsPayment(job: { isFoc?: boolean | null; paymentCollectionMode?: string | null }) {
    return !job.isFoc && (job.paymentCollectionMode || "technician") !== "office";
  }

  /**
   * Billing options: FOC flag (job referred by an external company) / reason and payment collection mode.
   * Caller (route) enforces jobs.edit_job, and jobs.approve_foc whenever the FOC flag changes.
   */
  static async setBillingOptions(
    jobId: string,
    opts: {
      isFoc?: boolean;
      focReason?: string;
      careOfPartyId?: string | null;
      paymentCollectionMode?: string;
    },
    actorName: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { hisaabSettlements: true } });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt || ["Finalized", "Verified", "Cancelled", "TechnicianReassigned"].includes(job.status)) {
      throw new Error("Job is finalized/closed. Billing options can no longer be changed.");
    }

    const nextIsFoc = opts.isFoc ?? job.isFoc;
    const nextCareOf = opts.careOfPartyId !== undefined ? opts.careOfPartyId || null : job.careOfPartyId;
    const nextMode = opts.paymentCollectionMode ?? job.paymentCollectionMode ?? "technician";
    if (!["technician", "office"].includes(nextMode)) {
      throw new Error("paymentCollectionMode must be 'technician' or 'office'.");
    }
    if (nextIsFoc && !nextCareOf) {
      throw new Error("An FOC job must be linked to the referring company (Care-Of party).");
    }
    if (nextCareOf && nextCareOf !== job.careOfPartyId) {
      const party = await prisma.careOfParty.findUnique({ where: { id: nextCareOf }, select: { id: true } });
      if (!party) throw new Error("Referring company (Care-Of party) not found.");
    }
    const focChanged = nextIsFoc !== job.isFoc;
    const reason = (opts.focReason ?? "").trim();
    if (focChanged && nextIsFoc && reason.length < 3) {
      throw new Error("A reason is required to mark a job as FOC.");
    }
    if (focChanged && !nextIsFoc && (job.focAmountReceived || 0) > 0) {
      throw new Error("A company payment is already recorded on this FOC job; it cannot be un-marked.");
    }

    // Technician already reported collecting cash: can't switch to a no-collection mode silently.
    const techCollectsNext = !nextIsFoc && nextMode !== "office";
    if (!techCollectsNext) {
      const reported = job.hisaabSettlements.filter((h) => (h.amountCollected || 0) > 0);
      if (reported.length > 0) {
        throw new Error(
          "The technician has already reported a field collection for this job. Settle/clear it in hisaab before switching to FOC or office collection."
        );
      }
    }

    const now = new Date();
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        isFoc: nextIsFoc,
        careOfPartyId: nextCareOf,
        paymentCollectionMode: nextMode,
        ...(focChanged ? { focReason: reason || null, focApprovedBy: actorName, focApprovedAt: now } : {}),
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, actorName, {
      action: "billing_options_changed",
      before: { isFoc: job.isFoc, careOfPartyId: job.careOfPartyId, paymentCollectionMode: job.paymentCollectionMode },
      after: { isFoc: nextIsFoc, careOfPartyId: nextCareOf, paymentCollectionMode: nextMode },
      reason: reason || undefined,
    });

    if (job.assignedTechnicianId && (focChanged || nextMode !== job.paymentCollectionMode)) {
      MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: actorName,
        senderRole: "office",
        type: "GENERAL_MESSAGE",
        title: `Billing updated — ${job.jobNumber}`,
        body: techCollectsNext
          ? "Collect payment from the customer as usual."
          : nextIsFoc
            ? "This job is FOC (referred by a company). Do not collect any payment from the customer."
            : "Office will collect payment for this job. Do not collect cash.",
        priority: "high",
        actionRequired: false,
        payload: { jobId, isFoc: nextIsFoc, paymentCollectionMode: nextMode },
      }).catch((e) => console.error("[JobsService] billing push failed:", e));
    }

    return updated;
  }

  /**
   * Accountant records the referring company's payment for an FOC job (amount only known now).
   * Receipt-time revenue recognition: Dr Cash/Bank, Cr Job Revenue (job_revenue_sales).
   * Legacy FOC jobs whose finalize already booked revenue + AR (old company-billed behaviour):
   * Cr AR (job_revenue_receivable) instead, so revenue is never double counted.
   * Caller enforces accounts.general_ledger or jobs.approve_foc.
   */
  static async recordFocPayment(
    jobId: string,
    input: {
      amount: number;
      receivingAccountCode?: string | null;
      receivedDate?: string | Date | null;
      reference?: string | null;
      notes?: string | null;
      paymentMethod?: string | null;
    },
    actorName: string
  ) {
    const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero.");
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { careOfParty: true, customer: true } });
    if (!job) throw new Error("Job not found");
    if (!job.isFoc) throw new Error("This is not an FOC job. Use the normal customer receipt instead.");
    if (["Cancelled", "TechnicianReassigned"].includes(job.status)) {
      throw new Error(`Job is ${job.status}; FOC payment cannot be recorded on it.`);
    }
    const receivedAt = input.receivedDate ? new Date(input.receivedDate) : new Date();
    if (Number.isNaN(receivedAt.getTime())) throw new Error("Invalid payment date.");
    if (receivedAt.getTime() > Date.now() + 24 * 3600 * 1000) throw new Error("Payment date cannot be in the future.");
    const reference = (input.reference || "").trim();
    const company = job.careOfParty?.companyName || "Referring company";
    const method = (input.paymentMethod || "bank_transfer").toString();

    // Settings > Taxes "tax FOC company payments": the payment is treated as tax-inclusive.
    const { rates: taxRates, policy: taxPolicy } = await TaxSettingsService.load();
    const focRate = taxPolicy.jobs.taxFocPayments
      ? jobTaxRate(taxPolicy, taxRates, { jobType: job.jobType, careOfPartyId: job.careOfPartyId, customerTaxExempt: false, isFoc: false }, receivedAt)
      : null;
    const focTax = focRate
      ? computeTax({ gross: amount, ratePercent: focRate.rate, inclusive: true, applyAfterDiscount: true, rounding: taxPolicy.rounding }).tax
      : 0;
    const focTaxAccount = focRate && focTax > 0 ? await TaxSettingsService.accountFor(focRate, "sales_tax_payable") : null;

    return prisma.$transaction(async (tx) => {
      const cashAcc = input.receivingAccountCode
        ? await AccountsPostingService.getCashBankAccountByCode(String(input.receivingAccountCode), tx)
        : await AccountMappingService.resolveAccount({ transactionType: "customer_payment_receiving", prismaClient: tx });
      // Care-of companies live inside 1100 AR (sub-ledger by party). The payment first clears what
      // this job still owes in AR (booked at finalize); anything above that is extra revenue.
      const arAcc = await AccountMappingService.resolveAccount({ transactionType: "job_revenue_receivable", prismaClient: tx });
      const party = job.careOfPartyId
        ? { partyType: "care_of", partyId: job.careOfPartyId }
        : { partyType: "customer", partyId: job.customerId };
      const arLines = await tx.journalLine.findMany({
        where: {
          accountId: arAcc.id,
          journalEntry: { refId: job.id, refType: { in: ["job_revenue", "foc_payment"] }, status: "posted" },
        },
        select: { debit: true, credit: true },
      });
      const outstanding = Math.max(0, Math.round(arLines.reduce((a, l) => a + l.debit - l.credit, 0) * 100) / 100);
      const toAr = Math.min(amount, outstanding);
      const extra = Math.round((amount - toAr) * 100) / 100;
      const extraTax = extra > 0 && focTaxAccount && focRate
        ? computeTax({ gross: extra, ratePercent: focRate.rate, inclusive: true, applyAfterDiscount: true, rounding: taxPolicy.rounding }).tax
        : 0;
      const revAcc = extra > 0
        ? await AccountMappingService.resolveAccount({ transactionType: jobRevenueRole(job.jobType), prismaClient: tx })
        : null;
      const legacyRevenue = toAr > 0 ? 1 : 0;

      const journal = await AccountsPostingService.post({
        date: receivedAt,
        memo: `FOC payment from ${company} for Job ${job.jobNumber}${reference ? ` (ref ${reference})` : ""} via ${method.toUpperCase()}${input.notes ? ` — ${input.notes}` : ""}`,
        refType: "foc_payment",
        refId: job.id,
        postedBy: actorName,
        lines: [
          { accountId: cashAcc.id, debit: amount, credit: 0 },
          ...(toAr > 0 ? [{ accountId: arAcc.id, debit: 0, credit: toAr, ...party }] : []),
          ...(revAcc && extra > 0 ? [{ accountId: revAcc.id, debit: 0, credit: Math.round((extra - extraTax) * 100) / 100 }] : []),
          ...(focTaxAccount && extraTax > 0 ? [{ accountId: focTaxAccount.id, debit: 0, credit: extraTax }] : []),
        ],
        tx,
      });

      const totalReceived = Math.round(((job.focAmountReceived || 0) + amount) * 100) / 100;
      await tx.job.update({
        where: { id: job.id },
        data: {
          focAmountReceived: totalReceived,
          focPaymentReceivedAt: receivedAt,
          focPaymentRef: reference || job.focPaymentRef,
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: job.status,
          changedBy: actorName,
          metaJson: JSON.stringify({
            action: "foc_payment_recorded",
            company,
            careOfPartyId: job.careOfPartyId,
            amount,
            totalReceived,
            receivedAt: receivedAt.toISOString(),
            reference: reference || null,
            paymentMethod: method,
            receivingAccount: cashAcc.code,
            creditedTo: extra > 0 ? (toAr > 0 ? `receivable ${toAr} + revenue ${extra}` : "revenue") : "receivable (care-of AR)",
            journalEntryId: journal.id,
          }),
        },
      });

      return { journal, totalReceived, creditedTo: legacyRevenue > 0 ? "receivable" : "revenue", clearedReceivable: toAr, extraRevenue: extra };
    }, TX_OPTS);
  }

  // ------------------------------------------------------------------
  // Technician discount requests (percent / fixed) -> approval workflow
  // ------------------------------------------------------------------

  private static discountBase(
    job: { items: { id: string; quantityActual: number | null; quantityPlanned: number; unitRate: number }[]; discountAmount?: number | null },
    itemId?: string | null
  ) {
    const { gross, net } = this.computeJobTotals(job);
    if (itemId) {
      const it = job.items.find((i) => i.id === itemId);
      if (!it) throw new Error("Item not found on job.");
      const lineGross = Math.round((it.quantityActual ?? it.quantityPlanned) * it.unitRate * 100) / 100;
      return { base: lineGross, gross, net };
    }
    return { base: gross, gross, net };
  }

  /** PKR amount for a percent/fixed discount, validated against limits. */
  static computeRequestedDiscount(
    discountType: string,
    discountValue: number,
    base: number,
    netRemaining: number
  ) {
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Discount value must be greater than zero.");
    let amount: number;
    if (discountType === "percent") {
      if (value > 100) throw new Error("Discount percentage must be between 0 and 100.");
      amount = (base * value) / 100;
    } else if (discountType === "amount") {
      if (value > base + 0.005) {
        throw new Error(`Discount (PKR ${value}) cannot exceed the amount it applies to (PKR ${base}).`);
      }
      amount = value;
    } else {
      throw new Error("discountType must be 'percent' or 'amount'.");
    }
    amount = Math.round(amount * 100) / 100;
    if (amount > netRemaining + 0.005) {
      throw new Error(
        `Discount (PKR ${amount}) exceeds the remaining amount due on this job (PKR ${netRemaining}).`
      );
    }
    if (amount <= 0) throw new Error("Computed discount is zero — nothing to request.");
    return amount;
  }

  static async requestJobDiscount(
    jobId: string,
    input: { discountType: string; discountValue: number; reason: string; itemId?: string | null; technicianId?: string | null },
    actorName: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { items: true } });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt || ["Finalized", "Verified", "Cancelled", "TechnicianReassigned"].includes(job.status)) {
      throw new Error("Job is finalized/closed. Discounts can no longer be requested.");
    }
    if (!["Accepted", "InProgress", "Paused", "AwaitingFeedback", "CompletedPendingVerification"].includes(job.status)) {
      throw new Error(`Discounts cannot be requested while the job is '${job.status}'.`);
    }
    if (job.isFoc) throw new Error("This is a Free-of-Charge job — there is nothing to discount.");
    const reason = (input.reason || "").trim();
    if (reason.length < 3) throw new Error("Please give a reason for the discount.");

    const pending = await prisma.jobDiscountRequest.findFirst({ where: { jobId, status: "pending" } });
    if (pending) throw new Error("A discount request is already pending for this job. Wait for the office decision.");

    const { base, net } = this.discountBase(job, input.itemId);
    const amount = this.computeRequestedDiscount(input.discountType, Number(input.discountValue), base, net);

    const request = await prisma.jobDiscountRequest.create({
      data: {
        jobId,
        itemId: input.itemId || null,
        discountType: input.discountType,
        discountValue: Number(input.discountValue),
        requestedAmount: amount,
        reason,
        status: "pending",
        requestedById: input.technicianId || null,
        requestedByName: actorName,
      },
    });

    await this.logStatusChange(jobId, job.status, job.status, actorName, {
      action: "discount_requested",
      requestId: request.id,
      itemId: input.itemId || null,
      discountType: input.discountType,
      discountValue: Number(input.discountValue),
      requestedAmount: amount,
      reason,
    });

    return request;
  }

  static async decideDiscountRequest(
    jobId: string,
    requestId: string,
    decision: "approve" | "reject",
    actorName: string,
    opts?: { note?: string; overrideAmount?: number | null }
  ) {
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.jobDiscountRequest.findUnique({ where: { id: requestId } });
      if (!request || request.jobId !== jobId) throw new Error("Discount request not found for this job.");
      if (request.status !== "pending") throw new Error(`Discount request is already ${request.status}.`);
      const job = await tx.job.findUnique({ where: { id: jobId }, include: { items: true } });
      if (!job) throw new Error("Job not found");
      if (job.finalizedAt) throw new Error("Job is finalized and locked.");

      if (decision === "reject") {
        const claimed = await tx.jobDiscountRequest.updateMany({
          where: { id: requestId, status: "pending" },
          data: { status: "rejected", decidedBy: actorName, decidedAt: now, decisionNote: opts?.note || null },
        });
        if (claimed.count === 0) throw new Error("Discount request was already decided.");
        return { job, request, amount: 0 };
      }

      const { base, net } = this.discountBase(job, request.itemId);
      let amount: number;
      if (opts?.overrideAmount !== undefined && opts?.overrideAmount !== null && String(opts.overrideAmount) !== "") {
        amount = this.computeRequestedDiscount("amount", Number(opts.overrideAmount), base, net);
      } else {
        amount = this.computeRequestedDiscount(request.discountType, request.discountValue, base, net);
      }

      const claimed = await tx.jobDiscountRequest.updateMany({
        where: { id: requestId, status: "pending" },
        data: {
          status: "approved",
          approvedAmount: amount,
          decidedBy: actorName,
          decidedAt: now,
          decisionNote: opts?.note || null,
        },
      });
      if (claimed.count === 0) throw new Error("Discount request was already decided.");

      const label =
        request.discountType === "percent" ? `${request.discountValue}%` : `PKR ${request.discountValue}`;
      const newDiscount = Math.round(((job.discountAmount || 0) + amount) * 100) / 100;
      const reasonText = `${label} (PKR ${amount}) — ${request.reason}`;
      await tx.job.update({
        where: { id: jobId },
        data: {
          discountAmount: newDiscount,
          discountReason: job.discountReason ? `${job.discountReason}; ${reasonText}` : reasonText,
        },
      });
      return { job, request, amount };
    }, TX_OPTS);

    const { job, request, amount } = result;
    const updatedJob = await prisma.job.findUnique({ where: { id: jobId }, include: { items: true } });
    const net = updatedJob ? this.computeJobTotals(updatedJob).net : 0;

    await this.logStatusChange(jobId, job.status, job.status, actorName, {
      action: decision === "approve" ? "discount_request_approved" : "discount_request_rejected",
      requestId,
      discountType: request.discountType,
      discountValue: request.discountValue,
      requestedAmount: request.requestedAmount,
      approvedAmount: decision === "approve" ? amount : undefined,
      note: opts?.note || undefined,
      newNetTotal: net,
    });

    const techId = request.requestedById || job.assignedTechnicianId;
    if (techId) {
      MobilePushService.sendAppRequest({
        recipientId: techId,
        senderName: actorName,
        senderRole: "office",
        type: "DISCOUNT_DECISION",
        title: `Discount ${decision === "approve" ? "approved" : "declined"} — ${job.jobNumber}`,
        body:
          decision === "approve"
            ? `PKR ${amount} off. New amount due PKR ${net}.`
            : `Request declined${opts?.note ? `: ${opts.note}` : ""}. Amount due stays PKR ${net}.`,
        priority: "high",
        actionRequired: false,
        payload: { jobId, requestId, decision, approvedAmount: amount, amountDue: net },
      }).catch((e) => console.error("[JobsService] discount decision push failed:", e));
    }

    return prisma.jobDiscountRequest.findUnique({ where: { id: requestId } });
  }

  /** Billable totals from ACTUAL quantities (planned as fallback) minus job-level discount. */
  static computeJobTotals(job: {
    items: { quantityActual: number | null; quantityPlanned: number; unitRate: number }[];
    discountAmount?: number | null;
  }) {
    let gross = 0;
    for (const item of job.items) {
      const qty = item.quantityActual ?? item.quantityPlanned;
      gross += qty * item.unitRate;
    }
    gross = Math.round(gross * 100) / 100;
    const discount = Math.round(Math.min(Math.max(0, job.discountAmount || 0), gross) * 100) / 100;
    const net = Math.round((gross - discount) * 100) / 100;
    return { gross, discount, net };
  }

  /**
   * Finalize Job by Accountant:
   * Locks the job (read-only from here), creates/updates the invoice and posts revenue/AR
   * through AccountsPostingService using AccountMappingService roles (no hardcoded codes).
   *
   * Re-finalize after auditor send-back: the total is recomputed. If it differs from what is
   * currently booked, the invoice amount is updated, the active revenue JE(s) are reversed and a
   * fresh revenue JE is posted — all inside ONE transaction. Unchanged totals → no GL activity.
   * Idempotent: calling finalize on an already-Finalized job is a no-op that returns the job.
   */
  static async finalizeJob(jobId: string, accountantName: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true, customer: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.status === "Finalized" && job.finalizedAt) {
      return job; // idempotent (double-click / hisaab finalizeAndLock replay)
    }
    if (job.status !== "CompletedPendingVerification") {
      throw new Error(`Job must be 'CompletedPendingVerification' to finalize.`);
    }
    const pendingDiscountRequests = await prisma.jobDiscountRequest.count({
      where: { jobId, status: "pending" },
    });
    if (pendingDiscountRequests > 0) {
      throw new Error(
        `Job ${job.jobNumber} has ${pendingDiscountRequests} pending discount request(s). Approve or reject them before finalizing.`
      );
    }

    const { gross, discount } = this.computeJobTotals(job);
    // FOC / care-of (referred by an external company): the customer pays nothing (invoice 0/paid), but the
    // work is billable to the care-of company. Revenue is recognised now against 1100 AR with the care-of
    // company as the sub-ledger party (no separate COA account per company); recordFocPayment clears it.
    // Material cost was already expensed to COGS when stock was issued.
    const trueFoc = Boolean(job.isFoc);
    const arParty = trueFoc
      ? job.careOfPartyId
        ? { partyType: "care_of", partyId: job.careOfPartyId }
        : { partyType: "customer", partyId: job.customerId }
      : { partyType: "customer", partyId: job.customerId };

    // Sales tax (Settings > Taxes). Re-finalizing reuses the invoice's tax snapshot, so jobs
    // invoiced before tax was switched on never gain tax. FOC jobs: no customer charge, no tax.
    const taxRes = trueFoc ? null : await TaxSettingsService.forJob(job, gross, discount);
    // FOC: tax only when Settings > Taxes "tax FOC company payments" is on (tax-inclusive, same as the payment).
    let focTaxAmount = 0;
    let focTaxAccount: Awaited<ReturnType<typeof TaxSettingsService.accountFor>> | null = null;
    if (trueFoc) {
      const { rates: taxRates, policy: taxPolicy } = await TaxSettingsService.load();
      const focRate = taxPolicy.jobs.taxFocPayments
        ? jobTaxRate(taxPolicy, taxRates, { jobType: job.jobType, careOfPartyId: job.careOfPartyId, customerTaxExempt: false, isFoc: false }, new Date())
        : null;
      const focNet = Math.max(0, Math.round((gross - discount) * 100) / 100);
      focTaxAmount = focRate
        ? computeTax({ gross: focNet, ratePercent: focRate.rate, inclusive: true, applyAfterDiscount: true, rounding: taxPolicy.rounding }).tax
        : 0;
      focTaxAccount = focRate && focTaxAmount > 0 ? await TaxSettingsService.accountFor(focRate, "sales_tax_payable") : null;
      if (!focTaxAccount) focTaxAmount = 0;
    }
    const taxAmount = trueFoc ? focTaxAmount : taxRes?.tax || 0;
    const finalAmount = taxRes ? taxRes.total : Math.max(0, Math.round((gross - discount) * 100) / 100);
    const revenueGross = taxRes ? taxRes.revenueGross : trueFoc ? Math.round((gross - focTaxAmount) * 100) / 100 : gross;
    const taxAccount = trueFoc
      ? focTaxAccount
      : taxAmount > 0 && taxRes?.rate ? await TaxSettingsService.accountFor(taxRes.rate, "sales_tax_payable") : null;

    // Resolve accounts via AccountMappingService (read-only, before the write transaction)
    const arAccount = await AccountMappingService.resolveAccount({
      transactionType: "job_revenue_receivable",
    });
    // Service revenue follows the job type (installation vs repair); goods sold on the invoice
    // (stock issued, market-purchased items) go to the goods revenue account.
    const revAccount = await AccountMappingService.resolveAccount({
      transactionType: jobRevenueRole(job.jobType),
    });
    const goodsShare = goodsShareOfItems(job.items);
    const goodsAccount =
      goodsShare > 0 ? await AccountMappingService.resolveAccount({ transactionType: "job_revenue_goods" }) : null;
    const discountAccount =
      discount > 0
        ? await AccountMappingService.resolveAccount({
            transactionType: "job_revenue_discount",
          })
        : null;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const revenueCredit = discount > 0 && discountAccount ? revenueGross : r2(finalAmount - taxAmount);
    const goodsCredit = goodsAccount ? r2(revenueCredit * goodsShare) : 0;
    const serviceCredit = r2(revenueCredit - goodsCredit);
    const revenueCredits: { accountId: string; credit: number }[] = [];
    if (serviceCredit !== 0 || goodsCredit === 0) revenueCredits.push({ accountId: revAccount.id, credit: serviceCredit });
    if (goodsAccount && goodsCredit !== 0) revenueCredits.push({ accountId: goodsAccount.id, credit: goodsCredit });

    const postingLines: { accountId: string; debit: number; credit: number; partyType?: string; partyId?: string }[] = [];
    if (finalAmount <= 0 && trueFoc) {
      // nothing billable
    } else if (discount > 0 && discountAccount) {
      postingLines.push({ accountId: arAccount.id, debit: finalAmount, credit: 0, ...arParty });
      postingLines.push({ accountId: discountAccount.id, debit: discount, credit: 0 });
      for (const rc of revenueCredits) postingLines.push({ accountId: rc.accountId, debit: 0, credit: rc.credit });
    } else {
      postingLines.push({ accountId: arAccount.id, debit: finalAmount, credit: 0, ...arParty });
      for (const rc of revenueCredits) postingLines.push({ accountId: rc.accountId, debit: 0, credit: rc.credit });
    }
    if (taxAccount && taxAmount > 0 && postingLines.length > 0) {
      postingLines.push({ accountId: taxAccount.id, debit: 0, credit: taxAmount });
    }
    const hasAmount = postingLines.some((l) => l.debit > 0 || l.credit > 0);

    const wasSentBack = job.qualityFlag === "sent_back";

    const result = await prisma.$transaction(async (tx) => {
      // Status guard: only one finalize wins (concurrency / replay)
      const claimed = await tx.job.updateMany({
        where: { id: jobId, status: "CompletedPendingVerification" },
        data: {
          status: "Finalized",
          finalizedAt: new Date(),
          qualityFlag: wasSentBack ? null : job.qualityFlag,
        },
      });
      if (claimed.count === 0) {
        throw new Error("Job status changed while finalizing (already finalized?). Refresh and retry.");
      }

      // Active (non-reversed) revenue entries for this job
      const activeRevenue = await tx.journalEntry.findMany({
        where: { refType: "job_revenue", refId: job.id, status: "posted" },
        include: { lines: true },
        orderBy: { postedAt: "asc" },
      });
      const bookedNet =
        Math.round(
          activeRevenue.reduce(
            (sum, je) =>
              sum +
              je.lines
                .filter((l) => l.accountId === arAccount.id)
                .reduce((a, l) => a + (l.debit - l.credit), 0),
            0
          ) * 100
        ) / 100;
      // Revenue is compared account by account (service / goods), so a change in the split re-posts.
      const bookedByRevenueAccount = new Map<string, number>();
      for (const je of activeRevenue) {
        for (const l of je.lines) {
          if (l.accountId === arAccount.id || l.accountId === taxAccount?.id || l.accountId === discountAccount?.id) continue;
          bookedByRevenueAccount.set(l.accountId, r2((bookedByRevenueAccount.get(l.accountId) || 0) + (l.credit - l.debit)));
        }
      }
      const expectedByRevenueAccount = new Map<string, number>();
      for (const rc of revenueCredits) {
        expectedByRevenueAccount.set(rc.accountId, r2((expectedByRevenueAccount.get(rc.accountId) || 0) + rc.credit));
      }
      const revenueUnchanged = Array.from(new Set([...bookedByRevenueAccount.keys(), ...expectedByRevenueAccount.keys()])).every(
        (id) => Math.abs((bookedByRevenueAccount.get(id) || 0) - (expectedByRevenueAccount.get(id) || 0)) < 0.005
      );
      const bookedTax = taxAccount
        ? Math.round(
            activeRevenue.reduce(
              (sum, je) => sum + je.lines.filter((l) => l.accountId === taxAccount.id).reduce((a, l) => a + (l.credit - l.debit), 0),
              0
            ) * 100
          ) / 100
        : 0;
      // FOC jobs that already received company payments under the old flow (payment credited revenue
      // directly) must not get revenue booked again.
      const priorFocPayments = trueFoc
        ? await tx.journalEntry.count({ where: { refType: "foc_payment", refId: job.id, status: "posted" } })
        : 0;
      const glUnchanged = trueFoc && priorFocPayments > 0 && activeRevenue.length === 0
        ? true
        : (activeRevenue.length > 0 || !hasAmount) &&
          Math.abs(bookedNet - finalAmount) < 0.005 &&
          revenueUnchanged &&
          Math.abs(bookedTax - taxAmount) < 0.005;

      let reversedEntryIds: string[] = [];
      let revenueEntryId: string | null = activeRevenue[0]?.id ?? null;
      if (!glUnchanged) {
        for (const je of activeRevenue) {
          const rev = await AccountsPostingService.reverseEntry({
            journalEntryId: je.id,
            reversedBy: accountantName,
            reason: `Re-finalize of Job ${job.jobNumber}: total revised ${bookedNet} -> ${finalAmount}`,
            tx,
          });
          reversedEntryIds.push(rev.id);
        }
        revenueEntryId = null;
        if (hasAmount) {
          const entry = await AccountsPostingService.post({
            memo: `${activeRevenue.length ? "Revised revenue" : "Revenue"} recognition for Job ${job.jobNumber} (${job.customer.name})`,
            refType: "job_revenue",
            refId: job.id,
            postedBy: accountantName,
            lines: postingLines,
            tx,
          });
          revenueEntryId = entry.id;
        }
      }

      // Invoice: create once; on re-finalize update amount when it drifted
      const existingInvoice = await tx.invoice.findFirst({
        where: { jobId: job.id },
        orderBy: { createdAt: "desc" },
      });
      let invoiceNumber = existingInvoice?.invoiceNumber;
      let invoiceAmountBefore: number | null = existingInvoice?.amount ?? null;
      if (!existingInvoice) {
        invoiceNumber = await DocumentSequenceService.nextInvoiceNumber(tx);
        await tx.invoice.create({
          data: {
            invoiceNumber,
            jobId: job.id,
            customerId: job.customerId,
            customerName: job.customer.name,
            amount: job.isFoc ? 0 : finalAmount,
            status: job.isFoc ? "paid" : "unpaid",
            taxApplied: true,
            subtotal: gross,
            discountAmount: discount,
            taxCode: taxAmount > 0 ? taxRes?.rate?.code ?? null : null,
            taxName: taxAmount > 0 ? taxRes?.rate?.name ?? null : null,
            taxRate: taxAmount > 0 ? taxRes?.ratePercent ?? 0 : 0,
            taxInclusive: taxAmount > 0 ? Boolean(taxRes?.inclusive) : false,
            taxAmount,
          },
        });

        if (finalAmount > 0 && !job.isFoc) {
          await SubLedgerService.recordCustomerEntry({
            customerId: job.customerId,
            entryType: "invoice",
            documentNumber: invoiceNumber!,
            journalEntryId: revenueEntryId || undefined,
            debit: finalAmount,
            credit: 0,
            notes: `Invoice for finalized Job ${job.jobNumber}`,
            tx,
          });
        }
      } else if (!job.isFoc && Math.abs((existingInvoice.amount || 0) - finalAmount) >= 0.005) {
        const invoiceDelta = Math.round((finalAmount - (existingInvoice.amount || 0)) * 100) / 100;
        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: { amount: finalAmount, subtotal: gross, discountAmount: discount, taxAmount },
        });
        if (invoiceDelta !== 0) {
          await SubLedgerService.recordCustomerEntry({
            customerId: job.customerId,
            entryType: invoiceDelta > 0 ? "invoice" : "credit_note",
            documentNumber: `${existingInvoice.invoiceNumber}-ADJ`,
            journalEntryId: revenueEntryId || undefined,
            debit: invoiceDelta > 0 ? invoiceDelta : 0,
            credit: invoiceDelta < 0 ? Math.abs(invoiceDelta) : 0,
            notes: `Re-finalization adjustment for Job ${job.jobNumber}: ${existingInvoice.amount} -> ${finalAmount}`,
            tx,
          });
        }
      } else if (job.isFoc && ((existingInvoice.amount || 0) > 0 || existingInvoice.status !== "paid")) {
        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: { amount: 0, status: "paid" },
        });
      }

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: "CompletedPendingVerification",
          toStatus: "Finalized",
          changedBy: accountantName,
          metaJson: JSON.stringify({
            invoiceNumber,
            finalAmount,
            gross,
            discount,
            reFinalize: Boolean(existingInvoice) || activeRevenue.length > 0,
            isFoc: job.isFoc,
            invoiceAmountBefore,
            glUnchanged,
            reversedEntryIds,
            revenueEntryId,
          }),
        },
      });

      return await tx.job.findUnique({ where: { id: jobId } });
    }, { maxWait: 10000, timeout: 30000 });

    return result!;
  }

  /**
   * Admin / Auditor verification:
   * Checklist-gated approval (work confirmed / payment reconciled / inventory returned).
   * Called after Call Center feedback is completed (or on Finalized jobs) to audit and approve.
   */
  static async verifyJob(
    jobId: string,
    adminName: string,
    checklist: { workConfirmed: boolean; paymentReconciled: boolean; inventoryReturned: boolean }
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (job.status !== "Finalized" && job.status !== "CompletedPendingVerification") {
      throw new Error(
        `Job must be awaiting audit (CompletedPendingVerification or Finalized) before it can be verified. Current status: ${job.status}.`
      );
    }

    if (!checklist.workConfirmed || !checklist.paymentReconciled || !checklist.inventoryReturned) {
      throw new Error(
        "All verification checklist items (Work Confirmed, Payment Reconciled, Inventory Returned) must be confirmed to verify the job."
      );
    }

    // If job was in CompletedPendingVerification without finalizedAt, auto-finalize to post revenue & invoice
    if (job.status === "CompletedPendingVerification" && !job.finalizedAt) {
      try {
        await this.finalizeJob(jobId, adminName);
      } catch (err: any) {
        console.warn("[verifyJob] Auto-finalize warning:", err.message);
      }
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

    await this.logStatusChange(jobId, job.status, "Verified", adminName, {
      checklist,
      action: "auditor_approved",
    });

    return updated;
  }

  /**
   * Auditor / supervisor send-back & disapproval:
   * Disapproves a job awaiting audit with a required note and targets rework or dispute.
   */
  static async sendBackFromVerification(
    jobId: string,
    actorName: string,
    note: string,
    targetStatus?: "InProgress" | "AwaitingFeedback" | "CompletedPendingVerification"
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "Finalized" && job.status !== "CompletedPendingVerification") {
      throw new Error(
        `Only jobs in audit review (CompletedPendingVerification or Finalized) can be disapproved/sent back. Current status: ${job.status}.`
      );
    }
    const reason = (note || "").trim();
    if (!reason) {
      throw new Error("A reason / note is required to disapprove or send back the job.");
    }

    const nextStatus = targetStatus || (job.status === "Finalized" ? "CompletedPendingVerification" : "InProgress");

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        finalizedAt: null,
        qualityFlag: "disputed",
        verifiedAt: null,
        verifiedChecklist: null,
      },
    });

    await this.logStatusChange(jobId, job.status, nextStatus, actorName, {
      action: "auditor_disapproved",
      note: reason,
      supervisorOverride: true,
    });

    return updated;
  }

  /**
   * Jobs awaiting auditor action:
   * Includes jobs where call-center feedback completed (CompletedPendingVerification)
   * as well as accountant-locked (Finalized) jobs awaiting auditor sign-off.
   */
  static async getVerificationQueue(opts?: { search?: string; includeSentBack?: boolean }) {
    const where: any = {
      OR: [
        { status: "CompletedPendingVerification" },
        { status: "Finalized" },
      ],
    };
    if (!opts?.includeSentBack) {
      where.qualityFlag = { notIn: ["sent_back"] };
    }
    if (opts?.search) {
      const q = opts.search;
      const searchClause = [
        { jobNumber: { contains: q, mode: "insensitive" } },
        { remarks: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ];
      where.AND = [{ OR: searchClause }];
    }

    return prisma.job.findMany({
      where,
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        items: true,
        expenseClaims: true,
        inventoryRequests: true,
        stockReturns: true,
        hisaabSettlements: true,
        feedbackCalls: {
          orderBy: { calledAt: "desc" },
        },
        statusHistory: { orderBy: { changedAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async countPendingVerifications() {
    return prisma.job.count({
      where: {
        OR: [
          { status: "CompletedPendingVerification" },
          { status: "Finalized" },
        ],
        qualityFlag: { notIn: ["sent_back"] },
      },
    });
  }

  /**
   * Clear technician expense claim by accountant:
   * Supports selecting payment source (Cash on Hand, Meezan Bank, HBL, Petty Cash, etc.)
   * Supports partial clearance when resources are constrained:
   *  - Disburses partial amount now and records balanced double-entry in General Ledger
   *  - Retains the remaining balance as a pending claim so it can be cleared afterwards
   *  - Or clears full claim if paying in full
   */
  /** Resolve disbursing + expense accounts for technician expense payouts (read-only). */
  private static async resolveExpensePayoutAccounts(disbursingAccountCode?: string) {
    let disbursingAccount;
    try {
      disbursingAccount = disbursingAccountCode
        ? await AccountsPostingService.getAccountByCode(disbursingAccountCode)
        : await AccountMappingService.resolveAccount({ transactionType: "expense_reimbursement_disbursing" });
    } catch {
      disbursingAccount = await AccountMappingService.resolveAccount({
        transactionType: "expense_reimbursement_disbursing",
      });
    }
    const expenseCostingAccount = await AccountMappingService.resolveAccount({
      transactionType: "expense_reimbursement_expense",
    });
    return { disbursingAccount, expenseCostingAccount };
  }

  /**
   * Clear (fully or partially) one technician expense claim.
   * Atomic: the claim update, remainder claim and GL journal are written in ONE transaction.
   * Race-safe: the claim is "claimed" with a conditional update (status still pending), and the
   * journal carries idempotency key `expense_clear:<claimId>`, so a double-click/retry cannot pay twice.
   */
  static async clearExpense(
    jobId: string,
    claimId: string,
    accountantName: string,
    disbursingAccountCode?: string,
    amountToPay?: number,
    paymentNotes?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, jobNumber: true, status: true } });
    if (!job) throw new Error("Job not found");

    const { disbursingAccount, expenseCostingAccount } = await this.resolveExpensePayoutAccounts(disbursingAccountCode);
    const paymentRefLabel = paymentNotes ? ` [Ref: ${paymentNotes}]` : "";

    const result = await prisma.$transaction(
      async (tx) => {
        const claim = await tx.jobExpenseClaim.findUnique({ where: { id: claimId } });
        if (!claim) throw new Error("Expense claim not found");
        if (claim.jobId !== jobId) throw new Error("Claim does not belong to this job");
        if (claim.status === "paid") throw new Error("Expense claim is already cleared/paid");

        const totalClaimAmount = claim.amount;
        const requested = Number(amountToPay);
        const paidNow = Math.round(
          (amountToPay !== undefined && amountToPay !== null && requested > 0
            ? Math.min(requested, totalClaimAmount)
            : totalClaimAmount) * 100
        ) / 100;
        if (!Number.isFinite(paidNow) || paidNow <= 0) throw new Error("Disbursement amount must be greater than 0");

        const isPartial = paidNow < totalClaimAmount;
        const remainingBalance = Math.round((totalClaimAmount - paidNow) * 100) / 100;
        const originalNote = claim.note;

        // Claim the row: only one concurrent request can flip pending -> paid.
        const claimed = await tx.jobExpenseClaim.updateMany({
          where: { id: claimId, status: { not: "paid" } },
          data: isPartial
            ? {
                amount: paidNow,
                status: "paid",
                paidAt: new Date(),
                note: `${originalNote} [Partially Cleared: PKR ${paidNow.toLocaleString()} via ${disbursingAccount.name} (${disbursingAccount.code})${paymentRefLabel}]`,
              }
            : {
                status: "paid",
                paidAt: new Date(),
                note: paymentRefLabel ? `${originalNote}${paymentRefLabel}` : originalNote,
              },
        });
        if (claimed.count !== 1) throw new Error("Expense claim is already cleared/paid");

        let remainingClaimId: string | null = null;
        if (isPartial) {
          const remainingClaim = await tx.jobExpenseClaim.create({
            data: {
              jobId: claim.jobId,
              technicianId: claim.technicianId,
              amount: remainingBalance,
              note: `${originalNote} [Remaining Balance after PKR ${paidNow.toLocaleString()} partial payout]`,
              category: claim.category,
              allocationGroupId: claim.allocationGroupId,
              receiptUrl: claim.receiptUrl,
              status: "pending",
              accruedAt: claim.accruedAt,
            },
          });
          remainingClaimId = remainingClaim.id;
        }

        // A claim already expensed when carried forward at hisaab (accruedAt) settles the 2100 payable instead.
        const categoryAccount = claim.accruedAt
          ? await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_payable", prismaClient: tx })
          : (await loadExpenseCategoryAccounts(tx))(claim.category) || expenseCostingAccount;
        if (claim.accruedAt) {
          await tx.technicianLedgerEntry.create({
            data: {
              technicianId: claim.technicianId,
              type: "expense_paid",
              amount: paidNow,
              refJobId: claim.jobId,
              notes: `Carried-forward expense paid directly via ${disbursingAccount.name} (${disbursingAccount.code})`,
            },
          });
        }
        await AccountsPostingService.post({
          memo: isPartial
            ? `Partial technician expense payout (PKR ${paidNow.toLocaleString()} of PKR ${totalClaimAmount.toLocaleString()}) for Job ${job.jobNumber}: ${originalNote}${paymentRefLabel}`
            : `Technician expense clearance for Job ${job.jobNumber}: ${originalNote}${paymentRefLabel}`,
          refType: "expense_reimbursement",
          refId: claim.id,
          postedBy: accountantName,
          idempotencyKey: `expense_clear:${claim.id}`,
          lines: [
            { accountId: categoryAccount.id, debit: paidNow, credit: 0 },
            { accountId: disbursingAccount.id, debit: 0, credit: paidNow },
          ],
          tx,
        });

        const updatedClaim = await tx.jobExpenseClaim.findUnique({ where: { id: claimId } });
        return { updatedClaim, paidNow, isPartial, remainingBalance, remainingClaimId, note: originalNote };
      },
      { maxWait: 10000, timeout: 30000 }
    );

    // History is informational; written after the money transaction committed.
    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      action: result.isPartial ? "expense_partially_cleared" : "expense_cleared",
      claimId,
      amount: result.paidNow,
      amountPaid: result.paidNow,
      remainingBalance: result.remainingBalance,
      newRemainingClaimId: result.remainingClaimId,
      note: result.note,
      disbursingAccountCode: disbursingAccount.code,
      disbursingAccountName: disbursingAccount.name,
      paymentNotes,
    });

    return result.updatedClaim;
  }

  /**
   * Clear all or partial pending technician expenses for a job in one action.
   * Atomic + race-safe: every claim is claimed with a conditional update inside one transaction
   * together with the single GL journal; if any claim was already paid concurrently, nothing is written.
   */
  static async clearJobExpenses(
    jobId: string,
    accountantName: string,
    disbursingAccountCode?: string,
    amountToPay?: number,
    paymentNotes?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, jobNumber: true, status: true } });
    if (!job) throw new Error("Job not found");

    const { disbursingAccount, expenseCostingAccount } = await this.resolveExpensePayoutAccounts(disbursingAccountCode);
    const paymentRefLabel = paymentNotes ? ` [Ref: ${paymentNotes}]` : "";

    const result = await prisma.$transaction(
      async (tx) => {
        const pendingClaims = await tx.jobExpenseClaim.findMany({
          where: { jobId, status: "pending" },
          orderBy: { createdAt: "asc" },
        });
        if (pendingClaims.length === 0) throw new Error("No pending expense claims to clear on this job");

        const totalPending = Math.round(pendingClaims.reduce((sum, c) => sum + c.amount, 0) * 100) / 100;
        const requested = Number(amountToPay);
        const paidNow = Math.round(
          (amountToPay !== undefined && amountToPay !== null && requested > 0
            ? Math.min(requested, totalPending)
            : totalPending) * 100
        ) / 100;
        if (!Number.isFinite(paidNow) || paidNow <= 0) throw new Error("Disbursement amount must be greater than 0");

        const isPartial = paidNow < totalPending;
        const remainingBalance = Math.round((totalPending - paidNow) * 100) / 100;
        let remainingToAllocate = paidNow;
        const clearedIds: string[] = [];
        const categoryAccountFor = await loadExpenseCategoryAccounts(tx);
        const paidByAccount = new Map<string, number>();
        const accruedPayable = await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_payable", prismaClient: tx });
        const accruedPaidByTech = new Map<string, number>();
        const addPaid = (claimRow: { category: string | null; accruedAt: Date | null; technicianId: string }, amt: number) => {
          const acc = claimRow.accruedAt ? accruedPayable : categoryAccountFor(claimRow.category) || expenseCostingAccount;
          paidByAccount.set(acc.id, Math.round(((paidByAccount.get(acc.id) || 0) + amt) * 100) / 100);
          if (claimRow.accruedAt) {
            accruedPaidByTech.set(claimRow.technicianId, Math.round(((accruedPaidByTech.get(claimRow.technicianId) || 0) + amt) * 100) / 100);
          }
        };

        for (const claim of pendingClaims) {
          if (remainingToAllocate <= 0) break;
          const fullyCovered = remainingToAllocate >= claim.amount;
          const partialPaid = fullyCovered ? claim.amount : remainingToAllocate;
          const claimed = await tx.jobExpenseClaim.updateMany({
            where: { id: claim.id, status: "pending" },
            data: fullyCovered
              ? {
                  status: "paid",
                  paidAt: new Date(),
                  note: paymentRefLabel ? `${claim.note}${paymentRefLabel}` : claim.note,
                }
              : {
                  amount: partialPaid,
                  status: "paid",
                  paidAt: new Date(),
                  note: `${claim.note} [Partially Cleared: PKR ${partialPaid.toLocaleString()} via ${disbursingAccount.name} (${disbursingAccount.code})${paymentRefLabel}]`,
                },
          });
          if (claimed.count !== 1) {
            throw new Error("Another payout cleared some of these claims at the same time. Refresh and try again.");
          }
          clearedIds.push(claim.id);
          addPaid(claim, partialPaid);
          if (!fullyCovered) {
            await tx.jobExpenseClaim.create({
              data: {
                jobId: claim.jobId,
                technicianId: claim.technicianId,
                amount: Math.round((claim.amount - partialPaid) * 100) / 100,
                note: `${claim.note} [Remaining Balance after PKR ${partialPaid.toLocaleString()} partial payout]`,
                category: claim.category,
                allocationGroupId: claim.allocationGroupId,
                receiptUrl: claim.receiptUrl,
                status: "pending",
                accruedAt: claim.accruedAt,
              },
            });
            remainingToAllocate = 0;
          } else {
            remainingToAllocate = Math.round((remainingToAllocate - claim.amount) * 100) / 100;
          }
        }

        await AccountsPostingService.post({
          memo: `Technician field expense payout (PKR ${paidNow.toLocaleString()}${isPartial ? ` of total PKR ${totalPending.toLocaleString()}` : ""}) for Job ${job.jobNumber}${paymentRefLabel}`,
          refType: "expense_reimbursement",
          refId: job.id,
          postedBy: accountantName,
          // Same set of claims can only be paid once.
          idempotencyKey: `expense_clear_batch:${clearedIds.slice().sort().join(",")}`.slice(0, 900),
          lines: [
            ...Array.from(paidByAccount.entries()).map(([accountId, amt]) => ({ accountId, debit: amt, credit: 0 })),
            { accountId: disbursingAccount.id, debit: 0, credit: paidNow },
          ],
          tx,
        });

        for (const [technicianId, amt] of accruedPaidByTech) {
          await tx.technicianLedgerEntry.create({
            data: {
              technicianId,
              type: "expense_paid",
              amount: amt,
              refJobId: job.id,
              notes: `Carried-forward expense paid directly via ${disbursingAccount.name} (${disbursingAccount.code})`,
            },
          });
        }

        return { paidNow, isPartial, remainingBalance, totalPending, claimsClearedCount: clearedIds.length };
      },
      { maxWait: 10000, timeout: 30000 }
    );

    await this.logStatusChange(jobId, job.status, job.status, accountantName, {
      action: result.isPartial ? "job_expenses_partially_cleared" : "job_expenses_cleared",
      amountPaid: result.paidNow,
      totalPending: result.totalPending,
      remainingBalance: result.remainingBalance,
      disbursingAccountCode: disbursingAccount.code,
      disbursingAccountName: disbursingAccount.name,
      paymentNotes,
    });

    return {
      success: true,
      amountPaid: result.paidNow,
      remainingBalance: result.remainingBalance,
      isPartial: result.isPartial,
      totalPending: result.totalPending,
      claimsClearedCount: result.claimsClearedCount,
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

    let targetReq: any = null;
    if (requestId) {
      targetReq = await prisma.inventoryRequest.findUnique({ where: { id: requestId } });
      if (!targetReq) throw new Error("Inventory request not found.");
    } else {
      targetReq = await prisma.inventoryRequest.findFirst({
        where: {
          jobId,
          status: { in: ["pending", "partially_issued"] },
          OR: [
            { productId: productId },
            { item: { contains: product.name, mode: "insensitive" } },
          ],
        },
      });
    }

    if (targetReq) {
      const currentIssued = Number(targetReq.qtyIssued) || 0;
      const totalReq = Number(targetReq.qtyRequested) || 0;
      if (targetReq.status === "issued" || (currentIssued >= totalReq && totalReq > 0)) {
        throw new Error(`Inventory request for '${targetReq.item}' has already been fully issued.`);
      }
      if (targetReq.status === "rejected") {
        throw new Error(`Cannot issue rejected inventory request.`);
      }
      const remainingNeeded = Math.max(0, totalReq - currentIssued);
      if (qty > remainingNeeded) {
        throw new Error(
          `Cannot issue more than the requested amount. Only ${remainingNeeded} unit(s) remaining out of ${totalReq} requested (attempted to issue ${qty}).`
        );
      }
    }

    // 1. Consume stock through InventoryService (handles ledger and COGS journal entry)
    await InventoryService.consumeStock(
      productId,
      qty,
      "job_consumption",
      targetReq?.id || requestId || jobId,
      `Issued to Job ${job.jobNumber} by ${storekeeperName}`
    );

    // 2. If an inventory request ID was supplied or exists for this item/job, update qtyIssued and status
    let updatedRequest: any = null;
    if (targetReq) {
      const currentIssued = Number(targetReq.qtyIssued) || 0;
      const newQtyIssued = currentIssued + qty;
      const isFullyIssued = newQtyIssued >= (Number(targetReq.qtyRequested) || 0);
      updatedRequest = await prisma.inventoryRequest.update({
        where: { id: targetReq.id },
        data: {
          qtyIssued: newQtyIssued,
          productId: targetReq.productId || productId,
          status: isFullyIssued ? "issued" : "partially_issued",
        },
      });
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
      const isPartial = updatedRequest && updatedRequest.status === "partially_issued";
      const totalReq = targetReq ? Number(targetReq.qtyRequested) : qty;
      const totalIssued = updatedRequest ? Number(updatedRequest.qtyIssued) : qty;
      const remaining = Math.max(0, totalReq - totalIssued);

      MobilePushService.sendAppRequest({
        recipientId: job.assignedTechnicianId,
        senderName: storekeeperName,
        senderRole: "storekeeper",
        type: "INVENTORY_ISSUED",
        title: isPartial ? `Parts partially issued — ${job.jobNumber}` : `Parts ready — ${job.jobNumber}`,
        body: isPartial
          ? `${qty} x ${product.name} issued (${totalIssued}/${totalReq} received, ${remaining} pending).`
          : `${qty} x ${product.name} is ready (${totalIssued}/${totalReq} complete). Open the job to check.`,
        priority: "high",
        payload: {
          jobId,
          productId,
          productName: product.name,
          quantity: qty,
          qtyIssued: totalIssued,
          qtyRequested: totalReq,
          qtyPending: remaining,
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
   * Services are always quantity 1 (billable line, not stock units).
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
    if (!canAddServiceOrItem(job)) {
      throw new Error(
        job.finalizedAt
          ? "Job is finalized and locked. Services/items cannot be added (auditor send-back reopens it for correction)."
          : `Cannot add services/items to a job in status '${job.status}'.`
      );
    }
    if (!description || !String(description).trim()) {
      throw new Error("Service/item description is required.");
    }

    const rate = Number(unitRate);
    if (!Number.isFinite(rate) || rate < 0) {
      throw new Error("Unit rate must be a non-negative number.");
    }
    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      throw new Error("Quantity must be a positive number.");
    }
    const qty = parsedQty;

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
   * Creates the StockReturn AND acknowledges it (restock + ledger + GL) in ONE transaction,
   * so a failed product match / GL posting leaves no half-recorded return.
   * The product must resolve (productId, linked jobItemId "(SKU)", SKU or exact name).
   */
  static async recordStockReturn(
    jobId: string,
    technicianId: string,
    item: string,
    qtyReturned: number,
    storekeeperName: string,
    notes?: string,
    opts?: { productId?: string | null; jobItemId?: string | null }
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    const qty = Number(qtyReturned);
    if (!qty || qty <= 0) throw new Error("Quantity returned must be greater than zero");

    const product = await InventoryService.resolveReturnProduct(prisma, {
      productId: opts?.productId,
      jobItemId: opts?.jobItemId,
      item,
    });
    if (!product) {
      throw new Error(
        `Cannot record stock return: '${item}' does not match any warehouse product (by id, SKU or exact name). Pick the product and retry.`
      );
    }

    // Cap verification: Ensure quantity returned does not exceed what was issued to this job
    const stockOutEntries = await prisma.stockLedger.findMany({
      where: {
        productId: product.id,
        direction: "out",
        refType: "job_consumption",
        OR: [
          { refId: jobId },
          { notes: { contains: job.jobNumber } },
        ],
      },
    });
    const totalIssued = stockOutEntries.reduce((sum, e) => sum + e.qty, 0);

    const previousReturns = await prisma.stockReturn.findMany({
      where: { jobId, productId: product.id },
    });
    const alreadyReturned = previousReturns.reduce((sum, r) => sum + r.qtyReturned, 0);
    const maxReturnable = Math.max(0, totalIssued - alreadyReturned);

    if (totalIssued > 0 && qty > maxReturnable + 1e-9) {
      throw new Error(
        `Cannot return ${qty} of '${product.name}'. Total issued to Job ${job.jobNumber}: ${totalIssued}, already returned: ${alreadyReturned}. Maximum returnable: ${maxReturnable}.`
      );
    }

    const acknowledged = await prisma.$transaction(async (tx) => {
      const record = await tx.stockReturn.create({
        data: {
          jobId,
          technicianId: technicianId || job.assignedTechnicianId || "unknown",
          item,
          productId: product.id,
          qtyReturned: qty,
        },
      });

      const ack = await InventoryService.acknowledgeStockReturn(record.id, storekeeperName, {
        productId: product.id,
        tx,
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: job.status,
          toStatus: job.status,
          changedBy: storekeeperName,
          metaJson: JSON.stringify({
            action: "stock_return_recorded",
            returnId: record.id,
            item,
            productId: product.id,
            qtyReturned: qty,
            notes,
            acknowledgedAt: ack.acknowledgedAt,
          }),
        },
      });
      return ack;
    }, TX_OPTS);

    return acknowledged;
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
    reason?: string,
    cashCollection?: {
      amount: number;
      notes?: string;
    }
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    const qty = Number(qtyMisplaced);
    const techId = technicianId || job.assignedTechnicianId;

    let cashRecoveryResult = null;
    if (cashCollection && cashCollection.amount > 0 && techId) {
      const recoveredAmt = Number(cashCollection.amount);
      await prisma.technicianLedgerEntry.create({
        data: {
          technicianId: techId,
          type: "hisaab_received",
          amount: recoveredAmt,
          refJobId: jobId,
          notes: `On-the-spot cash collection for misplaced item (${qty}x ${item}). Received by ${reportedBy}. ${cashCollection.notes || ""}`,
        },
      }).catch(() => {});

      cashRecoveryResult = {
        amount: recoveredAmt,
        receivedBy: reportedBy,
        notes: cashCollection.notes,
      };
    }

    await this.logStatusChange(jobId, job.status, job.status, reportedBy, {
      action: "misplaced_item_by_technician",
      technicianId: techId,
      item,
      qtyMisplaced: qty,
      reason: reason || "Item misplaced/lost on site during execution",
      cashRecovery: cashRecoveryResult,
    });

    return {
      success: true,
      message: `Recorded ${qty}x ${item} as misplaced by technician.${cashRecoveryResult ? ` Recovered PKR ${cashRecoveryResult.amount.toLocaleString()} on the spot cash.` : ""} Logged in audit trail.`,
      cashRecovery: cashRecoveryResult,
    };
  }

  /**
   * Generate an official Invoice with custom invoice number sequence.
   */
  static async generateCustomInvoice(
    jobId: string,
    customInvoiceNumber: string,
    createdBy: string,
    manualItems?: Array<{ description: string; quantity: number; unitRate: number }>,
    discountAmount?: number
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true, items: true },
    });
    if (!job) throw new Error("Job not found");

    // If manual items are provided by accounting, update JobItem records
    if (Array.isArray(manualItems) && manualItems.length > 0) {
      await prisma.jobItem.deleteMany({ where: { jobId: job.id } });
      await prisma.jobItem.createMany({
        data: manualItems.map((it) => ({
          jobId: job.id,
          description: it.description?.trim() || "Service Item",
          quantityPlanned: Number(it.quantity) || 1,
          quantityActual: Number(it.quantity) || 1,
          unitRate: Number(it.unitRate) || 0,
        })),
      });
    }

    if (discountAmount !== undefined && discountAmount !== null) {
      await prisma.job.update({
        where: { id: job.id },
        data: { discountAmount: Math.max(0, Number(discountAmount) || 0) },
      });
    }

    // Reload job with fresh items
    const freshJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true, items: true },
    });
    if (!freshJob) throw new Error("Job not found");

    // Compute billable total
    let total = 0;
    for (const it of freshJob.items) {
      const q = it.quantityActual !== null && it.quantityActual !== undefined ? it.quantityActual : it.quantityPlanned;
      total += q * it.unitRate;
    }
    const grossTotal = Math.round(total * 100) / 100;
    const disc = Math.round(Math.min(Math.max(0, freshJob.discountAmount || 0), grossTotal) * 100) / 100;
    // Sales tax per Settings > Taxes (an existing invoice keeps its own tax snapshot)
    const taxRes = freshJob.isFoc ? null : await TaxSettingsService.forJob(freshJob, grossTotal, disc);
    const net = freshJob.isFoc ? 0 : taxRes ? taxRes.total : Math.max(0, grossTotal - disc);
    const taxFields = {
      subtotal: grossTotal,
      discountAmount: disc,
      taxAmount: taxRes?.tax || 0,
    };

    const invoiceNum = customInvoiceNumber?.trim() || `INV-${freshJob.jobNumber}`;

    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: invoiceNum } });
    if (existing) {
      if (existing.jobId && existing.jobId !== freshJob.id) {
        throw new Error(
          `Invoice '${invoiceNum}' is already assigned to another Job. Duplicate invoice numbers across different jobs are not permitted.`
        );
      }
      if (existing.status === "paid") {
        throw new Error(`Invoice '${invoiceNum}' is already marked paid and cannot be modified.`);
      }
      const updated = await prisma.invoice.update({
        where: { invoiceNumber: invoiceNum },
        data: {
          amount: net,
          jobId: freshJob.id,
          customerId: freshJob.customerId,
          customerName: freshJob.customer.name,
          ...(existing.taxApplied ? taxFields : {}),
        },
      });
      return updated;
    }

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNum,
        jobId: freshJob.id,
        customerId: freshJob.customerId,
        customerName: freshJob.customer.name,
        amount: net,
        status: "unpaid",
        taxApplied: true,
        ...taxFields,
        taxCode: taxFields.taxAmount > 0 ? taxRes?.rate?.code ?? null : null,
        taxName: taxFields.taxAmount > 0 ? taxRes?.rate?.name ?? null : null,
        taxRate: taxFields.taxAmount > 0 ? taxRes?.ratePercent ?? 0 : 0,
        taxInclusive: taxFields.taxAmount > 0 ? Boolean(taxRes?.inclusive) : false,
      },
    });

    await this.logStatusChange(jobId, freshJob.status, freshJob.status, createdBy, {
      action: "custom_invoice_generated",
      invoiceNumber: invoiceNum,
      amount: net,
      itemsCount: freshJob.items.length,
    });

    return created;
  }

  /**
   * Bring the GL for one settlement to `targetAmount` (vault Dr / AR Cr), posting only the delta.
   * Makes hisaab confirm + cash handover + "update received amount" idempotent: the same
   * money is never posted twice. Must run inside the caller's transaction.
   */
  static async syncSettlementCollectionGL(
    tx: Prisma.TransactionClient,
    params: {
      settlementId: string;
      targetAmount: number;
      vaultAccountId: string;
      receivableAccountId: string;
      memo: string;
      postedBy: string;
      refType?: string;
      /** Tag the AR line with the customer so the AR sub-ledger by party stays complete. */
      customerId?: string | null;
    }
  ) {
    const entries = await tx.journalEntry.findMany({
      where: {
        refId: params.settlementId,
        refType: { in: SETTLEMENT_GL_REF_TYPES },
        status: "posted",
      },
      include: { lines: true },
    });
    const alreadyPosted =
      Math.round(
        entries.reduce(
          (sum, je) =>
            sum +
            je.lines
              .filter((l) => l.accountId === params.vaultAccountId)
              .reduce((a, l) => a + (l.debit - l.credit), 0),
          0
        ) * 100
      ) / 100;
    const target = Math.round((Number(params.targetAmount) || 0) * 100) / 100;
    const delta = Math.round((target - alreadyPosted) * 100) / 100;
    if (Math.abs(delta) < 0.005) return { posted: false, alreadyPosted, delta: 0, journalEntryId: null as string | null };

    const amt = Math.abs(delta);
    const party = params.customerId ? { partyType: "customer", partyId: params.customerId } : {};
    const je = await AccountsPostingService.post({
      memo: delta > 0 ? params.memo : `[Adjustment] ${params.memo} (reduced by PKR ${amt.toLocaleString()})`,
      refType: entries.length === 0 ? params.refType || "settlement_collection" : "settlement_adjustment",
      refId: params.settlementId,
      postedBy: params.postedBy,
      lines:
        delta > 0
          ? [
              { accountId: params.vaultAccountId, debit: amt, credit: 0 },
              { accountId: params.receivableAccountId, debit: 0, credit: amt, ...party },
            ]
          : [
              { accountId: params.receivableAccountId, debit: amt, credit: 0, ...party },
              { accountId: params.vaultAccountId, debit: 0, credit: amt },
            ],
      tx,
    });
    return { posted: true, alreadyPosted, delta, journalEntryId: je.id as string | null };
  }

  /**
   * Record cash handover from field technician to the office accountant.
   * - Confirms (consumes) a field-reported settlement instead of creating a second one.
   * - GL is synced to the received amount via syncSettlementCollectionGL (delta only), so a
   *   settlement already posted by hisaab is not double-posted.
   */
  static async recordTechnicianCashHandover(
    jobId: string,
    settlementId: string | null,
    amountReceived: number,
    actor: string,
    options?: {
      depositAccount?: string;
      notes?: string;
      technicianId?: string;
      amountExpected?: number;
    }
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true, hisaabSettlements: true, customer: true },
    });
    if (!job) throw new Error("Job not found");

    const amount = Number(amountReceived) || 0;
    if (amount <= 0) {
      throw new Error("Amount received must be greater than zero.");
    }
    if (!job.isFoc && job.paymentCollectionMode === "office") {
      throw new Error(
        `Job ${job.jobNumber} is office-collected: the technician holds no cash for it. Record the customer receipt via Accounts (office receipt) instead.`
      );
    }

    const depositAccount = options?.depositAccount || "Cash on Hand (Office Safe)";
    const notes = options?.notes || `Cash collection handed over to Accounts (${actor}) from technician`;

    const [cashAccount, arAccount] = await Promise.all([
      AccountMappingService.resolveAccount({ transactionType: "settlement_collection_vault" }),
      AccountMappingService.resolveAccount({ transactionType: "settlement_collection_receivable" }),
    ]);

    const settlement = await prisma.$transaction(async (tx) => {
      let target =
        settlementId
          ? await tx.hisaabSettlement.findUnique({ where: { id: settlementId } })
          : null;
      if (target && target.jobId !== jobId) throw new Error("Settlement does not belong to this job");

      // No explicit settlement: consume the technician's field report if there is one
      if (!target) {
        const fieldReports = (
          await tx.hisaabSettlement.findMany({ where: { jobId }, orderBy: { settledAt: "desc" } })
        ).filter(isFieldReportedSettlement);
        target = fieldReports[0] || null;
      }

      let saved;
      if (target) {
        const wasFieldReported = isFieldReportedSettlement(target);
        saved = await tx.hisaabSettlement.update({
          where: { id: target.id },
          data: {
            amountReceivedByAccountant: amount,
            accountantReceivedBy: actor,
            accountantReceivedAt: new Date(),
            accountantNotes: wasFieldReported
              ? `${notes} [Confirms field report of PKR ${target.amountCollected.toLocaleString()}]`
              : notes,
            accountantDepositAccount: depositAccount,
            status: "posted",
          },
        });
      } else {
        const t = JobsService.computeJobTotals(job);
        const expected = options?.amountExpected || (await TaxSettingsService.forJob(job, t.gross, t.discount, tx)).total;
        const techId = options?.technicianId || job.assignedTechnicianId || "technician";
        saved = await tx.hisaabSettlement.create({
          data: {
            jobId,
            technicianId: techId,
            amountExpected: expected,
            amountCollected: amount,
            isFull: amount >= expected,
            balanceDue: Math.max(0, expected - amount),
            settledBy: `Direct Office Handover (${actor})`,
            amountReceivedByAccountant: amount,
            accountantReceivedBy: actor,
            accountantReceivedAt: new Date(),
            accountantNotes: notes,
            accountantDepositAccount: depositAccount,
            status: "posted",
          },
        });
      }

      const gl = await JobsService.syncSettlementCollectionGL(tx, {
        settlementId: saved.id,
        targetAmount: amount,
        vaultAccountId: cashAccount.id,
        receivableAccountId: arAccount.id,
        memo: `Technician cash collection handover of PKR ${amount.toLocaleString()} received by ${actor} for Job ${job.jobNumber}`,
        postedBy: actor,
        refType: "settlement_handover",
        customerId: job.isFoc ? null : job.customerId,
      });

      if (target && amount > target.amountCollected) {
        if (!options?.notes || options.notes.trim().length < 5) {
          throw new Error(
            `Amount handed over (PKR ${amount.toLocaleString()}) exceeds the technician's reported collection (PKR ${target.amountCollected.toLocaleString()}). Please provide detailed receipt notes explaining this excess.`
          );
        }
      }

      if (saved.technicianId && gl.delta !== 0) {
        await tx.technicianLedgerEntry.create({
          data: {
            technicianId: saved.technicianId,
            type: "hisaab_received",
            amount: gl.delta,
            refJobId: jobId,
            notes: `Cash collection handed over to Accounts (${actor}) for Job ${job.jobNumber}. Deposit: ${depositAccount}. ${notes}`,
          },
        });
      }

      if (job.customerId && gl.delta !== 0 && !job.isFoc) {
        await SubLedgerService.recordCustomerEntry({
          customerId: job.customerId,
          entryType: "payment",
          documentNumber: `REC-${job.jobNumber}`,
          debit: gl.delta < 0 ? Math.abs(gl.delta) : 0,
          credit: gl.delta > 0 ? gl.delta : 0,
          notes: `Customer collection handed over by technician for Job ${job.jobNumber} (${depositAccount})`,
          journalEntryId: gl.journalEntryId || undefined,
          tx,
        });
      }

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: job.status,
          toStatus: job.status,
          changedBy: actor,
          metaJson: JSON.stringify({
            action: "technician_cash_handover_recorded",
            amountReceived: amount,
            settlementId: saved.id,
            depositAccount,
            notes,
            glDelta: gl.delta,
          }),
        },
      });

      return saved;
    }, TX_OPTS);

    return settlement;
  }

  /**
   * Office / accountant receipt for an office-collected job (paymentCollectionMode "office").
   * Dr Cash/Bank (chosen level-4 asset or customer_payment_receiving) / Cr AR (customer_payment_receivable),
   * customer sub-ledger payment, invoice status -> partially_paid / paid. Technician ledger untouched.
   * Requires the job to be finalized (the invoice + AR exist); outstanding = invoice - receipts.
   */
  static async recordOfficeJobReceipt(
    jobId: string,
    amountReceived: number,
    actorName: string,
    opts?: { receivingAccountCode?: string | null; paymentMethod?: string; notes?: string | null; whtAmount?: number | null }
  ) {
    const amount = Math.round((Number(amountReceived) || 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Receipt amount must be greater than zero.");
    // WHT the customer deducted (Settings > Taxes): settles the invoice too, booked as WHT receivable.
    const whtDeducted = Math.round((Number(opts?.whtAmount) || 0) * 100) / 100;
    if (whtDeducted < 0) throw new Error("WHT deducted cannot be negative.");
    if (whtDeducted > 0 && !(await TaxSettingsService.load()).policy.wht.allowOnCustomerReceipts) {
      throw new Error("Recording customer-deducted WHT is switched off in Settings > Taxes.");
    }
    const settled = Math.round((amount + whtDeducted) * 100) / 100;
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { customer: true } });
    if (!job) throw new Error("Job not found");
    if (job.isFoc) throw new Error("This is an FOC job — record the referring company's payment with 'Record FOC payment'.");
    const invoice = await prisma.invoice.findFirst({ where: { jobId }, orderBy: { createdAt: "desc" } });
    if (!invoice) {
      throw new Error(
        `Job ${job.jobNumber} has no invoice yet. Finalize the job first (that books the receivable), then record the office receipt.`
      );
    }
    if (invoice.status === "paid") throw new Error(`Invoice ${invoice.invoiceNumber} is already fully paid.`);
    const paymentMethod = (opts?.paymentMethod || "bank_transfer").toString();

    return prisma.$transaction(async (tx) => {
      const prior = await tx.journalEntry.findMany({
        where: { refType: "customer_payment", refId: invoice.id, status: "posted" },
        include: { lines: true },
      });
      const alreadyPaid = prior.reduce((sum, je) => {
        const arLine = je.lines.find((l) => l.credit > 0);
        return sum + (arLine?.credit || 0);
      }, 0);
      const outstanding = Math.round((invoice.amount - alreadyPaid) * 100) / 100;
      if (settled > outstanding + 0.01) {
        throw new Error(
          `Receipt (PKR ${settled}) exceeds the outstanding balance (PKR ${outstanding}) of invoice ${invoice.invoiceNumber}.`
        );
      }

      const cashAcc = opts?.receivingAccountCode
        ? await tx.account.findUnique({ where: { code: String(opts.receivingAccountCode) } })
        : await AccountMappingService.resolveAccount({ transactionType: "customer_payment_receiving", prismaClient: tx });
      if (!cashAcc || !cashAcc.isActive || cashAcc.type !== "asset" || cashAcc.level < 4) {
        throw new Error("Receiving account must be an active level-4 asset (cash/bank) account.");
      }
      const arAcc = await AccountMappingService.resolveAccount({
        transactionType: "customer_payment_receivable",
        prismaClient: tx,
      });
      const memo =
        opts?.notes ||
        `Office receipt for Job ${job.jobNumber} / ${invoice.invoiceNumber} via ${paymentMethod.toUpperCase()} (${job.customer?.name || "Customer"})`;
      const journal = await AccountsPostingService.post({
        memo,
        refType: "customer_payment",
        refId: invoice.id,
        postedBy: actorName,
        lines: [
          { accountId: cashAcc.id, debit: amount, credit: 0 },
          ...(whtDeducted > 0
            ? [{ accountId: (await AccountMappingService.resolveAccount({ transactionType: "wht_receivable", prismaClient: tx })).id, debit: whtDeducted, credit: 0 }]
            : []),
          { accountId: arAcc.id, debit: 0, credit: settled },
        ],
        tx,
      });

      const totalNowPaid = Math.round((alreadyPaid + settled) * 100) / 100;
      const fullyPaid = totalNowPaid >= invoice.amount - 0.01;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: fullyPaid ? "paid" : "partially_paid" },
      });

      if (job.customerId) {
        await SubLedgerService.recordCustomerEntry({
          customerId: job.customerId,
          entryType: "payment",
          documentNumber: invoice.invoiceNumber,
          journalEntryId: journal.id,
          debit: 0,
          credit: settled,
          notes: `Office receipt (${paymentMethod}) for Job ${job.jobNumber}${whtDeducted > 0 ? ` incl. WHT PKR ${whtDeducted} deducted by customer` : ""}`,
          tx,
        });
      }

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: job.status,
          toStatus: job.status,
          changedBy: actorName,
          metaJson: JSON.stringify({
            action: "office_receipt_recorded",
            amount,
            paymentMethod,
            invoiceNumber: invoice.invoiceNumber,
            journalEntryId: journal.id,
            outstandingAfter: Math.max(0, Math.round((invoice.amount - totalNowPaid) * 100) / 100),
          }),
        },
      });

      return {
        journal,
        invoiceNumber: invoice.invoiceNumber,
        invoiceAmount: invoice.amount,
        paidToDate: totalNowPaid,
        outstanding: Math.max(0, Math.round((invoice.amount - totalNowPaid) * 100) / 100),
        status: fullyPaid ? "paid" : "partially_paid",
      };
    }, TX_OPTS);
  }

  /** Invoice outstanding for a job (invoice amount minus posted customer receipts). */
  static async getJobReceivableStatus(jobId: string) {
    const invoice = await prisma.invoice.findFirst({ where: { jobId }, orderBy: { createdAt: "desc" } });
    if (!invoice) return null;
    const prior = await prisma.journalEntry.findMany({
      where: { refType: "customer_payment", refId: invoice.id, status: "posted" },
      include: { lines: true },
    });
    const paid = prior.reduce((sum, je) => sum + (je.lines.find((l) => l.credit > 0)?.credit || 0), 0);
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: invoice.amount,
      paid: Math.round(paid * 100) / 100,
      outstanding: Math.max(0, Math.round((invoice.amount - paid) * 100) / 100),
      status: invoice.status,
    };
  }
}

