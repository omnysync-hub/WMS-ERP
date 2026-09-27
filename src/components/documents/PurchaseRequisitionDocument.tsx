"use client";

import React, { useRef } from "react";
import { Flame, Printer } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { printDocument } from "@/lib/printUtils";

interface PurchaseRequisitionDocumentProps {
  pr: any;
  onClose?: () => void;
  hideCosts?: boolean;
}

export default function PurchaseRequisitionDocument({
  pr,
  onClose,
  hideCosts = false,
}: PurchaseRequisitionDocumentProps) {
  const docRef = useRef<HTMLDivElement>(null);
  if (!pr) return null;

  const totalEstimatedCost = (pr.items || []).reduce(
    (sum: number, it: any) => sum + (it.quantity || 0) * (it.estimatedPrice || it.unitPrice || 0),
    0
  );

  const handlePrint = () => {
    if (docRef.current) {
      printDocument(docRef.current, `Purchase_Requisition_${pr.prNumber}`);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar (Hidden during print) */}
      <div className="no-print flex items-center justify-between p-3 bg-zinc-100 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700">Official Purchase Requisition View</span>
          <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
            {pr.prNumber}
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
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Document Container */}
      <div
        ref={docRef}
        id="printable-purchase-requisition"
        className="printable-document p-8 bg-white border border-zinc-300 rounded-2xl shadow-sm text-xs text-zinc-800 font-sans space-y-6"
      >
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
                NTN: 9482710-3 • STRN: 3277876123456 • FBR Registered
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-black font-mono text-zinc-900 tracking-wider">
              PURCHASE REQUISITION
            </div>
            <div className="text-xs font-mono font-bold text-[#0D7A5F] mt-0.5">
              {pr.prNumber}
            </div>
            <div className="text-[10px] font-mono text-zinc-600 mt-1">
              Date: {formatDate(pr.createdAt || new Date())}
            </div>
            <div className="text-[10px] font-mono text-zinc-600">
              Priority: <strong className="uppercase">{pr.priority || "Normal"}</strong>
            </div>
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-300 uppercase">
                Status: {pr.status}
              </span>
            </div>
          </div>
        </div>

        {/* Requisition Origin & Purpose Blocks */}
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Requisition Origin & Department
            </span>
            <div className="font-bold text-sm text-zinc-900">
              {pr.requestedBy}
            </div>
            <div className="text-zinc-600 mt-0.5">
              Department: <strong className="text-zinc-800">{pr.department || "Operations & Field Services"}</strong>
            </div>
            <div className="text-zinc-600">
              Site / Project: <strong className="text-zinc-800">{pr.site || "Central Engineering Hub, Lahore"}</strong>
            </div>
            {pr.job && (
              <div className="text-zinc-600 mt-0.5">
                Linked Work Order: <span className="font-mono font-bold text-zinc-900">#{pr.job.jobNumber}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Operational Justification & Schedule
            </span>
            <div>
              <span className="font-semibold text-zinc-800">Required By Date:</span>{" "}
              <span className="font-mono">{pr.requiredDate ? formatDate(pr.requiredDate) : "Immediate / Next Batch"}</span>
            </div>
            <div className="text-zinc-600 mt-1">
              <span className="font-semibold text-zinc-800">Justification:</span>{" "}
              <span>{pr.justification || pr.notes || "Replenishment for HVAC service execution and technical repairs."}</span>
            </div>
            {pr.suggestedVendor && (
              <div className="text-zinc-600 mt-1">
                <span className="font-semibold text-zinc-800">Suggested Vendor:</span>{" "}
                <span>{pr.suggestedVendor}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-zinc-300 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item Specification / Description</th>
                <th className="py-2.5 px-3">Delivery Site</th>
                <th className="py-2.5 px-3 text-right">Requested Qty</th>
                {!hideCosts && <th className="py-2.5 px-3 text-right">Est. Unit Rate</th>}
                {!hideCosts && <th className="py-2.5 px-3 text-right">Est. Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {(pr.items || []).map((it: any, idx: number) => {
                const estPrice = it.estimatedPrice || it.unitPrice || 0;
                const lineTotal = (it.quantity || 0) * estPrice;
                return (
                  <tr key={it.id || idx}>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-900">{it.description}</div>
                      {it.itemCode && (
                        <span className="font-mono text-[10px] text-zinc-500">
                          Part #: {it.itemCode}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 text-[11px]">
                      {it.deliverySite || pr.site || "Central Warehouse"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {it.quantity} {it.unit || "unit"}
                    </td>
                    {!hideCosts && (
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                        {estPrice > 0 ? formatCurrency(estPrice) : "—"}
                      </td>
                    )}
                    {!hideCosts && (
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                        {lineTotal > 0 ? formatCurrency(lineTotal) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Budget Allocation Summary */}
        {!hideCosts && totalEstimatedCost > 0 && (
          <div className="flex justify-end">
            <div className="w-72 space-y-1.5 p-3 rounded-xl bg-zinc-50 border border-zinc-300 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Estimated Requisition Value:</span>
                <span className="font-mono font-semibold">{formatCurrency(totalEstimatedCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-zinc-900 border-t border-zinc-300 pt-1.5">
                <span>Budget Allocation Request:</span>
                <span className="font-mono text-[#0D7A5F]">{formatCurrency(totalEstimatedCost)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions / Internal Policy */}
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[10px] text-zinc-600 space-y-1">
          <span className="font-bold text-zinc-800 uppercase tracking-wide block">
            Procurement & Audit Guidelines:
          </span>
          <p>
            • Purchase Requisitions require verification against current inventory balances prior to RFQ or PO issuance.
          </p>
          <p>
            • Once approved, this requisition authorizes the procurement team to initiate commercial vendor negotiations.
          </p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-700 font-semibold">
              {pr.requestedBy}
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Requisitioner
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
              {pr.status === "approved" ? "Fatima Noor (Accounts)" : "Pending Review"}
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Budget Verified
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-900 font-bold">
              {pr.status === "approved" ? "Haris Qureshi (MD)" : "Pending Approval"}
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Authorized Signatory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
