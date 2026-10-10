export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, resolveJobsActor } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

type PartyType = "customer" | "vendor" | "employee" | "care_of";
type Aging = { current: number; days31To60: number; days61To90: number; days90Plus: number };
type LedgerLine = {
  id: string;
  date: Date;
  reference: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  status?: string;
  source?: string;
};

const ZERO_AGING: Aging = { current: 0, days31To60: 0, days61To90: 0, days90Plus: 0 };
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function addToAging(aging: Aging, amount: number, date: Date | string | null | undefined, asOf: Date) {
  const value = Math.max(0, Number(amount) || 0);
  if (!value) return;
  const sourceDate = date ? new Date(date) : asOf;
  if (sourceDate > asOf) return;
  const ageDays = Math.max(0, Math.floor((asOf.getTime() - sourceDate.getTime()) / 86_400_000));
  if (ageDays <= 30) aging.current += value;
  else if (ageDays <= 60) aging.days31To60 += value;
  else if (ageDays <= 90) aging.days61To90 += value;
  else aging.days90Plus += value;
}

function finalizeAging(aging: Aging) {
  return {
    current: round(aging.current),
    days31To60: round(aging.days31To60),
    days61To90: round(aging.days61To90),
    days90Plus: round(aging.days90Plus),
  };
}

function agingForBalance(aging: Aging, balance: number) {
  const raw = aging.current + aging.days31To60 + aging.days61To90 + aging.days90Plus;
  const outstanding = Math.max(0, balance);
  if (raw <= 0 || outstanding <= 0) return { ...ZERO_AGING };
  const ratio = outstanding / raw;
  return finalizeAging({
    current: aging.current * ratio,
    days31To60: aging.days31To60 * ratio,
    days61To90: aging.days61To90 * ratio,
    days90Plus: aging.days90Plus * ratio,
  });
}

function makeStatement(lines: LedgerLine[], partyType: PartyType, fromText: string | null, toText: string | null) {
  const payable = partyType === "vendor" || partyType === "employee";
  const effect = (line: LedgerLine) => payable ? line.credit - line.debit : line.debit - line.credit;
  const ordered = [...lines].sort((a, b) => a.date.getTime() - b.date.getTime());
  const from = fromText ? new Date(`${fromText}T00:00:00`) : null;
  const to = toText ? new Date(`${toText}T23:59:59.999`) : null;
  const openingBalance = round(ordered.filter((line) => from && line.date < from).reduce((sum, line) => sum + effect(line), 0));
  let runningBalance = openingBalance;
  const transactions = ordered
    .filter((line) => (!from || line.date >= from) && (!to || line.date <= to))
    .map((line) => {
      runningBalance = round(runningBalance + effect(line));
      return { ...line, debit: round(line.debit), credit: round(line.credit), balance: runningBalance };
    });
  return {
    openingBalance,
    transactions,
    summary: {
      openingBalance,
      totalDebit: round(transactions.reduce((sum, line) => sum + line.debit, 0)),
      totalCredit: round(transactions.reduce((sum, line) => sum + line.credit, 0)),
      closingBalance: runningBalance,
      transactionCount: transactions.length,
    },
  };
}

async function directory(asOf: Date) {
  const [customers, vendors, employees, careOfParties, technicianEntries, settings] = await Promise.all([
    prisma.customer.findMany({
      include: {
        customerLedgerEntries: { orderBy: { postingDate: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      include: {
        vendorLedgerEntries: { orderBy: { postingDate: "asc" } },
        supplierInvoices: { orderBy: { invoiceDate: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      include: {
        advances: { orderBy: { createdAt: "asc" } },
        payslips: { include: { payrollRun: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.careOfParty.findMany({
      include: {
        jobs: {
          include: { items: true, hisaabSettlements: { where: { status: { not: "superseded" } } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { companyName: "asc" },
    }),
    prisma.technicianLedgerEntry.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.companySettings.findFirst(),
  ]);

  const invoiceFallback = await prisma.invoice.findMany({ orderBy: { createdAt: "asc" } });
  const invoicesByCustomer = new Map<string, typeof invoiceFallback>();
  for (const invoice of invoiceFallback) {
    if (!invoice.customerId) continue;
    const list = invoicesByCustomer.get(invoice.customerId) || [];
    list.push(invoice);
    invoicesByCustomer.set(invoice.customerId, list);
  }
  const techByEmployee = new Map<string, typeof technicianEntries>();
  for (const entry of technicianEntries) {
    const list = techByEmployee.get(entry.technicianId) || [];
    list.push(entry);
    techByEmployee.set(entry.technicianId, list);
  }

  const customerRows = customers.map((customer) => {
    const aging = { ...ZERO_AGING };
    let balance = 0;
    let transactionCount = 0;
    if (customer.customerLedgerEntries.length) {
      const entries = customer.customerLedgerEntries.filter((entry) => entry.postingDate <= asOf);
      balance = entries[entries.length - 1]?.runningBalance || 0;
      transactionCount = entries.length;
      for (const entry of entries) addToAging(aging, Math.max(0, entry.debit - entry.clearedAmount), entry.dueDate || entry.postingDate, asOf);
    } else {
      const invoices = (invoicesByCustomer.get(customer.id) || []).filter((invoice) => invoice.createdAt <= asOf);
      balance = invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled").reduce((sum, invoice) => sum + invoice.amount, 0);
      transactionCount = invoices.length;
      for (const invoice of invoices) if (invoice.status !== "paid" && invoice.status !== "cancelled") addToAging(aging, invoice.amount, invoice.createdAt, asOf);
    }
    return {
      id: customer.id, type: "customer" as const, name: customer.name, secondary: customer.phone,
      detail: customer.addressText, balance: round(balance), transactionCount, aging: agingForBalance(aging, balance),
    };
  });

  const vendorRows = vendors.map((vendor) => {
    const aging = { ...ZERO_AGING };
    let balance = 0;
    let transactionCount = 0;
    if (vendor.vendorLedgerEntries.length) {
      const entries = vendor.vendorLedgerEntries.filter((entry) => entry.postingDate <= asOf);
      balance = entries[entries.length - 1]?.runningBalance || 0;
      transactionCount = entries.length;
      for (const entry of entries) addToAging(aging, Math.max(0, entry.credit - entry.clearedAmount), entry.dueDate || entry.postingDate, asOf);
    } else {
      const invoices = vendor.supplierInvoices.filter((invoice) => invoice.invoiceDate <= asOf);
      balance = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount), 0);
      transactionCount = invoices.length;
      for (const invoice of invoices) addToAging(aging, Math.max(0, invoice.totalAmount - invoice.paidAmount), invoice.dueDate || invoice.invoiceDate, asOf);
    }
    return {
      id: vendor.id, type: "vendor" as const, name: vendor.name, secondary: vendor.phone || vendor.contactPerson,
      detail: vendor.category, balance: round(balance), transactionCount, aging: agingForBalance(aging, balance),
    };
  });

  const employeeRows = employees.map((employee) => {
    const aging = { ...ZERO_AGING };
    let credits = 0;
    let debits = 0;
    const payslips = employee.payslips.filter((payslip) => payslip.createdAt <= asOf);
    const advances = employee.advances.filter((advance) => advance.createdAt <= asOf);
    for (const payslip of payslips) {
      credits += payslip.netSalary;
      if (payslip.status === "paid" || payslip.payrollRun.status === "Paid") debits += payslip.netSalary;
      else addToAging(aging, payslip.netSalary, payslip.createdAt, asOf);
    }
    for (const advance of advances) if (advance.status !== "recovered") debits += advance.amount;
    const techEntries = (techByEmployee.get(employee.id) || []).filter((entry) => entry.createdAt <= asOf).filter((entry) =>
      entry.type !== "advance" || !advances.some((advance) =>
        Math.abs(advance.amount - entry.amount) < 0.005 &&
        Math.abs(advance.createdAt.getTime() - entry.createdAt.getTime()) < 300_000
      )
    );
    for (const entry of techEntries) {
      if (entry.type === "expense_owed" || entry.type === "hisaab_received" || entry.type === "advance_recovered") credits += entry.amount;
      else debits += entry.amount;
      if (entry.type === "expense_owed") addToAging(aging, entry.amount, entry.createdAt, asOf);
    }
    return {
      id: employee.id, type: "employee" as const, name: employee.name, secondary: employee.phone,
      detail: `${employee.department} · ${employee.designation || employee.role}`,
      balance: round(credits - debits), transactionCount: payslips.length + advances.length + techEntries.length,
      aging: agingForBalance(aging, credits - debits),
    };
  });

  const careOfRows = careOfParties.map((party) => {
    const aging = { ...ZERO_AGING };
    let charges = 0;
    let collections = 0;
    let transactionCount = 0;
    for (const job of party.jobs.filter((item) => item.createdAt <= asOf)) {
      const gross = job.items.reduce((sum, item) => sum + (item.quantityActual ?? item.quantityPlanned) * item.unitRate, 0);
      const net = Math.max(0, gross - (job.discountAmount || 0));
      charges += net;
      const availableSettlements = job.hisaabSettlements.filter((settlement) => settlement.settledAt <= asOf);
      const posted = availableSettlements.filter((settlement) => settlement.status === "posted");
      const effective = posted.length ? posted : availableSettlements.slice(-1);
      const collected = effective.reduce((sum, settlement) => sum + settlement.amountCollected, 0);
      collections += collected;
      transactionCount += 1 + effective.length;
      addToAging(aging, Math.max(0, net - collected), job.finalizedAt || job.createdAt, asOf);
    }
    return {
      id: party.id, type: "care_of" as const, name: party.companyName,
      secondary: party.personName || party.phone || "", detail: party.phone || "Care-of account",
      balance: round(charges - collections), transactionCount, aging: agingForBalance(aging, charges - collections),
    };
  });

  const parties = [...customerRows, ...vendorRows, ...employeeRows, ...careOfRows];
  return {
    company: { name: settings?.legalName || settings?.tradeName || "Workman Services", currency: settings?.baseCurrency || "PKR" },
    asOfDate: asOf,
    parties,
    totals: {
      customers: customerRows.length,
      vendors: vendorRows.length,
      employees: employeeRows.length,
      careOf: careOfRows.length,
      outstandingReceivables: round(customerRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0) + careOfRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0)),
      outstandingPayables: round(vendorRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0) + employeeRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0)),
    },
  };
}

async function statement(type: PartyType, id: string, from: string | null, to: string | null, asOf: Date) {
  const lines: LedgerLine[] = [];
  let party: Record<string, unknown> | null = null;
  const aging = { ...ZERO_AGING };

  if (type === "customer") {
    const customer = await prisma.customer.findUnique({ where: { id }, include: { customerLedgerEntries: { orderBy: { postingDate: "asc" } } } });
    if (!customer) return null;
    party = { id, type, name: customer.name, phone: customer.phone, email: customer.email, address: customer.addressText };
    if (customer.customerLedgerEntries.length) {
      for (const entry of customer.customerLedgerEntries) {
        lines.push({ id: entry.id, date: entry.postingDate, reference: entry.documentNumber, type: entry.entryType, description: entry.notes || entry.entryType.replaceAll("_", " "), debit: entry.debit, credit: entry.credit, status: entry.isFullyCleared ? "cleared" : "open", source: "Customer sub-ledger" });
        addToAging(aging, Math.max(0, entry.debit - entry.clearedAmount), entry.dueDate || entry.postingDate, asOf);
      }
    } else {
      const invoices = await prisma.invoice.findMany({ where: { customerId: id }, orderBy: { createdAt: "asc" } });
      for (const invoice of invoices) {
        lines.push({ id: `inv-${invoice.id}`, date: invoice.createdAt, reference: invoice.invoiceNumber, type: "invoice", description: invoice.jobId ? `Job invoice · ${invoice.jobId}` : "Direct invoice", debit: invoice.amount, credit: 0, status: invoice.status, source: "Invoices" });
        if (invoice.status === "paid") lines.push({ id: `pay-${invoice.id}`, date: invoice.createdAt, reference: `REC-${invoice.invoiceNumber}`, type: "payment", description: "Payment received", debit: 0, credit: invoice.amount, status: "cleared", source: "Invoices" });
        else if (invoice.status !== "cancelled") addToAging(aging, invoice.amount, invoice.createdAt, asOf);
      }
    }
  } else if (type === "vendor") {
    const vendor = await prisma.vendor.findUnique({ where: { id }, include: { vendorLedgerEntries: { orderBy: { postingDate: "asc" } }, supplierInvoices: { include: { payments: true }, orderBy: { invoiceDate: "asc" } } } });
    if (!vendor) return null;
    party = { id, type, name: vendor.name, phone: vendor.phone, email: vendor.email, address: vendor.addressText, contactPerson: vendor.contactPerson, ntnNumber: vendor.ntnNumber };
    if (vendor.vendorLedgerEntries.length) {
      for (const entry of vendor.vendorLedgerEntries) {
        lines.push({ id: entry.id, date: entry.postingDate, reference: entry.documentNumber, type: entry.entryType, description: entry.notes || entry.entryType.replaceAll("_", " "), debit: entry.debit, credit: entry.credit, status: entry.isFullyCleared ? "cleared" : "open", source: "Vendor sub-ledger" });
        addToAging(aging, Math.max(0, entry.credit - entry.clearedAmount), entry.dueDate || entry.postingDate, asOf);
      }
    } else {
      for (const invoice of vendor.supplierInvoices) {
        lines.push({ id: `bill-${invoice.id}`, date: invoice.invoiceDate, reference: invoice.referenceNumber, type: "supplier_bill", description: `Supplier invoice ${invoice.invoiceNumber}`, debit: 0, credit: invoice.totalAmount, status: invoice.paymentStatus, source: "Supplier invoices" });
        for (const payment of invoice.payments) lines.push({ id: `pay-${payment.id}`, date: payment.paymentDate, reference: payment.paymentNumber, type: "payment", description: payment.notes || `${payment.paymentMethod.replaceAll("_", " ")} payment`, debit: payment.amount + payment.whtAmount, credit: 0, status: "cleared", source: "Supplier payments" });
        addToAging(aging, Math.max(0, invoice.totalAmount - invoice.paidAmount), invoice.dueDate || invoice.invoiceDate, asOf);
      }
    }
  } else if (type === "employee") {
    const employee = await prisma.employee.findUnique({ where: { id }, include: { advances: { orderBy: { createdAt: "asc" } }, payslips: { include: { payrollRun: true }, orderBy: { createdAt: "asc" } } } });
    if (!employee) return null;
    party = { id, type, name: employee.name, phone: employee.phone, email: employee.email, department: employee.department, designation: employee.designation || employee.role };
    for (const payslip of employee.payslips) {
      lines.push({ id: `salary-${payslip.id}`, date: payslip.createdAt, reference: `PAYROLL-${payslip.payrollRun.period}`, type: "salary_accrual", description: `Net salary · ${payslip.payrollRun.period}`, debit: 0, credit: payslip.netSalary, status: payslip.status, source: "Payroll" });
      if (payslip.status === "paid" || payslip.payrollRun.status === "Paid") lines.push({ id: `salary-pay-${payslip.id}`, date: payslip.createdAt, reference: `SAL-${payslip.id.slice(-6).toUpperCase()}`, type: "salary_payment", description: `Salary paid · ${payslip.payrollRun.period}`, debit: payslip.netSalary, credit: 0, status: "cleared", source: "Payroll" });
      else addToAging(aging, payslip.netSalary, payslip.createdAt, asOf);
    }
    for (const advance of employee.advances) lines.push({ id: `advance-${advance.id}`, date: advance.createdAt, reference: `ADV-${advance.id.slice(-6).toUpperCase()}`, type: "employee_advance", description: `Employee advance · ${advance.status}`, debit: advance.amount, credit: 0, status: advance.status, source: "HR advances" });
    const rawTechEntries = await prisma.technicianLedgerEntry.findMany({ where: { technicianId: id }, orderBy: { createdAt: "asc" } });
    const techEntries = rawTechEntries.filter((entry) =>
      entry.type !== "advance" || !employee.advances.some((advance) =>
        Math.abs(advance.amount - entry.amount) < 0.005 &&
        Math.abs(advance.createdAt.getTime() - entry.createdAt.getTime()) < 300_000
      )
    );
    for (const entry of techEntries) {
      const credit = ["expense_owed", "hisaab_received", "advance_recovered"].includes(entry.type);
      lines.push({ id: `tech-${entry.id}`, date: entry.createdAt, reference: entry.refJobId || `TECH-${entry.id.slice(-6).toUpperCase()}`, type: entry.type, description: entry.notes || entry.type.replaceAll("_", " "), debit: credit ? 0 : entry.amount, credit: credit ? entry.amount : 0, status: "posted", source: "Technician ledger" });
      if (entry.type === "expense_owed") addToAging(aging, entry.amount, entry.createdAt, asOf);
    }
  } else {
    const careOf = await prisma.careOfParty.findUnique({ where: { id }, include: { jobs: { include: { items: true, hisaabSettlements: { where: { status: { not: "superseded" } }, orderBy: { settledAt: "asc" } } }, orderBy: { createdAt: "asc" } } } });
    if (!careOf) return null;
    party = { id, type, name: careOf.companyName, contactPerson: careOf.personName, phone: careOf.phone };
    for (const job of careOf.jobs) {
      const gross = job.items.reduce((sum, item) => sum + (item.quantityActual ?? item.quantityPlanned) * item.unitRate, 0);
      const net = Math.max(0, gross - (job.discountAmount || 0));
      lines.push({ id: `job-${job.id}`, date: job.finalizedAt || job.createdAt, reference: job.jobNumber, type: "work_order", description: `${job.jobType} · ${job.remarks || "HVAC services"}`, debit: net, credit: 0, status: job.status, source: "Care-of jobs" });
      const posted = job.hisaabSettlements.filter((settlement) => settlement.status === "posted");
      const effective = posted.length ? posted : job.hisaabSettlements.slice(-1);
      for (const settlement of effective) lines.push({ id: `settlement-${settlement.id}`, date: settlement.settledAt, reference: `SET-${job.jobNumber}`, type: "collection", description: settlement.accountantNotes || `Collection against ${job.jobNumber}`, debit: 0, credit: settlement.amountCollected, status: settlement.status, source: "Job settlements" });
      addToAging(aging, Math.max(0, net - effective.reduce((sum, settlement) => sum + settlement.amountCollected, 0)), job.finalizedAt || job.createdAt, asOf);
    }
  }

  const prepared = makeStatement(lines.filter((line) => line.date <= asOf), type, from, to);
  return { party, ...prepared, aging: agingForBalance(aging, prepared.summary.closingBalance), asOfDate: asOf };
}

export async function GET(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  if (!roleHasPermission(resolved.actor.role, "accounts.general_ledger")) {
    return NextResponse.json({ error: "You do not have permission to view statements of account." }, { status: 403 });
  }

  try {
    const params = new URL(req.url).searchParams;
    const mode = params.get("mode") || "directory";
    const asOf = params.get("asOf") ? new Date(`${params.get("asOf")}T23:59:59.999`) : new Date();
    if (Number.isNaN(asOf.getTime())) return NextResponse.json({ error: "Invalid as-of date" }, { status: 400 });
    if (mode === "directory") return NextResponse.json({ success: true, ...(await directory(asOf)) });

    const type = params.get("type") as PartyType;
    const id = params.get("id");
    if (!id || !["customer", "vendor", "employee", "care_of"].includes(type)) {
      return NextResponse.json({ error: "A valid party type and id are required" }, { status: 400 });
    }
    const result = await statement(type, id, params.get("from"), params.get("to"), asOf);
    if (!result) return NextResponse.json({ error: "Ledger party not found" }, { status: 404 });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load statements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
