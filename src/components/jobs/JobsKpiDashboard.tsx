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
  Search,
  Banknote,
  Receipt,
  ArrowDownLeft,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export interface JobsKpiDashboardProps {
  jobs: any[];
  activeFilter: string | null;
  onFilterSelect: (filterKey: string | null) => void;
  className?: string;
  isAccountant?: boolean;
  isDispatcher?: boolean;
}

export default function JobsKpiDashboard({
  jobs,
  activeFilter,
  onFilterSelect,
  className = "",
  isAccountant = true,
  isDispatcher = false,
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

  // 5. Paused on site
  const pausedCount = jobs.filter((j) => j.status === "Paused").length;

  // 6. Completed
  const completedCount = jobs.filter((j) =>
    ["CompletedPendingVerification", "Finalized", "Verified", "AwaitingFeedback"].includes(j.status)
  ).length;

  // 7. Pending Warehouse Stock Requests
  const pendingStockReqsCount = jobs.reduce(
    (acc, j) =>
      acc +
      (j.inventoryRequests?.filter((r: any) => r.status === "pending" || r.status === "partially_issued").length || 0),
    0
  );
  const jobsWithPendingStock = jobs.filter((j) =>
    j.inventoryRequests?.some((r: any) => r.status === "pending" || r.status === "partially_issued")
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

  // 11. Technician Payment Collections Handed Over / Received by Accountant (1ST)
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

  // 12. Technician Cash Left / Pending Handover to Accountant
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

  // Helper: detect "mahinay baad", monthly credit, deferred customer payments
  const isMahinayBaadPayment = (j: any) => {
    const text = `${j.remarks || ""} ${j.notes || ""} ${j.manualJobNumber || ""}`.toLowerCase();
    return (
      text.includes("mahinay baad") ||
      text.includes("mahine baad") ||
      text.includes("credit") ||
      text.includes("deferred") ||
      text.includes("udhar") ||
      text.includes("monthly") ||
      text.includes("30 day") ||
      text.includes("postdated")
    );
  };

  // 13. Accounts Receivable (Credit / 30-Day Deferred / "Mahinay Baad" Payments)
  const jobsWithReceivables = jobs.filter((j) => {
    const hasBalanceDue = j.hisaabSettlements?.some((s: any) => s.status !== "superseded" && Number(s.balanceDue) > 0);
    const isCareOfReceivable = Boolean(j.careOfPartyId);
    const isDeferredCredit = isMahinayBaadPayment(j);
    const isUnsettledCompleted =
      ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status) &&
      (!j.hisaabSettlements || j.hisaabSettlements.length === 0 || j.hisaabSettlements.every((s: any) => Number(s.amountCollected) === 0));
    return hasBalanceDue || isCareOfReceivable || isDeferredCredit || isUnsettledCompleted;
  });
  const totalReceivables = jobsWithReceivables.reduce((sum, j) => {
    const settlementBalance = (j.hisaabSettlements || [])
      .filter((s: any) => s.status !== "superseded")
      .reduce((s: number, st: any) => s + (Number(st.balanceDue) || 0), 0);
    if (settlementBalance > 0) return sum + settlementBalance;
    const itemsTotal = (j.items || []).reduce((s: number, it: any) => s + (it.quantityPlanned * it.unitRate), 0);
    return sum + Math.max(0, itemsTotal - (j.discountAmount || 0));
  }, 0);

  // 14. Partially Cleared Technician Expenses
  const jobsWithPartiallyClearedExpenses = jobs.filter((j) => {
    const hasPaid = j.expenseClaims?.some((c: any) => c.status === "paid");
    const hasPending = j.expenseClaims?.some((c: any) => c.status === "pending");
    const hasPartialNote = j.expenseClaims?.some(
      (c: any) =>
        c.note?.includes("[Partially Cleared") || c.note?.includes("[Remaining Balance")
    );
    return (hasPaid && hasPending) || hasPartialNote;
  });
  const partiallyClearedDisbursedTotal = jobsWithPartiallyClearedExpenses.reduce((sum, j) => {
    const paid = (j.expenseClaims || [])
      .filter((c: any) => c.status === "paid")
      .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
    return sum + paid;
  }, 0);

  // 15. Technician Expenses Cleared (Fully Paid)
  const jobsWithPaidExpenses = jobs.filter((j) =>
    j.expenseClaims?.some((c: any) => c.status === "paid")
  );
  const paidExpensesTotal = jobs.reduce((sum, j) => {
    const jobPaid = (j.expenseClaims || [])
      .filter((c: any) => c.status === "paid")
      .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
    return sum + jobPaid;
  }, 0);

  // 16. Technician Expenses Left / Pending Clearance
  const jobsWithPendingExpenses = jobs.filter((j) =>
    j.expenseClaims?.some((c: any) => c.status === "pending")
  );
  const pendingExpensesTotal = jobs.reduce((sum, j) => {
    const jobPending = (j.expenseClaims || [])
      .filter((c: any) => c.status === "pending")
      .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
    return sum + jobPending;
  }, 0);

  // Dropdown popover state for inspecting jobs inside any specific KPI card
  const [openKpiCardDropdown, setOpenKpiCardDropdown] = React.useState<string | null>(null);
  const [kpiSearchQuery, setKpiSearchQuery] = React.useState<string>("");

  // Section Tab State & Collapse State (with persistent preference)
  const [activeSection, setActiveSection] = React.useState<"all" | "pipeline" | "financial" | "materials">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("workman_jobs_kpi_section");
        if (saved && ["all", "pipeline", "financial", "materials"].includes(saved)) {
          return saved as any;
        }
      } catch (e) {}
    }
    return "all";
  });

  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("workman_jobs_kpi_collapsed") === "true";
      } catch (e) {}
    }
    return false;
  });

  const handleSectionChange = (sec: "all" | "pipeline" | "financial" | "materials") => {
    setActiveSection(sec);
    try {
      localStorage.setItem("workman_jobs_kpi_section", sec);
    } catch (e) {}
  };

  const handleCollapseToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("workman_jobs_kpi_collapsed", String(next));
    } catch (e) {}
  };

  // Auto-switch section and ensure uncollapsed if an activeFilter is set
  React.useEffect(() => {
    if (!activeFilter) return;
    if (isCollapsed) setIsCollapsed(false);
    if (activeSection === "all") return;

    const lifecycleKeys = ["unassigned", "assigned", "accepted", "in_progress", "paused", "completed"];
    const financialKeys = ["cash_collected", "pending_cash_handover", "partially_cleared_expenses", "receivables", "expenses_cleared", "pending_expenses"];
    const requestKeys = ["pending_stock", "approved_stock", "pending_discount", "approved_discount"];

    if (lifecycleKeys.includes(activeFilter) && activeSection !== "pipeline") {
      setActiveSection("pipeline");
    } else if (financialKeys.includes(activeFilter) && activeSection !== "financial") {
      setActiveSection("financial");
    } else if (requestKeys.includes(activeFilter) && activeSection !== "materials") {
      setActiveSection("materials");
    }
  }, [activeFilter]);

  // Map each card key to its concrete list of matching jobs
  const getJobsForKpi = (key: string): any[] => {
    switch (key) {
      case "unassigned":
        return jobs.filter(
          (j) =>
            j.status === "Created" ||
            (!j.assignedTechnicianId &&
              (!j.technicianIds || j.technicianIds.length === 0) &&
              (!j.assignments || j.assignments.length === 0))
        );
      case "assigned":
        return jobs.filter((j) => j.status === "Assigned");
      case "accepted":
        return jobs.filter((j) => j.status === "Accepted");
      case "in_progress":
        return jobs.filter((j) => j.status === "InProgress");
      case "paused":
        return jobs.filter((j) => j.status === "Paused");
      case "completed":
        return jobs.filter((j) =>
          ["CompletedPendingVerification", "Finalized", "Verified", "AwaitingFeedback"].includes(j.status)
        );
      case "cash_collected":
        return jobsWithCollectedHandover;
      case "pending_cash_handover":
        return jobsWithPendingCashHandover;
      case "partially_cleared_expenses":
        return jobsWithPartiallyClearedExpenses;
      case "receivables":
        return jobsWithReceivables;
      case "expenses_cleared":
        return jobsWithPaidExpenses;
      case "pending_expenses":
        return jobsWithPendingExpenses;
      case "pending_stock":
        return jobs.filter((j) =>
          j.inventoryRequests?.some((r: any) => r.status === "pending" || r.status === "partially_issued")
        );
      case "approved_stock":
        return jobs.filter((j) =>
          j.inventoryRequests?.some((r: any) => r.status === "issued" || r.status === "fulfilled")
        );
      case "pending_discount":
        return jobs.filter((j) =>
          j.items?.some((it: any) => it.description?.includes("[Discount Requested:"))
        );
      case "approved_discount":
        return jobs.filter(
          (j) =>
            (j.discountAmount && j.discountAmount > 0) ||
            j.items?.some(
              (it: any) =>
                it.description?.includes("[Discount Approved:") ||
                it.description?.includes("[Discount:")
            )
        );
      default:
        return [];
    }
  };

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
      label: "Paused",
      count: pausedCount,
      sublabel: "Partial work done / hold",
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

  // Financial Cards: CASH COLLECTION 1ST, then Pending Cash, Partially Cleared Expenses, Receivables (Mahinay Baad), Cleared, Pending
  const financialCards = [
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
    {
      key: "partially_cleared_expenses",
      label: "Partially Cleared Expenses",
      count: jobsWithPartiallyClearedExpenses.length,
      sublabel: `${formatCurrency(partiallyClearedDisbursedTotal)} partially paid`,
      icon: Receipt,
      color: "text-purple-700",
      bg: "bg-purple-50",
      border: "border-purple-200",
      activeRing: "ring-purple-500",
      badgeAlert: jobsWithPartiallyClearedExpenses.length > 0,
    },
    {
      key: "receivables",
      label: "Receivables (Mahinay Baad / Credit)",
      count: jobsWithReceivables.length,
      sublabel: `${formatCurrency(totalReceivables)} in customer AR`,
      icon: DollarSign,
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      activeRing: "ring-blue-500",
      badgeAlert: jobsWithReceivables.length > 0,
    },
    {
      key: "expenses_cleared",
      label: "Expenses Fully Cleared",
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

  // Helper renderer for a KPI card with an inline dropdown list of jobs
  const renderKpiCard = (card: any, index: number = 0) => {
    const Icon = card.icon;
    const isSelected = activeFilter === card.key;
    const isDropdownOpen = openKpiCardDropdown === card.key;
    const cardJobs = getJobsForKpi(card.key);

    const q = kpiSearchQuery.toLowerCase().trim();
    const filteredJobs = q
      ? cardJobs.filter((j: any) => {
          const jNum = (j.jobNumber || "").toLowerCase();
          const cust = (j.customer?.name || "").toLowerCase();
          const tech = (j.assignedTechnician?.name || "").toLowerCase();
          const status = (j.status || "").toLowerCase();
          const title = (j.title || "").toLowerCase();
          const equip = (j.items || []).some((item: any) =>
            (item.equipmentType || "").toLowerCase().includes(q) ||
            (item.modelNumber || "").toLowerCase().includes(q)
          );
          return jNum.includes(q) || cust.includes(q) || tech.includes(q) || status.includes(q) || title.includes(q) || equip;
        })
      : cardJobs;

    // Align dropdown to the right if in later columns to prevent overflow
    const alignRight = index >= 3;

    return (
      <div key={card.key} className="relative group">
        <div
          onClick={() => toggleFilter(card.key)}
          className={cn(
            "px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border text-left transition-all duration-150 flex items-center justify-between gap-1.5 cursor-pointer select-none relative overflow-hidden",
            card.border,
            isSelected
              ? "bg-emerald-50/60 border-[#0D7A5F] ring-1.5 ring-[#0D7A5F] shadow-2xs"
              : "bg-[#FAFAFA] hover:bg-white hover:border-[#D4D4D8] hover:shadow-2xs"
          )}
        >
          {/* Left: Icon + Label & Sublabel */}
          <div className="flex items-center gap-2 min-w-0 pr-1">
            <div
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                card.bg,
                card.color
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-[#18181B] truncate block leading-tight">
                  {card.label}
                </span>
                {card.badgeAlert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                )}
              </div>
              <span className="text-[9.5px] text-[#71717A] truncate block leading-tight mt-0.5 font-medium">
                {card.sublabel}
              </span>
            </div>
          </div>

          {/* Right: Count & Jobs Dropdown trigger */}
          <div className="flex flex-col items-end shrink-0 pl-1">
            <span className="font-mono text-base font-bold text-[#18181B] leading-none">
              {card.count}
            </span>
            {card.count > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDropdownOpen) {
                    setOpenKpiCardDropdown(null);
                    setKpiSearchQuery("");
                  } else {
                    setOpenKpiCardDropdown(card.key);
                    setKpiSearchQuery("");
                  }
                }}
                title={`View all ${card.count} jobs in dropdown`}
                className="text-[9px] text-[#0D7A5F] hover:text-[#0A624C] hover:underline font-bold flex items-center gap-0.5 transition leading-none mt-1"
              >
                <span>Jobs ▾</span>
              </button>
            ) : (
              <span className="text-[9px] text-transparent select-none leading-none mt-1">—</span>
            )}
          </div>
        </div>

        {/* Searchable Dropdown Popover displaying jobs matching this specific KPI */}
        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setOpenKpiCardDropdown(null);
                setKpiSearchQuery("");
              }}
            />
            <div
              className={cn(
                "absolute top-full mt-1.5 z-50 bg-white border border-[#EDEDED] rounded-xl shadow-2xl w-80 sm:w-96 max-h-96 flex flex-col p-2.5 text-xs animate-in fade-in zoom-in-95",
                alignRight ? "right-0" : "left-0"
              )}
            >
              {/* Popover Header */}
              <div className="px-2 py-1.5 flex items-center justify-between bg-[#FAFAFA] border border-[#F4F4F5] rounded-lg mb-2">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-[10px] text-[#18181B] uppercase tracking-wider truncate">
                    {card.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white border border-[#EDEDED] px-1.5 py-0.2 rounded text-[#0D7A5F]">
                    {filteredJobs.length}{q ? ` / ${cardJobs.length}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenKpiCardDropdown(null);
                    setKpiSearchQuery("");
                  }}
                  className="text-[#71717A] hover:text-[#18181B] text-xs p-1 rounded hover:bg-[#EDEDED] transition leading-none"
                  title="Close dropdown"
                >
                  ✕
                </button>
              </div>

              {/* Searchable Input Bar */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={kpiSearchQuery}
                  onChange={(e) => setKpiSearchQuery(e.target.value)}
                  placeholder="Search by job #, customer, tech, status..."
                  autoFocus
                  className="w-full pl-9 pr-7 py-1.5 bg-[#F9FAFB] hover:bg-white focus:bg-white border border-[#EDEDED] focus:border-[#0D7A5F] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none transition shadow-2xs"
                />
                {kpiSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setKpiSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#18181B] p-0.5 rounded transition"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Jobs List container with smooth scroll */}
              <div className="overflow-y-auto max-h-72 space-y-1 divide-y divide-[#F4F4F5] pr-1">
                {filteredJobs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#71717A] space-y-1.5">
                    <p>No jobs found{q ? ` matching "${kpiSearchQuery}"` : ""}.</p>
                    {q && (
                      <button
                        type="button"
                        onClick={() => setKpiSearchQuery("")}
                        className="text-[11px] text-[#0D7A5F] font-semibold hover:underline"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                ) : (
                  filteredJobs.map((j: any) => (
                    <a
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      onClick={() => {
                        setOpenKpiCardDropdown(null);
                        setKpiSearchQuery("");
                      }}
                      className="p-2 hover:bg-[#F9FAFB] rounded-lg block transition space-y-0.5 group/item pt-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[#0D7A5F] group-hover/item:underline">
                          {j.jobNumber}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#F4F4F5] text-[#52525B]">
                          {j.status}
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-[#18181B] truncate">
                        {j.customer?.name || "Customer"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[#71717A]">
                        <span className="truncate max-w-[170px]">
                          Tech: {j.assignedTechnician?.name || "Unassigned"}
                        </span>
                        {j.items && j.items.length > 0 && (
                          <span className="bg-[#F4F4F5] px-1.5 py-0.2 rounded font-medium">
                            {j.items.length} items
                          </span>
                        )}
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

    return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[#EDEDED] p-3 sm:p-3.5 shadow-2xs space-y-2.5",
        className
      )}
    >
      {/* Header with Active Filter Indicator, Section Switcher & Collapse Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#F4F4F5]">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F]">
            <Activity className="w-3 h-3" />
          </div>
          <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            {isDispatcher
              ? "Dispatcher Operations Overview"
              : isAccountant
              ? "Dispatch Operations & Financial Clearance"
              : "Dispatch Operations & Request Overview"}
          </h2>
          <span className="text-[10px] text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full font-medium">
            {jobs.length} Total Jobs
          </span>
          {!isDispatcher && isAccountant && (jobsWithPendingExpenses.length > 0 || jobsWithPendingCashHandover.length > 0) && (
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {jobsWithPendingExpenses.length} Exp & {jobsWithPendingCashHandover.length} Cash Handover Pending
            </span>
          )}
        </div>

        {/* Center / Right: Section Switcher Pills + Filter Dropdown + Collapse Button */}
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Section Filter Pills */}
          <div className="flex items-center gap-0.5 bg-[#F4F4F5] p-0.5 rounded-lg border border-[#E4E4E7] text-[11px]">
            <button
              type="button"
              onClick={() => handleSectionChange("all")}
              className={cn(
                "px-2 py-0.5 rounded font-semibold transition text-xs",
                activeSection === "all"
                  ? "bg-white text-[#18181B] shadow-2xs font-bold"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              All ({lifecycleCards.length + (isAccountant && !isDispatcher ? financialCards.length : 0) + (!isDispatcher ? requestCards.length : 0)})
            </button>
            <button
              type="button"
              onClick={() => handleSectionChange("pipeline")}
              className={cn(
                "px-2 py-0.5 rounded font-semibold transition text-xs",
                activeSection === "pipeline"
                  ? "bg-white text-[#18181B] shadow-2xs font-bold"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              Pipeline ({lifecycleCards.length})
            </button>
            {!isDispatcher && isAccountant && (
              <button
                type="button"
                onClick={() => handleSectionChange("financial")}
                className={cn(
                  "px-2 py-0.5 rounded font-semibold transition text-xs",
                  activeSection === "financial"
                    ? "bg-white text-[#18181B] shadow-2xs font-bold"
                    : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                Cash & Clearance ({financialCards.length})
              </button>
            )}
            {!isDispatcher && (
              <button
                type="button"
                onClick={() => handleSectionChange("materials")}
                className={cn(
                  "px-2 py-0.5 rounded font-semibold transition text-xs",
                  activeSection === "materials"
                    ? "bg-white text-[#18181B] shadow-2xs font-bold"
                    : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                Materials & Discounts ({requestCards.length})
              </button>
            )}
          </div>

          {/* Quick KPI Dropdown Selector */}
          <div className="relative">
            <select
              aria-label="Filter jobs by KPI"
              value={activeFilter || ""}
              onChange={(e) => onFilterSelect(e.target.value || null)}
              className="text-xs font-semibold bg-[#F4F4F5] hover:bg-white border border-[#EDEDED] focus:border-[#0D7A5F] rounded-lg px-2.5 py-1 text-[#18181B] focus:outline-none transition cursor-pointer shadow-2xs"
            >
              <option value="">▼ Filter by KPI (All {jobs.length} Jobs)</option>
              <optgroup label="Lifecycle Pipeline">
                {lifecycleCards.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </optgroup>
              {!isDispatcher && (
                <>
                  <optgroup label="Cash Recovery & Financials">
                    {financialCards.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} ({c.count})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Materials & Discounts">
                    {requestCards.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} ({c.count})
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          {/* Active Filter Badge */}
          {activeFilter && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#0D7A5F] font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                <span className="truncate max-w-[140px]">
                  {activeFilter.replace(/_/g, " ").toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => onFilterSelect(null)}
                  className="hover:text-emerald-900 transition p-0.5 rounded"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={handleCollapseToggle}
            className="h-7 px-2 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] text-xs font-semibold text-[#52525B] inline-flex items-center gap-1 transition"
            title={isCollapsed ? "Expand KPI overview" : "Collapse KPI overview"}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
                <span className="hidden sm:inline">Show</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-[#71717A]" />
                <span className="hidden sm:inline">Hide</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Content (Collapsible) */}
      {!isCollapsed && (
        <div className="space-y-2 pt-0.5">
          {/* Row 1: Job Lifecycle Pipeline (6 cards) — VISIBLE TO ALL ROLES INCLUDING DISPATCHER */}
          {(activeSection === "all" || activeSection === "pipeline") && (
            <div className="space-y-1">
              {activeSection === "all" && (
                <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                  Work Order Lifecycle Pipeline
                </span>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {lifecycleCards.map((c, idx) => renderKpiCard(c, idx))}
              </div>
            </div>
          )}

          {/* Row 2: Technician Expense Clearance & Cash Recovery (Accountant/Admin View - STRICTLY HIDDEN FOR DISPATCHER) */}
          {!isDispatcher && isAccountant && (activeSection === "all" || activeSection === "financial") && (
            <div className={cn("space-y-1", activeSection === "all" && "pt-1.5 border-t border-[#F4F4F5]")}>
              {activeSection === "all" && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#0D7A5F] tracking-wider flex items-center gap-1.5">
                    <Banknote className="w-3 h-3 text-[#0D7A5F]" />
                    Technician Financial Clearance & Cash Recovery (Accountant)
                  </span>
                  <span className="text-[9.5px] text-[#71717A]">
                    Click card to filter jobs list • Click Jobs ▾ for list
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {financialCards.map((c, idx) => renderKpiCard(c, idx))}
              </div>
            </div>
          )}

          {/* Row 3: Stock & Discount Requests (STRICTLY HIDDEN FOR DISPATCHER) */}
          {!isDispatcher && (activeSection === "all" || activeSection === "materials") && (
            <div className={cn("space-y-1", activeSection === "all" && "pt-1.5 border-t border-[#F4F4F5]")}>
              {activeSection === "all" && (
                <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                  Material Dispatches & Discount Authorizations
                </span>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {requestCards.map((c, idx) => renderKpiCard(c, idx))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
