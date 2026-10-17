"use client";

import React, { useRef } from "react";
import { Printer } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, formatJobType } from "@/lib/utils";
import { printDocument } from "@/lib/printUtils";
import { parseJobRemarks } from "@/components/jobs/JobRemarksCard";
import CompanyLetterhead from "@/components/company/CompanyLetterhead";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

interface WorkOrderDocumentProps {
  job: any;
  onClose?: () => void;
}

export default function WorkOrderDocument({ job, onClose }: WorkOrderDocumentProps) {
  const docRef = useRef<HTMLDivElement>(null);
  const { legalName, displayName } = useCompanyProfile();

  if (!job) return null;

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

  const parsedRemarks = parseJobRemarks(job.remarks);

  const handlePrint = () => {
    if (docRef.current) {
      printDocument(docRef.current, `Work_Order_${job.jobNumber}`);
    } else {
      printDocument("#printable-work-order", `Work_Order_${job.jobNumber}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar (Hidden during print) */}
      <div className="no-print flex items-center justify-between p-3 bg-zinc-100 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-800">Work Order Technical Sheet</span>
          <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
            #{job.jobNumber}
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
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Work Order Container */}
      <div
        ref={docRef}
        id="printable-work-order"
        className="printable-document p-8 bg-white border border-zinc-300 rounded-2xl shadow-sm text-xs text-zinc-800 font-sans space-y-6"
      >
        {/* Letterhead Header */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-5">
          <CompanyLetterhead qualifier="HVAC Engineering & Maintenance Operations" />

          <div className="text-right">
            <div className="text-xl font-black font-mono text-zinc-900 tracking-wider">
              FIELD WORK ORDER
            </div>
            <div className="text-sm font-mono font-bold text-[#0D7A5F] mt-0.5">
              #{job.jobNumber}
            </div>
            {job.manualJobNumber && (
              <div className="text-[10px] font-mono text-zinc-500">
                Manual Reference: {job.manualJobNumber}
              </div>
            )}
            <div className="text-[10px] font-mono text-zinc-600 mt-1">
              Date: {formatDate(new Date(job.createdAt))}
            </div>
            <div className="mt-1">
              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-300">
                STATUS: {job.status?.toUpperCase() || "ACTIVE"}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Execution Overview */}
        <div className="grid grid-cols-2 gap-5">
          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60 space-y-1">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Customer & Service Location
            </span>
            <div className="font-bold text-sm text-zinc-900">
              {job.customer?.name || "Client Record"}
            </div>
            <div className="text-zinc-700">
              Address: {job.customer?.addressText || "On-site Client Location"}
            </div>
            <div className="text-zinc-600 font-mono">
              Contact: {job.customer?.phone || "—"}
            </div>
            {job.isFoc && (
              <div className="text-[11px] text-purple-900 font-bold bg-purple-50 border border-purple-200 p-1.5 rounded mt-1">
                FREE OF CHARGE (FOC): Customer Payable = PKR 0. Billed to {job.careOfParty?.companyName || "Principal Partner"}.
              </div>
            )}
            {job.careOfParty && (
              <div className="text-[11px] text-purple-900 font-medium pt-1 border-t border-zinc-200">
                Care-Of: {job.careOfParty.companyName} ({job.careOfParty.personName})
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60 space-y-1">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Technical Execution Details
            </span>
            <div>
              <span className="font-semibold text-zinc-800">Job Scope:</span>{" "}
              <span>{formatJobType(job.jobType) || "HVAC Maintenance & Service"}</span>
            </div>
            <div>
              <span className="font-semibold text-zinc-800">Assigned Tech:</span>{" "}
              <span className="font-bold text-zinc-900">{job.assignedTechnician?.name || "Engineering Field Team"}</span>
              {job.assignedTechnician?.phone && (
                <span className="font-mono text-zinc-600"> ({job.assignedTechnician.phone})</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-zinc-800">Created:</span>{" "}
              <span className="font-mono">{formatDateTime(job.createdAt)}</span>
            </div>
            {job.completedAt && (
              <div>
                <span className="font-semibold text-zinc-800">Completed:</span>{" "}
                <span className="font-mono text-emerald-800 font-bold">{formatDateTime(job.completedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* HVAC Equipment Specifications */}
        {((parsedRemarks.equipments && parsedRemarks.equipments.length > 0) || parsedRemarks.equipment) && (
          <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-300 space-y-2">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-600 block">
              Diagnosed HVAC Equipment Units:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {parsedRemarks.equipments && parsedRemarks.equipments.length > 0 ? (
                parsedRemarks.equipments.map((eq: any, i: number) => (
                  <div key={i} className="p-2.5 bg-white rounded-lg border border-zinc-200">
                    <div className="font-bold text-zinc-900 flex justify-between">
                      <span>{eq.type}</span>
                      {eq.quantity && eq.quantity > 1 && <span>× {eq.quantity} units</span>}
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Brand: <strong>{eq.brand || "Standard"}</strong> {eq.model && `• Model: ${eq.model}`}
                    </div>
                    {eq.total !== undefined && eq.total > 0 && (
                      <div className="text-[11px] font-mono font-bold text-[#0D7A5F] mt-0.5">
                        Charge: {formatCurrency(eq.total)}
                      </div>
                    )}
                  </div>
                ))
              ) : parsedRemarks.equipment ? (
                <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                  <div className="font-bold text-zinc-900">{parsedRemarks.equipment.type}</div>
                  <div className="text-[11px] text-zinc-600 mt-0.5">
                    Brand: <strong>{parsedRemarks.equipment.brand || "Standard"}</strong> {parsedRemarks.equipment.model && `• Model: ${parsedRemarks.equipment.model}`}
                  </div>
                </div>
              ) : null}
            </div>
            {parsedRemarks.primaryDiagnosis && (
              <div className="text-xs pt-1 text-zinc-700">
                <strong>Diagnosis:</strong> {parsedRemarks.primaryDiagnosis}
              </div>
            )}
            {parsedRemarks.fieldExecution && (
              <div className="text-xs text-zinc-700">
                <strong>Field Notes:</strong> {parsedRemarks.fieldExecution}
              </div>
            )}
          </div>
        )}

        {/* Billable Items & Deliverables Table */}
        <div className="border border-zinc-300 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Deliverable Scope / Spare Part</th>
                <th className="py-2.5 px-3 text-right">Planned</th>
                <th className="py-2.5 px-3 text-right">Actual Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Rate</th>
                <th className="py-2.5 px-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {job.items && job.items.length > 0 ? (
                job.items.map((it: any, idx: number) => {
                  const qty =
                    it.quantityActual !== null && it.quantityActual !== undefined
                      ? it.quantityActual
                      : it.quantityPlanned;
                  const lineTotal = qty * it.unitRate;
                  return (
                    <tr key={it.id || idx}>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900">{it.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-500">
                        {it.quantityPlanned} {it.unit || "unit"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
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
                  <td className="py-2.5 px-3 font-bold text-zinc-900">Standard Service & Inspection</td>
                  <td className="py-2.5 px-3 text-right font-mono">1</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">1</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(subtotal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{formatCurrency(subtotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals & Financial Settlement */}
        <div className="flex justify-between items-start pt-2">
          <div className="text-xs text-zinc-600 max-w-sm space-y-1">
            <span className="font-bold text-zinc-800 block text-[10px] uppercase">
              Service Guarantee & Terms:
            </span>
            <p>• All workmanship backed by {displayName || "Workman Services"} 30-Day Quality Assurance Guarantee.</p>
            <p>• Genuine spare parts carry manufacturer warranty from installation date.</p>
          </div>

          <div className="w-72 p-3.5 rounded-xl bg-zinc-50 border border-zinc-300 text-xs space-y-1.5">
            <div className="flex justify-between text-zinc-600">
              <span>Gross Total:</span>
              <span className="font-mono font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Special Discount:</span>
                <span className="font-mono text-rose-600">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-zinc-900 border-t-2 border-zinc-900 pt-2 mt-1">
              <span>Net Payable:</span>
              <span className="font-mono text-[#0D7A5F]">{formatCurrency(netPayable)}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-700 font-semibold">
              Operations Dispatch
            </div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase">Issued By</span>
          </div>
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-900 font-bold">
              {job.assignedTechnician?.name || "Field Team"}
            </div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase">Technician Signature</span>
          </div>
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
              Customer Signature
            </div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase">Customer Acceptance</span>
          </div>
        </div>

        {/* Document Footer Digital Footprint */}
        <div className="pt-4 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
          <span>Electronic Work Order: WMS-{job.jobNumber}</span>
          <span>
            Powered by{" "}
            <a
              href="https://omnysync.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-[#0D7A5F] underline font-semibold transition-colors"
            >
              OmnySync
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
