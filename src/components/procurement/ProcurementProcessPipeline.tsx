"use client";

import React from "react";
import {
  FileText,
  CheckCircle2,
  Scale,
  ShoppingCart,
  PackageCheck,
  ShieldAlert,
  CreditCard,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcurementStage =
  | "approvals"
  | "prs"
  | "rfqs"
  | "pos"
  | "grns"
  | "invoices"
  | "payments"
  | "vendors"
  | "reports";

interface ProcessPipelineProps {
  activeTab: ProcurementStage;
  onSelectTab: (tab: ProcurementStage) => void;
  metrics: {
    pendingPrsCount: number;
    openPosCount: number;
    overdueDeliveriesCount: number;
    grnPendingInvoiceCount: number;
    activeVendorsCount: number;
    pendingApprovalsCount?: number;
  };
}

export default function ProcurementProcessPipeline({
  activeTab,
  onSelectTab,
  metrics,
}: ProcessPipelineProps) {
  const stages = [
    {
      id: "approvals" as ProcurementStage,
      step: "★",
      label: "Approvals Hub",
      subtext: "PR, PO & Bill Clearances",
      icon: ShieldAlert,
      badge:
        metrics.pendingApprovalsCount && metrics.pendingApprovalsCount > 0
          ? `${metrics.pendingApprovalsCount} action items`
          : null,
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
    },
    {
      id: "prs" as ProcurementStage,
      step: "1",
      label: "Requisition",
      subtext: "Site / Store / Job Needs",
      icon: FileText,
      badge: metrics.pendingPrsCount > 0 ? `${metrics.pendingPrsCount} pending` : null,
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      id: "rfqs" as ProcurementStage,
      step: "2",
      label: "RFQ / Sourcing",
      subtext: "Competitive Bidding",
      icon: Scale,
      badge: "Matrix",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      id: "pos" as ProcurementStage,
      step: "3",
      label: "Purchase Order",
      subtext: "Standard, Blanket, Service",
      icon: ShoppingCart,
      badge: metrics.openPosCount > 0 ? `${metrics.openPosCount} open` : null,
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "grns" as ProcurementStage,
      step: "4",
      label: "Goods Receipt",
      subtext: "Inventory & GR/IR (2050)",
      icon: PackageCheck,
      badge: metrics.grnPendingInvoiceCount > 0 ? `${metrics.grnPendingInvoiceCount} unbilled` : null,
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "invoices" as ProcurementStage,
      step: "5",
      label: "3-Way Match",
      subtext: "PO vs GRN vs Vendor Bill",
      icon: ShieldAlert,
      badge: "Audit Gate",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    },
    {
      id: "payments" as ProcurementStage,
      step: "6",
      label: "Payment",
      subtext: "AP Settlement & WHT",
      icon: CreditCard,
      badge: null,
      badgeColor: "",
    },
    {
      id: "reports" as ProcurementStage,
      step: "7",
      label: "7 Reports",
      subtext: "Intelligence & Cycle Time",
      icon: BarChart3,
      badge: "Analytics",
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    },
  ];

  return (
    <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 shadow-2xs overflow-x-auto">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0D7A5F] animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
            Procurement Lifecycle State Machine
          </span>
        </div>
        <span className="text-[11px] text-[#A1A1AA] font-mono">
          Strict Compliance: Double-Entry GL + 3-Way Tolerances
        </span>
      </div>

      <div className="flex items-center gap-2 min-w-[920px]">
        {stages.map((st, idx) => {
          const isActive = activeTab === st.id;
          const Icon = st.icon;

          return (
            <React.Fragment key={st.id}>
              <button
                type="button"
                onClick={() => onSelectTab(st.id)}
                className={cn(
                  "flex-1 group relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 select-none",
                  isActive
                    ? "bg-emerald-50/70 border-[#0D7A5F] shadow-xs ring-1 ring-[#0D7A5F]/40"
                    : "bg-[#FAFAFA] border-[#E4E4E7] hover:border-[#D4D4D8] hover:bg-white"
                )}
              >
                <div className="w-full flex items-center justify-between mb-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors",
                      isActive
                        ? "bg-[#0D7A5F] text-white"
                        : "bg-[#F4F4F5] text-[#71717A] group-hover:text-[#18181B]"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {st.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full border font-medium font-mono",
                        st.badgeColor
                      )}
                    >
                      {st.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#A1A1AA] font-mono font-bold">
                      {st.step}.
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold tracking-tight leading-none",
                        isActive ? "text-[#0D7A5F]" : "text-[#18181B] group-hover:text-[#0D7A5F]"
                      )}
                    >
                      {st.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#71717A] line-clamp-1">
                    {st.subtext}
                  </p>
                </div>
              </button>

              {idx < stages.length - 1 && (
                <div className="text-[#D4D4D8] shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
