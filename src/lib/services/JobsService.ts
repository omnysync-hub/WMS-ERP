import { prisma } from "../prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";
import { InventoryService } from "./InventoryService";
import { SubLedgerService } from "./SubLedgerService";
import { MobilePushService } from "./MobilePushService";
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
    if (!canChangeTechnician(job)) {
      throw new Error(
        `Cannot assign a technician to a job in status '${job.status}'. Assignment is only allowed before start (Created/Assigned) or via reassign mid-job (${JOB_REASSIGNABLE_STATUSES.join("/")}).`
      );
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

    const primaryId = primaryTechnicianId && ids.includes(primaryTechnicianId) ? primaryTechnicianId : ids[0];
    if (
      isReassignableStatus(job.status) &&
      job.assignedTechnicianId &&
      primaryId !== job.assignedTechnicianId
    ) {
      throw new Error(
        "Mid-job lead technician change requires reassignment (creates a new linked job). Use action 'reassign'."
      );
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
    if (!isReassignableStatus(job.status)) {
      throw new Error(
        isPreStartStatus(job.status)
          ? `Job is '${job.status}' (not started yet) — change the technician with a direct assign instead of reassign.`
          : `Cannot reassign a job in status '${job.status}'. Reassign is only allowed while the job is ${JOB_REASSIGNABLE_STATUSES.join(", ")}.`
      );
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
   * Resume gate from Paused state (soft / advisory only).
   * Business rule (confirmed): stock normally stays on site with the technician on pause
   * (return is rare/optional). Partial hisaab with accountant is optional — not a hard gate.
   * Resume must NOT require stock-return acknowledgment or hisaab.
   */
  static async verifyResumeAllowed(_jobId: string) {
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

    // Proof-of-work photos are mandatory (server-side; mobile no longer offers "Finish without")
    // Cap + keep only image-ish strings (data: or http) - avoid blowing the row with junk
    const photos = (completionDetails?.photos ?? [])
      .filter((p) => typeof p === "string" && /^(data:image\/|https?:\/\/)/i.test(p))
      .slice(0, 12);
    if (photos.length === 0) {
      throw new Error(
        "Cannot complete: at least one proof-of-work photo is required (data:image/... or https URL)."
      );
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
      parts.push(`Proof photos: ${photos.length}`);
      if (parts.length > 0) {
        newRemarks = newRemarks ? `${newRemarks} | ${parts.join(" • ")}` : parts.join(" • ");
      }
    }

    const means = completionDetails?.paymentMeans;
    const collected =
      means && means !== "unmarked" ? Number(completionDetails?.paymentAmount) || 0 : 0;

    await prisma.$transaction(async (tx) => {
      // Status guard: only one completion wins (double-tap / offline replay safe)
      const claimed = await tx.job.updateMany({
        where: { id: jobId, status: "InProgress" },
        data: {
          status: "AwaitingFeedback",
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
          let expected = 0;
          for (const it of items) {
            const qty = it.quantityActual ?? it.quantityPlanned;
            expected += qty * it.unitRate;
          }
          expected = Math.max(0, expected - (job.discountAmount || 0));

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

    const { gross, discount, net: finalAmount } = this.computeJobTotals(job);

    // Resolve accounts via AccountMappingService (read-only, before the write transaction)
    const arAccount = await AccountMappingService.resolveAccount({
      transactionType: "job_revenue_receivable",
      categoryScope: job.jobType,
    });
    const revAccount = await AccountMappingService.resolveAccount({
      transactionType: "job_revenue_sales",
      categoryScope: job.jobType,
    });
    const discountAccount =
      discount > 0
        ? await AccountMappingService.resolveAccount({
            transactionType: "job_revenue_discount",
            categoryScope: job.jobType,
          })
        : null;

    const postingLines: { accountId: string; debit: number; credit: number }[] = [];
    if (discount > 0 && discountAccount) {
      postingLines.push({ accountId: arAccount.id, debit: finalAmount, credit: 0 });
      postingLines.push({ accountId: discountAccount.id, debit: discount, credit: 0 });
      postingLines.push({ accountId: revAccount.id, debit: 0, credit: gross });
    } else {
      postingLines.push({ accountId: arAccount.id, debit: finalAmount, credit: 0 });
      postingLines.push({ accountId: revAccount.id, debit: 0, credit: finalAmount });
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
      const bookedGross =
        Math.round(
          activeRevenue.reduce(
            (sum, je) =>
              sum +
              je.lines
                .filter((l) => l.accountId === revAccount.id)
                .reduce((a, l) => a + (l.credit - l.debit), 0),
            0
          ) * 100
        ) / 100;
      const expectedGross = discount > 0 && discountAccount ? gross : finalAmount;
      const glUnchanged =
        activeRevenue.length > 0 &&
        Math.abs(bookedNet - finalAmount) < 0.005 &&
        Math.abs(bookedGross - expectedGross) < 0.005;

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
        const invoiceCount = await tx.invoice.count();
        invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, "0")}`;
        await tx.invoice.create({
          data: {
            invoiceNumber,
            jobId: job.id,
            customerId: job.customerId,
            customerName: job.customer.name,
            amount: finalAmount,
            status: "unpaid",
          },
        });

        if (finalAmount > 0) {
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
      } else if (Math.abs((existingInvoice.amount || 0) - finalAmount) >= 0.005) {
        const invoiceDelta = Math.round((finalAmount - (existingInvoice.amount || 0)) * 100) / 100;
        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: { amount: finalAmount },
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
            invoiceAmountBefore,
            glUnchanged,
            reversedEntryIds,
            revenueEntryId,
          }),
        },
      });

      return tx.job.findUnique({ where: { id: jobId } });
    }, TX_OPTS);

    return result!;
  }

  /**
   * Admin verification:
   * Checklist-gated approval (work confirmed / payment reconciled / inventory returned).
   * Feedback (call center) already ran after complete; this is the auditor/admin checklist gate.
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
   * Auditor / supervisor send-back (LOGICS supervisor-override):
   * Unlocks a Finalized job back to CompletedPendingVerification with a required note.
   * GL is left as-is here; on re-finalize, finalizeJob recomputes the total and, if it changed,
   * updates the invoice and reverses + re-posts the revenue JE in one transaction.
   */
  static async sendBackFromVerification(jobId: string, actorName: string, note: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "Finalized" || !job.finalizedAt) {
      throw new Error(
        `Only Finalized jobs can be sent back from verification. Current status: ${job.status}.`
      );
    }
    const reason = (note || "").trim();
    if (!reason) {
      throw new Error("A send-back note is required (supervisor override reason).");
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "CompletedPendingVerification",
        finalizedAt: null,
        qualityFlag: "sent_back",
        verifiedAt: null,
        verifiedChecklist: null,
      },
    });

    await this.logStatusChange(jobId, "Finalized", "CompletedPendingVerification", actorName, {
      action: "verification_send_back",
      note: reason,
      supervisorOverride: true,
    });

    return updated;
  }

  /**
   * Jobs awaiting auditor action: Finalized (post-accountant lock), not yet Verified.
   * CompletedPendingVerification waits on accountant finalize â€” not in this queue.
   */
  static async getVerificationQueue(opts?: { search?: string; includeSentBack?: boolean }) {
    const where: any = {
      status: "Finalized",
      finalizedAt: { not: null },
    };
    if (!opts?.includeSentBack) {
      where.OR = [{ qualityFlag: null }, { qualityFlag: { not: "sent_back" } }];
    }
    if (opts?.search) {
      const q = opts.search;
      const searchClause = [
        { jobNumber: { contains: q } },
        { remarks: { contains: q } },
        { customer: { name: { contains: q } } },
      ];
      const baseOr = where.OR;
      delete where.OR;
      const andParts: any[] = [];
      if (baseOr) andParts.push({ OR: baseOr });
      andParts.push({ OR: searchClause });
      where.AND = andParts;
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
        statusHistory: { orderBy: { changedAt: "desc" }, take: 5 },
      },
      orderBy: { finalizedAt: "asc" },
    });
  }

  static async countPendingVerifications() {
    return prisma.job.count({
      where: {
        status: "Finalized",
        finalizedAt: { not: null },
        OR: [{ qualityFlag: null }, { qualityFlag: { not: "sent_back" } }],
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

    if (requestId) {
      const invReq = await prisma.inventoryRequest.findUnique({ where: { id: requestId } });
      if (!invReq) throw new Error("Inventory request not found.");
      if (invReq.status === "issued") {
        throw new Error(`Inventory request for '${invReq.item}' has already been issued.`);
      }
      if (invReq.status === "rejected") {
        throw new Error(`Cannot issue rejected inventory request.`);
      }
      if (qty > invReq.qtyRequested) {
        throw new Error(
          `Cannot issue more than the requested stock quantity (${invReq.qtyRequested} units requested, attempted to issue ${qty}).`
        );
      }
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
        title: `Parts ready — ${job.jobNumber}`,
        body: `${qty} x ${product.name} is ready. Open the job to check.`,
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
      if (existing.jobId && existing.jobId !== job.id) {
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
    if (Math.abs(delta) < 0.005) return { posted: false, alreadyPosted, delta: 0 };

    const amt = Math.abs(delta);
    await AccountsPostingService.post({
      memo: delta > 0 ? params.memo : `[Adjustment] ${params.memo} (reduced by PKR ${amt.toLocaleString()})`,
      refType: entries.length === 0 ? params.refType || "settlement_collection" : "settlement_adjustment",
      refId: params.settlementId,
      postedBy: params.postedBy,
      lines:
        delta > 0
          ? [
              { accountId: params.vaultAccountId, debit: amt, credit: 0 },
              { accountId: params.receivableAccountId, debit: 0, credit: amt },
            ]
          : [
              { accountId: params.receivableAccountId, debit: amt, credit: 0 },
              { accountId: params.vaultAccountId, debit: 0, credit: amt },
            ],
      tx,
    });
    return { posted: true, alreadyPosted, delta };
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
        const { net } = JobsService.computeJobTotals(job);
        const expected = options?.amountExpected || net;
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

      if (job.customerId && gl.delta > 0) {
        await SubLedgerService.recordCustomerEntry({
          customerId: job.customerId,
          entryType: "payment",
          documentNumber: `REC-${job.jobNumber}`,
          debit: 0,
          credit: gl.delta,
          notes: `Customer collection handed over by technician for Job ${job.jobNumber} (${depositAccount})`,
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
}

