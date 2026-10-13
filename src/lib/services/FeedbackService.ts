import { prisma } from "@/lib/prisma";
import { AuditService } from "./AuditService";

export interface FeedbackCallParams {
  jobId: string;
  calledBy: string;
  outcome: "approved" | "disapproved" | "no_answer" | "rescheduled";
  remarks: string;
  /** Notes from calling the assigned technician (required). */
  technicianRemarks: string;
  followUpDate?: Date | null;
}

export class FeedbackService {
  /**
   * Queue of jobs needing call-center feedback AFTER technician complete,
   * BEFORE accountant finalize / auditor verification.
   * Includes AwaitingFeedback plus legacy CompletedPendingVerification with no call yet.
   */
  static async getFeedbackQueue() {
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { status: "AwaitingFeedback" },
          {
            status: "CompletedPendingVerification",
            feedbackCalls: { none: {} },
            finalizedAt: null,
          },
          {
            status: "Verified",
            feedbackCalls: { none: {} },
          },
        ],
      },
      include: {
        customer: true,
        assignedTechnician: true,
        feedbackCalls: {
          orderBy: { calledAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jobs.filter((job) => {
      if (job.feedbackCalls.length === 0) return true;
      const latest = job.feedbackCalls[0];
      return latest.outcome === "no_answer" || latest.outcome === "rescheduled";
    });
  }

  /**
   * Record quality feedback: staff calls customer and technician, writes remarks.
   * On approved/disapproved, advances job to CompletedPendingVerification (accountant queue)
   * or updates qualityFlag on verified jobs.
   */
  static async recordFeedback(params: FeedbackCallParams) {
    const { jobId, calledBy, outcome, remarks, technicianRemarks, followUpDate } = params;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (
      job.status !== "AwaitingFeedback" &&
      job.status !== "CompletedPendingVerification" &&
      job.status !== "Finalized" &&
      job.status !== "Verified"
    ) {
      throw new Error(
        `Feedback is recorded after job complete (AwaitingFeedback, CompletedPendingVerification, Finalized, or Verified). Current status: ${job.status}.`
      );
    }

    if (!remarks || String(remarks).trim().length === 0) {
      throw new Error("Customer call remarks are required.");
    }
    if (!technicianRemarks || String(technicianRemarks).trim().length === 0) {
      throw new Error("Technician call remarks are required (call the assigned technician and note their account).");
    }

    if ((outcome === "no_answer" || outcome === "rescheduled") && !followUpDate) {
      throw new Error("A follow-up date is required when call outcome is 'no_answer' or 'rescheduled'.");
    }

    const combinedRemarks = [
      remarks.trim(),
      `[Technician call] ${String(technicianRemarks).trim()}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const call = await prisma.feedbackCall.create({
      data: {
        jobId,
        calledBy,
        outcome,
        remarks: combinedRemarks,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      },
    });

    if (outcome === "approved" || outcome === "disapproved") {
      const nextStatus =
        job.status === "Verified" || job.status === "Finalized"
          ? job.status
          : "CompletedPendingVerification";

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: nextStatus,
          qualityFlag: outcome === "approved" ? "clean" : "disputed",
        },
      });
      await prisma.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: job.status,
          toStatus: nextStatus,
          changedBy: calledBy,
          metaJson: JSON.stringify({
            action: "feedback_recorded",
            outcome,
            callId: call.id,
          }),
        },
      });

      await AuditService.recordCrudAction({
        actorName: calledBy,
        actorRole: "call_center",
        entityType: "FeedbackCall",
        entityId: call.id,
        entityNumber: job.jobNumber,
        actionType: "CREATE",
        description: `Logged call center quality feedback (${outcome}) for Job ${job.jobNumber}: "${remarks.slice(0, 80)}"`,
        stateBefore: null,
        stateAfter: {
          callId: call.id,
          jobId,
          outcome,
          remarks: combinedRemarks,
          previousJobStatus: job.status,
          newJobStatus: "CompletedPendingVerification",
        },
        canRollback: true,
      });
    }

    return call;
  }
}
