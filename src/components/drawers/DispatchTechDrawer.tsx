"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import StatusBadge from "@/components/ui/StatusBadge";
import { Phone, Briefcase, CheckCircle2, User, Clock, Smartphone, Send } from "lucide-react";
import SendAppRequestModal from "@/components/modals/SendAppRequestModal";

interface DispatchTechDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  technician: any;
  unassignedJobs: any[];
  onAssignJob: (jobId: string, technicianId: string) => void;
}

export default function DispatchTechDrawer({
  isOpen,
  onClose,
  technician,
  unassignedJobs,
  onAssignJob,
}: DispatchTechDrawerProps) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestFeedbackToast, setRequestFeedbackToast] = useState<string | null>(null);

  const handleAssign = () => {
    if (!selectedJobId || !technician) return;
    setIsAssigning(true);
    onAssignJob(selectedJobId, technician.id);
    setIsAssigning(false);
    setSelectedJobId("");
    onClose();
  };

  if (!technician) return null;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Field Technician Details"
      subtitle={`${technician.name} • ${technician.phone}`}
      width="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A] hover:text-[#1A1D1F]"
          >
            Close
          </button>
          {unassignedJobs.length > 0 && (
            <button
              type="button"
              onClick={handleAssign}
              disabled={!selectedJobId || isAssigning}
              className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A634D] disabled:bg-[#D4D4D8] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Briefcase className="w-3.5 h-3.5" />
              {isAssigning ? "Dispatching..." : "Assign & Dispatch"}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Status Card */}
        <div className="p-4 bg-[#F4F4F5] rounded-xl border border-[#E4E4E7] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider block">
              Current Field Status
            </span>
            <span className="text-sm font-bold text-[#1A1D1F] mt-0.5 block">
              {technician.currentStatus}
            </span>
          </div>
          <StatusBadge status={technician.currentStatus} />
        </div>

        {/* Direct Mobile App Request Action */}
        <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0D7A5F] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-[#1A1D1F]">Mobile Companion Alert</p>
              <p className="text-[11px] text-[#0D7A5F]">Send push instruction or re-route</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRequestModal(true)}
            className="px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            Send Alert
          </button>
        </div>

        {requestFeedbackToast && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-[#065F46] rounded-xl text-xs flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#0D7A5F] shrink-0" />
            <span>{requestFeedbackToast}</span>
          </div>
        )}

        {/* Current Active Job Info if any */}
        {technician.activeJob ? (
          <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block">
              Currently Engaged On
            </span>
            <p className="font-mono font-bold text-xs text-[#1A1D1F]">
              {technician.activeJob.jobNumber}
            </p>
            <p className="text-[#52525B]">
              Customer: {technician.activeJob.customerName}
            </p>
            <p className="text-[11px] text-[#71717A]">
              Status: {technician.activeJob.status}
            </p>
          </div>
        ) : (
          <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl flex items-center gap-2 text-[#065F46]">
            <CheckCircle2 className="w-4 h-4 text-[#0D7A5F] shrink-0" />
            <span>Technician is available for immediate field assignment.</span>
          </div>
        )}

        {/* Dispatch Open Job Section */}
        <div className="pt-2 border-t border-[#E4E4E7] space-y-2">
          <label className="font-semibold text-[#1A1D1F] block">
            Assign Open Job to this Technician
          </label>
          {unassignedJobs.length > 0 ? (
            <div className="space-y-2">
              {unassignedJobs.map((j) => (
                <label
                  key={j.id}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    selectedJobId === j.id
                      ? "bg-[#ECFDF5] border-[#0D7A5F]"
                      : "bg-white border-[#E4E4E7] hover:bg-[#F4F4F5]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="openJob"
                      value={j.id}
                      checked={selectedJobId === j.id}
                      onChange={() => setSelectedJobId(j.id)}
                      className="text-[#0D7A5F] accent-[#0D7A5F]"
                    />
                    <div>
                      <p className="font-mono font-bold text-xs text-[#1A1D1F]">
                        {j.jobNumber}
                      </p>
                      <p className="text-[11px] text-[#71717A]">
                        {j.customer?.name} ({j.jobType})
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#71717A]">
                    {j.customer?.addressText?.slice(0, 20)}...
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#71717A] italic py-2">
              No unassigned jobs awaiting dispatch.
            </p>
          )}
        </div>
      </div>

      <SendAppRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        technician={technician}
        onSuccess={(res) => {
          setRequestFeedbackToast(`Alert dispatched to ${technician.name}'s mobile device!`);
          setTimeout(() => setRequestFeedbackToast(null), 4000);
        }}
      />
    </SideDrawer>
  );
}
