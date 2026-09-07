"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  UserCheck,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;

  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState("");

  // Interview scheduling modal
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewDate, setInterviewDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [interviewer, setInterviewer] = useState("Haris Qureshi & Technical Lead");
  const [interviewNotes, setInterviewNotes] = useState("");

  // Offer modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerRole, setOfferRole] = useState("");
  const [offerSalary, setOfferSalary] = useState("6500");
  const [offerStartDate, setOfferStartDate] = useState(
    new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0]
  );

  async function loadCandidate() {
    try {
      setLoading(true);
      const res = await fetch(`/api/hrm/recruitment?candidateId=${candidateId}`);
      const data = await res.json();
      const found = data.candidates?.find((c: any) => c.id === candidateId);
      if (found) {
        setCandidate(found);
        setOfferRole(found.requisition?.role || "HVAC Specialist");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (candidateId) loadCandidate();
  }, [candidateId]);

  // Stage transition
  const handleStageChange = async (newStage: string) => {
    try {
      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_stage",
          candidateId,
          stage: newStage,
        }),
      });
      if (res.ok) {
        setNotification(`Candidate stage updated to ${newStage}.`);
        loadCandidate();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Schedule interview
  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_interview",
          candidateId,
          scheduledAt: new Date(interviewDate).toISOString(),
          interviewer,
          notes: interviewNotes,
        }),
      });
      if (res.ok) {
        setShowInterviewModal(false);
        setNotification("Interview scheduled successfully.");
        handleStageChange("Interview");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Create offer
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_offer",
          candidateId,
          role: offerRole,
          salary: Number(offerSalary),
          startDate: offerStartDate,
        }),
      });
      if (res.ok) {
        setShowOfferModal(false);
        setNotification("Employment offer generated and sent.");
        handleStageChange("Offer");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Accept offer -> Converts into new Employee record
  const handleAcceptOffer = async (offerId: string) => {
    if (
      !confirm(
        "Accept this offer? This will automatically convert the candidate into a live Employee record and initialize their Onboarding checklist."
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept_offer",
          offerId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      setNotification(`Candidate hired! Employee record created for ${data.newEmployee.name}.`);
      router.push(`/hrm/employees/${data.newEmployee.id}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading || !candidate) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-xs text-[#71717A]">
        Loading candidate profile...
      </div>
    );
  }

  const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        breadcrumbs={[
          { label: "HRM & Payroll", href: "/hrm" },
          { label: "Recruitment (ATS)", href: "/hrm?tab=recruitment" },
          { label: candidate.name },
        ]}
        title={candidate.name}
        subtitle={`Candidate for ${candidate.requisition?.role || "Open Role"} • Pipeline Stage: ${candidate.stage}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInterviewModal(true)}
              className="h-8 px-3 rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
            >
              <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
              Schedule Interview
            </button>
            <button
              onClick={() => setShowOfferModal(true)}
              className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Prepare Offer
            </button>
            <Link
              href="/hrm?tab=recruitment"
              className="h-8 px-3 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to ATS
            </Link>
          </div>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button onClick={() => setNotification("")} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Stage Progression Stepper */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
        <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block mb-2">
          Hiring Pipeline Stage
        </span>
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {stages.map((st) => {
            const isCurrent = candidate.stage === st;
            return (
              <button
                key={st}
                onClick={() => handleStageChange(st)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition text-center border ${
                  isCurrent
                    ? "bg-[#0D7A5F] border-[#0D7A5F] text-white shadow-xs"
                    : "bg-[#F9FAFB] hover:bg-[#F4F4F5] border-[#EDEDED] text-[#71717A]"
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Candidate Profile Details */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#18181B] pb-2 border-b border-[#E4E4E7] flex items-center gap-2">
            <User className="w-4 h-4 text-[#0D7A5F]" />
            Candidate Information
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#71717A] block">Full Name</span>
              <p className="font-bold text-[#18181B] mt-0.5">{candidate.name}</p>
            </div>
            <div>
              <span className="text-[#71717A] block">Phone Number</span>
              <p className="font-semibold text-[#18181B] mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#0D7A5F]" />
                {candidate.phone}
              </p>
            </div>
            <div>
              <span className="text-[#71717A] block">Email</span>
              <p className="font-semibold text-[#18181B] mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#0D7A5F]" />
                {candidate.email || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[#71717A] block">Associated Requisition</span>
              <p className="font-semibold text-[#18181B] mt-0.5">
                {candidate.requisition ? (
                  <span>
                    {candidate.requisition.requisitionNumber} — {candidate.requisition.role} ({candidate.requisition.department})
                  </span>
                ) : (
                  "General Applicant Pool"
                )}
              </p>
            </div>
            <div>
              <span className="text-[#71717A] block">Notes & Qualifications</span>
              <p className="text-[#18181B] mt-0.5 bg-[#F9FAFB] p-2.5 rounded-lg border border-[#EDEDED] leading-relaxed">
                {candidate.notes || "No candidate notes recorded."}
              </p>
            </div>
          </div>
        </div>

        {/* Interviews & Offers Center */}
        <div className="md:col-span-2 space-y-6">
          {/* Scheduled Interviews */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0D7A5F]" />
                Interview Rounds ({candidate.interviews?.length || 0})
              </h2>
              <button
                onClick={() => setShowInterviewModal(true)}
                className="text-xs text-[#0D7A5F] hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule Round
              </button>
            </div>

            {candidate.interviews && candidate.interviews.length > 0 ? (
              <div className="space-y-2">
                {candidate.interviews.map((iv: any) => (
                  <div
                    key={iv.id}
                    className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#18181B]">
                        {formatDateTime(iv.scheduledAt)}
                      </span>
                      <p className="text-[#71717A] mt-0.5">
                        <span className="font-semibold text-[#18181B]">Interviewers:</span> {iv.interviewer}
                      </p>
                      {iv.notes && (
                        <p className="text-[#52525B] text-[11px] mt-1 bg-white p-2 rounded border border-[#E4E4E7]">
                          {iv.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Scheduled
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717A]">No interviews scheduled yet.</p>
            )}
          </div>

          {/* Offers & Onboarding Conversion */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
                Job Offers & Conversion to Employee
              </h2>
              <button
                onClick={() => setShowOfferModal(true)}
                className="text-xs text-[#0D7A5F] hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                New Offer
              </button>
            </div>

            {candidate.offers && candidate.offers.length > 0 ? (
              <div className="space-y-2">
                {candidate.offers.map((offer: any) => (
                  <div
                    key={offer.id}
                    className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-emerald-950">{offer.role}</span>
                        <StatusBadge status={offer.status} />
                      </div>
                      <p className="text-[#52525B] mt-1">
                        Offered Salary: <span className="font-mono font-bold text-[#18181B]">{formatCurrency(offer.salary)}/mo</span> • Expected Start: {formatDateTime(offer.startDate)}
                      </p>
                    </div>

                    {offer.status !== "Accepted" ? (
                      <button
                        onClick={() => handleAcceptOffer(offer.id)}
                        className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Accept & Convert to Employee
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg">
                        ✓ Converted to Employee
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717A]">No offers extended yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Interview Modal */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#EDEDED] text-xs">
            <h3 className="text-sm font-bold text-[#18181B]">Schedule Candidate Interview</h3>
            <form onSubmit={handleScheduleInterview} className="space-y-3">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">Interview Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full h-9 px-3 font-mono bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">Interviewer Panel *</label>
                <input
                  type="text"
                  required
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                  className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">Interview Instructions / Notes</label>
                <textarea
                  rows={2}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  placeholder="e.g. Practical test on refrigerant gauge reading and delta T calculation."
                  className="w-full p-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowInterviewModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prepare Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#EDEDED] text-xs">
            <h3 className="text-sm font-bold text-[#18181B]">Generate Employment Offer</h3>
            <form onSubmit={handleCreateOffer} className="space-y-3">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">Offered Role Title *</label>
                <input
                  type="text"
                  required
                  value={offerRole}
                  onChange={(e) => setOfferRole(e.target.value)}
                  className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Monthly Salary ($) *</label>
                  <input
                    type="number"
                    min="1000"
                    required
                    value={offerSalary}
                    onChange={(e) => setOfferSalary(e.target.value)}
                    className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Target Start Date *</label>
                  <input
                    type="date"
                    required
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                    className="w-full h-9 px-3 font-mono bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Generate Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
