"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import FeedbackCallDrawer from "@/components/drawers/FeedbackCallDrawer";
import { formatDateTime } from "@/lib/utils";
import {
  Headphones,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PhoneMissed,
  User,
  Calendar,
  Phone,
  Search,
} from "lucide-react";

export default function FeedbackCallCenterPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notification, setNotification] = useState("");

  async function loadFeedback() {
    try {
      setLoading(true);
      const res = await fetch("/api/feedback");
      const data = await res.json();
      if (data.queue) setQueue(data.queue);
      if (data.calls) setAllCalls(data.calls);
    } catch (e) {
      console.error("Failed loading feedback queue", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, []);

  const handleOpenCallDrawer = (job: any) => {
    setSelectedJob(job);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Call Center Feedback" }]}
        title="Call Center & Quality Feedback"
        subtitle="Outbound customer satisfaction verification on audited jobs and dispute governance"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Headphones className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Active Queue
          </span>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            onClick={() => setNotification("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* TWO-COLUMN ENTERPRISE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Outbound Call Center Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Outbound Quality Check Queue
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Verified jobs automatically populate here. Customer disapproval flags the job for supervisor audit.
                </p>
              </div>
              <span className="text-xs font-bold text-[#0D7A5F] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
                {queue.length} Pending
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                All verified jobs have completed customer feedback checks.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Customer & Phone</th>
                      <th className="py-2.5 px-4">Work Order</th>
                      <th className="py-2.5 px-4">Technician</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {queue.map((job) => (
                      <tr key={job.id} className="hover:bg-[#FAFAFA] transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#18181B]">{job.customer?.name}</p>
                          <p className="text-[11px] text-[#71717A] font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {job.customer?.phone}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#0D7A5F]">
                          {job.jobNumber}
                        </td>
                        <td className="py-3 px-4 text-[#52525B]">
                          {job.assignedTechnician?.name || "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenCallDrawer(job)}
                            className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Start Call
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Recent Call History & Disputed Flags */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7]">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Recent Quality Call Log
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Archived customer satisfaction results.
              </p>
            </div>

            <div className="divide-y divide-[#E4E4E7] max-h-[560px] overflow-y-auto">
              {allCalls.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#71717A]">
                  No call logs recorded yet.
                </p>
              ) : (
                allCalls.map((call) => (
                  <div key={call.id} className="p-4 space-y-1.5 hover:bg-[#FAFAFA] transition text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#18181B]">
                        {call.job?.customer?.name || "Customer"}
                      </span>
                      <StatusBadge status={call.outcome} />
                    </div>
                    <p className="text-[11px] text-[#71717A] font-mono">
                      WO #{call.job?.jobNumber} • {formatDateTime(call.calledAt)}
                    </p>
                    {call.remarks && (
                      <p className="text-xs text-[#27272A] bg-[#FAFAFA] p-2 rounded border border-[#E4E4E7] mt-1">
                        "{call.remarks}"
                      </p>
                    )}
                    <p className="text-[10px] text-[#71717A]">Agent: {call.calledBy}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK CALL SIDE DRAWER */}
      <FeedbackCallDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        job={selectedJob}
        onFeedbackSaved={() => {
          setNotification("Customer feedback recorded successfully!");
          loadFeedback();
        }}
      />
    </div>
  );
}
