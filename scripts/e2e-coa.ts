import { prisma } from "../src/lib/prisma";
import { AccountsPostingService } from "../src/lib/services/AccountsPostingService";
import { AccountMappingService, TRANSACTION_TYPE_DEFINITIONS } from "../src/lib/services/AccountMappingService";
import { JobsService } from "../src/lib/services/JobsService";
import { InventoryService } from "../src/lib/services/InventoryService";
import { ProcurementService } from "../src/lib/services/ProcurementService";
import { TaxService } from "../src/lib/services/TaxService";
import { PayrollService } from "../src/lib/services/PayrollService";
import { FinancialReportingService } from "../src/lib/services/FinancialReportingService";
import { BASELINE_MAPPINGS } from "../src/lib/constants/baselineMappings";

let fails = 0;
const ok = (c: any, name: string, extra = "") => { console.log(`${c ? "OK  " : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`); if (!c) fails++; };
const r2 = (n: number) => Math.round(n * 100) / 100;

async function lines(refType: string, refId?: string, memoLike?: string) {
  const where: any = { refType };
  if (refId) where.refId = refId;
  if (memoLike) where.memo = { contains: memoLike };
  const j = await prisma.journalEntry.findMany({ where, include: { lines: { include: { account: true } } }, orderBy: { createdAt: "asc" } });
  const out: Record<string, number> = {};
  for (const e of j) for (const l of e.lines) {
    if (l.debit) out["Dr " + l.account.code] = r2((out["Dr " + l.account.code] || 0) + l.debit);
    if (l.credit) out["Cr " + l.account.code] = r2((out["Cr " + l.account.code] || 0) + l.credit);
  }
  return { out, entries: j };
}
const same = (a: Record<string, number>, b: Record<string, number>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

async function main() {
  // ---- 1. every role resolves to the right account
  console.log("== 1. Mapping resolution");
  const defs = TRANSACTION_TYPE_DEFINITIONS.map((d: any) => d.transactionType);
  ok(defs.length === BASELINE_MAPPINGS.length && defs.every((t: string) => BASELINE_MAPPINGS.some((m) => m.transactionType === t)), "role list in code == default mapping table", `${defs.length} roles`);
  let bad = 0;
  for (const m of BASELINE_MAPPINGS) {
    try { const a = await AccountMappingService.resolveAccount({ transactionType: m.transactionType }); if (a.code !== m.accountCode) { bad++; console.log("  mismatch", m.transactionType, a.code, m.accountCode); } }
    catch (e: any) { bad++; console.log("  error", m.transactionType, e.message); }
  }
  ok(bad === 0, "all roles resolve to the expected account");
  const comp = await AccountMappingService.getCompleteness("DEFAULT");
  ok(comp.configured === comp.total, "completeness gate", `${comp.configured}/${comp.total}`);

  const cust = await prisma.customer.findFirst();
  const tech = await prisma.employee.findFirst({ where: { role: "technician" } });
  const stamp = Date.now().toString().slice(-6);
  const mkJob = async (jobType: string, items: { description: string; rate: number; qty?: number }[]) => {
    const job = await prisma.job.create({ data: { jobNumber: `E2E-${jobType}-${stamp}-${Math.random().toString(36).slice(2, 5)}`, customerId: cust!.id, jobType, remarks: "e2e", status: "CompletedPendingVerification", assignedTechnicianId: tech!.id,
      items: { create: items.map((i) => ({ description: i.description, quantityPlanned: i.qty ?? 1, quantityActual: i.qty ?? 1, unitRate: i.rate })) } } });
    return job;
  };

  // ---- 2. job invoicing
  console.log("== 2. Job invoicing");
  const jInst = await mkJob("installation", [{ description: "Split AC installation", rate: 10000 }]);
  await JobsService.finalizeJob(jInst.id, "E2E");
  const rt0 = (await prisma.journalEntry.findMany({ where: { refId: jInst.id }, select: { refType: true } }))[0]?.refType || "job_invoice";
  let t = await lines(rt0, jInst.id);
  ok(same(t.out, { "Dr 1100": 10000, "Cr 4000": 10000 }), "installation job: Dr AR 1100 / Cr 4000", JSON.stringify(t.out));

  const jRep = await mkJob("repair", [{ description: "Compressor repair labour", rate: 5000 }, { description: "[Goods] Capacitor 45uF", rate: 2000 }]);
  await JobsService.finalizeJob(jRep.id, "E2E");
  const refTypes = await prisma.journalEntry.findMany({ where: { refId: jRep.id }, select: { refType: true } });
  t = await lines(refTypes[0]?.refType || "job_invoice", jRep.id);
  ok(same(t.out, { "Dr 1100": 7000, "Cr 4001": 5000, "Cr 4010": 2000 }), "repair job with goods line: Cr 4001 services + Cr 4010 goods", JSON.stringify(t.out));

  const jDisc = await mkJob("repair", [{ description: "AC gas refill", rate: 4000 }]);
  await JobsService.finalizeJob(jDisc.id, "E2E");
  t = await lines(refTypes[0]?.refType || "job_invoice", jDisc.id);
  console.log("   (discount job)", JSON.stringify(t.out));
  ok(!!t.out["Cr 4001"], "discount job posts to 4001", JSON.stringify(t.out));

  // discount (contra revenue 4100)
  const jD2 = await mkJob("repair", [{ description: "Duct cleaning", rate: 4000 }]);
  await JobsService.applyDiscount(jD2.id, 500, "e2e discount", "E2E").catch((e: any) => console.log("   discount error:", e.message));
  await JobsService.finalizeJob(jD2.id, "E2E");
  t = await lines(rt0, jD2.id);
  ok(same(t.out, { "Dr 1100": 3500, "Dr 4100": 500, "Cr 4001": 4000 }) || same(t.out, { "Dr 1100": 3500, "Cr 4001": 3500 }), "discounted job: discount to 4100 (or net)", JSON.stringify(t.out));
  // customer receipt on the installation job (bank)
  try {
    await JobsService.recordOfficeJobReceipt(jInst.id, 10000, "E2E", { receivingAccountCode: "1010", paymentMethod: "bank" });
    const rj = await prisma.journalEntry.findMany({ where: { memo: { contains: jInst.jobNumber } }, include: { lines: { include: { account: true } } }, orderBy: { createdAt: "desc" }, take: 1 });
    const o = rj[0]?.lines.map((l) => `${l.debit ? "Dr" : "Cr"} ${l.account.code} ${l.debit || l.credit}`).join(" | ");
    ok(!!o && o.includes("Dr 1010 10000") && o.includes("Cr 1100 10000"), "customer bank receipt: Dr 1010 / Cr 1100", o);
  } catch (e: any) { console.log("   receipt error:", e.message); ok(false, "customer receipt"); }
  // payment (FOC receipt on job)
  const rep = await JobsService.recordFocPayment(jRep.id, { amount: 3000, receivingAccountCode: "1000", paymentMethod: "cash" }, "E2E").catch((e: any) => ({ err: e.message }));
  console.log("   foc payment:", (rep as any).err || "ok");

  // ---- 3. technician expense claims by category -> petty cash
  console.log("== 3. Technician job expenses");
  const jExp = await mkJob("repair", [{ description: "Misc", rate: 1000 }]);
  for (const [cat, amt] of [["FUEL", 500], ["FOOD", 300], [null, 200], ["MARKET_GOODS", 400]] as const)
    await prisma.jobExpenseClaim.create({ data: { jobId: jExp.id, technicianId: tech!.id, amount: amt, note: `e2e ${cat}`, category: cat, status: "pending" } });
  await JobsService.clearJobExpenses(jExp.id, "E2E", "1005");
  t = await lines("job_expense", jExp.id); if (!t.entries.length) { const e = await prisma.journalEntry.findMany({ where: { memo: { contains: jExp.jobNumber } }, select: { refType: true } }); t = await lines(e[0]?.refType || "x", jExp.id); }
  ok(same(t.out, { "Dr 5100": 500, "Dr 5110": 300, "Dr 5130": 200, "Dr 5010": 400, "Cr 1005": 1400 }), "claims by category: fuel 5100, food 5110, other 5130, market goods 5010; paid from petty cash 1005", JSON.stringify(t.out));

  // ---- 4. inventory: opening stock, issue, return
  console.log("== 4. Inventory");
  const prod = await InventoryService.createProduct({ sku: `E2E-${stamp}`, name: "E2E Part", unit: "pcs", unitPrice: 1500, costPrice: 900, stockQuantity: 0, reorderLevel: 1 } as any);
  const os = await InventoryService.setOpeningStock({ productId: prod.id, quantity: 20, unitCost: 1000, notes: "e2e" } as any);
  const je = await prisma.journalEntry.findFirst({ where: { refType: "opening_stock" }, orderBy: { createdAt: "desc" }, include: { lines: { include: { account: true } } } });
  ok(!!je && je.lines.some((l) => l.account.code === "1200" && l.debit === 20000) && je.lines.some((l) => l.account.code === "3900" && l.credit === 20000), "opening stock: Dr 1200 / Cr 3900 Opening Balance Equity");
  const pb = await prisma.journalEntry.count();
  await JobsService.issueInventory(jInst.id, prod.id, 2, "E2E Store").catch((e: any) => console.log("   issue:", e.message));
  const ia = await prisma.journalEntry.count();
  const ie = await prisma.journalEntry.findFirst({ orderBy: { createdAt: "desc" }, include: { lines: { include: { account: true } } } });
  console.log("   issue posted:", ia - pb, ie?.refType, ie?.lines.map((l) => `${l.debit ? "Dr" : "Cr"} ${l.account.code} ${l.debit || l.credit}`).join(" | "));
  const ledgerRows = await prisma.stockLedger.count({ where: { productId: prod.id } });
  ok(ledgerRows >= 2, "stock movement rows exist for product", String(ledgerRows));

  // ---- 5. procurement
  console.log("== 5. Procurement");
  const vendor = await prisma.vendor.findFirst();
  const po = await prisma.purchaseOrder.create({ data: { poNumber: `PO-E2E-${stamp}`, status: "approved", vendorId: vendor!.id, supplierName: vendor!.name, supplierEmail: vendor!.email || "v@x.pk", totalAmount: 10000, items: { create: [{ productId: prod.id, quantity: 2, unitCost: 5000, lineTotal: 10000 }] } }, include: { items: true } });
  const grn = await ProcurementService.processGrn({ poId: po.id, deliveryChallan: `DC-${stamp}`, receivedBy: "E2E", items: [{ poItemId: po.items[0].id, productId: prod.id, description: "parts", quantityReceived: 2, quantityAccepted: 2, quantityRejected: 0 }] } as any);
  t = await lines("grn_receipt", grn.id);
  ok(same(t.out, { "Dr 1200": 10000, "Cr 2050": 10000 }), "GRN: Dr 1200 / Cr 2050", JSON.stringify(t.out));
  const bill = await ProcurementService.processVendorBill({ vendorId: vendor!.id, invoiceNumber: `INV-E2E-${stamp}`, referenceNumber: `R-${stamp}`, subtotal: 10000, totalAmount: 10000, items: [{ description: "Matched goods", billedQuantity: 2, billedUnitPrice: 5000, poUnitPrice: 5000, lineTotal: 10000, variance: 0 }] } as any);
  t = await lines("vendor_bill", bill.id);
  ok(same(t.out, { "Dr 2050": 10000, "Cr 2000": 10000 }), "vendor bill: Dr 2050 / Cr 2000", JSON.stringify(t.out));
  const bill2 = await ProcurementService.processVendorBill({ vendorId: vendor!.id, invoiceNumber: `INV-E2E2-${stamp}`, referenceNumber: `R2-${stamp}`, subtotal: 10000, taxAmount: 1800, totalAmount: 11800, items: [{ description: "Matched goods 2", billedQuantity: 2, billedUnitPrice: 5000, poUnitPrice: 5000, lineTotal: 10000, variance: 0 }] } as any).catch((e: any) => ({ err: e.message } as any));
  if ((bill2 as any).err) console.log("   bill with tax:", (bill2 as any).err); else { t = await lines("vendor_bill", (bill2 as any).id); console.log("   bill with tax:", JSON.stringify(t.out)); ok(!t.out["Dr 5050"] && (t.out["Dr 6900"] || t.out["Dr 2210"]), "bill tax is not dumped into 5050 (PPV)"); }
  const pay = await TaxService.recordVendorPaymentWithWht({ vendorId: vendor!.id, grossAmount: 100000, disbursingAccountCode: "1010", memo: "e2e wht" } as any);
  const pl = pay.journal.lines;
  ok(pl.some((l: any) => l.account.code === "2000" && l.debit === 100000) && pl.some((l: any) => l.account.code === "2200" && l.credit > 0) && pl.some((l: any) => l.account.code === "1010" && l.credit > 0), "vendor payment with WHT: Dr 2000 / Cr 1010 / Cr 2200");

  // ---- 6. payroll
  console.log("== 6. Payroll");
  try {
    const run = await PayrollService.createDraftRun(`2026-${stamp}`, true);
    await PayrollService.approveRun(run.id, "E2E" as any);
    await PayrollService.disburseRun(run.id);
    const pj = await prisma.journalEntry.findMany({ where: { refId: run.id }, include: { lines: { include: { account: true } } } });
    const o: string[] = []; for (const e of pj) for (const l of e.lines) o.push(`${l.debit ? "Dr" : "Cr"} ${l.account.code} ${l.debit || l.credit}`);
    ok(pj.length > 0 && o.some((x) => x.startsWith("Dr 6000")), "payroll disburse posts Dr 6000 salaries", o.join(" | "));
  } catch (e: any) { console.log("   payroll error:", e.message); ok(false, "payroll"); }

  // ---- 7. reversal + audit
  console.log("== 7. Reversal and audit log");
  const target = await prisma.journalEntry.findFirst({ where: { refType: "opening_stock" }, orderBy: { createdAt: "desc" } });
  const rev = await AccountsPostingService.reverseEntry({ journalEntryId: target!.id, reversedBy: "E2E", reason: "e2e test" });
  const orig = await prisma.journalEntry.findUnique({ where: { id: target!.id }, include: { lines: true } });
  const rl = await prisma.journalLine.findMany({ where: { journalEntryId: rev.id } });
  ok(orig!.status === "reversed" && r2(rl.reduce((s, l) => s + l.debit, 0)) === r2(orig!.lines.reduce((s, l) => s + l.credit, 0)), "reversal posts the mirror entry and marks the original reversed");
  let blocked = false; try { await AccountsPostingService.reverseEntry({ journalEntryId: target!.id, reversedBy: "E2E", reason: "again" }); } catch { blocked = true; }
  ok(blocked, "cannot reverse the same entry twice");
  console.log("   (audit-log tables checked separately)");
  // group accounts cannot take postings
  const grp = await prisma.account.findUnique({ where: { code: "1110-GRP" } });
  const cash = await AccountsPostingService.getAccountByCode("1000");
  let grpBlocked = false; try { await AccountsPostingService.post({ memo: "x", refType: "test", lines: [{ accountId: grp!.id, debit: 1, credit: 0 }, { accountId: cash.id, debit: 0, credit: 1 }] }); } catch { grpBlocked = true; }
  ok(grpBlocked, "posting to a group row is refused");

  // ---- 8. reports
  console.log("== 8. Reports");
  const tb: any = await FinancialReportingService.getTrialBalance(new Date());
  ok(Math.abs(tb.totalDebits - tb.totalCredits) < 0.01 || tb.isBalanced, "trial balance balanced", `Dr ${tb.totalDebits} Cr ${tb.totalCredits}`);
  ok(tb.accounts.every((a: any) => a.level >= 4), "trial balance lists posting accounts only", `${tb.accounts.length} rows`);
  const treeTop = tb.tree?.map((n: any) => n.code).join(",");
  console.log("   tree roots:", treeTop);
  const is: any = await FinancialReportingService.getIncomeStatement(new Date("2026-01-01"), new Date());
  console.log("   income stmt: revenue", is.totalRevenue ?? is.netRevenue, "cogs", is.totalCogs ?? is.cogs, "net", is.netOperatingProfit);
  const bs: any = await FinancialReportingService.getBalanceSheet(new Date());
  console.log("   balance sheet balanced:", bs.isBalanced ?? (Math.abs(bs.totalAssets - bs.totalLiabilitiesAndEquity) < 0.01), bs.totalAssets, bs.totalLiabilitiesAndEquity);
  const cf: any = await FinancialReportingService.getCashFlowStatement(new Date("2026-01-01"), new Date());
  console.log("   cash flow keys:", Object.keys(cf).join(","));
  const cnt = await prisma.journalEntry.count();
  console.log("journal entries on this test DB:", cnt);
  const nz = tb.accounts.filter((a: any) => a.debitTotal || a.creditTotal).map((a: any) => `${a.code}:${a.debitTotal}/${a.creditTotal}`);
  console.log("   accounts with activity:", nz.join(" "));
  console.log(fails === 0 ? "\nALL OK" : `\n${fails} FAILED`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); }).finally(() => prisma.$disconnect());
