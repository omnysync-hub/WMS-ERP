"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Receipt,
  User,
  MapPin,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  SlidersHorizontal,
  ChevronLeft,
} from "lucide-react";

import TechnicianReportDetail from "./TechnicianReportDetail";
import { TechnicianReportItem } from "@/lib/services/JobReportService";

interface JobReportsViewProps {
  onBackToDirectory?: () => void;
}

export default function JobReportsView({ onBackToDirectory }: JobReportsViewProps) {
  // Drill-down to specific technician dossier
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianReportItem | null>(null);

  // Filter states
  const [period, setPeriod] = useState<"today" | "yesterday" | "this_week" | "this_month" | "custom">("today");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [statusGroupFilter, setStatusGroupFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("ALL");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sub-view tab
  const [activeReportTab, setActiveReportTab] = useState<"jobs" | "materials" | "technicians">("jobs");

  // Expanded row state for jobs
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});

  // Data states
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [techniciansList, setTechniciansList] = useState<any[]>([]);

  // Fetch report data
  async function fetchReport() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("period", period);
      if (period === "custom") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }
      if (statusGroupFilter !== "all") params.set("statusGroup", statusGroupFilter);
      if (technicianFilter !== "ALL") params.set("technicianId", technicianFilter);
      if (jobTypeFilter !== "ALL") params.set("jobType", jobTypeFilter);

      const res = await fetch(`/api/jobs/reports?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setReportData(data);
      } else {
        console.error("Failed to load report", data);
      }
    } catch (err) {
      console.error("Error fetching job report", err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch technicians once for filter dropdown
  useEffect(() => {
    async function fetchTechs() {
      try {
        const res = await fetch("/api/technicians");
        const data = await res.json();
        if (data?.technicians) {
          setTechniciansList(data.technicians);
        }
      } catch (e) {
        console.error("Failed loading technicians", e);
      }
    }
    fetchTechs();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [period, startDate, endDate, statusGroupFilter, technicianFilter, jobTypeFilter]);

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  };

  const expandAll = () => {
    if (!reportData?.jobsDetailed) return;
    const allExpanded: Record<string, boolean> = {};
    reportData.jobsDetailed.forEach((j: any) => {
      allExpanded[j.id] = true;
    });
    setExpandedJobIds(allExpanded);
  };

  const collapseAll = () => {
    setExpandedJobIds({});
  };

  // Filtered jobs by client-side text search
  const filteredJobs = useMemo(() => {
    if (!reportData?.jobsDetailed) return [];
    if (!searchQuery.trim()) return reportData.jobsDetailed;
    const q = searchQuery.toLowerCase();
    return reportData.jobsDetailed.filter(
      (j: any) =>
        j.jobNumber?.toLowerCase().includes(q) ||
        j.customer?.name?.toLowerCase().includes(q) ||
        j.customer?.addressText?.toLowerCase().includes(q) ||
        j.assignedTechnician?.name?.toLowerCase().includes(q) ||
        j.remarks?.toLowerCase().includes(q) ||
        j.issuedMaterials?.some((m: any) => m.item?.toLowerCase().includes(q))
    );
  }, [reportData, searchQuery]);

  // CSV Export
  const exportToCSV = () => {
    if (!reportData?.jobsDetailed || reportData.jobsDetailed.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Job Number",
      "Type",
      "Status",
      "Status Category",
      "Customer",
      "Address",
      "Technician",
      "Created At",
      "Finalized At",
      "Materials Issued Count",
      "Materials Net Cost (PKR)",
      "Expenses Total (PKR)",
      "Billed Net (PKR)",
      "Estimated Margin (PKR)",
      "Cash Collected (PKR)",
      "Balance Due (PKR)",
    ];

    const rows = reportData.jobsDetailed.map((j: any) => [
      `"${j.jobNumber}"`,
      `"${j.jobType}"`,
      `"${j.status}"`,
      `"${j.statusGroup.toUpperCase()}"`,
      `"${(j.customer?.name || "").replace(/"/g, '""')}"`,
      `"${(j.customer?.addressText || "").replace(/"/g, '""')}"`,
      `"${(j.assignedTechnician?.name || "Unassigned").replace(/"/g, '""')}"`,
      `"${formatDateTime(j.createdAt)}"`,
      `"${j.finalizedAt ? formatDateTime(j.finalizedAt) : "—"}"`,
      j.issuedMaterials?.length || 0,
      j.materialsCostTotal || 0,
      j.expensesTotal || 0,
      j.netBilled || 0,
      j.estimatedProfitMargin || 0,
      j.hisaab?.amountCollected || 0,
      j.hisaab?.balanceDue || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Job_Report_Audit_${reportData?.meta?.dateRangeLabel || period}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = reportData?.summary || {
    totalJobs: 0,
    doneCount: 0,
    inProgressCount: 0,
    leftCount: 0,
    disputedCount: 0,
    completionRate: 0,
    totalRevenue: 0,
    totalDiscounts: 0,
    netBilled: 0,
    totalMaterialCost: 0,
    totalExpenses: 0,
    grossMargin: 0,
    totalCashCollected: 0,
    totalBalanceDue: 0,
  };

  if (selectedTechnician) {
    return (
      <TechnicianReportDetail
        technician={selectedTechnician}
        dateRangeLabel={reportData?.meta?.dateRangeLabel || period}
        onBack={() => setSelectedTechnician(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & View Switcher */}
      <div className="bg-white border border-[#EDEDED] rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {onBackToDirectory && (
              <button
                type="button"
                onClick={onBackToDirectory}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#71717A] hover:text-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] px-2 py-1 rounded-md transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back to Jobs Directory
              </button>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D7A5F] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              Admin & Operations Audit
            </span>
            <span className="text-xs text-[#71717A] font-mono">
              Window: <strong>{reportData?.meta?.dateRangeLabel || "Today"}</strong>
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#18181B] mt-1.5 flex items-center gap-2">
            Job Reports & Daily End-to-End Audit
          </h1>
          <p className="text-xs text-[#71717A] mt-0.5">
            Real-time performance tracking: monitor completed jobs, active in-progress jobs, pending backlog, issued warehouse materials, and daily cash settlements.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3F3F46] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-lg border border-[#D4D4D8] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0D7A5F]" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Audit CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3F3F46] bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded-lg border border-[#D4D4D8] transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Control Bar: Timeframe Presets & Custom Duration Pickers */}
      <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-lg border border-[#E4E4E7]">
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "custom", label: "Custom Duration" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  period === p.id
                    ? "bg-[#18181B] text-white shadow-xs"
                    : "text-[#52525B] hover:text-[#18181B] hover:bg-[#E4E4E7]/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filters: Tech, Job Type, Status */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-2.5 py-1">
              <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Status:</span>
              <select
                value={statusGroupFilter}
                onChange={(e) => setStatusGroupFilter(e.target.value)}
                className="bg-transparent text-[#18181B] font-semibold text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Statuses ({summary.totalJobs})</option>
                <option value="done">Done / Completed ({summary.doneCount})</option>
                <option value="in_progress">In Progress / Partial ({summary.inProgressCount})</option>
                <option value="left">Left / Pending ({summary.leftCount})</option>
              </select>
            </div>

            {/* Technician Filter */}
            <div className="flex items-center gap-1 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-2.5 py-1">
              <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Tech:</span>
              <select
                value={technicianFilter}
                onChange={(e) => setTechnicianFilter(e.target.value)}
                className="bg-transparent text-[#18181B] font-semibold text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Technicians</option>
                {techniciansList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Type Filter */}
            <div className="flex items-center gap-1 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg px-2.5 py-1">
              <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Type:</span>
              <select
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
                className="bg-transparent text-[#18181B] font-semibold text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="repair">Repair</option>
                <option value="maintenance">Maintenance</option>
                <option value="installation">Installation</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Duration Date Inputs (Shown if period === 'custom') */}
        {period === "custom" && (
          <div className="pt-2 border-t border-[#EDEDED] flex flex-wrap items-center gap-3 bg-[#F9FAFB] p-2.5 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0D7A5F]" />
              <span className="text-xs font-semibold text-[#18181B]">Custom Range:</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-[#71717A]">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-[#D4D4D8] rounded-md px-2 py-1 text-xs text-[#18181B] font-mono focus:outline-hidden focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-[#71717A]">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-[#D4D4D8] rounded-md px-2 py-1 text-xs text-[#18181B] font-mono focus:outline-hidden focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
            <button
              type="button"
              onClick={fetchReport}
              className="px-3 py-1 bg-[#0D7A5F] text-white rounded-md text-xs font-semibold hover:bg-emerald-700 transition"
            >
              Apply Dates
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards: Primary Status velocity (Done, In-Progress, Left) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Done / Completed */}
        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Jobs Done
            </span>
            <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#18181B]">{summary.doneCount}</span>
            <span className="text-xs text-emerald-700 font-semibold">
              ({summary.totalJobs > 0 ? Math.round((summary.doneCount / summary.totalJobs) * 100) : 0}%)
            </span>
          </div>
          <span className="text-[10px] text-[#71717A] mt-1 block">
            Finalized, Verified & Sign-Off
          </span>
        </div>

        {/* Partially Done / In Progress */}
        <div className="bg-white border border-blue-200 rounded-xl p-3.5 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Partially / In-Progress
            </span>
            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#18181B]">{summary.inProgressCount}</span>
            <span className="text-xs text-blue-700 font-semibold">
              ({summary.totalJobs > 0 ? Math.round((summary.inProgressCount / summary.totalJobs) * 100) : 0}%)
            </span>
          </div>
          <span className="text-[10px] text-[#71717A] mt-1 block">
            Active in field & paused
          </span>
        </div>

        {/* Left / Pending */}
        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Jobs Left / Pending
            </span>
            <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#18181B]">{summary.leftCount}</span>
            <span className="text-xs text-amber-700 font-semibold">
              ({summary.totalJobs > 0 ? Math.round((summary.leftCount / summary.totalJobs) * 100) : 0}%)
            </span>
          </div>
          <span className="text-[10px] text-[#71717A] mt-1 block">
            Created, Assigned, Awaiting start
          </span>
        </div>

        {/* Completion Velocity */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#52525B] uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-[#18181B]">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#18181B]">{summary.completionRate}%</span>
            <span className="text-xs text-[#71717A]">
              ({summary.doneCount}/{summary.totalJobs} total)
            </span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#0D7A5F] h-full rounded-full transition-all duration-500"
              style={{ width: `${summary.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards: End-to-End Financial & Inventory Health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Net Billed */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Net Billed Value
            </span>
            <DollarSign className="w-3.5 h-3.5 text-[#0D7A5F]" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-[#18181B]">
              {formatCurrency(summary.netBilled)}
            </span>
            {summary.totalDiscounts > 0 && (
              <span className="text-[10px] text-amber-700 block font-mono">
                incl. -{formatCurrency(summary.totalDiscounts)} discounts
              </span>
            )}
          </div>
        </div>

        {/* Materials Issued (COGS) */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Parts / Materials Issued
            </span>
            <Package className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-[#18181B]">
              {formatCurrency(summary.totalMaterialCost)}
            </span>
            <span className="text-[10px] text-[#71717A] block">
              {reportData?.materialsBreakdown?.length || 0} distinct items consumed
            </span>
          </div>
        </div>

        {/* Tech Expenses */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Tech Out-of-Pocket
            </span>
            <Receipt className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-[#18181B]">
              {formatCurrency(summary.totalExpenses)}
            </span>
            <span className="text-[10px] text-[#71717A] block">
              Est. Profit: {formatCurrency(summary.grossMargin)}
            </span>
          </div>
        </div>

        {/* Cash Collected (Hisaab) */}
        <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Hisaab Cash Collected
            </span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-emerald-700">
              {formatCurrency(summary.totalCashCollected)}
            </span>
            {summary.totalBalanceDue > 0 && (
              <span className="text-[10px] text-rose-600 font-semibold block font-mono">
                Pending Due: {formatCurrency(summary.totalBalanceDue)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Report Sub-Views Container */}
      <div className="bg-white border border-[#EDEDED] rounded-xl shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-[#EDEDED] px-4 pt-3 flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveReportTab("jobs")}
              className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeReportTab === "jobs"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              End-to-End Jobs Log ({filteredJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab("materials")}
              className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeReportTab === "materials"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Materials & Parts Issued ({reportData?.materialsBreakdown?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab("technicians")}
              className={`pb-3 px-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeReportTab === "technicians"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Technician Roster & Day Progress ({reportData?.technicianBreakdown?.length || 0})
            </button>
          </div>

          {/* Search bar inside view */}
          {activeReportTab === "jobs" && (
            <div className="pb-2.5 flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter jobs, customer, materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white border border-[#D4D4D8] rounded-md text-xs text-[#18181B] focus:outline-hidden focus:ring-1 focus:ring-[#0D7A5F] w-64"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[11px] font-semibold text-[#52525B] hover:text-[#18181B] px-2 py-1 bg-white border border-[#D4D4D8] rounded-md"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[11px] font-semibold text-[#52525B] hover:text-[#18181B] px-2 py-1 bg-white border border-[#D4D4D8] rounded-md"
                >
                  Collapse
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: End-to-End Jobs Log */}
        {activeReportTab === "jobs" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0D7A5F] mb-2" />
                Aggregating end-to-end job records for {reportData?.meta?.dateRangeLabel || period}...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <Layers className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-[#18181B]">No jobs match the selected filter criteria</p>
                <p className="text-[11px] mt-1">Try choosing a different timeframe or changing status filters.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] text-[#52525B] font-semibold border-b border-[#EDEDED]">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Job ID & Type</th>
                    <th className="py-2.5 px-3">Customer & Location</th>
                    <th className="py-2.5 px-3">Technician</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Materials Issued</th>
                    <th className="py-2.5 px-3">Expenses</th>
                    <th className="py-2.5 px-3 text-right">Net Billed</th>
                    <th className="py-2.5 px-3 text-right">Cash Collected</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {filteredJobs.map((job: any, index: number) => {
                    const isExpanded = expandedJobIds[job.id] || false;
                    const issuedCount = job.issuedMaterials?.length || 0;

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
                              className="p-0.5 hover:bg-neutral-200 rounded-md transition"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#0D7A5F]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          {/* Job ID & Type */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[#0D7A5F] hover:underline">
                                {job.jobNumber}
                              </span>
                              {job.qualityFlag === "disputed" && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded-sm">
                                  Disputed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] mt-0.5">
                              <span className="capitalize">{job.jobType}</span>
                              <span>•</span>
                              <span>{formatDateTime(job.createdAt)}</span>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-[#18181B] block">{job.customer?.name}</span>
                            <span className="text-[11px] text-[#71717A] truncate block max-w-xs">
                              {job.customer?.addressText || "Physical address on file"}
                            </span>
                          </td>

                          {/* Technician */}
                          <td className="py-2.5 px-3">
                            {job.assignedTechnician ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[9px]">
                                  {job.assignedTechnician.name.charAt(0)}
                                </div>
                                <span className="font-medium text-[#18181B]">
                                  {job.assignedTechnician.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-medium">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={job.status} />
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                                  job.statusGroup === "done"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : job.statusGroup === "in_progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {job.statusGroup === "done"
                                  ? "Done"
                                  : job.statusGroup === "in_progress"
                                  ? "Partial"
                                  : "Left"}
                              </span>
                            </div>
                          </td>

                          {/* Materials Issued */}
                          <td className="py-2.5 px-3">
                            {issuedCount > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                                  <Package className="w-3 h-3 text-blue-600" />
                                  {issuedCount} item{issuedCount > 1 ? "s" : ""}
                                </span>
                                <span className="text-[10px] text-[#71717A] block mt-0.5 font-mono">
                                  Cost: {formatCurrency(job.materialsCostTotal)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#A1A1AA] italic">None issued</span>
                            )}
                          </td>

                          {/* Expenses */}
                          <td className="py-2.5 px-3">
                            {job.expensesTotal > 0 ? (
                              <span className="font-mono text-amber-800 font-semibold">
                                {formatCurrency(job.expensesTotal)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#A1A1AA]">—</span>
                            )}
                          </td>

                          {/* Net Billed */}
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-mono font-bold text-[#18181B] block">
                              {formatCurrency(job.netBilled)}
                            </span>
                            {job.discountAmount > 0 && (
                              <span className="text-[10px] text-amber-700 font-mono block">
                                -{formatCurrency(job.discountAmount)} disc
                              </span>
                            )}
                          </td>

                          {/* Cash Collected */}
                          <td className="py-2.5 px-3 text-right">
                            {job.hisaab ? (
                              <div>
                                <span className="font-mono font-bold text-emerald-700 block">
                                  {formatCurrency(job.hisaab.amountCollected)}
                                </span>
                                {job.hisaab.balanceDue > 0 && (
                                  <span className="text-[10px] text-rose-600 font-mono font-semibold block">
                                    Due: {formatCurrency(job.hisaab.balanceDue)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#A1A1AA]">No cash record</span>
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

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr className="bg-[#F8FAFC]">
                            <td colSpan={10} className="p-4 border-t border-b border-[#E2E8F0]">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                {/* 1. Issued Materials Detailed Audit */}
                                <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-2xs">
                                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EDEDED]">
                                    <span className="font-bold text-[#18181B] flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-blue-600" />
                                      Issued Materials & Parts ({job.issuedMaterials?.length || 0})
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-blue-700">
                                      Total: {formatCurrency(job.materialsCostTotal)}
                                    </span>
                                  </div>
                                  {job.issuedMaterials?.length > 0 ? (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                      {job.issuedMaterials.map((mat: any) => (
                                        <div
                                          key={mat.id}
                                          className="p-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] flex items-center justify-between text-[11px]"
                                        >
                                          <div>
                                            <span className="font-semibold text-[#18181B] block">
                                              {mat.item}
                                            </span>
                                            <span className="text-[10px] text-[#71717A]">
                                              Req: {mat.qtyRequested} {mat.unit} • Issued: {mat.qtyIssued} • Ret: {mat.qtyReturned}
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <span
                                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm block mb-0.5 ${
                                                mat.status === "issued"
                                                  ? "bg-emerald-100 text-emerald-800"
                                                  : "bg-amber-100 text-amber-800"
                                              }`}
                                            >
                                              {mat.status}
                                            </span>
                                            <span className="font-mono text-[10px] text-[#52525B]">
                                              Net: {mat.netConsumed} {mat.unit}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-[#71717A] italic py-2">
                                      No warehouse materials were requisitioned or issued for this job.
                                    </p>
                                  )}
                                </div>

                                {/* 2. Service Items (Scope) */}
                                <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-2xs">
                                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EDEDED]">
                                    <span className="font-bold text-[#18181B] flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                      Service Scope & BOQ Items ({job.items?.length || 0})
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-emerald-700">
                                      Gross: {formatCurrency(job.grossSubtotal)}
                                    </span>
                                  </div>
                                  {job.items?.length > 0 ? (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                      {job.items.map((it: any) => (
                                        <div
                                          key={it.id}
                                          className="p-1.5 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] flex items-center justify-between text-[11px]"
                                        >
                                          <div>
                                            <span className="font-semibold text-[#18181B] block">
                                              {it.description}
                                            </span>
                                            <span className="text-[10px] text-[#71717A]">
                                              Qty: {it.quantityActual ?? it.quantityPlanned} @ {formatCurrency(it.unitRate)}
                                            </span>
                                          </div>
                                          <span className="font-mono font-bold text-[#18181B]">
                                            {formatCurrency(it.total)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-[#71717A] italic py-2">
                                      No explicit line items recorded.
                                    </p>
                                  )}
                                </div>

                                {/* 3. Expenses, Hisaab & Financial Recap */}
                                <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-2xs space-y-3">
                                  {/* Field Expenses */}
                                  <div>
                                    <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">
                                      Technician Expenses & Claims
                                    </span>
                                    {job.expenses?.length > 0 ? (
                                      <div className="space-y-1 text-[11px]">
                                        {job.expenses.map((exp: any) => (
                                          <div
                                            key={exp.id}
                                            className="flex items-center justify-between p-1 bg-amber-50/50 rounded-sm border border-amber-100"
                                          >
                                            <span className="text-[#18181B]">{exp.note}</span>
                                            <span className="font-mono font-bold text-amber-900">
                                              {formatCurrency(exp.amount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-[#A1A1AA] italic">No field expenses claimed</span>
                                    )}
                                  </div>

                                  {/* Financial Margins */}
                                  <div className="pt-2 border-t border-[#EDEDED] text-[11px] space-y-1">
                                    <div className="flex justify-between text-[#71717A]">
                                      <span>Net Billed Revenue:</span>
                                      <span className="font-mono text-[#18181B] font-semibold">{formatCurrency(job.netBilled)}</span>
                                    </div>
                                    <div className="flex justify-between text-[#71717A]">
                                      <span>Direct Costs (Parts + Exp):</span>
                                      <span className="font-mono text-rose-600 font-semibold">
                                        -{formatCurrency(job.materialsCostTotal + job.expensesTotal)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between font-bold text-[#18181B] pt-1 border-t border-[#EDEDED]">
                                      <span>Gross Profit Margin:</span>
                                      <span className="font-mono text-emerald-700">
                                        {formatCurrency(job.estimatedProfitMargin)}
                                      </span>
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

        {/* Tab 2: Materials & Parts Issued (Stock Consumption) */}
        {activeReportTab === "materials" && (
          <div className="overflow-x-auto">
            <div className="p-3 bg-blue-50/70 border-b border-blue-200 text-xs text-blue-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  <strong>Warehouse Material Consumption Audit:</strong> Exact inventory and parts issued from stores for jobs within <strong>{reportData?.meta?.dateRangeLabel || period}</strong>.
                </span>
              </div>
              <span className="font-mono font-bold text-blue-900">
                Total Material Cost: {formatCurrency(summary.totalMaterialCost)}
              </span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0D7A5F] mb-2" />
                Aggregating material movements...
              </div>
            ) : !reportData?.materialsBreakdown || reportData.materialsBreakdown.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <Package className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-[#18181B]">No materials were issued in this time duration</p>
                <p className="text-[11px] mt-1">Try selecting a broader date range or custom period.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] text-[#52525B] font-semibold border-b border-[#EDEDED]">
                    <th className="py-2.5 px-3">Item Name / Product</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-right">Total Requested</th>
                    <th className="py-2.5 px-3 text-right">Total Issued</th>
                    <th className="py-2.5 px-3 text-right">Total Returned</th>
                    <th className="py-2.5 px-3 text-right font-bold text-[#18181B]">Net Consumed</th>
                    <th className="py-2.5 px-3 text-right">Est. Inventory Cost</th>
                    <th className="py-2.5 px-3">Which Jobs Took This Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {reportData.materialsBreakdown.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#F9FAFB] transition">
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#18181B] block">{item.itemName}</span>
                        <span className="text-[10px] text-[#71717A] uppercase font-mono">
                          Unit: {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                        {item.sku || "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#52525B]">
                        {item.totalRequested} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-blue-700">
                        {item.totalIssued} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-700">
                        {item.totalReturned > 0 ? `-${item.totalReturned} ${item.unit}` : "0"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 bg-emerald-50/50">
                        {item.netConsumed} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(item.estimatedCost)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {item.jobsList?.map((j: any, jIdx: number) => (
                            <Link
                              key={jIdx}
                              href={`/jobs/${j.jobId}`}
                              className="inline-flex items-center gap-1 text-[10px] bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#D4D4D8] px-2 py-0.5 rounded-md transition text-[#18181B]"
                            >
                              <span className="font-bold text-[#0D7A5F]">{j.jobNumber}</span>
                              <span>({j.netConsumed} {item.unit} by {j.techName})</span>
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Technician Daily Roster & Productivity */}
        {activeReportTab === "technicians" && (
          <div className="overflow-x-auto">
            <div className="p-3 bg-emerald-50/70 border-b border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Field Technician Productivity & Financial Recon:</strong> Performance tracking per technician during <strong>{reportData?.meta?.dateRangeLabel || period}</strong>. Click any row to inspect complete timestamp trail & job history.
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded-md self-start sm:self-auto">
                Click technician to open full Dossier & Lifecycle Timestamps
              </span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0D7A5F] mb-2" />
                Aggregating technician metrics...
              </div>
            ) : !reportData?.technicianBreakdown || reportData.technicianBreakdown.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <User className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-[#18181B]">No technician activity logged in this period</p>
                <p className="text-[11px] mt-1">Assign jobs to technicians or widen your date filter.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] text-[#52525B] font-semibold border-b border-[#EDEDED]">
                    <th className="py-2.5 px-3">Technician Name</th>
                    <th className="py-2.5 px-3 text-center">Assigned</th>
                    <th className="py-2.5 px-3 text-center">Done</th>
                    <th className="py-2.5 px-3 text-center">In Progress</th>
                    <th className="py-2.5 px-3 text-center">Pending Left</th>
                    <th className="py-2.5 px-3 text-right">Revenue Earned</th>
                    <th className="py-2.5 px-3 text-right">Expenses Incurred</th>
                    <th className="py-2.5 px-3 text-right">Expenses Paid</th>
                    <th className="py-2.5 px-3 text-right">Cash Handed Over</th>
                    <th className="py-2.5 px-3 text-center">Avg Duration</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {reportData.technicianBreakdown.map((tech: TechnicianReportItem) => {
                    const techCompRate =
                      tech.totalAssigned > 0
                        ? Math.round((tech.doneCount / tech.totalAssigned) * 100)
                        : 0;

                    return (
                      <tr
                        key={tech.technicianId}
                        onClick={() => setSelectedTechnician(tech)}
                        className="hover:bg-[#F9FAFB] cursor-pointer transition"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {tech.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-[#18181B] block hover:text-[#0D7A5F]">
                                {tech.name}
                              </span>
                              <span className="text-[10px] text-[#71717A] font-mono">
                                {tech.phone || "Field Tech"} • {techCompRate}% completed
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-sm text-[#18181B]">
                          {tech.totalAssigned}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {tech.doneCount}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {tech.inProgressCount}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {tech.leftCount}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#18181B]">
                          {formatCurrency(tech.totalRevenueEarned)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-900 font-semibold">
                          {formatCurrency(tech.totalExpensesClaimed)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className="text-emerald-700 font-bold block">
                            {formatCurrency(tech.totalExpensesPaid)}
                          </span>
                          {tech.totalExpensesPending > 0 && (
                            <span className="text-[10px] text-amber-700 block">
                              Pending: {formatCurrency(tech.totalExpensesPending)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(tech.totalCashCollected)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs text-[#52525B]">
                          {tech.formattedAverageDuration}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTechnician(tech);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D7A5F] hover:underline bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 cursor-pointer"
                          >
                            Inspect Dossier & Timestamps ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
