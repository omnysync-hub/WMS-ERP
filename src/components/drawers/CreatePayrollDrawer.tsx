"use client";

import React, { useState, useMemo } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Play,
  Clock,
  ShieldCheck,
  TrendingDown,
  Info,
} from "lucide-react";

interface CreatePayrollDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employees: any[];
  existingRuns: any[];
  onRunCreated: (run: any) => void;
}

export default function CreatePayrollDrawer({
  isOpen,
  onClose,
  employees = [],
  existingRuns = [],
  onRunCreated,
}: CreatePayrollDrawerProps) {
  // Default to current month/year e.g. "October 2026"
  const defaultPeriod = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
  }, []);

  const [period, setPeriod] = useState(defaultPeriod);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Common recent months options
  const monthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = -1; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push(new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d));
    }
    return Array.from(new Set([defaultPeriod, ...list]));
  }, [defaultPeriod]);

  // Check if run already exists for this period
  const existingRunForPeriod = useMemo(() => {
    return existingRuns.find((r) => r.period?.toLowerCase() === period.toLowerCase());
  }, [existingRuns, period]);

  // Calculate live preview metrics for eligible active employees
  const previewData = useMemo(() => {
    return employees.map((emp) => {
      const gross = Number(emp.salary || 0);
      const pendingAdvances = (emp.advances || [])
        .filter((a: any) => a.status === "approved")
        .reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
      
      const advanceDeduction = Math.min(pendingAdvances, Math.round(gross * 0.4));
      const net = Math.max(0, gross - advanceDeduction);

      const logs = emp.attendanceLogs || [];
      const punchCount = logs.length;
      const leavesCount = (emp.leaveRequests || []).length;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role || emp.designation || "Staff",
        department: emp.department || "Operations",
        gross,
        pendingAdvances,
        advanceDeduction,
        net,
        punchCount,
        leavesCount,
      };
    });
  }, [employees]);

  const totalGross = previewData.reduce((acc, curr) => acc + curr.gross, 0);
  const totalDeductions = previewData.reduce((acc, curr) => acc + curr.advanceDeduction, 0);
  const totalNet = previewData.reduce((acc, curr) => acc + curr.net, 0);

  const handleGenerate = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const isOverwrite = existingRunForPeriod?.status === "Draft";

      const res = await fetch("/api/hrm/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate_draft",
          period,
          overwrite: isOverwrite,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate payroll draft");
      }

      onRunCreated(data);
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
      title="Create Monthly Payroll Draft"
      subtitle="Review active employee rosters, attendance records, and deductions before generating draft run"
      width="max-w-3xl"
    >
      <div className="space-y-5 text-xs text-[#18181B]">
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Existing Run Warning/Notice */}
        {existingRunForPeriod && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              existingRunForPeriod.status === "Draft"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Payroll Cycle for &apos;{period}&apos; already exists ({existingRunForPeriod.status})
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                {existingRunForPeriod.status === "Draft"
                  ? "Proceeding will recalculate and refresh the existing Draft cycle with the latest employee attendance and advances."
                  : "This cycle is already finalized or disbursed. Generating a new run for this period is blocked."}
              </p>
            </div>
          </div>
        )}

        {/* Period Selector & Cycle Config */}
        <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#EDEDED] space-y-3">
          <label className="font-bold text-[#18181B] block">Select Payroll Cycle Period</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-lg font-semibold text-xs text-[#18181B] focus:outline-hidden"
              >
                {monthOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="text"
                placeholder="Or custom period (e.g. October 2026)"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-lg text-xs font-medium text-[#18181B] focus:outline-hidden"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#71717A]">
            Gross salaries are calculated from base contracts, deductions apply pending staff salary advances (up to 40% cap), and technician expenses are offset.
          </p>
        </div>

        {/* Aggregate Preview KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#EDEDED] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Eligible Staff</span>
            <p className="text-base font-bold text-[#18181B] font-mono">{previewData.length}</p>
          </div>
          <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#EDEDED] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Total Gross</span>
            <p className="text-base font-bold text-[#18181B] font-mono">{formatCurrency(totalGross)}</p>
          </div>
          <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#EDEDED] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Advance Deductions</span>
            <p className="text-base font-bold text-rose-600 font-mono">-{formatCurrency(totalDeductions)}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Estimated Net</span>
            <p className="text-base font-bold text-[#0D7A5F] font-mono">{formatCurrency(totalNet)}</p>
          </div>
        </div>

        {/* Itemized Pre-Calculation Roster Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-[#18181B] uppercase tracking-wider">
              Employee Salary & Attendance Preview ({previewData.length})
            </h4>
            <span className="text-[11px] text-[#71717A]">Detailed breakdown before draft creation</span>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7] sticky top-0">
                  <tr>
                    <th className="p-2.5 font-semibold">Employee</th>
                    <th className="p-2.5 font-semibold">Department</th>
                    <th className="p-2.5 font-semibold">Attendance / Punches</th>
                    <th className="p-2.5 font-semibold">Gross Salary</th>
                    <th className="p-2.5 font-semibold">Advance Deductions</th>
                    <th className="p-2.5 font-semibold text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {previewData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#71717A]">
                        No active employees found to generate payroll.
                      </td>
                    </tr>
                  ) : (
                    previewData.map((emp) => (
                      <tr key={emp.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-2.5">
                          <p className="font-bold text-[#18181B]">{emp.name}</p>
                          <p className="text-[10px] text-[#71717A]">{emp.role}</p>
                        </td>
                        <td className="p-2.5 text-[#71717A]">{emp.department}</td>
                        <td className="p-2.5">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#18181B] bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                            <Clock className="w-3 h-3 text-[#71717A]" />
                            {emp.punchCount} punch{emp.punchCount === 1 ? "" : "es"}
                          </span>
                          {emp.leavesCount > 0 && (
                            <span className="ml-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {emp.leavesCount} leave{emp.leavesCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-semibold">{formatCurrency(emp.gross)}</td>
                        <td className="p-2.5 font-mono">
                          {emp.advanceDeduction > 0 ? (
                            <span className="text-rose-600 font-semibold">
                              -{formatCurrency(emp.advanceDeduction)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">PKR 0</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-right text-[#0D7A5F]">
                          {formatCurrency(emp.net)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Explanatory Safety Box */}
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-950 text-[11px] space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Safe Draft Creation Workflow
          </p>
          <p className="text-emerald-800 leading-relaxed">
            Clicking &quot;Confirm & Generate Draft&quot; creates an itemized draft payroll run. No bank disbursements or ledger postings occur until the cycle is formally reviewed, verified, and approved by HR management.
          </p>
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
            type="button"
            onClick={handleGenerate}
            disabled={isSubmitting || (existingRunForPeriod && existingRunForPeriod.status !== "Draft")}
            className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-zinc-300 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isSubmitting
              ? "Calculating Payroll..."
              : existingRunForPeriod?.status === "Draft"
              ? "Recalculate & Update Draft"
              : "Confirm & Generate Draft"}
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
