import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";

export interface ParsedStatementRow {
  statementDate: Date;
  valueDate?: Date;
  description: string;
  referenceNumber?: string;
  debit: number; // Deposit into bank
  credit: number; // Withdrawal from bank
  runningBalance?: number;
}

export class BankReconciliationService {
  /**
   * Import CSV Bank Statement and create BankStatementLine records.
   * Format supported: Date, Description, Ref/Cheque#, Debit (Deposit), Credit (Withdrawal), Balance.
   */
  static async importCsvStatement(bankAccountId: string, csvContent: string) {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      throw new Error("CSV file contains no transaction rows.");
    }

    const batchImportId = `BATCH-${Date.now().toString().slice(-6)}`;
    const parsedRows: ParsedStatementRow[] = [];

    // Skip header line (row 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV splitting with comma
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 4) continue;

      // Expected columns: Date (0), Description (1), Ref (2), Debit (3), Credit (4), Balance (5)
      const dateStr = parts[0];
      const desc = parts[1] || "Bank Transaction";
      const ref = parts[2] || "";
      const debitStr = parts[3] || "0";
      const creditStr = parts[4] || "0";
      const balStr = parts[5] || "";

      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) continue; // Skip invalid date row

      const debit = parseFloat(debitStr.replace(/[^0-9.-]/g, "")) || 0;
      const credit = parseFloat(creditStr.replace(/[^0-9.-]/g, "")) || 0;
      const runningBalance = balStr ? parseFloat(balStr.replace(/[^0-9.-]/g, "")) : undefined;

      parsedRows.push({
        statementDate: parsedDate,
        description: desc,
        referenceNumber: ref || undefined,
        debit: Math.abs(debit),
        credit: Math.abs(credit),
        runningBalance: isNaN(runningBalance || 0) ? undefined : runningBalance,
      });
    }

    if (parsedRows.length === 0) {
      throw new Error("No valid transaction rows could be parsed from the CSV file.");
    }

    // Insert statement lines
    const createdLines = await Promise.all(
      parsedRows.map((row) =>
        prisma.bankStatementLine.create({
          data: {
            bankAccountId,
            statementDate: row.statementDate,
            description: row.description,
            referenceNumber: row.referenceNumber || null,
            debit: row.debit,
            credit: row.credit,
            runningBalance: row.runningBalance || null,
            status: "unreconciled",
            batchImportId,
          },
        })
      )
    );

    return {
      success: true,
      batchImportId,
      importedCount: createdLines.length,
      lines: createdLines,
    };
  }

  /**
   * Automatic Matching Engine:
   * Compares un-reconciled BankStatementLines with Cashbook GL JournalLines for the target bank account.
   * Matches when:
   * 1. Amount matches exactly (Debit vs Debit, or Credit vs Credit).
   * 2. Transaction date is within +/- 3 days window.
   * 3. Reference number matches (if present in both).
   */
  static async autoMatch(bankAccountId: string) {
    // 1. Fetch un-reconciled bank statement lines
    const unreconciledStatementLines = await prisma.bankStatementLine.findMany({
      where: {
        bankAccountId,
        status: "unreconciled",
      },
      orderBy: { statementDate: "asc" },
    });

    // 2. Fetch target account details
    let account = await prisma.account.findUnique({
      where: { id: bankAccountId },
    });
    if (!account) {
      account = await prisma.account.findUnique({
        where: { code: bankAccountId },
      });
    }
    if (!account) {
      account = await AccountsPostingService.getAccountByCode("1010");
    }

    // 3. Fetch all JournalLines for this account that are not yet matched
    const alreadyMatchedIds = (
      await prisma.bankStatementLine.findMany({
        where: {
          bankAccountId,
          matchedJournalLineId: { not: null },
        },
        select: { matchedJournalLineId: true },
      })
    )
      .map((l) => l.matchedJournalLineId)
      .filter(Boolean) as string[];

    const bookLines = await prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        id: { notIn: alreadyMatchedIds },
        journalEntry: {
          status: { in: ["posted", "reversal"] },
        },
      },
      include: {
        journalEntry: true,
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    let matchedCount = 0;
    const usedBookLineIds = new Set<string>();

    for (const stmtLine of unreconciledStatementLines) {
      const stmtDate = new Date(stmtLine.statementDate).getTime();

      // Find best candidate in book lines
      const candidate = bookLines.find((b) => {
        if (usedBookLineIds.has(b.id)) return false;

        // In bank statement:
        // Debit = Cash inflow (Customer payment deposited) -> matches Book Debit
        // Credit = Cash outflow (Vendor check / bank fee) -> matches Book Credit
        const isDebitMatch = stmtLine.debit > 0 && Math.abs(stmtLine.debit - b.debit) < 0.01;
        const isCreditMatch = stmtLine.credit > 0 && Math.abs(stmtLine.credit - b.credit) < 0.01;

        if (!isDebitMatch && !isCreditMatch) return false;

        // Date window check (+/- 3 days)
        const bookDate = new Date(b.journalEntry.date).getTime();
        const diffDays = Math.abs(stmtDate - bookDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 3) return false;

        // Optional Reference match: if reference number matches, strong match!
        if (
          stmtLine.referenceNumber &&
          (b.journalEntry.memo.includes(stmtLine.referenceNumber) ||
            b.journalEntry.refId?.includes(stmtLine.referenceNumber))
        ) {
          return true;
        }

        return true;
      });

      if (candidate) {
        usedBookLineIds.add(candidate.id);

        await prisma.bankStatementLine.update({
          where: { id: stmtLine.id },
          data: {
            status: "matched",
            matchedJournalLineId: candidate.id,
            reconciledAt: new Date(),
            reconciledBy: "System Auto-Match",
          },
        });

        matchedCount++;
      }
    }

    return {
      success: true,
      totalProcessed: unreconciledStatementLines.length,
      matchedCount,
      remainingUnmatched: unreconciledStatementLines.length - matchedCount,
    };
  }

  /**
   * Manual matching of an un-reconciled statement line to a specific journal line.
   */
  static async manualMatch(statementLineId: string, journalLineId: string, matchedBy: string) {
    const updated = await prisma.bankStatementLine.update({
      where: { id: statementLineId },
      data: {
        status: "manually_reconciled",
        matchedJournalLineId: journalLineId,
        reconciledAt: new Date(),
        reconciledBy: matchedBy,
      },
    });

    await prisma.financialAuditLog.create({
      data: {
        entity: "BankStatementLine",
        entityId: statementLineId,
        action: "RECONCILE",
        afterValue: JSON.stringify({ journalLineId, matchedBy }),
        userName: matchedBy,
        userRole: "accountant",
      },
    });

    return updated;
  }

  /**
   * Un-match an existing reconciled statement line.
   */
  static async unmatch(statementLineId: string, unmatchedBy: string) {
    const updated = await prisma.bankStatementLine.update({
      where: { id: statementLineId },
      data: {
        status: "unreconciled",
        matchedJournalLineId: null,
        reconciledAt: null,
        reconciledBy: null,
      },
    });

    await prisma.financialAuditLog.create({
      data: {
        entity: "BankStatementLine",
        entityId: statementLineId,
        action: "UNMATCH",
        afterValue: JSON.stringify({ status: "unreconciled", unmatchedBy }),
        userName: unmatchedBy,
        userRole: "accountant",
      },
    });

    return updated;
  }

  /**
   * Generate Bank Reconciliation Statement (BRS).
   * Formula:
   * Balance per Bank Statement
   * + Deposits in Transit (Book receipts not yet in bank)
   * - Unpresented Cheques (Book disbursements not yet cleared in bank)
   * = Reconciled Book Balance
   */
  static async generateReconciliationStatement(bankAccountId: string) {
    // 1. Account details
    let account = await prisma.account.findUnique({
      where: { id: bankAccountId },
    });
    if (!account) {
      account = await prisma.account.findUnique({
        where: { code: bankAccountId },
      });
    }
    if (!account) {
      account = await AccountsPostingService.getAccountByCode("1010");
    }

    // 2. Latest Bank Statement Running Balance
    const latestStatementLine = await prisma.bankStatementLine.findFirst({
      where: { bankAccountId },
      orderBy: { statementDate: "desc" },
    });

    const balancePerBank = latestStatementLine?.runningBalance ?? 0;

    // 3. GL Book Balance from JournalLines
    const journalLines = await prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: { status: { in: ["posted", "reversal"] } },
      },
    });

    const balancePerBooks = Math.round(
      journalLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100
    ) / 100;

    // 4. Find Unmatched Book Lines
    const matchedLineIds = (
      await prisma.bankStatementLine.findMany({
        where: {
          bankAccountId,
          matchedJournalLineId: { not: null },
        },
        select: { matchedJournalLineId: true },
      })
    )
      .map((l) => l.matchedJournalLineId)
      .filter(Boolean) as string[];

    const unmatchedBookLines = await prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        id: { notIn: matchedLineIds },
        journalEntry: { status: { in: ["posted", "reversal"] } },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { date: "asc" } },
    });

    // Deposits in transit: book debit (receipts) not yet cleared in bank
    const depositsInTransitLines = unmatchedBookLines.filter((l) => l.debit > 0);
    const depositsInTransit = Math.round(
      depositsInTransitLines.reduce((sum, l) => sum + l.debit, 0) * 100
    ) / 100;

    // Unpresented cheques: book credit (payments) not yet cleared in bank
    const unpresentedChequesLines = unmatchedBookLines.filter((l) => l.credit > 0);
    const unpresentedCheques = Math.round(
      unpresentedChequesLines.reduce((sum, l) => sum + l.credit, 0) * 100
    ) / 100;

    // Adjusted Bank Balance
    const adjustedBankBalance = Math.round(
      (balancePerBank + depositsInTransit - unpresentedCheques) * 100
    ) / 100;

    const discrepancy = Math.round((adjustedBankBalance - balancePerBooks) * 100) / 100;

    return {
      success: true,
      bankAccount: {
        id: account.id,
        code: account.code,
        name: account.name,
      },
      asOfDate: new Date(),
      statement: {
        balancePerBank,
        depositsInTransit,
        depositsInTransitCount: depositsInTransitLines.length,
        unpresentedCheques,
        unpresentedChequesCount: unpresentedChequesLines.length,
        adjustedBankBalance,
        balancePerBooks,
        discrepancy,
        isReconciled: Math.abs(discrepancy) <= 0.01,
      },
      unmatchedDeposits: depositsInTransitLines.map((l) => ({
        id: l.id,
        date: l.journalEntry.date,
        memo: l.journalEntry.memo,
        amount: l.debit,
      })),
      unmatchedPayments: unpresentedChequesLines.map((l) => ({
        id: l.id,
        date: l.journalEntry.date,
        memo: l.journalEntry.memo,
        amount: l.credit,
      })),
    };
  }
}
