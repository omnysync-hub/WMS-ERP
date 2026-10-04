"use client";

import React from "react";
import {
  Clock,
  UserCheck,
  Check,
  Wrench,
  Pause,
  CheckCircle2,
  Package,
  Boxes,
  Percent,
  ShieldCheck,
  Activity,
  X,
  Banknote,
  Receipt,
  ArrowDownLeft,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export interface JobsKpiDashboardProps {
  jobs: any[];
  activeFilter: string | null;
  onFilterSelect: (filterKey: string | null) => void;
  className?: string;
  isAccountant?: boolean;
}

export default function JobsKpiDashboard({
  jobs,
  activeFilter,
  onFilterSelect,
  className = "",
  isAccountant = true,
}: JobsKpiDashboardProps) {
  // 1. Created (only created but not assigned)
  const createdUnassignedCount = jobs.filter(
    (j) =>
      j.status === "Created" ||
      (!j.assignedTechnicianId &&
        (!j.technicianIds || j.technicianIds.length === 0) &&
        (!j.assignments || j.assignments.length === 0))
  ).length;

  // 2. Assigned
  const assignedCount = jobs.filter((j) => j.status === "Assigned").length;

  // 3. Accepted
  const acceptedCount = jobs.filter((j) => j.status === "Accepted").length;

  // 4. In Progress
  const inProgressCount = jobs.filter((j) => j.status === "InProgress").length;

  // 5. Paused
  const pausedCount = jobs.filter((j) => j.status === "Paused").length;

  // 6. Completed
  const completedCount = jobs.filter((j) =>
    ["CompletedPendingVerification", "Finalized", "Verified", "AwaitingFeedback"].includes(j.status)
  ).length;

  // 7. Pending Warehouse Stock Requests
  const pendingStockReqsCount = jobs.reduce(
    (acc, j) => acc + (j.inventoryRequests?.filter((r: any) => r.status === "pending").length || 0),
    0
  );
  const jobsWithPendingStock = jobs.filter((j) =>
    j.inventoryRequests?.some((r: any) => r.status === "pending")
  ).length;

  // 8. Approved / Issued Warehouse Stock Requests
  const approvedStockReqsCount = jobs.reduce(
    (acc, j) =>
      acc +
      (j.inventoryRequests?.filter((r: any) => r.status === "issued" || r.status === "fulfilled").length || 0),
    0
  );
  const jobsWithApprovedStock = jobs.filter((j) =>
    j.inventoryRequests?.some((r: any) => r.status === "issued" || r.status === "fulfilled")
  ).length;

  // 9. Pending Discount Requests
  const pendingDiscountReqsCount = jobs.filter((j) =>
    j.items?.some((it: any) => it.description?.includes("[Discount Requested:"))
  ).length;

  // 10. Approved Discount Requests
  const approvedDiscountReqsCount = jobs.filter(
    (j) =>
      (j.discountAmount && j.discountAmount > 0) ||
      j.items?.some(
        (it: any) =>
          it.description?.includes("[Discount Approved:") ||
          it.description?.includes("[Discount:")
      )
  ).length;

  // =========================================================================
  // ACCOUNTANT FINANCIAL CLEARANCE & CASH COLLECTION METRICS
  // =========================================================================

  // 11. Technician Expenses Cleared (Paid)
  const jobsWithPaidExpenses = jobs.filter((j) =>
    j.expenseClaims?.some((c: any) => c.status === "paid")
  );
  const paidExpensesTotal = jobs.reduce((sum, j) => {
    const jobPaid = (j.expenseClaims || [])
      .filter((c: any) => c.status === "paid")
      .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
    return sum + jobPaid;
  }, 0);

  // 12. Technician Expenses Left / Pending Clearance
  const jobsWithPendingExpenses = jobs.filter((j) =>
    j.expenseClaims?.some((c: any) => c.status === "pending")
  );
  const pendingExpensesTotal = jobs.reduce((sum, j) => {
    const jobPending = (j.expenseClaims || [])
      .filter((c: any) => c.status === "pending")
      .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
    return sum + jobPending;
  }, 0);

  // 13. Technician Payment Collections Handed Over / Received by Accountant
  const jobsWithCollectedHandover = jobs.filter((j) =>
    j.hisaabSettlements?.some(
      (s: any) =>
        s.status !== "superseded" &&
        ((Number(s.amountReceivedByAccountant) || 0) > 0 || s.status === "posted")
    )
  );
  const totalCashReceivedByAccountant = jobs.reduce((sum, j) => {
    const jobHanded = (j.hisaabSettlements || [])
      .filter((s: any) => s.status !== "superseded")
      .reduce(
        (s: number, st: any) =>
          s +
          (Number(st.amountReceivedByAccountant) ||
            (st.status === "posted" ? Number(st.amountCollected) || 0 : 0)),
        0
      );
    return sum + jobHanded;
  }, 0);

  // 14. Technician Cash Left / Pending Handover to Accountant
  const jobsWithPendingCashHandover = jobs.filter((j) =>
    j.hisaabSettlements?.some((s: any) => {
      if (s.status === "superseded") return false;
      const collected = Number(s.amountCollected) || 0;
      const received = Number(s.amountReceivedByAccountant) || 0;
      return collected > received || (s.status === "field_reported" && received === 0 && collected > 0);
    })
  );
  const totalPendingCashWithTechs = jobs.reduce((sum, j) => {
    const jobPending = (j.hisaabSettlements || [])
      .filter((s: any) => s.status !== "superseded")
      .reduce((s: number, st: any) => {
        const collected = Number(st.amountCollected) || 0;
        const received = Number(st.amountReceivedByAccountant) || 0;
        return s + Math.max(0, collected - received);
      }, 0);
    return sum + jobPending;
  }, 0);

  const toggleFilter = (key: string) => {
    if (activeFilter === key) {
      onFilterSelect(null);
    } else {
      onFilterSelect(key);
    }
  };

  const lifecycleCards = [
    {
      key: "unassigned",
      label: "Unassigned (Created)",
      count: createdUnassignedCount,
      sublabel: "Awaiting dispatch",
      icon: Clock,
      color: "text-slate-700",
      bg: "bg-slate-100",
      border: "border-slate-200",
      activeRing: "ring-slate-500",
    },
    {
      key: "assigned",
      label: "Assigned",
      count: assignedCount,
      sublabel: "Dispatched to tech",
      icon: UserCheck,
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      activeRing: "ring-blue-500",
    },
    {
      key: "accepted",
      label: "Accepted",
      count: acceptedCount,
      sublabel: "Ack on mobile app",
      icon: Check,
      color: "text-indigo-700",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      activeRing: "ring-indigo-500",
    },
    {
      key: "in_progress",
      label: "In Progress",
      count: inProgressCount,
      sublabel: "Field work active",
      icon: Wrench,
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      activeRing: "ring-amber-500",
    },
    {
      key: "paused",
      label: "Paused on Site",
      count: pausedCount,
      sublabel: "Suspended / waiting",
      icon: Pause,
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
      activeRing: "ring-orange-500",
    },
    {
      key: "completed",
      label: "Completed",
      count: completedCount,
      sublabel: "Done & verified",
      icon: CheckCircle2,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      activeRing: "ring-emerald-500",
    },
  ];

  // Financial Cards specifically for Expense Clearance and Payment Collections
  const financialCards = [
    {
      key: "expenses_cleared",
      label: "Expenses Cleared",
      count: jobsWithPaidExpenses.length,
      sublabel: `${formatCurrency(paidExpensesTotal)} reimbursed`,
      icon: CheckCircle2,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      activeRing: "ring-emerald-500",
    },
    {
      key: "pending_expenses",
      label: "Expenses Left / Pending",
      count: jobsWithPendingExpenses.length,
      sublabel: `${formatCurrency(pendingExpensesTotal)} awaiting payout`,
      icon: Receipt,
      color: "text-rose-700",
      bg: "bg-rose-50",
      border: "border-rose-200",
      activeRing: "ring-rose-500",
      badgeAlert: jobsWithPendingExpenses.length > 0,
    },
    {
      key: "cash_collected",
      label: "Tech Payments Collected",
      count: jobsWithCollectedHandover.length,
      sublabel: `${formatCurrency(totalCashReceivedByAccountant)} received in safe`,
      icon: Banknote,
      color: "text-teal-700",
      bg: "bg-teal-50",
      border: "border-teal-200",
      activeRing: "ring-teal-500",
    },
    {
      key: "pending_cash_handover",
      label: "Tech Cash Left / Pending",
      count: jobsWithPendingCashHandover.length,
      sublabel: `${formatCurrency(totalPendingCashWithTechs)} with field techs`,
      icon: ArrowDownLeft,
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      activeRing: "ring-amber-500",
      badgeAlert: jobsWithPendingCashHandover.length > 0,
    },
  ];

  const requestCards = [
    {
      key: "pending_stock",
      label: "Pending Stock Req",
      count: pendingStockReqsCount,
      sublabel: `${jobsWithPendingStock} work order${jobsWithPendingStock === 1 ? "" : "s"}`,
      icon: Package,
      color: "text-rose-700",
      bg: "bg-rose-50",
      border: "border-rose-200",
      activeRing: "ring-rose-500",
      badgeAlert: pendingStockReqsCount > 0,
    },
    {
      key: "approved_stock",
      label: "Approved Stock",
      count: approvedStockReqsCount,
      sublabel: `${jobsWithApprovedStock} order${jobsWithApprovedStock === 1 ? "" : "s"} fulfilled`,
      icon: Boxes,
      color: "text-teal-700",
      bg: "bg-teal-50",
      border: "border-teal-200",
      activeRing: "ring-teal-500",
    },
    {
      key: "pending_discount",
      label: "Pending Discounts",
      count: pendingDiscountReqsCount,
      sublabel: "Awaiting approval",
      icon: Percent,
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      activeRing: "ring-amber-500",
      badgeAlert: pendingDiscountReqsCount > 0,
    },
    {
      key: "approved_discount",
      label: "Approved Discounts",
      count: approvedDiscountReqsCount,
      sublabel: "Applied to ledger",
      icon: ShieldCheck,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      activeRing: "ring-emerald-500",
    },
  ];

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[#EDEDED] p-4 sm:p-5 shadow-xs space-y-4",
        className
      )}
    >
      {/* Header with Active Filter Indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#F4F4F5]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F]">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            {isAccountant
              ? "Dispatch Operations & Financial Clearance Overview"
              : "Dispatch Operations & Request Overview"}
          </h2>
          <span className="text-[10px] text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full font-medium">
            {jobs.length} Total Jobs
          </span>
          {isAccountant && (jobsWithPendingExpenses.length > 0 || jobsWithPendingCashHandover.length > 0) && (
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {jobsWithPendingExpenses.length} Exp & {jobsWithPendingCashHandover.length} Cash Handover Pending
            </span>
          )}
        </div>

        {activeFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#0D7A5F] font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
              <span>
                Active Filter:{" "}
                <strong>
                  {activeFilter === "expenses_cleared"
                    ? "EXPENSES CLEARED"
                    : activeFilter === "pending_expenses"
                    ? "EXPENSES PENDING CLEARANCE"
                    : activeFilter === "cash_collected"
                    ? "PAYMENTS COLLECTED / IN SAFE"
                    : activeFilter === "pending_cash_handover"
                    ? "CASH PENDING HANDOVER"
                    : activeFilter.replace(/_/g, " ").toUpperCase()}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onFilterSelect(null)}
                className="hover:text-emerald-900 transition p-0.5 rounded"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
            <button
              type="button"
              onClick={() => onFilterSelect(null)}
              className="text-[11px] text-[#71717A] hover:text-[#18181B] underline font-medium"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Row 1: Job Lifecycle Pipeline (6 cards) */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
          Work Order Lifecycle Pipeline
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {lifecycleCards.map((card) => {
            const Icon = card.icon;
            const isSelected = activeFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => toggleFilter(card.key)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between group relative overflow-hidden",
                  card.border,
                  isSelected
                    ? "bg-emerald-50/40 border-[#0D7A5F] ring-2 ring-[#0D7A5F] shadow-xs"
                    : "bg-[#FAFAFA] hover:bg-white hover:border-[#D4D4D8] hover:shadow-2xs"
                )}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-semibold text-[#71717A] truncate">
                    {card.label}
                  </span>
                  <div
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                      card.bg,
                      card.color
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <span className="font-mono text-xl font-bold text-[#18181B] block">
                    {card.count}
                  </span>
                  <span className="text-[10px] text-[#71717A] truncate block mt-0.5">
                    {card.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Technician Expense Clearance & Cash Recovery (Accountant View) */}
      {isAccountant && (
        <div className="space-y-1.5 pt-1 border-t border-[#F4F4F5]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#0D7A5F] tracking-wider flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Technician Financial Clearance & Cash Recovery (Accountant)
            </span>
            <span className="text-[10px] text-[#71717A]">
              Click card to filter jobs list below
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {financialCards.map((card) => {
              const Icon = card.icon;
              const isSelected = activeFilter === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => toggleFilter(card.key)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between group relative overflow-hidden",
                    card.border,
                    isSelected
                      ? "bg-emerald-50/40 border-[#0D7A5F] ring-2 ring-[#0D7A5F] shadow-xs"
                      : "bg-[#FAFAFA] hover:bg-white hover:border-[#D4D4D8] hover:shadow-2xs"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[10px] font-semibold text-[#18181B] truncate">
                        {card.label}
                      </span>
                      {card.badgeAlert && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        card.bg,
                        card.color
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <span className="font-mono text-xl font-bold text-[#18181B] block">
                      {card.count}
                    </span>
                    <span className="text-[10px] text-[#52525B] font-medium truncate block mt-0.5">
                      {card.sublabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 3: Stock & Discount Requests (4 cards) */}
      <div className="space-y-1.5 pt-1 border-t border-[#F4F4F5]">
        <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
          Material Dispatches & Discount Authorizations
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {requestCards.map((card) => {
            const Icon = card.icon;
            const isSelected = activeFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => toggleFilter(card.key)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between group relative overflow-hidden",
                  card.border,
                  isSelected
                    ? "bg-emerald-50/40 border-[#0D7A5F] ring-2 ring-[#0D7A5F] shadow-xs"
                    : "bg-[#FAFAFA] hover:bg-white hover:border-[#D4D4D8] hover:shadow-2xs"
                )}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] font-semibold text-[#71717A] truncate">
                      {card.label}
                    </span>
                    {card.badgeAlert && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                      card.bg,
                      card.color
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <span className="font-mono text-xl font-bold text-[#18181B] block">
                    {card.count}
                  </span>
                  <span className="text-[10px] text-[#71717A] truncate block mt-0.5">
                    {card.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
