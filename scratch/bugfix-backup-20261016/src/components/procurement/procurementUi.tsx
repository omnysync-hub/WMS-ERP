"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

/** Calm status badge classes — slate default; amber urgent; red only for overdue/reject. */
export function procurementStatusClass(status: string | null | undefined): string {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  if (
    ["rejected", "overdue", "discrepancy", "cancelled", "canceled", "blocked", "failed"].includes(s)
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (
    [
      "submitted",
      "pending",
      "pending_match",
      "urgent",
      "hold",
      "partially_received",
      "partially_converted",
      "sent",
      "sent_to_vendor",
    ].includes(s)
  ) {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  // Normal / positive / draft — muted slate (not loud green rainbow)
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function ProcurementStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const text =
    label ||
    status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border tracking-tight",
        procurementStatusClass(status),
        className
      )}
    >
      {text}
    </span>
  );
}

export function ProcurementEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Inbox className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const PROCUREMENT_TABLE_WRAP =
  "bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs";
export const PROCUREMENT_TABLE =
  "w-full text-left border-collapse text-sm";
export const PROCUREMENT_THEAD =
  "sticky top-0 z-10 border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-medium text-[11px] uppercase tracking-wider";
export const PROCUREMENT_TH = "py-2.5 px-3";
export const PROCUREMENT_TD = "py-2 px-3";
export const CTA_PRIMARY =
  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold transition shadow-xs disabled:opacity-50";
export const CTA_GHOST =
  "inline-flex items-center gap-1 h-7 px-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition";
