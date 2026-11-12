import type { Account, Prisma } from "@prisma/client";
import { AccountMappingService } from "./AccountMappingService";
import { AccountsPostingService } from "./AccountsPostingService";
import { SubLedgerService } from "./SubLedgerService";

type Tx = Prisma.TransactionClient;

/** How the customer paid. Each mode posts to its own cash/bank ledger. */
export type ReceiptMode = "cash" | "bank" | "wallet";

const MODE_ROLE: Record<ReceiptMode, string> = {
  cash: "customer_payment_receiving", // 11101 Cash on Hand
  bank: "customer_payment_bank", // 11103 Operating Bank
  wallet: "customer_payment_wallet", // 11104 JazzCash / Easypaisa
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Customer receipts, customer advances and advance adjustment ("Accounts Linking" items 2 and 4).
 *
 *   Receipt against an invoice : Dr Cash/Bank/Wallet         / Cr 11201 AR
 *   Receipt with NO invoice    : Dr Cash/Bank/Wallet         / Cr 21105 Customer Advances
 *   Invoice raised later       : Dr 21105 Customer Advances  / Cr 11201 AR   (refType customer_payment)
 *
 * Advance adjustments are posted with refType "customer_payment" against the invoice, so every
 * existing "paid to date / outstanding" calculation (and receipt reversal) already counts them.
 */
export class CustomerReceiptService {
  /** Receipt mode from a free-text payment method (cash, bank_transfer, cheque, card, jazzcash ...). */
  static modeFromPaymentMethod(method?: string | null): ReceiptMode {
    const m = String(method || "").toLowerCase();
    if (/wallet|jazz|easypaisa|easy\s*paisa|sadapay|nayapay|raast/.test(m)) return "wallet";
    if (/bank|transfer|cheque|check|card|online|ibft|pos_card|wire/.test(m)) return "bank";
    return "cash";
  }

  /**
   * The ledger a receipt is debited to: an explicitly chosen cash/bank account wins, otherwise the
   * account mapped for the receipt mode.
   */
  static async receivingAccount(
    tx: Tx,
    opts: { receivingAccountCode?: string | null; mode?: ReceiptMode | null; paymentMethod?: string | null }
  ): Promise<Account> {
    if (opts.receivingAccountCode) {
      const acc = await AccountsPostingService.getCashBankAccountByCode(String(opts.receivingAccountCode), tx);
      if (!acc) throw new Error(`Receiving account ${opts.receivingAccountCode} is not an active cash/bank account.`);
      return acc;
    }
    const mode = opts.mode || this.modeFromPaymentMethod(opts.paymentMethod);
    return AccountMappingService.resolveAccount({ transactionType: MODE_ROLE[mode], prismaClient: tx });
  }

  /** Advance balance the customer still has with us (credit balance of 21105 for this customer). */
  static async availableAdvance(tx: Tx, customerId: string): Promise<number> {
    const advAcc = await AccountMappingService.resolveAccountOptional({ transactionType: "customer_advance_liability", prismaClient: tx });
    if (!advAcc) return 0;
    const agg = await tx.journalLine.aggregate({
      where: {
        accountId: advAcc.id,
        partyType: "customer",
        partyId: customerId,
        journalEntry: { status: { in: ["posted", "reversed", "reversal"] } },
      },
      _sum: { debit: true, credit: true },
    });
    return Math.max(0, r2((agg._sum.credit || 0) - (agg._sum.debit || 0)));
  }

  /** Money received before any invoice: Dr Cash/Bank / Cr 21105 Customer Advances (party = customer). */
  static async recordAdvance(
    tx: Tx,
    params: {
      customerId: string;
      amount: number;
      receivingAccount: Account;
      memo: string;
      postedBy: string;
      refId?: string | null;
      documentNumber?: string;
    }
  ) {
    const amount = r2(params.amount);
    if (!(amount > 0)) throw new Error("Advance amount must be greater than zero.");
    const advAcc = await AccountMappingService.resolveAccount({ transactionType: "customer_advance_liability", prismaClient: tx });
    const journal = await AccountsPostingService.post({
      memo: params.memo,
      refType: "customer_advance",
      refId: params.refId || params.customerId,
      postedBy: params.postedBy,
      lines: [
        { accountId: params.receivingAccount.id, debit: amount, credit: 0 },
        { accountId: advAcc.id, debit: 0, credit: amount, partyType: "customer", partyId: params.customerId },
      ],
      tx,
    });
    await SubLedgerService.recordCustomerEntry({
      customerId: params.customerId,
      entryType: "advance",
      documentNumber: params.documentNumber || `ADV-${journal.id.slice(0, 8).toUpperCase()}`,
      journalEntryId: journal.id,
      debit: 0,
      credit: amount,
      notes: params.memo,
      tx,
    });
    return journal;
  }

  /**
   * A payment that names no invoice ("on account"):
   *   1. settles the customer's open invoices, oldest first (one customer_payment voucher per invoice),
   *   2. then any other balance the customer owes on AR (opening balances, manual debits),
   *   3. and only what is left over becomes a customer advance (Cr 21105).
   * The customer's balance comes from the customer sub-ledger (kept for every invoice / payment).
   */
  static async receiveOnAccount(
    tx: Tx,
    params: { customerId: string; amount: number; receivingAccount: Account; memo: string; postedBy: string; documentNumber: string }
  ) {
    const amount = r2(params.amount);
    if (!(amount > 0)) throw new Error("Payment amount must be greater than zero.");
    const last = await tx.customerLedgerEntry.findFirst({
      where: { customerId: params.customerId },
      orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    const owed = Math.max(0, r2(last?.runningBalance || 0));
    let toAr = r2(Math.min(amount, owed));
    const toAdvance = r2(amount - toAr);
    const arAcc = await AccountMappingService.resolveAccount({ transactionType: "customer_payment_receivable", prismaClient: tx });
    const party = { partyType: "customer", partyId: params.customerId };
    const settled: { invoiceNumber: string; amount: number }[] = [];
    let firstJournalId: string | null = null;

    // 1. Open invoices, oldest first.
    const open = await tx.invoice.findMany({
      where: { customerId: params.customerId, status: { in: ["unpaid", "partially_paid"] } },
      orderBy: { createdAt: "asc" },
    });
    for (const inv of open) {
      if (toAr <= 0.005) break;
      const paid = await this.paidToDate(tx, inv.id);
      const outstanding = r2(inv.amount - paid);
      if (outstanding <= 0.005) continue;
      const part = r2(Math.min(outstanding, toAr));
      const je = await AccountsPostingService.post({
        memo: `${params.memo} (against ${inv.invoiceNumber})`,
        refType: "customer_payment",
        refId: inv.id,
        postedBy: params.postedBy,
        lines: [
          { accountId: params.receivingAccount.id, debit: part, credit: 0 },
          { accountId: arAcc.id, debit: 0, credit: part, ...party },
        ],
        tx,
      });
      firstJournalId = firstJournalId || je.id;
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: r2(paid + part) >= inv.amount - 0.01 ? "paid" : "partially_paid" },
      });
      settled.push({ invoiceNumber: inv.invoiceNumber, amount: part });
      toAr = r2(toAr - part);
    }
    // 2. Remaining balance owed that is not on an invoice.
    if (toAr > 0.005) {
      const je = await AccountsPostingService.post({
        memo: `${params.memo} (on account)`,
        refType: "customer_payment",
        refId: params.customerId,
        postedBy: params.postedBy,
        lines: [
          { accountId: params.receivingAccount.id, debit: toAr, credit: 0 },
          { accountId: arAcc.id, debit: 0, credit: toAr, ...party },
        ],
        tx,
      });
      firstJournalId = firstJournalId || je.id;
    }
    const arTotal = r2(amount - toAdvance);
    if (arTotal > 0) {
      await SubLedgerService.recordCustomerEntry({
        customerId: params.customerId,
        entryType: "payment",
        documentNumber: params.documentNumber,
        journalEntryId: firstJournalId || undefined,
        debit: 0,
        credit: arTotal,
        notes: settled.length
          ? `${params.memo} - settles ${settled.map((s) => `${s.invoiceNumber} (${s.amount})`).join(", ")}`
          : params.memo,
        tx,
      });
    }
    // 3. Excess -> customer advance.
    const advance = toAdvance > 0.005
      ? await this.recordAdvance(tx, {
          customerId: params.customerId,
          amount: toAdvance,
          receivingAccount: params.receivingAccount,
          memo: `${params.memo} (advance, nothing owed)`,
          postedBy: params.postedBy,
          documentNumber: `${params.documentNumber}-ADV`,
        })
      : null;
    return { toAr: arTotal, toAdvance, settled, journalEntryId: firstJournalId || advance?.id || null };
  }

  /** Receipts (incl. advance adjustments and WHT) already settled against an invoice. */
  static async paidToDate(tx: Tx, invoiceId: string): Promise<number> {
    const prior = await tx.journalEntry.findMany({
      where: { refType: "customer_payment", refId: invoiceId, status: "posted" },
      include: { lines: true },
    });
    return r2(prior.reduce((sum, je) => sum + (je.lines.find((l) => l.credit > 0)?.credit || 0), 0));
  }

  /**
   * Adjust the customer's open advance against an invoice: Dr 21105 / Cr AR (both party = customer).
   * The customer sub-ledger is NOT touched again: the advance was already credited there when received.
   * Returns the amount adjusted (0 when there is no advance or nothing outstanding).
   */
  static async applyAdvancesToInvoice(
    tx: Tx,
    params: { invoiceId: string; postedBy: string }
  ): Promise<number> {
    const invoice = await tx.invoice.findUnique({ where: { id: params.invoiceId } });
    if (!invoice || !invoice.customerId || invoice.status === "paid" || invoice.status === "cancelled") return 0;
    const available = await this.availableAdvance(tx, invoice.customerId);
    if (!(available > 0.005)) return 0;
    const paid = await this.paidToDate(tx, invoice.id);
    const outstanding = r2(invoice.amount - paid);
    const amount = r2(Math.min(available, outstanding));
    if (!(amount > 0.005)) return 0;

    const advAcc = await AccountMappingService.resolveAccount({ transactionType: "customer_advance_liability", prismaClient: tx });
    const arAcc = await AccountMappingService.resolveAccount({ transactionType: "customer_payment_receivable", prismaClient: tx });
    await AccountsPostingService.post({
      memo: `Advance adjusted against invoice ${invoice.invoiceNumber} (${invoice.customerName})`,
      refType: "customer_payment",
      refId: invoice.id,
      postedBy: params.postedBy,
      lines: [
        { accountId: advAcc.id, debit: amount, credit: 0, partyType: "customer", partyId: invoice.customerId },
        { accountId: arAcc.id, debit: 0, credit: amount, partyType: "customer", partyId: invoice.customerId },
      ],
      tx,
    });
    const fullyPaid = r2(paid + amount) >= invoice.amount - 0.01;
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: fullyPaid ? "paid" : "partially_paid" } });
    return amount;
  }
}
