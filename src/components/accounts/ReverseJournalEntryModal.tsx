"use client";

import React, { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";

interface ReverseJournalEntryModalProps {
  entry: any;
  onClose: () => void;
  onSuccess: (reversal: any) => void;
}

export default function ReverseJournalEntryModal({
  entry,
  onClose,
  onSuccess,
}: ReverseJournalEntryModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Please provide an audit reason for the reversal.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reverse_entry",
          entryId: entry.id,
          reason,
          actorName: "Fatima Noor (Accountant)",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reversal failed");

      onSuccess(data.reversal);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
      role="dialog"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E4E4E7] overflow-hidden">
        <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
          <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            Reverse Journal Entry Voucher
          </h3>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleReverse} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Immutable GAAP / SAP Compliance Principle
            </span>
            <span>
              To maintain a tamper-proof audit trail, posted journal entries cannot be edited or deleted.
              Submitting will post an exact equal-and-opposite reversing entry (swapping debits and credits)
              permanently linked to voucher #{entry.id.slice(0, 8).toUpperCase()}.
            </span>
          </div>

          <div className="p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl space-y-2">
            <div className="flex justify-between font-mono text-[11px] text-[#71717A]">
              <span>Voucher Date: {formatDateTime(entry.date)}</span>
              <span>Type: {entry.refType}</span>
            </div>
            <div className="font-semibold text-[#18181B] text-xs">
              Original Memo: "{entry.memo}"
            </div>
            <div className="divide-y divide-[#E4E4E7] pt-1">
              {entry.lines?.map((line: any) => (
                <div key={line.id} className="py-1 flex justify-between font-mono text-[11px]">
                  <span className="text-[#52525B]">
                    {line.account?.code} — {line.account?.name}
                  </span>
                  <span>
                    {line.debit > 0 ? `Dr: ${formatCurrency(line.debit)}` : `Cr: ${formatCurrency(line.credit)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-[#18181B] block mb-1">
              Audit Reason for Reversal <span className="text-rose-600">*</span>:
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inadvertent double-billing or erroneous expense account allocation"
              className="w-full p-2.5 bg-white border border-[#E4E4E7] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {submitting ? "Posting Reversal..." : "Confirm & Post Reversal Voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
