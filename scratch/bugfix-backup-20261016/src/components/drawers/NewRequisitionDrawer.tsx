"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { UserPlus, AlertCircle } from "lucide-react";

interface NewRequisitionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRequisitionCreated?: () => void;
}

export default function NewRequisitionDrawer({
  isOpen,
  onClose,
  onRequisitionCreated,
}: NewRequisitionDrawerProps) {
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("Operations");
  const [headcount, setHeadcount] = useState("1");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !reason.trim()) {
      setErrorMsg("Please provide role title and business justification.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_requisition",
          role,
          department,
          headcount: Number(headcount) || 1,
          reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onRequisitionCreated?.();
      setRole("");
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
      title="Raise Job Requisition"
      subtitle="Request approval to open new recruitment pipeline and hire headcount"
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
            form="new-requisition-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {isSubmitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      }
    >
      <form id="new-requisition-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Target Job Role Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Senior VRF & Chiller Technician"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Target Department *
            </label>
            <SearchableSelect
              value={department}
              onChange={setDepartment}
              placeholder="Select Department"
              searchPlaceholder="Search department..."
              options={[
                "Operations",
                "Maintenance",
                "Accounts",
                "HR",
                "Sales & Projects",
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Required Headcount
            </label>
            <input
              type="number"
              min="1"
              max="20"
              required
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Business Need & Justification *
          </label>
          <textarea
            rows={3}
            required
            placeholder="Explain why this role is needed, contract backlog or operational workload surge..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
