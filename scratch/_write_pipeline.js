const fs = require("fs");
const path = require("path");
const root = "D:\\WORKMAN SERVICES";

const pipeline = `"use client";

import React from "react";
import {
  FileText,
  Scale,
  ShoppingCart,
  PackageCheck,
  ShieldAlert,
  CreditCard,
  BarChart3,
  Building2,
  ChevronRight,
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
  allowedStages?: ProcurementStage[];
  metrics?: {
    pendingPrsCount?: number;
    openPosCount?: number;
    overdueDeliveriesCount?: number;
    grnPendingInvoiceCount?: number;
    activeVendorsCount?: number;
    pendingApprovalsCount?: number;
  };
}

const STAGE_META: {
  id: ProcurementStage;
  label: string;
  icon: typeof FileText;
  flow?: boolean;
}[] = [
  { id: "approvals", label: "Approvals", icon: ShieldAlert },
  { id: "prs", label: "PR", icon: FileText, flow: true },
  { id: "rfqs", label: "RFQ", icon: Scale, flow: true },
  { id: "pos", label: "PO", icon: ShoppingCart, flow: true },
  { id: "grns", label: "GRN", icon: PackageCheck, flow: true },
  { id: "invoices", label: "Match", icon: ShieldAlert, flow: true },
  { id: "payments", label: "Pay", icon: CreditCard, flow: true },
  { id: "vendors", label: "Vendors", icon: Building2 },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

/** Slim one-line lifecycle stepper — current step bold. */
export default function ProcurementProcessPipeline({
  activeTab,
  onSelectTab,
  allowedStages,
}: ProcessPipelineProps) {
  const stages =
    allowedStages && allowedStages.length > 0
      ? STAGE_META.filter((st) => allowedStages.includes(st.id))
      : STAGE_META;

  const ordered = STAGE_META.filter((st) => stages.some((s) => s.id === st.id));

  return (
    <nav
      aria-label="Procurement lifecycle"
      className="flex items-center gap-0.5 overflow-x-auto py-1.5 px-2 bg-white border border-[#EDEDED] rounded-lg"
    >
      {ordered.map((st, idx) => {
        const isActive = activeTab === st.id;
        const Icon = st.icon;
        const showChevron =
          idx < ordered.length - 1 &&
          st.flow &&
          ordered[idx + 1]?.flow;

        return (
          <React.Fragment key={st.id}>
            <button
              type="button"
              onClick={() => onSelectTab(st.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors",
                isActive
                  ? "text-[#0D7A5F] font-bold bg-primary-light"
                  : "text-slate-500 font-medium hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5",
                  isActive ? "text-[#0D7A5F]" : "text-slate-400"
                )}
              />
              {st.label}
            </button>
            {idx < ordered.length - 1 && (
              <ChevronRight
                className={cn(
                  "w-3 h-3 shrink-0",
                  showChevron ? "text-slate-300" : "text-slate-200 opacity-40"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
`;

fs.writeFileSync(
  path.join(root, "src/components/procurement/ProcurementProcessPipeline.tsx"),
  pipeline,
  "utf8"
);
console.log("pipeline ok");