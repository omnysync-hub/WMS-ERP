export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { FiscalPeriodService } from "@/lib/services/FiscalPeriodService";
import { FinancialReportingService } from "@/lib/services/FinancialReportingService";
import { SubLedgerService } from "@/lib/services/SubLedgerService";
import { STANDARD_COA_DEFINITIONS } from "@/lib/constants/chartOfAccountsHierarchy";
import { BASELINE_MAPPINGS } from "@/lib/constants/baselineMappings";
import { requirePermission } from "@/lib/auth/erpActor";
import { careOfReceivableAccountId } from "@/lib/careOfLedger";
import {
  accountingPolicyReadiness,
  ExpenseCategoryConfig,
  PaymentMethodConfig,
  TaxRule,
} from "@/lib/accountingConfig";

const clean = (value: unknown) => String(value ?? "").trim();
const roundMoney = (value: unknown) => Math.round(Number(value) * 100) / 100;

/**
 * Control accounts whose opening balance comes from the party opening balances (sub-ledgers), so the
 * GL control always equals the sum of the parties: AR = customers, AP = suppliers, advances = employees.
 */
async function resolveOpeningControlAccounts() {
  const safe = async (transactionType: string) => {
    try {
      return await AccountMappingService.resolveAccount({ transactionType });
    } catch {
      return null;
    }
  };
  const [ar, ap, advances, equity] = await Promise.all([
    safe("ar_control"),
    safe("ap_control"),
    safe("advance_granted_receivable"),
    safe("opening_balance_equity"),
  ]);
  return { ar, ap, advances, equity };
}

async function partyOpeningTotals() {
  const rows = await prisma.partyOpeningBalance.findMany();
  const sum = (type: string, sign: 1 | -1) =>
    roundMoney(rows.filter((r) => r.partyType === type).reduce((s, r) => s + sign * (r.debit - r.credit), 0));
  return { customers: sum("customer", 1), vendors: sum("vendor", -1), employees: sum("employee", 1) };
}

async function recalculateCustomerLedger(tx: any, customerId: string) {
  const entries = await tx.customerLedgerEntry.findMany({
    where: { customerId },
    orderBy: [{ postingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let runningBalance = 0;
  for (const entry of entries) {
    runningBalance = roundMoney(runningBalance + entry.debit - entry.credit);
    await tx.customerLedgerEntry.update({ where: { id: entry.id }, data: { runningBalance } });
  }
}

async function recalculateVendorLedger(tx: any, vendorId: string) {
  const entries = await tx.vendorLedgerEntry.findMany({
    where: { vendorId },
    orderBy: [{ postingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let runningBalance = 0;
  for (const entry of entries) {
    runningBalance = roundMoney(runningBalance + entry.credit - entry.debit);
    await tx.vendorLedgerEntry.update({ where: { id: entry.id }, data: { runningBalance } });
  }
}

export async function GET(req: NextRequest) {
  try {
    const gate = requirePermission(req, "settings.accounting");
    if (gate.error) return gate.error;
    // 1. Get or create CompanySettings singleton
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          legalName: "",
          tradeName: null,
          addressText: "",
          phone: "",
          email: "",
          ntnNumber: null,
          strnNumber: null,
          baseCurrency: "PKR",
          fiscalYearStartMonth: 7, // July
          isSetupCompleted: false,
        },
      });
    }

    // 2. Check Fiscal Periods
    const currentYear = FiscalPeriodService.fiscalYearFor(new Date(), settings.fiscalYearStartMonth || 7);
    // Make sure the fiscal year containing today exists (idempotent) so postings land in an open period.
    await FiscalPeriodService.seedFiscalYear(currentYear, settings.fiscalYearStartMonth || 7);
    const periods = await prisma.fiscalPeriod.findMany({
      where: { fiscalYear: currentYear },
      orderBy: { periodNumber: "asc" },
    });

    // 3. Check Level 4 Accounts ready for opening balance entry
    for (const def of STANDARD_COA_DEFINITIONS) {
      if (!def.isGroup && def.level === 4) {
        await AccountsPostingService.getAccountByCode(def.code).catch(() => null);
      }
    }

    const accounts = await prisma.account.findMany({
      where: { isActive: true, level: 4 },
      orderBy: { code: "asc" },
    });

    // 4. Check if Opening Balance has been posted
    const openingVoucher = await prisma.journalEntry.findFirst({
      where: { refType: "opening_balance", status: "posted" },
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { account: true } } },
    });
    const openingControls = await resolveOpeningControlAccounts();
    const openingPartyTotals = await partyOpeningTotals();

    // 5. Counts for master data
    const [customerCount, vendorCount, productCount, employeeCount] = await Promise.all([
      prisma.customer.count(),
      prisma.vendor.count(),
      prisma.product.count(),
      prisma.employee.count({ where: { active: true } }),
    ]);

    // 6. Trial Balance equilibrium check
    const tb = await FinancialReportingService.getTrialBalance();

    const mappingCompleteness = await AccountMappingService.getCompleteness("DEFAULT");
    const leafAccounts = accounts.filter((a) => a.level >= 4 && a.isActive);
    const [financialAccounts, careOfParties, partyOpeningBalances, customers, vendors, employees] = await Promise.all([
      prisma.financialAccount.findMany({ include: { ledgerAccount: true }, orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { name: "asc" }] }),
      prisma.careOfParty.findMany({ include: { ledgerAccount: true }, orderBy: { companyName: "asc" } }),
      prisma.partyOpeningBalance.findMany({ orderBy: [{ partyType: "asc" }, { partyName: "asc" }] }),
      prisma.customer.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
      prisma.vendor.findMany({ select: { id: true, name: true, vendorCode: true }, orderBy: { name: "asc" } }),
      prisma.employee.findMany({ where: { active: true }, select: { id: true, name: true, phone: true, department: true }, orderBy: { name: "asc" } }),
    ]);
    const policyReadiness = accountingPolicyReadiness(settings);
    const activeFinancialAccounts = financialAccounts.filter((item: any) => item.isActive);
    const careOfReady = Boolean(settings.careOfSetupCompleted) && careOfParties.every((item: any) => Boolean(item.ledgerAccountId));
    let subledgerReconciliation: any = null;
    try {
      subledgerReconciliation = await SubLedgerService.checkReconciliationDrift();
    } catch {
      // Account mappings may not exist until the mapping step is complete.
    }
    const accountingReadiness = {
      policies: policyReadiness.complete,
      financialAccounts: Boolean(settings.financialAccountsCompleted) && activeFinancialAccounts.length > 0 && activeFinancialAccounts.some((item: any) => item.isDefault),
      careOf: careOfReady,
      partyBalances: Boolean(settings.partyBalancesCompleted),
    };
    const accountingConfigurationComplete = Object.values(accountingReadiness).every(Boolean);

    return NextResponse.json({
      success: true,
      settings,
      periodsCount: periods.length,
      periods,
      accounts: leafAccounts,
      allAccounts: accounts,
      openingVoucher,
      openingSetup: {
        equityAccount: openingControls.equity ? { code: openingControls.equity.code, name: openingControls.equity.name } : null,
        // These are filled automatically from the party opening balances step.
        autoAccounts: [
          openingControls.ar && { code: openingControls.ar.code, name: openingControls.ar.name, source: "Customer balances", amount: openingPartyTotals.customers, side: openingPartyTotals.customers >= 0 ? "debit" : "credit" },
          openingControls.ap && { code: openingControls.ap.code, name: openingControls.ap.name, source: "Supplier balances", amount: openingPartyTotals.vendors, side: openingPartyTotals.vendors >= 0 ? "credit" : "debit" },
          openingControls.advances && { code: openingControls.advances.code, name: openingControls.advances.name, source: "Employee advance balances", amount: openingPartyTotals.employees, side: openingPartyTotals.employees >= 0 ? "debit" : "credit" },
        ].filter(Boolean),
      },
      mappingCompleteness,
      trialBalanceStatus: {
        totalDebits: tb.totalDebits,
        totalCredits: tb.totalCredits,
        variance: tb.variance,
        isInBalance: tb.isInBalance,
      },
      counts: {
        customers: customerCount,
        vendors: vendorCount,
        products: productCount,
        employees: employeeCount,
      },
      accountingConfig: {
        invoice: { prefix: settings.invoicePrefix, nextNumber: settings.invoiceNextNumber, padding: settings.invoiceNumberPadding },
        taxRules: policyReadiness.taxRules,
        paymentMethods: policyReadiness.paymentMethods,
        agingBuckets: policyReadiness.agingBuckets,
        expenseCategories: policyReadiness.expenseCategories,
        financialAccounts,
        careOfParties,
        partyOpeningBalances,
        parties: { customers, vendors, employees },
        readiness: accountingReadiness,
        complete: accountingConfigurationComplete,
        subledgerReconciliation,
      },
      isReadyToGoLive:
        settings.isSetupCompleted ||
        (periods.length > 0 &&
          tb.isInBalance &&
          leafAccounts.length > 0 &&
          mappingCompleteness.isComplete &&
          accountingConfigurationComplete),
    });
  } catch (err: any) {
    console.error("GET /api/setup error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch setup status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = requirePermission(req, "settings.accounting");
    if (gate.error) return gate.error;
    const body = await req.json();
    const { action } = body;

    // Opening balances define the books; once go-live is complete they must not be silently replaced.
    if (action === "post_opening_balances" || action === "save_party_opening_balances") {
      const live = await prisma.companySettings.findFirst({ select: { isSetupCompleted: true } });
      if (live?.isSetupCompleted && body.confirmAfterGoLive !== true) {
        return NextResponse.json(
          {
            error:
              "Go-live is already complete. Changing opening balances now would rewrite posted history; post a dated adjusting journal instead (or resend with confirmAfterGoLive: true if you really must).",
            code: "AFTER_GO_LIVE",
          },
          { status: 409 }
        );
      }
    }

    // STEP 1: SAVE COMPANY PROFILE & SEED FISCAL YEAR
    if (action === "save_company") {
      const {
        legalName,
        tradeName,
        addressText,
        phone,
        email,
        ntnNumber,
        strnNumber,
        fiscalYearStartMonth = 7,
      } = body;

      const normalizedLegalName = String(legalName || "").trim();
      const normalizedAddress = String(addressText || "").trim();
      const normalizedPhone = String(phone || "").trim();
      const normalizedEmail = String(email || "").trim();
      if (!normalizedLegalName || !normalizedAddress || !normalizedPhone || !normalizedEmail) {
        return NextResponse.json(
          { error: "Legal name, registered address, phone, and company email are required." },
          { status: 400 }
        );
      }

      let settings = await prisma.companySettings.findFirst();
      if (settings) {
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: {
            legalName: normalizedLegalName,
            tradeName: String(tradeName || "").trim() || null,
            addressText: normalizedAddress,
            phone: normalizedPhone,
            email: normalizedEmail,
            ntnNumber: String(ntnNumber || "").trim() || null,
            strnNumber: String(strnNumber || "").trim() || null,
            fiscalYearStartMonth: Number(fiscalYearStartMonth) || 7,
          },
        });
      } else {
        settings = await prisma.companySettings.create({
          data: {
            legalName: normalizedLegalName,
            tradeName: String(tradeName || "").trim() || null,
            addressText: normalizedAddress,
            phone: normalizedPhone,
            email: normalizedEmail,
            ntnNumber: String(ntnNumber || "").trim() || null,
            strnNumber: String(strnNumber || "").trim() || null,
            fiscalYearStartMonth: Number(fiscalYearStartMonth) || 7,
            baseCurrency: "PKR",
          },
        });
      }

      // Seed 12 Fiscal Periods automatically
      const currentYear = FiscalPeriodService.fiscalYearFor(new Date(), Number(fiscalYearStartMonth) || 7);
      const periods = await FiscalPeriodService.seedFiscalYear(currentYear, Number(fiscalYearStartMonth) || 7);

      return NextResponse.json({
        success: true,
        settings,
        periodsCount: periods.length,
        message: "Company profile saved and fiscal periods initialized.",
      });
    }

    if (action === "save_accounting_policies") {
      const invoicePrefix = clean(body.invoicePrefix).toUpperCase();
      const invoiceNextNumber = Number(body.invoiceNextNumber);
      const invoiceNumberPadding = Number(body.invoiceNumberPadding);
      const agingBuckets = Array.isArray(body.agingBuckets) ? body.agingBuckets.map(Number) : [];
      const taxRules: TaxRule[] = (Array.isArray(body.taxRules) ? body.taxRules : []).map((item: any, index: number): TaxRule => ({
        id: clean(item.id) || `tax-${index + 1}`,
        name: clean(item.name),
        code: clean(item.code).toUpperCase(),
        type: item.type,
        rate: Number(item.rate),
        appliesTo: item.appliesTo,
        inclusive: Boolean(item.inclusive),
        isDefault: Boolean(item.isDefault),
        active: item.active !== false,
        // Keep the extra fields edited in Settings > Taxes
        ...(typeof item.effectiveFrom === "string" && item.effectiveFrom ? { effectiveFrom: item.effectiveFrom } : {}),
        ...(typeof item.accountRole === "string" && item.accountRole ? { accountRole: item.accountRole } : {}),
      }));
      const paymentMethods: PaymentMethodConfig[] = (Array.isArray(body.paymentMethods) ? body.paymentMethods : []).map((item: any, index: number): PaymentMethodConfig => ({
        id: clean(item.id) || `payment-${index + 1}`,
        name: clean(item.name),
        code: clean(item.code).toLowerCase(),
        kind: item.kind,
        requiresReference: Boolean(item.requiresReference),
        financialAccountId: clean(item.financialAccountId) || undefined,
        active: item.active !== false,
      }));
      const expenseCategories: ExpenseCategoryConfig[] = (Array.isArray(body.expenseCategories) ? body.expenseCategories : []).map((item: any, index: number): ExpenseCategoryConfig => ({
        id: clean(item.id) || `expense-${index + 1}`,
        name: clean(item.name),
        code: clean(item.code).toUpperCase(),
        accountId: clean(item.accountId),
        active: item.active !== false,
      }));

      if (!/^[A-Z0-9-]{2,12}$/.test(invoicePrefix)) {
        return NextResponse.json({ error: "Invoice prefix must be 2–12 uppercase letters, numbers, or hyphens." }, { status: 400 });
      }
      if (!Number.isInteger(invoiceNextNumber) || invoiceNextNumber < 1 || !Number.isInteger(invoiceNumberPadding) || invoiceNumberPadding < 3 || invoiceNumberPadding > 10) {
        return NextResponse.json({ error: "Invoice next number and padding are invalid." }, { status: 400 });
      }
      const nextInvoicePreview = `${invoicePrefix}-${new Date().getFullYear()}-${String(invoiceNextNumber).padStart(invoiceNumberPadding, "0")}`;
      if (await prisma.invoice.findUnique({ where: { invoiceNumber: nextInvoicePreview } })) {
        return NextResponse.json({ error: `Invoice number ${nextInvoicePreview} already exists. Increase the next invoice number.` }, { status: 400 });
      }
      if (agingBuckets.length !== 3 || !agingBuckets.every((item: number) => Number.isInteger(item) && item > 0) || !(agingBuckets[0] < agingBuckets[1] && agingBuckets[1] < agingBuckets[2])) {
        return NextResponse.json({ error: "Enter exactly three increasing aging cutoffs, such as 30, 60, and 90 days." }, { status: 400 });
      }
      if (!taxRules.length || taxRules.some((item: any) => !item.name || !item.code || !["sales_tax", "services_tax", "withholding", "other"].includes(item.type) || !["sales", "purchases", "both"].includes(item.appliesTo) || !Number.isFinite(item.rate) || item.rate < 0 || item.rate > 100)) {
        return NextResponse.json({ error: "Add at least one complete tax rule with a rate from 0 to 100%." }, { status: 400 });
      }
      if (!paymentMethods.length || paymentMethods.some((item: any) => !item.name || !item.code || !["cash", "bank", "card", "cheque", "digital", "credit", "split"].includes(item.kind))) {
        return NextResponse.json({ error: "Add at least one complete payment method." }, { status: 400 });
      }
      if (!expenseCategories.length || expenseCategories.some((item: any) => !item.name || !item.code || !item.accountId)) {
        return NextResponse.json({ error: "Add at least one expense category and map it to an expense account." }, { status: 400 });
      }
      const unique = (items: string[]) => new Set(items).size === items.length;
      if (!unique(taxRules.map((item: any) => item.code)) || !unique(paymentMethods.map((item: any) => item.code)) || !unique(expenseCategories.map((item: any) => item.code))) {
        return NextResponse.json({ error: "Tax, payment-method, and expense-category codes must be unique." }, { status: 400 });
      }
      const expenseAccountIds = [...new Set(expenseCategories.map((item: any) => item.accountId))];
      const validExpenseAccounts = await prisma.account.count({ where: { id: { in: expenseAccountIds }, type: "expense", isActive: true, level: { gte: 4 } } });
      if (validExpenseAccounts !== expenseAccountIds.length) {
        return NextResponse.json({ error: "Every expense category must use an active leaf expense account." }, { status: 400 });
      }

      const existing = await prisma.companySettings.findFirst();
      if (!existing) return NextResponse.json({ error: "Save the company profile first." }, { status: 400 });
      const settings = await prisma.companySettings.update({
        where: { id: existing.id },
        data: { invoicePrefix, invoiceNextNumber, invoiceNumberPadding, agingBuckets, taxRules, paymentMethods, expenseCategories, accountingPoliciesCompleted: true },
      });
      return NextResponse.json({ success: true, settings, message: "Accounting policies, numbering, taxes, payment methods, aging, and expense categories saved." });
    }

    if (action === "save_financial_accounts") {
      const rows = Array.isArray(body.accounts) ? body.accounts : [];
      if (!rows.length) return NextResponse.json({ error: "Add at least one cash or bank account." }, { status: 400 });
      const normalized = rows.map((item: any) => ({
        id: clean(item.id),
        name: clean(item.name),
        kind: clean(item.kind).toLowerCase(),
        accountCode: clean(item.accountCode),
        bankName: clean(item.bankName) || null,
        accountTitle: clean(item.accountTitle) || null,
        accountNumberMasked: clean(item.accountNumberMasked) || null,
        iban: clean(item.iban).toUpperCase() || null,
        branchCode: clean(item.branchCode) || null,
        isDefault: Boolean(item.isDefault),
      }));
      if (normalized.some((item: any) => !item.name || !item.accountCode || !["cash", "bank", "card_clearing", "digital_wallet"].includes(item.kind))) {
        return NextResponse.json({ error: "Every financial account needs a name, ledger code, and valid account type." }, { status: 400 });
      }
      if (new Set(normalized.map((item: any) => item.accountCode)).size !== normalized.length || normalized.filter((item: any) => item.isDefault).length !== 1) {
        return NextResponse.json({ error: "Ledger codes must be unique and exactly one financial account must be the default." }, { status: 400 });
      }
      const saved = await prisma.$transaction(async (tx) => {
        const ledgerIds: string[] = [];
        const result = [];
        for (const item of normalized) {
          const found = await tx.account.findUnique({ where: { code: item.accountCode } });
          if (found && (found.type !== "asset" || found.level < 4)) {
            throw new Error(`Account ${item.accountCode} must be an asset leaf account.`);
          }
          const ledgerAccount = found
            ? await tx.account.update({ where: { id: found.id }, data: { name: item.name, isActive: true } })
            : await tx.account.create({ data: { code: item.accountCode, name: item.name, type: "asset", level: 4, isActive: true, isSystem: false, currency: "PKR", companyId: "DEFAULT" } });
          ledgerIds.push(ledgerAccount.id);
          const financial = await tx.financialAccount.upsert({
            where: { ledgerAccountId: ledgerAccount.id },
            update: { name: item.name, kind: item.kind, bankName: item.bankName, accountTitle: item.accountTitle, accountNumberMasked: item.accountNumberMasked, iban: item.iban, branchCode: item.branchCode, isDefault: item.isDefault, isActive: true },
            create: { name: item.name, kind: item.kind, ledgerAccountId: ledgerAccount.id, bankName: item.bankName, accountTitle: item.accountTitle, accountNumberMasked: item.accountNumberMasked, iban: item.iban, branchCode: item.branchCode, isDefault: item.isDefault, isActive: true },
            include: { ledgerAccount: true },
          });
          result.push(financial);
        }
        await tx.financialAccount.updateMany({ where: { ledgerAccountId: { notIn: ledgerIds } }, data: { isActive: false, isDefault: false } });
        const settings = await tx.companySettings.findFirst();
        if (!settings) throw new Error("Save the company profile first.");
        await tx.companySettings.update({ where: { id: settings.id }, data: { financialAccountsCompleted: true } });
        const defaultAccount = result.find((item: any) => item.isDefault)!;
        await AccountMappingService.setMapping("DEFAULT", "bank_operating", defaultAccount.ledgerAccountId, null, gate.actor.name, tx);
        return result;
      });
      return NextResponse.json({ success: true, financialAccounts: saved, message: `${saved.length} cash/bank account(s) saved and linked to the chart of accounts.` });
    }

    if (action === "save_care_of_setup") {
      const rows = Array.isArray(body.parties) ? body.parties : [];
      for (const item of rows) {
        if (!clean(item.companyName)) {
          return NextResponse.json({ error: "Every care-of party needs a company name." }, { status: 400 });
        }
        if (!clean(item.ledgerAccountId)) {
          // Default to the care-of receivables ledger (1101) when none was chosen.
          try {
            item.ledgerAccountId = await careOfReceivableAccountId(prisma);
          } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 400 });
          }
        }
        const account = await prisma.account.findUnique({ where: { id: clean(item.ledgerAccountId) } });
        if (!account || !account.isActive || account.level < 4 || account.type !== "asset") {
          return NextResponse.json({ error: `Care-of party ${clean(item.companyName)} must use an active leaf asset account.` }, { status: 400 });
        }
      }
      const saved = await prisma.$transaction(async (tx) => {
        const result = [];
        for (const item of rows) {
          const data = { companyName: clean(item.companyName), personName: clean(item.personName), phone: clean(item.phone) || null, ledgerAccountId: clean(item.ledgerAccountId) };
          const party = clean(item.id)
            ? await tx.careOfParty.update({ where: { id: clean(item.id) }, data })
            : await tx.careOfParty.create({ data });
          result.push(party);
        }
        const settings = await tx.companySettings.findFirst();
        if (!settings) throw new Error("Save the company profile first.");
        await tx.companySettings.update({ where: { id: settings.id }, data: { careOfSetupCompleted: true } });
        return result;
      });
      return NextResponse.json({ success: true, careOfParties: saved, message: rows.length ? `${rows.length} care-of ledger(s) configured.` : "Confirmed that no care-of ledgers are required at go-live." });
    }

    if (action === "save_party_opening_balances") {
      const rows = Array.isArray(body.balances) ? body.balances : [];
      const postingDate = body.postingDate ? new Date(body.postingDate) : new Date();
      if (Number.isNaN(postingDate.getTime())) return NextResponse.json({ error: "Opening balance date is invalid." }, { status: 400 });
      const normalized = rows.map((item: any) => ({ partyType: clean(item.partyType).toLowerCase(), partyId: clean(item.partyId), debit: roundMoney(item.debit || 0), credit: roundMoney(item.credit || 0), dueDate: item.dueDate ? new Date(item.dueDate) : null, notes: clean(item.notes) || null }));
      for (const item of normalized) {
        if (!['customer', 'vendor', 'employee'].includes(item.partyType) || !item.partyId || item.debit < 0 || item.credit < 0 || (item.debit > 0) === (item.credit > 0) || (item.dueDate && Number.isNaN(item.dueDate.getTime()))) {
          return NextResponse.json({ error: "Each party balance needs a valid party, exactly one positive debit or credit, and valid dates." }, { status: 400 });
        }
      }
      if (new Set(normalized.map((item: any) => `${item.partyType}:${item.partyId}`)).size !== normalized.length) {
        return NextResponse.json({ error: "Each party can appear only once in opening balances." }, { status: 400 });
      }
      const saved = await prisma.$transaction(async (tx) => {
        await tx.partyOpeningBalance.deleteMany();
        await tx.customerLedgerEntry.deleteMany({ where: { entryType: "opening_balance" } });
        await tx.vendorLedgerEntry.deleteMany({ where: { entryType: "opening_balance" } });
        const affectedCustomers = new Set<string>();
        const affectedVendors = new Set<string>();
        const created = [];
        for (const item of normalized) {
          let partyName = "";
          if (item.partyType === "customer") {
            const party = await tx.customer.findUnique({ where: { id: item.partyId } });
            if (!party) throw new Error("A selected customer no longer exists.");
            partyName = party.name;
          } else if (item.partyType === "vendor") {
            const party = await tx.vendor.findUnique({ where: { id: item.partyId } });
            if (!party) throw new Error("A selected vendor no longer exists.");
            partyName = party.name;
          } else {
            const party = await tx.employee.findUnique({ where: { id: item.partyId } });
            if (!party) throw new Error("A selected employee no longer exists.");
            partyName = party.name;
          }
          const documentNumber = `OB-${item.partyType.slice(0, 3).toUpperCase()}-${item.partyId.slice(-8).toUpperCase()}`;
          const opening = await tx.partyOpeningBalance.create({ data: { ...item, partyName, postingDate, documentNumber } });
          created.push(opening);
          if (item.partyType === "customer") {
            affectedCustomers.add(item.partyId);
            await tx.customerLedgerEntry.create({ data: { customerId: item.partyId, postingDate, entryType: "opening_balance", documentNumber, debit: item.debit, credit: item.credit, runningBalance: 0, dueDate: item.dueDate, notes: item.notes || "Opening balance imported during accounting onboarding" } });
          } else if (item.partyType === "vendor") {
            affectedVendors.add(item.partyId);
            await tx.vendorLedgerEntry.create({ data: { vendorId: item.partyId, postingDate, entryType: "opening_balance", documentNumber, debit: item.debit, credit: item.credit, runningBalance: 0, dueDate: item.dueDate, notes: item.notes || "Opening balance imported during accounting onboarding" } });
          }
        }
        for (const id of affectedCustomers) await recalculateCustomerLedger(tx, id);
        for (const id of affectedVendors) await recalculateVendorLedger(tx, id);
        const settings = await tx.companySettings.findFirst();
        if (!settings) throw new Error("Save the company profile first.");
        await tx.companySettings.update({ where: { id: settings.id }, data: { partyBalancesCompleted: true } });
        return created;
      });
      return NextResponse.json({ success: true, partyOpeningBalances: saved, message: saved.length ? `${saved.length} party opening balance(s) saved to their sub-ledgers. Now post (or re-post) the GL opening balances so the AR/AP control accounts pick up these totals.` : "Confirmed that customer, vendor, and employee opening balances are zero." });
    }

    // STEP 2: POST OPENING BALANCES (OFFSET TO 3900 EQUITY)
    if (action === "post_opening_balances") {
      const { balances, goLiveDate } = body;
      const postedBy = gate.actor.name || "Accountant";
      // balances: Array of { accountCode: string, debit: number, credit: number }

      if (!Array.isArray(balances)) {
        return NextResponse.json({ error: "No opening balance rows provided." }, { status: 400 });
      }
      const controls = await resolveOpeningControlAccounts();
      const partyTotals = await partyOpeningTotals();
      // Stock entered through Inventory > Opening Stock is already in the GL; don't let it be entered twice.
      const stockOpeningPosted = await prisma.journalEntry.count({ where: { refType: "opening_stock", status: "posted" } });
      let stockAccountId: string | null = null;
      if (stockOpeningPosted) {
        try {
          stockAccountId = (await AccountMappingService.resolveAccount({ transactionType: "opening_stock_asset" })).id;
        } catch {
          stockAccountId = null;
        }
      }
      const autoAccountIds = new Set([controls.ar?.id, controls.ap?.id, partyTotals.employees ? controls.advances?.id : undefined].filter(Boolean) as string[]);

      const targetDate = goLiveDate ? new Date(goLiveDate) : new Date();
      if (Number.isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: "Go-live date is invalid." }, { status: 400 });
      }

      // Ensure Opening Balance Equity is resolved via AccountMappingService
      const equityOffsetAcc = await AccountMappingService.resolveAccount({ transactionType: "opening_balance_equity" });

      let totalDebits = 0;
      let totalCredits = 0;
      const validLines: Array<{ accountId: string; debit: number; credit: number }> = [];

      for (const b of balances) {
        const d = roundMoney(b.debit || 0);
        const c = roundMoney(b.credit || 0);
        if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0) {
          return NextResponse.json({ error: `Account ${b.accountCode}: amounts must be zero or positive numbers.` }, { status: 400 });
        }
        if (d > 0 && c > 0) {
          return NextResponse.json({ error: `Account ${b.accountCode}: enter either a debit or a credit, not both.` }, { status: 400 });
        }
        if (d === 0 && c === 0) continue;

        const acc = await AccountsPostingService.getAccountByCode(b.accountCode);
        if (autoAccountIds.has(acc.id)) {
          return NextResponse.json(
            {
              error: `${acc.code} ${acc.name} is filled automatically from the customer/supplier/employee opening balances. Enter those per party in the Party Opening Balances step instead.`,
            },
            { status: 400 }
          );
        }
        if (stockAccountId && acc.id === stockAccountId) {
          return NextResponse.json(
            { error: `${acc.code} ${acc.name}: opening stock was already posted item-by-item from Inventory > Opening Stock. Do not enter it again here.` },
            { status: 400 }
          );
        }
        if (controls.equity && acc.id === controls.equity.id) {
          return NextResponse.json({ error: `${acc.code} ${acc.name} receives the balancing difference automatically; leave it blank.` }, { status: 400 });
        }
        validLines.push({
          accountId: acc.id,
          debit: d,
          credit: c,
        });

        totalDebits += d;
        totalCredits += c;
      }

      // Control accounts = totals of the party opening balances (keeps GL and sub-ledgers tied).
      const addAuto = (accountId: string | undefined, amount: number, normalDebit: boolean) => {
        if (!accountId || !amount) return;
        const debitSide = normalDebit ? amount > 0 : amount < 0;
        const value = roundMoney(Math.abs(amount));
        validLines.push({ accountId, debit: debitSide ? value : 0, credit: debitSide ? 0 : value });
        if (debitSide) totalDebits += value;
        else totalCredits += value;
      };
      if (partyTotals.customers && !controls.ar) return NextResponse.json({ error: "Map 'ar_control' before posting customer opening balances." }, { status: 400 });
      if (partyTotals.vendors && !controls.ap) return NextResponse.json({ error: "Map 'ap_control' before posting supplier opening balances." }, { status: 400 });
      if (partyTotals.employees && !controls.advances) return NextResponse.json({ error: "Map 'advance_granted_receivable' before posting employee advance balances." }, { status: 400 });
      addAuto(controls.ar?.id, partyTotals.customers, true);
      addAuto(controls.ap?.id, partyTotals.vendors, false);
      addAuto(controls.advances?.id, partyTotals.employees, true);

      if (validLines.length === 0) {
        return NextResponse.json({ error: "All entered opening balances are zero." }, { status: 400 });
      }

      // Difference goes to the account mapped as opening_balance_equity (default 3900)
      const difference = Math.round((totalDebits - totalCredits) * 100) / 100;

      if (difference > 0) {
        // More debits: Credit 3900 Opening Balance Equity
        validLines.push({
          accountId: equityOffsetAcc.id,
          debit: 0,
          credit: difference,
        });
      } else if (difference < 0) {
        // More credits: Debit 3900 Opening Balance Equity
        validLines.push({
          accountId: equityOffsetAcc.id,
          debit: Math.abs(difference),
          credit: 0,
        });
      }

      // Reverse the previous opening voucher (if any) and post the new one in ONE transaction,
      // so a failure can never leave the books with no opening balances.
      const openingVoucher = await prisma.$transaction(
        async (tx) => {
          const existingOpening = await tx.journalEntry.findFirst({
            where: { refType: "opening_balance", status: "posted" },
          });
          if (existingOpening) {
            await AccountsPostingService.reverseEntry({
              journalEntryId: existingOpening.id,
              reversedBy: postedBy,
              reason: "Superseded by updated opening balance submission in Setup Wizard",
              tx,
            });
          }
          return AccountsPostingService.post({
            date: targetDate,
            memo: `[GO-LIVE OPENING BALANCES] Initial Balances as of ${targetDate.toISOString().slice(0, 10)}`,
            refType: "opening_balance",
            refId: "GO_LIVE",
            postedBy,
            bypassPeriodLock: true,
            lines: validLines,
            tx,
          });
        },
        { maxWait: 10000, timeout: 30000 }
      );

      return NextResponse.json({
        success: true,
        openingVoucher,
        equityOffsetAmount: Math.abs(difference),
        message: `Opening balance voucher #${openingVoucher.id} posted. Net difference of PKR ${Math.abs(difference).toLocaleString()} placed into ${equityOffsetAcc.code} ${equityOffsetAcc.name}.`,
      });
    }

    // STEP 3: MASTER DATA IMPORT (CUSTOMERS, VENDORS, INVENTORY)
    if (action === "import_master_data") {
      const { dataType, rows } = body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "No data rows provided." }, { status: 400 });
      }

      let importedCount = 0;

      if (dataType === "customers") {
        for (const r of rows) {
          if (!r.name) continue;
          await prisma.customer.create({
            data: {
              name: r.name.trim(),
              phone: r.phone ? String(r.phone).trim() : "—",
              email: r.email ? String(r.email).trim() : null,
              addressText: r.address ? String(r.address).trim() : "Counter / Retail Customer",
            },
          });
          importedCount++;
        }
      } else if (dataType === "vendors") {
        for (const r of rows) {
          if (!r.name) continue;
          const wht = Number(r.whtRate) || 0;
          await prisma.vendor.create({
            data: {
              name: r.name.trim(),
              contactPerson: r.contactPerson ? String(r.contactPerson).trim() : null,
              phone: r.phone ? String(r.phone).trim() : null,
              email: r.email ? String(r.email).trim() : null,
              addressText: r.address ? String(r.address).trim() : null,
              ntnNumber: r.ntn ? String(r.ntn).trim() : null,
              whtRate: wht,
              whtExempt: Boolean(r.whtExempt),
            },
          });
          importedCount++;
        }
      } else if (dataType === "inventory") {
        for (const r of rows) {
          if (!r.name || !r.sku) continue;
          const cost = Number(r.costPrice) || 0;
          const price = Number(r.unitPrice) || cost * 1.3;
          const qty = Number(r.stockQuantity) || 0;

          const prod = await prisma.product.create({
            data: {
              sku: String(r.sku).trim(),
              name: String(r.name).trim(),
              unit: r.unit ? String(r.unit).trim() : "pcs",
              unitPrice: price,
              costPrice: cost,
              stockQuantity: qty,
              reorderLevel: Number(r.reorderLevel) || 5,
            },
          });

          if (qty > 0) {
            await prisma.stockLedger.create({
              data: {
                productId: prod.id,
                qty,
                direction: "in",
                refType: "adjustment",
                notes: "Opening stock balance from initial system setup",
              },
            });
          }

          importedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        dataType,
        importedCount,
        message: `Successfully imported ${importedCount} ${dataType} records.`,
      });
    }

    // STEP 4: GO-LIVE SIGN-OFF
    if (action === "complete_setup") {
      const mappingCompleteness = await AccountMappingService.getCompleteness("DEFAULT");
      if (!mappingCompleteness.isComplete) {
        return NextResponse.json(
          {
            error: `Cannot complete go-live: Account mapping is ${mappingCompleteness.percentage}% complete (${mappingCompleteness.configured}/${mappingCompleteness.total}). Map all required transaction types to active leaf accounts first.`,
            mappingCompleteness,
          },
          { status: 400 }
        );
      }

      const tb = await FinancialReportingService.getTrialBalance();
      if (!tb.isInBalance) {
        return NextResponse.json(
          {
            error: `Cannot complete go-live: Trial balance is not in equilibrium (Variance: PKR ${tb.variance}). Debits must equal credits.`,
          },
          { status: 400 }
        );
      }

      const accountingSettings = await prisma.companySettings.findFirst();
      if (!accountingSettings) return NextResponse.json({ error: "Complete the company profile before go-live." }, { status: 400 });
      const policyReadiness = accountingPolicyReadiness(accountingSettings);
      const financialAccountCount = await prisma.financialAccount.count({ where: { isActive: true } });
      const defaultFinancialAccountCount = await prisma.financialAccount.count({ where: { isActive: true, isDefault: true } });
      const unlinkedCareOfCount = await prisma.careOfParty.count({ where: { ledgerAccountId: null } });
      if (!policyReadiness.complete || !accountingSettings.financialAccountsCompleted || financialAccountCount === 0 || defaultFinancialAccountCount !== 1 || !accountingSettings.careOfSetupCompleted || unlinkedCareOfCount > 0 || !accountingSettings.partyBalancesCompleted) {
        return NextResponse.json({ error: "Complete accounting policies, cash/bank accounts, care-of ledgers, and party opening balances before go-live." }, { status: 400 });
      }
      const reconciliation = await SubLedgerService.checkReconciliationDrift();
      if (reconciliation.status !== "RECONCILED") {
        return NextResponse.json({ error: `Cannot complete go-live: customer/vendor sub-ledgers do not match their GL control accounts (AR variance ${reconciliation.receivables.driftAmount}, AP variance ${reconciliation.payables.driftAmount}).`, reconciliation }, { status: 400 });
      }

      let settings = await prisma.companySettings.findFirst();
      if (!settings) {
        return NextResponse.json(
          { error: "Complete the company profile before go-live." },
          { status: 400 }
        );
      } else {
        if (!settings.legalName.trim() || !settings.addressText.trim() || !settings.phone.trim() || !settings.email.trim()) {
          return NextResponse.json(
            { error: "Complete the legal name, address, phone, and company email before go-live." },
            { status: 400 }
          );
        }
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: {
            isSetupCompleted: true,
            goLiveDate: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        settings,
        message: "Congratulations! System setup is officially complete and verified. Go-live unlocked!",
      });
    }


    // COA CSV/JSON IMPORT (wires same validation as /api/accounts bulk_import_accounts)
    if (action === "import_coa") {
      const { rows, companyId = "DEFAULT" } = body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "No COA rows provided. Expected columns: code, name, type, parentCode?, isActive?" }, { status: 400 });
      }

      // Delegate through AccountsPostingService-compatible path by calling the same logic inline
      const VALID_ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense", "contra_revenue"];
      const seenCodes = new Set();
      const errors = [];
      let createdCount = 0;
      let updatedCount = 0;
      let deactivatedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const item = rows[i];
        const code = item?.code != null ? String(item.code).trim() : "";
        if (!code) { errors.push(`Row ${i + 1}: code is required`); continue; }
        if (seenCodes.has(code)) errors.push(`Row ${i + 1}: duplicate code "${code}"`);
        seenCodes.add(code);
        if (!item.name || !String(item.name).trim()) errors.push(`Row ${i + 1} (${code}): name is required`);
        const type = item.type ? String(item.type).trim().toLowerCase() : "";
        if (!VALID_ACCOUNT_TYPES.includes(type)) {
          errors.push(`Row ${i + 1} (${code}): type must be one of ${VALID_ACCOUNT_TYPES.join(", ")}`);
        }
      }
      if (errors.length) {
        return NextResponse.json({ error: "COA import validation failed", details: errors.slice(0, 25) }, { status: 400 });
      }

      for (const item of rows) {
        const code = String(item.code).trim();
        const type = String(item.type).trim().toLowerCase();
        const name = String(item.name).trim();
        const isActive =
          item.isActive === undefined || item.isActive === null
            ? true
            : String(item.isActive).toLowerCase() !== "false" && item.isActive !== false && item.isActive !== 0 && item.isActive !== "0";
        const level = item.level != null ? Number(item.level) : 4;
        let parentId = item.parentId || null;
        if (item.parentCode) {
          const parent = await prisma.account.findUnique({ where: { code: String(item.parentCode).trim() } });
          if (!parent) {
            errors.push(`Account ${code}: parentCode "${item.parentCode}" not found`);
            continue;
          }
          parentId = parent.id;
        }

        const existing = await prisma.account.findUnique({ where: { code } });
        if (existing) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              name,
              type,
              description: item.description || existing.description,
              level: Number.isFinite(level) ? level : existing.level,
              parentId: parentId != null ? parentId : existing.parentId,
              isActive,
              companyId: existing.companyId || companyId,
            },
          });
          updatedCount++;
          if (!isActive && existing.isActive) deactivatedCount++;
        } else {
          await prisma.account.create({
            data: {
              code,
              name,
              type,
              description: item.description || null,
              level: Number.isFinite(level) ? level : 4,
              parentId,
              companyId,
              currency: "PKR",
              isSystem: false,
              isActive,
            },
          });
          createdCount++;
        }
      }

      return NextResponse.json({
        success: true,
        createdCount,
        updatedCount,
        deactivatedCount,
        warnings: errors.length ? errors : undefined,
        message: `COA import complete: ${createdCount} created, ${updatedCount} updated${deactivatedCount ? `, ${deactivatedCount} deactivated` : ""}.`,
      });
    }

    // Ensure Workman template leaf accounts exist (idempotent) without deleting posted history
    if (action === "ensure_template_coa") {
      const companyId = body.companyId || "DEFAULT";
      let created = 0;
      // Groups first (level 1 -> 3), then posting accounts, so every parent exists before its children.
      const ordered = [...STANDARD_COA_DEFINITIONS].sort((x, y) => (x.level || 4) - (y.level || 4));
      for (const def of ordered) {
        const existing = await prisma.account.findUnique({ where: { code: def.code } });
        if (!existing) {
          let parentId = null;
          if (def.parentCode) {
            const parent = await prisma.account.findUnique({ where: { code: def.parentCode } });
            parentId = parent?.id || null;
          }
          await prisma.account.create({
            data: {
              code: def.code,
              name: def.name,
              type: def.type,
              description: def.description || null,
              level: def.level || 4,
              parentId,
              companyId,
              currency: "PKR",
              isSystem: true,
              isActive: true,
            },
          });
          created++;
        }
      }
      return NextResponse.json({
        success: true,
        created,
        message: created ? `Provisioned ${created} missing template leaf accounts.` : "Template COA already present.",
      });
    }

    // Seed / upsert baseline mappings for DEFAULT company (includes newly introduced roles)
    if (action === "seed_baseline_mappings") {
      const companyId = body.companyId || "DEFAULT";
      const baseline = BASELINE_MAPPINGS;

      let upserted = 0;
      let skipped = 0;
      for (const m of baseline) {
        const acc = await prisma.account.findUnique({ where: { code: m.accountCode } });
        if (!acc) { skipped++; continue; }
        await AccountMappingService.setMapping(companyId, m.transactionType, acc.id, null, "Setup Wizard");
        upserted++;
      }
      const completeness = await AccountMappingService.getCompleteness(companyId);
      return NextResponse.json({
        success: true,
        upserted,
        skipped,
        completeness,
        message: `Baseline mappings applied (${upserted} upserted, ${skipped} skipped missing accounts).`,
      });
    }

    // Deactivate unused Workman default leaves that have never been posted (safe)
    if (action === "deactivate_unused_defaults") {
      const { codes } = body;
      if (!Array.isArray(codes) || codes.length === 0) {
        return NextResponse.json({ error: "codes[] required" }, { status: 400 });
      }
      const results = [];
      for (const code of codes) {
        const acc = await prisma.account.findUnique({
          where: { code: String(code) },
          include: { _count: { select: { journalLines: true, mappings: true } } },
        });
        if (!acc) { results.push({ code, status: "not_found" }); continue; }
        if (acc._count.journalLines > 0) {
          // Soft-deactivate only — never delete historical
          await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });
          results.push({ code, status: "deactivated_has_history" });
        } else if (acc._count.mappings > 0) {
          await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });
          results.push({ code, status: "deactivated_still_mapped" });
        } else {
          await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });
          results.push({ code, status: "deactivated" });
        }
      }
      return NextResponse.json({ success: true, results });
    }


    return NextResponse.json({ error: "Invalid action parameter." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/setup error:", err);
    return NextResponse.json({ error: err.message || "Failed to process setup action." }, { status: 500 });
  }
}
