export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { AccountMappingService } from "@/lib/services/AccountMappingService";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tax summary for a period: output tax (sales tax charged), input tax (claimable on bills),
 * WHT deducted from suppliers (payable) and WHT deducted by customers (receivable).
 * GL figures come from the accounts mapped to the tax roles; document figures are for cross-checking.
 */
export async function GET(req: NextRequest) {
  const gate = await requireJobsPermission(req, ["accounts.financial_reports", "accounts.general_ledger", "settings.taxes"]);
  if (gate.error) return gate.error;

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const from = sp.get("from") ? new Date(`${sp.get("from")}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = sp.get("to") ? new Date(`${sp.get("to")}T23:59:59.999`) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  const roles = [
    { role: "sales_tax_payable", label: "Output tax (sales tax charged to customers)", normal: "credit" as const },
    { role: "input_tax_receivable", label: "Input tax (claimable on supplier bills)", normal: "debit" as const },
    { role: "vendor_payment_wht", label: "WHT deducted from suppliers (payable to FBR)", normal: "credit" as const },
    { role: "wht_receivable", label: "WHT deducted by customers (claimable)", normal: "debit" as const },
  ];

  const gl = [];
  for (const r of roles) {
    const acc = await AccountMappingService.resolveAccountOptional({ transactionType: r.role });
    if (!acc) {
      gl.push({ ...r, account: null, debit: 0, credit: 0, net: 0, openingBalance: 0, closingBalance: 0 });
      continue;
    }
    const [period, before] = await Promise.all([
      prisma.journalLine.aggregate({
        where: { accountId: acc.id, journalEntry: { status: { in: ["posted", "reversed", "reversal"] }, date: { gte: from, lte: to } } },
        _sum: { debit: true, credit: true },
      }),
      prisma.journalLine.aggregate({
        where: { accountId: acc.id, journalEntry: { status: { in: ["posted", "reversed", "reversal"] }, date: { lt: from } } },
        _sum: { debit: true, credit: true },
      }),
    ]);
    const sign = r.normal === "credit" ? -1 : 1;
    const debit = r2(period._sum.debit || 0);
    const credit = r2(period._sum.credit || 0);
    const opening = r2(sign * ((before._sum.debit || 0) - (before._sum.credit || 0)));
    const net = r2(sign * (debit - credit));
    gl.push({ ...r, account: { code: acc.code, name: acc.name }, debit, credit, net, openingBalance: opening, closingBalance: r2(opening + net) });
  }

  const [invoiceTax, posTax, billTax, vendorWht] = await Promise.all([
    prisma.invoice.aggregate({ where: { createdAt: { gte: from, lte: to }, status: { not: "cancelled" } }, _sum: { taxAmount: true, amount: true }, _count: { _all: true } }),
    prisma.posSale.aggregate({ where: { createdAt: { gte: from, lte: to }, status: "completed" }, _sum: { taxAmount: true, totalAmount: true }, _count: { _all: true } }),
    prisma.supplierInvoice.aggregate({
      where: { invoiceDate: { gte: from, lte: to }, matchStatus: { in: ["approved_for_payment", "paid"] } },
      _sum: { taxAmount: true, totalAmount: true },
      _count: { _all: true },
    }),
    prisma.vendorLedgerEntry.aggregate({ where: { postingDate: { gte: from, lte: to } }, _sum: { whtWithheld: true } }),
  ]);

  const output = gl[0].net;
  const input = gl[1].net;
  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    gl,
    documents: {
      invoices: { count: invoiceTax._count._all, tax: r2(invoiceTax._sum.taxAmount || 0), total: r2(invoiceTax._sum.amount || 0) },
      pos: { count: posTax._count._all, tax: r2(posTax._sum.taxAmount || 0), total: r2(posTax._sum.totalAmount || 0) },
      supplierBills: { count: billTax._count._all, tax: r2(billTax._sum.taxAmount || 0), total: r2(billTax._sum.totalAmount || 0) },
      supplierWhtFromLedger: r2(vendorWht._sum.whtWithheld || 0),
    },
    netSalesTaxPayable: r2(output - input),
    whtPayable: gl[2].net,
    whtReceivable: gl[3].net,
  });
}
