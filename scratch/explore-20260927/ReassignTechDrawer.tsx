"use client";

import React, { useState, useEffect } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { User, Check, Wrench } from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";

interface ReassignTechDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  technicians: any[];
  onAssigned?: () => void;
}

export default function ReassignTechDrawer({
  isOpen,
  onClose,
  job,
  technicians,
  onAssigned,
}: ReassignTechDrawerProps) {
  const [selectedTechId, setSelectedTechId] = useState(job?.assignedTechnicianId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (job) {
      setSelectedTechId(job.assignedTechnicianId || "");
    }
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !selectedTechId) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          technicianId: selectedTechId,
          actor: "Zeeshan Ahmed (Dispatcher)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const assignedTech = technicians.find((t) => t.id === selectedTechId);

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_ASSIGNED", {
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianId: selectedTechId,
        technicianName: assignedTech?.name,
        actor: "Dispatcher Zeeshan Ahmed",
        message: `Assigned Job #${job.jobNumber} to ${assignedTech?.name || "Technician"}`,
        payload: { job },
      });

      onAssigned?.();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  const isAlreadyAssigned = Boolean(job.assignedTechnicianId || job.assignedTechnician);

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={isAlreadyAssigned ? "Reassign Technician" : "Assign Technician to Job"}
      subtitle={`Work Order ${job.jobNumber} • ${job.customer?.name || "Customer"}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A] hover:text-[#1A1D1F]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedTechId}
            className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "Assigning..." : isAlreadyAssigned ? "Confirm Reassignment" : "Assign Technician"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1.5">
            Select Field Technician *
          </label>
          <p className="text-[11px] text-[#71717A] mb-3">
            Choose an available HVAC technician to dispatch for this work order.
          </p>

          <div className="space-y-2">
            {technicians.length === 0 ? (
              <p className="text-xs text-[#A1A1AA] py-4 text-center">No technicians found.</p>
            ) : (
              technicians.map((tech) => {
                const isSelected = selectedTechId === tech.id;
                const isCurrent = job.assignedTechnicianId === tech.id;

                return (
                  <label
                    key={tech.id}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? "bg-[#ECFDF5] border-[#0D7A5F] text-[#065F46]"
                        : "bg-white border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#1A1D1F]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="techSelect"
                        value={tech.id}
                        checked={isSelected}
                        onChange={() => setSelectedTechId(tech.id)}
                        className="w-4 h-4 text-[#0D7A5F] accent-[#0D7A5F]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs text-[#18181B]">{tech.name}</p>
                          {isCurrent && (
                            <span className="text-[9px] bg-emerald-100 text-[#065F46] font-semibold px-1.5 py-0.2 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#71717A] font-mono mt-0.5">{tech.phone}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          tech.currentStatus === "Available"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {tech.currentStatus || "Available"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          (tech.activeJobsCount || 0) === 0
                            ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                            : (tech.activeJobsCount || 0) < 3
                            ? "bg-blue-50 text-blue-700 border-blue-200 font-bold"
                            : "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                        }`}
                      >
                        {tech.activeJobsCount ?? 0} active job{(tech.activeJobsCount ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
