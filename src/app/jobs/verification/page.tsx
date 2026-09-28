"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime, formatJobType, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import { procurementActorHeaders } from "@/lib/procurementClient";
import {
  ShieldCheck,
  CheckCircle2,
  Search,
  RefreshCw,
  FileCheck,
  Undo2,
  User,
  Lock,
  AlertTriangle,
  X,
  ChevronRight,
} from "lucide-react";

type Checklist = {
  workConfirmed: boolean;
  paymentReconciled: boolean;
  inventoryReturned: boolean;
};

export default function AuditorVerificationPage() {
  const router = useRouter();
  const { activeRole, currentPersona, hasPermission } = useRole();
  const canVerify = hasPermission("jobs.verify");

  const [queue, setQueue] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");

  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [sendBackNote, setSendBackNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [checklist, setChecklist] = useState<Checklist>({
    workConfirmed: false,
    paymentReconciled: false,
    inventoryReturned: false,
  });

  const actorHeaders = useCallback(() => {
    return procurementActorHeaders(
      activeRole || "anonymous",
      currentPersona?.name,
      currentPersona?.id
    );
  }, [activeRole, currentPersona]);

  const loadQueue = useCallback(async () => {
    if (!canVerify) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/jobs/verification?${params.toString()}`, {
        headers: actorHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load verification queue");
      setQueue(Array.isArray(data.queue) ? data.queue : []);
      setPendingCount(Number(data.pendingCount) || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load queue");
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [actorHeaders, canVerify, search]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const jobTotal = (job: any) => {
    const items = job.items || [];
    let total = 0;
    for (const it of items) {
      const qty = it.quantityActual ?? it.quantityPlanned ?? 0;
      total += qty * (it.unitRate || 0);
    }
    return Math.max(0, total - (job.discountAmount || 0));
  };

  const openVerify = (job: any) => {
    setSelectedJob(job);
    setChecklist({
      workConfirmed: false,
      paymentReconciled: false,
      inventoryReturned: false,
    });
    setShowVerifyModal(true);
  };

  const openSendBack = (job: any) => {
    setSelectedJob(job);
    setSendBackNote("");
    setShowSendBackModal(true);
  };

  const handleVerify = async () => {
    if (!selectedJob) return;
    if (
      !checklist.workConfirmed ||
      !checklist.paymentReconciled ||
      !checklist.inventoryReturned
    ) {
      alert("All 3 checklist items must be confirmed to verify the job.");
      return;
    }
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: actorHeaders(),
        body: JSON.stringify({
          action: "verify",
          checklist,
          actor: currentPersona?.name || "Auditor",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verify failed");
      setShowVerifyModal(false);
      setNotification(
        `Job ${selectedJob.jobNumber} verified â€” verified by auditor (feedback already completed earlier).`
      );
      await loadQueue();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendBack = async () => {
    if (!selectedJob) return;
    if (!sendBackNote.trim()) {
      alert("A send-back note is required.");
      return;
    }
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: actorHeaders(),
        body: JSON.stringify({
          action: "send_back",
          note: sendBackNote.trim(),
          actor: currentPersona?.name || "Auditor",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send back failed");
      setShowSendBackModal(false);
      setNotification(
        `Job ${selectedJob.jobNumber} sent back to accountant (CompletedPendingVerification).`
      );
      await loadQueue();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!canVerify) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-950">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Access restricted
          </p>
          <p className="mt-2 text-xs">
            Auditor Verification requires the <code className="font-mono">jobs.verify</code>{" "}
            permission (auditor / admin).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: "Auditor Verification" },
        ]}
        title="Auditor Verification Queue"
        subtitle="Finalized jobs awaiting checklist approval. Verified follows Finalized (accountant lock) per LOGICS."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0D7A5F]" />
            {pendingCount} Pending
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => loadQueue()}
            className="h-8 px-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-xs font-semibold text-[#3F3F46] inline-flex items-center gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            type="button"
            onClick={() => setNotification("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            aria-label="Dismiss"
          >
            Ã—
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Awaiting Auditor Action
            </h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Status gate: <span className="font-mono font-semibold">Finalized</span> only.
              Flow: Complete → Feedback (call customer + tech) → accountant finalize → this verification queue.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search job / customerâ€¦"
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E4E4E7] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#71717A]">Loading verification queueâ€¦</div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#71717A]">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            No Finalized jobs awaiting verification.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                  <th className="py-2.5 px-4">Work Order</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Technician</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Finalized</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {queue.map((job) => (
                  <tr key={job.id} className="hover:bg-[#FAFAFA] transition">
                    <td className="py-3 px-4">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-mono font-semibold text-[#0D7A5F] hover:underline inline-flex items-center gap-1"
                      >
                        {job.jobNumber}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                      {job.manualJobNumber && (
                        <p className="text-[10px] text-[#71717A] mt-0.5">Manual: {job.manualJobNumber}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#18181B]">{job.customer?.name}</p>
                      <p className="text-[11px] text-[#71717A] font-mono">{job.customer?.phone}</p>
                    </td>
                    <td className="py-3 px-4 text-[#52525B]">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-[#A1A1AA]" />
                        {job.assignedTechnician?.name || "â€”"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#52525B]">{formatJobType(job.jobType) || job.jobType}</td>
                    <td className="py-3 px-4 text-[#52525B]">
                      <span className="inline-flex items-center gap-1">
                        <Lock className="w-3 h-3 text-[#A1A1AA]" />
                        {job.finalizedAt ? formatDateTime(job.finalizedAt) : "â€”"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#18181B]">
                      {formatCurrency(jobTotal(job))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openVerify(job)}
                          className="h-8 px-2.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-[11px] font-semibold inline-flex items-center gap-1 transition shadow-xs"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => openSendBack(job)}
                          className="h-8 px-2.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-[11px] font-semibold inline-flex items-center gap-1 transition"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Send back
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/jobs/${job.id}`)}
                          className="h-8 px-2.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-[#3F3F46] text-[11px] font-semibold"
                        >
                          Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VERIFY MODAL */}
      {showVerifyModal && selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#0D7A5F]" />
                Verify {selectedJob.jobNumber}
              </h3>
              <button type="button" onClick={() => setShowVerifyModal(false)} className="p-1 rounded-md hover:bg-[#F4F4F5]">
                <X className="w-4 h-4 text-[#71717A]" />
              </button>
            </div>
            <p className="text-xs text-[#52525B]">
              All three checklist items are required. On approve, status becomes Verified and the job
              is fully closed after auditor sign-off (feedback already ran after complete).
            </p>
            <div className="space-y-3 bg-[#FAFAFA] p-4 rounded-lg border border-[#E4E4E7]">
              {(
                [
                  ["workConfirmed", "1. Work Confirmed Physically & Photos Inspected"],
                  ["paymentReconciled", "2. Customer Payment Reconciled by Accounts"],
                  ["inventoryReturned", "3. Unused Materials / Old Parts Returned to Warehouse"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded border-[#D4D4D8] accent-[#0D7A5F]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
              <button type="button" onClick={() => setShowVerifyModal(false)} className="px-3 py-1.5 text-xs text-[#71717A] rounded-lg hover:bg-[#F4F4F5]">
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleVerify}
                className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold"
              >
                Approve & Mark Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND BACK MODAL */}
      {showSendBackModal && selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-amber-700" />
                Send back {selectedJob.jobNumber}
              </h3>
              <button type="button" onClick={() => setShowSendBackModal(false)} className="p-1 rounded-md hover:bg-[#F4F4F5]">
                <X className="w-4 h-4 text-[#71717A]" />
              </button>
            </div>
            <p className="text-xs text-[#52525B]">
              Supervisor override: unlocks the Finalized job back to{" "}
              <span className="font-mono">CompletedPendingVerification</span> so the accountant can
              correct issues and re-finalize. Ledger postings are not reversed; re-finalize skips
              duplicate invoice/revenue.
            </p>
            <div>
              <label className="text-xs font-semibold text-[#18181B] block mb-1">
                Reason / note *
              </label>
              <textarea
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                rows={4}
                required
                placeholder="What must be fixed before verification?"
                className="w-full p-2.5 rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
              <button type="button" onClick={() => setShowSendBackModal(false)} className="px-3 py-1.5 text-xs text-[#71717A] rounded-lg hover:bg-[#F4F4F5]">
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSendBack}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Send Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}