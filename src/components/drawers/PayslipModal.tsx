"use client";

import React from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { X, Printer, Building2, CheckCircle2, User, CreditCard } from "lucide-react";

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payslip: any;
  payrollRun: any;
}

export default function PayslipModal({
  isOpen,
  onClose,
  payslip,
  payrollRun,
}: PayslipModalProps) {
  if (!isOpen || !payslip) return null;

  const emp = payslip.employee || {};
  const gross = Number(payslip.grossSalary || 0);
  const advanceDeduction = Number(payslip.advanceDeduction || 0);
  const expenseAdj = Number(payslip.expenseAdjustment || 0);
  const net = Number(payslip.netSalary || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#EDEDED] text-xs text-[#18181B] space-y-6 my-8 print:m-0 print:p-0 print:border-none print:shadow-none">
        {/* Header Action Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3 print:hidden">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
            Employee Monthly Payslip
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Company Brand & Payslip Header */}
        <div className="flex items-start justify-between border-b border-[#E4E4E7] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0D7A5F] flex items-center justify-center text-white font-bold text-sm">
                W
              </div>
              <span className="font-extrabold text-base text-[#18181B] tracking-tight">
                WORKMAN SERVICES
              </span>
            </div>
            <p className="text-[11px] text-[#71717A]">
              Human Resources & Payroll Department &bull; Automated ERP
            </p>
          </div>
          <div className="text-right space-y-0.5">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-800">
              {payrollRun?.status || "Generated"}
            </span>
            <p className="text-xs font-bold text-[#18181B]">
              Pay Period: {payrollRun?.period || "Current Month"}
            </p>
            <p className="text-[10px] text-[#71717A] font-mono">
              Slip ID: {payslip.id?.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Employee Details Grid */}
        <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#EDEDED] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <div>
            <span className="text-[#71717A] block text-[10px] uppercase font-bold">Employee Name</span>
            <p className="font-bold text-[#18181B] text-xs mt-0.5">{emp.name}</p>
          </div>
          <div>
            <span className="text-[#71717A] block text-[10px] uppercase font-bold">Role / Designation</span>
            <p className="font-semibold text-[#18181B] mt-0.5">{emp.designation || emp.role || "Staff"}</p>
          </div>
          <div>
            <span className="text-[#71717A] block text-[10px] uppercase font-bold">Department</span>
            <p className="font-semibold text-[#18181B] mt-0.5">{emp.department || "Operations"}</p>
          </div>
          <div>
            <span className="text-[#71717A] block text-[10px] uppercase font-bold">Disbursement Mode</span>
            <p className="font-semibold text-emerald-800 mt-0.5 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              WPS Bank Transfer
            </p>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-semibold text-[#18181B]">Biometric & Geofence Duty Log:</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>
              Punches Verified:{" "}
              <strong className="font-mono text-[#18181B]">
                {emp.attendanceLogs?.length || "Regular"}
              </strong>
            </span>
            <span>
              Leaves Taken:{" "}
              <strong className="font-mono text-[#18181B]">
                {emp.leaveRequests?.length || 0}
              </strong>
            </span>
          </div>
        </div>

        {/* Earnings & Deductions Breakdown Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Earnings */}
          <div className="border border-[#E4E4E7] rounded-xl overflow-hidden">
            <div className="bg-[#F4F4F5] p-2.5 font-bold text-xs text-[#18181B] border-b border-[#E4E4E7]">
              Earnings
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#71717A]">Basic / Gross Salary</span>
                <span className="font-mono font-semibold">{formatCurrency(gross)}</span>
              </div>
              {expenseAdj > 0 && (
                <div className="flex justify-between items-center text-emerald-800">
                  <span>Technician Expense Offset</span>
                  <span className="font-mono font-semibold">+{formatCurrency(expenseAdj)}</span>
                </div>
              )}
              <div className="border-t border-[#F4F4F5] pt-2 flex justify-between font-bold text-[#18181B]">
                <span>Total Earnings</span>
                <span className="font-mono">{formatCurrency(gross + expenseAdj)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="border border-[#E4E4E7] rounded-xl overflow-hidden">
            <div className="bg-[#F4F4F5] p-2.5 font-bold text-xs text-[#18181B] border-b border-[#E4E4E7]">
              Deductions & Recoveries
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#71717A]">Staff Salary Advance Recovery</span>
                <span className="font-mono text-rose-600 font-semibold">
                  {advanceDeduction > 0 ? `-${formatCurrency(advanceDeduction)}` : "PKR 0"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[#71717A]">
                <span>Statutory Taxes / Penalties</span>
                <span className="font-mono">PKR 0</span>
              </div>
              <div className="border-t border-[#F4F4F5] pt-2 flex justify-between font-bold text-rose-700">
                <span>Total Deductions</span>
                <span className="font-mono">-{formatCurrency(advanceDeduction)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Salary Highlight Box */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-900 tracking-wider">
              Net Payable Salary (Disbursement)
            </span>
            <p className="text-xs text-emerald-800 mt-0.5">
              Approved for Electronic Funds Transfer via WPS Network
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold font-mono text-[#0D7A5F]">{formatCurrency(net)}</span>
          </div>
        </div>

        {/* Signatures for Print */}
        <div className="pt-6 border-t border-[#EDEDED] grid grid-cols-2 gap-8 text-[11px] text-[#71717A]">
          <div className="space-y-4">
            <div className="h-10 border-b border-dashed border-zinc-300" />
            <p className="font-semibold text-center">Authorized HR Officer Signature</p>
          </div>
          <div className="space-y-4">
            <div className="h-10 border-b border-dashed border-zinc-300" />
            <p className="font-semibold text-center">Employee Acknowledgment</p>
          </div>
        </div>
      </div>
    </div>
  );
}
