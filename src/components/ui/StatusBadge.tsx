import React from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  CheckCheck,
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  User,
  ShieldCheck,
  Lock,
  PauseCircle,
  ArrowRightLeft,
  Building,
} from "lucide-react";

export type BadgeStatus =
  | "Created"
  | "Assigned"
  | "Accepted"
  | "InProgress"
  | "Paused"
  | "CompletedPendingVerification"
  | "Finalized"
  | "Verified"
  | "AwaitingFeedback"
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
  size?: "sm" | "md";
}

function formatStatusText(raw: string): string {
  if (!raw) return "";

  // Dedicated human-friendly overrides
  const lower = raw.toLowerCase().trim();
  if (lower === "completedpendingverification") return "Pending Verification";
  if (lower === "awaitingfeedback") return "Awaiting Feedback";
  if (lower === "inprogress") return "In Progress";
  if (lower === "technicianreassigned") return "Technician Reassigned";
  if (lower === "no_answer" || lower === "noanswer") return "No Answer";
  if (lower === "careof" || lower === "care-of") return "Care Of";

  // General PascalCase / camelCase / snake_case converter
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().replace(/[\s_-]+/g, "");
  const formattedLabel = formatStatusText(status);

  let bgClass = "bg-zinc-100 text-zinc-700 border-zinc-200/90";
  let icon: React.ReactNode = null;
  let customPulse: React.ReactNode = null;

  if (
    [
      "verified",
      "completed",
      "paid",
      "approved",
      "pass",
      "clean",
      "fulfilled",
      "received",
      "matched",
    ].includes(normalized)
  ) {
    // Green (positive/complete/approved) - WCAG AA compliant text on background
    bgClass = "bg-emerald-50 text-emerald-800 border-emerald-200/90";
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  } else if (normalized === "finalized") {
    // Slate / Dark emerald finalized state
    bgClass = "bg-slate-100 text-slate-800 border-slate-300";
    icon = <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
  } else if (normalized === "awaitingfeedback") {
    // Violet / Purple - customer feedback stage
    bgClass = "bg-violet-50 text-violet-800 border-violet-200/90";
    icon = <MessageSquare className="w-3.5 h-3.5 text-violet-600 shrink-0" />;
  } else if (normalized === "assigned") {
    // Sky blue - freshly dispatched / assigned to technician
    bgClass = "bg-sky-50 text-sky-800 border-sky-200/90";
    icon = <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
  } else if (normalized === "accepted") {
    // Teal - accepted by field technician
    bgClass = "bg-teal-50 text-teal-800 border-teal-200/90";
    icon = <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
  } else if (
    ["inprogress", "active", "processing", "delivering", "running"].includes(normalized)
  ) {
    // Blue with animated pulse indicator
    bgClass = "bg-blue-50 text-blue-800 border-blue-200/90";
    customPulse = (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
      </span>
    );
  } else if (
    [
      "completedpendingverification",
      "pendingverification",
      "pending",
      "issued",
      "rescheduled",
      "scheduled",
      "awaitingack",
    ].includes(normalized)
  ) {
    // Amber / Honey - awaiting next action
    bgClass = "bg-amber-50 text-amber-800 border-amber-200/90";
    icon = <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
  } else if (
    [
      "disapproved",
      "fail",
      "failed",
      "disputed",
      "rejected",
      "blocked",
      "cancelled",
      "canceled",
      "overdue",
    ].includes(normalized)
  ) {
    // Rose / Red (action required / dispute)
    bgClass = "bg-rose-50 text-rose-800 border-rose-200/90";
    icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
  } else if (["paused", "onhold", "hold"].includes(normalized)) {
    // Warm paused pill
    bgClass = "bg-amber-100/70 text-amber-900 border-amber-300";
    icon = <PauseCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />;
  } else if (["technicianreassigned", "reassigned"].includes(normalized)) {
    // Indigo / Violet
    bgClass = "bg-indigo-50 text-indigo-800 border-indigo-200/90";
    icon = <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
  } else if (["customer", "careof", "subcontract"].includes(normalized)) {
    // Purple
    bgClass = "bg-purple-50 text-purple-800 border-purple-200/90";
    icon = <Building className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
  } else if (["draft", "created", "notstarted", "planning", "new"].includes(normalized)) {
    // Neutral grey
    bgClass = "bg-zinc-100 text-zinc-700 border-zinc-200/90";
    icon = <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
  }

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold tracking-tight border shadow-2xs whitespace-nowrap transition-colors",
        sizeClasses,
        bgClass,
        className
      )}
    >
      {customPulse || icon}
      <span>{formattedLabel}</span>
    </span>
  );
}
