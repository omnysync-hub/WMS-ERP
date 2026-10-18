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
  Truck,
  Boxes,
  FileText,
  Check,
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
  queueFilter?: string | null;
  onClearQueueFilter?: () => void;
}

export default function GoodsReceiptTab({
  grns,
  pos,
  onRefresh,
  presetPoForGrn,
  queueFilter,
  onClearQueueFilter,
}: GoodsReceiptTabProps) {
  const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();
  const canCreateGrn =
    hasPermission("procurement.grn.create") ||
    activeRole === "admin" ||
    currentRole === "storekeeper" ||
    activeRole === "storekeeper";
  const isStorekeeper = currentRole === "storekeeper" || activeRole === "storekeeper";
  const [search, setSearch] = useState("");

  const [subView, setSubView] = useState<"awaiting" | "grns">(() => {
    if (queueFilter === "completed_grns") return "grns";
    return "awaiting";
  });

  useEffect(() => {
    if (queueFilter === "awaiting_delivery") setSubView("awaiting");
    if (queueFilter === "completed_grns") setSubView("grns");
  }, [queueFilter]);

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

  /** POs that are approved and dispatched / sent to vendor and awaiting delivery */
  const awaitingPos = React.useMemo(() => {
    return pos.filter((p) => {
      const st = (p.status || "").toLowerCase();
      if (["cancelled", "canceled", "closed", "draft"].includes(st)) return false;
      const isApprovedOrSent = [
        "approved",
        "sent",
        "sent_to_vendor",
        "partially_received",
      ].includes(st);
      if (!isApprovedOrSent) return false;
      const items = p.items || [];
      if (items.length === 0) return true;
      const totalOrdered = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
      const totalReceived = items.reduce((s: number, i: any) => s + (Number(i.quantityReceived) || 0), 0);
      return totalOrdered > totalReceived;
    });
  }, [pos]);

  const filteredAwaitingPos = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return awaitingPos;
    return awaitingPos.filter((p) => {
      const poNumMatch = p.poNumber?.toLowerCase().includes(q);
      const supplierMatch = p.supplierName?.toLowerCase().includes(q);
      const addrMatch = p.shippingAddress?.toLowerCase().includes(q);
      const itemMatch = (p.items || []).some(
        (it: any) =>
          it.description?.toLowerCase().includes(q) ||
          it.itemCode?.toLowerCase().includes(q) ||
          it.product?.name?.toLowerCase().includes(q) ||
          it.product?.sku?.toLowerCase().includes(q)
      );
      return poNumMatch || supplierMatch || addrMatch || itemMatch;
    });
  }, [awaitingPos, search]);

  const handleStartGrnForPo = (po: any) => {
    setViewingPoDrawer(null);
    handlePoSelect(po.id);
    setShowCreateModal(true);
    setFormError("");
  };

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
      setSubView("grns");
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
      {/* Sub-View Switcher: Awaiting Delivery vs Completed GRNs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F4F5] rounded-xl border border-[#EDEDED] w-fit">
          <button
            type="button"
            onClick={() => {
              setSubView("awaiting");
              onClearQueueFilter?.();
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              subView === "awaiting"
                ? "bg-white text-[#0D7A5F] shadow-2xs font-bold"
                : "text-[#71717A] hover:text-[#18181B]"
            )}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>POs Awaiting Delivery</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                subView === "awaiting"
                  ? "bg-[#0D7A5F] text-white"
                  : "bg-[#E4E4E7] text-[#71717A]"
              )}
            >
              {awaitingPos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubView("grns");
              onClearQueueFilter?.();
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              subView === "grns"
                ? "bg-white text-[#0D7A5F] shadow-2xs font-bold"
                : "text-[#71717A] hover:text-[#18181B]"
            )}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Logged Goods Receipts (GRNs)</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                subView === "grns"
                  ? "bg-[#0D7A5F] text-white"
                  : "bg-[#E4E4E7] text-[#71717A]"
              )}
            >
              {grns.length}
            </span>
          </button>
        </div>

        {subView === "awaiting" && (
          <div className="text-xs text-[#71717A] flex items-center gap-2">
            <span>
              <strong>{awaitingPos.length}</strong> purchase order(s) dispatched to vendors awaiting warehouse delivery.
            </span>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative min-w-[280px] max-w-md">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                subView === "awaiting"
                  ? "Search PO #, supplier, line items, warehouse..."
                  : "Search GRN #, PO #, supplier, warehouse..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>
        </div>

        <button
          onClick={() => {
            const firstPo = pos.find(
              (p) =>
                p.status === "sent_to_vendor" ||
                p.status === "partially_received" ||
                p.status === "approved"
            );
            if (firstPo) handlePoSelect(firstPo.id);
            setShowCreateModal(true);
            setFormError("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Receive Goods Note (GRN)
        </button>
      </div>

      {subView === "awaiting" ? (
        /* Awaiting Delivery POs Table */
        <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Purchase Order & Date</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Expected Delivery</th>
                  <th className="py-3 px-3">Warehouse Destination</th>
                  <th className="py-3 px-3">Stock Fulfillment</th>
                  <th className="py-3 px-3">Order Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {filteredAwaitingPos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <ProcurementEmptyState
                        title="No purchase orders awaiting delivery"
                        description={
                          search
                            ? "No awaiting purchase orders matched your search query."
                            : "All approved purchase orders have either been fully received into warehouse stock or none are currently dispatched."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredAwaitingPos.map((po) => {
                    const items = po.items || [];
                    const totalOrdered = items.reduce(
                      (s: number, i: any) => s + (Number(i.quantity) || 0),
                      0
                    );
                    const totalReceived = items.reduce(
                      (s: number, i: any) => s + (Number(i.quantityReceived) || 0),
                      0
                    );
                    const pendingUnits = Math.max(0, totalOrdered - totalReceived);
                    const percentReceived =
                      totalOrdered > 0
                        ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
                        : 0;
                    const pendingLines = items.filter(
                      (it: any) =>
                        (Number(it.quantity) || 0) > (Number(it.quantityReceived) || 0)
                    ).length;
                    const isOverdue =
                      po.expectedDeliveryDate &&
                      new Date(po.expectedDeliveryDate) < new Date() &&
                      pendingUnits > 0;

                    return (
                      <tr
                        key={po.id}
                        className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                        onClick={() => setViewingPoDrawer(po)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors flex items-center gap-1.5">
                            {po.poNumber}
                            {po.poType && po.poType !== "standard" && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono uppercase">
                                {po.poType}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#A1A1AA] font-mono">
                            {new Date(po.poDate || po.createdAt).toLocaleDateString()} •{" "}
                            {items.length} line item(s)
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#18181B]">{po.supplierName}</div>
                          {po.vendor?.phone ? (
                            <div className="text-[10px] text-[#71717A] font-mono">
                              {po.vendor.phone}
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#71717A] font-mono">
                              Terms: {po.paymentTerms || "Net 30"}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px]">
                          {po.expectedDeliveryDate ? (
                            <div>
                              <div className="text-[#18181B] font-medium">
                                {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                              </div>
                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Clock className="w-3 h-3 text-emerald-600" /> On Schedule
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#A1A1AA] text-xs">Standard Lead Time</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-[#71717A]">
                          <div className="flex items-center gap-1.5">
                            <Warehouse className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                            <span className="truncate max-w-[150px]">
                              {po.shippingAddress || "Central Warehouse"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="w-36">
                            <div className="flex justify-between text-[10px] font-mono mb-1">
                              <span className="text-[#71717A]">
                                {totalReceived} / {totalOrdered} units
                              </span>
                              <span className="text-[#18181B] font-bold">
                                {percentReceived}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden border border-[#EDEDED]">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  percentReceived === 100
                                    ? "bg-emerald-500"
                                    : percentReceived > 0
                                    ? "bg-amber-500"
                                    : "bg-zinc-300"
                                )}
                                style={{ width: `${percentReceived}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#71717A] block mt-0.5">
                              {pendingLines} item(s) pending
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <ProcurementStatusBadge status={po.status} />
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingPoDrawer(po);
                              }}
                              title="View Purchase Order Details"
                              className="p-1.5 rounded-lg bg-white hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B] border border-[#D4D4D8] transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartGrnForPo(po);
                              }}
                              title="Log Inward Goods Receipt Note"
                              className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              Log GRN
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
      ) : (
        /* GRN Table (Logged Goods Receipts) */
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
    )}

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

      {/* DRAWER: VIEW PURCHASE ORDER & ITEM FULFILLMENT DETAILS */}
      <SideDrawer
        isOpen={Boolean(viewingPoDrawer)}
        onClose={() => setViewingPoDrawer(null)}
        title={
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Purchase Order • {viewingPoDrawer?.poNumber}
            </span>
          </div>
        }
        subtitle="Expected vendor delivery, ordered line items, and warehouse receipt status."
        width="max-w-3xl"
        footer={
          viewingPoDrawer && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setViewingPoDrawer(null)}
                className="px-4 py-2 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleStartGrnForPo(viewingPoDrawer)}
                className="inline-flex items-center gap-2 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Log Goods Receipt (GRN) for this PO</span>
              </button>
            </div>
          )
        }
      >
        {viewingPoDrawer && (() => {
          const po = viewingPoDrawer;
          const items = po.items || [];
          const totalOrdered = items.reduce(
            (s: number, i: any) => s + (Number(i.quantity) || 0),
            0
          );
          const totalReceived = items.reduce(
            (s: number, i: any) => s + (Number(i.quantityReceived) || 0),
            0
          );
          const pendingUnits = Math.max(0, totalOrdered - totalReceived);
          const percent =
            totalOrdered > 0
              ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
              : 0;
          const isOverdue =
            po.expectedDeliveryDate &&
            new Date(po.expectedDeliveryDate) < new Date() &&
            pendingUnits > 0;
          const relatedGrns = grns.filter(
            (g) => g.poId === po.id || g.po?.poNumber === po.poNumber
          );

          return (
            <div className="space-y-5 text-xs text-[#18181B] pb-6">
              {/* Top Overview Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#EDEDED]">
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A] uppercase">
                    Vendor / Supplier
                  </span>
                  <span className="font-bold text-[#18181B] block mt-0.5">
                    {po.supplierName}
                  </span>
                  {po.vendor?.phone && (
                    <span className="text-[11px] text-[#71717A] font-mono block">
                      {po.vendor.phone}
                    </span>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-mono text-[#71717A] uppercase">
                    PO Date & Type
                  </span>
                  <span className="font-semibold text-[#18181B] block mt-0.5">
                    {new Date(po.poDate || po.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A] uppercase">
                    {po.poType || "Standard"}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-mono text-[#71717A] uppercase">
                    Expected Delivery
                  </span>
                  {po.expectedDeliveryDate ? (
                    <div>
                      <span className="font-semibold text-[#18181B] block mt-0.5">
                        {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                      </span>
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <Clock className="w-3 h-3 text-emerald-600" /> On Schedule
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#71717A] block mt-0.5">Standard Lead Time</span>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-mono text-[#71717A] uppercase">
                    Order Status
                  </span>
                  <div className="mt-1">
                    <ProcurementStatusBadge status={po.status} />
                  </div>
                </div>
              </div>

              {/* Delivery Address & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                    Receiving Destination
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Warehouse className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="font-medium text-zinc-800">
                      {po.shippingAddress || "Central Warehouse - Lahore"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                    Payment & Delivery Terms
                  </span>
                  <span className="font-medium text-zinc-800 mt-1 block">
                    {po.paymentTerms || "Net 30 Days"}
                  </span>
                </div>
              </div>

              {/* Fulfillment Progress Bar */}
              <div className="p-3.5 bg-white border border-[#EDEDED] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#18181B]">
                    Warehouse Inward Fulfillment
                  </span>
                  <span className="font-mono font-bold text-xs text-[#0D7A5F]">
                    {percent}% Complete
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      percent === 100
                        ? "bg-emerald-500"
                        : percent > 0
                        ? "bg-amber-500"
                        : "bg-zinc-300"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 text-center pt-1 border-t border-zinc-100">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-mono">
                      Ordered
                    </span>
                    <strong className="text-sm font-mono text-zinc-900">
                      {totalOrdered} units
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-mono">
                      Received So Far
                    </span>
                    <strong className="text-sm font-mono text-emerald-700">
                      {totalReceived} units
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-mono">
                      Pending Receipt
                    </span>
                    <strong
                      className={cn(
                        "text-sm font-mono",
                        pendingUnits > 0 ? "text-amber-700" : "text-zinc-500"
                      )}
                    >
                      {pendingUnits} units
                    </strong>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18181B]">
                    Ordered Items & Quantities ({items.length} lines)
                  </span>
                  <span className="text-[11px] text-[#71717A]">
                    Inspect ordered vs received quantities
                  </span>
                </div>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Description / SKU</th>
                        <th className="py-2.5 px-3 text-right">Ordered</th>
                        <th className="py-2.5 px-3 text-right">Received</th>
                        <th className="py-2.5 px-3 text-right">Pending</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {items.map((it: any, idx: number) => {
                        const ord = Number(it.quantity) || 0;
                        const rec = Number(it.quantityReceived) || 0;
                        const pend = Math.max(0, ord - rec);
                        return (
                          <tr key={it.id || idx} className="hover:bg-[#F8FAFC]">
                            <td className="py-2.5 px-3 font-mono text-zinc-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-zinc-900">
                                {it.description || it.product?.name || "Item"}
                              </div>
                              {(it.itemCode || it.product?.sku) && (
                                <div className="text-[10px] font-mono text-zinc-500">
                                  SKU: {it.itemCode || it.product?.sku}
                                </div>
                              )}
                              {it.deliverySchedule && (
                                <div className="text-[10px] text-zinc-500 italic mt-0.5">
                                  Schedule: {it.deliverySchedule}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium">
                              {ord} {it.unit || "unit"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              {rec} {it.unit || "unit"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {pend > 0 ? (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  {pend} {it.unit || "unit"}
                                </span>
                              ) : (
                                <span className="text-zinc-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {pend === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" /> Complete
                                </span>
                              ) : rec > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Partial
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                  Awaiting
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Prior Goods Receipts Section */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Logged Inward Receipts for this Order ({relatedGrns.length})
                </span>
                {relatedGrns.length > 0 ? (
                  <div className="border border-[#EDEDED] rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                        <tr>
                          <th className="py-2 px-3">GRN #</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Received By</th>
                          <th className="py-2 px-3">Delivery Challan</th>
                          <th className="py-2 px-3 text-right">Units Received</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDEDED]">
                        {relatedGrns.map((g) => {
                          const gUnits = (g.items || []).reduce(
                            (acc: number, i: any) =>
                              acc + (Number(i.quantityReceived) || 0),
                            0
                          );
                          return (
                            <tr key={g.id} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-3 font-mono font-bold text-[#0D7A5F]">
                                {g.grnNumber}
                              </td>
                              <td className="py-2 px-3 text-zinc-600">
                                {new Date(
                                  g.receivedDate || g.createdAt
                                ).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-3 text-zinc-800">{g.receivedBy}</td>
                              <td className="py-2 px-3 font-mono text-zinc-600">
                                {g.deliveryChallan || "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">
                                {gUnits}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingPoDrawer(null);
                                    setViewingGrn(g);
                                  }}
                                  className="text-[11px] font-semibold text-[#0D7A5F] hover:underline cursor-pointer"
                                >
                                  View GRN
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-zinc-500 text-xs">
                    No inward goods receipts have been logged against this purchase order yet.
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </SideDrawer>
    </div>
  );
}
