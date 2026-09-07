import { prisma } from "@/lib/prisma";

export interface FeedbackCallParams {
  jobId: string;
  calledBy: string;
  outcome: "approved" | "disapproved" | "no_answer" | "rescheduled";
  remarks: string;
  followUpDate?: Date | null;
}

export class FeedbackService {
  /**
   * Get queue of jobs needing call center feedback:
   * Verified jobs with either no feedback calls or where the latest call was 'no_answer' / 'rescheduled'
   */
  static async getFeedbackQueue() {
    const verifiedJobs = await prisma.job.findMany({
      where: {
        status: "Verified",
      },
      include: {
        customer: true,
        assignedTechnician: true,
        feedbackCalls: {
          orderBy: { calledAt: "desc" },
        },
      },
      orderBy: { verifiedAt: "desc" },
    });

    // Filter for jobs that still need attention
    return verifiedJobs.filter((job) => {
      if (job.feedbackCalls.length === 0) return true;
      const latest = job.feedbackCalls[0];
      return latest.outcome === "no_answer" || latest.outcome === "rescheduled";
    });
  }

  /**
   * Record customer feedback call
   */
  static async recordFeedback(params: FeedbackCallParams) {
    const { jobId, calledBy, outcome, remarks, followUpDate } = params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new Error("Job not found");

    if (outcome === "disapproved" && (!remarks || remarks.trim().length === 0)) {
      throw new Error("Remarks are strictly required when customer feedback is 'disapproved'.");
    }

    if ((outcome === "no_answer" || outcome === "rescheduled") && !followUpDate) {
      throw new Error("A follow-up date is required when call outcome is 'no_answer' or 'rescheduled'.");
    }

    const call = await prisma.feedbackCall.create({
      data: {
        jobId,
        calledBy,
        outcome,
        remarks,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      },
    });

    // Update job quality flag based on outcome
    if (outcome === "approved") {
      await prisma.job.update({
        where: { id: jobId },
        data: { qualityFlag: "clean" },
      });
    } else if (outcome === "disapproved") {
      // Flag for admin review without disturbing financial postings
      await prisma.job.update({
        where: { id: jobId },
        data: { qualityFlag: "disputed" },
      });
    }

    return call;
  }
}
