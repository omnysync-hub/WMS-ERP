"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { LifeBuoy, AlertCircle } from "lucide-react";

interface RaiseGrievanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: any[];
  defaultEmployeeId?: string;
  onTicketRaised?: () => void;
}

export default function RaiseGrievanceDrawer({
  isOpen,
  onClose,
  employees = [],
  defaultEmployeeId,
  onTicketRaised,
}: RaiseGrievanceDrawerProps) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || (employees[0]?.id || ""));
  const [category, setCategory] = useState("Equipment & Tools");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employeeId || defaultEmployeeId || employees[0]?.id;
    if (!emp || !description.trim()) {
      setErrorMsg("Please provide employee and detailed ticket description.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "raise",
          employeeId: emp,
          category,
          description,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onTicketRaised?.();
      setDescription("");
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
      title="Raise HR / Workplace Ticket"
      subtitle="Submit formal helpdesk grievance or internal operational inquiry"
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
            form="raise-grievance-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            {isSubmitting ? "Submitting..." : "Submit Ticket to HR"}
          </button>
        </div>
      }
    >
      <form id="raise-grievance-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!defaultEmployeeId && employees.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Raised By Employee *
            </label>
            <SearchableSelect
              value={employeeId || employees[0]?.id || ""}
              onChange={setEmployeeId}
              placeholder="Select Employee"
              searchPlaceholder="Search employee..."
              options={employees.map((e) => ({
                value: String(e.id),
                label: e.name,
                subLabel: e.designation || e.role,
              }))}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Ticket Category *
          </label>
          <SearchableSelect
            value={category}
            onChange={setCategory}
            placeholder="Select Category"
            searchPlaceholder="Search category..."
            options={[
              "Equipment & Tools",
              "Payroll & Advances",
              "Workplace Safety",
              "Scheduling & Dispatch",
              "HR Policy & Conduct",
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Detailed Issue Description *
          </label>
          <textarea
            rows={4}
            required
            placeholder="Describe the issue, specific incident, equipment tag, or discrepancy with clarity..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
