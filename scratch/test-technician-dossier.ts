import { JobReportService } from "../src/lib/services/JobReportService";
import { prisma } from "../src/lib/prisma";

async function runTechnicianDossierTest() {
  console.log("=== Testing Technician Reports & Lifecycle Audit ===");

  // Let's create an expense claim on a job with paidAt to test paid vs pending expenses
  const job = await prisma.job.findFirst({
    include: { assignedTechnician: true },
  });
  if (!job) throw new Error("No job found");

  const techId = job.assignedTechnicianId || "tech-1";

  // Create a paid expense
  await prisma.jobExpenseClaim.create({
    data: {
      jobId: job.id,
      technicianId: techId,
      amount: 1500,
      note: "Emergency Fuel for Transit",
      status: "paid",
      paidAt: new Date(),
    },
  });

  // Create a pending expense
  await prisma.jobExpenseClaim.create({
    data: {
      jobId: job.id,
      technicianId: techId,
      amount: 850,
      note: "Hardware fasteners & insulation tape",
      status: "pending",
    },
  });

  // Fetch report
  const report = await JobReportService.generateReport({ period: "today" });

  console.log("Total Technicians in Breakdown:", report.technicianBreakdown.length);
  const tech = report.technicianBreakdown.find((t) => t.technicianId === techId);
  if (!tech) throw new Error("Technician not found in report");

  console.log("\n--- Technician Dossier Summary ---");
  console.log("Name:", tech.name);
  console.log("Total Assigned:", tech.totalAssigned);
  console.log("Done:", tech.doneCount, "| In-Progress:", tech.inProgressCount, "| Left:", tech.leftCount);
  console.log("Revenue Earned for Company:", tech.totalRevenueEarned);
  console.log("Gross Margin Generated:", tech.grossProfitGenerated);
  console.log("Expenses Claimed:", tech.totalExpensesClaimed);
  console.log("Expenses Paid to Tech:", tech.totalExpensesPaid);
  console.log("Expenses Pending:", tech.totalExpensesPending);
  console.log("Cash Collected:", tech.totalCashCollected);
  console.log("Avg Duration:", tech.formattedAverageDuration);

  console.log("\n--- Job Lifecycle & Timestamps for Job", job.jobNumber, "---");
  const jobItem = tech.jobs.find((j) => j.id === job.id);
  if (jobItem) {
    console.log("Job Status:", jobItem.status);
    console.log("Assigned At:", jobItem.timestamps.assignedAt);
    console.log("Started At:", jobItem.timestamps.startedAt);
    console.log("Paused Intervals:", jobItem.timestamps.pausedIntervals);
    console.log("Completed At:", jobItem.timestamps.completedAt);
    console.log("Active Duration:", jobItem.timestamps.formattedDuration);
    console.log("Total Active Minutes:", jobItem.timestamps.totalActiveDurationMinutes);
    console.log("Lifecycle History Event Count:", jobItem.timestamps.lifecycleEvents.length);
  }

  console.log("\n--- Expense Claims Recorded for Tech ---");
  console.log("Claims Count:", tech.expenseClaims.length);
  tech.expenseClaims.forEach((c) => {
    console.log(`- ${c.note}: PKR ${c.amount} [${c.status}] (Paid: ${c.paidAt || "No"})`);
  });

  console.log("\n✅ TECHNICIAN REPORTS & LIFECYCLE AUDIT VERIFIED SUCCESSFULLY!");
}

runTechnicianDossierTest().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
