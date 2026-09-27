const fs = require("fs");

// ========== FinancialReportingService cash-flow scrub ==========
{
  let s = fs.readFileSync("src/lib/services/FinancialReportingService.ts", "utf8");
  if (!s.includes("AccountMappingService")) {
    s = s.replace(
      /^(import .+;\r?\n)/m,
      `$1import { AccountMappingService } from "./AccountMappingService";\n`
    );
    // Better: find first import block
    if (!s.includes('from "./AccountMappingService"')) {
      const firstImport = s.indexOf("import ");
      // insert after prisma import if present
      if (s.includes('from "../prisma"') || s.includes("from \"@/lib/prisma\"")) {
        s = s.replace(
          /(import \{ prisma \} from ["'][^"']+["'];\r?\n)/,
          `$1import { AccountMappingService } from "./AccountMappingService";\n`
        );
      } else {
        s = 'import { AccountMappingService } from "./AccountMappingService";\n' + s;
      }
    }
  }

  const oldCf = `static async getCashFlowStatement(fromDate: Date, toDate: Date = new Date()) {
    const incomeStmt = await this.getIncomeStatement(fromDate, toDate);
    const netIncome = incomeStmt.netOperatingProfit;

    // 1. Depreciation (Non-Cash Expense)
    const deprLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "6350" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const depreciationAdjustment = Math.round(deprLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100) / 100;

    // 2. Working Capital Changes
    // Change in AR (1100): Increase in AR reduces cash, decrease in AR increases cash
    const arLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "1100" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const changeInAr = Math.round(arLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100) / 100;

    // Change in Inventory (1200): Increase in Inventory reduces cash
    const invLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "1200" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const changeInInventory = Math.round(invLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100) / 100;

    // Change in AP (2000): Increase in AP increases cash (delayed payment)
    const apLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "2000" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const changeInAp = Math.round(apLines.reduce((sum, l) => sum + (l.credit - l.debit), 0) * 100) / 100;

    // Net Cash from Operating Activities
    const netWorkingCapital = Math.round((changeInAp - changeInAr - changeInInventory) * 100) / 100;
    const netCashFromOperations = Math.round(
      (netIncome + depreciationAdjustment + netWorkingCapital) * 100
    ) / 100;

    // Cash balances
    const cashAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { code: "1000" },
          { code: { startsWith: "101" } },
          { code: "1020" },
        ],
      },`;

  // Use a more flexible replace - find the method and rewrite key queries
  if (s.includes('account: { code: "6350" }')) {
    // Resolve mapped account IDs at start of getCashFlowStatement body
    s = s.replace(
      /static async getCashFlowStatement\(fromDate: Date, toDate: Date = new Date\(\)\) \{\r?\n\s*const incomeStmt = await this\.getIncomeStatement\(fromDate, toDate\);\r?\n\s*const netIncome = incomeStmt\.netOperatingProfit;/,
      `static async getCashFlowStatement(fromDate: Date, toDate: Date = new Date()) {
    const incomeStmt = await this.getIncomeStatement(fromDate, toDate);
    const netIncome = incomeStmt.netOperatingProfit;

    // Resolve GL proxies via AccountMapping (no hardcoded codes)
    const [deprAcc, arAcc, invAcc, apAcc, cashAcc, bankAcc] = await Promise.all([
      AccountMappingService.resolveAccount({ transactionType: "depreciation_expense" }),
      AccountMappingService.resolveAccount({ transactionType: "ar_control" }),
      AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_asset" }),
      AccountMappingService.resolveAccount({ transactionType: "ap_control" }),
      AccountMappingService.resolveAccount({ transactionType: "customer_payment_receiving" }),
      AccountMappingService.resolveAccount({ transactionType: "bank_operating" }),
    ]);
    const cashAccountIds = Array.from(new Set([cashAcc.id, bankAcc.id]));`
    );

    s = s.replace(
      /account: \{ code: "6350" \}/,
      "accountId: deprAcc.id"
    );
    s = s.replace(
      /account: \{ code: "1100" \}/,
      "accountId: arAcc.id"
    );
    s = s.replace(
      /account: \{ code: "1200" \}/,
      "accountId: invAcc.id"
    );
    s = s.replace(
      /account: \{ code: "2000" \}/,
      "accountId: apAcc.id"
    );

    // Replace cash accounts query
    s = s.replace(
      /const cashAccounts = await prisma\.account\.findMany\(\{\r?\n\s*where: \{\r?\n\s*OR: \[\r?\n\s*\{ code: "1000" \},\r?\n\s*\{ code: \{ startsWith: "101" \} \},\r?\n\s*\{ code: "1020" \},\r?\n\s*\],\r?\n\s*\},/,
      `const cashAccounts = await prisma.account.findMany({
      where: {
        id: { in: cashAccountIds },
      },`
    );
  }

  fs.writeFileSync("src/lib/services/FinancialReportingService.ts", s);
  console.log("FinancialReportingService patched");
}

// ========== JobsService - remove "1000" sentinel defaults ==========
{
  let s = fs.readFileSync("src/lib/services/JobsService.ts", "utf8");
  // Change default params from "1000" to undefined-like empty and simplify resolve logic
  s = s.replace(
    /disbursingAccountCode: string = "1000"/g,
    'disbursingAccountCode?: string'
  );
  // Pattern: if (disbursingAccountCode && disbursingAccountCode !== "1000") { getByCode } else { resolve }
  // Replace with: if provided and not blank, try by code; else resolve
  s = s.replace(
    /if \(disbursingAccountCode && disbursingAccountCode !== "1000"\) \{\r?\n\s*disbursingAccount = await AccountsPostingService\.getAccountByCode\(disbursingAccountCode\);\r?\n\s*\} else \{\r?\n\s*disbursingAccount = await AccountMappingService\.resolveAccount\(\{\r?\n\s*transactionType: "expense_reimbursement_disbursing",\r?\n\s*\}\);\r?\n\s*\}/g,
    `if (disbursingAccountCode) {
        disbursingAccount = await AccountsPostingService.getAccountByCode(disbursingAccountCode);
      } else {
        disbursingAccount = await AccountMappingService.resolveAccount({
          transactionType: "expense_reimbursement_disbursing",
        });
      }`
  );
  // There may be two similar blocks with different transaction types - do a more general replace
  s = s.replace(/disbursingAccountCode !== "1000"/g, "disbursingAccountCode");
  // Careful: `if (disbursingAccountCode && disbursingAccountCode)` is redundant after replace
  s = s.replace(
    /if \(disbursingAccountCode && disbursingAccountCode\)/g,
    "if (disbursingAccountCode)"
  );
  fs.writeFileSync("src/lib/services/JobsService.ts", s);
  console.log("JobsService patched");
}

// ========== TaxService ==========
{
  let s = fs.readFileSync("src/lib/services/TaxService.ts", "utf8");
  s = s.replace(
    /disbursingAccountCode = "1000",/,
    "disbursingAccountCode,"
  );
  // Comment update
  s = s.replace(
    /disbursingAccountCode\?: string; \/\/ e\.g\. "1000" Cash or "1010" Meezan Bank/,
    'disbursingAccountCode?: string; // optional override; defaults via vendor_payment_disbursing mapping'
  );
  fs.writeFileSync("src/lib/services/TaxService.ts", s);
  console.log("TaxService patched");
}

// ========== HrmService ==========
{
  let s = fs.readFileSync("src/lib/services/HrmService.ts", "utf8");
  s = s.replace(
    /const disbursingAcc = data\.disbursingAccountCode && data\.disbursingAccountCode !== "1000"\r?\n\s*\? await AccountsPostingService\.getAccountByCode\(data\.disbursingAccountCode\)\r?\n\s*: await AccountMappingService\.resolveAccount\(\{\r?\n\s*transactionType: "payroll_net_disbursing",\r?\n\s*\}\);/,
    `const disbursingAcc = data.disbursingAccountCode
      ? await AccountsPostingService.getAccountByCode(data.disbursingAccountCode)
      : await AccountMappingService.resolveAccount({
          transactionType: "payroll_net_disbursing",
        });`
  );
  fs.writeFileSync("src/lib/services/HrmService.ts", s);
  console.log("HrmService patched");
}

// ========== migrate-coa-hierarchy baseline ==========
{
  let s = fs.readFileSync("scripts/migrate-coa-hierarchy.ts", "utf8");
  if (!s.includes('transactionType: "fixed_asset_cost"')) {
    s = s.replace(
      /\/\/ Fixed Assets & Period Close\r?\n\s*\{ transactionType: "depreciation_expense"/,
      `// Fixed Assets & Period Close
    { transactionType: "fixed_asset_cost", accountCode: "1500" },
    { transactionType: "bank_operating", accountCode: "1010" },
    { transactionType: "ar_control", accountCode: "1100" },
    { transactionType: "ap_control", accountCode: "2000" },
    { transactionType: "depreciation_expense"`
    );
  }
  fs.writeFileSync("scripts/migrate-coa-hierarchy.ts", s);
  console.log("migrate-coa-hierarchy patched");
}

console.log("Phase 2 done");
