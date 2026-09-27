import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";

export interface RecordCustomerEntryParams {
  customerId: string;
  entryType: "invoice" | "payment" | "credit_note" | "opening_balance";
  documentNumber: string;
  journalEntryId?: string;
  debit: number;
  credit: number;
  dueDate?: Date;
  notes?: string;
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
}

export class SubLedgerService {
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
    } = params;

    // Get last running balance for this customer
    const lastEntry = await prisma.customerLedgerEntry.findFirst({
      where: { customerId },
      orderBy: { postingDate: "desc" },
    });

    const previousBalance = lastEntry ? lastEntry.runningBalance : 0;
    const runningBalance = Math.round((previousBalance + debit - credit) * 100) / 100;

    return await prisma.customerLedgerEntry.create({
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
    } = params;

    // Get last running balance for this vendor
    const lastEntry = await prisma.vendorLedgerEntry.findFirst({
      where: { vendorId },
      orderBy: { postingDate: "desc" },
    });

    const previousBalance = lastEntry ? lastEntry.runningBalance : 0;
    // For AP (Liability), Credit increases balance, Debit decreases balance
    const runningBalance = Math.round((previousBalance + credit - debit) * 100) / 100;

    return await prisma.vendorLedgerEntry.create({
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
    const [arAccount, apAccount] = await Promise.all([
      AccountsPostingService.getAccountByCode("1100"),
      AccountsPostingService.getAccountByCode("2000"),
    ]);

    const [arJournalLines, apJournalLines] = await Promise.all([
      prisma.journalLine.findMany({
        where: {
          accountId: arAccount.id,
          journalEntry: { status: { in: ["posted", "reversal"] } },
        },
      }),
      prisma.journalLine.findMany({
        where: {
          accountId: apAccount.id,
          journalEntry: { status: { in: ["posted", "reversal"] } },
        },
      }),
    ]);

    // AR is Asset (Debit - Credit)
    const arControlGlBalance = Math.round(
      arJournalLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100
    ) / 100;

    // AP is Liability (Credit - Debit)
    const apControlGlBalance = Math.round(
      apJournalLines.reduce((sum, l) => sum + (l.credit - l.debit), 0) * 100
    ) / 100;

    // 2. Get Sub-Ledger Balances per Party
    const customers = await prisma.customer.findMany({
      include: {
        customerLedgerEntries: {
          orderBy: { postingDate: "desc" },
          take: 1,
        },
      },
    });

    let totalCustomerSubledgerBalance = 0;
    for (const cust of customers) {
      if (cust.customerLedgerEntries.length > 0) {
        totalCustomerSubledgerBalance += cust.customerLedgerEntries[0].runningBalance;
      }
    }
    totalCustomerSubledgerBalance = Math.round(totalCustomerSubledgerBalance * 100) / 100;

    const vendors = await prisma.vendor.findMany({
      include: {
        vendorLedgerEntries: {
          orderBy: { postingDate: "desc" },
          take: 1,
        },
      },
    });

    let totalVendorSubledgerBalance = 0;
    for (const v of vendors) {
      if (v.vendorLedgerEntries.length > 0) {
        totalVendorSubledgerBalance += v.vendorLedgerEntries[0].runningBalance;
      }
    }
    totalVendorSubledgerBalance = Math.round(totalVendorSubledgerBalance * 100) / 100;

    const arDrift = Math.round((arControlGlBalance - totalCustomerSubledgerBalance) * 100) / 100;
    const apDrift = Math.round((apControlGlBalance - totalVendorSubledgerBalance) * 100) / 100;

    const hasDrift = Math.abs(arDrift) > 0.01 || Math.abs(apDrift) > 0.01;

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
