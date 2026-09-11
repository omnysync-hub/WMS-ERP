import { JobReportService } from "../src/lib/services/JobReportService";
import { prisma } from "../src/lib/prisma";

async function testWithMonth() {
  const jobs = await prisma.job.findMany({ select: { id: true, jobNumber: true, createdAt: true, assignedTechnicianId: true } });
  console.log("Existing Jobs:", jobs);

  const report = await JobReportService.generateReport({ period: "this_month" });
  console.log("This Month Technicians:", report.technicianBreakdown.map((t) => ({
    name: t.name,
    assigned: t.totalAssigned,
    done: t.doneCount,
    inProgress: t.inProgressCount,
    left: t.leftCount,
    revenue: t.totalRevenueEarned,
    expenses: t.totalExpensesClaimed,
    expensesPaid: t.totalExpensesPaid,
    expensesPending: t.totalExpensesPending,
    avgDuration: t.formattedAverageDuration,
  })));

  // If there are jobs in this_month, print timestamps
  const techWithJobs = report.technicianBreakdown.find((t) => t.totalAssigned > 0);
  if (techWithJobs && techWithJobs.jobs[0]) {
    const j = techWithJobs.jobs[0];
    console.log(`Timestamps for ${techWithJobs.name}'s job ${j.jobNumber}:`, {
      assignedAt: j.timestamps.assignedAt,
      startedAt: j.timestamps.startedAt,
      completedAt: j.timestamps.completedAt,
      formattedDuration: j.timestamps.formattedDuration,
    });
  }
}

testWithMonth().catch(console.error).finally(() => process.exit(0));
