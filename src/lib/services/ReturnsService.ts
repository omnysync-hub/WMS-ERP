import { prisma } from "@/lib/prisma";
import { AccountMappingService } from "./AccountMappingService";
import { AccountsPostingService } from "./AccountsPostingService";
import { InventoryService } from "./InventoryService";
import { SubLedgerService } from "./SubLedgerService";
import { CustomerReceiptService } from "./CustomerReceiptService";
import { TaxSettingsService } from "@/lib/tax/TaxSettingsService";
import { findRate } from "@/lib/tax/taxConfig";

const r2 = (n: number) => Math.round(n * 100) / 100;
const TX = { maxWait: 10000, timeout: 30000 } as const;

export interface ReturnLine {
  /** Warehouse product (needed to put stock back / take it out). */
  productId?: string | null;
  description?: string | null;
  quantity: number;
  /** Sales return: selling price per unit. Purchase return: purchase cost per unit. */
  unitPrice: number;
  /** Sales return only: put the item back into stock (default true when productId is set). */
  restock?: boolean;
}

/**
 * Returns ("Accounts Linking" #6).
 *
 * Sales Return / Credit Note (against a customer invoice):
 *   Dr 41201 Sales Returns (net) + Dr Output Tax / Cr 11201 AR   (excess over what is still owed -> Cr 21105 Advances)
 *   stock back : Dr Inventory / Cr COGS  (at the product's cost)
 *
 * Purchase Return / Debit Note (goods back to a supplier):
 *   Dr 21101 AP / Cr Inventory (stocked goods) or Cr 51106 Purchase Returns (non-stock) + Cr Input Tax
 */
export class ReturnsService {
  static async createSalesReturn(params: {
    invoiceId: string;
    lines: ReturnLine[];
    reason: string;
    actorName: string;
  }) {
    const invoice = await prisma.invoice.findUnique({ where: { id: params.invoiceId } });
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "cancelled") throw new Error(`Invoice ${invoice.invoiceNumber} is cancelled.`);
    if (!invoice.customerId) throw new Error(`Invoice ${invoice.invoiceNumber} has no customer.`);
    const lines = (params.lines || []).filter((l) => Number(l.quantity) > 0 && Number(l.unitPrice) >= 0);
    if (!lines.length) throw new Error("Add at least one returned line with a quantity.");
    if (!params.reason || params.reason.trim().length < 3) throw new Error("A reason is required for a credit note.");

    // Amounts entered at the invoice's own price basis (tax-inclusive invoices: price includes tax).
    const gross = r2(lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0));
    const rate = invoice.taxApplied && invoice.taxAmount > 0 ? Number(invoice.taxRate) || 0 : 0;
    const net = rate > 0 && invoice.taxInclusive ? r2(gross / (1 + rate / 100)) : gross;
    const tax = rate > 0 ? (invoice.taxInclusive ? r2(gross - net) : r2((net * rate) / 100)) : 0;
    const total = r2(net + tax);
    if (!(total > 0)) throw new Error("Credit note total must be greater than zero.");

    const { rates } = await TaxSettingsService.load();
    const rateCfg = invoice.taxCode ? findRate(rates, invoice.taxCode, invoice.createdAt) : null;

    return prisma.$transaction(async (tx) => {
      const prior = await tx.customerLedgerEntry.count({
        where: { customerId: invoice.customerId!, documentNumber: { startsWith: `CN-${invoice.invoiceNumber}-` } },
      });
      const cnNumber = `CN-${invoice.invoiceNumber}-${prior + 1}`;
      const returnsAcc = await AccountMappingService.resolveAccount({ transactionType: "sales_return_contra", prismaClient: tx });
      const arAcc = await AccountMappingService.resolveAccount({ transactionType: "customer_payment_receivable", prismaClient: tx });
      const taxAcc = tax > 0 ? await TaxSettingsService.accountFor(rateCfg || { accountRole: null }, "sales_tax_payable", tx) : null;

      // Only what the customer still owes comes off AR; the rest becomes his advance (refund / next job).
      const paid = await CustomerReceiptService.paidToDate(tx, invoice.id);
      const outstanding = Math.max(0, r2(invoice.amount - paid));
      const toAr = r2(Math.min(total, outstanding));
      const toAdvance = r2(total - toAr);
      const advAcc = toAdvance > 0 ? await AccountMappingService.resolveAccount({ transactionType: "customer_advance_liability", prismaClient: tx }) : null;
      const party = { partyType: "customer", partyId: invoice.customerId! };

      // When part of it comes off AR, the journal is filed as a "customer_payment" against the invoice
      // (AR is its first credit line) so every existing outstanding / status / reversal calculation
      // counts the credit note. A credit note that only creates an advance is filed as "sales_return".
      const journal = await AccountsPostingService.post({
        memo: `Credit note ${cnNumber} on ${invoice.invoiceNumber} (${invoice.customerName}): ${params.reason.trim()}`,
        refType: toAr > 0 ? "customer_payment" : "sales_return",
        refId: invoice.id,
        postedBy: params.actorName,
        lines: [
          { accountId: returnsAcc.id, debit: net, credit: 0 },
          ...(taxAcc && tax > 0 ? [{ accountId: taxAcc.id, debit: tax, credit: 0 }] : []),
          ...(toAr > 0 ? [{ accountId: arAcc.id, debit: 0, credit: toAr, ...party }] : []),
          ...(advAcc && toAdvance > 0 ? [{ accountId: advAcc.id, debit: 0, credit: toAdvance, ...party }] : []),
        ],
        tx,
      });
      if (toAr > 0) {
        const settledNow = r2(paid + toAr);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: settledNow >= invoice.amount - 0.01 ? "paid" : "partially_paid" },
        });
      }

      // Stock back into the store at cost: Dr Inventory / Cr COGS.
      const restocked: { productId: string; qty: number; cost: number }[] = [];
      for (const l of lines) {
        if (!l.productId || l.restock === false) continue;
        const product = await tx.product.findUnique({ where: { id: l.productId } });
        if (!product) throw new Error(`Product ${l.productId} not found.`);
        const qty = Number(l.quantity);
        const cost = r2(qty * (product.costPrice || 0));
        await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: qty } } });
        await tx.stockLedger.create({
          data: { productId: product.id, qty, direction: "in", refType: "sales_return", refId: invoice.id, notes: `${cnNumber}: ${params.reason.trim()}` },
        });
        if (cost > 0) {
          const invAcc = await InventoryService.stockAccountFor(tx, product, "inventory_return_asset");
          const cogsAcc = await AccountMappingService.resolveAccount({
            transactionType: product.forDirectSale ? "pos_cogs_expense" : "inventory_return_cogs",
            prismaClient: tx,
          });
          await AccountsPostingService.post({
            memo: `${cnNumber}: ${qty} x ${product.name} returned to stock`,
            refType: "sales_return_stock",
            refId: invoice.id,
            postedBy: params.actorName,
            lines: [
              { accountId: invAcc.id, debit: cost, credit: 0 },
              { accountId: cogsAcc.id, debit: 0, credit: cost },
            ],
            tx,
          });
        }
        restocked.push({ productId: product.id, qty, cost });
      }

      await SubLedgerService.recordCustomerEntry({
        customerId: invoice.customerId!,
        entryType: "credit_note",
        documentNumber: cnNumber,
        journalEntryId: journal.id,
        debit: 0,
        credit: total,
        notes: `Credit note on ${invoice.invoiceNumber}: ${params.reason.trim()}`,
        tx,
      });

      return { creditNoteNumber: cnNumber, journalEntryId: journal.id, net, tax, total, toAr, toAdvance, restocked };
    }, TX);
  }

  static async createPurchaseReturn(params: {
    vendorId: string;
    supplierInvoiceId?: string | null;
    lines: ReturnLine[];
    reason: string;
    actorName: string;
  }) {
    const vendor = await prisma.vendor.findUnique({ where: { id: params.vendorId } });
    if (!vendor) throw new Error("Vendor not found.");
    const bill = params.supplierInvoiceId
      ? await prisma.supplierInvoice.findUnique({ where: { id: params.supplierInvoiceId } })
      : null;
    if (params.supplierInvoiceId && !bill) throw new Error("Supplier bill not found.");
    if (bill && bill.vendorId !== vendor.id) throw new Error("That bill belongs to another vendor.");
    const lines = (params.lines || []).filter((l) => Number(l.quantity) > 0 && Number(l.unitPrice) >= 0);
    if (!lines.length) throw new Error("Add at least one returned line with a quantity.");
    if (!params.reason || params.reason.trim().length < 3) throw new Error("A reason is required for a debit note.");

    const value = r2(lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0));
    // Tax comes back at the bill's own tax ratio (0 when returned without a bill).
    const taxRatio = bill && bill.subtotal > 0 ? (Number(bill.taxAmount) || 0) / bill.subtotal : 0;
    const tax = r2(value * taxRatio);
    const total = r2(value + tax);
    if (!(total > 0)) throw new Error("Debit note total must be greater than zero.");
    const { policy } = await TaxSettingsService.load();

    return prisma.$transaction(async (tx) => {
      const prior = await tx.journalEntry.count({ where: { refType: "purchase_return", refId: vendor.id } });
      const dnNumber = `DN-${(vendor.vendorCode || vendor.name.slice(0, 6)).toUpperCase().replace(/\s+/g, "")}-${prior + 1}`;
      const apAcc = await AccountMappingService.resolveAccount({ transactionType: "vendor_bill_payable", prismaClient: tx });
      const taxAcc =
        tax > 0
          ? await AccountMappingService.resolveAccount({
              transactionType: policy.procurement.recordInputTax ? "input_tax_receivable" : "vendor_bill_tax_cost",
              prismaClient: tx,
            })
          : null;

      const credits = new Map<string, number>();
      const addCredit = (id: string, amt: number) => credits.set(id, r2((credits.get(id) || 0) + amt));
      for (const l of lines) {
        const amt = r2(Number(l.quantity) * Number(l.unitPrice));
        if (l.productId) {
          const product = await tx.product.findUnique({ where: { id: l.productId } });
          if (!product) throw new Error(`Product ${l.productId} not found.`);
          const qty = Number(l.quantity);
          if ((product.stockQuantity || 0) + 1e-9 < qty) {
            throw new Error(`Only ${product.stockQuantity} ${product.unit} of ${product.name} in stock; cannot return ${qty}.`);
          }
          await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { decrement: qty } } });
          await tx.stockLedger.create({
            data: { productId: product.id, qty, direction: "out", refType: "purchase_return", refId: bill?.id || vendor.id, notes: `${dnNumber}: ${params.reason.trim()}` },
          });
          const invAcc = await InventoryService.stockAccountFor(tx, product, "grn_receipt_asset");
          addCredit(invAcc.id, amt);
        } else {
          const contra = await AccountMappingService.resolveAccount({ transactionType: "purchase_return_contra", prismaClient: tx });
          addCredit(contra.id, amt);
        }
      }

      const journal = await AccountsPostingService.post({
        memo: `Debit note ${dnNumber} to ${vendor.name}${bill ? ` on bill ${bill.invoiceNumber}` : ""}: ${params.reason.trim()}`,
        refType: "purchase_return",
        refId: vendor.id,
        postedBy: params.actorName,
        lines: [
          { accountId: apAcc.id, debit: total, credit: 0, partyType: "supplier", partyId: vendor.id },
          ...Array.from(credits.entries()).map(([accountId, credit]) => ({ accountId, debit: 0, credit })),
          ...(taxAcc && tax > 0 ? [{ accountId: taxAcc.id, debit: 0, credit: tax }] : []),
        ],
        tx,
      });

      // The debit note reduces what we still owe on the bill.
      if (bill) {
        const paidAmount = r2((bill.paidAmount || 0) + total);
        await tx.supplierInvoice.update({
          where: { id: bill.id },
          data: {
            paidAmount,
            paymentStatus: paidAmount >= bill.totalAmount - 0.01 ? "paid" : "partially_paid",
            matchNotes: `${bill.matchNotes || ""} [Debit note ${dnNumber}: PKR ${total}]`.trim(),
          },
        });
      }
      await SubLedgerService.recordVendorEntry({
        vendorId: vendor.id,
        entryType: "debit_note",
        documentNumber: dnNumber,
        journalEntryId: journal.id,
        debit: total,
        credit: 0,
        notes: `Purchase return${bill ? ` on ${bill.invoiceNumber}` : ""}: ${params.reason.trim()}`,
        tx,
      });

      return { debitNoteNumber: dnNumber, journalEntryId: journal.id, value, tax, total };
    }, TX);
  }
}

export type SalesReturnResult = Awaited<ReturnType<typeof ReturnsService.createSalesReturn>>;
export type PurchaseReturnResult = Awaited<ReturnType<typeof ReturnsService.createPurchaseReturn>>;
