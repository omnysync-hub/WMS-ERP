"use client";

import React, { useRef } from "react";
import { Flame, Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { printDocument } from "@/lib/printUtils";

interface GoodsReceiptDocumentProps {
  grn: any;
  onClose?: () => void;
}

export default function GoodsReceiptDocument({
  grn,
  onClose,
}: GoodsReceiptDocumentProps) {
  const docRef = useRef<HTMLDivElement>(null);
  if (!grn) return null;

  const totalDelivered = (grn.items || []).reduce(
    (sum: number, it: any) => sum + (it.quantityReceived || 0),
    0
  );
  const totalAccepted = (grn.items || []).reduce(
    (sum: number, it: any) => sum + (it.quantityAccepted || 0),
    0
  );
  const totalRejected = (grn.items || []).reduce(
    (sum: number, it: any) => sum + (it.quantityRejected || 0),
    0
  );

  const handlePrint = () => {
    if (docRef.current) {
      printDocument(docRef.current, `Goods_Receipt_Note_${grn.grnNumber}`);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar (Hidden during print) */}
      <div className="no-print flex items-center justify-between p-3 bg-zinc-100 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-700">Official Goods Receipt Note View</span>
          <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
            {grn.grnNumber}
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
        id="printable-goods-receipt-note"
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
                NTN: 9482710-3 • STRN: 3277876123456 • Central Stores QA
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-black font-mono text-zinc-900 tracking-wider">
              GOODS RECEIPT NOTE
            </div>
            <div className="text-xs font-mono font-bold text-[#0D7A5F] mt-0.5">
              {grn.grnNumber}
            </div>
            <div className="text-[10px] font-mono text-zinc-600 mt-1">
              Receipt Date: {formatDate(grn.receivedDate || grn.createdAt)}
            </div>
            <div className="text-[10px] font-mono text-zinc-600">
              PO Ref: <strong className="text-zinc-900">{grn.po?.poNumber || "Direct Shipment"}</strong>
            </div>
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                QA INSPECTED & ACCEPTED
              </span>
            </div>
          </div>
        </div>

        {/* Vendor & Receiving Metadata */}
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Vendor / Consignor Details
            </span>
            <div className="font-bold text-sm text-zinc-900">
              {grn.po?.supplierName || grn.supplierName || "Commercial Supplier"}
            </div>
            <div className="text-zinc-600 mt-0.5">
              Delivery Challan / Bilty:{" "}
              <strong className="font-mono text-zinc-900">
                {grn.deliveryChallan || grn.challanNumber || "DC-ATTACHED"}
              </strong>
            </div>
            <div className="text-zinc-600 mt-0.5">
              Associated Purchase Order: <span className="font-mono font-semibold">{grn.po?.poNumber || "—"}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/60">
            <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
              Warehouse Inward & Custody
            </span>
            <div>
              <span className="font-semibold text-zinc-800">Storage Location:</span>{" "}
              <span>{grn.warehouseLocation || "Central Warehouse, Gulberg III, Lahore"}</span>
            </div>
            <div className="mt-0.5">
              <span className="font-semibold text-zinc-800">Received By:</span>{" "}
              <strong className="text-zinc-900">{grn.receivedBy || "Bilal Sheikh (Storekeeper)"}</strong>
            </div>
            <div className="mt-0.5 text-zinc-600">
              Inspection Status: <span className="font-bold text-emerald-800">100% Physical Count Verified</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-zinc-300 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item Description & Specifications</th>
                <th className="py-2.5 px-3">Batch / Serial Info</th>
                <th className="py-2.5 px-3 text-right">Delivered</th>
                <th className="py-2.5 px-3 text-right">Accepted</th>
                <th className="py-2.5 px-3 text-right">Rejected</th>
                <th className="py-2.5 px-3 text-center">QA Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {(grn.items || []).map((it: any, idx: number) => (
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
                  <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-600">
                    {it.batchNumber ? `Batch: ${it.batchNumber}` : "Standard Lot"}
                    {it.serialNumber ? ` • S/N: ${it.serialNumber}` : ""}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                    {it.quantityReceived} {it.unit || "unit"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                    {it.quantityAccepted}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                    {it.quantityRejected > 0 ? it.quantityRejected : "0"}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        (it.quantityRejected || 0) > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {(it.quantityRejected || 0) > 0 ? "PARTIAL" : "PASSED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quantities Summary */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 p-3 rounded-xl bg-zinc-50 border border-zinc-300 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Total Received Units:</span>
              <span className="font-mono font-bold text-zinc-900">{totalDelivered}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Accepted to Stock:</span>
              <span className="font-mono font-bold">{totalAccepted}</span>
            </div>
            {totalRejected > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Rejected / Quarantined:</span>
                <span className="font-mono font-bold">-{totalRejected}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xs text-zinc-900 border-t border-zinc-300 pt-1.5">
              <span>Net Inwarded:</span>
              <span className="font-mono text-[#0D7A5F]">{totalAccepted} Units</span>
            </div>
          </div>
        </div>

        {/* Storekeeper Inspection Certification */}
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[10px] text-zinc-600 space-y-1">
          <span className="font-bold text-zinc-800 uppercase tracking-wide block">
            Quality & Inventory Endorsement:
          </span>
          <p>
            • The goods detailed above have been physically inspected, counted, and verified against Delivery Challan and PO specifications.
          </p>
          <p>
            • Accepted quantities are now posted to physical stock balances and eligible for 3-Way Match payment auditing.
          </p>
        </div>

        {/* Signature Blocks */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-800 font-semibold">
              {grn.receivedBy || "Bilal Sheikh"}
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Storekeeper / Receiver
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
              Technical Inspector
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Quality Assurance (QA)
            </span>
          </div>

          <div>
            <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-900 font-bold">
              Fatima Noor
            </div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase">
              Accounts Verification
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
