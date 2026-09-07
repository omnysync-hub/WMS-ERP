"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Percent, Check, AlertCircle } from "lucide-react";

interface DiscountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  onDiscountApplied?: () => void;
}

export default function DiscountDrawer({
  isOpen,
  onClose,
  jobId,
  jobNumber,
  onDiscountApplied,
}: DiscountDrawerProps) {
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountAmount || Number(discountAmount) <= 0) {
      setErrorMsg("Please enter a valid discount amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discount",
          discountAmount: Number(discountAmount),
          reason: discountReason || "Accountant phone approval",
          actor: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onDiscountApplied?.();
      setDiscountAmount("");
      setDiscountReason("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Approve Mid-Job Discount"
      subtitle={`Apply authorized discount to Work Order ${jobNumber}`}
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
            {isSubmitting ? "Applying..." : "Apply Discount"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-lg text-xs leading-relaxed">
          <strong>Accountant Authorization:</strong> This reduces the expected customer payment and synchronizes live to the technician's mobile view.
        </div>

        {errorMsg && (
          <div
            id="disc-error"
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg font-medium"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Discount Amount ($) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] font-mono">$</span>
            <input
              type="number"
              required
              min="1"
              placeholder="e.g. 50"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              aria-describedby={errorMsg ? "disc-error" : undefined}
              className="w-full bg-[#F4F4F5] pl-8 pr-3 py-2 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Reason Code / Authorization Notes *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g. Customer negotiated discount via technician on-site phone call"
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
