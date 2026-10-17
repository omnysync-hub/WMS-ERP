"use client";

import React, { useState, useMemo } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  FileText,
  CreditCard,
  ShieldCheck,
  Trash2,
  Play,
  Printer,
  ChevronRight,
  TrendingDown,
  Building2,
  AlertCircle,
} from "lucide-react";

interface PayrollRunDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  run: any;
  onApprove: (runId: string) => void;
  onDisburse: (runId: string) => void;
  onDeleteDraft: (runId: string) => void;
  onViewPayslip: (payslip: any, run: any) => void;
}

export default function PayrollRunDetailDrawer({
  isOpen,
  onClose,
  run,
  onApprove,
  onDisburse,
  onDeleteDraft,
  onViewPayslip,
}: PayrollRunDetailDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");

  const payslips: any[] = run?.payslips || [];

  // Unique departments in this run
  const departments = useMemo(() => {
    const set = new Set<string>();
    payslips.forEach((p) => {
      if (p.employee?.department) set.add(p.employee.department);
    });
    return Array.from(set);
  }, [payslips]);

  // Filtered payslips
  const filteredPayslips = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return payslips.filter((p) => {
      const emp = p.employee || {};
      const matchesSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.role?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q);

      const matchesDept = selectedDeptFilter === "all" || emp.department === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [payslips, searchTerm, selectedDeptFilter]);

  if (!run) return null;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${run.period} — Detailed Payroll Breakdown`}
      subtitle={`Comprehensive compensation register, employee attendance verification, deductions, and WPS disbursement records`}
      width="max-w-4xl"
    >
      <div className="space-y-6 text-xs text-[#18181B]">
        {/* Status & Audit Header Banner */}
        <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#EDEDED] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-[#18181B]">{run.period} Cycle</span>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-[11px] text-[#71717A]">
              {run.status === "Draft"
                ? "Draft cycle — pending executive review and HR approval."
                : run.status === "Approved"
                ? `Approved by ${run.approvedBy || "Admin"}${run.approvedAt ? ` on ${formatDateTime(run.approvedAt)}` : ""}. Ready for WPS payment.`
                : `Disbursed and posted to General Ledger.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {run.status === "Draft" && (
              <>
                <button
                  onClick={() => onDeleteDraft(run.id)}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Discard Draft
                </button>
                <button
                  onClick={() => onApprove(run.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Approve Payroll
                </button>
              </>
            )}

            {run.status === "Approved" && (
              <button
                onClick={() => onDisburse(run.id)}
                className="px-4 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Disburse via WPS
              </button>
            )}

            {run.status === "Paid" && (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Disbursed & Posted to GL
              </span>
            )}
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Gross Salaries</span>
            <p className="text-base font-bold text-[#18181B] font-mono">{formatCurrency(run.totalGross)}</p>
            <span className="text-[10px] text-[#71717A]">{payslips.length} employees included</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Advances Deducted</span>
            <p className="text-base font-bold text-rose-600 font-mono">-{formatCurrency(run.totalDeductions)}</p>
            <span className="text-[10px] text-[#71717A]">Recovered to ledger</span>
          </div>

          <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Net Bank Payout</span>
            <p className="text-base font-bold text-[#0D7A5F] font-mono">{formatCurrency(run.totalNet)}</p>
            <span className="text-[10px] text-emerald-700">WPS disbursement total</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Staff Count</span>
            <p className="text-base font-bold text-[#18181B] font-mono">{payslips.length}</p>
            <span className="text-[10px] text-[#71717A]">100% active staff</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-[#F9FAFB] p-2.5 rounded-xl border border-[#EDEDED]">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff by name or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 pr-2.5 bg-white border border-[#E4E4E7] rounded-lg text-xs placeholder:text-[#71717A] text-[#18181B] focus:outline-hidden w-52"
              />
            </div>

            {departments.length > 0 && (
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="h-8 px-2.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          <span className="text-[11px] text-[#71717A] font-semibold">
            Showing {filteredPayslips.length} of {payslips.length} staff records
          </span>
        </div>

        {/* Itemized Employee Table */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                <tr>
                  <th className="p-3 font-semibold">Employee</th>
                  <th className="p-3 font-semibold">Department</th>
                  <th className="p-3 font-semibold">Attendance & Duty</th>
                  <th className="p-3 font-semibold">Gross Salary</th>
                  <th className="p-3 font-semibold">Advance Deductions</th>
                  <th className="p-3 font-semibold">Expense Offsets</th>
                  <th className="p-3 font-semibold">Net Payout</th>
                  <th className="p-3 font-semibold text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#71717A]">
                      No employee payslip records found matching the filter.
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map((slip) => {
                    const emp = slip.employee || {};
                    const punchCount = (emp.attendanceLogs || []).length;
                    const leavesCount = (emp.leaveRequests || []).length;

                    return (
                      <tr key={slip.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-3">
                          <p className="font-bold text-[#18181B]">{emp.name}</p>
                          <p className="text-[10px] text-[#71717A]">{emp.designation || emp.role || "Staff"}</p>
                        </td>

                        <td className="p-3 text-[#71717A]">{emp.department || "Operations"}</td>

                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#18181B] bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                              <Clock className="w-3 h-3 text-[#71717A]" />
                              {punchCount} verified punch{punchCount === 1 ? "" : "es"}
                            </span>
                            {leavesCount > 0 && (
                              <p className="text-[10px] text-amber-700 font-medium">
                                {leavesCount} approved leave{leavesCount === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="p-3 font-mono font-semibold">{formatCurrency(slip.grossSalary)}</td>

                        <td className="p-3 font-mono">
                          {slip.advanceDeduction > 0 ? (
                            <span className="text-rose-600 font-semibold">
                              -{formatCurrency(slip.advanceDeduction)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">PKR 0</span>
                          )}
                        </td>

                        <td className="p-3 font-mono">
                          {slip.expenseAdjustment > 0 ? (
                            <span className="text-emerald-700 font-semibold">
                              +{formatCurrency(slip.expenseAdjustment)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">PKR 0</span>
                          )}
                        </td>

                        <td className="p-3 font-mono font-bold text-[#0D7A5F]">
                          {formatCurrency(slip.netSalary)}
                        </td>

                        <td className="p-3 text-right">
                          <button
                            onClick={() => onViewPayslip(slip, run)}
                            className="px-2.5 py-1 bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B] rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition shadow-2xs hover:border-[#0D7A5F]"
                          >
                            <FileText className="w-3 h-3 text-[#0D7A5F]" />
                            View Slip
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info & close */}
        <div className="flex items-center justify-between pt-3 border-t border-[#EDEDED]">
          <span className="text-[11px] text-[#71717A]">
            Direct deposit files conform with standard WPS payroll file structures.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-[#18181B] text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
