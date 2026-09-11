import { prisma } from "../src/lib/prisma";
import { JobReportService } from "../src/lib/services/JobReportService";

async function testIssuedMaterials() {
  // Find a job
  const job = await prisma.job.findFirst();
  if (!job) throw new Error("No job found");

  const tech = await prisma.employee.findFirst({ where: { role: "technician" } });

  // Create an issued inventory request
  await prisma.inventoryRequest.create({
    data: {
      jobId: job.id,
      technicianId: tech?.id || job.assignedTechnicianId || "tech-1",
      item: "Copper Piping 1/2 inch",
      qtyRequested: 15,
      status: "issued",
    },
  });

  // Create another issued inventory request
  await prisma.inventoryRequest.create({
    data: {
      jobId: job.id,
      technicianId: tech?.id || job.assignedTechnicianId || "tech-1",
      item: "Capacitor 45uF",
      qtyRequested: 2,
      status: "issued",
    },
  });

  // Create a stock return
  await prisma.stockReturn.create({
    data: {
      jobId: job.id,
      technicianId: tech?.id || job.assignedTechnicianId || "tech-1",
      item: "Copper Piping 1/2 inch",
      qtyReturned: 3,
      acknowledgedBy: "Storekeeper Tariq",
      acknowledgedAt: new Date(),
    },
  });

  console.log("Generating report after issuing materials...");
  const report = await JobReportService.generateReport({ period: "today" });
  console.log("Materials Breakdown length:", report.materialsBreakdown.length);
  console.log("Materials Breakdown:", JSON.stringify(report.materialsBreakdown, null, 2));

  const jobDetail = report.jobsDetailed.find((j) => j.id === job.id);
  console.log("Job Issued Materials:", JSON.stringify(jobDetail?.issuedMaterials, null, 2));
}

testIssuedMaterials().catch(console.error).finally(() => process.exit(0));
