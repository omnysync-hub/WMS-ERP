"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  FileText,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  Clock,
  Eye,
  Send,
  Building,
  DollarSign,
  ShieldCheck,
  Scale,
  RefreshCw,
  Search,
  Check,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface ProcurementApprovalsTabProps {
  prs: any[];
  pos: any[];
  invoices: any[];
  onRefresh: () => void;
  onNavigateToPo?: () => void;
  onNavigateToPr?: () => void;
  onNavigateToInvoice?: () => void;
}

export default function ProcurementApprovalsTab({
  prs,
  pos,
  invoices,
  onRefresh,
  onNavigateToPo,
  onNavigateToPr,
  onNavigateToInvoice,
}: ProcurementApprovalsTabProps) {
  const { currentRole } = useRole();
  const [activeCategory, setActiveCategory] = useState<"all" | "prs" | "pos" | "bills">("all");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Selected Item Modal
  const [inspectItem, setInspectItem] = useState<{
    type: "pr" | "po" | "bill";
    data: any;
  } | null>(null);

  // Rejection Modal
  const [rejectItem, setRejectItem] = useState<{
    type: "pr" | "po" | "bill";
    id: string;
    refNumber: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approverActorName =
    currentRole === "admin"
      ? "Haris Qureshi (Managing Director)"
      : currentRole === "accountant"
      ? "Fatima Noor (Chief Financial Accountant)"
      : "Operations Approver";

  // Pending filter sets
  const pendingPrs = prs.filter((p) => p.status === "submitted");
  const pendingPos = pos.filter((p) => p.status === "draft");
  const pendingBills = invoices.filter(
    (i) => i.matchStatus === "matched" || i.matchStatus === "discrepancy" || i.matchStatus === "pending_match"
  );

  const totalPendingCount = pendingPrs.length + pendingPos.length + pendingBills.length;

  const handleApprovePr = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_pr",
          id,
          actorName: approverActorName,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve PR");
      setActionSuccess(`Purchase Requisition approved successfully!`);
      setTimeout(() => setActionSuccess(null), 3000);
      setInspectItem(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
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
          actorName: approverActorName,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve PO");
      setActionSuccess(`Purchase Order approved! Ready to dispatch to vendor.`);
      setTimeout(() => setActionSuccess(null), 3000);
      setInspectItem(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveBill = async (invoiceId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_supplier_invoice",
          invoiceId,
          actorName: approverActorName,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve supplier bill");
      setActionSuccess(`Supplier Bill approved & posted to Accounts Payable ledger!`);
      setTimeout(() => setActionSuccess(null), 3500);
      setInspectItem(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectItem) return;
    setIsSubmitting(true);
    try {
      if (rejectItem.type === "pr") {
        await fetch("/api/procurement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject_pr",
            id: rejectItem.id,
            actorName: approverActorName,
            reason: rejectReason,
          }),
        });
      }
      setRejectItem(null);
      setInspectItem(null);
      setRejectReason("");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {actionSuccess && (
        <div className="fixed top-5 right-5 z-50 bg-[#0D7A5F] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {actionSuccess}
        </div>
      )}

      {/* Approvals Overview KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveCategory("all")}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            activeCategory === "all"
              ? "bg-[#0D7A5F] text-white border-[#0D7A5F]"
              : "bg-white border-[#EDEDED] text-[#18181B] hover:border-[#D4D4D8]"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-80">
              Total Approvals Queue
            </span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono">{totalPendingCount}</div>
          <span className="text-[10px] opacity-80 mt-1 block">
            Across PRs, POs, and Vendor Bills
          </span>
        </div>

        <div
          onClick={() => setActiveCategory("prs")}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            activeCategory === "prs"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white border-[#EDEDED] text-[#18181B] hover:border-[#D4D4D8]"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-80">
              1. PR Approvals
            </span>
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono">{pendingPrs.length}</div>
          <span className="text-[10px] opacity-80 mt-1 block">
            Needs authorization before sourcing
          </span>
        </div>

        <div
          onClick={() => setActiveCategory("pos")}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            activeCategory === "pos"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white border-[#EDEDED] text-[#18181B] hover:border-[#D4D4D8]"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-80">
              2. PO Approvals
            </span>
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono">{pendingPos.length}</div>
          <span className="text-[10px] opacity-80 mt-1 block">
            Authorize POs before vendor dispatch
          </span>
        </div>

        <div
          onClick={() => setActiveCategory("bills")}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            activeCategory === "bills"
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white border-[#EDEDED] text-[#18181B] hover:border-[#D4D4D8]"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-80">
              3. Bill Approvals (3-Way)
            </span>
            <Receipt className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono">{pendingBills.length}</div>
          <span className="text-[10px] opacity-80 mt-1 block">
            3-Way Matched invoices for AP disbursement
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white border border-[#EDEDED] p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition",
              activeCategory === "all"
                ? "bg-[#0D7A5F] text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            )}
          >
            All Pending ({totalPendingCount})
          </button>
          <button
            onClick={() => setActiveCategory("prs")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5",
              activeCategory === "prs"
                ? "bg-amber-600 text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            )}
          >
            <FileText className="w-3 h-3" /> PR Approvals ({pendingPrs.length})
          </button>
          <button
            onClick={() => setActiveCategory("pos")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5",
              activeCategory === "pos"
                ? "bg-blue-600 text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            )}
          >
            <ShoppingCart className="w-3 h-3" /> PO Approvals ({pendingPos.length})
          </button>
          <button
            onClick={() => setActiveCategory("bills")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5",
              activeCategory === "bills"
                ? "bg-purple-600 text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            )}
          >
            <Receipt className="w-3 h-3" /> Bill Approvals ({pendingBills.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search pending approvals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-[#F8FAFC] border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          />
        </div>
      </div>

      {/* Main Approvals Queue Content */}
      <div className="space-y-4">
        {/* 1. PR APPROVALS SECTION */}
        {(activeCategory === "all" || activeCategory === "prs") && (
          <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#EDEDED] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Purchase Requisitions Awaiting Approval ({pendingPrs.length})
                </h4>
              </div>
              {onNavigateToPr && (
                <button
                  onClick={onNavigateToPr}
                  className="text-[11px] text-[#0D7A5F] hover:underline font-semibold"
                >
                  View All PRs &rarr;
                </button>
              )}
            </div>

            {pendingPrs.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#A1A1AA]">
                No purchase requisitions currently awaiting approval.
              </div>
            ) : (
              <div className="divide-y divide-[#EDEDED]">
                {pendingPrs.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-4 hover:bg-[#FAFAFA] transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#18181B]">
                          {pr.prNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          {pr.priority}
                        </span>
                        <span className="text-[10px] text-[#71717A] font-mono">
                          {formatDateTime(pr.createdAt)}
                        </span>
                      </div>

                      <div className="text-xs text-[#18181B] flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong>Target:</strong> {pr.site || pr.department}
                        </span>
                        <span>
                          <strong>Requisitioner:</strong> {pr.requestedBy}
                        </span>
                        <span>
                          <strong>Items:</strong> {pr.items?.length || 0} material line(s)
                        </span>
                      </div>

                      {pr.notes && (
                        <p className="text-[11px] text-[#71717A] line-clamp-1 italic">
                          &ldquo;{pr.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setInspectItem({ type: "pr", data: pr })}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" /> Inspect
                      </button>

                      <button
                        onClick={() =>
                          setRejectItem({
                            type: "pr",
                            id: pr.id,
                            refNumber: pr.prNumber,
                          })
                        }
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold transition flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>

                      <button
                        onClick={() => handleApprovePr(pr.id)}
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve PR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. PO APPROVALS SECTION */}
        {(activeCategory === "all" || activeCategory === "pos") && (
          <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#EDEDED] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Purchase Orders Awaiting Manager Approval ({pendingPos.length})
                </h4>
              </div>
              {onNavigateToPo && (
                <button
                  onClick={onNavigateToPo}
                  className="text-[11px] text-[#0D7A5F] hover:underline font-semibold"
                >
                  View All POs &rarr;
                </button>
              )}
            </div>

            {pendingPos.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#A1A1AA]">
                No purchase orders currently awaiting approval.
              </div>
            ) : (
              <div className="divide-y divide-[#EDEDED]">
                {pendingPos.map((po) => (
                  <div
                    key={po.id}
                    className="p-4 hover:bg-[#FAFAFA] transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#18181B]">
                          {po.poNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          {po.poType} PO
                        </span>
                        <span className="text-[10px] text-[#71717A] font-mono">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs text-[#18181B] flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong>Supplier:</strong> {po.supplierName}
                        </span>
                        <span>
                          <strong>Terms:</strong> {po.paymentTerms}
                        </span>
                        <span>
                          <strong>Items:</strong> {po.items?.length || 0} line item(s)
                        </span>
                      </div>

                      <div className="text-xs font-mono font-bold text-emerald-800">
                        Total Value: {formatCurrency(po.totalAmount || 0)} (Net Payable: {formatCurrency(po.netPayable || po.totalAmount)})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setInspectItem({ type: "po", data: po })}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" /> Inspect
                      </button>

                      <button
                        onClick={() => handleApprovePo(po.id)}
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve Purchase Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. SUPPLIER BILL (INVOICE) APPROVALS SECTION */}
        {(activeCategory === "all" || activeCategory === "bills") && (
          <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#EDEDED] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Supplier Bills (3-Way Match) Awaiting Payment Approval ({pendingBills.length})
                </h4>
              </div>
              {onNavigateToInvoice && (
                <button
                  onClick={onNavigateToInvoice}
                  className="text-[11px] text-[#0D7A5F] hover:underline font-semibold"
                >
                  View 3-Way Match &rarr;
                </button>
              )}
            </div>

            {pendingBills.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#A1A1AA]">
                No vendor bills currently awaiting payment authorization.
              </div>
            ) : (
              <div className="divide-y divide-[#EDEDED]">
                {pendingBills.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 hover:bg-[#FAFAFA] transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#18181B]">
                          {inv.invoiceNumber}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase",
                            inv.matchStatus === "matched"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                          )}
                        >
                          {inv.matchStatus === "matched" ? "Matched" : "Variance Alert"}
                        </span>
                        <span className="text-[10px] text-[#71717A] font-mono">
                          Ref: {inv.referenceNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#18181B] flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong>Vendor:</strong> {inv.vendor?.name}
                        </span>
                        <span>
                          <strong>PO Ref:</strong> {inv.po?.poNumber || "Direct"}
                        </span>
                        <span>
                          <strong>Billed Amount:</strong> {formatCurrency(inv.totalAmount)}
                        </span>
                      </div>

                      {inv.matchNotes && (
                        <p className="text-[11px] text-[#71717A] font-mono line-clamp-1">
                          {inv.matchNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setInspectItem({ type: "bill", data: inv })}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" /> Inspect 3-Way
                      </button>

                      <button
                        onClick={() => handleApproveBill(inv.id)}
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve Bill for AP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INSPECT DETAIL MODAL                                                      */}
      {/* ========================================================================= */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                  Approval Inspection Console ·{" "}
                  {inspectItem.type === "pr"
                    ? inspectItem.data.prNumber
                    : inspectItem.type === "po"
                    ? inspectItem.data.poNumber
                    : inspectItem.data.invoiceNumber}
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Review specification lines and financial compliance before executive approval
                </p>
              </div>
              <button
                onClick={() => setInspectItem(null)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Items List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Line Items ({inspectItem.data.items?.length || 0})
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        {inspectItem.type !== "pr" && (
                          <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        )}
                        {inspectItem.type !== "pr" && (
                          <th className="py-2.5 px-3 text-right">Total</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED]">
                      {inspectItem.data.items?.map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-semibold">{it.description}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {it.quantity || it.billedQuantity} {it.unit || "unit"}
                          </td>
                          {inspectItem.type !== "pr" && (
                            <td className="py-2 px-3 text-right font-mono text-[#71717A]">
                              {formatCurrency(it.unitCost || it.billedUnitPrice || 0)}
                            </td>
                          )}
                          {inspectItem.type !== "pr" && (
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              {formatCurrency(
                                (it.quantity || it.billedQuantity || 0) *
                                  (it.unitCost || it.billedUnitPrice || 0)
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons inside Inspect */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">
                <button
                  onClick={() => setInspectItem(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Close
                </button>

                {inspectItem.type === "pr" && (
                  <button
                    onClick={() => handleApprovePr(inspectItem.data.id)}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold shadow-2xs"
                  >
                    Confirm PR Approval
                  </button>
                )}

                {inspectItem.type === "po" && (
                  <button
                    onClick={() => handleApprovePo(inspectItem.data.id)}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs"
                  >
                    Confirm PO Approval
                  </button>
                )}

                {inspectItem.type === "bill" && (
                  <button
                    onClick={() => handleApproveBill(inspectItem.data.id)}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold shadow-2xs"
                  >
                    Confirm Bill Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md p-5 shadow-2xl text-[#18181B]">
            <h4 className="text-sm font-bold text-rose-700 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Reject {rejectItem.refNumber}
            </h4>
            <p className="text-[11px] text-[#71717A] mb-3">
              Provide formal reason for returning / rejecting this request:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-rose-500 outline-none mb-3"
              placeholder="State reason (budget limitation, stock already present, incorrect specifications)..."
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectItem(null)}
                className="px-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
