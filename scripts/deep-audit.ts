import { prisma } from "../src/lib/prisma";

async function runDeepAudit() {
  console.log("=== STARTING DEEP SYSTEM AUDIT ===");

  // 1. Check Unbalanced Journal Entries
  console.log("\n[1] Checking for Unbalanced Journal Entries in GL...");
  const unbalancedEntries = await prisma.$queryRaw<Array<{ id: string; refType: string; memo: string; total_debit: number; total_credit: number; diff: number }>>`
    SELECT 
      je.id,
      je."refType",
      je.memo,
      COALESCE(SUM(jl.debit), 0) AS total_debit,
      COALESCE(SUM(jl.credit), 0) AS total_credit,
      ROUND(ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0))::numeric, 2) AS diff
    FROM "JournalEntry" je
    JOIN "JournalLine" jl ON jl."journalEntryId" = je.id
    GROUP BY je.id, je."refType", je.memo
    HAVING ROUND(ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0))::numeric, 2) > 0.01;
  `;
  console.log(`Unbalanced Journal Entries found: ${unbalancedEntries.length}`);
  if (unbalancedEntries.length > 0) {
    console.table(unbalancedEntries);
  }

  // 2. Check Trial Balance Sum
  console.log("\n[2] Checking Total GL Debits vs Credits (Trial Balance Global Equilibrium)...");
  const globalBalance = await prisma.$queryRaw<Array<{ total_debit: number; total_credit: number }>>`
    SELECT 
      COALESCE(SUM(debit), 0) AS total_debit,
      COALESCE(SUM(credit), 0) AS total_credit
    FROM "JournalLine";
  `;
  console.log("Global GL Line Totals:", globalBalance);

  // 3. Sub-ledger vs General Ledger Reconciliation (AR)
  console.log("\n[3] Reconciling AR Sub-ledger vs GL 1100...");
  const glAR = await prisma.$queryRaw<Array<{ balance: number }>>`
    SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
    FROM "JournalLine" jl
    JOIN "Account" a ON jl."accountId" = a.id
    WHERE a.code = '1100';
  `;
  const subledgerAR = await prisma.$queryRaw<Array<{ total_receivable: number }>>`
    SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS total_receivable
    FROM "CustomerLedgerEntry";
  `;
  console.log(`GL Account 1100 Balance: ${glAR[0]?.balance}`);
  console.log(`Customer Sub-ledger Sum (CustomerLedgerEntry): ${subledgerAR[0]?.total_receivable}`);

  // 4. Sub-ledger vs General Ledger Reconciliation (AP)
  console.log("\n[4] Reconciling AP Sub-ledger vs GL 2000...");
  const glAP = await prisma.$queryRaw<Array<{ balance: number }>>`
    SELECT COALESCE(SUM(jl.credit) - SUM(jl.debit), 0) AS balance
    FROM "JournalLine" jl
    JOIN "Account" a ON jl."accountId" = a.id
    WHERE a.code = '2000';
  `;
  const subledgerAP = await prisma.$queryRaw<Array<{ total_payable: number }>>`
    SELECT COALESCE(SUM(credit) - SUM(debit), 0) AS total_payable
    FROM "VendorLedgerEntry";
  `;
  console.log(`GL Account 2000 Balance: ${glAP[0]?.balance}`);
  console.log(`Vendor Sub-ledger Sum (VendorLedgerEntry): ${subledgerAP[0]?.total_payable}`);

  // 5. Check Inventory Value (Stock vs GL 1400 Inventory Asset)
  console.log("\n[5] Reconciling Physical Inventory Valuation vs GL 1400...");
  const glInv = await prisma.$queryRaw<Array<{ balance: number }>>`
    SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
    FROM "JournalLine" jl
    JOIN "Account" a ON jl."accountId" = a.id
    WHERE a.code = '1400';
  `;
  const stockValuation = await prisma.$queryRaw<Array<{ valuation: number }>>`
    SELECT COALESCE(SUM("stockQuantity" * "costPrice"), 0) AS valuation
    FROM "Product";
  `;
  console.log(`GL Account 1400 Balance: ${glInv[0]?.balance}`);
  console.log(`Product Valuation Sum (stockQuantity * costPrice): ${stockValuation[0]?.valuation}`);

  // 6. Check for Negative Stock Balances
  console.log("\n[6] Checking for Negative Stock Balances...");
  const negativeStock = await prisma.product.findMany({
    where: { stockQuantity: { lt: 0 } },
    select: { id: true, name: true, sku: true, stockQuantity: true }
  });
  console.log(`Negative stock products: ${negativeStock.length}`);
  if (negativeStock.length > 0) {
    negativeStock.forEach(s => console.log(`  - Product ${s.sku} (${s.name}): ${s.stockQuantity}`));
  }

  // 7. Check Missing Account Mappings vs Code Definitions
  console.log("\n[7] Checking Missing Transaction Mappings in AccountMapping...");
  const { TRANSACTION_TYPE_DEFINITIONS } = await import("../src/lib/services/AccountMappingService");
  const existingMappings = await prisma.accountMapping.findMany({ where: { companyId: "DEFAULT" } });
  const mappedTypes = new Set(existingMappings.map(m => m.transactionType));
  const missingTypes = TRANSACTION_TYPE_DEFINITIONS.map(d => d.transactionType).filter(t => !mappedTypes.has(t));
  console.log(`Total defined transaction types in code: ${TRANSACTION_TYPE_DEFINITIONS.length}`);
  console.log(`Total mapped transaction types in DB: ${existingMappings.length}`);
  console.log(`Missing transaction types (${missingTypes.length}):`, missingTypes);

  // 8. Check Purchase Orders 3-Way Match Inconsistencies
  console.log("\n[8] Auditing Purchase Orders vs GRNs vs Vendor Bills...");
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      items: true,
      goodsReceipts: { include: { items: true } },
      supplierInvoices: { include: { items: true } }
    }
  });
  let poDiscrepancies = 0;
  for (const po of purchaseOrders) {
    const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalReceived = po.goodsReceipts.reduce((sum, grn) => sum + grn.items.reduce((isum, gi) => isum + gi.quantityReceived, 0), 0);
    const totalBilled = po.supplierInvoices.reduce((sum, si) => sum + si.items.reduce((bsum, bi) => bsum + bi.billedQuantity, 0), 0);

    if (totalReceived > totalOrdered) {
      console.log(`PO ${po.poNumber}: Over-received (Ordered: ${totalOrdered}, Received: ${totalReceived})`);
      poDiscrepancies++;
    }
    if (totalBilled > totalReceived && po.status === 'fully_received') {
      console.log(`PO ${po.poNumber}: Billed higher than GRN received (Received: ${totalReceived}, Billed: ${totalBilled})`);
      poDiscrepancies++;
    }
  }
  console.log(`PO 3-way match anomalies: ${poDiscrepancies}`);

  // 9. Check Cashbook / Bank Accounts
  console.log("\n[9] Checking Financial Accounts (Cash/Bank)...");
  const finAccounts = await prisma.financialAccount.findMany({
    include: { ledgerAccount: true }
  });
  console.log(`Financial accounts count: ${finAccounts.length}`);
  for (const fa of finAccounts) {
    const balance = await prisma.$queryRaw<Array<{ balance: number }>>`
      SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
      FROM "JournalLine" jl
      WHERE jl."accountId" = ${fa.ledgerAccountId};
    `;
    console.log(`  - [${fa.kind}] ${fa.name} (GL ${fa.ledgerAccount.code} - ${fa.ledgerAccount.name}): PKR ${balance[0]?.balance}`);
  }

  // 10. Check Technician Ledger Discrepancies
  console.log("\n[10] Auditing Technician Hisaab / Settlements...");
  const settlements = await prisma.hisaabSettlement.findMany({
    where: { status: 'field_reported' }
  });
  console.log(`Unposted Field-Reported Settlements awaiting accountant confirmation: ${settlements.length}`);

  console.log("\n=== AUDIT RUN COMPLETED ===");
  process.exit(0);
}

runDeepAudit().catch(err => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
