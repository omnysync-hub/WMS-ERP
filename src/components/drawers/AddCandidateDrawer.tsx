"use client";

import React, { useState, useEffect } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { UserPlus, AlertCircle, Mail, Phone, User, Briefcase, FileText } from "lucide-react";

interface AddCandidateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requisitions?: any[];
  defaultStage?: string;
  onCandidateAdded?: () => void;
}

export default function AddCandidateDrawer({
  isOpen,
  onClose,
  requisitions = [],
  defaultStage = "Applied",
  onCandidateAdded,
}: AddCandidateDrawerProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [stage, setStage] = useState(defaultStage);
  const [notes, setNotes] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setStage(defaultStage || "Applied");
      if (requisitions.length > 0 && !requisitionId) {
        setRequisitionId(requisitions[0].id);
      }
    }
  }, [isOpen, defaultStage, requisitions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Candidate name is required.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Contact phone number is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_candidate",
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          requisitionId: requisitionId || undefined,
          stage: stage || "Applied",
          notes: notes.trim() || undefined,
          resumeUrl: resumeUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create candidate");
      }

      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setResumeUrl("");
      onCandidateAdded?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requisitionOptions = [
    { value: "", label: "General Candidate Pool (No Specific Requisition)" },
    ...requisitions.map((r) => ({
      value: r.id,
      label: `${r.role} (${r.department}) — ${r.requisitionNumber}`,
    })),
  ];

  const stageOptions = [
    { value: "Applied", label: "Applied" },
    { value: "Screening", label: "Screening" },
    { value: "Interview", label: "Interview" },
    { value: "Offer", label: "Offer" },
    { value: "Hired", label: "Hired" },
  ];

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Candidate to Pipeline"
      subtitle="Register a new applicant, prospective technician, or candidate into the ATS pipeline"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-candidate-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {isSubmitting ? "Adding Candidate..." : "Add to Pipeline"}
          </button>
        </div>
      }
    >
      <form id="add-candidate-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Candidate Name */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Candidate Full Name *
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              required
              placeholder="e.g. Tariq Mehmood"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#EDEDED] rounded-lg text-[#18181B] font-medium focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>
        </div>

        {/* Phone & Email Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-[#18181B] block mb-1">
              Contact Phone *
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="e.g. 03001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#EDEDED] rounded-lg text-[#18181B] font-medium focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-[#18181B] block mb-1">
              Email Address (Optional)
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                placeholder="candidate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#EDEDED] rounded-lg text-[#18181B] font-medium focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
          </div>
        </div>

        {/* Requisition Mapping */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Target Job Requisition
          </label>
          <SearchableSelect
            options={requisitionOptions}
            value={requisitionId}
            onChange={(val) => setRequisitionId(val)}
            placeholder="Select a job requisition..."
            className="w-full"
          />
          <span className="text-[10px] text-[#71717A] mt-1 block">
            Link this candidate to an approved role vacancy in hiring.
          </span>
        </div>

        {/* Pipeline Stage */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Initial Pipeline Stage
          </label>
          <SearchableSelect
            options={stageOptions}
            value={stage}
            onChange={(val) => setStage(val)}
            className="w-full"
          />
        </div>

        {/* Resume / Portfolio Link */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Resume / Portfolio Link (Optional)
          </label>
          <input
            type="url"
            placeholder="https://drive.google.com/... or LinkedIn"
            value={resumeUrl}
            onChange={(e) => setResumeUrl(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#EDEDED] rounded-lg text-[#18181B] font-medium focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F]"
          />
        </div>

        {/* Experience Notes */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Candidate Summary / Notes
          </label>
          <textarea
            rows={3}
            placeholder="Experience background, HVAC certifications, expected salary, referral details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 bg-white border border-[#EDEDED] rounded-lg text-[#18181B] focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F]"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
