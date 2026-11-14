import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

export interface RecordCustomerEntryParams {
  customerId: string;
  entryType: "invoice" | "payment" | "credit_note" | "opening_balance" | "advance";
  documentNumber: string;
  journalEntryId?: string;
  debit: number;
  credit: number;
  dueDate?: Date;
  notes?: string;
  tx?: any;
}

export interface RecordVendorEntryParams {
  vendorId: string;
  entryType: "bill" | "payment" | "debit_note" | "opening_balance";
  documentNumber: string;
  journalEntryId?: string;
  debit: number;
  credit: number;
  dueDate?: Date;
  whtWithheld?: number;
  cprNumber?: string;
  notes?: string;
  tx?: any;
}

export class SubLedgerService {
  private static validateAmounts(debit: number, credit: number, label: string) {
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new Error(`${label} rejected: debit and credit must be finite numbers.`);
    }
    if (debit < 0 || credit < 0) {
      throw new Error(`${label} rejected: debit and credit cannot be negative.`);
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new Error(`${label} rejected: exactly one of debit or credit must be positive.`);
    }
  }

  /**
   * Record a customer transactional sub-ledger entry (Accounts Receivable).
   * Customer debt increases on Debit (invoice), decreases on Credit (payment).
   */
  static async recordCustomerEntry(params: RecordCustomerEntryParams) {
    const {
      customerId,
      entryType,
      documentNumber,
      journalEntryId,
      debit = 0,
      credit = 0,
      dueDate,
      notes,
      tx,
    } = params;

    const db = tx ?? prisma;

    this.validateAmounts(debit, credit, "Customer sub-ledger entry");
    if (!customerId || !documentNumber?.trim()) {
      throw new Error("Customer sub-ledger entry rejected: customer and document number are required.");
    }

    // Previous balance = sum of all existing entries, NOT the stored
    // runningBalance of the chronologically latest entry. That stored value is
    // not trustworthy as a predecessor: opening balances imported by Setup are
    // written with runningBalance 0 and an explicit (possibly back- or
    // future-dated) postingDate, and reversal rows are likewise created with
    // runningBalance 0 — either can be the "latest" row and would silently
    // reset every subsequent balance. Summing debit - credit is order-
    // independent and always matches the GL reconciliation (which sums entries).
    const totals = await db.customerLedgerEntry.aggregate({
      where: { customerId },
      _sum: { debit: true, credit: true },
    });
    const previousBalance = (totals._sum.debit || 0) - (totals._sum.credit || 0);
    const runningBalance = Math.round((previousBalance + debit - credit) * 100) / 100;

    return await db.customerLedgerEntry.create({
      data: {
        customerId,
        entryType,
        documentNumber,
        journalEntryId,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        runningBalance,
        dueDate: dueDate || null,
        notes: notes || null,
      },
    });
  }

  /**
   * Record a vendor transactional sub-ledger entry (Accounts Payable).
   * Vendor debt increases on Credit (bill/PO), decreases on Debit (payment).
   */
  static async recordVendorEntry(params: RecordVendorEntryParams) {
    const {
      vendorId,
      entryType,
      documentNumber,
      journalEntryId,
      debit = 0,
      credit = 0,
      dueDate,
      whtWithheld = 0,
      cprNumber,
      notes,
      tx,
    } = params;

    const db = tx ?? prisma;

    this.validateAmounts(debit, credit, "Vendor sub-ledger entry");
    if (!vendorId || !documentNumber?.trim()) {
      throw new Error("Vendor sub-ledger entry rejected: vendor and document number are required.");
    }
    if (!Number.isFinite(whtWithheld) || whtWithheld < 0) {
      throw new Error("Vendor sub-ledger entry rejected: WHT withheld must be a non-negative finite number.");
    }

    // Previous balance = sum of all existing entries, NOT the stored
    // runningBalance of the chronologically latest entry (see the customer
    // version above: imported opening balances and reversal rows carry
    // runningBalance 0 and can sit at the top of the chronological order).
    const totals = await db.vendorLedgerEntry.aggregate({
      where: { vendorId },
      _sum: { debit: true, credit: true },
    });
    const previousBalance = (totals._sum.credit || 0) - (totals._sum.debit || 0);
    // For AP (Liability), Credit increases balance, Debit decreases balance
    const runningBalance = Math.round((previousBalance + credit - debit) * 100) / 100;

    return await db.vendorLedgerEntry.create({
      data: {
        vendorId,
        entryType,
        documentNumber,
        journalEntryId,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        runningBalance,
        dueDate: dueDate || null,
        whtWithheld: Math.round(whtWithheld * 100) / 100,
        cprNumber: cprNumber || null,
        notes: notes || null,
      },
    });
  }

  /**
   * Reconcile Sub-Ledger totals against GL Control Accounts (1100 AR and 2000 AP).
   * Enterprise Audit Check: Ensures sub-ledgers and general ledger remain in 100% sync.
   * If any drift is detected, returns difference amount and un-reconciled variance.
   */
  static async checkReconciliationDrift() {
    // 1. Get GL Control Account Balances from JournalLines
    const [arAccount, apAccount, advAccount] = await Promise.all([
      AccountMappingService.resolveAccount({ transactionType: "ar_control" }),
      AccountMappingService.resolveAccount({ transactionType: "ap_control" }),
      AccountMappingService.resolveAccountOptional({ transactionType: "advance_granted_receivable" }),
    ]);

    const [arJournalLines, apJournalLines, advJournalLines] = await Promise.all([
      prisma.journalLine.findMany({
        where: {
          accountId: arAccount.id,
          journalEntry: { status: { in: ["posted", "reversed", "reversal"] } },
        },
      }),
      prisma.journalLine.findMany({
        where: {
          accountId: apAccount.id,
          journalEntry: { status: { in: ["posted", "reversed", "reversal"] } },
        },
      }),
      advAccount
        ? prisma.journalLine.findMany({
            where: {
              accountId: advAccount.id,
              journalEntry: { status: { in: ["posted", "reversed", "reversal"] } },
            },
          })
        : Promise.resolve([]),
    ]);

    // AR is Asset (Debit - Credit)
    const arControlGlBalance = Math.round(
      arJournalLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100
    ) / 100;

    // AP is Liability (Credit - Debit)
    const apControlGlBalance = Math.round(
      apJournalLines.reduce((sum, l) => sum + (l.credit - l.debit), 0) * 100
    ) / 100;

    // Employee Advances is Asset (Debit - Credit)
    const advControlGlBalance = Math.round(
      advJournalLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100
    ) / 100;

    // 2. Sub-ledger totals from the entries themselves (sum of debits/credits), not from the
    // "latest" running balance, which is wrong whenever an entry is back-dated.
    const [customerSums, vendorSums, hrmAdvancesSum, customerCount, vendorCount] = await Promise.all([
      prisma.customerLedgerEntry.aggregate({ _sum: { debit: true, credit: true } }),
      prisma.vendorLedgerEntry.aggregate({ _sum: { debit: true, credit: true } }),
      prisma.employeeAdvance.aggregate({ where: { status: "approved" }, _sum: { amount: true } }),
      prisma.customer.count(),
      prisma.vendor.count(),
    ]);
    const customers = { length: customerCount };
    const vendors = { length: vendorCount };
    const totalCustomerSubledgerBalance =
      Math.round(((customerSums._sum.debit || 0) - (customerSums._sum.credit || 0)) * 100) / 100;
    const totalVendorSubledgerBalance =
      Math.round(((vendorSums._sum.credit || 0) - (vendorSums._sum.debit || 0)) * 100) / 100;
    const totalHrmAdvanceBalance =
      Math.round((hrmAdvancesSum._sum.amount || 0) * 100) / 100;

    const arDrift = Math.round((arControlGlBalance - totalCustomerSubledgerBalance) * 100) / 100;
    const apDrift = Math.round((apControlGlBalance - totalVendorSubledgerBalance) * 100) / 100;
    const advDrift = Math.round((advControlGlBalance - totalHrmAdvanceBalance) * 100) / 100;

    const hasDrift = Math.abs(arDrift) > 0.01 || Math.abs(apDrift) > 0.01 || Math.abs(advDrift) > 0.01;

    return {
      success: true,
      timestamp: new Date(),
      status: hasDrift ? "DRIFT_DETECTED" : "RECONCILED",
      receivables: {
        glControlBalance: arControlGlBalance,
        subledgerTotal: totalCustomerSubledgerBalance,
        driftAmount: arDrift,
        isReconciled: Math.abs(arDrift) <= 0.01,
        customerCount: customers.length,
      },
      payables: {
        glControlBalance: apControlGlBalance,
        subledgerTotal: totalVendorSubledgerBalance,
        driftAmount: apDrift,
        isReconciled: Math.abs(apDrift) <= 0.01,
        vendorCount: vendors.length,
      },
      advances: {
        glControlBalance: advControlGlBalance,
        subledgerTotal: totalHrmAdvanceBalance,
        driftAmount: advDrift,
        isReconciled: Math.abs(advDrift) <= 0.01,
      },
    };
  }

  /**
   * Generate Accounts Receivable Aging Schedule (0-30, 31-60, 61-90, 90+ days).
   */
  static async getArAging(asOfDate: Date = new Date()) {
    const customers = await prisma.customer.findMany({
      include: {
        customerLedgerEntries: {
          orderBy: { postingDate: "asc" },
        },
      },
    });

    const agingRows = [];
    let grandTotalCurrent = 0;
    let grandTotal30 = 0;
    let grandTotal60 = 0;
    let grandTotal90Plus = 0;
    let grandTotalAll = 0;

    for (const cust of customers) {
      const entries = cust.customerLedgerEntries;
      if (entries.length === 0) continue;

      const latestBal = entries[entries.length - 1].runningBalance;
      if (latestBal <= 0) continue; // No outstanding balance

      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90Plus = 0;

      // Group debit invoices by age
      for (const e of entries) {
        if (e.debit > 0) {
          const ageDays = Math.floor((asOfDate.getTime() - new Date(e.postingDate).getTime()) / (1000 * 60 * 60 * 24));
          if (ageDays <= 30) current += e.debit;
          else if (ageDays <= 60) days30 += e.debit;
          else if (ageDays <= 90) days60 += e.debit;
          else days90Plus += e.debit;
        }
      }

      // Scale to current outstanding balance
      const totalDebits = current + days30 + days60 + days90Plus;
      const ratio = totalDebits > 0 ? latestBal / totalDebits : 1;

      const row = {
        customerId: cust.id,
        customerName: cust.name,
        phone: cust.phone,
        totalOutstanding: latestBal,
        current: Math.round(current * ratio * 100) / 100,
        days31To60: Math.round(days30 * ratio * 100) / 100,
        days61To90: Math.round(days60 * ratio * 100) / 100,
        days90Plus: Math.round(days90Plus * ratio * 100) / 100,
      };

      grandTotalCurrent += row.current;
      grandTotal30 += row.days31To60;
      grandTotal60 += row.days61To90;
      grandTotal90Plus += row.days90Plus;
      grandTotalAll += row.totalOutstanding;

      agingRows.push(row);
    }

    return {
      asOfDate,
      summary: {
        totalOutstanding: Math.round(grandTotalAll * 100) / 100,
        current: Math.round(grandTotalCurrent * 100) / 100,
        days31To60: Math.round(grandTotal30 * 100) / 100,
        days61To90: Math.round(grandTotal60 * 100) / 100,
        days90Plus: Math.round(grandTotal90Plus * 100) / 100,
      },
      customers: agingRows.sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    };
  }

  /**
   * Generate Accounts Payable Aging Schedule (0-30, 31-60, 61-90, 90+ days).
   */
  static async getApAging(asOfDate: Date = new Date()) {
    const vendors = await prisma.vendor.findMany({
      include: {
        vendorLedgerEntries: {
          orderBy: { postingDate: "asc" },
        },
      },
    });

    const agingRows = [];
    let grandTotalCurrent = 0;
    let grandTotal30 = 0;
    let grandTotal60 = 0;
    let grandTotal90Plus = 0;
    let grandTotalAll = 0;

    for (const v of vendors) {
      const entries = v.vendorLedgerEntries;
      if (entries.length === 0) continue;

      const latestBal = entries[entries.length - 1].runningBalance;
      if (latestBal <= 0) continue;

      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90Plus = 0;

      for (const e of entries) {
        if (e.credit > 0) {
          const ageDays = Math.floor((asOfDate.getTime() - new Date(e.postingDate).getTime()) / (1000 * 60 * 60 * 24));
          if (ageDays <= 30) current += e.credit;
          else if (ageDays <= 60) days30 += e.credit;
          else if (ageDays <= 90) days60 += e.credit;
          else days90Plus += e.credit;
        }
      }

      const totalCredits = current + days30 + days60 + days90Plus;
      const ratio = totalCredits > 0 ? latestBal / totalCredits : 1;

      const row = {
        vendorId: v.id,
        vendorName: v.name,
        contactPerson: v.contactPerson,
        phone: v.phone,
        totalOutstanding: latestBal,
        current: Math.round(current * ratio * 100) / 100,
        days31To60: Math.round(days30 * ratio * 100) / 100,
        days61To90: Math.round(days60 * ratio * 100) / 100,
        days90Plus: Math.round(days90Plus * ratio * 100) / 100,
      };

      grandTotalCurrent += row.current;
      grandTotal30 += row.days31To60;
      grandTotal60 += row.days61To90;
      grandTotal90Plus += row.days90Plus;
      grandTotalAll += row.totalOutstanding;

      agingRows.push(row);
    }

    return {
      asOfDate,
      summary: {
        totalOutstanding: Math.round(grandTotalAll * 100) / 100,
        current: Math.round(grandTotalCurrent * 100) / 100,
        days31To60: Math.round(grandTotal30 * 100) / 100,
        days61To90: Math.round(grandTotal60 * 100) / 100,
        days90Plus: Math.round(grandTotal90Plus * 100) / 100,
      },
      vendors: agingRows.sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    };
  }
}
