"use client";

import React, { useState } from "react";
import {
  PackageCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building,
  Layers,
  ArrowRight,
  ShieldCheck,
  Warehouse,
  Eye,
  Hash,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface GoodsReceiptTabProps {
  grns: any[];
  pos: any[];
  onRefresh: () => void;
  presetPoForGrn?: any | null;
}

export default function GoodsReceiptTab({
  grns,
  pos,
  onRefresh,
  presetPoForGrn,
}: GoodsReceiptTabProps) {
  const { currentRole } = useRole();
  const isStorekeeper = currentRole === "storekeeper";
  const [search, setSearch] = useState("");
  const [qualityFilter, setQualityFilter] = useState("all");

  // Create GRN Modal State
  const [showCreateModal, setShowCreateModal] = useState(Boolean(presetPoForGrn));
  const [selectedPoId, setSelectedPoId] = useState<string>(presetPoForGrn?.id || "");
  const [receivedBy, setReceivedBy] = useState("Bilal Sheikh (Storekeeper)");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [warehouseLocation, setWarehouseLocation] = useState("Central Warehouse - Lahore");
  const [deliveryChallan, setDeliveryChallan] = useState("");
  const [notes, setNotes] = useState("");

  // Line items state for GRN
  const [receiptItems, setReceiptItems] = useState<
    {
      poItemId: string;
      description: string;
      unit: string;
      orderedQty: number;
      alreadyReceivedQty: number;
      quantityReceived: number;
      qualityStatus: "Accepted" | "Rejected" | "Hold";
      rejectionReason: string;
      batchNumber: string;
      serialNumber: string;
      expiryDate: string;
      unitCost: number;
    }[]
  >([]);

  // Selected GRN details modal
  const [viewingGrn, setViewingGrn] = useState<any | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handlePoSelect = (poId: string) => {
    setSelectedPoId(poId);
    const po = pos.find((p) => p.id === poId);
    if (po && po.items) {
      setDeliveryChallan(`DC-${po.supplierName?.slice(0, 3)?.toUpperCase()}-${Date.now().toString().slice(-4)}`);
      setReceiptItems(
        po.items.map((it: any) => {
          const remaining = Math.max(0, it.quantity - (it.quantityReceived || 0));
          return {
            poItemId: it.id,
            description: it.description,
            unit: it.unit || "unit",
            orderedQty: it.quantity,
            alreadyReceivedQty: it.quantityReceived || 0,
            quantityReceived: remaining, // default to remaining
            qualityStatus: "Accepted",
            rejectionReason: "",
            batchNumber: "",
            serialNumber: "",
            expiryDate: "",
            unitCost: it.unitCost || 0,
          };
        })
      );
    } else {
      setReceiptItems([]);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...receiptItems];
    (updated[index] as any)[field] = value;
    setReceiptItems(updated);
  };

  const totalAcceptedValue = receiptItems.reduce((sum, it) => {
    if (it.qualityStatus === "Accepted") {
      return sum + (Number(it.quantityReceived) || 0) * it.unitCost;
    }
    return sum;
  }, 0);

  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      setFormError("Please select a Purchase Order.");
      return;
    }

    if (receiptItems.every((it) => (Number(it.quantityReceived) || 0) <= 0)) {
      setFormError("Please enter received quantity greater than zero for at least one item.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const itemsPayload = receiptItems
        .filter((it) => (Number(it.quantityReceived) || 0) > 0)
        .map((it) => ({
          poItemId: it.poItemId,
          quantityReceived: Number(it.quantityReceived),
          quantityAccepted: it.qualityStatus === "Accepted" ? Number(it.quantityReceived) : 0,
          quantityRejected: it.qualityStatus === "Rejected" ? Number(it.quantityReceived) : 0,
          qualityStatus: it.qualityStatus,
          rejectionReason: it.rejectionReason || undefined,
          batchNumber: it.batchNumber || undefined,
          serialNumber: it.serialNumber || undefined,
          expiryDate: it.expiryDate || undefined,
        }));

      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_grn",
          poId: selectedPoId,
          receivedBy,
          receivedDate,
          warehouseLocation,
          deliveryChallan,
          qualityStatus: receiptItems.some((i) => i.qualityStatus === "Rejected")
            ? "Rejected"
            : receiptItems.some((i) => i.qualityStatus === "Hold")
            ? "Hold"
            : "Accepted",
          notes,
          items: itemsPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create GRN");
      }

      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to process Goods Receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGrns = grns.filter((g) => {
    const matchQuality = qualityFilter === "all" || g.qualityStatus === qualityFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      g.grnNumber?.toLowerCase().includes(q) ||
      g.po?.poNumber?.toLowerCase().includes(q) ||
      g.po?.supplierName?.toLowerCase().includes(q) ||
      g.warehouseLocation?.toLowerCase().includes(q);
    return matchQuality && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative min-w-[280px] max-w-md">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search GRN #, PO #, supplier, warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Quality Statuses</option>
            <option value="Accepted">Accepted (QA Passed)</option>
            <option value="Rejected">Rejected</option>
            <option value="Hold">Hold / Quarantine</option>
          </select>
        </div>

        <button
          onClick={() => {
            const firstPo = pos.find(
              (p) => p.status === "sent_to_vendor" || p.status === "partially_received" || p.status === "approved"
            );
            if (firstPo) handlePoSelect(firstPo.id);
            setShowCreateModal(true);
            setFormError("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Receive Goods Note (GRN)
        </button>
      </div>

      {/* GRN Table */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">GRN Number & Date</th>
                <th className="py-3 px-3">Purchase Order Ref</th>
                <th className="py-3 px-3">Supplier Name</th>
                <th className="py-3 px-3">Warehouse Location</th>
                <th className="py-3 px-3">Delivery Challan</th>
                <th className="py-3 px-3">Received Items</th>
                <th className="py-3 px-3 text-center">Quality Status</th>
                <th className="py-3 px-3">Accounting GL Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredGrns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#A1A1AA]">
                    No Goods Receipt Notes found. Receive physical materials from an issued Purchase Order.
                  </td>
                </tr>
              ) : (
                filteredGrns.map((grn) => {
                  const itemsCount = grn.items?.length || 0;
                  const totalQty = (grn.items || []).reduce(
                    (s: number, i: any) => s + (i.quantityReceived || 0),
                    0
                  );

                  return (
                    <tr
                      key={grn.id}
                      className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                      onClick={() => setViewingGrn(grn)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors">
                          {grn.grnNumber}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] font-mono">
                          {new Date(grn.receivedDate || grn.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-semibold text-[#0D7A5F]">
                        {grn.po?.poNumber || "Direct PO"}
                      </td>

                      <td className="py-3 px-3 font-medium text-[#18181B]">
                        {grn.po?.supplierName || "—"}
                      </td>

                      <td className="py-3 px-3 text-[#71717A]">
                        <div className="flex items-center gap-1.5">
                          <Warehouse className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {grn.warehouseLocation || "Central Warehouse"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-[#18181B]">
                        {grn.deliveryChallan || "—"}
                      </td>

                      <td className="py-3 px-3 font-mono text-[#18181B]">
                        {itemsCount} item(s) • <strong className="text-[#18181B]">{totalQty} units</strong>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono",
                            grn.qualityStatus === "Accepted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : grn.qualityStatus === "Hold"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {grn.qualityStatus || "Accepted"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11px]">
                        {grn.accountingJournalId ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-mono text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dr 1200 / Cr 2050
                          </span>
                        ) : (
                          <span className="text-[#71717A] font-mono text-[10px]">
                            Posted to GL
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingGrn(grn);
                          }}
                          className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Goods Note (GRN) Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
                  Inward Goods Receipt Note (GRN)
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Physical Count, Quality Inspection & Automated GR/IR Clearing Posting
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* PO Selection & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Select Purchase Order *
                  </label>
                  <select
                    required
                    value={selectedPoId}
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose Purchase Order --</option>
                    {pos
                      .filter(
                        (p) =>
                          p.status === "sent_to_vendor" ||
                          p.status === "partially_received" ||
                          p.status === "approved"
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.poNumber} — {p.supplierName} ({p.items?.length} items)
                          {!isStorekeeper ? ` - Value: ${formatCurrency(p.totalAmount)}` : ""}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Warehouse / Storage Location *
                  </label>
                  <select
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Central Warehouse - Lahore">Central Warehouse - Lahore</option>
                    <option value="Karachi Distribution Depot">Karachi Distribution Depot</option>
                    <option value="Islamabad Regional Store">Islamabad Regional Store</option>
                    <option value="Field Tech Holding Bin">Field Tech Holding Bin</option>
                  </select>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Received By (Storekeeper) *
                  </label>
                  <input
                    type="text"
                    required
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Delivery Challan # (Vendor DC)
                  </label>
                  <input
                    type="text"
                    value={deliveryChallan}
                    onChange={(e) => setDeliveryChallan(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="DC-10928"
                  />
                </div>
              </div>

              {/* Items Verification Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Verify Inward Physical Quantities & Quality Inspection ({receiptItems.length})
                </span>

                {receiptItems.length === 0 ? (
                  <div className="p-4 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl text-center text-[#71717A] text-xs">
                    Please select a Purchase Order above to populate receipt line items.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {receiptItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDEDED] pb-2">
                          <div>
                            <div className="font-bold text-[#18181B]">{it.description}</div>
                            <div className="text-[10px] font-mono text-[#71717A]">
                              Ordered: {it.orderedQty} {it.unit} • Already Received: {it.alreadyReceivedQty} {it.unit}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#71717A]">
                              QA Status:
                            </span>
                            <select
                              value={it.qualityStatus}
                              onChange={(e) =>
                                handleItemChange(idx, "qualityStatus", e.target.value)
                              }
                              className={cn(
                                "border text-xs rounded px-2 py-0.5 font-bold outline-none",
                                it.qualityStatus === "Accepted"
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                  : it.qualityStatus === "Hold"
                                  ? "bg-amber-50 border-amber-300 text-amber-700"
                                  : "bg-rose-50 border-rose-300 text-rose-700"
                              )}
                            >
                              <option value="Accepted">Accepted</option>
                              <option value="Rejected">Rejected</option>
                              <option value="Hold">Hold / Quarantine</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                          <div>
                            <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                              Quantity Inward (Receiving) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={it.orderedQty - it.alreadyReceivedQty}
                              step="any"
                              required
                              value={it.quantityReceived}
                              onChange={(e) =>
                                handleItemChange(idx, "quantityReceived", Number(e.target.value))
                              }
                              className="w-full bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs text-[#18181B] font-mono font-bold focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                              Batch / Lot Number
                            </label>
                            <input
                              type="text"
                              value={it.batchNumber}
                              onChange={(e) =>
                                handleItemChange(idx, "batchNumber", e.target.value)
                              }
                              className="w-full bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs text-[#18181B] font-mono"
                              placeholder="e.g. B-2026-X"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                              Serial Number(s)
                            </label>
                            <input
                              type="text"
                              value={it.serialNumber}
                              onChange={(e) =>
                                handleItemChange(idx, "serialNumber", e.target.value)
                              }
                              className="w-full bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs text-[#18181B] font-mono"
                              placeholder="SR-001928"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                              Expiry Date (if applicable)
                            </label>
                            <input
                              type="date"
                              value={it.expiryDate}
                              onChange={(e) =>
                                handleItemChange(idx, "expiryDate", e.target.value)
                              }
                              className="w-full bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs text-[#18181B] font-mono"
                            />
                          </div>
                        </div>

                        {it.qualityStatus === "Rejected" && (
                          <div className="pt-1">
                            <label className="block text-[10px] font-mono text-rose-700 mb-0.5">
                              Rejection Reason / Defect Specification *
                            </label>
                            <input
                              type="text"
                              required
                              value={it.rejectionReason}
                              onChange={(e) =>
                                handleItemChange(idx, "rejectionReason", e.target.value)
                              }
                              className="w-full bg-white border border-rose-300 rounded px-2.5 py-1 text-xs text-rose-800"
                              placeholder="Physical damage to fins / low pressure seal broken..."
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LIVE ACCOUNTING POSTING PREVIEW */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                  Double-Entry Accounting Posting Engine (Automated)
                </div>
                {isStorekeeper ? (
                  <div className="font-mono text-[11px] text-[#71717A] bg-white/70 p-2 rounded border border-emerald-100">
                    <span className="text-emerald-700 font-semibold">✓ Automated Stock Ledger & GR/IR Clearing:</span> Financial valuations and unit costs are masked for Storekeeper. Ledger posting will post automatically in background.
                  </div>
                ) : (
                  <div className="font-mono text-[11px] text-[#18181B] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Debit: 1200 Merchandise Inventory Asset (+Asset)</span>
                      <strong className="text-[#18181B]">{formatCurrency(totalAcceptedValue)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Credit: 2050 GR/IR Clearing Account (+Unbilled Liability)</span>
                      <strong className="text-[#18181B]">{formatCurrency(totalAcceptedValue)}</strong>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-[#71717A] pt-1 border-t border-emerald-200">
                  Physical stock will be immediately incremented in Warehouse. Unbilled receipt cleared upon 3-Way Match.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || receiptItems.length === 0}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Receiving..." : "Post Goods Receipt & Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing GRN Details Modal */}
      {viewingGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
                  {viewingGrn.grnNumber} • Goods Receipt Note
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Under PO {viewingGrn.po?.poNumber} ({viewingGrn.po?.supplierName})
                </p>
              </div>
              <button
                onClick={() => setViewingGrn(null)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#EDEDED]">
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Received Date</span>
                  <span className="font-semibold text-[#18181B]">
                    {new Date(viewingGrn.receivedDate || viewingGrn.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Received By</span>
                  <span className="font-semibold text-[#18181B]">{viewingGrn.receivedBy}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Warehouse Location</span>
                  <span className="font-semibold text-[#18181B]">{viewingGrn.warehouseLocation}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Delivery Challan</span>
                  <span className="font-semibold text-[#18181B] font-mono">{viewingGrn.deliveryChallan || "—"}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Received Line Items ({viewingGrn.items?.length || 0})
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Received</th>
                        <th className="py-2 px-3 text-right">Accepted</th>
                        <th className="py-2 px-3 text-right">Rejected</th>
                        <th className="py-2 px-3 text-center">QA Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {viewingGrn.items?.map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#18181B]">{it.description}</div>
                            {it.batchNumber && (
                              <span className="text-[10px] font-mono text-[#71717A]">
                                Batch: {it.batchNumber} {it.serialNumber ? `• SN: ${it.serialNumber}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.quantityReceived} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                            {it.quantityAccepted}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                            {it.quantityRejected}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono",
                                it.qualityStatus === "Accepted"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {it.qualityStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#EDEDED]">
                <button
                  onClick={() => setViewingGrn(null)}
                  className="px-4 py-1.5 bg-white hover:bg-[#F4F4F5] text-[#18181B] border border-[#D4D4D8] rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
