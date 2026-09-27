"use client";

import React, { useEffect, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { AlertTriangle, Check, AlertCircle } from "lucide-react";

interface ReportMisplacedItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  actor: string;
  onSuccess?: () => void;
}

export default function ReportMisplacedItemDrawer({
  isOpen,
  onClose,
  job,
  actor,
  onSuccess,
}: ReportMisplacedItemDrawerProps) {
  const [misplacedItemName, setMisplacedItemName] = useState("");
  const [misplacedQuantity, setMisplacedQuantity] = useState("1");
  const [misplacedReason, setMisplacedReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMisplacedItemName("");
    setMisplacedQuantity("1");
    setMisplacedReason("");
    setErrorMsg("");
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!misplacedItemName.trim() || Number(misplacedQuantity) <= 0) {
      setErrorMsg("Please enter the item description and a valid quantity.");
      return;
    }
    if (!misplacedReason.trim()) {
      setErrorMsg("Please state the circumstances / reason for the misplaced item.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_misplaced_item",
          technicianId: job?.assignedTechnicianId,
          item: misplacedItemName.trim(),
          quantity: Number(misplacedQuantity),
          reason: misplacedReason.trim(),
          actor: actor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record misplaced item");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log misplaced item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const techName = job?.assignedTechnician?.name || "Unassigned";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-md"
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Report Misplaced Item
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · Tech: ${techName}`}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "Logging..." : "Log Misplaced Item"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Item Description *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Copper Fitting 3/4' or Gauge Adapter"
            value={misplacedItemName}
            onChange={(e) => setMisplacedItemName(e.target.value)}
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Quantity Misplaced *
          </label>
          <input
            type="number"
            min="1"
            required
            value={misplacedQuantity}
            onChange={(e) => setMisplacedQuantity(e.target.value)}
            className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Circumstances / Reason *
          </label>
          <textarea
            rows={3}
            required
            value={misplacedReason}
            onChange={(e) => setMisplacedReason(e.target.value)}
            placeholder="State why this item was not returned to the warehouse..."
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
          />
        </div>

        <div className="p-3 bg-rose-50 rounded-lg text-[11px] text-rose-950 space-y-1.5 border border-rose-200 leading-relaxed">
          <p className="font-semibold text-rose-900">Accountability & Governance Policy:</p>
          <p>• Records item shortage in audit log under technician accountability.</p>
          <p>• Prevents false inventory restocking for unreturned or missing materials.</p>
          <p>• Logged by Storekeeper {actor}.</p>
        </div>
      </form>
    </SideDrawer>
  );
}
