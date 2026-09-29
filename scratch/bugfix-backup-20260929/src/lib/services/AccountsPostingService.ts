import { prisma } from "@/lib/prisma";

export interface PostLineItem {
  accountId: string;
  debit: number;
  credit: number;
}

export interface PostEntryParams {
  date?: Date;
  memo: string;
  refType: string;
  refId?: string | null;
  postedBy?: string;
  requiresApproval?: boolean;
  approvedBy?: string;
  bypassPeriodLock?: boolean;
  lines: PostLineItem[];
}

export interface ReverseEntryParams {
  journalEntryId: string;
  reversedBy: string;
  reason: string;
}

export class AccountsPostingService {
  /**
   * The spine of the financial system.
   * Enforces balanced double-entry accounting: sum(debit) == sum(credit).
   * Enforces append-only immutable ledger principles and period locking.
   * Throws an error if unbalanced, invalid, or inside a locked period.
   */
  static async post(params: PostEntryParams) {
    const {
      date = new Date(),
      memo,
      refType,
      refId,
      postedBy = "System",
      requiresApproval = false,
      approvedBy,
      bypassPeriodLock = false,
      lines,
    } = params;

    if (!lines || lines.length === 0) {
      throw new Error("Posting rejected: A journal entry must have at least two line items.");
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error("Posting rejected: Debit and Credit amounts cannot be negative.");
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error("Posting rejected: A line item cannot have both debit and credit amounts.");
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    // Round to 2 decimal places to avoid floating point issues
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(roundedDebit - roundedCredit) > 0.01) {
      throw new Error(
        `Posting rejected: Journal entry is unbalanced. Total Debit: ${roundedDebit}, Total Credit: ${roundedCredit}`
      );
    }

    // 1. Validate Fiscal Period Lock
    let targetFiscalPeriodId: string | null = null;
    if (!bypassPeriodLock) {
      const activePeriod = await prisma.fiscalPeriod.findFirst({
        where: {
          startDate: { lte: date },
          endDate: { gte: date },
        },
      });

      if (activePeriod) {
        if (activePeriod.status === "closed" || activePeriod.status === "locked") {
          throw new Error(
            `Posting rejected: Fiscal period '${activePeriod.name}' (FY${activePeriod.fiscalYear}-P${activePeriod.periodNumber}) is ${activePeriod.status.toUpperCase()} for posting.`
          );
        }
        targetFiscalPeriodId = activePeriod.id;
      }
    }

    // 2. Validate Account Existence
    for (const line of lines) {
      const account = await prisma.account.findUnique({
        where: { id: line.accountId },
      });
      if (!account) {
        throw new Error(`Posting rejected: Account ID '${line.accountId}' does not exist.`);
      }
      if (!account.isActive) {
        throw new Error(`Posting rejected: Account '${account.name}' (${account.code}) is inactive/disabled.`);
      }
    }

    // 3. Determine Approval Status
    let status = "posted";
    if (requiresApproval && !approvedBy) {
      status = "pending_approval";
    }

    // 4. Atomically write journal entry and lines (Append-only)
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          date,
          memo,
          refType,
          refId,
          postedBy,
          postedAt: new Date(),
          status,
          requiresApproval,
          approvedBy: approvedBy || null,
          approvedAt: approvedBy ? new Date() : null,
          fiscalPeriodId: targetFiscalPeriodId,
          lines: {
            create: lines.map((l) => ({
              accountId: l.accountId,
              debit: Math.round(l.debit * 100) / 100,
              credit: Math.round(l.credit * 100) / 100,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });

      // 5. Append-only Audit Trail
      await tx.financialAuditLog.create({
        data: {
          entity: "JournalEntry",
          entityId: entry.id,
          action: "POST",
          afterValue: JSON.stringify({
            memo,
            refType,
            totalAmount: roundedDebit,
            linesCount: lines.length,
            status,
          }),
          userName: postedBy,
          userRole: "accountant",
        },
      });

      return entry;
    });
  }

  /**
   * Reverse an existing posted Journal Entry.
   * Strict GAAP/SAP compliance: Original entries are NEVER edited or deleted.
   * Instead, an exact equal-and-opposite entry is generated referencing the original.
   */
  static async reverseEntry(params: ReverseEntryParams) {
    const { journalEntryId, reversedBy, reason } = params;

    const originalEntry = await prisma.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: {
        lines: true,
      },
    });

    if (!originalEntry) {
      throw new Error(`Reversal rejected: Journal Entry '${journalEntryId}' not found.`);
    }

    if (originalEntry.status === "reversed") {
      throw new Error(
        `Reversal rejected: Journal Entry '${originalEntry.memo}' is already reversed by entry '${originalEntry.reversedById}'.`
      );
    }

    if (originalEntry.status === "reversal") {
      throw new Error(`Reversal rejected: Cannot reverse an existing reversal entry.`);
    }

    // Check period lock for today's reversal date
    const today = new Date();
    const activePeriod = await prisma.fiscalPeriod.findFirst({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    if (activePeriod && (activePeriod.status === "closed" || activePeriod.status === "locked")) {
      throw new Error(
        `Reversal rejected: Current fiscal period '${activePeriod.name}' is ${activePeriod.status.toUpperCase()} for posting.`
      );
    }

    // Prepare equal-and-opposite lines (swap debits and credits)
    const reversedLines: PostLineItem[] = originalEntry.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,   // Swap: original credit becomes debit
      credit: l.debit,   // Swap: original debit becomes credit
    }));

    return await prisma.$transaction(async (tx) => {
      // 1. Create reversal journal voucher
      const reversalEntry = await tx.journalEntry.create({
        data: {
          date: today,
          memo: `[REVERSAL] ${originalEntry.memo} (Reason: ${reason})`,
          refType: "reversal",
          refId: originalEntry.id,
          postedBy: reversedBy,
          postedAt: today,
          status: "reversal",
          reversalOfId: originalEntry.id,
          fiscalPeriodId: activePeriod?.id || null,
          lines: {
            create: reversedLines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      // 2. Mark original entry as reversed
      await tx.journalEntry.update({
        where: { id: originalEntry.id },
        data: {
          status: "reversed",
          reversedById: reversalEntry.id,
        },
      });

      // 3. Log Financial Audit
      await tx.financialAuditLog.create({
        data: {
          entity: "JournalEntry",
          entityId: originalEntry.id,
          action: "REVERSE",
          beforeValue: JSON.stringify({ status: originalEntry.status }),
          afterValue: JSON.stringify({
            status: "reversed",
            reversalEntryId: reversalEntry.id,
            reason,
          }),
          userName: reversedBy,
          userRole: "accountant",
        },
      });

      return reversalEntry;
    });
  }

  /**
   * Helper to look up accounts by code.
   * Throws an error if the account is not found in the Chart of Accounts.
   * Does NOT auto-provision or create accounts on the fly.
   */
  static async getAccountByCode(code: string) {
    const account = await prisma.account.findUnique({
      where: { code },
    });
    if (!account) {
      throw new Error(`Account with code '${code}' not found in Chart of Accounts.`);
    }
    return account;
  }
}
