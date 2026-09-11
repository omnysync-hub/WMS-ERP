import { prisma } from "../src/lib/prisma";

async function wipeAllDummyData() {
  console.log("===============================================================");
  console.log("WIPING ALL DUMMY / DEMO OPERATIONAL DATA FROM DATABASE");
  console.log("===============================================================\n");

  console.log("1. Deleting dependent job & operational logs...");
  await prisma.jobStatusHistory.deleteMany();
  await prisma.feedbackCall.deleteMany();
  await prisma.hisaabSettlement.deleteMany();
  await prisma.jobExpenseClaim.deleteMany();
  await prisma.stockReturn.deleteMany();
  await prisma.inventoryRequest.deleteMany();
  await prisma.jobItem.deleteMany();
  await prisma.technicianLedgerEntry.deleteMany();
  await prisma.customerLedgerEntry.deleteMany();
  await prisma.vendorLedgerEntry.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.job.deleteMany();

  console.log("2. Deleting commercial projects & BOQ...");
  await prisma.projectTask.deleteMany();
  await prisma.bOQItem.deleteMany();
  await prisma.project.deleteMany();

  console.log("3. Deleting POS & Retail sales...");
  await prisma.posSaleItem.deleteMany();
  await prisma.posSale.deleteMany();
  await prisma.posRegisterSession.deleteMany();

  console.log("4. Deleting Procurement & Warehouse transactions...");
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequisitionItem.deleteMany();
  await prisma.purchaseRequisition.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.product.deleteMany();

  console.log("5. Deleting Accounting journals & Audit logs...");
  await prisma.financialAuditLog.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.bankStatementLine.deleteMany();
  await prisma.fixedAsset.deleteMany();
  await prisma.rollbackLog.deleteMany();
  await prisma.activityLog.deleteMany();

  console.log("6. Deleting HRM, Payroll & Workforce records...");
  await prisma.grievanceComment.deleteMany();
  await prisma.grievanceStatusHistory.deleteMany();
  await prisma.grievanceTicket.deleteMany();
  await prisma.assetAssignment.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.companyHoliday.deleteMany();
  await prisma.exitInterview.deleteMany();
  await prisma.finalSettlement.deleteMany();
  await prisma.offboardingChecklist.deleteMany();
  await prisma.onboardingChecklist.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.candidateInterview.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobRequisition.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.employeeAdvance.deleteMany();

  console.log("7. Deleting Demo Master Entities (Customers, Vendors, Employees)...");
  await prisma.careOfParty.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.employee.deleteMany();

  console.log("8. Resetting Company Settings to clean initial state...");
  const settings = await prisma.companySettings.findFirst();
  if (settings) {
    await prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        isSetupCompleted: false,
        goLiveDate: null,
      },
    });
  }

  console.log("\n===============================================================");
  console.log("DATABASE WIPE COMPLETED SUCCESSFULLY!");
  console.log("===============================================================");
}

wipeAllDummyData()
  .catch((err) => {
    console.error("FATAL ERROR WIPING DATABASE:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
