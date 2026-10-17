"use client";

import React, { useState, useEffect, useMemo } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatCurrency } from "@/lib/utils";
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  User,
  Building2,
  FileText,
  ShieldCheck,
  TrendingDown,
  Info,
} from "lucide-react";

interface IssueAdvanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employees: any[];
  defaultEmployeeId?: string;
  onAdvanceIssued?: () => void;
}

export default function IssueAdvanceDrawer({
  isOpen,
  onClose,
  employees = [],
  defaultEmployeeId,
  onAdvanceIssued,
}: IssueAdvanceDrawerProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setAmount("");
      setReason("");
      if (defaultEmployeeId) {
        setEmployeeId(defaultEmployeeId);
      } else if (employees.length > 0 && !employeeId) {
        setEmployeeId(employees[0].id);
      }
    }
  }, [isOpen, defaultEmployeeId, employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === employeeId) || employees[0];
  }, [employees, employeeId]);

  // Existing active advances for selected employee
  const activeAdvanceTotal = useMemo(() => {
    if (!selectedEmployee?.advances) return 0;
    return selectedEmployee.advances
      .filter((a: any) => a.status === "approved")
      .reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
  }, [selectedEmployee]);

  const salary = Number(selectedEmployee?.salary || 0);
  const maxRecommended = Math.round(salary * 0.4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg("Please enter a valid advance amount greater than 0.");
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Please provide a reason or purpose for this advance.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee?.id,
          amount: numAmount,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to issue advance");
      }

      if (onAdvanceIssued) onAdvanceIssued();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Issue Staff Salary Advance"
      subtitle="Disburse salary advance with automated ledger entry and WPS payroll recovery"
      width="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#18181B]">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Employee Selector */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Select Employee *</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.role || e.designation} ({e.department || "Operations"})
              </option>
            ))}
          </select>
        </div>

        {/* Employee Financial Context Card */}
        {selectedEmployee && (
          <div className="bg-[#F9FAFB] p-3.5 rounded-xl border border-[#EDEDED] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#71717A] text-[11px]">Monthly Base Contract:</span>
              <span className="font-mono font-bold text-[#18181B]">{formatCurrency(salary)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#71717A] text-[11px]">Outstanding Unrecovered Advances:</span>
              <span
                className={`font-mono font-bold ${
                  activeAdvanceTotal > 0 ? "text-amber-700" : "text-[#71717A]"
                }`}
              >
                {formatCurrency(activeAdvanceTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-[#EDEDED] text-[11px]">
              <span className="text-[#71717A]">Recommended 40% Monthly Cap:</span>
              <span className="font-mono font-semibold text-[#0D7A5F]">
                {formatCurrency(maxRecommended)}
              </span>
            </div>
          </div>
        )}

        {/* Advance Amount */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Advance Amount (PKR) *</label>
          <input
            type="number"
            required
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1000"
            className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
          />
          {Number(amount) > maxRecommended && maxRecommended > 0 && (
            <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Amount exceeds the standard 40% monthly salary cap ({formatCurrency(maxRecommended)}). Recovery will be staged across payroll cycles.
            </p>
          )}
        </div>

        {/* Reason / Purpose */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Reason / Justification *</label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Purpose of advance (e.g. medical emergency, transport allowance, tools)..."
            className="w-full p-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
          />
        </div>

        {/* Double-Entry Accounting Preview */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5 text-[11px]">
          <p className="font-bold text-[#18181B] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
            Automated Accounts Posting
          </p>
          <div className="text-[#71717A] space-y-0.5">
            <div className="flex justify-between">
              <span>Debit: 1120 Employee Advances Receivable</span>
              <span className="font-mono text-[#18181B]">{amount ? formatCurrency(Number(amount)) : "PKR 0"}</span>
            </div>
            <div className="flex justify-between">
              <span>Credit: 1010 Cash / Bank Account</span>
              <span className="font-mono text-[#18181B]">{amount ? formatCurrency(Number(amount)) : "PKR 0"}</span>
            </div>
            <div className="pt-1 border-t border-zinc-200 text-emerald-800 font-medium">
              Recovered automatically via monthly payroll run deduction.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EDEDED]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-zinc-300 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {isSubmitting ? "Disbursing Advance..." : "Confirm & Disburse Advance"}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
