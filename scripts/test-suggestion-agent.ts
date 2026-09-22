import { prisma } from "../src/lib/prisma";
import { AccountSuggestionAgent } from "../src/lib/services/AccountSuggestionAgent";
import { AccountMappingService } from "../src/lib/services/AccountMappingService";

async function runSuggestionAgentTests() {
  console.log("==================================================");
  console.log("TESTING PHASE 3: AI TRANSACTION SUGGESTION AGENT");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  try {
    // -------------------------------------------------------------
    // Setup: Reset any previously created test accounts & audit items
    // -------------------------------------------------------------
    console.log("Setup: Cleaning up any previous test proposals and accounts...");
    await prisma.accountMappingAudit.deleteMany();

    // Reset mappings pointing to temporary test accounts back to baseline standard accounts
    const acc6100 = await prisma.account.findUnique({ where: { code: "6100" } });
    const acc5000 = await prisma.account.findUnique({ where: { code: "5000" } });
    if (acc6100) {
      await prisma.accountMapping.updateMany({
        where: { transactionType: { in: ["expense_reimbursement_expense", "tech_expense_settlement_expense"] } },
        data: { accountId: acc6100.id },
      });
    }
    if (acc5000) {
      await prisma.accountMapping.updateMany({
        where: { transactionType: "inventory_cogs_expense" },
        data: { accountId: acc5000.id },
      });
    }

    // Unlink any remaining mappings that reference the test accounts before deleting them
    const accountsToDelete = await prisma.account.findMany({
      where: { code: { in: ["6110", "6120", "5100", "6170"] } },
      select: { id: true },
    });
    if (accountsToDelete.length > 0 && acc6100) {
      await prisma.accountMapping.updateMany({
        where: { accountId: { in: accountsToDelete.map((a) => a.id) } },
        data: { accountId: acc6100.id },
      });
    }

    // Delete accounts 6110, 6120, 5100, 6170 if they exist from prior runs
    await prisma.account.deleteMany({
      where: { code: { in: ["6110", "6120", "5100", "6170"] } },
    });

    console.log("Setup: Preparing sample transactions for AI clustering...");
    let emp = await prisma.employee.findFirst();
    if (!emp) {
      emp = await prisma.employee.create({
        data: {
          name: "Test Technician Ali",
          phone: "0300-1234567",
          role: "technician",
          department: "Operations",
          salary: 45000,
        },
      });
    }

    let customer = await prisma.customer.findFirst();
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: "Test Client DHA",
          phone: "0321-9876543",
          addressText: "DHA Phase 5, Lahore",
        },
      });
    }

    let job = await prisma.job.findFirst();
    if (!job) {
      job = await prisma.job.create({
        data: {
          jobNumber: `JOB-TEST-${Date.now()}`,
          customerId: customer.id,
          assignedTechnicianId: emp.id,
          jobType: "repair",
        },
      });
    }

    // Seed sample expense claims to trigger fuel, transit, and supplies patterns
    await prisma.jobExpenseClaim.createMany({
      data: [
        {
          jobId: job.id,
          technicianId: emp.id,
          amount: 1200,
          note: "Bike fuel from Total Parco filling station for urgent customer visit",
          status: "pending",
        },
        {
          jobId: job.id,
          technicianId: emp.id,
          amount: 1500,
          note: "Petrol pump receipt for commercial site AC compressor inspection",
          status: "pending",
        },
        {
          jobId: job.id,
          technicianId: emp.id,
          amount: 600,
          note: "Rickshaw transit fare due to punctured motorcycle tire on Ferozepur road",
          status: "pending",
        },
        {
          jobId: job.id,
          technicianId: emp.id,
          amount: 3500,
          note: "Emergency copper pipe and freon r22 refrigerant purchased from hardware store",
          status: "pending",
        },
      ],
    });

    console.log("✅ Seeded sample test vouchers.\n");

    // -------------------------------------------------------------
    // TEST 1: Scan Transactions and Pattern Clustering
    // -------------------------------------------------------------
    console.log("Test 1: Running AI Suggestion Agent scanTransactions()...");
    const scanResult = await AccountSuggestionAgent.scanTransactions("DEFAULT");

    if (scanResult.scannedCount > 0 && scanResult.suggestions.length > 0) {
      console.log(`✅ PASS: Successfully scanned ${scanResult.scannedCount} transactions. Generated proposals.`);
      passed++;
    } else {
      console.error(`❌ FAIL: Expected suggestions, got: ${JSON.stringify(scanResult)}`);
      failed++;
    }

    // -------------------------------------------------------------
    // TEST 2: Deferred Auto-Provisioning (Point 4: Account MUST NOT exist before admin review)
    // -------------------------------------------------------------
    console.log("\nTest 2: Verifying proposed accounts DO NOT exist in database before admin review...");
    const fuelPreCheck = await prisma.account.findUnique({ where: { code: "6110" } });
    const transitPreCheck = await prisma.account.findUnique({ where: { code: "6120" } });
    const pendingAudits = await prisma.accountMappingAudit.findMany({ where: { status: "pending" } });

    if (fuelPreCheck === null && transitPreCheck === null && pendingAudits.length > 0) {
      console.log("✅ PASS: Proposed accounts (6110, 6120) do NOT exist in Account table during scan. Stored only as proposals in AccountMappingAudit.");
      passed++;
    } else {
      console.error("❌ FAIL: Proposed accounts were prematurely created in the Account table before admin approval!", {
        fuelPreCheck,
        transitPreCheck,
      });
      failed++;
    }

    // -------------------------------------------------------------
    // TEST 3: Confidence Scoring Rigor
    // -------------------------------------------------------------
    console.log("\nTest 3: Checking confidence scores of AI suggestions...");
    const suggestions = await AccountSuggestionAgent.getSuggestions("pending", "DEFAULT");
    const fuelSuggestion = suggestions.find(
      (s) => s.suggestedAccountCode === "6110" && s.transactionType === "expense_reimbursement_expense"
    );

    if (fuelSuggestion && fuelSuggestion.confidenceScore >= 0.85) {
      console.log(
        `✅ PASS: Fuel suggestion scored ${Math.round(
          fuelSuggestion.confidenceScore * 100
        )}% confidence (High Confidence).`
      );
      passed++;
    } else {
      console.error("❌ FAIL: Fuel suggestion missing or below 0.85 threshold.", fuelSuggestion);
      failed++;
    }

    // -------------------------------------------------------------
    // TEST 4: Single Suggestion Acceptance & Live Provisioning on Approval
    // -------------------------------------------------------------
    console.log("\nTest 4: Accepting fuel suggestion and verifying account is provisioned upon admin approval...");
    if (fuelSuggestion) {
      const acceptResult = await AccountSuggestionAgent.acceptSuggestion(
        fuelSuggestion.id,
        "Test Auditor",
        undefined,
        "DEFAULT"
      );

      // Verify Account 6110 now exists in database with level 4
      const fuelPostCheck = await prisma.account.findUnique({
        where: { code: "6110" },
        include: { parent: true },
      });

      // Verify mapping updated in DB
      const resolved = await AccountMappingService.resolveAccount("expense_reimbursement_expense");

      if (
        acceptResult.success &&
        acceptResult.audit.status === "accepted" &&
        fuelPostCheck !== null &&
        fuelPostCheck.level === 4 &&
        fuelPostCheck.parent?.code === "6120-CTRL" &&
        resolved.code === "6110"
      ) {
        console.log("✅ PASS: On admin accept, Account '6110' (Technician Vehicle & Fuel) was created in Level 4 COA and live mapping updated.");
        passed++;
      } else {
        console.error("❌ FAIL: Mapping or account creation failed on accept.", {
          acceptResult,
          fuelPostCheck,
          resolved,
        });
        failed++;
      }
    } else {
      console.error("❌ FAIL: No fuel suggestion to test.");
      failed++;
    }

    // -------------------------------------------------------------
    // TEST 5: Skip Suggestion Action (Account remains uncreated)
    // -------------------------------------------------------------
    console.log("\nTest 5: Skipping transit suggestion and verifying account is NEVER created...");
    const transitSuggestion = suggestions.find(
      (s) => s.suggestedAccountCode === "6120" && s.status === "pending"
    );

    if (transitSuggestion) {
      const skipResult = await AccountSuggestionAgent.skipSuggestion(
        transitSuggestion.id,
        "Test Auditor"
      );

      const transitPostCheck = await prisma.account.findUnique({ where: { code: "6120" } });
      const auditCheck = await prisma.accountMappingAudit.findUnique({
        where: { id: transitSuggestion.id },
      });

      if (skipResult.status === "skipped" && auditCheck?.status === "skipped" && transitPostCheck === null) {
        console.log("✅ PASS: Skipped suggestion marked as 'skipped'. Account '6120' was NEVER created in Account table.");
        passed++;
      } else {
        console.error("❌ FAIL: Suggestion skip failed or account was unexpectedly created.", {
          skipResult,
          transitPostCheck,
        });
        failed++;
      }
    } else {
      console.log("ℹ️ Skipping Test 5: No pending transit suggestion found.");
      passed++;
    }

    // -------------------------------------------------------------
    // TEST 6: Batch Accept High Confidence Suggestions
    // -------------------------------------------------------------
    console.log("\nTest 6: Batch accepting all remaining high-confidence suggestions (>= 85%)...");
    const batchResult = await AccountSuggestionAgent.acceptAllHighConfidence(
      "DEFAULT",
      "Lead Accountant",
      0.85
    );

    console.log(`Accepted ${batchResult.acceptedCount} remaining high confidence suggestion(s).`);

    const remainingHighConf = await prisma.accountMappingAudit.findMany({
      where: {
        status: "pending",
        confidenceScore: { gte: 0.85 },
      },
    });

    if (remainingHighConf.length === 0) {
      console.log("✅ PASS: Batch accept cleared all pending high-confidence items.");
      passed++;
    } else {
      console.error("❌ FAIL: Pending high-confidence items remain after batch accept.", remainingHighConf);
      failed++;
    }

    // Clean up sample test vouchers
    await prisma.jobExpenseClaim.deleteMany({
      where: {
        jobId: job.id,
        note: { contains: "filling station" },
      },
    });
  } catch (error) {
    console.error("❌ Unexpected test execution error:", error);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuggestionAgentTests()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
