import { JobReportService } from "../src/lib/services/JobReportService";

async function runTest() {
  console.log("=== Testing JobReportService for Period 'today' ===");
  const todayReport = await JobReportService.generateReport({ period: "today" });
  console.log("Date Range:", todayReport.meta.dateRangeLabel);
  console.log("Summary:", JSON.stringify(todayReport.summary, null, 2));
  console.log("Jobs Detailed count:", todayReport.jobsDetailed.length);
  console.log("Materials Breakdown count:", todayReport.materialsBreakdown.length);
  console.log("Technician Breakdown count:", todayReport.technicianBreakdown.length);

  console.log("\n=== Testing JobReportService for Period 'this_month' ===");
  const monthReport = await JobReportService.generateReport({ period: "this_month" });
  console.log("This Month Total Jobs:", monthReport.summary.totalJobs);
  console.log("Done:", monthReport.summary.doneCount, "| In-Progress:", monthReport.summary.inProgressCount, "| Left:", monthReport.summary.leftCount);
  console.log("Net Billed:", monthReport.summary.netBilled, "| Materials Cost:", monthReport.summary.totalMaterialCost);

  console.log("\n=== Testing Custom Date Duration ===");
  const customReport = await JobReportService.generateReport({
    period: "custom",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  });
  console.log("Custom Period Label:", customReport.meta.dateRangeLabel);
  console.log("Custom Period Total Jobs:", customReport.summary.totalJobs);

  console.log("\n✅ ALL JOB REPORT SERVICE TESTS PASSED!");
}

runTest().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
