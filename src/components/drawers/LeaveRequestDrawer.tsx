"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Calendar, AlertCircle } from "lucide-react";

interface LeaveRequestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: any[];
  leaveTypes?: any[];
  defaultEmployeeId?: string;
  onLeaveRequested?: () => void;
}

export default function LeaveRequestDrawer({
  isOpen,
  onClose,
  employees = [],
  leaveTypes = [],
  defaultEmployeeId,
  onLeaveRequested,
}: LeaveRequestDrawerProps) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || (employees[0]?.id || ""));
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employeeId || defaultEmployeeId || employees[0]?.id;
    const lType = leaveTypeId || leaveTypes[0]?.id;

    if (!emp || !lType) {
      setErrorMsg("Please select an employee and leave type.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          employeeId: emp,
          leaveTypeId: lType,
          startDate,
          endDate,
          reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onLeaveRequested?.();
      setReason("");
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
      title="Request Leave"
      subtitle="Submit formal leave application for manager approval"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="leave-request-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <Calendar className="w-3.5 h-3.5" />
            {isSubmitting ? "Submitting..." : "Submit Leave Application"}
          </button>
        </div>
      }
    >
      <form id="leave-request-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!defaultEmployeeId && employees.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Applying Employee *
            </label>
            <select
              value={employeeId || employees[0]?.id}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.designation || e.role} — {e.department})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Leave Category *
          </label>
          <select
            value={leaveTypeId || leaveTypes[0]?.id}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="w-full h-9 px-2 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.accrualRule})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              End Date *
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Reason / Coverage Notes *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g. Attending urgent family matter. Handed over pending chiller maintenance calls to Tariq Mahmood."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
