/**
 * End-to-end test of "Workman Services ERP – Accounts Linking": replays the doc's one-month worked
 * example (transactions 1–11) through the real services and checks the closing Trial Balance
 * (PKR 607,440 = 607,440) account by account, plus that AR, AP, Cash with Technician,
 * Customer Advances and Salaries Payable all close at zero.
 *
 * Runs ONLY against a local, empty database (it creates its own chart, mappings and data):
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres npx prisma db push
 *   DATABASE_URL=... npx tsx scripts/e2e-accounts-linking.ts
 */
import { prisma } from "../src/lib/prisma";
import { STANDARD_COA_DEFINITIONS } from "../src/lib/constants/chartOfAccountsHierarchy";
import { BASELINE_MAPPINGS } from "../src/lib/constants/baselineMappings";
import { AccountsPostingService } from "../src/lib/services/AccountsPostingService";
import { AccountMappingService } from "../src/lib/services/AccountMappingService";
import { InventoryService } from "../src/lib/services/InventoryService";
import { JobsService } from "../src/lib/services/JobsService";
import { ReturnsService } from "../src/lib/services/ReturnsService";
import { PayrollService } from "../src/lib/services/PayrollService";
import { FinancialReportingService } from "../src/lib/services/FinancialReportingService";

const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at a local test database (127.0.0.1 / localhost).");
  process.exit(1);
}

const ACTOR = "E2E Accountant";
let failures = 0;
const check = (label: string, actual: number, expected: number) => {
  const ok = Math.abs(actual - expected) < 0.005;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${String(actual).padStart(12)}  (expected ${expected})`);
};

async function acc(code: string) {
  const a = await prisma.account.findUnique({ where: { code } });
  if (!a) throw new Error(`Account ${code} missing`);
  return a;
}
async function post(memo: string, lines: Array<[string, number, number]>) {
  const resolved = await Promise.all(lines.map(async ([code, debit, credit]) => ({ accountId: (await acc(code)).id, debit, credit })));
  return AccountsPostingService.post({ memo, refType: "manual_journal", postedBy: ACTOR, lines: resolved });
}

async function setup() {
  if ((await prisma.account.count()) > 0) throw new Error("Test database is not empty. Use a fresh database.");
  for (const def of [...STANDARD_COA_DEFINITIONS].sort((a, b) => a.level - b.level)) {
    const parent = def.parentCode ? await prisma.account.findUnique({ where: { code: def.parentCode } }) : null;
    await prisma.account.create({
      data: { code: def.code, name: def.name, type: def.type, level: def.level, parentId: parent?.id ?? null, isSystem: true },
    });
  }
  for (const m of BASELINE_MAPPINGS) {
    const a = await acc(m.accountCode);
    await AccountMappingService.setMapping("DEFAULT", m.transactionType, a.id, null, ACTOR);
  }
  await prisma.companySettings.create({
    data: {
      legalName: "Workman Services (E2E)",
      taxRules: [
        { id: "pra", name: "PRA Services Tax", code: "PRA16", type: "services_tax", rate: 16, appliesTo: "sales", inclusive: false, isDefault: true, active: true },
        { id: "gst", name: "GST", code: "GST18", type: "sales_tax", rate: 18, appliesTo: "both", inclusive: false, isDefault: false, active: true },
      ],
      taxPolicy: {
        jobs: { enabled: true, rateCode: "PRA16", goodsRateCode: "GST18", pricesIncludeTax: false, applyAfterDiscount: true },
        pos: { mode: "cashier", rateCode: "GST18" },
        procurement: { recordInputTax: true },
        wht: { allowOnCustomerReceipts: true },
      },
    },
  });
}

async function run() {
  await setup();

  // 1. Owner puts 500,000 capital into the bank.
  await post("1. Owner capital", [["11103", 500000, 0], ["31101", 0, 500000]]);

  // 2. Credit purchase: spares 70,000 + resale goods 30,000 + GST 18,000 (GRN + vendor bill).
  const m1 = await InventoryService.createProduct({ sku: "M1", name: "Compressor relay", unitPrice: 2000, costPrice: 1200, stockQuantity: 0 });
  const m2 = await InventoryService.createProduct({ sku: "M2", name: "Copper pipe", unitPrice: 1500, costPrice: 1000, stockQuantity: 0 });
  const g1 = await InventoryService.createProduct({ sku: "G1", name: "Remote control", unitPrice: 1430, costPrice: 1000, stockQuantity: 0, forDirectSale: true });
  const ap = "21101";
  await InventoryService.addStock({ productId: m1.id, quantity: 50, unitCost: 1200, paidFromAccountCode: ap, source: "Supplier (credit)" });
  await InventoryService.addStock({ productId: m2.id, quantity: 10, unitCost: 1000, paidFromAccountCode: ap, source: "Supplier (credit)" });
  await InventoryService.addStock({ productId: g1.id, quantity: 30, unitCost: 1000, paidFromAccountCode: ap, source: "Supplier (credit)" });
  await post("2. Input GST on supplier bill", [["11204", 18000, 0], [ap, 0, 18000]]);

  // 3. Pay supplier from bank, 5,000 WHT withheld.
  await post("3. Vendor payment", [[ap, 118000, 0], ["11103", 0, 113000], ["21203", 0, 5000]]);

  const tech = await prisma.employee.create({ data: { name: "Tech Ali", phone: "0300", role: "technician", department: "Operations", salary: 60000 } });
  await prisma.employee.create({
    data: { name: "Office Sara", phone: "0301", role: "accountant", department: "Accounts", salary: 40000, monthlyIncomeTax: 2000, eobiEmployeeShare: 1000 },
  });

  // 4a. Job invoice: installation 40,000 + parts 20,000, GST 3,600 on parts + PRA 6,400 on installation.
  const custA = await prisma.customer.create({ data: { name: "Mr Hamza", phone: "0311", addressText: "Lahore" } });
  const jobA = await prisma.job.create({
    data: {
      jobNumber: "JOB-E2E-A",
      customerId: custA.id,
      jobType: "installation",
      assignedTechnicianId: tech.id,
      paymentCollectionMode: "office",
      status: "CompletedPendingVerification",
      items: {
        create: [
          { description: "AC installation service", quantityPlanned: 1, quantityActual: 1, unitRate: 40000 },
          { description: "Compressor relay - Issued by Storekeeper", quantityPlanned: 10, quantityActual: 10, unitRate: 2000 },
        ],
      },
    },
  });
  const invA = await JobsService.generateCustomInvoice(jobA.id, "", ACTOR);
  check("4a invoice total (AR)", invA!.amount, 70000);

  // 4b. Parts issued to the job at cost 12,000.
  const m1Id = m1.id;
  await InventoryService.consumeStock(m1Id, 10, "job_consumption", jobA.id, "Issued to JOB-E2E-A");

  // 5a/5b. Customer returns one part (2,000 + GST 360); it goes back to stock at cost 1,200.
  const cn = await ReturnsService.createSalesReturn({
    invoiceId: invA!.id,
    lines: [{ productId: m1Id, quantity: 1, unitPrice: 2000, restock: true }],
    reason: "Part not needed",
    actorName: ACTOR,
  });
  check("5a credit note total", cn.total, 2360);

  // 6a-6c. Technician collects 30,000, spends 1,000 on fuel from it, surrenders 29,000.
  const settlement = await prisma.hisaabSettlement.create({
    data: { jobId: jobA.id, technicianId: tech.id, amountExpected: 30000, amountCollected: 30000, isFull: true, settledBy: ACTOR, status: "posted" },
  });
  await prisma.$transaction(async (tx) => {
    const techCash = await AccountMappingService.resolveAccount({ transactionType: "settlement_collection_vault", prismaClient: tx });
    const credit = await JobsService.collectionCreditAccount(tx, jobA.id);
    await JobsService.syncSettlementCollectionGL(tx, {
      settlementId: settlement.id,
      targetAmount: 30000,
      vaultAccountId: techCash.id,
      receivableAccountId: credit.account.id,
      memo: "6a. Field collection",
      postedBy: ACTOR,
      customerId: custA.id,
    });
    const fromCollection = await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_vault", prismaClient: tx });
    await AccountsPostingService.post({
      memo: "6b. Fuel paid from field collection",
      refType: "tech_expense_settlement",
      refId: settlement.id,
      postedBy: ACTOR,
      lines: [
        { accountId: (await tx.account.findUniqueOrThrow({ where: { code: "52101" } })).id, debit: 1000, credit: 0 },
        { accountId: fromCollection.id, debit: 0, credit: 1000 },
      ],
      tx,
    });
    const sweep = await JobsService.sweepTechnicianCashToVault(tx, { settlementId: settlement.id, postedBy: ACTOR, technicianId: tech.id, memo: "6c. Surrender" });
    check("6c cash surrendered to vault", sweep.amount, 29000);
  }, { maxWait: 20000, timeout: 120000 });

  // 7. Customer pays the remaining 37,640 by bank, 2,000 WHT deducted.
  await JobsService.recordOfficeJobReceipt(jobA.id, 35640, ACTOR, { receiptMode: "bank", whtAmount: 2000, paymentMethod: "bank_transfer" });

  // 8a-8c. New customer pays 18,000 in advance; job invoiced 18,000; advance adjusted.
  const custB = await prisma.customer.create({ data: { name: "Ms Ayesha", phone: "0322", addressText: "Lahore", taxExempt: true } });
  const jobB = await prisma.job.create({
    data: {
      jobNumber: "JOB-E2E-B",
      customerId: custB.id,
      jobType: "repair",
      paymentCollectionMode: "office",
      status: "Created",
      items: { create: [{ description: "Compressor repair", quantityPlanned: 1, quantityActual: 1, unitRate: 18000 }] },
    },
  });
  const adv = await JobsService.recordOfficeJobReceipt(jobB.id, 18000, ACTOR, { receiptMode: "cash", paymentMethod: "cash" });
  check("8a advance recorded", (adv as any).advance || 0, 18000);
  // An invoice cannot be raised before the work is done.
  let earlyInvoiceBlocked = 0;
  await JobsService.generateCustomInvoice(jobB.id, "", ACTOR).catch(() => (earlyInvoiceBlocked = 1));
  check("Invoice blocked while job not completed", earlyInvoiceBlocked, 1);
  await prisma.job.update({ where: { id: jobB.id }, data: { status: "CompletedPendingVerification" } });
  const invB = await JobsService.generateCustomInvoice(jobB.id, "", ACTOR);
  check("8b invoice total", invB!.amount, 18000);
  const invBAfter = await prisma.invoice.findUnique({ where: { id: invB!.id } });
  console.log(`      8c invoice ${invBAfter?.invoiceNumber} status after advance adjustment: ${invBAfter?.status}`);
  if (invBAfter?.status !== "paid") failures++;

  // 9a/9b. POS cash sale 10,000 + GST 1,800; cost 7,000.
  await post("9a. POS cash sale", [["11101", 11800, 0], ["41104", 0, 10000], ["21201", 0, 1800]]);
  await post("9b. POS cost of goods", [["51103", 7000, 0], ["11302", 0, 7000]]);

  // 10a/10b. Payroll: technicians 60,000 + office 40,000; WHT 2,000, EOBI 1,000; paid from bank.
  const run = await PayrollService.createDraftRun("E2E Month");
  await PayrollService.approveRun(run.id, ACTOR);
  await PayrollService.disburseRun(run.id, { paidFromAccountCode: "11103", paidBy: ACTOR });

  // 11. Office rent from bank.
  await post("11. Office rent", [["64102", 25000, 0], ["11103", 0, 25000]]);

  // ---------------- Closing Trial Balance ----------------
  const tb = await FinancialReportingService.getTrialBalance();
  const bal = new Map(tb.accounts.map((a: any) => [a.code, a.balance]));
  const b = (code: string) => Math.round(((bal.get(code) as number) || 0) * 100) / 100;
  console.log("\nTrial balance (doc: 'Mahine ke aakhir mein Trial Balance')");
  const expected: Array<[string, string, number]> = [
    ["11103", "Operating Bank", 300640],
    ["11101", "Cash on Hand (Vault)", 58800],
    ["11301", "Inventory – Materials", 59200],
    ["11302", "Inventory – Goods for Sale", 23000],
    ["11204", "Input Sales Tax", 18000],
    ["11203", "Advance Income Tax", 2000],
    ["41201", "Sales Returns", 2000],
    ["51101", "COGS – Jobs", 10800],
    ["51103", "COGS – POS", 7000],
    ["52101", "Job Fuel", 1000],
    ["52104", "Technician Wages", 60000],
    ["61101", "Office Salaries", 40000],
    ["64102", "Rent", 25000],
    ["31101", "Owner Capital", 500000],
    ["21203", "WHT Payable – Suppliers", 5000],
    ["21204", "WHT Payable – Salaries", 2000],
    ["21205", "EOBI Payable", 1000],
    ["21201", "Output Sales Tax FBR", 5040],
    ["21202", "Services Tax PRA", 6400],
    ["41101", "Service Rev – Installation", 40000],
    ["41102", "Service Rev – Repair", 18000],
    ["41103", "Goods Revenue", 20000],
    ["41104", "POS Revenue", 10000],
    ["11201", "Accounts Receivable (must be 0)", 0],
    ["21101", "Accounts Payable (must be 0)", 0],
    ["11105", "Cash with Technician (must be 0)", 0],
    ["21105", "Customer Advances (must be 0)", 0],
    ["21106", "Salaries Payable (must be 0)", 0],
  ];
  for (const [code, name, amount] of expected) check(`${code} ${name}`, b(code), amount);
  const unexpected = tb.accounts.filter((a: any) => Math.abs(a.balance) > 0.005 && !expected.some(([c]) => c === a.code));
  for (const a of unexpected) {
    failures++;
    console.log(`FAIL  unexpected balance on ${a.code} ${a.name}: ${a.balance}`);
  }
  check("TB total debits", tb.totalDebits >= 0 ? sumSide(tb.accounts, "debit") : 0, 607440);
  check("TB total credits", sumSide(tb.accounts, "credit"), 607440);
  console.log(`TB in balance: ${tb.isBalanced}`);

  const is = await FinancialReportingService.getIncomeStatement(new Date(0));
  check("Net revenue", is.revenue.total, 86000);
  check("Cost of sales", is.cogs.total, 78800);
  check("Gross profit", is.grossProfit, 7200);
  check("Admin expenses", is.operatingExpenses.total, 65000);
  check("Net profit / (loss)", is.netIncome, -57800);

  // ---------------- Controls ----------------
  // Cash / bank can never go negative (vault holds 58,800).
  let overdrawBlocked = 0;
  await post("Overdraw attempt", [["64109", 999999, 0], ["11101", 0, 999999]]).catch(() => (overdrawBlocked = 1));
  check("Cash overdraw blocked", overdrawBlocked, 1);
  // The person who creates a PO cannot approve it.
  const { ProcurementService } = await import("../src/lib/services/ProcurementService");
  const vendor = await prisma.vendor.create({ data: { name: "PEL" } });
  const po = await ProcurementService.createPurchaseOrder({
    vendorId: vendor.id,
    createdBy: "Buyer One",
    items: [{ productId: m2.id, quantity: 1, unitCost: 1000, taxPercent: 18 } as any],
  } as any);
  check("PO total includes 18% tax", Math.round(po.totalAmount), 1180);
  let selfApprovalBlocked = 0;
  await ProcurementService.approvePurchaseOrder(po.id, "Buyer One").catch(() => (selfApprovalBlocked = 1));
  check("PO self-approval blocked", selfApprovalBlocked, 1);
  const approved = await ProcurementService.approvePurchaseOrder(po.id, "Manager Two");
  check("PO approved by another user", approved.status === "approved" ? 1 : 0, 1);

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
  process.exitCode = failures ? 1 : 0;
}

/** Closing TB columns: each account's balance on its natural side. */
function sumSide(accounts: Array<{ type: string; balance: number }>, side: "debit" | "credit") {
  const debitNormal = (t: string) => ["asset", "expense", "contra_revenue"].includes(t);
  let s = 0;
  for (const a of accounts) {
    const naturalDebit = debitNormal(a.type) ? a.balance : -a.balance;
    if (side === "debit" && naturalDebit > 0) s += naturalDebit;
    if (side === "credit" && naturalDebit < 0) s += -naturalDebit;
  }
  return Math.round(s * 100) / 100;
}

run()
  .catch((e) => {
    console.error("E2E crashed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
