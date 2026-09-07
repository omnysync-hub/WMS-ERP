"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Receipt, Check, Upload } from "lucide-react";

interface QuickExpenseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  technicianId: string;
  onExpenseLogged?: () => void;
}

export default function QuickExpenseDrawer({
  isOpen,
  onClose,
  jobId,
  technicianId,
  onExpenseLogged,
}: QuickExpenseDrawerProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !note.trim()) {
      setErrorMsg("Amount and expense description are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${jobId}/expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId,
          amount: Number(amount),
          note,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onExpenseLogged?.();
      setAmount("");
      setNote("");
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
      title="Log Technician Field Expense"
      subtitle="Record emergency parts, fuel, or parking reimbursement"
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
            {isSubmitting ? "Logging..." : "Log Expense"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div
            id="exp-error"
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg font-medium"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Expense Amount ($) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] font-mono">$</span>
            <input
              type="number"
              required
              min="0.5"
              step="0.5"
              placeholder="e.g. 25.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby={errorMsg ? "exp-error" : undefined}
              className="w-full bg-[#F4F4F5] pl-8 pr-3 py-2 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Expense Description / Notes *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g. Purchased emergency Teflon seals & duct tape from hardware store"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>

        {/* Receipt Upload Mock */}
        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Attach Receipt Photo (Optional)
          </label>
          <div className="border-2 border-dashed border-[#E4E4E7] rounded-xl p-4 text-center hover:bg-[#F4F4F5] cursor-pointer transition">
            <Upload className="w-5 h-5 text-[#71717A] mx-auto mb-1" />
            <p className="text-xs text-[#71717A]">
              Click to select receipt image or drag here
            </p>
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
