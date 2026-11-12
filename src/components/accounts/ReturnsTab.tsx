"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "@/lib/toast";

type Line = { productId: string; description: string; quantity: string; unitPrice: string; restock: boolean };
const emptyLine = (): Line => ({ productId: "", description: "", quantity: "1", unitPrice: "", restock: true });
const r2 = (n: number) => Math.round(n * 100) / 100;

const field = "w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs";
const label = "text-xs font-semibold text-[#71717A] block mb-1";

/**
 * Sales Returns / Credit Notes and Purchase Returns / Debit Notes ("Accounts Linking" #6).
 *   Credit note : Dr 41201 Sales Returns + Dr Output Tax / Cr AR ; stock back: Dr Inventory / Cr COGS
 *   Debit note  : Dr AP / Cr Inventory (or 51106 Purchase Returns) + Cr Input Tax
 */
export default function ReturnsTab() {
  const { hasPermission } = useRole();
  const canPost = hasPermission("accounts.manage_chart");
  const [mode, setMode] = useState<"sales" | "purchase">("sales");
  const [opts, setOpts] = useState<any>({ invoices: [], supplierBills: [], products: [], vendors: [] });
  const [history, setHistory] = useState<{ creditNotes: any[]; debitNotes: any[] }>({ creditNotes: [], debitNotes: [] });
  const [invoiceId, setInvoiceId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [billId, setBillId] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, h] = await Promise.all([fetch("/api/returns?view=options"), fetch("/api/returns")]);
      const oj = await o.json();
      const hj = await h.json();
      if (!o.ok) throw new Error(oj.error || "Failed to load");
      setOpts(oj);
      setHistory({ creditNotes: hj.creditNotes || [], debitNotes: hj.debitNotes || [] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const productById = useMemo(() => new Map<string, any>((opts.products || []).map((p: any) => [p.id, p])), [opts.products]);
  const invoice = (opts.invoices || []).find((i: any) => i.id === invoiceId);
  const bill = (opts.supplierBills || []).find((b: any) => b.id === billId);
  const vendorBills = (opts.supplierBills || []).filter((b: any) => !vendorId || b.vendorId === vendorId);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        if (patch.productId !== undefined) {
          const p = productById.get(patch.productId);
          if (p) {
            next.description = p.name;
            next.unitPrice = String(mode === "sales" ? p.unitPrice || "" : p.costPrice || "");
          }
        }
        return next;
      })
    );

  // Preview (the server recomputes and posts the authoritative figures).
  const value = r2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0));
  let previewTax = 0;
  if (mode === "sales" && invoice && invoice.taxAmount > 0) {
    const bd = Array.isArray(invoice.taxBreakdown) ? invoice.taxBreakdown : null;
    const goods = lines.some((l) => l.productId) || !bd?.some((c: any) => c.part === "services");
    const comp = bd?.find((c: any) => c.part === (goods ? "goods" : "services")) || bd?.[0];
    const rate = Number(comp ? comp.ratePercent : invoice.taxRate) || 0;
    previewTax = invoice.taxInclusive ? r2(value - value / (1 + rate / 100)) : r2((value * rate) / 100);
  } else if (mode === "purchase" && bill && bill.subtotal > 0) {
    previewTax = r2(value * ((Number(bill.taxAmount) || 0) / bill.subtotal));
  }
  const previewTotal = mode === "sales" && invoice?.taxInclusive ? value : r2(value + previewTax);

  const reset = () => {
    setLines([emptyLine()]);
    setReason("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payloadLines = lines
      .filter((l) => Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId || null,
        description: l.description || productById.get(l.productId)?.name || "Returned item",
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
        restock: l.restock,
      }));
    if (!payloadLines.length) return toast.error("Add at least one line with a quantity.");
    if (mode === "sales" && !invoiceId) return toast.error("Choose the invoice the return is against.");
    if (mode === "purchase" && !vendorId) return toast.error("Choose the supplier.");
    setBusy(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "sales"
            ? { type: "sales_return", invoiceId, lines: payloadLines, reason }
            : { type: "purchase_return", vendorId, supplierInvoiceId: billId || null, lines: payloadLines, reason }
        ),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to post");
      toast.success(
        mode === "sales"
          ? `Credit note ${j.creditNoteNumber} posted: ${formatCurrency(j.total)}${j.toAdvance > 0 ? ` (${formatCurrency(j.toAdvance)} kept as customer advance)` : ""}`
          : `Debit note ${j.debitNoteNumber} posted: ${formatCurrency(j.total)}`
      );
      reset();
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["sales", "purchase"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              reset();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              mode === m ? "bg-[#0D7A5F] text-white border-[#0D7A5F]" : "bg-white text-[#18181B] border-[#E4E4E7]"
            }`}
          >
            {m === "sales" ? "Sales Return / Credit Note" : "Purchase Return / Debit Note"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
        <p className="text-[11px] text-[#71717A]">
          {mode === "sales"
            ? "Dr 41201 Sales Returns + Dr Output Tax / Cr Accounts Receivable. Items marked 'back to stock' post Dr Inventory / Cr COGS at cost."
            : "Dr Accounts Payable / Cr Inventory (stock items) or 51106 Purchase Returns + Cr Input Tax. Stock is reduced."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {mode === "sales" ? (
            <div className="md:col-span-2">
              <label className={label}>Invoice</label>
              <select className={field} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
                <option value="">Choose invoice…</option>
                {(opts.invoices || []).map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} — {i.customerName} — {formatCurrency(i.amount)} ({i.status})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className={label}>Supplier</label>
                <select
                  className={field}
                  value={vendorId}
                  onChange={(e) => {
                    setVendorId(e.target.value);
                    setBillId("");
                  }}
                  required
                >
                  <option value="">Choose supplier…</option>
                  {(opts.vendors || []).map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Supplier bill (optional)</label>
                <select className={field} value={billId} onChange={(e) => setBillId(e.target.value)}>
                  <option value="">No bill (no tax)</option>
                  {vendorBills.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.invoiceNumber} ({b.referenceNumber}) — {formatCurrency(b.totalAmount)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className={label}>Reason</label>
            <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Faulty part returned" required minLength={3} />
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 md:col-span-4">
                <label className={label}>Item</label>
                <select className={field} value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })}>
                  <option value="">{mode === "sales" ? "Non-stock / service credit" : "Non-stock item (51106)"}</option>
                  {(opts.products || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — stock {p.stockQuantity} {p.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className={label}>Description</label>
                <input className={field} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
              </div>
              <div className="col-span-4 md:col-span-1">
                <label className={label}>Qty</label>
                <input className={field} type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              </div>
              <div className="col-span-4 md:col-span-2">
                <label className={label}>{mode === "sales" ? "Sale price / unit" : "Cost / unit"}</label>
                <input className={field} type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
              </div>
              <div className="col-span-4 md:col-span-2 flex items-center gap-2 pb-2">
                {mode === "sales" && l.productId && (
                  <label className="text-[11px] text-[#18181B] flex items-center gap-1">
                    <input type="checkbox" checked={l.restock} onChange={(e) => setLine(i, { restock: e.target.checked })} />
                    Back to stock
                  </label>
                )}
                {lines.length > 1 && (
                  <button type="button" className="text-[11px] text-rose-600 font-semibold" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-[#0D7A5F]" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            + Add line
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F4F4F5] pt-3">
          <div className="text-xs text-[#18181B] space-x-4">
            <span>Value: <b className="font-mono">{formatCurrency(mode === "sales" && invoice?.taxInclusive ? r2(value - previewTax) : value)}</b></span>
            <span>Tax: <b className="font-mono">{formatCurrency(previewTax)}</b></span>
            <span>Total: <b className="font-mono">{formatCurrency(previewTotal)}</b></span>
          </div>
          <button
            type="submit"
            disabled={busy || !canPost}
            className="px-4 py-2 rounded-lg bg-[#0D7A5F] text-white text-xs font-semibold disabled:opacity-50"
            title={canPost ? "" : "You need the 'manage chart of accounts' permission"}
          >
            {busy ? "Posting…" : mode === "sales" ? "Post Credit Note" : "Post Debit Note"}
          </button>
        </div>
      </form>

      <div className="bg-white border border-[#E4E4E7] rounded-xl overflow-hidden">
        <div className="p-3 text-xs font-bold text-[#18181B] border-b border-[#E4E4E7]">
          {mode === "sales" ? "Recent credit notes" : "Recent debit notes"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#FAFAFA] text-[#71717A]">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Document</th>
                <th className="p-2 text-left">{mode === "sales" ? "Customer" : "Supplier"}</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(mode === "sales" ? history.creditNotes : history.debitNotes).map((n: any) => (
                <tr key={n.id} className="border-t border-[#F4F4F5]">
                  <td className="p-2">{formatDateTime(n.createdAt)}</td>
                  <td className="p-2 font-mono">{n.documentNumber}</td>
                  <td className="p-2">{n.customer?.name || n.vendor?.name || "—"}</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(mode === "sales" ? n.credit : n.debit)}</td>
                  <td className="p-2 text-[#71717A]">{n.notes}</td>
                </tr>
              ))}
              {!(mode === "sales" ? history.creditNotes : history.debitNotes).length && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[#71717A]">
                    Nothing yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
