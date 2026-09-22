"use client";

import React, { useState } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  Send,
  Printer,
  PackageCheck,
  Building,
  Calendar,
  Eye,
  ArrowRight,
  ShieldCheck,
  Flame,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";

interface PurchaseOrdersTabProps {
  pos: any[];
  vendors: any[];
  products: any[];
  onRefresh: () => void;
  onOpenGrnModal?: (po: any) => void;
}

export default function PurchaseOrdersTab({
  pos,
  vendors,
  products,
  onRefresh,
  onOpenGrnModal,
}: PurchaseOrdersTabProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create PO Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [poType, setPoType] = useState<"standard" | "blanket" | "service">("standard");
  const [vendorId, setVendorId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [shippingAddress, setShippingAddress] = useState(
    "Central Warehouse, Main Workshop St, Gulberg III, Lahore, Pakistan"
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    "1. Quality Acceptance: 100% QA physical inspection upon delivery. 2. 3-Way Matching: Invoices must match PO rates and GRN accepted quantities. 3. Payment: Within 30 days of 3-Way Match approval."
  );

  const [items, setItems] = useState<
    {
      productId: string;
      itemCode: string;
      description: string;
      quantity: number;
      unitCost: number;
      unit: string;
      discountPercent: number;
      taxPercent: number;
      deliverySchedule: string;
    }[]
  >([
    {
      productId: "",
      itemCode: "",
      description: "",
      quantity: 10,
      unitCost: 0,
      unit: "pcs",
      discountPercent: 0,
      taxPercent: 0,
      deliverySchedule: "Immediate Single Lot",
    },
  ]);

  // Selected PO for Printable Document View
  const [printablePo, setPrintablePo] = useState<any | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        itemCode: "",
        description: "",
        quantity: 5,
        unitCost: 0,
        unit: "unit",
        discountPercent: 0,
        taxPercent: 0,
        deliverySchedule: "Immediate Single Lot",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleProductSelect = (index: number, pId: string) => {
    const product = products.find((p) => p.id === pId);
    const updated = [...items];
    if (product) {
      updated[index] = {
        productId: product.id,
        itemCode: product.sku,
        description: product.name,
        quantity: updated[index].quantity || 1,
        unitCost: product.costPrice || 0,
        unit: product.unit || "unit",
        discountPercent: 0,
        taxPercent: 0,
        deliverySchedule: updated[index].deliverySchedule || "Immediate Single Lot",
      };
    } else {
      updated[index].productId = "";
    }
    setItems(updated);
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  const calculatedSubtotal = items.reduce(
    (sum, it) =>
      sum +
      (Number(it.quantity) || 0) *
        (Number(it.unitCost) || 0) *
        (1 - (Number(it.discountPercent) || 0) / 100),
    0
  );

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setFormError("Please select a vendor.");
      return;
    }

    const selectedVendor = vendors.find((v) => v.id === vendorId);

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_po",
          poType,
          vendorId,
          supplierName: selectedVendor?.name,
          supplierEmail: selectedVendor?.email || "orders@vendor.pk",
          expectedDeliveryDate,
          paymentTerms,
          shippingAddress,
          termsAndConditions,
          items,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create PO");
      }

      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to create PO");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePo = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_po",
          id,
          actorName: "Haris Qureshi (Managing Director)",
        }),
      });
      if (!res.ok) throw new Error("Failed to approve PO");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPo = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_po",
          id,
        }),
      });
      if (!res.ok) throw new Error("Failed to send PO");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPos = pos.filter((p) => {
    const matchType = typeFilter === "all" || p.poType === typeFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.poNumber?.toLowerCase().includes(q) ||
      p.supplierName?.toLowerCase().includes(q) ||
      p.items?.some((i: any) => i.description?.toLowerCase().includes(q));
    return matchType && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search PO #, supplier, items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All PO Types</option>
            <option value="standard">Standard PO</option>
            <option value="blanket">Blanket / Framework PO</option>
            <option value="service">Service PO</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="sent_to_vendor">Sent to Vendor</option>
            <option value="partially_received">Partially Received</option>
            <option value="fully_received">Fully Received</option>
            <option value="closed">Closed / Completed</option>
          </select>
        </div>

        <button
          onClick={() => {
            setVendorId(vendors[0]?.id || "");
            setShowCreateModal(true);
            setFormError("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Purchase Order
        </button>
      </div>

      {/* PO Table */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">PO Number & Type</th>
                <th className="py-3 px-3">Vendor / Supplier</th>
                <th className="py-3 px-3">Order Date</th>
                <th className="py-3 px-3">Delivery Date</th>
                <th className="py-3 px-3">Fulfillment Progress</th>
                <th className="py-3 px-3 text-right">Order Value</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredPos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#A1A1AA]">
                    No purchase orders found. Issue a new purchase order or convert an approved requisition.
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => {
                  const totalOrdered = (po.items || []).reduce(
                    (s: number, i: any) => s + (i.quantity || 0),
                    0
                  );
                  const totalReceived = (po.items || []).reduce(
                    (s: number, i: any) => s + (i.quantityReceived || 0),
                    0
                  );
                  const percentReceived =
                    totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-[#F8FAFC] transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors flex items-center gap-1.5">
                          {po.poNumber}
                          {po.poType === "blanket" && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                              BLANKET
                            </span>
                          )}
                          {po.poType === "service" && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                              SERVICE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] font-mono">
                          {po.items?.length || 0} line items
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#18181B]">
                          {po.supplierName}
                        </div>
                        <div className="text-[10px] text-[#71717A] font-mono">
                          Terms: {po.paymentTerms || "Net 30"}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                        {new Date(po.poDate || po.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        {po.expectedDeliveryDate ? (
                          <span
                            className={
                              new Date(po.expectedDeliveryDate) < new Date() &&
                              po.status !== "fully_received" &&
                              po.status !== "closed"
                                ? "text-rose-600 font-bold"
                                : "text-[#71717A]"
                            }
                          >
                            {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[#A1A1AA]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="w-36">
                          <div className="flex justify-between text-[10px] font-mono mb-1">
                            <span className="text-[#71717A]">
                              {totalReceived} / {totalOrdered}
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
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-[#18181B] text-sm">
                        {formatCurrency(po.totalAmount || 0)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono",
                            po.status === "draft"
                              ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                              : po.status === "approved"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : po.status === "sent_to_vendor"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : po.status === "partially_received"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : po.status === "fully_received"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          )}
                        >
                          {po.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Printable Document View Button */}
                          <button
                            onClick={() => setPrintablePo(po)}
                            title="Print Formal PO / PDF Preview"
                            className="p-1.5 rounded bg-white hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B] border border-[#D4D4D8] transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Approval / Workflow Action */}
                          {po.status === "draft" && (
                            <button
                              onClick={() => handleApprovePo(po.id)}
                              disabled={isSubmitting}
                              className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 rounded-lg transition"
                            >
                              Approve PO
                            </button>
                          )}

                          {po.status === "approved" && (
                            <button
                              onClick={() => handleSendPo(po.id)}
                              disabled={isSubmitting}
                              className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> Send to Vendor
                            </button>
                          )}

                          {(po.status === "sent_to_vendor" ||
                            po.status === "partially_received") &&
                            onOpenGrnModal && (
                              <button
                                onClick={() => onOpenGrnModal(po)}
                                className="text-[10px] bg-[#0D7A5F] hover:bg-[#0B6851] text-white font-bold px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1"
                              >
                                <PackageCheck className="w-3 h-3" /> Receive GRN
                              </button>
                            )}
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

      {/* Create Purchase Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#0D7A5F]" />
                  Issue Purchase Order (PO)
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Standard, Blanket, and Service Contracts with Delivery Schedule
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Vendor & PO Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Select Vendor / Supplier *
                  </label>
                  <select
                    required
                    value={vendorId}
                    onChange={(e) => {
                      setVendorId(e.target.value);
                      const v = vendors.find((vend) => vend.id === e.target.value);
                      if (v) setPaymentTerms(v.paymentTerms || "Net 30");
                    }}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors
                      .filter((v) => v.status === "Active")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.vendorCode}) - Terms: {v.paymentTerms} (WHT: {v.whtRate}%)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    PO Type
                  </label>
                  <select
                    value={poType}
                    onChange={(e) => setPoType(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="standard">Standard PO</option>
                    <option value="blanket">Blanket / Framework PO (Annual)</option>
                    <option value="service">Service PO (Labor/Maintenance)</option>
                  </select>
                </div>
              </div>

              {/* Dates & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Expected Delivery Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="Net 30"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    disabled
                    value="PKR (Pakistani Rupee)"
                    className="w-full bg-[#F8FAFC] border border-[#EDEDED] rounded-lg px-3 py-1.5 text-xs text-[#71717A] font-mono"
                  />
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Shipping & Delivery Address
                </label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                />
              </div>

              {/* Line Items Builder */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18181B]">
                    Order Line Items ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-[11px] text-[#0D7A5F] hover:text-[#0A624C] font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item Line
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Catalog Product
                          </label>
                          <select
                            value={it.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          >
                            <option value="">-- Custom Non-Catalog Item --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - Cost: {p.costPrice}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Item Description *
                          </label>
                          <input
                            type="text"
                            required
                            value={it.description}
                            onChange={(e) =>
                              handleItemChange(idx, "description", e.target.value)
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                            placeholder="Description"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            required
                            value={it.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, "quantity", Number(e.target.value))
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={it.unit}
                            onChange={(e) =>
                              handleItemChange(idx, "unit", e.target.value)
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Unit Price (PKR) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={it.unitCost}
                            onChange={(e) =>
                              handleItemChange(idx, "unitCost", Number(e.target.value))
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-[#EDEDED]">
                        <div>
                          <label className="block text-[9px] font-mono text-[#71717A] mb-0.5">
                            Delivery Schedule / Milestone
                          </label>
                          <input
                            type="text"
                            value={it.deliverySchedule}
                            onChange={(e) =>
                              handleItemChange(idx, "deliverySchedule", e.target.value)
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded px-2 py-0.5 text-xs text-[#18181B] font-mono"
                            placeholder="e.g. Lot 1: 5 units on 25th, Lot 2: 5 units"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <div>
                            <label className="block text-[9px] font-mono text-[#71717A] mb-0.5">
                              Discount %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={it.discountPercent}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "discountPercent",
                                  Number(e.target.value)
                                )
                              }
                              className="w-16 bg-white border border-[#D4D4D8] rounded px-2 py-0.5 text-xs text-[#18181B] font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-[#71717A] mb-0.5">
                              Tax %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={it.taxPercent}
                              onChange={(e) =>
                                handleItemChange(idx, "taxPercent", Number(e.target.value))
                              }
                              className="w-16 bg-white border border-[#D4D4D8] rounded px-2 py-0.5 text-xs text-[#18181B] font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <span className="font-mono text-[#71717A]">
                            Net Total:{" "}
                            <strong className="text-emerald-700 font-mono">
                              {formatCurrency(
                                (it.quantity || 0) *
                                  (it.unitCost || 0) *
                                  (1 - (it.discountPercent || 0) / 100) *
                                  (1 + (it.taxPercent || 0) / 100)
                              )}
                            </strong>
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-rose-600 hover:text-rose-700 text-[10px]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#18181B] font-semibold">
                  Purchase Order Total Payable:
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-700">
                  {formatCurrency(calculatedSubtotal)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Issuing..." : "Issue Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORMAL PRINTABLE PURCHASE ORDER MODAL */}
      {printablePo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Action Bar inside modal (hidden in print) */}
            <div className="flex items-center justify-between px-6 py-3 bg-[#F8FAFC] border-b border-[#EDEDED] text-[#18181B] print:hidden">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Printer className="w-4 h-4 text-[#0D7A5F]" />
                Formal Purchase Order Document • {printablePo.poNumber}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                <button
                  onClick={() => setPrintablePo(null)}
                  className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto bg-white font-sans text-xs">
              {/* Header Letterhead */}
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
                    PURCHASE ORDER
                  </div>
                  <div className="text-xs font-mono font-bold text-[#0D7A5F] mt-0.5">
                    {printablePo.poNumber}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600 mt-1">
                    Date: {new Date(printablePo.poDate || printablePo.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600">
                    Type: <strong className="uppercase">{printablePo.poType}</strong>
                  </div>
                </div>
              </div>

              {/* Vendor & Shipping Address Blocks */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/50">
                  <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
                    Supplier / Vendor Details
                  </span>
                  <div className="font-bold text-sm text-zinc-900">
                    {printablePo.supplierName}
                  </div>
                  <div className="text-zinc-600 mt-0.5">
                    {printablePo.vendor?.addressText || "Industrial Area, Lahore/Karachi"}
                  </div>
                  <div className="text-zinc-600">
                    Email: {printablePo.supplierEmail || printablePo.vendor?.email || "—"}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 mt-1">
                    NTN: {printablePo.vendor?.ntnNumber || "Exempt / N/A"} • STRN: {printablePo.vendor?.strnNumber || "—"}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/50">
                  <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500 mb-1">
                    Shipping & Billing Terms
                  </span>
                  <div className="font-bold text-zinc-900">Delivery Destination:</div>
                  <div className="text-zinc-600">
                    {printablePo.shippingAddress || "Central Warehouse, Gulberg III, Lahore"}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold text-zinc-800">Expected Delivery:</span>{" "}
                    <span className="font-mono">
                      {printablePo.expectedDeliveryDate
                        ? new Date(printablePo.expectedDeliveryDate).toLocaleDateString()
                        : "Immediate"}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-800">Payment Terms:</span>{" "}
                    <span className="font-mono">{printablePo.paymentTerms || "Net 30"}</span>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-zinc-300 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 font-mono text-[10px] uppercase">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Code & Specification</th>
                      <th className="py-2.5 px-3">Delivery Schedule</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      <th className="py-2.5 px-3 text-right">Net Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-800">
                    {printablePo.items?.map((it: any, idx: number) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-mono text-zinc-500">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-zinc-900">{it.description}</div>
                          {it.itemCode && (
                            <span className="font-mono text-[10px] text-zinc-500">
                              Part #: {it.itemCode}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-600">
                          {it.deliverySchedule || "Single Delivery"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatCurrency(it.unitCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                          {formatCurrency(it.lineTotal || it.quantity * it.unitCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 p-3 rounded-xl bg-zinc-50 border border-zinc-300 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(printablePo.totalAmount)}
                    </span>
                  </div>
                  {printablePo.whtAmount > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>WHT Deduction:</span>
                      <span className="font-mono text-rose-600">
                        -{formatCurrency(printablePo.whtAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-zinc-900 border-t border-zinc-300 pt-1.5">
                    <span>Net Order Value:</span>
                    <span className="font-mono text-[#0D7A5F]">
                      {formatCurrency(printablePo.netPayable || printablePo.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[10px] text-zinc-600 space-y-1">
                <span className="font-bold text-zinc-800 uppercase tracking-wide block">
                  Commercial Conditions:
                </span>
                <p>{printablePo.termsAndConditions}</p>
                <p>
                  • Discrepancies between Delivery Challan and Physical Count must be endorsed on Goods Receipt Note (GRN).
                </p>
                <p>
                  • Supplier Invoices must be accompanied by verified GRN copy for 3-Way Match processing.
                </p>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
                <div>
                  <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
                    Bilal Sheikh
                  </div>
                  <span className="text-[10px] font-bold text-zinc-700 uppercase">
                    Prepared By (Storekeeper)
                  </span>
                </div>

                <div>
                  <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-500">
                    Fatima Noor
                  </div>
                  <span className="text-[10px] font-bold text-zinc-700 uppercase">
                    Verified By (Finance)
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
        </div>
      )}
    </div>
  );
}
