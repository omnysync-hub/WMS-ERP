"use client";

import React from "react";
import {
  Package,
  RotateCcw,
  Layers,
  X,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { cn, isServiceItem } from "@/lib/utils";

export interface StorekeeperKpiDashboardProps {
  jobs: any[];
  activeFilter: string | null;
  onFilterSelect: (filterKey: string | null) => void;
  className?: string;
}

export default function StorekeeperKpiDashboard({
  jobs,
  activeFilter,
  onFilterSelect,
  className = "",
}: StorekeeperKpiDashboardProps) {
  // Storekeeper-relevant job subset (strictly jobs with material activity or returnable equipment)
  const storekeeperJobs = jobs.filter((j) => {
    const hasInventoryReq = Boolean(j.inventoryRequests && j.inventoryRequests.length > 0);
    const hasReturns = Boolean(j.stockReturns && j.stockReturns.length > 0);
    const isDoneOrPaused = [
      "AwaitingFeedback",
      "CompletedPendingVerification",
      "Finalized",
      "Verified",
      "Paused",
    ].includes(j.status);
    const returnableQty =
      j.items?.reduce((sum: number, it: any) => {
        if (
          !isServiceItem(it) &&
          it.quantityActual !== null &&
          it.quantityActual !== undefined &&
          it.quantityPlanned > it.quantityActual
        ) {
          return sum + (it.quantityPlanned - it.quantityActual);
        }
        return sum;
      }, 0) || 0;
    return hasInventoryReq || hasReturns || (isDoneOrPaused && returnableQty > 0);
  });

  // 1. Pending Stock Requests (Action Required)
  const jobsWithPendingStock = storekeeperJobs.filter((j) =>
    j.inventoryRequests?.some((r: any) => r.status === "pending" || r.status === "partially_issued")
  );
  const pendingItemsCount = jobsWithPendingStock.reduce((acc, j) => {
    return (
      acc + (j.inventoryRequests?.filter((r: any) => r.status === "pending" || r.status === "partially_issued").length || 0)
    );
  }, 0);

  // 2. Approved / Done Requests (Fulfilled & Issued Stock)
  const jobsWithIssuedStock = storekeeperJobs.filter((j) =>
    j.inventoryRequests?.some(
      (r: any) => r.status === "issued" || r.status === "fulfilled"
    )
  );
  const issuedItemsCount = jobsWithIssuedStock.reduce((acc, j) => {
    return (
      acc +
      (j.inventoryRequests?.filter(
        (r: any) => r.status === "issued" || r.status === "fulfilled"
      ).length || 0)
    );
  }, 0);

  // 3. Unused / Returnable Stock Queue
  const returnableJobs = storekeeperJobs.filter((j) => {
    const hasReturns = Boolean(j.stockReturns && j.stockReturns.length > 0);
    const isDoneOrPaused = [
      "AwaitingFeedback",
      "CompletedPendingVerification",
      "Finalized",
      "Verified",
      "Paused",
    ].includes(j.status);
    const returnableQty =
      j.items?.reduce((sum: number, it: any) => {
        if (
          !isServiceItem(it) &&
          it.quantityActual !== null &&
          it.quantityActual !== undefined &&
          it.quantityPlanned > it.quantityActual
        ) {
          return sum + (it.quantityPlanned - it.quantityActual);
        }
        return sum;
      }, 0) || 0;
    return hasReturns || (isDoneOrPaused && returnableQty > 0);
  });
  const totalReturnableUnits = returnableJobs.reduce((sum, j) => {
    const returns = j.stockReturns || [];
    const ackedQty = returns
      .filter((r: any) => r.acknowledgedAt)
      .reduce((s: number, r: any) => s + (Number(r.qtyReturned) || 0), 0);
    const retQty =
      j.items?.reduce((s: number, it: any) => {
        if (
          !isServiceItem(it) &&
          it.quantityActual !== null &&
          it.quantityActual !== undefined &&
          it.quantityPlanned > it.quantityActual
        ) {
          return s + (it.quantityPlanned - it.quantityActual);
        }
        return s;
      }, 0) || 0;
    return sum + Math.max(0, retQty - ackedQty);
  }, 0);

  const toggleFilter = (key: string) => {
    if (activeFilter === key) {
      onFilterSelect(null);
    } else {
      onFilterSelect(key);
    }
  };

  const kpiCards = [
    {
      key: "pending_requests",
      label: "Pending Material Req",
      count: pendingItemsCount,
      sublabel: `${jobsWithPendingStock.length} work order${jobsWithPendingStock.length === 1 ? "" : "s"} waiting`,
      icon: Package,
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      activeRing: "ring-amber-500",
      badgeAlert: pendingItemsCount > 0,
      alertText: "Action Needed",
    },
    {
      key: "done_requests",
      label: "Requests Fulfilled",
      count: issuedItemsCount,
      sublabel: `${jobsWithIssuedStock.length} work order${jobsWithIssuedStock.length === 1 ? "" : "s"} fulfilled`,
      icon: CheckCircle2,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      activeRing: "ring-emerald-500",
    },
    {
      key: "returnable_stock",
      label: "Returnable Stock",
      count: returnableJobs.length,
      sublabel: `${totalReturnableUnits} estimated unit${totalReturnableUnits === 1 ? "" : "s"} to recover`,
      icon: RotateCcw,
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      activeRing: "ring-blue-500",
      badgeAlert: returnableJobs.length > 0,
      alertText: "Recoverable",
    },
    {
      key: "all_requisitions",
      label: "Total Work Orders",
      count: storekeeperJobs.length,
      sublabel: "Active inventory scope",
      icon: Layers,
      color: "text-slate-700",
      bg: "bg-slate-50",
      border: "border-slate-200",
      activeRing: "ring-slate-500",
    },
  ];

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[#EDEDED] p-3 sm:p-3.5 shadow-2xs space-y-2.5",
        className
      )}
    >
      {/* Header with Active Filter Indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#F4F4F5]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Warehouse className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#18181B] tracking-tight uppercase">
              Warehouse Material & Inventory Control
            </h4>
            <p className="text-[10px] text-[#71717A]">
              Live requisitions, pending dispatches, completed issuances, and technician returnable stock.
            </p>
          </div>
        </div>

        {activeFilter && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#71717A]">
              Filtered by:{" "}
              <strong className="text-[#18181B] capitalize font-mono">
                {activeFilter.replace(/_/g, " ")}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onFilterSelect(null)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full transition"
            >
              <X className="w-3 h-3" />
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => toggleFilter(card.key)}
              className={cn(
                "flex items-center justify-between gap-1.5 text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border transition-all duration-150 relative group cursor-pointer",
                card.bg,
                card.border,
                isSelected
                  ? `ring-1.5 ${card.activeRing} shadow-2xs`
                  : "hover:shadow-xs hover:border-zinc-400/60"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div
                  className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                    card.color,
                    "bg-white/90 border border-current/20 shadow-2xs"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn("text-[11px] font-bold tracking-tight truncate block leading-tight", card.color)}
                      title={card.label}
                    >
                      {card.label}
                    </span>
                    {card.badgeAlert && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    )}
                  </div>
                  <span className="text-[9.5px] text-[#71717A] truncate block leading-tight mt-0.5 font-medium">
                    {card.sublabel}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 pl-1">
                <span className="text-base font-mono font-bold text-[#18181B] leading-none">
                  {card.count}
                </span>
                {card.badgeAlert && card.alertText && (
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-1 py-0.2 rounded font-sans leading-none mt-1">
                    {card.alertText}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
