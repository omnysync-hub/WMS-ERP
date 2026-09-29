"use client";

import React, { useState, useEffect } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  Banknote,
  CheckCircle2,
  AlertTriangle,
  User,
  ArrowDownLeft,
  Building,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ReceiveTechnicianCashDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  settlement?: any | null; // specific settlement being acknowledged, if any
  currentAccountantName?: string;
  onSuccess?: () => void;
}

export default function ReceiveTechnicianCashDrawer({
  isOpen,
  onClose,
  job,
  settlement,
  currentAccountantName = "Accountant",
  onSuccess,
}: ReceiveTechnicianCashDrawerProps) {
  // Amount customer paid to technician
  const technicianCollectedAmount = settlement
    ? Number(settlement.amountCollected) || 0
    : 0;

  // Already received by accountant from this settlement (if editing/updating)
  const alreadyReceived = settlement
    ? Number(settlement.amountReceivedByAccountant) || 0
    : 0;

  const defaultHandover = technicianCollectedAmount > 0
    ? technicianCollectedAmount
    : Number(job?.hisaabSettlements?.filter((st: any) => st.status !== "superseded").reduce((s: number, st: any) => s + (st.amountCollected || 0), 0)) || 0;

  const [amountReceived, setAmountReceived] = useState<string>(String(defaultHandover || ""));
  const [depositAccount, setDepositAccount] = useState("1000 - Cash on Hand (Main Office Safe)");
  const [receivedBy, setReceivedBy] = useState(currentAccountantName);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      const initial = settlement?.amountReceivedByAccountant !== undefined && settlement?.amountReceivedByAccountant !== null
        ? String(settlement.amountReceivedByAccountant)
        : defaultHandover > 0
        ? String(defaultHandover)
        : "";
      setAmountReceived(initial);
      setDepositAccount(settlement?.accountantDepositAccount || "1000 - Cash on Hand (Main Office Safe)");
      setReceivedBy(currentAccountantName);
      setNotes(settlement?.accountantNotes || "");
      setErrorMsg("");
    }
  }, [isOpen, settlement, defaultHandover, currentAccountantName]);

  const numReceived = Number(amountReceived) || 0;
  const numCollected = technicianCollectedAmount || defaultHandover;
  const difference = numCollected - numReceived;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numReceived || numReceived <= 0) {
      setErrorMsg("Please enter a valid cash amount received from the technician.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_technician_cash_handover",
          settlementId: settlement?.id || null,
          amountReceived: numReceived,
          technicianId: settlement?.technicianId || job.assignedTechnicianId,
          depositAccount,
          notes: notes || "Physically received cash handover from field technician in office",
          actor: receivedBy || currentAccountantName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record cash handover");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const techName = job?.assignedTechnician?.name || settlement?.settledBy || "Technician";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Record Technician Cash Handover"
      subtitle={`Receive customer collection from ${techName} • Work Order ${job?.jobNumber}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Context Info Banner */}
        <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E4E4E7] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#71717A] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Assigned Field Technician
            </span>
            <span className="font-bold text-[#18181B] text-xs">{techName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#71717A] flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              Customer Cash Collected by Tech
            </span>
            <span className="font-mono font-bold text-emerald-700 text-sm">
              {formatCurrency(numCollected)}
            </span>
          </div>
          {settlement?.settledAt && (
            <div className="flex items-center justify-between pt-1 border-t border-[#EDEDED] text-[11px] text-[#71717A]">
              <span>Customer Collection Logged:</span>
              <span className="font-mono">
                {new Date(settlement.settledAt).toLocaleDateString()} at{" "}
                {new Date(settlement.settledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Amount Received from Tech Input */}
        <div className="space-y-1.5">
          <label className="block font-bold text-[#18181B] text-xs">
            Amount Handed Over by Technician (PKR) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#71717A] text-xs font-mono">
              PKR
            </span>
            <input
              type="number"
              step="any"
              min="1"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-[#D4D4D8] focus:border-[#0D7A5F] focus:outline-none text-base font-mono font-bold text-[#18181B]"
              required
            />
          </div>

          {/* Quick preset buttons */}
          {numCollected > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAmountReceived(String(numCollected))}
                className="text-[11px] font-semibold text-[#0D7A5F] hover:text-[#0A624C] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition"
              >
                Full Collection ({formatCurrency(numCollected)})
              </button>
              {alreadyReceived > 0 && (
                <span className="text-[11px] text-[#71717A]">
                  Previously logged: {formatCurrency(alreadyReceived)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Live Reconciliation Status */}
        {numReceived > 0 && numCollected > 0 && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              difference === 0
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : difference > 0
                ? "bg-amber-50/80 border-amber-200 text-amber-900"
                : "bg-blue-50/80 border-blue-200 text-blue-900"
            }`}
          >
            {difference === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              {difference === 0 ? (
                <p className="font-bold">
                  ✓ Full Collection Handed Over
                </p>
              ) : difference > 0 ? (
                <p className="font-bold">
                  ⚠ Partial Handover: {formatCurrency(difference)} remains with technician
                </p>
              ) : (
                <p className="font-bold">
                  Excess Received: {formatCurrency(Math.abs(difference))} above reported collection
                </p>
              )}
              <p className="text-[11px] opacity-90">
                {difference === 0
                  ? "Technician cash collection for this job will be marked fully reconciled."
                  : `Technician ledger will reflect ${formatCurrency(difference)} still outstanding.`}
              </p>
            </div>
          </div>
        )}

        {/* Deposit Destination Account */}
        <div className="space-y-1.5">
          <label className="block font-semibold text-[#52525B] text-xs">
            Deposit Into Account / Vault *
          </label>
          <select
            value={depositAccount}
            onChange={(e) => setDepositAccount(e.target.value)}
            className="w-full bg-white p-2.5 rounded-lg border border-[#D4D4D8] focus:border-[#0D7A5F] focus:outline-none text-xs text-[#18181B]"
          >
            <option value="1000 - Cash on Hand (Main Office Safe)">
              1000 — Cash on Hand (Main Office Safe / Vault)
            </option>
            <option value="1010 - Petty Cash Drawer (Accounts)">
              1010 — Petty Cash Drawer (Accounts)
            </option>
            <option value="1020 - Direct Bank Deposit">
              1020 — Bank Account Direct Deposit
            </option>
          </select>
        </div>

        {/* Received By Field */}
        <div className="space-y-1.5">
          <label className="block font-semibold text-[#52525B] text-xs">
            Received By (Accountant / Cashier) *
          </label>
          <input
            type="text"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            className="w-full bg-white p-2.5 rounded-lg border border-[#D4D4D8] focus:border-[#0D7A5F] focus:outline-none text-xs text-[#18181B]"
            required
          />
        </div>

        {/* Handover Remarks / Physical Note */}
        <div className="space-y-1.5">
          <label className="block font-semibold text-[#52525B] text-xs">
            Receipt Notes / Reconciled Remarks (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Physical currency counted and placed into office safe. Customer receipt verified."
            className="w-full bg-white p-2.5 rounded-lg border border-[#D4D4D8] focus:border-[#0D7A5F] focus:outline-none text-xs text-[#18181B]"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#EDEDED]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-[#52525B] hover:text-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0A624C] rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? "Recording Handover..." : "Confirm & Record Cash Received"}</span>
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
