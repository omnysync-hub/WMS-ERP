"use client";

import React, { useState } from "react";
import {
  Scale,
  Plus,
  Search,
  CheckCircle2,
  Trophy,
  Star,
  Clock,
  ExternalLink,
  DollarSign,
  Truck,
  ShieldCheck,
  Send,
  Eye,
  ArrowRight,
  Layers,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";

interface RfqSourcingTabProps {
  rfqs: any[];
  prs: any[];
  vendors: any[];
  onRefresh: () => void;
  onNavigateToPo?: (po: any) => void;
  initialPrForRfq?: any | null;
}

export default function RfqSourcingTab({
  rfqs,
  prs,
  vendors,
  onRefresh,
  onNavigateToPo,
  initialPrForRfq,
}: RfqSourcingTabProps) {
  const [search, setSearch] = useState("");
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null);

  // Create RFQ Modal
  const [showCreateModal, setShowCreateModal] = useState(Boolean(initialPrForRfq));
  const [title, setTitle] = useState(
    initialPrForRfq
      ? `Competitive Sourcing for ${initialPrForRfq.prNumber}`
      : "HVAC Spares & Gas Sourcing Package"
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("Competitive bidding required. Delivery timeline strictly evaluated.");
  const [selectedPrId, setSelectedPrId] = useState<string>(initialPrForRfq?.id || "");
  const [invitedVendorIds, setInvitedVendorIds] = useState<string[]>([]);
  const [rfqItems, setRfqItems] = useState<
    {
      productId?: string;
      itemCode?: string;
      description: string;
      quantity: number;
      unit: string;
      targetPrice?: number;
    }[]
  >(
    initialPrForRfq?.items
      ? initialPrForRfq.items.map((it: any) => ({
          productId: it.productId || undefined,
          itemCode: it.itemCode || it.product?.sku,
          description: it.description || it.product?.name,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.estimatedPrice,
        }))
      : [
          {
            description: "1.5 Ton Inverter Rotary Compressors",
            quantity: 10,
            unit: "pcs",
            targetPrice: 32000,
          },
        ]
  );

  // Submit Quote Modal
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quotingVendor, setQuotingVendor] = useState<any | null>(null);
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState("3");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("Net 30");
  const [quoteRef, setQuoteRef] = useState("QUO-2026-0091");
  const [quoteQualityScore, setQuoteQualityScore] = useState("90");
  const [quoteRemarks, setQuoteRemarks] = useState("OEM Original parts with 1 year replacement warranty.");
  const [quoteItemPrices, setQuoteItemPrices] = useState<Record<string, number>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // When a PR is selected in Create RFQ
  const handlePrSelect = (prId: string) => {
    setSelectedPrId(prId);
    const pr = prs.find((p) => p.id === prId);
    if (pr && pr.items?.length > 0) {
      setTitle(`Competitive Sourcing for ${pr.prNumber} (${pr.department})`);
      setRfqItems(
        pr.items.map((it: any) => ({
          productId: it.productId || undefined,
          itemCode: it.itemCode || it.product?.sku,
          description: it.description || it.product?.name,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.estimatedPrice,
        }))
      );
    }
  };

  const toggleVendorInvite = (vendorId: string) => {
    if (invitedVendorIds.includes(vendorId)) {
      setInvitedVendorIds(invitedVendorIds.filter((id) => id !== vendorId));
    } else {
      setInvitedVendorIds([...invitedVendorIds, vendorId]);
    }
  };

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invitedVendorIds.length === 0) {
      setFormError("Please invite at least one vendor for competitive bidding.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_rfq",
          title,
          dueDate,
          notes,
          prIds: selectedPrId ? [selectedPrId] : [],
          invitedVendorIds,
          items: rfqItems,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create RFQ");
      }

      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to create RFQ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openQuoteModalForVendor = (rfqVendor: any, rfq: any) => {
    setQuotingVendor(rfqVendor);
    setSelectedRfq(rfq);
    setQuoteDeliveryDays(String(rfqVendor.deliveryDays || 3));
    setQuotePaymentTerms(rfqVendor.paymentTerms || rfqVendor.vendor?.paymentTerms || "Net 30");
    setQuoteRef(rfqVendor.quotationReference || `QUO-${rfqVendor.vendor?.name?.slice(0, 3)?.toUpperCase()}-${Date.now().toString().slice(-4)}`);
    setQuoteQualityScore(String(rfqVendor.qualityScore || 90));
    setQuoteRemarks(rfqVendor.remarks || "");

    const initialPrices: Record<string, number> = {};
    for (const it of rfq.items) {
      const existingQi = rfqVendor.quotationItems?.find((qi: any) => qi.rfqItemId === it.id);
      initialPrices[it.id] = existingQi ? existingQi.unitPrice : it.targetPrice || 1000;
    }
    setQuoteItemPrices(initialPrices);
    setShowQuoteModal(true);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotingVendor || !selectedRfq) return;

    setIsSubmitting(true);
    try {
      const quoteItems = selectedRfq.items.map((it: any) => ({
        rfqItemId: it.id,
        unitPrice: Number(quoteItemPrices[it.id]) || 0,
        taxRate: 0,
      }));

      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_vendor_quote",
          rfqVendorId: quotingVendor.id,
          deliveryDays: Number(quoteDeliveryDays),
          paymentTerms: quotePaymentTerms,
          quotationReference: quoteRef,
          qualityScore: Number(quoteQualityScore),
          remarks: quoteRemarks,
          items: quoteItems,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit quote");
      }

      setShowQuoteModal(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to submit quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAwardWinner = async (rfqId: string, vendorId: string) => {
    if (!confirm("Are you sure you want to award this contract to the selected vendor? A Purchase Order will be automatically created.")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "award_rfq",
          rfqId,
          winnerVendorId: vendorId,
          actorName: "Haris Qureshi (Procurement Director)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to award RFQ");
      }

      const result = await res.json();
      alert(`Contract awarded! Purchase Order ${result.po?.poNumber} auto-generated.`);
      onRefresh();
      if (onNavigateToPo && result.po) {
        onNavigateToPo(result.po);
      }
    } catch (err: any) {
      alert(err.message || "Failed to award winner");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRfqs = rfqs.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.rfqNumber?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
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
              placeholder="Search RFQs, bidding package, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>
          <span className="text-[11px] font-mono text-[#71717A] hidden sm:inline">
            Side-by-Side Competitive Matrix Engine
          </span>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setFormError("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Create RFQ Sourcing Package
        </button>
      </div>

      {/* RFQ Packages List & Side-by-Side Comparison Matrices */}
      {filteredRfqs.length === 0 ? (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-8 text-center text-[#A1A1AA] text-xs shadow-2xs">
          No RFQ sourcing packages found. Create a new RFQ from an approved Purchase Requisition to invite multiple vendors and compare quotes side-by-side.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRfqs.map((rfq) => {
            const hasWinner = Boolean(rfq.winnerVendorId || rfq.status === "awarded");
            const winnerVendor = rfq.vendors?.find(
              (v: any) => v.vendorId === rfq.winnerVendorId || v.isWinner
            );

            // Find best values for highlights
            const quotedVendors = (rfq.vendors || []).filter((v: any) => (v.totalQuoted || 0) > 0);
            const lowestTotal = quotedVendors.length > 0
              ? Math.min(...quotedVendors.map((v: any) => v.totalQuoted || Infinity))
              : 0;
            const fastestDays = quotedVendors.length > 0
              ? Math.min(...quotedVendors.map((v: any) => v.deliveryDays || Infinity))
              : 0;

            return (
              <div
                key={rfq.id}
                className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs"
              >
                {/* RFQ Header Banner */}
                <div className="p-4 bg-[#F8FAFC] border-b border-[#EDEDED] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#18181B]">
                        {rfq.rfqNumber}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono",
                          rfq.status === "awarded"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : rfq.status === "quotes_received"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                      >
                        {rfq.status === "awarded"
                          ? "CONTRACT AWARDED"
                          : rfq.status.replace("_", " ").toUpperCase()}
                      </span>
                      {hasWinner && (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          Winner: {winnerVendor?.vendor?.name || "Awarded Vendor"}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-[#18181B] mt-1">{rfq.title}</h4>
                    <div className="flex items-center gap-3 text-[11px] text-[#71717A] mt-0.5">
                      <span>Bidding Due: {new Date(rfq.dueDate).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{rfq.items?.length || 0} item(s)</span>
                      <span>•</span>
                      <span>{rfq.vendors?.length || 0} vendor(s) invited</span>
                    </div>
                  </div>

                  {rfq.purchaseOrders?.[0] && (
                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-mono flex items-center gap-2 text-emerald-800">
                      <span>Generated PO:</span>
                      <strong className="text-[#18181B]">
                        {rfq.purchaseOrders[0].poNumber}
                      </strong>
                    </div>
                  )}
                </div>

                {/* SIDE-BY-SIDE COMPARISON MATRIX */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] font-bold flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-[#0D7A5F]" />
                      Competitive Quotations Comparison Matrix
                    </span>
                    <span className="text-[10px] text-[#A1A1AA]">
                      Columns: Vendor | Unit Price | Total | Delivery Days | Payment Terms | Score | Award
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-[#EDEDED] rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                          <th className="py-2.5 px-3.5">Vendor Name</th>
                          <th className="py-2.5 px-3">Quotation Ref</th>
                          <th className="py-2.5 px-3">Quoted Line Items (Unit Price)</th>
                          <th className="py-2.5 px-3 text-right">Total Quoted</th>
                          <th className="py-2.5 px-3 text-center">Delivery Days</th>
                          <th className="py-2.5 px-3">Payment Terms</th>
                          <th className="py-2.5 px-3 text-center">QA Score</th>
                          <th className="py-2.5 px-3.5 text-center">Action / Winner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                        {rfq.vendors?.map((rv: any) => {
                          const isQuoted = rv.status === "quoted" || rv.status === "winner";
                          const isBestPrice = isQuoted && rv.totalQuoted === lowestTotal;
                          const isFastest = isQuoted && rv.deliveryDays === fastestDays;
                          const isWinner = rv.isWinner || rfq.winnerVendorId === rv.vendorId;

                          return (
                            <tr
                              key={rv.id}
                              className={cn(
                                "hover:bg-[#F8FAFC] transition-colors",
                                isWinner
                                  ? "bg-emerald-50/60 border-l-4 border-l-[#0D7A5F]"
                                  : ""
                              )}
                            >
                              {/* Vendor Name */}
                              <td className="py-3 px-3.5 font-medium">
                                <div className="text-[#18181B] font-semibold flex items-center gap-1.5">
                                  {rv.vendor?.name}
                                  {isWinner && (
                                    <Trophy className="w-3.5 h-3.5 text-amber-500 inline shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-[#A1A1AA]">
                                  {rv.vendor?.vendorCode} • {rv.vendor?.category}
                                </div>
                              </td>

                              {/* Quotation Ref */}
                              <td className="py-3 px-3 font-mono text-[11px]">
                                {rv.quotationReference ? (
                                  <span className="text-[#18181B] font-semibold">
                                    {rv.quotationReference}
                                  </span>
                                ) : (
                                  <span className="text-[#A1A1AA] italic">Pending Quote</span>
                                )}
                              </td>

                              {/* Quoted Line Items & Unit Prices */}
                              <td className="py-3 px-3">
                                {isQuoted ? (
                                  <div className="space-y-1 max-w-xs">
                                    {rfq.items?.map((it: any) => {
                                      const qi = rv.quotationItems?.find(
                                        (q: any) => q.rfqItemId === it.id
                                      );
                                      return (
                                        <div
                                          key={it.id}
                                          className="text-[11px] flex justify-between gap-2 border-b border-[#EDEDED] pb-0.5"
                                        >
                                          <span className="text-[#71717A] truncate max-w-[130px]">
                                            {it.description}:
                                          </span>
                                          <span className="font-mono text-[#18181B] font-semibold shrink-0">
                                            {qi ? formatCurrency(qi.unitPrice) : "—"}{" "}
                                            <span className="text-[10px] text-[#A1A1AA]">
                                              /{it.unit}
                                            </span>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[#A1A1AA] text-[11px]">
                                    Awaiting quotation submission
                                  </span>
                                )}
                              </td>

                              {/* Total Quoted */}
                              <td className="py-3 px-3 text-right">
                                {isQuoted ? (
                                  <div>
                                    <span
                                      className={cn(
                                        "font-mono font-bold text-sm",
                                        isBestPrice ? "text-emerald-700" : "text-[#18181B]"
                                      )}
                                    >
                                      {formatCurrency(rv.totalQuoted || 0)}
                                    </span>
                                    {isBestPrice && (
                                      <span className="block text-[9px] font-bold text-emerald-700 uppercase tracking-tight">
                                        ★ Lowest Price
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="font-mono text-[#A1A1AA]">—</span>
                                )}
                              </td>

                              {/* Delivery Days */}
                              <td className="py-3 px-3 text-center font-mono">
                                {isQuoted ? (
                                  <div>
                                    <span
                                      className={cn(
                                        "font-bold",
                                        isFastest ? "text-blue-700" : "text-[#18181B]"
                                      )}
                                    >
                                      {rv.deliveryDays || "—"} Days
                                    </span>
                                    {isFastest && (
                                      <span className="block text-[9px] font-bold text-blue-700 uppercase tracking-tight">
                                        Fastest
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[#A1A1AA]">—</span>
                                )}
                              </td>

                              {/* Payment Terms */}
                              <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                                {rv.paymentTerms || rv.vendor?.paymentTerms || "Net 30"}
                              </td>

                              {/* Quality Score */}
                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  {rv.qualityScore || 85}/100
                                </div>
                              </td>

                              {/* Award Action */}
                              <td className="py-3 px-3.5 text-center">
                                {isWinner ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Awarded
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => openQuoteModalForVendor(rv, rfq)}
                                      className="px-2 py-1 bg-white hover:bg-[#F4F4F5] text-[#18181B] rounded text-[10px] font-medium border border-[#D4D4D8]"
                                    >
                                      {isQuoted ? "Edit Quote" : "Enter Quote"}
                                    </button>

                                    {isQuoted && !hasWinner && (
                                      <button
                                        onClick={() =>
                                          handleAwardWinner(rfq.id, rv.vendorId)
                                        }
                                        disabled={isSubmitting}
                                        className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0B6851] text-white rounded text-[10px] font-bold shadow-2xs transition"
                                      >
                                        Select Winner
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create RFQ Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#0D7A5F]" />
                  Create Request for Quotation (RFQ)
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Competitive Sourcing from Approved PR & Vendor Comparison
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRfq} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Source PR Selection */}
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Pull Items from Approved Purchase Requisition (Optional)
                </label>
                <select
                  value={selectedPrId}
                  onChange={(e) => handlePrSelect(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                >
                  <option value="">-- Standalone Bidding Package --</option>
                  {prs
                    .filter((p) => p.status === "approved" || p.status === "submitted")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prNumber} — {p.department} ({p.items?.length} items) - Est: {formatCurrency(
                          p.items.reduce((s: number, i: any) => s + i.quantity * i.estimatedPrice, 0)
                        )}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    RFQ Title / Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="e.g. Sourcing R410A Cylinders & Spares"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Bidding Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              {/* Items in RFQ */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B]">
                  Line Items for Competitive Bidding ({rfqItems.length})
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-right">Target Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {rfqItems.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-medium text-[#18181B]">
                            {it.description}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700">
                            {formatCurrency(it.targetPrice || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Multi-Vendor Selection */}
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Invite Multiple Vendors for Competitive Quotation *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl">
                  {vendors
                    .filter((v) => v.status === "Active")
                    .map((v) => {
                      const isSelected = invitedVendorIds.includes(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleVendorInvite(v.id)}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition",
                            isSelected
                              ? "bg-emerald-50 border-[#0D7A5F] text-[#0D7A5F]"
                              : "bg-white border-[#D4D4D8] text-[#18181B] hover:border-[#A1A1AA]"
                          )}
                        >
                          <div>
                            <div className="font-semibold">{v.name}</div>
                            <div className="text-[10px] font-mono text-[#71717A]">
                              {v.vendorCode} • {v.category}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold border",
                              isSelected
                                ? "bg-[#0D7A5F] border-[#0D7A5F] text-white"
                                : "border-[#D4D4D8]"
                            )}
                          >
                            {isSelected ? "✓" : ""}
                          </div>
                        </button>
                      );
                    })}
                </div>
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Issuing RFQ..." : "Send RFQ & Launch Bidding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enter / Submit Vendor Quotation Modal */}
      {showQuoteModal && quotingVendor && selectedRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-xl p-6 shadow-2xl text-[#18181B]">
            <h4 className="text-sm font-bold text-[#18181B] mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
              Enter Quotation for {quotingVendor.vendor?.name}
            </h4>
            <p className="text-[11px] text-[#71717A] mb-4">
              RFQ: {selectedRfq.rfqNumber} • {selectedRfq.title}
            </p>

            <form onSubmit={handleSubmitQuote} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Quotation Reference #
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteRef}
                    onChange={(e) => setQuoteRef(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Delivery Days (Commitment)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quoteDeliveryDays}
                    onChange={(e) => setQuoteDeliveryDays(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Payment Terms Offered
                  </label>
                  <select
                    value={quotePaymentTerms}
                    onChange={(e) => setQuotePaymentTerms(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Advance">100% Advance</option>
                    <option value="Immediate">Immediate Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Vendor Quality Score (1-100)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={quoteQualityScore}
                    onChange={(e) => setQuoteQualityScore(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              {/* Item Prices */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-[#18181B] block">
                  Quoted Unit Prices per Item:
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedRfq.items?.map((it: any) => (
                    <div
                      key={it.id}
                      className="p-2.5 bg-[#F8FAFC] border border-[#EDEDED] rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#18181B]">{it.description}</div>
                        <div className="text-[10px] font-mono text-[#71717A]">
                          Qty: {it.quantity} {it.unit} • Target: {formatCurrency(it.targetPrice || 0)}
                        </div>
                      </div>
                      <div className="w-36 shrink-0">
                        <label className="block text-[9px] font-mono text-[#71717A] mb-0.5">
                          Quoted Unit Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={quoteItemPrices[it.id] || ""}
                          onChange={(e) =>
                            setQuoteItemPrices({
                              ...quoteItemPrices,
                              [it.id]: Number(e.target.value),
                            })
                          }
                          className="w-full bg-white border border-[#D4D4D8] rounded px-2 py-1 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none text-right font-bold"
                          placeholder="Unit Price"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Vendor Technical Remarks / Warranty
                </label>
                <input
                  type="text"
                  value={quoteRemarks}
                  onChange={(e) => setQuoteRemarks(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  placeholder="Warranty terms, delivery stipulations..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Saving Quote..." : "Record Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
