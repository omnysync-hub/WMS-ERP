"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { UserCheck, AlertCircle } from "lucide-react";

interface AssignAssetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
  employees?: any[];
  onAssetAssigned?: () => void;
}

export default function AssignAssetDrawer({
  isOpen,
  onClose,
  asset,
  employees = [],
  onAssetAssigned,
}: AssignAssetDrawerProps) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [conditionNotes, setConditionNotes] = useState("Issued in fully functional calibrated condition");
  const [assignedBy, setAssignedBy] = useState("Bilal Sheikh (Storekeeper)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employeeId || employees[0]?.id;
    if (!asset || !emp) {
      setErrorMsg("Please select an employee.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          assetId: asset.id,
          employeeId: emp,
          conditionNotes,
          assignedBy,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onAssetAssigned?.();
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
      title="Assign Company Asset"
      subtitle={`Assign ${asset?.tag || "asset"} to staff member with handover condition log`}
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
            form="assign-asset-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5" />
            {isSubmitting ? "Assigning..." : "Confirm Handover & Assignment"}
          </button>
        </div>
      }
    >
      <form id="assign-asset-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-3 bg-[#F4F4F5] rounded-xl border border-[#EDEDED] text-xs">
          <p className="font-mono font-bold text-[#18181B]">{asset?.tag}</p>
          <p className="font-semibold text-[#18181B] mt-0.5">{asset?.name}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">{asset?.category}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Assign To Employee *
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

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Handover Authorized By
          </label>
          <input
            type="text"
            value={assignedBy}
            onChange={(e) => setAssignedBy(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Condition & Inspection Notes *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g. Battery checked at 100%, probes intact, calibrated on 2026-08-15."
            value={conditionNotes}
            onChange={(e) => setConditionNotes(e.target.value)}
            className="w-full p-2.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
