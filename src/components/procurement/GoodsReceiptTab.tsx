"use client";

import React, { useState, useEffect } from "react";
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
  Warehouse,
  Eye,
  Hash,
  Printer,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import {
  ProcurementEmptyState,
  ProcurementStatusBadge,
} from "@/components/procurement/procurementUi";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import GoodsReceiptDocument from "@/components/documents/GoodsReceiptDocument";
import { printDocument } from "@/lib/printUtils";

import { useRole } from "@/contexts/RoleContext";
import { procurementActorHeaders } from "@/lib/procurementClient";

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
  const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();
  const canCreateGrn = hasPermission("procurement.grn.create");
  const isStorekeeper = currentRole === "storekeeper";
  const [search, setSearch] = useState("");

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
  // Selected GRN for Printable Document View
  const [printableGrn, setPrintableGrn] = useState<any | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [viewingPoDrawer, setViewingPoDrawer] = useState<any | null>(null);

  /** Open POs with remaining qty — GRN is always against a PO */
  const openPosForReceipt = pos.filter((p) => {
    const st = (p.status || "").toLowerCase();
    if (["cancelled", "canceled", "closed", "draft"].includes(st)) return false;
    if (!["approved", "sent_to_vendor", "partially_received", "sent"].includes(st) && st !== "approved") {
      // still allow if any line has remaining
    }
    const items = p.items || [];
    const hasRemaining = items.some(
      (it: any) => Math.max(0, (it.quantity || 0) - (it.quantityReceived || 0)) > 0
    );
    return hasRemaining && !["cancelled", "canceled", "closed", "draft"].includes(st);
  });

  const handlePoSelect = (poId: string) => {
    setSelectedPoId(poId);
    const po = pos.find((p) => p.id === poId);
    if (po && po.items) {
      setDeliveryChallan(`DC-${po.supplierName?.slice(0, 3)?.toUpperCase()}-${Date.now().toString().slice(-4)}`);
      setReceiptItems(
        po.items
          .map((it: any) => {
            const remaining = Math.max(0, it.quantity - (it.quantityReceived || 0));
            return {
              poItemId: it.id,
              description: it.description,
              unit: it.unit || "unit",
              orderedQty: it.quantity,
              alreadyReceivedQty: it.quantityReceived || 0,
              quantityReceived: remaining,
              qualityStatus: "Accepted" as const,
              rejectionReason: "",
              batchNumber: "",
              serialNumber: "",
              expiryDate: "",
              unitCost: it.unitCost || 0,
            };
          })
          .filter((it: any) => it.quantityReceived > 0 || it.orderedQty > it.alreadyReceivedQty)
      );
    } else {
      setReceiptItems([]);
    }
  };

  useEffect(() => {
    if (presetPoForGrn?.id) {
      setShowCreateModal(true);
      handlePoSelect(presetPoForGrn.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPoForGrn?.id]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...receiptItems];
    (updated[index] as any)[field] = value;
    setReceiptItems(updated);
  };



  const handleCreateGrn = async (e: React.FormEvent) => {
    if (!canCreateGrn) { alert("Missing permission: procurement.grn.create"); return; }
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
          quantityAccepted: Number(it.quantityReceived),
          quantityRejected: 0,
          qualityStatus: "Accepted",
        }));

      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: procurementActorHeaders(activeRole || currentRole, currentPersona?.name || activeUser?.name, activeUser?.id),

        body: JSON.stringify({
          action: "create_grn",
          poId: selectedPoId,
          receivedBy,
          receivedDate,
          warehouseLocation,
          deliveryChallan,
          qualityStatus: "Accepted",
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
    const q = search.toLowerCase();
    return (
      !q ||
      g.grnNumber?.toLowerCase().includes(q) ||
      g.po?.poNumber?.toLowerCase().includes(q) ||
      g.po?.supplierName?.toLowerCase().includes(q) ||
      g.warehouseLocation?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative min-w-[280px] max-w-md">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search GRN #, PO #, supplier, warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>
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
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">GRN Number & Date</th>
                <th className="py-3 px-3">Purchase Order Ref</th>
                <th className="py-3 px-3">Supplier Name</th>
                <th className="py-3 px-3">Warehouse Location</th>
                <th className="py-3 px-3">Delivery Challan</th>
                <th className="py-3 px-3">Received Items</th>
                <th className="py-3 px-3">Accounting GL Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredGrns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <ProcurementEmptyState
                      title="No goods receipts yet"
                      description="Receive materials against an issued purchase order."
                    />
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintableGrn(grn);
                            }}
                            title="Print Formal Goods Receipt Note / PDF Preview"
                            className="p-1.5 rounded bg-white hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B] border border-[#D4D4D8] transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingGrn(grn);
                            }}
                            title="View Details"
                            className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
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
      <SideDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Inward Goods Receipt Note (GRN)
            </span>
          </div>
        }
        subtitle="Record physical inward delivery, inspect quantities, and update warehouse stock."
        width="max-w-3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span>
                Lines: <strong className="text-zinc-900 font-semibold">{receiptItems.filter((i) => (Number(i.quantityReceived) || 0) > 0).length}</strong> of {receiptItems.length}
              </span>
              <span className="text-zinc-300">•</span>
              <span>
                Total Units: <strong className="text-zinc-900 font-semibold">{receiptItems.reduce((acc, i) => acc + (Number(i.quantityReceived) || 0), 0)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-300 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-grn-form"
                disabled={isSubmitting || !selectedPoId || receiptItems.every((it) => (Number(it.quantityReceived) || 0) <= 0)}
                className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Receiving & Posting..." : "Post Inward Goods Receipt (GRN)"}
              </button>
            </div>
          </div>
        }
      >
        <form id="create-grn-form" onSubmit={handleCreateGrn} className="space-y-4 pb-6 text-[#18181B]">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {formError}
            </div>
          )}

          {/* PO Selection & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Purchase Order <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                required
                value={selectedPoId}
                onChange={(val) => handlePoSelect(val)}
                options={openPosForReceipt.map((p) => ({
                  value: p.id,
                  label: `${p.poNumber} — ${p.supplierName}`,
                  subLabel: `${(p.items || []).filter((it: any) => (it.quantity - (it.quantityReceived || 0)) > 0).length} line(s) remaining${!isStorekeeper ? ` · Val: ${formatCurrency(p.totalAmount)}` : ""}`,
                }))}
                placeholder="-- Select open PO with pending deliveries --"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Only open POs with undelivered lines are displayed.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Receiving Warehouse Location <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                value={warehouseLocation}
                onChange={(val) => setWarehouseLocation(val)}
                options={[
                  { value: "Central Warehouse - Lahore", label: "Central Warehouse - Lahore" },
                  { value: "Karachi Distribution Depot", label: "Karachi Distribution Depot" },
                  { value: "Islamabad Regional Store", label: "Islamabad Regional Store" },
                  { value: "Field Tech Holding Bin", label: "Field Tech Holding Bin" },
                ]}
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Designated physical storage location for inward stock update.
              </p>
            </div>
          </div>

          {/* Delivery & Inspection Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Received By (Storekeeper) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Vendor Delivery Challan #
              </label>
              <input
                type="text"
                value={deliveryChallan}
                onChange={(e) => setDeliveryChallan(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 font-mono focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs transition"
                placeholder="e.g. DC-UNI-8382"
              />
            </div>
          </div>

          {/* Items Verification Table */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-900">
                  Verify Inward Physical Quantities ({receiptItems.length})
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Specify the actual physical units counted at warehouse receiving dock.
                </p>
              </div>
              {receiptItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = receiptItems.map((it) => ({
                      ...it,
                      quantityReceived: Math.max(0, it.orderedQty - it.alreadyReceivedQty),
                    }));
                    setReceiptItems(updated);
                  }}
                  className="text-[11px] font-semibold text-[#0D7A5F] hover:text-[#0B6851] hover:underline"
                >
                  Receive All Remaining
                </button>
              )}
            </div>

            {receiptItems.length === 0 ? (
              <div className="p-8 bg-zinc-50 border border-zinc-200 border-dashed rounded-xl text-center text-zinc-500 text-xs space-y-1">
                <p className="font-medium text-zinc-700">No Purchase Order Selected</p>
                <p className="text-[11px]">Please select an open Purchase Order above to load items.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {receiptItems.map((it, idx) => {
                  const remaining = Math.max(0, it.orderedQty - it.alreadyReceivedQty);
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white hover:bg-zinc-50/70 border border-zinc-200 rounded-xl transition shadow-2xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-semibold text-zinc-900 text-xs truncate">
                            {it.description}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-mono">
                              Ordered: <strong className="text-zinc-800">{it.orderedQty} {it.unit}</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-mono">
                              Received: <strong className="text-zinc-800">{it.alreadyReceivedQty} {it.unit}</strong>
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md font-mono font-medium",
                                remaining > 0
                                  ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              )}
                            >
                              Remaining: {remaining} {it.unit}
                            </span>
                          </div>
                        </div>

                        {/* Inward Qty Input & Quick Fill */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center">
                            <label className="sr-only">Quantity Inward</label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min="0"
                                max={remaining}
                                step="any"
                                required
                                value={it.quantityReceived}
                                onChange={(e) =>
                                  handleItemChange(idx, "quantityReceived", Number(e.target.value))
                                }
                                className="w-28 bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 pr-9 text-xs text-zinc-900 font-mono font-bold focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
                                placeholder="0"
                              />
                              <span className="absolute right-2.5 text-[10px] font-medium text-zinc-400 pointer-events-none">
                                {it.unit}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            title="Fill full remaining quantity"
                            onClick={() => handleItemChange(idx, "quantityReceived", remaining)}
                            className="px-2.5 py-1.5 text-[11px] font-medium text-[#0D7A5F] hover:text-[#0B6851] hover:bg-[#0D7A5F]/10 rounded-lg border border-[#0D7A5F]/30 transition"
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </SideDrawer>

      {/* Viewing GRN Details SideDrawer */}
      <SideDrawer
        isOpen={!!viewingGrn}
        onClose={() => setViewingGrn(null)}
        title={
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              {viewingGrn?.grnNumber} • Goods Receipt Note
            </span>
          </div>
        }
        subtitle={viewingGrn ? `Under PO ${viewingGrn.po?.poNumber || "PO"} (${viewingGrn.po?.supplierName || "Supplier"})` : ""}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setViewingGrn(null)}
              className="px-4 py-1.5 bg-white hover:bg-[#F4F4F5] text-[#18181B] border border-[#D4D4D8] rounded-lg text-xs"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const g = viewingGrn;
                setViewingGrn(null);
                setPrintableGrn(g);
              }}
              className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          </div>
        }
      >
        {viewingGrn && (
          <div className="space-y-4 text-xs pt-1 text-[#18181B]">
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
                      <th className="py-2 px-3 text-right">Received Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                    {viewingGrn.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#18181B]">{it.description}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {it.quantityReceived} {it.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SideDrawer>

      {/* FORMAL PRINTABLE GOODS RECEIPT NOTE DRAWER */}
      <SideDrawer
        isOpen={!!printableGrn}
        onClose={() => setPrintableGrn(null)}
        title={
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Goods Receipt Note Document • {printableGrn?.grnNumber}
            </span>
          </div>
        }
        subtitle="Official warehouse delivery challan & QA inspection verification"
        width="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setPrintableGrn(null)}
              className="px-4 py-2 border border-[#D4D4D8] rounded-lg text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => printDocument("#printable-goods-receipt-note", `Goods_Receipt_Note_${printableGrn?.grnNumber}`)}
              className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          </div>
        }
      >
        {printableGrn && (
          <GoodsReceiptDocument
            grn={printableGrn}
            onClose={() => setPrintableGrn(null)}
          />
        )}
      </SideDrawer>
    </div>
  );
}
