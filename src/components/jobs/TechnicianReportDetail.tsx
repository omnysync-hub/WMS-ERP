"use client";

import React, { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TechnicianReportItem, DetailedJobReportItem } from "@/lib/services/JobReportService";
import {
  ChevronLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  Receipt,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  MapPin,
  Calendar,
  Layers,
  History,
  Fuel,
  CheckCheck,
  AlertTriangle,
  UserCheck,
  Percent,
} from "lucide-react";

interface TechnicianReportDetailProps {
  technician: TechnicianReportItem;
  dateRangeLabel: string;
  onBack: () => void;
}

export default function TechnicianReportDetail({
  technician,
  dateRangeLabel,
  onBack,
}: TechnicianReportDetailProps) {
  const [subTab, setSubTab] = useState<"jobs" | "expenses" | "materials">("jobs");
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    technician.jobs.forEach((j) => {
      all[j.id] = true;
    });
    setExpandedJobIds(all);
  };

  const collapseAll = () => {
    setExpandedJobIds({});
  };

  // CSV Export for this technician
  const exportTechnicianCSV = () => {
    const headers = [
      "Job Number",
      "Type",
      "Status",
      "Customer",
      "Assigned At",
      "Started At",
      "Completed At",
      "Active Duration",
      "Revenue Earned (PKR)",
      "Expenses (PKR)",
      "Expenses Paid (PKR)",
      "Cash Collected (PKR)",
    ];

    const rows = technician.jobs.map((j) => [
      `"${j.jobNumber}"`,
      `"${j.jobType}"`,
      `"${j.status}"`,
      `"${(j.customer?.name || "").replace(/"/g, '""')}"`,
      `"${j.timestamps.assignedAt ? formatDateTime(j.timestamps.assignedAt) : "—"}"`,
      `"${j.timestamps.startedAt ? formatDateTime(j.timestamps.startedAt) : "—"}"`,
      `"${j.timestamps.completedAt ? formatDateTime(j.timestamps.completedAt) : "—"}"`,
      `"${j.timestamps.formattedDuration}"`,
      j.netBilled || 0,
      j.expensesTotal || 0,
      j.expensesPaidTotal || 0,
      j.hisaab?.amountCollected || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Technician_${technician.name.replace(/\s+/g, "_")}_Audit_${dateRangeLabel.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white border border-[#EDEDED] rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#71717A] hover:text-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] px-2.5 py-1 rounded-md transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to All Technicians Comparison
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D7A5F] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              Technician Dossier & Lifecycle Audit
            </span>
            <span className="text-xs text-[#71717A] font-mono">
              Window: <strong>{dateRangeLabel}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="w-11 h-11 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center font-black text-lg shadow-sm">
              {technician.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#18181B] leading-none flex items-center gap-2">
                {technician.name}
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Active Field Tech
                </span>
              </h1>
              <p className="text-xs text-[#71717A] mt-1 font-mono">
                Phone: <strong className="text-[#18181B]">{technician.phone || "—"}</strong> • {technician.designation}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={exportTechnicianCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Tech Audit CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3F3F46] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-lg border border-[#D4D4D8] transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Dossier
          </button>
        </div>
      </div>

      {/* 4 Core Financial & Velocity KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* 1. Revenue Earned for Company */}
        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Revenue Earned for Us
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono text-[#18181B]">
              {formatCurrency(technician.totalRevenueEarned)}
            </span>
            <div className="flex items-center justify-between mt-1 text-[10px] text-[#71717A]">
              <span>Gross Margin Generated:</span>
              <strong className="font-mono text-emerald-700">
                {formatCurrency(technician.grossProfitGenerated)}
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Job Execution Velocity */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Job Execution Velocity
            </span>
            <Briefcase className="w-4 h-4 text-[#0D7A5F]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#18181B]">
              {technician.doneCount}
              <span className="text-xs font-normal text-[#71717A]">/{technician.totalAssigned} Done</span>
            </span>
            <span className="text-xs font-bold text-emerald-700">
              ({technician.completionRate}%)
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-[#71717A]">
            <span>Active: <strong className="text-blue-700">{technician.inProgressCount}</strong></span>
            <span>Pending: <strong className="text-amber-700">{technician.leftCount}</strong></span>
            <span>Avg Time: <strong className="text-[#18181B] font-mono">{technician.formattedAverageDuration}</strong></span>
          </div>
        </div>

        {/* 3. Expense Claims & Reimbursement Status */}
        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
              Field Expenses Incurred
            </span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono text-[#18181B]">
              {formatCurrency(technician.totalExpensesClaimed)}
            </span>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCheck className="w-3 h-3 text-emerald-600" />
                Paid: {formatCurrency(technician.totalExpensesPaid)}
              </span>
              {technician.totalExpensesPending > 0 ? (
                <span className="text-amber-700 font-bold font-mono">
                  Pending: {formatCurrency(technician.totalExpensesPending)}
                </span>
              ) : (
                <span className="text-neutral-400 font-mono">Cleared</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Cash Collected (Hisaab) */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Customer Cash Handed Over
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono text-emerald-700">
              {formatCurrency(technician.totalCashCollected)}
            </span>
            <div className="mt-1 flex items-center justify-between text-[10px] text-[#71717A]">
              <span>Customer Balance Due:</span>
              <strong className="font-mono text-rose-600">
                {formatCurrency(technician.totalCashBalanceDue)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dossier Sub-Tabs */}
      <div className="bg-white border border-[#EDEDED] rounded-xl shadow-sm overflow-hidden">
        {/* Navigation Bar */}
        <div className="border-b border-[#EDEDED] px-4 pt-3 flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab("jobs")}
              className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                subTab === "jobs"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Jobs Lifecycle & Timestamps ({technician.jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab("expenses")}
              className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                subTab === "expenses"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Expenses & Reimbursements ({technician.expenseClaims.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab("materials")}
              className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                subTab === "materials"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Warehouse Materials Drawn ({technician.materialsDrawn.length})
            </button>
          </div>

          {subTab === "jobs" && (
            <div className="pb-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] font-semibold text-[#52525B] hover:text-[#18181B] px-2.5 py-1 bg-white border border-[#D4D4D8] rounded-md cursor-pointer"
              >
                Expand All Timelines
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] font-semibold text-[#52525B] hover:text-[#18181B] px-2.5 py-1 bg-white border border-[#D4D4D8] rounded-md cursor-pointer"
              >
                Collapse
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: End-to-End Jobs Lifecycle & Exact Timestamps */}
        {subTab === "jobs" && (
          <div className="overflow-x-auto">
            {technician.jobs.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <Briefcase className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-[#18181B]">No jobs assigned to this technician in this timeframe</p>
                <p className="text-[11px] mt-1">Try widening your date range.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] text-[#52525B] font-semibold border-b border-[#EDEDED]">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Job ID & Customer</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assigned At</th>
                    <th className="py-2.5 px-3">Started On-Site</th>
                    <th className="py-2.5 px-3">Stopped / Completed</th>
                    <th className="py-2.5 px-3 text-center">Active Duration</th>
                    <th className="py-2.5 px-3 text-right">Revenue Earned</th>
                    <th className="py-2.5 px-3 text-right">Tech Expense</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {technician.jobs.map((job) => {
                    const isExpanded = expandedJobIds[job.id] || false;
                    const { timestamps } = job;
                    const hasPauses = timestamps.pausedIntervals.length > 0;

                    return (
                      <React.Fragment key={job.id}>
                        <tr
                          onClick={() => toggleExpand(job.id)}
                          className={`hover:bg-[#F9FAFB] cursor-pointer transition ${
                            isExpanded ? "bg-[#F7F9F8]" : ""
                          }`}
                        >
                          {/* Chevron */}
                          <td className="py-2.5 px-3 text-center text-[#71717A]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(job.id);
                              }}
                              className="p-0.5 hover:bg-neutral-200 rounded-md transition cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#0D7A5F]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          {/* Job & Customer */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-[#0D7A5F] hover:underline block">
                              {job.jobNumber}
                            </span>
                            <span className="font-semibold text-[#18181B] block mt-0.5">
                              {job.customer?.name}
                            </span>
                            <span className="text-[10px] text-[#71717A] capitalize">
                              {job.jobType}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <StatusBadge status={job.status} />
                            {job.status === "Paused" && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded-sm block mt-1 w-fit">
                                Currently Paused
                              </span>
                            )}
                          </td>

                          {/* Assigned At */}
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#52525B]">
                            {timestamps.assignedAt ? formatDateTime(timestamps.assignedAt) : "—"}
                          </td>

                          {/* Started On-Site */}
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {timestamps.startedAt ? (
                              <span className="text-emerald-700 font-semibold block">
                                {formatDateTime(timestamps.startedAt)}
                              </span>
                            ) : (
                              <span className="text-[#A1A1AA] italic">Not started yet</span>
                            )}
                          </td>

                          {/* Stopped / Completed */}
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {timestamps.completedAt ? (
                              <span className="text-blue-700 font-semibold block">
                                {formatDateTime(timestamps.completedAt)}
                              </span>
                            ) : job.status === "InProgress" ? (
                              <span className="text-blue-600 font-bold animate-pulse">Running now...</span>
                            ) : (
                              <span className="text-[#A1A1AA]">—</span>
                            )}
                          </td>

                          {/* Active Duration */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-neutral-100 text-[#18181B]">
                              <Clock className="w-3 h-3 text-[#0D7A5F]" />
                              {timestamps.formattedDuration}
                            </span>
                            {hasPauses && (
                              <span className="text-[9px] text-amber-700 block mt-0.5">
                                ({timestamps.pausedIntervals.length} pause interval{timestamps.pausedIntervals.length > 1 ? "s" : ""})
                              </span>
                            )}
                          </td>

                          {/* Revenue Earned */}
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-mono font-bold text-[#18181B] block">
                              {formatCurrency(job.netBilled)}
                            </span>
                            {job.statusGroup === "done" && (
                              <span className="text-[9px] text-emerald-700 font-bold block">
                                Earned for company
                              </span>
                            )}
                          </td>

                          {/* Tech Expense */}
                          <td className="py-2.5 px-3 text-right">
                            {job.expensesTotal > 0 ? (
                              <div>
                                <span className="font-mono font-bold text-amber-900 block">
                                  {formatCurrency(job.expensesTotal)}
                                </span>
                                <span className={`text-[9px] font-bold block ${
                                  job.expensesPaidTotal >= job.expensesTotal
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                                }`}>
                                  {job.expensesPaidTotal >= job.expensesTotal
                                    ? "Paid"
                                    : `Paid: ${formatCurrency(job.expensesPaidTotal)}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#A1A1AA]">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href={`/jobs/${job.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D7A5F] hover:underline bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200"
                            >
                              Detail <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>

                        {/* Expanded Detailed Milestone Trail */}
                        {isExpanded && (
                          <tr className="bg-[#F8FAFC]">
                            <td colSpan={10} className="p-4 border-t border-b border-[#E2E8F0]">
                              <div className="space-y-4">
                                {/* Visual Step Timeline */}
                                <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs">
                                  <span className="text-[11px] font-bold text-[#18181B] uppercase tracking-wider block mb-3">
                                    Milestone Progression & Lifecycle Trail
                                  </span>

                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                                    {/* Milestone 1: Assigned */}
                                    <div className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED]">
                                      <span className="text-[10px] font-bold uppercase text-[#71717A] block">
                                        1. Assigned
                                      </span>
                                      <span className="font-mono font-bold text-[#18181B] block mt-1">
                                        {timestamps.assignedAt ? formatDateTime(timestamps.assignedAt) : "—"}
                                      </span>
                                      <span className="text-[10px] text-[#71717A] mt-0.5 block">
                                        Assigned to {technician.name}
                                      </span>
                                    </div>

                                    {/* Milestone 2: Accepted */}
                                    <div className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED]">
                                      <span className="text-[10px] font-bold uppercase text-[#71717A] block">
                                        2. Accepted by Tech
                                      </span>
                                      <span className="font-mono font-bold text-[#18181B] block mt-1">
                                        {timestamps.acceptedAt ? formatDateTime(timestamps.acceptedAt) : "—"}
                                      </span>
                                      <span className="text-[10px] text-[#71717A] mt-0.5 block">
                                        Mobile app ack
                                      </span>
                                    </div>

                                    {/* Milestone 3: Started on Site */}
                                    <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
                                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                                        3. Started On-Site
                                      </span>
                                      <span className="font-mono font-bold text-emerald-950 block mt-1">
                                        {timestamps.startedAt ? formatDateTime(timestamps.startedAt) : "Not started"}
                                      </span>
                                      <span className="text-[10px] text-emerald-700 mt-0.5 block">
                                        GPS & clock-in captured
                                      </span>
                                    </div>

                                    {/* Milestone 4: Paused / Resumed */}
                                    <div className={`p-2.5 rounded-lg border ${
                                      hasPauses
                                        ? "bg-amber-50/70 border-amber-200"
                                        : "bg-[#F9FAFB] border-[#EDEDED]"
                                    }`}>
                                      <span className="text-[10px] font-bold uppercase text-amber-900 block">
                                        4. Pauses & Holds
                                      </span>
                                      {hasPauses ? (
                                        <div>
                                          <span className="font-mono font-bold text-amber-950 block mt-1">
                                            {timestamps.pausedIntervals.length} pause event(s)
                                          </span>
                                          <span className="text-[10px] text-amber-800 mt-0.5 block truncate">
                                            {timestamps.pausedIntervals[0]?.reason || "Field pause"}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-[#A1A1AA] mt-1 block">
                                          No pauses recorded
                                        </span>
                                      )}
                                    </div>

                                    {/* Milestone 5: Completed / Finalized */}
                                    <div className={`p-2.5 rounded-lg border ${
                                      timestamps.completedAt
                                        ? "bg-blue-50/60 border-blue-200"
                                        : "bg-[#F9FAFB] border-[#EDEDED]"
                                    }`}>
                                      <span className="text-[10px] font-bold uppercase text-blue-900 block">
                                        5. Completed / Stop
                                      </span>
                                      <span className="font-mono font-bold text-blue-950 block mt-1">
                                        {timestamps.completedAt ? formatDateTime(timestamps.completedAt) : "Pending"}
                                      </span>
                                      <span className="text-[10px] text-blue-700 mt-0.5 block">
                                        Active Time: {timestamps.formattedDuration}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Detailed 2-Column Split: Activity Log & Materials/Expenses */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Activity Log from JobStatusHistory */}
                                  <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                                    <span className="font-bold text-[#18181B] text-xs flex items-center gap-1.5 pb-2 mb-2 border-b border-[#EDEDED]">
                                      <History className="w-3.5 h-3.5 text-[#0D7A5F]" />
                                      Full Chronological State History Log ({timestamps.lifecycleEvents.length})
                                    </span>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                      {timestamps.lifecycleEvents.map((evt) => (
                                        <div
                                          key={evt.id}
                                          className="p-1.5 bg-[#F9FAFB] rounded-md border border-[#E4E4E7] flex items-center justify-between text-[11px]"
                                        >
                                          <div>
                                            <span className="font-semibold text-[#18181B]">
                                              {evt.fromStatus} ➔ <strong className="text-[#0D7A5F]">{evt.toStatus}</strong>
                                            </span>
                                            <span className="text-[10px] text-[#71717A] block">
                                              By: {evt.changedBy}
                                            </span>
                                          </div>
                                          <span className="font-mono text-[10px] text-[#71717A]">
                                            {formatDateTime(evt.changedAt)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Materials & Expenses for this Job */}
                                  <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] space-y-3">
                                    <div>
                                      <span className="font-bold text-[#18181B] text-xs flex items-center gap-1.5 pb-1 mb-1 border-b border-[#EDEDED]">
                                        <Package className="w-3.5 h-3.5 text-blue-600" />
                                        Parts Issued for this Job ({job.issuedMaterials?.length || 0})
                                      </span>
                                      {job.issuedMaterials?.length > 0 ? (
                                        <div className="space-y-1 text-[11px]">
                                          {job.issuedMaterials.map((m) => (
                                            <div key={m.id} className="flex justify-between text-[#52525B]">
                                              <span>{m.item}</span>
                                              <span className="font-mono font-semibold">
                                                {m.netConsumed} {m.unit} (Issued: {m.qtyIssued}, Ret: {m.qtyReturned})
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-[#A1A1AA] italic">No parts drawn for this job</span>
                                      )}
                                    </div>

                                    <div>
                                      <span className="font-bold text-[#18181B] text-xs flex items-center gap-1.5 pb-1 mb-1 border-b border-[#EDEDED]">
                                        <Receipt className="w-3.5 h-3.5 text-amber-600" />
                                        Job Field Expenses ({job.expenses?.length || 0})
                                      </span>
                                      {job.expenses?.length > 0 ? (
                                        <div className="space-y-1 text-[11px]">
                                          {job.expenses.map((exp) => (
                                            <div key={exp.id} className="flex justify-between items-center text-[#52525B]">
                                              <span>{exp.note}</span>
                                              <div className="text-right font-mono">
                                                <strong className="text-amber-900">{formatCurrency(exp.amount)}</strong>
                                                <span className={`text-[9px] font-bold block ${
                                                  exp.status === "paid" ? "text-emerald-700" : "text-amber-700"
                                                }`}>
                                                  {exp.status === "paid" ? `Paid on ${formatDateTime(exp.paidAt)}` : "Pending Approval"}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-[#A1A1AA] italic">No expenses filed on this job</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Expenses & Reimbursements Ledger */}
        {subTab === "expenses" && (
          <div className="overflow-x-auto">
            <div className="p-3 bg-amber-50/70 border-b border-amber-200 text-xs text-amber-950 flex items-center justify-between">
              <span>
                <strong>Expense Audit & Reimbursement Clearance:</strong> Tally of all expense vouchers submitted by <strong>{technician.name}</strong>.
              </span>
              <div className="flex items-center gap-3 font-mono">
                <span>Total: <strong>{formatCurrency(technician.totalExpensesClaimed)}</strong></span>
                <span className="text-emerald-800">Paid: <strong>{formatCurrency(technician.totalExpensesPaid)}</strong></span>
                <span className="text-amber-800">Pending: <strong>{formatCurrency(technician.totalExpensesPending)}</strong></span>
              </div>
            </div>

            {technician.expenseClaims.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <Receipt className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-[#18181B]">No expenses submitted by {technician.name}</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] text-[#52525B] font-semibold border-b border-[#EDEDED]">
                    <th className="py-2.5 px-3">Date Submitted</th>
                    <th className="py-2.5 px-3">Linked Job #</th>
                    <th className="py-2.5 px-3">Expense Category / Description</th>
                    <th className="py-2.5 px-3 text-right">Amount Claimed</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Reimbursement Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {technician.expenseClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-[#F9FAFB] transition">
                      <td className="py-2.5 px-3 font-mono text-[#71717A]">
                        {formatDateTime(claim.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0D7A5F]">
                        <Link href={`/jobs/${claim.jobId}`} className="hover:underline">
                          {claim.jobNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#18181B]">
                        {claim.note}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900">
                        {formatCurrency(claim.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            claim.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {claim.status === "paid" ? "Paid / Reimbursed" : "Pending Clearance"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#71717A] font-mono text-[11px]">
                        {claim.paidAt ? (
                          <span className="text-emerald-700 font-semibold">
                            Cleared on {formatDateTime(claim.paidAt)}
                          </span>
                        ) : (
                          <span className="text-amber-700 italic">Awaiting accounts voucher approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Warehouse Materials Drawn */}
        {subTab === "materials" && (
          <div className="overflow-x-auto">
            <div className="p-3 bg-blue-50/70 border-b border-blue-200 text-xs text-blue-950 flex items-center justify-between">
              <span>
                <strong>Materials Issued to Technician:</strong> All physical items and parts checked out by <strong>{technician.name}</strong> from stores.
              </span>
              <span className="font-mono font-bold text-blue-900">
                Total Material Value: {formatCurrency(technician.materialsTotalCost)}
              </span>
            </div>

            {technician.materialsDrawn.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <Package className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-[#18181B]">No warehouse items drawn by this technician</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] text-[#52525B] font-semibold border-b border-[#EDEDED]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Item / Part Name</th>
                    <th className="py-2.5 px-3">Linked Job #</th>
                    <th className="py-2.5 px-3 text-right">Qty Issued</th>
                    <th className="py-2.5 px-3 text-right">Qty Returned</th>
                    <th className="py-2.5 px-3 text-right font-bold text-[#18181B]">Net Consumed</th>
                    <th className="py-2.5 px-3 text-right">Inventory Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {technician.materialsDrawn.map((mat, mIdx) => (
                    <tr key={mIdx} className="hover:bg-[#F9FAFB] transition">
                      <td className="py-2.5 px-3 font-mono text-[#71717A]">
                        {formatDateTime(mat.date)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#18181B]">
                        {mat.item}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0D7A5F]">
                        <Link href={`/jobs/${mat.jobId}`} className="hover:underline">
                          {mat.jobNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700">
                        {mat.qtyIssued} {mat.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                        {mat.qtyReturned > 0 ? `-${mat.qtyReturned} ${mat.unit}` : "0"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/50">
                        {mat.netConsumed} {mat.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(mat.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
