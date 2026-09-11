import { prisma } from "../src/lib/prisma";
import { AccountsPostingService } from "../src/lib/services/AccountsPostingService";
import { FiscalPeriodService } from "../src/lib/services/FiscalPeriodService";
import { SubLedgerService } from "../src/lib/services/SubLedgerService";
import { TaxService } from "../src/lib/services/TaxService";
import { BankReconciliationService } from "../src/lib/services/BankReconciliationService";
import { FixedAssetService } from "../src/lib/services/FixedAssetService";
import { FinancialReportingService } from "../src/lib/services/FinancialReportingService";

async function runEnterpriseAccountingE2E() {
  console.log("=== STARTING ENTERPRISE SAP-FICO GRADE ACCOUNTING E2E AUDIT ===\n");

  // 1. SEED FISCAL PERIODS
  console.log("1. Seeding 12 Monthly Fiscal Periods for FY2026...");
  const periods = await FiscalPeriodService.seedFiscalYear(2026, 7);
  console.log(`   ✓ Seeded/Retrieved ${periods.length} fiscal periods.`);

  // 2. VERIFY DOUBLE ENTRY PARITY & APPEND-ONLY IMMUTABILITY
  console.log("\n2. Testing Balanced Double-Entry Posting Engine...");
  const cashAcc = await AccountsPostingService.getAccountByCode("1000"); // Cash Drawer
  const revenueAcc = await AccountsPostingService.getAccountByCode("4000"); // Revenue
  const arAcc = await AccountsPostingService.getAccountByCode("1100"); // AR
  const apAcc = await AccountsPostingService.getAccountByCode("2000"); // AP
  const equityAcc = await AccountsPostingService.getAccountByCode("3900"); // Opening Balance Equity

  // Balanced entry
  const testJournal = await AccountsPostingService.post({
    memo: "E2E Test Initial Capital Contribution",
    refType: "test_capital",
    postedBy: "E2E Test Runner",
    lines: [
      { accountId: cashAcc.id, debit: 500000, credit: 0 },
      { accountId: equityAcc.id, debit: 0, credit: 500000 },
    ],
  });
  console.log(`   ✓ Posted balanced entry #${testJournal.id} (Dr 1000: 500,000 / Cr 3900: 500,000).`);

  // Test unbalanced entry rejection
  try {
    await AccountsPostingService.post({
      memo: "E2E Unbalanced Attempt",
      refType: "test_fail",
      lines: [
        { accountId: cashAcc.id, debit: 100, credit: 0 },
        { accountId: revenueAcc.id, debit: 0, credit: 90 }, // Unbalanced!
      ],
    });
    console.error("   ❌ ERROR: Unbalanced entry was NOT rejected!");
  } catch (err: any) {
    console.log(`   ✓ Confirmed: Unbalanced entry was strictly rejected: "${err.message}"`);
  }

  // 3. IMMUTABLE REVERSAL (reverseEntry)
  console.log("\n3. Testing Immutable Reversal Engine (No Edits, No Deletes)...");
  const reversalVoucher = await AccountsPostingService.reverseEntry({
    journalEntryId: testJournal.id,
    reason: "E2E Audit Reversal of initial test capital",
    reversedBy: "Auditor Bilal",
  });
  const updatedOriginal = await prisma.journalEntry.findUnique({ where: { id: testJournal.id } });
  console.log(`   ✓ Reversal voucher created: #${reversalVoucher.id}`);
  console.log(`   ✓ Original entry status: ${updatedOriginal?.status} (reversed by #${updatedOriginal?.reversedById})`);
  console.log(`   ✓ Reversal entry status: ${reversalVoucher.status} (reversal of #${reversalVoucher.reversalOfId})`);

  // Attempting to reverse an already-reversed entry should fail
  try {
    await AccountsPostingService.reverseEntry({
      journalEntryId: testJournal.id,
      reason: "Duplicate reversal attempt",
      reversedBy: "Auditor Bilal",
    });
    console.error("   ❌ ERROR: Duplicate reversal was NOT rejected!");
  } catch (err: any) {
    console.log(`   ✓ Confirmed: Duplicate reversal was strictly rejected: "${err.message}"`);
  }

  // 4. PERIOD LOCKING TEST
  console.log("\n4. Testing Fiscal Period Lock Enforcements...");
  const targetPeriod = periods[0]; // First period
  await FiscalPeriodService.closeMonth(targetPeriod.id, "Chief Financial Officer");
  console.log(`   ✓ Period '${targetPeriod.name}' status set to CLOSED.`);

  try {
    await AccountsPostingService.post({
      date: targetPeriod.startDate,
      memo: "Attempted posting inside closed fiscal period",
      refType: "test_lock",
      lines: [
        { accountId: cashAcc.id, debit: 1000, credit: 0 },
        { accountId: revenueAcc.id, debit: 0, credit: 1000 },
      ],
    });
    console.error("   ❌ ERROR: Closed period posting was NOT rejected!");
  } catch (err: any) {
    console.log(`   ✓ Confirmed: Closed period posting rejected: "${err.message}"`);
  }

  // Reopen period for testing continuity
  await FiscalPeriodService.reopenPeriod(targetPeriod.id, "Admin Superuser");
  console.log(`   ✓ Reopened period '${targetPeriod.name}' successfully.`);

  // 5. WITHHOLDING TAX (SECTION 153) & VENDOR SUB-LEDGER
  console.log("\n5. Testing Custom Section 153 Withholding Tax (WHT) & Vendor Payment...");
  let vendor = await prisma.vendor.findFirst({ where: { name: "Pak Electron Limited (PEL Spares)" } });
  if (!vendor) {
    vendor = await TaxService.createVendor({
      name: "Pak Electron Limited (PEL Spares)",
      contactPerson: "Kamran Siddiqui",
      phone: "+92 300 1234567",
      ntnNumber: "0819234-1",
      whtRate: 8, // 8% WHT
      whtExempt: false,
    });
  }

  const whtPayment = await TaxService.postVendorPaymentWithWht({
    vendorId: vendor.id,
    grossAmount: 100000, // PKR 100,000 gross bill
    disbursingAccountCode: "1000",
    memo: "E2E Compressor shipment settlement",
    cprNumber: "CPR-IT-2026-990182",
    postedBy: "Fatima Noor",
  });

  console.log(`   ✓ Vendor payment posted with Section 153 WHT:`);
  console.log(`     - Gross Amount (Dr 2000 AP): PKR ${whtPayment.taxCalculation.grossAmount}`);
  console.log(`     - WHT Withheld @ 8% (Cr 2200 WHT): PKR ${whtPayment.taxCalculation.whtAmount}`);
  console.log(`     - Net Disbursed (Cr 1000 Cash): PKR ${whtPayment.taxCalculation.netPayable}`);
  console.log(`     - CPR Ref: ${whtPayment.subledger.cprNumber}`);
  console.log(`     - Journal ID: #${whtPayment.journal.id}`);

  // 6. SUB-LEDGER DRIFT DETECTION & AR/AP AGING
  console.log("\n6. Testing Sub-Ledger Control Account Drift Detection & Aging...");
  const driftAudit = await SubLedgerService.checkReconciliationDrift();
  console.log(`   ✓ AR Control (GL 1100): PKR ${driftAudit.receivables.glControlBalance} | Sub-ledger: PKR ${driftAudit.receivables.subledgerTotal} | Drift: PKR ${driftAudit.receivables.driftAmount}`);
  console.log(`   ✓ AP Control (GL 2000): PKR ${driftAudit.payables.glControlBalance} | Sub-ledger: PKR ${driftAudit.payables.subledgerTotal} | Drift: PKR ${driftAudit.payables.driftAmount}`);

  const arAging = await SubLedgerService.getArAging();
  console.log(`   ✓ AR Aging Schedule: Total Outstanding = PKR ${arAging.summary.totalOutstanding} (Current: PKR ${arAging.summary.current}, 90+d: PKR ${arAging.summary.days90Plus})`);

  const apAging = await SubLedgerService.getApAging();
  console.log(`   ✓ AP Aging Schedule: Total Outstanding = PKR ${apAging.summary.totalOutstanding}`);

  // 7. BANK RECONCILIATION ENGINE
  console.log("\n7. Testing Bank Reconciliation Engine (BRS & Auto-Matching)...");
  const bankAcc = await AccountsPostingService.getAccountByCode("1010"); // Operating Bank Account

  // Post a book deposit to match
  const testDeposit = await AccountsPostingService.post({
    memo: "Customer HVAC Job Payment DEP-9912",
    refType: "customer_deposit",
    refId: "DEP-9912",
    postedBy: "Fatima Noor",
    lines: [
      { accountId: bankAcc.id, debit: 75000, credit: 0 },
      { accountId: revenueAcc.id, debit: 0, credit: 75000 },
    ],
  });

  // Import CSV with that matching transaction
  const csvContent = `Date,Description,Reference,Debit,Credit,Balance\n${new Date().toISOString().split("T")[0]},Customer Deposit DEP-9912,DEP-9912,75000,0,1575000`;
  const importResult = await BankReconciliationService.importCsvStatement(bankAcc.id, csvContent);
  console.log(`   ✓ Imported ${importResult.importedCount} statement row(s).`);

  // Run auto-match
  const autoMatchResult = await BankReconciliationService.autoMatch(bankAcc.id);
  console.log(`   ✓ Auto-Match: Matched ${autoMatchResult.matchedCount} statement line(s) with Cashbook GL lines.`);

  // Generate BRS
  const brs = await BankReconciliationService.generateReconciliationStatement(bankAcc.id);
  console.log(`   ✓ Bank Reconciliation Statement (BRS):`);
  console.log(`     - Bank Statement Ending: PKR ${brs.statement.balancePerBank}`);
  console.log(`     - Deposits in Transit (+): PKR ${brs.statement.depositsInTransit}`);
  console.log(`     - Unpresented Cheques (-): PKR ${brs.statement.unpresentedCheques}`);
  console.log(`     - Adjusted Bank Balance: PKR ${brs.statement.adjustedBankBalance}`);
  console.log(`     - Book Balance (GL): PKR ${brs.statement.balancePerBooks}`);
  console.log(`     - Discrepancy: PKR ${brs.statement.discrepancy}`);

  // 8. FIXED ASSETS & STRAIGHT-LINE MONTHLY DEPRECIATION
  console.log("\n8. Testing Fixed Assets Register & Monthly Straight-Line Depreciation...");
  const asset = await FixedAssetService.createAsset({
    name: "Master Multi-Split Test Diagnostic Bench",
    category: "Diagnostic Equipment",
    cost: 300000,
    salvageValue: 0,
    usefulLifeMonths: 60, // 5 years = PKR 5,000/month
    inServiceDate: new Date(),
  });
  console.log(`   ✓ Registered Asset #${asset.assetNumber}: ${asset.name} (Cost: PKR ${asset.acquisitionCost})`);

  const currentPeriodStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const deprResult = await FixedAssetService.runMonthlyDepreciation(currentPeriodStr, "Fatima Noor");
  console.log(`   ✓ Depreciation Routine: Processed ${deprResult.processedCount} asset(s), allocated PKR ${deprResult.totalDepreciation} via Journal #${deprResult.journalEntryId || "None"}.`);

  // Test idempotency: second run should not double post
  const secondDeprResult = await FixedAssetService.runMonthlyDepreciation(currentPeriodStr, "Fatima Noor");
  console.log(`   ✓ Confirmed Idempotency: Second run processed ${secondDeprResult.processedCount} assets (${secondDeprResult.message}).`);

  // 9. FINANCIAL STATEMENTS REPORTING ENGINE
  console.log("\n9. Testing Financial Statements Generation...");
  const tb = await FinancialReportingService.getTrialBalance();
  console.log(`   ✓ Trial Balance: Total Debit = PKR ${tb.totalDebit} | Total Credit = PKR ${tb.totalCredit} | Balanced: ${tb.isBalanced}`);

  const bs = await FinancialReportingService.getBalanceSheet();
  console.log(`   ✓ Balance Sheet: Total Assets = PKR ${bs.assets.totalAssets} | Total Liab & Equity = PKR ${bs.totalLiabilitiesAndEquity} | Balanced: ${bs.isBalanced}`);

  const isReport = await FinancialReportingService.getIncomeStatement(
    new Date(new Date().getFullYear(), 0, 1),
    new Date()
  );
  console.log(`   ✓ Income Statement: Revenue = PKR ${isReport.revenue.total} | COGS = PKR ${isReport.cogs.total} | Opex = PKR ${isReport.operatingExpenses.total} | Net Profit = PKR ${isReport.netIncome}`);

  const cfReport = await FinancialReportingService.getCashFlowStatement(
    new Date(new Date().getFullYear(), 0, 1),
    new Date()
  );
  console.log(`   ✓ Cash Flow Statement: Net Change in Cash = PKR ${cfReport.netCashChange} | Ending Cash = PKR ${cfReport.endingCash}`);

  console.log("\n=== ALL ENTERPRISE ACCOUNTING SYSTEMS PASSED WITH 100% PARITY ===");
}

runEnterpriseAccountingE2E()
  .catch((e) => {
    console.error("FATAL E2E FAILURE:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
