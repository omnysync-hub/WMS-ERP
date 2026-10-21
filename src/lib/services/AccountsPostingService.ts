import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Prisma client or interactive-transaction client. */
export type DbClient = Prisma.TransactionClient | typeof prisma;

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
  /**
   * Business idempotency key (unique in DB). A second post with the same key fails with a
   * unique-constraint error instead of double-posting. Use e.g. `expense_clear:<claimId>`.
   */
  idempotencyKey?: string | null;
  /** When provided, the entry is written inside the caller's interactive transaction. */
  tx?: Prisma.TransactionClient;
}

export interface ReverseEntryParams {
  journalEntryId: string;
  reversedBy: string;
  reason: string;
  /** When provided, the reversal is written inside the caller's interactive transaction. */
  tx?: Prisma.TransactionClient;
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
      idempotencyKey,
      tx: outerTx,
    } = params;
    const db: DbClient = outerTx ?? prisma;

    if (!lines || lines.length < 2) {
      throw new Error("Posting rejected: A journal entry must have at least two line items.");
    }

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    const normalizedLines = lines.map((line) => {
      if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit)) {
        throw new Error("Posting rejected: Debit and Credit amounts must be valid finite numbers.");
      }
      if (line.debit < 0 || line.credit < 0) {
        throw new Error("Posting rejected: Debit and Credit amounts cannot be negative.");
      }
      const debitCents = Math.round(line.debit * 100);
      const creditCents = Math.round(line.credit * 100);
      if (debitCents > 0 && creditCents > 0) {
        throw new Error("Posting rejected: A line item cannot have both debit and credit amounts.");
      }
      if (debitCents === 0 && creditCents === 0) {
        throw new Error("Posting rejected: Each line item must contain at least one cent of value.");
      }
      totalDebitCents += debitCents;
      totalCreditCents += creditCents;
      return {
        accountId: line.accountId,
        debit: debitCents / 100,
        credit: creditCents / 100,
      };
    });

    const roundedDebit = totalDebitCents / 100;
    const roundedCredit = totalCreditCents / 100;

    if (totalDebitCents !== totalCreditCents) {
      throw new Error(
        `Posting rejected: Journal entry is unbalanced. Total Debit: ${roundedDebit}, Total Credit: ${roundedCredit}`
      );
    }

    // 0. Idempotency: the same key always returns the entry that was already posted.
    if (idempotencyKey) {
      const existing = await db.journalEntry.findUnique({
        where: { idempotencyKey },
        include: { lines: { include: { account: true } } },
      });
      if (existing) return existing;
    }

    // 1. Validate Fiscal Period Lock
    let targetFiscalPeriodId: string | null = null;
    if (!bypassPeriodLock) {
      const activePeriod = await db.fiscalPeriod.findFirst({
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
    for (const line of normalizedLines) {
      const account = await db.account.findUnique({
        where: { id: line.accountId },
      });
      if (!account) {
        throw new Error(`Posting rejected: Account ID '${line.accountId}' does not exist.`);
      }
      if (!account.isActive) {
        throw new Error(`Posting rejected: Account '${account.name}' (${account.code}) is inactive/disabled.`);
      }
      // Header/group accounts only roll up their children; postings must go to a leaf account.
      const childCount = await db.account.count({ where: { parentId: account.id } });
      if (childCount > 0) {
        throw new Error(
          `Posting rejected: '${account.name}' (${account.code}) is a group account with ${childCount} sub-account(s). Post to one of its sub-accounts.`
        );
      }
    }

    // 3. Determine Approval Status
    let status = "posted";
    if (requiresApproval && !approvedBy) {
      status = "pending_approval";
    }

    // 4. Atomically write journal entry and lines (Append-only)
    const write = async (tx: Prisma.TransactionClient) => {
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
          idempotencyKey: idempotencyKey || null,
          lines: {
            create: normalizedLines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
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
    };
    return outerTx ? write(outerTx) : prisma.$transaction(write);
  }

  /**
   * Reverse an existing posted Journal Entry.
   * Strict GAAP/SAP compliance: Original entries are NEVER edited or deleted.
   * Instead, an exact equal-and-opposite entry is generated referencing the original.
   */
  static async reverseEntry(params: ReverseEntryParams) {
    const { journalEntryId, reversedBy, reason, tx: outerTx } = params;
    const db: DbClient = outerTx ?? prisma;

    const originalEntry = await db.journalEntry.findUnique({
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
    const activePeriod = await db.fiscalPeriod.findFirst({
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

    const write = async (tx: Prisma.TransactionClient) => {
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

      // 2b. Keep the party sub-ledgers and source documents in step with the GL, so AR/AP control
      //     accounts still reconcile and invoices/bills show the right status after a reversal.
      await AccountsPostingService.reverseDocumentEffects(tx, originalEntry, reversalEntry.id, reason, today);

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
    };
    return outerTx ? write(outerTx) : prisma.$transaction(write);
  }

  /** Mirror sub-ledger rows and update the source document when a journal entry is reversed. */
  private static async reverseDocumentEffects(
    tx: Prisma.TransactionClient,
    original: { id: string; refType: string; refId: string | null },
    reversalId: string,
    reason: string,
    when: Date
  ) {
    const round = (n: number) => Math.round(n * 100) / 100;
    const note = `Reversal: ${reason}`.slice(0, 250);

    // Source documents first (these can refuse the reversal, which rolls everything back).
    if (original.refType === "job_revenue" && original.refId) {
      const invoices = await tx.invoice.findMany({ where: { jobId: original.refId, status: { not: "cancelled" } } });
      for (const inv of invoices) {
        const paid = await tx.journalEntry.count({ where: { refType: "customer_payment", refId: inv.id, status: "posted" } });
        if (paid > 0) {
          throw new Error(`Reversal rejected: invoice ${inv.invoiceNumber} has customer receipts. Reverse the receipts first.`);
        }
        await tx.invoice.update({ where: { id: inv.id }, data: { status: "cancelled" } });
      }
    }
    if (original.refType === "customer_payment" && original.refId) {
      const inv = await tx.invoice.findUnique({ where: { id: original.refId } });
      if (inv && inv.status === "paid") await tx.invoice.update({ where: { id: inv.id }, data: { status: "unpaid" } });
    }
    if (original.refType === "vendor_bill") {
      const bill = await tx.supplierInvoice.findFirst({ where: { journalEntryId: original.id } });
      if (bill) {
        if ((bill.paidAmount || 0) > 0.005) {
          throw new Error(`Reversal rejected: bill ${bill.invoiceNumber} has payments. Reverse the supplier payments first.`);
        }
        await tx.supplierInvoice.update({ where: { id: bill.id }, data: { matchStatus: "cancelled" } });
      }
    }
    if (original.refType === "vendor_payment" && original.refId) {
      const pay = await tx.supplierPayment.findUnique({ where: { paymentNumber: original.refId } });
      if (pay) {
        const bill = await tx.supplierInvoice.findUnique({ where: { id: pay.supplierInvoiceId } });
        if (bill) {
          const paidAmount = Math.max(0, round((bill.paidAmount || 0) - pay.amount));
          await tx.supplierInvoice.update({
            where: { id: bill.id },
            data: {
              paidAmount,
              paymentStatus: paidAmount <= 0.005 ? "unpaid" : "partially_paid",
              ...(bill.matchStatus === "paid" ? { matchStatus: "approved_for_payment" } : {}),
            },
          });
        }
      }
    }

    // Party sub-ledgers: post the mirror image of every row the original entry created.
    const custRows = await tx.customerLedgerEntry.findMany({ where: { journalEntryId: original.id } });
    const customers = new Set<string>();
    for (const r of custRows) {
      await tx.customerLedgerEntry.create({
        data: { customerId: r.customerId, postingDate: when, entryType: "reversal", documentNumber: `REV-${r.documentNumber}`.slice(0, 80), journalEntryId: reversalId, debit: r.credit, credit: r.debit, runningBalance: 0, notes: note },
      });
      customers.add(r.customerId);
    }
    for (const customerId of customers) {
      const rows = await tx.customerLedgerEntry.findMany({ where: { customerId }, orderBy: [{ postingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
      let bal = 0;
      for (const row of rows) { bal = round(bal + row.debit - row.credit); await tx.customerLedgerEntry.update({ where: { id: row.id }, data: { runningBalance: bal } }); }
    }
    const vendRows = await tx.vendorLedgerEntry.findMany({ where: { journalEntryId: original.id } });
    const vendors = new Set<string>();
    for (const r of vendRows) {
      await tx.vendorLedgerEntry.create({
        data: { vendorId: r.vendorId, postingDate: when, entryType: "reversal", documentNumber: `REV-${r.documentNumber}`.slice(0, 80), journalEntryId: reversalId, debit: r.credit, credit: r.debit, runningBalance: 0, notes: note },
      });
      vendors.add(r.vendorId);
    }
    for (const vendorId of vendors) {
      const rows = await tx.vendorLedgerEntry.findMany({ where: { vendorId }, orderBy: [{ postingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
      let bal = 0;
      for (const row of rows) { bal = round(bal + row.credit - row.debit); await tx.vendorLedgerEntry.update({ where: { id: row.id }, data: { runningBalance: bal } }); }
    }
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
