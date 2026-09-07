"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import {
  LifeBuoy,
  User,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ArrowRight,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";

export default function GrievanceTicketPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [notification, setNotification] = useState("");

  async function loadTicket() {
    try {
      setLoading(true);
      const res = await fetch(`/api/hrm/grievances/${ticketId}`);
      if (!res.ok) throw new Error("Ticket not found");
      const data = await res.json();
      setTicket(data.ticket);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ticketId) loadTicket();
  }, [ticketId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setIsSubmittingComment(true);
      const res = await fetch("/api/hrm/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          ticketId,
          authorId: "hr-admin",
          authorName: "HR Operations Support",
          comment: newComment,
        }),
      });

      if (res.ok) {
        setNewComment("");
        setNotification("Reply posted.");
        loadTicket();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await fetch("/api/hrm/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          ticketId,
          newStatus,
          changedBy: "HR Operations Support",
        }),
      });

      if (res.ok) {
        setNotification(`Ticket status moved to ${newStatus}.`);
        loadTicket();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading || !ticket) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-xs text-[#71717A]">
        Loading ticket details...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        breadcrumbs={[
          { label: "HRM & Payroll", href: "/hrm" },
          { label: "Grievances", href: "/hrm?tab=grievances" },
          { label: ticket.ticketNumber },
        ]}
        title={ticket.ticketNumber}
        subtitle={`${ticket.category} • Raised by ${ticket.employee?.name} on ${formatDateTime(ticket.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            {ticket.status !== "In Progress" && ticket.status !== "Resolved" && (
              <button
                onClick={() => handleUpdateStatus("In Progress")}
                className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
              >
                Mark In Progress
              </button>
            )}
            {ticket.status !== "Resolved" && (
              <button
                onClick={() => handleUpdateStatus("Resolved")}
                className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve Ticket
              </button>
            )}
            <Link
              href="/hrm?tab=grievances"
              className="h-8 px-3 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Queue
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ticket Summary & Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-4 text-xs">
            <h2 className="text-sm font-bold text-[#18181B] pb-2 border-b border-[#E4E4E7] flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-[#0D7A5F]" />
              Ticket Metadata
            </h2>

            <div>
              <span className="text-[#71717A] block">Current Status</span>
              <div className="mt-1">
                <StatusBadge status={ticket.status} />
              </div>
            </div>

            <div>
              <span className="text-[#71717A] block">Category</span>
              <p className="font-bold text-[#18181B] mt-0.5">{ticket.category}</p>
            </div>

            <div>
              <span className="text-[#71717A] block">Raised By Employee</span>
              <p className="font-semibold text-[#18181B] mt-0.5">
                {ticket.employee?.name} ({ticket.employee?.designation || ticket.employee?.role} — {ticket.employee?.department})
              </p>
              <p className="text-[11px] text-[#71717A] mt-0.5">{ticket.employee?.phone}</p>
            </div>

            <div>
              <span className="text-[#71717A] block">Raised Date</span>
              <p className="font-mono text-[#18181B] mt-0.5">{formatDateTime(ticket.createdAt)}</p>
            </div>
          </div>

          {/* Immutable Status Transition History */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-[#18181B] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#71717A]" />
              Audit Status History
            </h3>

            <div className="space-y-2 border-l-2 border-[#E4E4E7] pl-3">
              {ticket.statusHistory?.map((h: any) => (
                <div key={h.id} className="relative">
                  <div className="flex items-center gap-1 font-bold text-[#18181B]">
                    <span>{h.fromStatus}</span>
                    <ArrowRight className="w-3 h-3 text-[#71717A]" />
                    <span className="text-[#0D7A5F]">{h.toStatus}</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    By {h.changedBy} • {formatDateTime(h.changedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Issue Description & Comment Thread */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717A]">
              Issue Description
            </h3>
            <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] text-xs text-[#18181B] leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {/* Comment Thread */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717A] flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Discussion & Resolution Thread ({ticket.comments?.length || 0})
            </h3>

            <div className="space-y-3">
              {ticket.comments?.map((c: any) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#18181B]">{c.authorName}</span>
                    <span className="text-[10px] text-[#71717A] font-mono">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-[#3F3F46] leading-relaxed">{c.comment}</p>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            <form onSubmit={handleAddComment} className="pt-2 border-t border-[#E4E4E7] space-y-2">
              <textarea
                rows={3}
                required
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Type response, resolution notes, or dispatch instructions..."
                className="w-full p-2.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingComment}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmittingComment ? "Posting..." : "Post Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
