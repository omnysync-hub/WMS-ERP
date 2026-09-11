import { prisma } from "../src/lib/prisma";
import { AccountsPostingService } from "../src/lib/services/AccountsPostingService";
import { JobsService } from "../src/lib/services/JobsService";
import { InventoryService } from "../src/lib/services/InventoryService";
import { AttendanceService } from "../src/lib/services/AttendanceService";
import { FeedbackService } from "../src/lib/services/FeedbackService";
import { HrmService } from "../src/lib/services/HrmService";

async function runVerification() {
  console.log("==================================================");
  console.log("RUNNING WORKMAN SERVICES ERP CORE LOGIC TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: ACCOUNTS POSTING ENGINE - Balanced entry
  try {
    const cash = await AccountsPostingService.getAccountByCode("1000");
    const equity = await AccountsPostingService.getAccountByCode("3000");

    const entry = await AccountsPostingService.post({
      memo: "Initial Capital Injection Test",
      refType: "capital_injection",
      lines: [
        { accountId: cash.id, debit: 5000, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 5000 },
      ],
    });
    assert(entry.lines.length === 2 && entry.memo.includes("Initial Capital"), "AccountsPostingService posts balanced entry");
  } catch (err: any) {
    assert(false, `AccountsPostingService balanced entry threw error: ${err.message}`);
  }

  // TEST 2: ACCOUNTS POSTING ENGINE - Rejects unbalanced entry
  try {
    const cash = await AccountsPostingService.getAccountByCode("1000");
    const equity = await AccountsPostingService.getAccountByCode("3000");

    await AccountsPostingService.post({
      memo: "Unbalanced Entry Test",
      refType: "test",
      lines: [
        { accountId: cash.id, debit: 5000, credit: 0 },
        { accountId: equity.id, debit: 0, credit: 4000 }, // unbalanced by 1000
      ],
    });
    assert(false, "AccountsPostingService should reject unbalanced entries");
  } catch (err: any) {
    assert(err.message.includes("unbalanced"), "AccountsPostingService correctly rejects unbalanced entries");
  }

  // TEST 3: JOB STATE MACHINE & MANDATORY RESUME GATE
  try {
    const customer = await prisma.customer.findFirst();
    const tech = await prisma.employee.findFirst({ where: { role: "technician" } });

    if (!customer || !tech) throw new Error("Missing test customer or technician");

    // Create a new job
    const job = await prisma.job.create({
      data: {
        jobNumber: `TEST-${Date.now()}`,
        customerId: customer.id,
        jobType: "repair",
        remarks: "Verification Test AC Repair",
        status: "Created",
        items: {
          create: [
            { description: "Test Compressor Replacement", quantityPlanned: 1, unitRate: 300 },
          ],
        },
      },
    });

    // Assign
    await JobsService.assignTechnician(job.id, tech.id, "Test Dispatcher");
    // Accept
    await JobsService.acceptJob(job.id, tech.id);
    // Start
    await JobsService.startJob(job.id, tech.id, 25.2048, 55.2708);
    // Pause
    await JobsService.pauseJob(job.id, tech.id, "Need additional parts tomorrow");

    // ATTEMPT RESUME WITHOUT STOCK RETURN / HISAAB -> MUST FAIL!
    let resumeFailedAsExpected = false;
    try {
      await JobsService.startJob(job.id, tech.id, 25.2048, 55.2708);
    } catch (e: any) {
      resumeFailedAsExpected = true;
    }
    assert(resumeFailedAsExpected, "Resume blocked when StockReturn/Hisaab not completed");

    // Fulfill Stock Return & Acknowledge
    const stockRet = await prisma.stockReturn.create({
      data: {
        jobId: job.id,
        technicianId: tech.id,
        item: "GAS-R410A",
        qtyReturned: 1,
      },
    });
    await InventoryService.acknowledgeStockReturn(stockRet.id, "Storekeeper Bilal");

    // Record Hisaab
    await prisma.hisaabSettlement.create({
      data: {
        jobId: job.id,
        technicianId: tech.id,
        amountExpected: 300,
        amountCollected: 300,
        isFull: true,
        settledBy: "Accountant Fatima",
      },
    });

    // NOW RESUME MUST SUCCEED!
    await JobsService.startJob(job.id, tech.id, 25.2048, 55.2708);
    const resumedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert(resumedJob?.status === "InProgress", "Resume succeeds after StockReturn acknowledged & Hisaab recorded");

    // TEST 4: COMPLETION REQUIRES ACTUAL QUANTITY
    const items = await prisma.jobItem.findMany({ where: { jobId: job.id } });
    let completeFailedWithoutActual = false;
    try {
      await JobsService.completeJob(job.id, tech.id, [
        { id: items[0].id, quantityActual: null as any },
      ]);
    } catch (e) {
      completeFailedWithoutActual = true;
    }
    assert(completeFailedWithoutActual, "Completion blocked if actual quantity is null");

    // Complete with actual quantity
    await JobsService.completeJob(job.id, tech.id, [
      { id: items[0].id, quantityActual: 1 },
    ]);
    const completedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert(completedJob?.status === "CompletedPendingVerification", "Job moves to CompletedPendingVerification with actual quantities");

    // TEST 5: ACCOUNTANT FINALIZE LOCKS JOB & POSTS REVENUE
    await JobsService.finalizeJob(job.id, "Accountant Fatima");
    const finalizedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert(finalizedJob?.status === "Finalized" && finalizedJob?.finalizedAt !== null, "Finalize locks job into read-only with finalizedAt timestamp");

    // Check Invoice was created
    const invoice = await prisma.invoice.findFirst({ where: { jobId: job.id } });
    assert(invoice !== null && invoice.amount === 300, "Invoice created with actual amount from actual quantities");

    // TEST 6: ADMIN VERIFICATION & AUTOMATIC CALL CENTER FEEDBACK QUEUE
    await JobsService.verifyJob(job.id, "Admin Haris", {
      workConfirmed: true,
      paymentReconciled: true,
      inventoryReturned: true,
    });
    const verifiedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert(verifiedJob?.status === "Verified", "Admin checklist verifies job to terminal Verified state");

    // Queue check: Verified job should be in Call Center feedback queue
    const feedbackQueue = await FeedbackService.getFeedbackQueue();
    const isInQueue = feedbackQueue.some((q) => q.id === job.id);
    assert(isInQueue, "Verified job automatically appears in Call Center feedback queue");

    // Customer Disapproval sets qualityFlag = 'disputed'
    await FeedbackService.recordFeedback({
      jobId: job.id,
      calledBy: "Sara Call Center",
      outcome: "disapproved",
      remarks: "Customer reported minor cooling duct rattle",
    });
    const disputedJob = await prisma.job.findUnique({ where: { id: job.id } });
    assert(disputedJob?.qualityFlag === "disputed", "Call Center disapproval sets qualityFlag = 'disputed' for Admin review");

  } catch (err: any) {
    assert(false, `Job lifecycle verification failed: ${err.message}`);
  }

  // TEST 7: ATTENDANCE (FACE + GEOFENCE)
  try {
    const tech = await prisma.employee.findFirst({ where: { role: "technician" } });
    if (!tech) throw new Error("No tech for attendance test");

    const zone = await prisma.geofenceZone.findFirst();
    const zoneLat = zone?.lat || 31.5204;
    const zoneLng = zone?.lng || 74.3587;

    // Pass: High face score + inside geofence
    const passResult = await AttendanceService.recordAttendance({
      employeeId: tech.id,
      faceMatchScore: 95.5,
      lat: zoneLat,
      lng: zoneLng,
      notes: "Test Pass Attendance",
    });
    assert(passResult.success === true && passResult.result === "pass", "Attendance passes when face >= 90% and inside geofence");

    // Fail: Low face score or out of bounds
    const failResult = await AttendanceService.recordAttendance({
      employeeId: tech.id,
      faceMatchScore: 65,
      lat: zoneLat + 0.5,
      lng: zoneLng + 0.5,
      notes: "Test Fail Attendance",
    });
    assert(failResult.success === false && failResult.result === "fail", "Attendance fails when out of bounds/low score and logs to audit");

  } catch (err: any) {
    assert(false, `Attendance verification failed: ${err.message}`);
  }

  // TEST 14: ITEM-LEVEL DISCOUNT REQUEST & ACCOUNTANT APPROVAL
  try {
    const customer = await prisma.customer.findFirst();
    const tech = await prisma.employee.findFirst({ where: { role: "technician" } });
    if (!customer || !tech) throw new Error("Missing test customer or technician");

    const testJob = await prisma.job.create({
      data: {
        jobNumber: `TEST-DISC-${Date.now()}`,
        customerId: customer.id,
        assignedTechnicianId: tech.id,
        jobType: "repair",
        status: "InProgress",
        items: {
          create: [
            { description: "Test Compressor 2.5 HP", quantityPlanned: 1, unitRate: 200 },
          ],
        },
      },
      include: { items: true },
    });

    const item = testJob.items[0];

    // Technician requests discount
    await JobsService.requestItemDiscount(
      testJob.id,
      item.id,
      30,
      "Customer price match",
      tech.name
    );

    const afterRequest = await prisma.jobItem.findUnique({ where: { id: item.id } });
    assert(
      Boolean(afterRequest?.description.includes("[Discount Requested: $30")),
      "Technician successfully requests item-level discount"
    );

    // Accountant grants discount
    await JobsService.giveItemDiscount(
      testJob.id,
      item.id,
      30,
      "Fatima Noor (Accountant)"
    );

    const afterApproval = await prisma.jobItem.findUnique({ where: { id: item.id } });
    assert(
      Boolean(afterApproval?.unitRate === 170 && afterApproval?.description.includes("[Discount Approved: -$30")),
      "Accountant grants item discount and updates unit rate live ($200 -> $170)"
    );

    // Clean up test job
    await prisma.jobItem.deleteMany({ where: { jobId: testJob.id } });
    await prisma.jobStatusHistory.deleteMany({ where: { jobId: testJob.id } });
    await prisma.job.delete({ where: { id: testJob.id } });
  } catch (err: any) {
    assert(false, `Item discount verification failed: ${err.message}`);
  }

  // TEST 15: EXPENSE SETTLEMENT WITH PARTIAL PAYOUT & GAAP POSTING
  try {
    const customer = await prisma.customer.findFirst();
    const tech = await prisma.employee.findFirst({ where: { role: "technician" } });
    if (!customer || !tech) throw new Error("Missing test customer or technician");

    const settlementJob = await prisma.job.create({
      data: {
        jobNumber: `TEST-SETTLE-${Date.now()}`,
        customerId: customer.id,
        assignedTechnicianId: tech.id,
        jobType: "maintenance",
        status: "CompletedPendingVerification",
        items: {
          create: [{ description: "AC Filter Service", quantityPlanned: 1, quantityActual: 1, unitRate: 150 }],
        },
      },
    });

    // Create a $100 field expense claim
    const claim = await prisma.jobExpenseClaim.create({
      data: {
        jobId: settlementJob.id,
        technicianId: tech.id,
        amount: 100,
        note: "Gas recharge valve and sealant",
        status: "pending",
      },
    });

    // Settle with PARTIAL PAYOUT: Accountant only has $40 cash on hand, $60 remains unpaid
    const totalApproved = 100;
    const amountDisbursed = 40;
    const remainingUnpaid = 60;

    const expenseCostingAccount = await AccountsPostingService.getAccountByCode("6100");
    const disbursingAccount = await AccountsPostingService.getAccountByCode("1000");
    const techPayableAccount = await AccountsPostingService.getAccountByCode("2100");

    const entry = await AccountsPostingService.post({
      memo: `Partial settlement test: $40 disbursed, $60 carried to Tech Payable`,
      refType: "test_settlement",
      refId: settlementJob.id,
      lines: [
        { accountId: expenseCostingAccount.id, debit: totalApproved, credit: 0 },
        { accountId: disbursingAccount.id, debit: 0, credit: amountDisbursed },
        { accountId: techPayableAccount.id, debit: 0, credit: remainingUnpaid },
      ],
    });

    assert(
      entry.lines.length === 3 && Math.abs(totalApproved - (amountDisbursed + remainingUnpaid)) < 0.01,
      "Partial payout posts perfectly balanced double-entry (Debit 6100 Costing $100, Credit 1000 Cash $40, Credit 2100 Tech Payable $60)"
    );

    // Sync & Lock Job
    const finalized = await JobsService.finalizeJob(settlementJob.id, "Fatima Noor (Accountant)");
    assert(
      finalized.status === "Finalized" && finalized.finalizedAt !== null,
      "Sync & Lock record locks job into immutable read-only state"
    );

    // Clean up
    await prisma.journalLine.deleteMany({ where: { journalEntryId: entry.id } });
    await prisma.journalEntry.delete({ where: { id: entry.id } });
    await prisma.invoice.deleteMany({ where: { jobId: settlementJob.id } });
    await prisma.jobExpenseClaim.deleteMany({ where: { jobId: settlementJob.id } });
    await prisma.jobItem.deleteMany({ where: { jobId: settlementJob.id } });
    await prisma.jobStatusHistory.deleteMany({ where: { jobId: settlementJob.id } });
    await prisma.job.delete({ where: { id: settlementJob.id } });
  } catch (err: any) {
    assert(false, `Partial payout settlement verification failed: ${err.message}`);
  }

  // TEST 18: LEAVE MANAGEMENT - Request, Balance Deduction & On Leave status
  try {
    const testEmployee = await HrmService.createEmployee({
      name: "Test Leave Staff",
      phone: "+971 50 999 1111",
      role: "technician",
      department: "Operations",
      salary: 5000,
    });

    const annualType = await prisma.leaveType.findFirst({ where: { name: "Annual Leave" } });
    const initialBalance = await prisma.leaveBalance.findFirst({
      where: { employeeId: testEmployee.id, leaveTypeId: annualType!.id },
    });

    const leaveReq = await HrmService.requestLeave({
      employeeId: testEmployee.id,
      leaveTypeId: annualType!.id,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      reason: "Urgent personal leave test",
    });

    assert(leaveReq.status === "Pending", "Leave request submitted with status Pending");

    const approved = await HrmService.approveLeave(leaveReq.id, "Haris Qureshi (Director)");
    const updatedBalance = await prisma.leaveBalance.findFirst({
      where: { employeeId: testEmployee.id, leaveTypeId: annualType!.id },
    });
    const updatedEmp = await prisma.employee.findUnique({ where: { id: testEmployee.id } });

    assert(
      approved.status === "Approved" &&
        updatedBalance!.balance === initialBalance!.balance - leaveReq.daysCount &&
        updatedEmp!.status === "On Leave",
      "Leave approval deducts running balance and sets employee status to 'On Leave'"
    );

    // Clean up
    await prisma.leaveRequest.delete({ where: { id: leaveReq.id } });
    await prisma.leaveBalance.deleteMany({ where: { employeeId: testEmployee.id } });
    await prisma.onboardingChecklist.deleteMany({ where: { employeeId: testEmployee.id } });
    await prisma.employee.delete({ where: { id: testEmployee.id } });
  } catch (err: any) {
    assert(false, `Leave management test failed: ${err.message}`);
  }

  // TEST 19: OFFBOARDING & EXIT - Balanced Double-Entry Final Settlement
  try {
    const exitEmp = await HrmService.createEmployee({
      name: "Exit Test Staff",
      phone: "+971 50 888 2222",
      role: "technician",
      department: "Operations",
      salary: 6000,
    });

    // Record advance
    await prisma.employeeAdvance.create({
      data: {
        employeeId: exitEmp.id,
        amount: 500,
        status: "approved",
        approvedBy: "Director",
      },
    });

    const settlement = await HrmService.calculateAndPostFinalSettlement({
      employeeId: exitEmp.id,
      proRatedSalary: 2000,
      leaveEncashmentDays: 5,
      dailyRate: 200, // 5 * 200 = 1000. Gross = 3000
      advanceDeduction: 500, // Net = 2500
      disbursingAccountCode: "1010",
      settledBy: "Fatima Noor (Accountant)",
    });

    const settlementJournal = await prisma.journalEntry.findUnique({
      where: { id: settlement.journalEntryId! },
      include: { lines: true },
    });

    const totalDebits = settlementJournal!.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = settlementJournal!.lines.reduce((s, l) => s + l.credit, 0);
    const checkEmp = await prisma.employee.findUnique({ where: { id: exitEmp.id } });

    assert(
      Math.abs(totalDebits - 3000) < 0.01 &&
        Math.abs(totalCredits - 3000) < 0.01 &&
        settlement.netAmount === 2500 &&
        checkEmp!.status === "Inactive",
      "Offboarding final settlement posts balanced double-entry (Dr Salary 3000, Cr Advance 500, Cr Bank 2500) and marks employee Inactive"
    );

    // Clean up
    await prisma.journalLine.deleteMany({ where: { journalEntryId: settlement.journalEntryId! } });
    await prisma.journalEntry.delete({ where: { id: settlement.journalEntryId! } });
    await prisma.finalSettlement.delete({ where: { id: settlement.id } });
    await prisma.employeeAdvance.deleteMany({ where: { employeeId: exitEmp.id } });
    await prisma.leaveBalance.deleteMany({ where: { employeeId: exitEmp.id } });
    await prisma.onboardingChecklist.deleteMany({ where: { employeeId: exitEmp.id } });
    await prisma.employee.delete({ where: { id: exitEmp.id } });
  } catch (err: any) {
    assert(false, `Offboarding final settlement test failed: ${err.message}`);
  }

  // TEST 20: RECRUITMENT / ATS - Offer Acceptance Converts Candidate to Employee
  try {
    const candidate = await HrmService.createCandidate({
      name: "New Hire Candidate",
      phone: "+971 50 777 3333",
      email: "newhire@test.com",
      stage: "Offer",
    });

    const offer = await HrmService.createOffer({
      candidateId: candidate.id,
      role: "Junior HVAC Technician",
      salary: 5500,
      startDate: new Date().toISOString().split("T")[0],
    });

    const result = await HrmService.acceptOffer(offer.id);
    const newEmp = result.newEmployee;
    const checklists = await prisma.onboardingChecklist.findMany({
      where: { employeeId: newEmp.id },
    });

    assert(
      result.offer.status === "Accepted" &&
        newEmp.name === "New Hire Candidate" &&
        checklists.length > 0,
      "ATS Offer acceptance converts candidate into live Employee record and initializes OnboardingChecklist"
    );

    // Clean up
    await prisma.onboardingChecklist.deleteMany({ where: { employeeId: newEmp.id } });
    await prisma.leaveBalance.deleteMany({ where: { employeeId: newEmp.id } });
    await prisma.employee.delete({ where: { id: newEmp.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.candidate.delete({ where: { id: candidate.id } });
  } catch (err: any) {
    assert(false, `ATS candidate conversion test failed: ${err.message}`);
  }

  // TEST 14: OPENING STOCK DECLARATION & BALANCED EQUITY POSTING
  try {
    const testProduct = await InventoryService.createProduct({
      sku: `OPEN-TEST-${Date.now().toString().slice(-4)}`,
      name: "Opening Stock Test Part",
      unit: "pcs",
      unitPrice: 1500,
      costPrice: 900,
      stockQuantity: 0,
      reorderLevel: 5,
    });

    const result = await InventoryService.setOpeningStock({
      productId: testProduct.id,
      quantity: 25,
      unitCost: 1000,
      notes: "Audit Opening Stock Test",
    });

    const updatedProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
    const ledger = await prisma.stockLedger.findFirst({
      where: { productId: testProduct.id, refType: "opening_stock" },
    });

    // Check balanced journal entry
    const journalEntry = await prisma.journalEntry.findFirst({
      where: { refType: "opening_stock", refId: ledger?.id },
      include: { lines: { include: { account: true } } },
    });

    const debitLine = journalEntry?.lines.find((l) => l.debit > 0);
    const creditLine = journalEntry?.lines.find((l) => l.credit > 0);

    assert(
      updatedProduct?.stockQuantity === 25 &&
        updatedProduct?.costPrice === 1000 &&
        ledger?.qty === 25 &&
        ledger?.direction === "in" &&
        debitLine?.account.code === "1200" &&
        debitLine?.debit === 25000 &&
        creditLine?.account.code === "3000" &&
        creditLine?.credit === 25000,
      "InventoryService.setOpeningStock updates product qty, writes ledger, and posts balanced Dr 1200 / Cr 3000 entry"
    );

    // Clean up
    if (journalEntry) {
      await prisma.journalLine.deleteMany({ where: { journalEntryId: journalEntry.id } });
      await prisma.journalEntry.delete({ where: { id: journalEntry.id } });
    }
    if (ledger) {
      await prisma.stockLedger.delete({ where: { id: ledger.id } });
    }
    await prisma.product.delete({ where: { id: testProduct.id } });
  } catch (err: any) {
    assert(false, `Opening stock test failed: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
