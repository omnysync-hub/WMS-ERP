"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  CreditCard,
  Scale,
  Receipt,
  PackageCheck,
  ShoppingCart,
  Eye,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface ThreeWayMatchTabProps {
  invoices: any[];
  pos: any[];
  grns: any[];
  vendors: any[];
  onRefresh: () => void;
  onNavigateToPayment?: (invoice: any) => void;
}

export default function ThreeWayMatchTab({
  invoices,
  pos,
  grns,
  vendors,
  onRefresh,
  onNavigateToPayment,
}: ThreeWayMatchTabProps) {
  const { currentRole } = useRole();
  const isStorekeeper = currentRole === "storekeeper";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  if (isStorekeeper) {
    return (
      <div className="p-8 text-center bg-white border border-[#EDEDED] rounded-xl space-y-3 shadow-2xs">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-[#18181B]">Vendor Invoicing & Rates Protected</h3>
        <p className="text-xs text-[#71717A] max-w-md mx-auto">
          In accordance with storekeeper role security protocols, vendor invoices, purchasing rates, and 3-way match financial reconciliations are restricted to Finance & Accounts personnel.
        </p>
      </div>
    );
  }

  // Create Supplier Invoice Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [selectedPoId, setSelectedPoId] = useState("");
  const [selectedGrnId, setSelectedGrnId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [taxAmount, setTaxAmount] = useState("0");
  const [matchNotes, setMatchNotes] = useState("");

  const [billedItems, setBilledItems] = useState<
    {
      poItemId: string;
      grnItemId: string;
      productId?: string;
      description: string;
      poUnitPrice: number;
      grnQuantity: number;
      billedQuantity: number;
      billedUnitPrice: number;
    }[]
  >([]);

  // Selected Invoice for Full 3-Way Match Verification Card
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handlePoSelect = (poId: string) => {
    setSelectedPoId(poId);
    const po = pos.find((p) => p.id === poId);
    if (po) {
      setVendorId(po.vendorId || "");
      // Find matching GRN
      const grn = grns.find((g) => g.poId === poId);
      if (grn) setSelectedGrnId(grn.id);

      setInvoiceNumber(`INV-VND-${Date.now().toString().slice(-5)}`);

      setBilledItems(
        po.items.map((pi: any) => {
          const gi = grn?.items?.find((g: any) => g.poItemId === pi.id || g.productId === pi.productId);
          const acceptedQty = gi ? gi.quantityAccepted : pi.quantityReceived || pi.quantity;

          return {
            poItemId: pi.id,
            grnItemId: gi?.id || "",
            productId: pi.productId || undefined,
            description: pi.description,
            poUnitPrice: pi.unitCost || 0,
            grnQuantity: acceptedQty,
            billedQuantity: acceptedQty, // default to what was received
            billedUnitPrice: pi.unitCost || 0, // default to PO unit rate
          };
        })
      );
    } else {
      setBilledItems([]);
    }
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...billedItems];
    (updated[index] as any)[field] = val;
    setBilledItems(updated);
  };

  const calculatedSubtotal = billedItems.reduce(
    (sum, it) => sum + (Number(it.billedQuantity) || 0) * (Number(it.billedUnitPrice) || 0),
    0
  );

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !invoiceNumber.trim()) {
      setFormError("Please enter invoice number and select a vendor.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_supplier_invoice",
          invoiceNumber,
          vendorId,
          poId: selectedPoId || undefined,
          grnId: selectedGrnId || undefined,
          invoiceDate,
          dueDate,
          taxAmount: Number(taxAmount) || 0,
          matchNotes,
          items: billedItems,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit invoice for 3-way match");
      }

      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to create supplier invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_supplier_invoice",
          invoiceId,
          actorName: "Fatima Noor (Chief Financial Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve invoice");
      }

      alert("3-Way Match Verified! Accounts Payable voucher created and posted to Vendor Ledger.");
      setActiveInvoice(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchStatus = statusFilter === "all" || inv.matchStatus === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.referenceNumber?.toLowerCase().includes(q) ||
      inv.vendor?.name?.toLowerCase().includes(q) ||
      inv.po?.poNumber?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative min-w-[280px] max-w-md">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search invoice #, vendor, PO ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Match Statuses</option>
            <option value="matched">Matched (100% Validated)</option>
            <option value="discrepancy">Discrepancy (Variance Alert)</option>
            <option value="pending_match">Pending Match</option>
            <option value="approved_for_payment">Approved for Payment</option>
            <option value="paid">Settled / Paid</option>
          </select>
        </div>

        <button
          onClick={() => {
            const firstPo = pos.find((p) => p.goodsReceipts?.length > 0);
            if (firstPo) handlePoSelect(firstPo.id);
            setShowCreateModal(true);
            setFormError("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Enter Supplier Invoice (3-Way Match)
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Invoice # & Ref</th>
                <th className="py-3 px-3">Vendor / Supplier</th>
                <th className="py-3 px-3">Linked PO & GRN</th>
                <th className="py-3 px-3">Invoice Date</th>
                <th className="py-3 px-3 text-right">Billed Amount</th>
                <th className="py-3 px-3 text-center">Variance Audit</th>
                <th className="py-3 px-3 text-center">Match Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#71717A]">
                    No supplier invoices found. Record a vendor invoice against a completed Goods Receipt to initiate the 3-Way Match audit.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                    onClick={() => setActiveInvoice(inv)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[10px] text-[#A1A1AA] font-mono">
                        Ref: {inv.referenceNumber}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#18181B]">
                        {inv.vendor?.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#71717A]">
                        Terms: {inv.vendor?.paymentTerms}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div className="text-[#0D7A5F] font-semibold">
                        PO: {inv.po?.poNumber || "Direct"}
                      </div>
                      <div className="text-[10px] text-[#71717A]">
                        GRN: {inv.grn?.grnNumber || "Direct Receipt"}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                      {new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-[#18181B] text-sm">
                      {formatCurrency(inv.totalAmount)}
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      {inv.priceVariance === 0 && inv.quantityVariance === 0 ? (
                        <span className="text-emerald-700 text-[11px] font-bold">
                          0% Zero Variance
                        </span>
                      ) : (
                        <div className="text-[10px]">
                          {inv.priceVariance !== 0 && (
                            <span className="text-rose-600 font-bold block">
                              Price: {formatCurrency(inv.priceVariance)}
                            </span>
                          )}
                          {inv.quantityVariance !== 0 && (
                            <span className="text-amber-600 font-bold block">
                              Qty: +{inv.quantityVariance}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                          inv.matchStatus === "matched"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : inv.matchStatus === "approved_for_payment"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : inv.matchStatus === "paid"
                            ? "bg-teal-50 text-teal-700 border-teal-200"
                            : inv.matchStatus === "discrepancy"
                            ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        )}
                      >
                        {inv.matchStatus === "approved_for_payment"
                          ? "Approved AP"
                          : inv.matchStatus.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveInvoice(inv);
                          }}
                          className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-[#71717A] hover:text-[#18181B] transition"
                          title="Inspect 3-Way Match"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {(inv.matchStatus === "matched" ||
                          inv.matchStatus === "discrepancy") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveInvoice(inv.id);
                            }}
                            disabled={isSubmitting}
                            className="text-[10px] bg-[#0D7A5F] hover:bg-[#0B6851] text-white font-bold px-2 py-1 rounded shadow-2xs transition"
                          >
                            Approve for AP
                          </button>
                        )}

                        {inv.matchStatus === "approved_for_payment" &&
                          onNavigateToPayment && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToPayment(inv);
                              }}
                              className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded shadow-2xs transition flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" /> Pay Bill
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enter Supplier Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0D7A5F]" />
                  Enter Supplier Invoice & Run 3-Way Match
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Critical Financial Control: Compares PO Rate vs GRN Physical Count vs Billed Amount
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Linking PO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Select Originating Purchase Order *
                  </label>
                  <select
                    required
                    value={selectedPoId}
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose PO --</option>
                    {pos
                      .filter((p) => p.status !== "draft")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.poNumber} — {p.supplierName} ({p.items?.length} items) - Val: {formatCurrency(p.totalAmount)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Vendor&apos;s Billed Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="e.g. INV-PK-89102"
                  />
                </div>
              </div>

              {/* Dates & Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Supplier Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Sales Tax / GST Amount (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 3-WAY COMPARISON LINE ITEMS */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  3-Way Match Audit Matrix ({billedItems.length} items)
                </span>

                {billedItems.length === 0 ? (
                  <div className="p-4 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl text-center text-[#71717A] text-xs">
                    Please select a Purchase Order above to load PO agreed rates and GRN accepted physical counts.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {billedItems.map((it, idx) => {
                      const qtyDiff = it.billedQuantity - it.grnQuantity;
                      const priceDiff = it.billedUnitPrice - it.poUnitPrice;
                      const hasItemDiscrepancy = qtyDiff > 0.001 || priceDiff > 0.01;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "p-3 rounded-xl border text-xs space-y-2",
                            hasItemDiscrepancy
                              ? "bg-rose-50/50 border-rose-200"
                              : "bg-[#F8FAFC] border-[#EDEDED]"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#18181B]">{it.description}</span>
                            {hasItemDiscrepancy ? (
                              <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy Detected
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Matched
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                            {/* 1. PO Baseline */}
                            <div className="p-2 bg-white border border-[#EDEDED] rounded-lg">
                              <span className="block text-[9px] font-mono text-[#71717A] mb-0.5">
                                [1] PO Agreed Unit Rate
                              </span>
                              <span className="font-mono font-bold text-[#18181B]">
                                {formatCurrency(it.poUnitPrice)}
                              </span>
                            </div>

                            {/* 2. GRN Baseline */}
                            <div className="p-2 bg-white border border-[#EDEDED] rounded-lg">
                              <span className="block text-[9px] font-mono text-[#71717A] mb-0.5">
                                [2] GRN Accepted Qty
                              </span>
                              <span className="font-mono font-bold text-[#18181B]">
                                {it.grnQuantity} units
                              </span>
                            </div>

                            {/* 3. Supplier Billed Qty */}
                            <div>
                              <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                                [3] Billed Qty *
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                required
                                value={it.billedQuantity}
                                onChange={(e) =>
                                  handleItemChange(idx, "billedQuantity", Number(e.target.value))
                                }
                                className={cn(
                                  "w-full rounded px-2.5 py-1 text-xs font-mono font-bold outline-none border",
                                  qtyDiff > 0.001
                                    ? "bg-rose-50 border-rose-300 text-rose-700"
                                    : "bg-white border-[#D4D4D8] text-[#18181B]"
                                )}
                              />
                            </div>

                            {/* 4. Supplier Billed Unit Price */}
                            <div>
                              <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                                [3] Billed Unit Rate (PKR) *
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                required
                                value={it.billedUnitPrice}
                                onChange={(e) =>
                                  handleItemChange(idx, "billedUnitPrice", Number(e.target.value))
                                }
                                className={cn(
                                  "w-full rounded px-2.5 py-1 text-xs font-mono font-bold outline-none border",
                                  priceDiff > 0.01
                                    ? "bg-rose-50 border-rose-300 text-rose-700"
                                    : "bg-white border-[#D4D4D8] text-[#18181B]"
                                )}
                              />
                            </div>
                          </div>

                          {/* Variance Note */}
                          {hasItemDiscrepancy && (
                            <div className="text-[10px] text-rose-600 font-mono flex gap-3 pt-1 border-t border-rose-200">
                              {qtyDiff > 0 && (
                                <span>Quantity Overbilled by +{qtyDiff} units!</span>
                              )}
                              {priceDiff > 0 && (
                                <span>Unit Rate Surcharged by +{formatCurrency(priceDiff)}!</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#71717A] font-semibold">
                  Invoice Gross Total (Subtotal + Tax):
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-700">
                  {formatCurrency(calculatedSubtotal + (Number(taxAmount) || 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || billedItems.length === 0}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Running 3-Way Match..." : "Verify & Save Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT 3-WAY MATCH MODAL */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#0D7A5F]" />
                  3-Way Match Audit Console • {activeInvoice.invoiceNumber}
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Vendor: {activeInvoice.vendor?.name} • PO: {activeInvoice.po?.poNumber || "Direct"}
                </p>
              </div>
              <button
                onClick={() => setActiveInvoice(null)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* 3-Pillar Visual Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-[#71717A] uppercase block">
                    [1] Purchase Order
                  </span>
                  <ShoppingCart className="w-4 h-4 text-blue-600 mx-auto" />
                  <span className="font-bold text-[#18181B] block">
                    {activeInvoice.po?.poNumber || "PO-REF"}
                  </span>
                  <span className="text-[10px] text-[#71717A] font-mono block">
                    Rate: Agreed Standard
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-[#71717A] uppercase block">
                    [2] Goods Receipt (GRN)
                  </span>
                  <PackageCheck className="w-4 h-4 text-[#0D7A5F] mx-auto" />
                  <span className="font-bold text-[#18181B] block">
                    {activeInvoice.grn?.grnNumber || "GRN-REF"}
                  </span>
                  <span className="text-[10px] text-[#71717A] font-mono block">
                    Physical Count: Verified
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-[#71717A] uppercase block">
                    [3] Supplier Invoice
                  </span>
                  <Receipt className="w-4 h-4 text-purple-600 mx-auto" />
                  <span className="font-bold text-[#18181B] block">
                    {activeInvoice.invoiceNumber}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold block">
                    {formatCurrency(activeInvoice.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Items Detail */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Audited Line Items ({activeInvoice.items?.length || 0})
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 text-right">PO Rate</th>
                        <th className="py-2 px-3 text-right">GRN Qty</th>
                        <th className="py-2 px-3 text-right">Billed Qty</th>
                        <th className="py-2 px-3 text-right">Billed Rate</th>
                        <th className="py-2 px-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {activeInvoice.items?.map((it: any) => (
                        <tr key={it.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-2.5 px-3 font-semibold text-[#18181B]">
                            {it.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#71717A]">
                            {formatCurrency(it.poUnitPrice || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#71717A]">
                            {it.grnQuantity || it.billedQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#18181B]">
                            {it.billedQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#18181B]">
                            {formatCurrency(it.billedUnitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.variance === 0 ? (
                              <span className="text-emerald-700">0</span>
                            ) : (
                              <span className="text-rose-600">
                                {formatCurrency(it.variance)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Accounting Effect on Approval */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-emerald-800 block">
                  Accounting Impact upon Approval:
                </span>
                <p className="text-[#18181B] font-mono text-[11px]">
                  Debit 2050 GR/IR Clearing Account (-Liability) • Credit 2000 Accounts Payable (+Vendor AP)
                </p>
                <p className="text-[10px] text-[#71717A]">
                  Will officially create a bill voucher in Vendor Sub-Ledger for payment disbursement.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EDEDED]">
                <button
                  onClick={() => setActiveInvoice(null)}
                  className="px-4 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
                >
                  Close
                </button>

                {(activeInvoice.matchStatus === "matched" ||
                  activeInvoice.matchStatus === "discrepancy") && (
                  <button
                    onClick={() => handleApproveInvoice(activeInvoice.id)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0D7A5F] hover:bg-[#0B6851] text-white font-bold text-xs rounded-lg shadow-2xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve for Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
