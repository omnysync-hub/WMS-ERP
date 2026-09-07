"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { PhoneCall, Check, AlertTriangle, Clock } from "lucide-react";

interface FeedbackCallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onFeedbackSaved?: () => void;
}

export default function FeedbackCallDrawer({
  isOpen,
  onClose,
  job,
  onFeedbackSaved,
}: FeedbackCallDrawerProps) {
  const [outcome, setOutcome] = useState<"approved" | "disapproved" | "no_answer" | "rescheduled">("approved");
  const [remarks, setRemarks] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (outcome === "disapproved" && !remarks.trim()) {
      setErrorMsg("Remarks are strictly required when customer feedback is 'disapproved'.");
      return;
    }
    if ((outcome === "no_answer" || outcome === "rescheduled") && !followUpDate) {
      setErrorMsg("A follow-up date is required for no-answer or rescheduled calls.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          calledBy: "Sara Bilal (Call Center Agent)",
          outcome,
          remarks,
          followUpDate: followUpDate || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onFeedbackSaved?.();
      setRemarks("");
      setFollowUpDate("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Outbound Quality Call"
      subtitle={`Work Order ${job.jobNumber} • ${job.customer?.name}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A] hover:text-[#1A1D1F]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "Logging..." : "Log Outcome"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Customer Call Context Box */}
        <div className="p-3 bg-[#F4F4F5] rounded-xl border border-[#E4E4E7] space-y-1">
          <p className="font-bold text-[#1A1D1F] text-xs">{job.customer?.name}</p>
          <p className="text-[11px] text-[#71717A]">
            Phone: <a href={`tel:${job.customer?.phone}`} className="font-semibold text-[#0D7A5F] underline">{job.customer?.phone}</a>
          </p>
          <p className="text-[11px] text-[#71717A]">
            Service: {job.jobType} • Tech: {job.assignedTechnician?.name || "Unassigned"}
          </p>
        </div>

        {errorMsg && (
          <div
            id="call-error"
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg font-medium"
          >
            {errorMsg}
          </div>
        )}

        {/* Outcome Radio Options */}
        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-2">
            Call Outcome *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "approved", label: "Approved (Satisfied)", color: "emerald" },
              { val: "disapproved", label: "Disapproved (Issue)", color: "rose" },
              { val: "no_answer", label: "No Answer", color: "amber" },
              { val: "rescheduled", label: "Rescheduled", color: "blue" },
            ].map((opt) => (
              <label
                key={opt.val}
                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer flex items-center gap-2 transition ${
                  outcome === opt.val
                    ? "bg-[#0D7A5F] text-white border-[#0D7A5F] shadow-xs"
                    : "bg-white text-[#1A1D1F] border-[#E4E4E7] hover:bg-[#F4F4F5]"
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={opt.val}
                  checked={outcome === opt.val}
                  onChange={() => setOutcome(opt.val as any)}
                  className="hidden"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Remarks (Mandatory on Disapproved) */}
        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Customer Remarks {outcome === "disapproved" && <span className="text-[#991B1B] font-bold">* (Required)</span>}
          </label>
          <textarea
            rows={3}
            placeholder="Record verbatim customer remarks, concerns, or satisfaction..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            aria-describedby={errorMsg ? "call-error" : undefined}
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>

        {/* Follow-up Date (Mandatory for No Answer / Rescheduled) */}
        {(outcome === "no_answer" || outcome === "rescheduled") && (
          <div className="animate-in fade-in">
            <label className="font-semibold text-[#1A1D1F] block mb-1">
              Follow-Up Callback Date *
            </label>
            <input
              type="date"
              required
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>
        )}
      </form>
    </SideDrawer>
  );
}
