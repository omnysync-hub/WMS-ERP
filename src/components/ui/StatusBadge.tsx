import React from "react";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, Clock, XCircle, FileText } from "lucide-react";

export type BadgeStatus =
  | "Created"
  | "Assigned"
  | "Accepted"
  | "InProgress"
  | "Paused"
  | "CompletedPendingVerification"
  | "Finalized"
  | "Verified"
  | "Draft"
  | "Approved"
  | "Paid"
  | "pass"
  | "fail"
  | "clean"
  | "disputed"
  | "issued"
  | "completed"
  | "pending"
  | "approved"
  | "disapproved"
  | "no_answer"
  | "rescheduled"
  | string;

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() || "";

  let bgClass = "bg-[#F4F4F5] text-[#3F3F46] border-[#E4E4E7]";
  let icon = null;
  let label = status;

  if (
    [
      "verified",
      "completed",
      "paid",
      "approved",
      "pass",
      "clean",
      "finalized",
    ].includes(normalized)
  ) {
    // Green (positive/complete/approved) - WCAG AA compliant text on background
    bgClass = "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";
    icon = <Check className="w-3 h-3 stroke-[2.5]" />;
  } else if (
    [
      "inprogress",
      "in progress",
      "assigned",
      "accepted",
      "pending",
      "completedpendingverification",
      "issued",
      "rescheduled",
    ].includes(normalized)
  ) {
    // Amber (pending/in-progress)
    bgClass = "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]";
    icon = <Clock className="w-3 h-3 stroke-[2]" />;
    if (normalized === "completedpendingverification") {
      label = "Pending Verification";
    }
  } else if (
    ["disapproved", "fail", "disputed", "rejected", "blocked", "paused", "overdue"].includes(
      normalized
    )
  ) {
    // Red (overdue/disapproved/blocked) - includes visible icon for colorblind accessibility
    bgClass = "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]";
    icon = <AlertTriangle className="w-3 h-3 stroke-[2]" />;
  } else if (["customer", "careof", "care-of", "subcontract"].includes(normalized)) {
    // Purple / Blue (customer/lifecycle)
    bgClass = "bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]";
  } else if (["draft", "created", "not started", "planning"].includes(normalized)) {
    // Grey (draft/inactive)
    bgClass = "bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]";
    icon = <FileText className="w-3 h-3 stroke-[2]" />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-tight border",
        bgClass,
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
