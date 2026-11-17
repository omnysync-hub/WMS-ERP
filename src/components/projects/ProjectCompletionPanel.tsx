"use client";

import React, { useState } from "react";
import { ClipboardCheck, Send, Check, X, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface ProjectCompletionPanelProps {
  projectId: string;
  projectStatus: string; // planning, active, completed, on_hold
  completionStatus?: string | null; // none | submitted | auditor_approved | auditor_rejected | billed
  finalBillInvoiceId?: string | null;
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  none: { label: "Not Submitted", cls: "bg-[#F4F4F5] text-[#52525B]" },
  submitted: { label: "Awaiting Auditor", cls: "bg-amber-100 text-amber-800" },
  auditor_approved: { label: "Auditor Approved", cls: "bg-emerald-100 text-emerald-800" },
  auditor_rejected: { label: "Auditor Rejected", cls: "bg-rose-100 text-rose-800" },
  billed: { label: "Final Bill Created", cls: "bg-blue-100 text-blue-800" },
};

const btnPrimary =
  "h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50";
const btnGhost =
  "h-8 px-2.5 rounded-lg border border-[#D4D4D8] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#52525B] inline-flex items-center gap-1.5 transition disabled:opacity-50";

export default function ProjectCompletionPanel({
  projectId,
  projectStatus,
  completionStatus,
  finalBillInvoiceId,
  onRefresh,
  showToast,
}: ProjectCompletionPanelProps) {
  const { hasPermission } = useRole();
  const [busy, setBusy] = useState(false);

  const status = (completionStatus || "none").toLowerCase();
  const meta = STATUS_META[status] || STATUS_META.none;
  const canSubmit =
    hasPermission("projects.manage") &&
    projectStatus === "active" &&
    (status === "none" || status === "auditor_rejected");
  const canAudit = hasPermission("projects.audit_completion") && status === "submitted";
  const canBill =
    hasPermission("projects.create_bill") && status === "auditor_approved" && !finalBillInvoiceId;

  async function postAction(action: string, extra: Record<string, any>, successMsg: string) {
    try {
      setBusy(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Action failed");
      }
      showToast(successMsg, "success");
      onRefresh();
    } catch (e: any) {
      showToast(e.message || "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#0D7A5F]" />
            Project Completion & Final Bill
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", meta.cls)}>
              {meta.label}
            </span>
          </h3>
          <p className="text-[11px] text-[#71717A] mt-1">
            On completion the project goes to the Auditor. Once the Auditor approves, the final
            bill is created from here.
            {finalBillInvoiceId && (
              <span className="text-[#18181B] font-semibold"> Final bill invoice recorded.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canSubmit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction("submit_completion", {}, "Completion submitted to the Auditor.")}
              className={btnPrimary}
            >
              <Send className="w-3.5 h-3.5" /> Submit Completion
            </button>
          )}
          {canAudit && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  postAction("audit_completion", { decision: "approved" }, "Completion approved by Auditor.")
                }
                className={btnPrimary}
              >
                <Check className="w-3.5 h-3.5" /> Auditor Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  postAction("audit_completion", { decision: "rejected" }, "Completion rejected by Auditor.")
                }
                className={cn(btnGhost, "text-rose-700 border-rose-200 hover:bg-rose-50")}
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
          {canBill && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction("create_final_bill", {}, "Final bill created.")}
              className={btnPrimary}
            >
              <Receipt className="w-3.5 h-3.5" /> Create Final Bill
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
