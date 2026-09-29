"use client";

import React, { useState, useEffect } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Check, Users, Search } from "lucide-react";
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
  const [assistantIds, setAssistantIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [techSearch, setTechSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAlreadyAssigned = Boolean(job?.assignedTechnicianId || job?.assignedTechnician);
  const midJobStatuses = ["Accepted", "InProgress", "Paused"];
  const isMidJob = isAlreadyAssigned && midJobStatuses.includes(job?.status);
  const canMultiAssign =
    !isMidJob && (job?.status === "Created" || job?.status === "Assigned" || !job?.status);

  useEffect(() => {
    if (job) {
      setSelectedTechId(job.assignedTechnicianId || "");
      const existingAssistants = (job.assignments || [])
        .filter(
          (a: any) =>
            a.status !== "Removed" &&
            a.role === "assistant" &&
            a.technicianId !== job.assignedTechnicianId
        )
        .map((a: any) => a.technicianId);
      setAssistantIds(existingAssistants);
      setNotes("");
    }
  }, [job]);

  const toggleAssistant = (id: string) => {
    if (id === selectedTechId) return;
    setAssistantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !selectedTechId) return;

    try {
      setIsSubmitting(true);

      let body: Record<string, unknown>;
      if (isMidJob || (isAlreadyAssigned && selectedTechId !== job.assignedTechnicianId)) {
        // Preserve history: create successor job
        body = {
          action: "reassign",
          technicianId: selectedTechId,
          actor: "Zeeshan Ahmed (Dispatcher)",
          copyItems: true,
          notes: notes || undefined,
        };
      } else if (canMultiAssign && (assistantIds.length > 0 || true)) {
        const technicianIds = [selectedTechId, ...assistantIds.filter((id) => id !== selectedTechId)];
        body = {
          action: "assign_technicians",
          technicianIds,
          primaryTechnicianId: selectedTechId,
          actor: "Zeeshan Ahmed (Dispatcher)",
        };
      } else {
        body = {
          action: "assign",
          technicianId: selectedTechId,
          actor: "Zeeshan Ahmed (Dispatcher)",
        };
      }

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Assignment failed");
      }

      const result = await res.json();
      const assignedTech = technicians.find((t) => t.id === selectedTechId);
      const successor = result?.newJob || result;

      realtimeSync.publish(
        "JOB_ASSIGNED",
        {
          jobId: successor?.id || job.id,
          jobNumber: successor?.jobNumber || job.jobNumber,
          technicianId: selectedTechId,
          technicianName: assignedTech?.name,
          actor: "Dispatcher Zeeshan Ahmed",
          message:
            body.action === "reassign"
              ? `Reassigned ${job.jobNumber} → ${successor?.jobNumber} to ${assignedTech?.name || "Technician"}`
              : `Assigned Job #${job.jobNumber} to ${assignedTech?.name || "Technician"}`,
          payload: { result },
        }
      );

      onAssigned?.();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  const title = isMidJob
    ? "Reassign Technician (new job)"
    : isAlreadyAssigned
      ? "Reassign / Update Technicians"
      : "Assign Technician(s) to Job";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`Work Order ${job.jobNumber} · ${job.customer?.name || "Customer"} · ${job.status}`}
      width="max-w-xl"
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
            {isSubmitting
              ? "Saving..."
              : isMidJob
                ? "Create Successor Job"
                : isAlreadyAssigned && selectedTechId !== job.assignedTechnicianId
                  ? "Confirm Reassignment"
                  : "Assign Technician(s)"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {isMidJob && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
            This job is already in progress. Reassignment will <strong>create a new linked job</strong> for
            the new technician, mark this job as <strong>TechnicianReassigned</strong>, and preserve all
            historical data (items, expenses, status history).
          </div>
        )}

        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1.5">
            {isMidJob ? "New Lead Technician *" : "Lead Field Technician *"}
          </label>
          <p className="text-[11px] text-[#71717A] mb-3">
            {canMultiAssign
              ? "Pick a lead technician. Optionally add assistants below."
              : "Choose the technician who will take over this work order."}
          </p>

          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search technicians by name, phone, or status..."
              value={techSearch}
              onChange={(e) => setTechSearch(e.target.value)}
              className="w-full bg-[#F4F4F5] pl-8 pr-3 py-1.5 rounded-lg text-xs border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {technicians
              .filter((tech) => {
                if (!techSearch.trim()) return true;
                const q = techSearch.toLowerCase().trim();
                return (
                  tech.name?.toLowerCase().includes(q) ||
                  tech.phone?.toLowerCase().includes(q) ||
                  tech.currentStatus?.toLowerCase().includes(q)
                );
              })
              .length === 0 ? (
              <p className="text-xs text-[#A1A1AA] py-4 text-center">No technicians matching "{techSearch}".</p>
            ) : (
              technicians
                .filter((tech) => {
                  if (!techSearch.trim()) return true;
                  const q = techSearch.toLowerCase().trim();
                  return (
                    tech.name?.toLowerCase().includes(q) ||
                    tech.phone?.toLowerCase().includes(q) ||
                    tech.currentStatus?.toLowerCase().includes(q)
                  );
                })
                .map((tech) => {
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
                        onChange={() => {
                          setSelectedTechId(tech.id);
                          setAssistantIds((prev) => prev.filter((id) => id !== tech.id));
                        }}
                        className="w-4 h-4 text-[#0D7A5F] accent-[#0D7A5F]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs text-[#18181B]">{tech.name}</p>
                          {isCurrent && (
                            <span className="text-[9px] bg-emerald-100 text-[#065F46] font-semibold px-1.5 py-0.5 rounded">
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
                        {tech.activeJobsCount ?? 0} active job
                        {(tech.activeJobsCount ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {canMultiAssign && (
          <div>
            <label className="font-semibold text-[#1A1D1F] mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Assistant Technicians (optional)
            </label>
            <p className="text-[11px] text-[#71717A] mb-2">
              Multiple technicians can be on the same job. Assistants see and accept the job in the mobile app.
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {technicians
                .filter((t) => t.id !== selectedTechId)
                .map((tech) => {
                  const checked = assistantIds.includes(tech.id);
                  return (
                    <label
                      key={tech.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                        checked ? "bg-slate-50 border-slate-300" : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssistant(tech.id)}
                        className="accent-[#0D7A5F]"
                      />
                      <span className="font-medium text-[#18181B]">{tech.name}</span>
                      <span className="text-[10px] text-[#71717A] font-mono ml-auto">{tech.phone}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        )}

        {(isMidJob || (isAlreadyAssigned && selectedTechId !== job.assignedTechnicianId)) && (
          <div>
            <label className="font-semibold text-[#1A1D1F] block mb-1.5">Reassignment note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for reassignment (optional)"
              className="w-full border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#0D7A5F] outline-none"
            />
          </div>
        )}
      </form>
    </SideDrawer>
  );
}
