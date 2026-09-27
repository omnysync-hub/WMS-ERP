"use client";

import React from "react";
import { Flame, Printer, X, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate, numberToWords } from "@/lib/utils";

interface TaxInvoiceDocumentProps {
  job: any;
  invoiceNumber?: string;
  onClose?: () => void;
}

export default function TaxInvoiceDocument({
  job,
  invoiceNumber,
  onClose,
}: TaxInvoiceDocumentProps) {
  if (!job) return null;

  const invNum =
    invoiceNumber ||
    job.invoice?.invoiceNumber ||
    `INV-${job.jobNumber || "DRAFT"}`;

  // Calculate billable items and total
  const billableItems = (job.items || []).filter(
    (it: any) =>
      (it.quantityActual !== null && it.quantityActual !== undefined
        ? it.quantityActual
        : it.quantityPlanned) > 0
  );

  const calculatedSubtotal = billableItems.reduce((sum: number, it: any) => {
    const qty =
      it.quantityActual !== null && it.quantityActual !== undefined
        ? it.quantityActual
        : it.quantityPlanned;
    return sum + qty * it.unitRate;
  }, 0);

  const subtotal = calculatedSubtotal > 0 ? calculatedSubtotal : (job.invoice?.amount || 0);
  const discount = job.discountAmount || 0;
  const netPayable = Math.max(0, subtotal - discount);

  const invoiceDate = job.invoice?.createdAt
    ? new Date(job.invoice.createdAt)
    : job.finalizedAt
    ? new Date(job.finalizedAt)
    : new Date();

  return (
    <div className="space-y-4">
      {/* Action Bar (Hidden during print) */}
      <div className="no-print flex items-center justify-between p-3 bg-zinc-100 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700">Official Tax Invoice View</span>
          <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
            {invNum}
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

      {/* Printable Invoice Container */}
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
                NTN: 9482710-3 • STRN: 3277876123456 • PRA / FBR Registered
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-black font-mono text-zinc-900 tracking-wider">
              SALES TAX INVOICE
            </div>
            <div className="text-xs font-mono font-bold text-purple-700 mt-0.5">
              {invNum}
            </div>
            <div className="text-[10px] font-mono text-zinc-600 mt-1">
              Date: {formatDate(invoiceDate)}
            </div>
            <div className="text-[10px] font-mono text-zinc-600">
              Work Order Ref: <strong>#{job.jobNumber}</strong>
            </div>
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                STATUS: {job.finalizedAt || job.status === "Finalized" || job.status === "Verified" ? "FINALIZED" : "OFFICIAL BILLING"}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Scope Information */}
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Bill To / Client Details
            </span>
            <div className="font-bold text-sm text-zinc-900">
              {job.customer?.name || "Valued Client"}
            </div>
            <div className="text-zinc-600 mt-0.5">
              Site Address: {job.siteAddress || job.customer?.address || "On-site Client Facility, Lahore"}
            </div>
            <div className="text-zinc-600 mt-0.5">
              Phone: {job.customer?.phone || "—"}
            </div>
            <div className="text-zinc-600">
              Email: {job.customer?.email || "—"}
            </div>
            <div className="font-mono text-[10px] text-zinc-500 mt-1">
              Customer ID: {job.customer?.id?.slice(0, 8) || "ACC-CL"}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Service Execution & Billing Terms
            </span>
            <div>
              <span className="font-semibold text-zinc-800">Job Scope:</span>{" "}
              <span className="capitalize">{job.jobType || "HVAC Maintenance & Technical Service"}</span>
            </div>
            <div className="text-zinc-600 mt-0.5">
              Remarks: {job.remarks || "Work performed according to standard corporate engineering specifications."}
            </div>
            <div className="mt-1">
              <span className="font-semibold text-zinc-800">Assigned Tech:</span>{" "}
              <span>{job.assignedTechnician?.name || "Engineering Field Team"}</span>
            </div>
            <div className="mt-0.5">
              <span className="font-semibold text-zinc-800">Payment Terms:</span>{" "}
              <span className="font-mono font-bold text-zinc-800">Due Upon Presentation</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-zinc-300 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Description & Scope of Deliverables</th>
                <th className="py-2.5 px-3 text-right">Billable Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Rate</th>
                <th className="py-2.5 px-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {billableItems.length > 0 ? (
                billableItems.map((it: any, idx: number) => {
                  const qty =
                    it.quantityActual !== null && it.quantityActual !== undefined
                      ? it.quantityActual
                      : it.quantityPlanned;
                  const lineTotal = qty * it.unitRate;
                  return (
                    <tr key={it.id || idx}>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-zinc-900">{it.description}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {qty} {it.unit || "unit"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatCurrency(it.unitRate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="py-2.5 px-3 font-mono text-zinc-500">1</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-zinc-900">
                      HVAC Engineering Technical Services & Diagnostics
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Standard service fulfillment under work order #{job.jobNumber}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">1 Job</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(subtotal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                    {formatCurrency(subtotal)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex items-start justify-between gap-6 pt-2">
          {/* Amount in words & Bank info */}
          <div className="flex-1 space-y-3">
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block mb-0.5">
                Amount in Words:
              </span>
              <p className="font-semibold text-zinc-900 italic">
                {numberToWords(netPayable)}
              </p>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-purple-900 font-bold block mb-1">
                Direct Remittance & Bank Settlement:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-700">
                <div>
                  <span className="text-zinc-500">Bank:</span>{" "}
                  <strong className="text-zinc-900">Meezan Bank Ltd</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Title:</span>{" "}
                  <strong className="text-zinc-900">Workman Services (Pvt) Ltd</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500">IBAN / Acc:</span>{" "}
                  <strong className="font-mono text-purple-950">PK64 MEZN 0001 0004 8271 0301</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Totals Table */}
          <div className="w-72 space-y-1.5 p-3.5 rounded-xl bg-zinc-50 border border-zinc-300 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Gross Invoiced:</span>
              <span className="font-mono font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Special Discount:</span>
                <span className="font-mono text-rose-600">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>Sales Tax / PRA:</span>
              <span className="font-mono text-zinc-500">Included / 0%</span>
            </div>
            <div className="flex justify-between font-bold text-base text-zinc-900 border-t-2 border-zinc-900 pt-2 mt-1">
              <span>Net Payable:</span>
              <span className="font-mono text-purple-900">{formatCurrency(netPayable)}</span>
            </div>
          </div>
        </div>

        {/* Commercial Conditions & Warranty */}
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[10px] text-zinc-600 space-y-1">
          <span className="font-bold text-zinc-800 uppercase tracking-wide block">
            Warranty & Official Terms:
          </span>
          <p>
            • All workmanship, installation, and repair services are backed by Workman Services 30-Day Quality Assurance Guarantee.
          </p>
          <p>
            • Installed genuine HVAC spare parts carry standard manufacturer defect warranty from invoice date.
          </p>
          <p>
            • This is an electronically generated official sales tax invoice issued by Workman Services ERP Core under FBR / PRA compliance rules.
          </p>
        </div>

        {/* Official Signature Blocks */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
              Operations Billing Desk
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Prepared By
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-700 font-semibold">
              Fatima Noor
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Audited by Finance
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-900 font-bold">
              Haris Qureshi
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Authorized Signatory (MD)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
