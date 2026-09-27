"use client";

import React from "react";
import { Flame, Printer } from "lucide-react";
import { formatCurrency, formatDate, numberToWords } from "@/lib/utils";

interface VendorBillDocumentProps {
  invoice: any;
  onClose?: () => void;
}

export default function VendorBillDocument({
  invoice,
  onClose,
}: VendorBillDocumentProps) {
  if (!invoice) return null;

  const grossAmount = invoice.amount || invoice.grossAmount || 0;
  const whtAmount = invoice.whtAmount || invoice.withholdingTax || 0;
  const netPayable =
    invoice.netPayable !== undefined && invoice.netPayable !== null
      ? invoice.netPayable
      : Math.max(0, grossAmount - whtAmount);

  return (
    <div className="space-y-4">
      {/* Action Bar (Hidden during print) */}
      <div className="no-print flex items-center justify-between p-3 bg-zinc-100 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700">Vendor Bill & 3-Way Match Voucher View</span>
          <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
            {invoice.invoiceNumber}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-200 transition"
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Document Container */}
      <div className="printable-document p-8 bg-white border border-zinc-300 rounded-2xl shadow-sm text-xs text-zinc-800 font-sans space-y-6">
        {/* Letterhead Header */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center shadow">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-900 leading-none">
                WORKMAN SERVICES (PVT) LTD
              </h1>
              <p className="text-[11px] text-zinc-600 font-medium mt-0.5">
                HVAC Engineering, Industrial Air-Conditioning & Facility Services
              </p>
              <div className="text-[10px] text-zinc-500 font-mono mt-1">
                Main Boulevard, Gulberg III, Lahore • Phone: 042-111-WORKMAN
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                NTN: 9482710-3 • STRN: 3277876123456 • Accounts Payable Voucher
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-black font-mono text-zinc-900 tracking-wider">
              VENDOR BILL & DISBURSEMENT VOUCHER
            </div>
            <div className="text-xs font-mono font-bold text-purple-700 mt-0.5">
              BILL #{invoice.invoiceNumber}
            </div>
            <div className="text-[10px] font-mono text-zinc-600 mt-1">
              Bill Date: {formatDate(invoice.invoiceDate || invoice.createdAt)}
            </div>
            <div className="text-[10px] font-mono text-zinc-600">
              PO Ref: <strong className="text-zinc-900">{invoice.po?.poNumber || "Direct"}</strong>
            </div>
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-300 uppercase">
                Audit: {invoice.matchStatus?.replace(/_/g, " ") || "VERIFIED"}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor & Matching Context */}
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Vendor / Payee Details
            </span>
            <div className="font-bold text-sm text-zinc-900">
              {invoice.vendor?.name || invoice.supplierName || "Supplier"}
            </div>
            <div className="text-zinc-600 mt-0.5">
              {invoice.vendor?.addressText || "Commercial Industrial Zone, Lahore/Karachi"}
            </div>
            <div className="font-mono text-[10px] text-zinc-500 mt-1">
              NTN: {invoice.vendor?.ntnNumber || "Exempt / N/A"} • STRN: {invoice.vendor?.strnNumber || "—"}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              3-Way Match & Payment Terms
            </span>
            <div>
              <span className="font-semibold text-zinc-800">PO Reference:</span>{" "}
              <span className="font-mono">{invoice.po?.poNumber || "Direct Vendor Voucher"}</span>
            </div>
            <div className="mt-0.5">
              <span className="font-semibold text-zinc-800">Verified GRN:</span>{" "}
              <span className="font-mono text-emerald-800 font-bold">
                {invoice.grn?.grnNumber || "GRN Verified"}
              </span>
            </div>
            <div className="mt-0.5">
              <span className="font-semibold text-zinc-800">Payment Terms:</span>{" "}
              <span className="font-mono font-semibold">{invoice.po?.paymentTerms || "Net 30 Days"}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-zinc-300 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item Specification / Billable Expense</th>
                <th className="py-2.5 px-3 text-right">PO Qty</th>
                <th className="py-2.5 px-3 text-right">GRN Recv</th>
                <th className="py-2.5 px-3 text-right">Billed Rate</th>
                <th className="py-2.5 px-3 text-right">Total Line Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((it: any, idx: number) => (
                  <tr key={it.id || idx}>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-900">{it.description}</div>
                      {it.itemCode && (
                        <span className="font-mono text-[10px] text-zinc-500">
                          SKU: {it.itemCode}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                      {it.poQuantity || it.quantity || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                      {it.grnQuantity || it.quantity || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatCurrency(it.unitCost || it.rate || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                      {formatCurrency(it.lineTotal || (it.quantity || 1) * (it.unitCost || 0))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-2.5 px-3 font-mono text-zinc-500">1</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-zinc-900">
                      Procurement Invoiced Items under PO {invoice.po?.poNumber || "Direct"}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      3-Way Matched against warehouse Goods Receipt Note
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-zinc-600">Verified</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">100%</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(grossAmount)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                    {formatCurrency(grossAmount)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex items-start justify-between gap-6 pt-2">
          {/* Words */}
          <div className="flex-1 space-y-3">
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block mb-0.5">
                Net Disbursement in Words:
              </span>
              <p className="font-semibold text-zinc-900 italic">
                {numberToWords(netPayable)}
              </p>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-purple-900 font-bold block mb-1">
                GL & Tax Audit Endorsement:
              </span>
              <div className="text-[11px] text-zinc-700 space-y-0.5">
                <div>• Debit: 50100 Inventory / Direct Sourcing Expense Account</div>
                <div>• Credit: 20100 Accounts Payable (Vendor Subsidiary Ledger)</div>
                <div>• Withholding Tax deducted under Income Tax Ordinance Sec 153.</div>
              </div>
            </div>
          </div>

          {/* Totals Table */}
          <div className="w-72 space-y-1.5 p-3.5 rounded-xl bg-zinc-50 border border-zinc-300 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Gross Bill Amount:</span>
              <span className="font-mono font-semibold">{formatCurrency(grossAmount)}</span>
            </div>
            {whtAmount > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>WHT Deduction:</span>
                <span className="font-mono text-rose-600">-{formatCurrency(whtAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-zinc-900 border-t-2 border-zinc-900 pt-2 mt-1">
              <span>Net Approved Payable:</span>
              <span className="font-mono text-[#0D7A5F]">{formatCurrency(netPayable)}</span>
            </div>
          </div>
        </div>

        {/* Signature Blocks */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-700 font-semibold">
              Fatima Noor
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Accounts Payable Auditor
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
              Bilal Sheikh
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Procurement & GRN Endorser
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-900 font-bold">
              Haris Qureshi
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Managing Director (Disbursement Approval)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
