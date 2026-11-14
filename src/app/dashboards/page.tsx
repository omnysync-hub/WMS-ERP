"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import ProgressRing from "@/components/ui/ProgressRing";
import MiniBarChart from "@/components/ui/MiniBarChart";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  TrendingUp,
  Briefcase,
  Users,
  CreditCard,
  Package,
  Headphones,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Building,
  Calendar,
  Layers,
  ChevronRight,
  UserCheck,
  Receipt,
  Sparkles,
  MapPin,
  RefreshCw,
  Percent,
  Wrench,
  Bike,
  Snowflake,
  Search,
  Filter,
  Check,
  X,
  Activity,
  Gauge,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";

type TabKey =
  | "overview"
  | "workshops"
  | "technicians"
  | "finance"
  | "inventory"
  | "hrm"
  | "feedback"
  | "projects";

function DashboardsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeRole } = useRole();
  const isAdmin = activeRole === "admin";
  const tabParam = searchParams.get("tab") as TabKey | null;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [timeRange, setTimeRange] = useState("this_month");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Workshop Sub-Tab & Filters
  const [workshopTypeFilter, setWorkshopTypeFilter] = useState<"all" | "bike" | "hvac">("all");
  const [workshopStatusFilter, setWorkshopStatusFilter] = useState<string>("ALL");
  const [workshopSearchQuery, setWorkshopSearchQuery] = useState<string>("");
  const [workshopSubView, setWorkshopSubView] = useState<"jobs" | "tools" | "scrap">("jobs");
  const [selectedWorkshopJob, setSelectedWorkshopJob] = useState<any | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      if (activeRole === "hr") {
        router.replace("/hrm");
      } else if (activeRole === "storekeeper") {
        router.replace("/inventory");
      } else {
        router.replace("/jobs");
      }
    }
  }, [isAdmin, activeRole, router]);

  useEffect(() => {
    if (
      tabParam &&
      [
        "overview",
        "workshops",
        "technicians",
        "finance",
        "inventory",
        "hrm",
        "feedback",
        "projects",
      ].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabSelect = (tab: TabKey) => {
    setActiveTab(tab);
    router.push(`/dashboards?tab=${tab}`);
  };

  async function loadStats(range: string) {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboards/stats?range=${range}`);
      if (!res.ok) {
        if (res.status === 403) {
          router.replace(activeRole === "hr" ? "/hrm" : activeRole === "storekeeper" ? "/inventory" : "/jobs");
          return;
        }
        throw new Error(`Failed to load stats: ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed loading dashboard metrics", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadStats(timeRange);
    }
  }, [timeRange, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 mt-16 animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-white">
            Dashboards Hub Access Restricted
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            The Dashboards Command Center is restricted strictly to Administrative personnel. Non-admin roles do not have permission to view executive analytics.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() =>
              router.push(
                activeRole === "hr"
                  ? "/hrm"
                  : activeRole === "storekeeper"
                  ? "/inventory"
                  : "/jobs"
              )
            }
            className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            {activeRole === "hr"
              ? "Return to HRM & Workforce"
              : activeRole === "storekeeper"
              ? "Return to Warehouse & Stock"
              : "Return to Work Orders"}
          </button>
        </div>
      </div>
    );
  }

  const overview = stats?.overview || {};
  const workshops = stats?.workshops || {};
  const technicians = stats?.technicians || {};
  const finance = stats?.finance || {};
  const inventory = stats?.inventory || {};
  const hrm = stats?.hrm || {};
  const feedback = stats?.feedback || {};
  const projects = stats?.projects || {};

  const tabs: { id: TabKey; label: string; icon: any; count?: number | string; badgeColor?: string }[] = [
    { id: "overview", label: "Executive Overview", icon: TrendingUp },
    { id: "workshops", label: "Workshop Ops & Activity", icon: Wrench, count: `${workshops.active || 0} active` },
    { id: "technicians", label: "Technicians & Ops", icon: Users, count: technicians.total || 0 },
    { id: "finance", label: "Finance & Accounts", icon: CreditCard, count: formatCurrency(finance.totalInvoiced || 0) },
    { id: "inventory", label: "Purchasing & Stock", icon: Package, count: `${inventory.lowStockCount || 0} alerts` },
    { id: "hrm", label: "HRM & Workforce", icon: UserCheck, count: `${hrm.presentToday || 0}/${hrm.totalStaff || 0}` },
    { id: "feedback", label: "Customer Care", icon: Headphones, count: `${feedback.csatScore || 4.8}★` },
    { id: "projects", label: "Commercial BOQ", icon: FolderKanban, count: `${projects.activeProjects || 0} active` },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in">
      {/* Executive Command Header */}
      <PageHeader
        breadcrumbs={[{ label: "Analytics & Dashboards" }]}
        title="Operations & Financial Command Center"
        subtitle="Holistic performance metrics across field operations, GAAP accounting, warehouse stock, and workforce."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live ERP Synchronization
          </span>
        }
        primaryAction={{
          label: "Live Dispatch Map",
          href: "/dispatch",
        }}
      />

      {/* Top Filter Controls: Domain Switcher & Time Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#EDEDED] shadow-2xs">
        {/* Domain Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabSelect(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shadow-2xs ${
                  isActive
                    ? "bg-[#0D7A5F] text-white shadow-xs"
                    : "bg-[#F9FAFB] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-[#EDEDED]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-200" : "text-zinc-500"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? "bg-white/20 text-white" : "bg-zinc-200/80 text-zinc-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time-Range Select Filter */}
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-[#F4F4F5] hover:bg-white text-zinc-900 font-bold p-2 rounded-xl border border-[#EDEDED] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="today">Today</option>
            <option value="this_week">Past 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">Year to Date (2026)</option>
            <option value="all">All-Time History</option>
          </select>
          <button
            type="button"
            onClick={() => loadStats(timeRange)}
            className="p-2 rounded-xl border border-[#EDEDED] hover:bg-[#F4F4F5] text-zinc-600 transition"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0D7A5F]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE BUSINESS OVERVIEW                                         */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Executive KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Net Revenue */}
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>Net Billed Revenue</span>
                {typeof overview.revenueMomPct === "number" ? (
                  <span
                    className={`${overview.revenueMomPct >= 0 ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"} px-2 py-0.5 rounded-full text-[10px] font-bold`}
                  >
                    {overview.revenueMomPct >= 0 ? "+" : ""}
                    {overview.revenueMomPct}% MoM
                  </span>
                ) : (
                  <span className="text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full text-[10px] font-bold">— MoM</span>
                )}
              </div>
              <p className="text-2xl font-black font-mono text-[#0D7A5F]">
                {formatCurrency(overview.totalRevenue || 0)}
              </p>
              <p className="text-[11px] text-zinc-500">
                Gross Margin: <strong className="text-zinc-800">{overview.grossMarginPct || 0}%</strong> ({formatCurrency(overview.grossProfit || 0)})
              </p>
            </div>

            {/* Total Work Orders */}
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>Total Work Orders</span>
                <span className="text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {overview.completionRate || 0}% Completion
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-zinc-900">
                {overview.totalJobsCount || 0}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
                <span className="text-emerald-700 font-bold">{overview.completedJobs || 0} Finished</span>
                <span>•</span>
                <span className="text-amber-700 font-bold">{overview.inProgressJobs || 0} Active</span>
                <span>•</span>
                <span className="text-rose-700 font-bold">{overview.unassignedJobs || 0} Unassigned</span>
              </div>
            </div>

            {/* Workforce Attendance */}
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>Staff Biometric Check-In</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  Verified Geofence
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-zinc-900">
                {overview.attendancePct || 0}%
              </p>
              <p className="text-[11px] text-zinc-500">
                <strong className="text-zinc-800">{hrm.presentToday || 0}</strong> present of {hrm.totalStaff || 0} active staff today
              </p>
            </div>

            {/* Customer Satisfaction Score */}
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>Customer Satisfaction (CSAT)</span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  Call Center QA
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-black font-mono text-zinc-900">
                  {overview.csatScore || 4.8}
                </p>
                <span className="text-xs text-amber-600 font-bold">/ 5.0 ★</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                {overview.disputedJobs === 0
                  ? "Zero quality disputes registered"
                  : `${overview.disputedJobs} disputed jobs in review queue`}
              </p>
            </div>
          </div>

          {/* Revenue Velocity & Departmental Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 6-Month Revenue & Job Trend */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#EDEDED] shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#EDEDED]">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Revenue & Job Volume Velocity
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Historical progression of monthly billing recognitions and service executions.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#0D7A5F] bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  Trend: Upward (+22%)
                </span>
              </div>

              {/* Visual Bars Chart */}
              <div className="pt-2">
                <div className="grid grid-cols-6 gap-3 items-end h-48 border-b border-zinc-200 pb-2">
                  {(overview.revenueTrend || []).map((bar: any, idx: number) => {
                    const maxVal = Math.max(...(overview.revenueTrend || []).map((b: any) => b.revenue || 1));
                    const heightPct = Math.max(15, Math.round(((bar.revenue || 0) / maxVal) * 100));

                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                        <span className="text-[10px] font-mono font-bold text-zinc-700 opacity-0 group-hover:opacity-100 transition">
                          ${(bar.revenue / 1000).toFixed(1)}k
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[42px] rounded-t-xl transition-all duration-300 group-hover:scale-105 shadow-xs ${
                            idx === (overview.revenueTrend?.length || 1) - 1
                              ? "bg-[#0D7A5F]"
                              : "bg-[#0D7A5F]/40 hover:bg-[#0D7A5F]/70"
                          }`}
                        />
                        <span className="text-xs font-bold text-zinc-600">{bar.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2">
                  <span>Revenue Recognition ($)</span>
                  <span>Calculated via GAAP Posting Engine</span>
                </div>
              </div>
            </div>

            {/* Quick Operational Shortcuts Card */}
            <div className="bg-white rounded-2xl p-6 border border-[#EDEDED] shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-2 border-b border-[#EDEDED]">
                  Direct Operational Actions
                </h3>
                <div className="space-y-2 text-xs">
                  <Link
                    href="/dispatch"
                    className="p-3 bg-[#F9FAFB] hover:bg-emerald-50 rounded-xl border border-[#EDEDED] hover:border-emerald-200 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-[#0D7A5F]" />
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-[#0D7A5F]">GPS Dispatch Map</p>
                        <p className="text-[10px] text-zinc-500">{overview.unassignedJobs || 0} unassigned tickets awaiting dispatch</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#0D7A5F]" />
                  </Link>

                  <Link
                    href="/jobs/new"
                    className="p-3 bg-[#F9FAFB] hover:bg-emerald-50 rounded-xl border border-[#EDEDED] hover:border-emerald-200 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="w-4 h-4 text-[#0D7A5F]" />
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-[#0D7A5F]">New Job Intake</p>
                        <p className="text-[10px] text-zinc-500">Book customer order & assign equipment specs</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#0D7A5F]" />
                  </Link>

                  <Link
                    href="/accounts"
                    className="p-3 bg-[#F9FAFB] hover:bg-emerald-50 rounded-xl border border-[#EDEDED] hover:border-emerald-200 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-[#0D7A5F]" />
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-[#0D7A5F]">Accounts & Receivables</p>
                        <p className="text-[10px] text-zinc-500">{formatCurrency(finance.totalUnpaid || 0)} pending invoice collections</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#0D7A5F]" />
                  </Link>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2 mt-2">
                <Sparkles className="w-4 h-4 text-[#0D7A5F] shrink-0" />
                <span>All company modules synchronized in real-time across Web, Dispatch, and Mobile.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: WORKSHOP OPERATIONS & LIVE ACTIVITY (BIKES & HVAC APPS)               */}
      {/* ========================================================================= */}
      {activeTab === "workshops" && (
        <div className="space-y-6">
          {/* Top KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-[#EDEDED] shadow-2xs space-y-1">
              <span className="text-xs text-zinc-500 font-semibold block">Total Workshop Jobs</span>
              <p className="text-2xl font-black font-mono text-zinc-900">{workshops.total || 0}</p>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                <span className="text-amber-700 font-bold">Bike: {workshops.bikeJobsCount || 0}</span>
                <span>•</span>
                <span className="text-blue-700 font-bold">HVAC: {workshops.hvacJobsCount || 0}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EDEDED] shadow-2xs space-y-1">
              <span className="text-xs text-zinc-500 font-semibold block">Active in Shop Bays</span>
              <p className="text-2xl font-black font-mono text-cyan-700">{workshops.active || 0}</p>
              <span className="text-[10px] text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full font-bold inline-block">
                In-Progress Operations
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EDEDED] shadow-2xs space-y-1">
              <span className="text-xs text-zinc-500 font-semibold block">Manager Approval Gate</span>
              <p className={`text-2xl font-black font-mono ${(workshops.pendingApproval || 0) > 0 ? "text-amber-600" : "text-zinc-900"}`}>
                {workshops.pendingApproval || 0}
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block ${(workshops.pendingApproval || 0) > 0 ? "bg-amber-100 text-amber-800 animate-pulse" : "bg-zinc-100 text-zinc-600"}`}>
                {(workshops.pendingApproval || 0) > 0 ? "Pending SOP Step 4" : "Queue Cleared"}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EDEDED] shadow-2xs space-y-1">
              <span className="text-xs text-zinc-500 font-semibold block">Store Parts Consumed</span>
              <p className="text-2xl font-black font-mono text-[#0D7A5F]">{formatCurrency(workshops.totalMaterialCost || 0)}</p>
              <span className="text-[10px] text-zinc-500 block">Warehouse Stock Movements</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EDEDED] shadow-2xs space-y-1">
              <span className="text-xs text-zinc-500 font-semibold block">Tools in Field Custody</span>
              <p className="text-2xl font-black font-mono text-indigo-700">
                {workshops.toolsIssued || 0} <span className="text-xs text-zinc-400 font-normal">/ {workshops.toolsTotal || 0}</span>
              </p>
              <span className="text-[10px] text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full font-bold inline-block">
                Vacuum / Gauges / Torches
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#EDEDED] shadow-2xs space-y-1">
              <span className="text-xs text-zinc-500 font-semibold block">Scrap Sales & Recovery</span>
              <p className="text-2xl font-black font-mono text-emerald-700">{formatCurrency(workshops.scrapSalesRevenue || 0)}</p>
              <span className="text-[10px] text-zinc-500 block">{workshops.scrapItemsCount || 0} Scrap Items Tracked</span>
            </div>
          </div>

          {/* Sub-View Navigation Bar */}
          <div className="bg-white p-3 rounded-2xl border border-[#EDEDED] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWorkshopSubView("jobs")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  workshopSubView === "jobs"
                    ? "bg-[#0D7A5F] text-white shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Job Cards & SOP Pipeline</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/15 font-black">
                  {(workshops.jobsList || []).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWorkshopSubView("tools")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  workshopSubView === "tools"
                    ? "bg-[#0D7A5F] text-white shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Tool-Crib Register</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/15 font-black">
                  {workshops.toolsTotal || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setWorkshopSubView("scrap")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  workshopSubView === "scrap"
                    ? "bg-[#0D7A5F] text-white shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Scrap & Salvage Register</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/15 font-black">
                  {workshops.scrapItemsCount || 0}
                </span>
              </button>
            </div>

            {workshopSubView === "jobs" && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Workshop Type Filter */}
                <div className="inline-flex rounded-xl bg-zinc-100 p-1 border border-zinc-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setWorkshopTypeFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      workshopTypeFilter === "all" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    All Shops
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkshopTypeFilter("bike")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                      workshopTypeFilter === "bike" ? "bg-amber-500 text-white shadow-2xs" : "text-zinc-600 hover:text-amber-800"
                    }`}
                  >
                    <Bike className="w-3 h-3" />
                    <span>Bikes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkshopTypeFilter("hvac")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                      workshopTypeFilter === "hvac" ? "bg-blue-600 text-white shadow-2xs" : "text-zinc-600 hover:text-blue-800"
                    }`}
                  >
                    <Snowflake className="w-3 h-3" />
                    <span>HVAC</span>
                  </button>
                </div>

                {/* Status Dropdown */}
                <select
                  value={workshopStatusFilter}
                  onChange={(e) => setWorkshopStatusFilter(e.target.value)}
                  className="bg-zinc-100 hover:bg-zinc-200/70 text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
                >
                  <option value="ALL">All SOP Stages</option>
                  <option value="Open">Step 1: Open / Intake</option>
                  <option value="Assigned">Step 2: Tech Assigned</option>
                  <option value="Under Inspection">Step 3: Under Inspection</option>
                  <option value="Pending Approval">Step 4: Pending Approval</option>
                  <option value="Approved">Step 5: Approved</option>
                  <option value="In Progress">Step 7: In Progress</option>
                  <option value="Completed">Step 9: Completed</option>
                  <option value="Closed">Step 10: Closed & Delivered</option>
                </select>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Job #, Reg #, Tech..."
                    value={workshopSearchQuery}
                    onChange={(e) => setWorkshopSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-zinc-100 text-xs font-medium rounded-xl border border-zinc-200 w-44 sm:w-56 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUB-VIEW 1: JOB CARDS & 10-STEP SOP PIPELINE */}
          {workshopSubView === "jobs" && (
            <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#EDEDED] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Workshop Job Cards Stream ({
                      (workshops.jobsList || []).filter((j: any) => {
                        if (workshopTypeFilter !== "all" && j.workshopType !== workshopTypeFilter) return false;
                        if (workshopStatusFilter !== "ALL" && j.status !== workshopStatusFilter) return false;
                        if (workshopSearchQuery.trim()) {
                          const q = workshopSearchQuery.toLowerCase();
                          return (
                            j.jobNumber?.toLowerCase().includes(q) ||
                            j.bikeRegNo?.toLowerCase().includes(q) ||
                            j.bikeMakeModel?.toLowerCase().includes(q) ||
                            j.brandModel?.toLowerCase().includes(q) ||
                            j.serialNumber?.toLowerCase().includes(q) ||
                            j.unitType?.toLowerCase().includes(q) ||
                            j.customerName?.toLowerCase().includes(q) ||
                            j.assignedStaffName?.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      }).length
                    } matching)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Live operational feed from Dedicated Native Mobile Apps (`workman-bikes-mobile` & `workman-hvac-mobile`).
                  </p>
                </div>
              </div>

              {((workshops.jobsList || []).filter((j: any) => {
                if (workshopTypeFilter !== "all" && j.workshopType !== workshopTypeFilter) return false;
                if (workshopStatusFilter !== "ALL" && j.status !== workshopStatusFilter) return false;
                if (workshopSearchQuery.trim()) {
                  const q = workshopSearchQuery.toLowerCase();
                  return (
                    j.jobNumber?.toLowerCase().includes(q) ||
                    j.bikeRegNo?.toLowerCase().includes(q) ||
                    j.bikeMakeModel?.toLowerCase().includes(q) ||
                    j.brandModel?.toLowerCase().includes(q) ||
                    j.serialNumber?.toLowerCase().includes(q) ||
                    j.unitType?.toLowerCase().includes(q) ||
                    j.customerName?.toLowerCase().includes(q) ||
                    j.assignedStaffName?.toLowerCase().includes(q)
                  );
                }
                return true;
              })).length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500 space-y-2">
                  <Wrench className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="font-bold text-zinc-700">No Workshop Job Cards found for this filter.</p>
                  <p className="text-[11px]">New job cards created on the Mobile Apps will appear here in real-time.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#EDEDED] text-xs">
                  {(workshops.jobsList || [])
                    .filter((j: any) => {
                      if (workshopTypeFilter !== "all" && j.workshopType !== workshopTypeFilter) return false;
                      if (workshopStatusFilter !== "ALL" && j.status !== workshopStatusFilter) return false;
                      if (workshopSearchQuery.trim()) {
                        const q = workshopSearchQuery.toLowerCase();
                        return (
                          j.jobNumber?.toLowerCase().includes(q) ||
                          j.bikeRegNo?.toLowerCase().includes(q) ||
                          j.bikeMakeModel?.toLowerCase().includes(q) ||
                          j.brandModel?.toLowerCase().includes(q) ||
                          j.serialNumber?.toLowerCase().includes(q) ||
                          j.unitType?.toLowerCase().includes(q) ||
                          j.customerName?.toLowerCase().includes(q) ||
                          j.assignedStaffName?.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((job: any) => {
                      const isBike = job.workshopType === "bike";
                      const isClosed = job.status === "Closed";
                      const isCompleted = job.status === "Completed";
                      const isPendingApproval = job.status === "Pending Approval";

                      return (
                        <div
                          key={job.id}
                          className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F9FAFB] transition"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                isBike
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {isBike ? <Bike className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-zinc-900 text-sm">
                                  #{job.jobNumber}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    isBike
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {isBike ? "Bike Workshop" : "HVAC Bench"}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                    isPendingApproval
                                      ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                                      : isCompleted
                                      ? "bg-purple-50 text-purple-800 border-purple-200"
                                      : isClosed
                                      ? "bg-zinc-800 text-white border-zinc-900"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {job.status}
                                </span>
                              </div>

                              <p className="font-bold text-zinc-800">
                                {isBike
                                  ? `${job.bikeMakeModel || "Motorcycle"} (${job.bikeRegNo || "No Reg"})`
                                  : `${job.unitType || "HVAC Unit"} • ${job.brandModel || "Brand/Model"}`}
                              </p>

                              <p className="text-[11px] text-zinc-500 line-clamp-1">
                                Client: <strong className="text-zinc-700">{job.customerName || "Customer Walk-In"}</strong>
                                {job.customerPhone ? ` • ${job.customerPhone}` : ""}
                                {job.complaint ? ` | Fault: "${job.complaint}"` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-xs">
                            <div>
                              <span className="text-[10px] text-zinc-400 block uppercase">Assigned Staff</span>
                              <span className="font-bold text-zinc-800">
                                {job.assignedStaffName || "Unassigned"}
                              </span>
                              <span className="text-[10px] text-zinc-400 block capitalize">
                                {job.assignedStaffRole || "mechanic"}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-zinc-400 block uppercase">Store Requisitions</span>
                              <span className="font-mono font-bold text-zinc-900">
                                {(job.requisitions || []).length} parts
                              </span>
                              <span className="text-[10px] text-zinc-500 block">
                                {formatCurrency(job.totalMaterialCost || 0)}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-zinc-400 block uppercase">Created At</span>
                              <span className="text-[11px] font-mono text-zinc-600 block">
                                {formatDateTime(job.createdAt)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedWorkshopJob(job)}
                              className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-[#0D7A5F] font-bold text-xs flex items-center gap-1.5 shadow-2xs transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Inspect SOP & Audit Log</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2: SPECIALIZED TOOL CRIB */}
          {workshopSubView === "tools" && (
            <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#EDEDED]">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Specialized Tools & Equipment Custody
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Heavy equipment, recovery units, digital manifolds, torque wrenches, and battery analyzers issued to mechanics.
                </p>
              </div>

              {(workshops.toolsList || []).length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500">
                  No workshop tools registered yet.
                </div>
              ) : (
                <div className="divide-y divide-[#EDEDED] text-xs">
                  {(workshops.toolsList || []).map((tool: any) => {
                    const isIssued = (tool.issues || []).length > 0;
                    return (
                      <div
                        key={tool.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB] transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#0D7A5F]">{tool.toolCode}</span>
                            <span className="font-bold text-zinc-900 text-sm">{tool.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-100 text-zinc-700">
                              {tool.category}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isIssued ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isIssued ? "Checked Out" : "Available in Store"}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500">
                            Workshop: <strong className="capitalize">{tool.workshopType}</strong> | Location: {tool.location || "Store Rack"} | Condition: <strong className="text-zinc-700">{tool.condition}</strong>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-zinc-900 block">
                            Available: {tool.availableQuantity} / {tool.totalQuantity}
                          </span>
                          {isIssued && (
                            <span className="text-[11px] text-amber-700 font-medium block">
                              Checked out to: {tool.issues[0]?.staffName || "Staff"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 3: SCRAP & SALVAGE REGISTER */}
          {workshopSubView === "scrap" && (
            <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#EDEDED]">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Workshop Scrap, Copper & Burnt Compressor Register
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Traceability of all replaced parts from job cards. Reconciles customer retention vs store disposal and cash sales credited to GAAP GL Account 42100.
                </p>
              </div>

              {(workshops.scrapList || []).length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500">
                  No scrap records registered yet.
                </div>
              ) : (
                <div className="divide-y divide-[#EDEDED] text-xs">
                  {(workshops.scrapList || []).map((scrap: any) => (
                    <div
                      key={scrap.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB] transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 text-sm">{scrap.itemDescription}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-zinc-100 text-zinc-700">
                            {scrap.quantity} {scrap.unit}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              scrap.status === "sold"
                                ? "bg-emerald-100 text-emerald-800"
                                : scrap.customerKept
                                ? "bg-zinc-100 text-zinc-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {scrap.customerKept ? "Customer Retained" : scrap.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Job Card: <strong className="font-mono text-zinc-800">#{scrap.jobCard?.jobNumber || "—"}</strong> | Type: <span className="capitalize">{scrap.workshopType}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        {scrap.status === "sold" ? (
                          <>
                            <span className="font-mono font-bold text-emerald-700 block text-sm">
                              +{formatCurrency(scrap.disposalValue || 0)}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 block">
                              GL Journal Posted
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-500 block">
                            {scrap.customerKept ? "Returned to client upon delivery" : "Stored in Scrap Yard"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INSPECTION MODAL: 10-STEP SOP AUDIT LOG & TECHNICAL DETAILS */}
          {selectedWorkshopJob && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-200">
                {/* Modal Header */}
                <div className="p-5 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white z-10">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                        selectedWorkshopJob.workshopType === "bike"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {selectedWorkshopJob.workshopType === "bike" ? <Bike className="w-5 h-5" /> : <Snowflake className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-black text-lg text-zinc-900">
                          #{selectedWorkshopJob.jobNumber}
                        </h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#0D7A5F]/10 text-[#0D7A5F] border border-[#0D7A5F]/20">
                          {selectedWorkshopJob.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Created {formatDateTime(selectedWorkshopJob.createdAt)} by {selectedWorkshopJob.supervisorName || "Workshop Supervisor"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedWorkshopJob(null)}
                    className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6 text-xs">
                  {/* Grid of details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Unit & Customer Info */}
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>Client & Equipment Specs</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-zinc-400 block">Customer</span>
                          <span className="font-bold text-zinc-800">{selectedWorkshopJob.customerName || "Walk-In"}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block">Phone</span>
                          <span className="font-mono text-zinc-800">{selectedWorkshopJob.customerPhone || "—"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-400 block">Service Site / Address</span>
                          <span className="text-zinc-700">{selectedWorkshopJob.customerSite || "Workshop Main Bay"}</span>
                        </div>
                        {selectedWorkshopJob.workshopType === "bike" ? (
                          <>
                            <div>
                              <span className="text-zinc-400 block">Bike Reg No</span>
                              <span className="font-mono font-bold text-amber-800">{selectedWorkshopJob.bikeRegNo || "—"}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block">Current KM</span>
                              <span className="font-mono text-zinc-800">{selectedWorkshopJob.currentKm ? `${selectedWorkshopJob.currentKm} KM` : "—"}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block">Chassis #</span>
                              <span className="font-mono text-zinc-700">{selectedWorkshopJob.chassisNumber || "—"}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block">Engine #</span>
                              <span className="font-mono text-zinc-700">{selectedWorkshopJob.engineNumber || "—"}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-zinc-400 block">Unit Type & Model</span>
                              <span className="font-bold text-blue-900">{selectedWorkshopJob.unitType || "—"} ({selectedWorkshopJob.brandModel || "—"})</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block">Serial Number</span>
                              <span className="font-mono text-zinc-800">{selectedWorkshopJob.serialNumber || "—"}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block">Compressor Spec</span>
                              <span className="font-mono text-zinc-700">{selectedWorkshopJob.compressorSpec || "—"}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 block">Refrigerant Type</span>
                              <span className="font-mono text-zinc-700">{selectedWorkshopJob.refrigerantType || "—"}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Complaint & Staff */}
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>Complaint & Assignment</span>
                      </h4>
                      <div>
                        <span className="text-zinc-400 block text-[11px]">Primary Customer Complaint (SOP Step 1)</span>
                        <p className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-medium mt-1">
                          {selectedWorkshopJob.complaint || "No complaint noted"}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
                        <div>
                          <span className="text-zinc-400 block text-[10px] uppercase">Assigned Technician (Step 2)</span>
                          <span className="font-bold text-zinc-900 text-xs">
                            {selectedWorkshopJob.assignedStaffName || "Unassigned"}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-200 text-zinc-800 capitalize">
                          {selectedWorkshopJob.assignedStaffRole || "mechanic"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis & Manager Approval */}
                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-700" />
                        <span>SOP Step 3: Technical Diagnosis & Step 4: Manager Gate</span>
                      </h4>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${selectedWorkshopJob.managerApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {selectedWorkshopJob.managerApproved ? "Manager Approved" : "Approval Pending / Rejected"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Inspection Findings</span>
                        <p className="text-zinc-800">{selectedWorkshopJob.diagnosisNotes || "Diagnosis not submitted yet."}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Manager Decision & Notes</span>
                        <p className="text-zinc-800">{selectedWorkshopJob.managerNotes || "No manager notes recorded."}</p>
                        {selectedWorkshopJob.managerApprovedBy && (
                          <span className="text-[10px] text-zinc-400 block">By: {selectedWorkshopJob.managerApprovedBy}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Materials Requisitions Table */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>SOP Steps 5 & 6: Warehouse Requisition & Issuance</span>
                      </h4>
                      <span className="font-mono font-bold text-zinc-900">
                        Total Material Cost: {formatCurrency(selectedWorkshopJob.totalMaterialCost || 0)}
                      </span>
                    </div>

                    {(selectedWorkshopJob.requisitions || []).length === 0 ? (
                      <p className="text-zinc-400 text-center py-4">No warehouse material requested for this job.</p>
                    ) : (
                      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px]">
                              <th className="p-2.5">Item Name</th>
                              <th className="p-2.5">Requested</th>
                              <th className="p-2.5">Issued</th>
                              <th className="p-2.5">Returned</th>
                              <th className="p-2.5">Unit Cost</th>
                              <th className="p-2.5">Total Cost</th>
                              <th className="p-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {selectedWorkshopJob.requisitions.map((req: any) => (
                              <tr key={req.id} className="hover:bg-zinc-50/70">
                                <td className="p-2.5 font-bold text-zinc-900">{req.itemName}</td>
                                <td className="p-2.5 font-mono">{req.requestedQty} {req.unit}</td>
                                <td className="p-2.5 font-mono font-bold text-emerald-700">{req.issuedQty} {req.unit}</td>
                                <td className="p-2.5 font-mono text-zinc-500">{req.returnedQty} {req.unit}</td>
                                <td className="p-2.5 font-mono">{formatCurrency(req.unitCost)}</td>
                                <td className="p-2.5 font-mono font-bold text-zinc-900">{formatCurrency(req.totalCost)}</td>
                                <td className="p-2.5">
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-zinc-100 text-zinc-700">
                                    {req.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Testing Station & Work Done */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>SOP Step 8: Testing Station Verification</span>
                      </h4>
                      {selectedWorkshopJob.workshopType === "bike" ? (
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-zinc-200">
                            <span className="text-zinc-500">Engine Tuning Check:</span>
                            <span className="font-bold text-zinc-800">{selectedWorkshopJob.engineTuned ? "Verified" : "Pending"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-zinc-200">
                            <span className="text-zinc-500">Brakes & Transmission:</span>
                            <span className="font-bold text-zinc-800">{selectedWorkshopJob.brakesChecked ? "Verified" : "Pending"}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Road Test Observations:</span>
                            <p className="text-zinc-800 italic mt-0.5">&quot;{selectedWorkshopJob.roadTestRemarks || "No road test recorded"}&quot;</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-zinc-200">
                            <span className="text-zinc-500">Nitrogen Hold Pressure:</span>
                            <span className="font-mono font-bold text-zinc-900">{selectedWorkshopJob.pressurePsi ? `${selectedWorkshopJob.pressurePsi} PSI` : "—"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-zinc-200">
                            <span className="text-zinc-500">Deep Vacuum Level:</span>
                            <span className="font-mono font-bold text-zinc-900">{selectedWorkshopJob.vacuumMicrons ? `${selectedWorkshopJob.vacuumMicrons} Microns` : "—"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-zinc-200">
                            <span className="text-zinc-500">Running Current (220V):</span>
                            <span className="font-mono font-bold text-zinc-900">{selectedWorkshopJob.runningAmps ? `${selectedWorkshopJob.runningAmps} Amps` : "—"}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>SOP Step 9 & 10: Completion & Delivery</span>
                      </h4>
                      <div>
                        <span className="text-zinc-400 block text-[10px] uppercase font-bold">Work Done Summary</span>
                        <p className="text-zinc-800 font-medium mt-0.5">{selectedWorkshopJob.workDoneSummary || "Work not finalized yet."}</p>
                      </div>
                      <div className="pt-2 border-t border-zinc-200 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Closed By:</span>
                          <span className="font-bold text-zinc-800">{selectedWorkshopJob.closedBy || "Open"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Delivery Status:</span>
                          <span className="font-bold capitalize text-zinc-800">{selectedWorkshopJob.deliveryStatus || "In Bay"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit Trail Timeline */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0D7A5F]" />
                      <span>SOP Audit Trail & Chronological History</span>
                    </h4>

                    {(selectedWorkshopJob.statusLogs || []).length === 0 ? (
                      <p className="text-zinc-400">No status transitions recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedWorkshopJob.statusLogs.map((log: any, idx: number) => (
                          <div key={log.id || idx} className="p-2.5 bg-white rounded-xl border border-zinc-200 flex items-start justify-between gap-3 text-[11px]">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-900">{log.fromStatus} → {log.toStatus}</span>
                                <span className="text-[10px] text-zinc-400">• By {log.changedBy}</span>
                              </div>
                              {log.notes && <p className="text-zinc-600 mt-0.5">{log.notes}</p>}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0">{formatDateTime(log.changedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-zinc-200 bg-zinc-50 rounded-b-3xl flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkshopJob(null)}
                    className="px-5 py-2 bg-zinc-800 hover:bg-zinc-900 text-white font-bold rounded-xl text-xs transition"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TECHNICIANS & FIELD OPS                                             */}
      {/* ========================================================================= */}
      {activeTab === "technicians" && (
        <div className="space-y-6">
          {/* Technicians Top Stats Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Total Field Technicians</span>
              <span className="text-2xl font-black font-mono text-zinc-900">{technicians.total || 0}</span>
              <span className="text-[11px] text-zinc-500 block mt-1">Full-time HVAC specialists</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Available for Dispatch</span>
              <span className="text-2xl font-black font-mono text-emerald-600">{technicians.available || 0}</span>
              <span className="text-[11px] text-emerald-700 block mt-1">Ready for next assignment</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Currently On Job</span>
              <span className="text-2xl font-black font-mono text-amber-600">{technicians.onJob || 0}</span>
              <span className="text-[11px] text-amber-700 block mt-1">Service in execution</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Dispatch Proximity Map</span>
              <Link
                href="/dispatch"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0D7A5F] hover:underline mt-2"
              >
                <span>Open Live Radar View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Technician Leaderboard Table */}
          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#EDEDED] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Technician Performance & Scorecard
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Individual completion counts, customer quality scores, Hisaab balances, and live attendance.
                </p>
              </div>
              <Link
                href="/dispatch"
                className="text-xs font-bold text-[#0D7A5F] hover:underline flex items-center gap-1"
              >
                <span>Dispatch Screen →</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#EDEDED] text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Technician</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Active Jobs</th>
                    <th className="py-3 px-4 text-center">Completed</th>
                    <th className="py-3 px-4 text-center">Customer Rating</th>
                    <th className="py-3 px-4 text-right">Net Hisaab Balance</th>
                    <th className="py-3 px-4 text-right">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {(technicians.leaderboard || []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#F9FAFB] transition">
                      <td className="py-3 px-4 font-bold text-zinc-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 text-[#0D7A5F] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="leading-tight">{t.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono font-normal">{t.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            t.currentStatus === "Available"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {t.currentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-zinc-900">
                        {t.activeJobsCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                        {t.completedJobsCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                          {t.rating} ★
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={t.netHisaabBalance > 0 ? "text-amber-700" : "text-zinc-700"}>
                          {formatCurrency(t.netHisaabBalance)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {t.isPresentToday ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                            ✓ Checked In
                          </span>
                        ) : (
                          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">
                            Pending Scan
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FINANCE & ACCOUNTS                                                  */}
      {/* ========================================================================= */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Total Invoiced (AR)</span>
              <span className="text-2xl font-black font-mono text-zinc-900">{formatCurrency(finance.totalInvoiced || 0)}</span>
              <span className="text-[11px] text-zinc-500 block mt-1">Generated customer invoices</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Collections Received</span>
              <span className="text-2xl font-black font-mono text-emerald-600">{formatCurrency(finance.totalPaid || 0)}</span>
              <span className="text-[11px] text-emerald-700 block mt-1">Directly deposited to bank / cash</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Outstanding Receivables</span>
              <span className="text-2xl font-black font-mono text-amber-600">{formatCurrency(finance.totalUnpaid || 0)}</span>
              <span className="text-[11px] text-amber-700 block mt-1">Unpaid customer balances</span>
            </div>
          </div>

          {/* AR Aging Buckets & Recent Postings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aging Buckets */}
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-2 border-b border-[#EDEDED]">
                Accounts Receivable Aging Analysis
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-emerald-950">Current (&lt; 30 Days)</p>
                    <p className="text-[10px] text-emerald-800">Fresh invoices within normal terms</p>
                  </div>
                  <span className="text-base font-black font-mono text-emerald-700">
                    {formatCurrency(finance.arUnder30 || 0)}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-amber-950">30 – 60 Days Aging</p>
                    <p className="text-[10px] text-amber-800">First follow-up reminder sent</p>
                  </div>
                  <span className="text-base font-black font-mono text-amber-700">
                    {formatCurrency(finance.ar30to60 || 0)}
                  </span>
                </div>

                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-rose-950">60+ Days Overdue</p>
                    <p className="text-[10px] text-rose-800">Escalated to collection team</p>
                  </div>
                  <span className="text-base font-black font-mono text-rose-700">
                    {formatCurrency(finance.ar60Plus || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Double-Entry Journal Entries */}
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EDEDED]">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Recent Double-Entry Journal Postings
                </h3>
                <Link href="/accounts" className="text-xs font-bold text-[#0D7A5F] hover:underline">
                  View Full General Ledger →
                </Link>
              </div>

              <div className="divide-y divide-[#EDEDED] text-xs max-h-72 overflow-y-auto">
                {(finance.recentJournals || []).map((j: any) => (
                  <div key={j.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-900">{j.memo}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {formatDateTime(j.date)} • Ref: {j.refType}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-zinc-900">
                      {formatCurrency(j.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INVENTORY & WAREHOUSE                                              */}
      {/* ========================================================================= */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Total Stock Value</span>
              <span className="text-2xl font-black font-mono text-[#0D7A5F]">
                {formatCurrency(inventory.totalStockValuation || 0)}
              </span>
              <span className="text-[11px] text-zinc-500 block mt-1">Warehouse inventory assets</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Active Catalog SKUs</span>
              <span className="text-2xl font-black font-mono text-zinc-900">{inventory.totalSKUs || 0}</span>
              <span className="text-[11px] text-zinc-500 block mt-1">Parts & materials registered</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Low Stock Alerts</span>
              <span className="text-2xl font-black font-mono text-rose-600">{inventory.lowStockCount || 0}</span>
              <span className="text-[11px] text-rose-700 block mt-1">Below reorder threshold</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Field Material Requests</span>
              <span className="text-2xl font-black font-mono text-amber-600">{inventory.pendingRequests || 0}</span>
              <span className="text-[11px] text-amber-700 block mt-1">Awaiting storekeeper release</span>
            </div>
          </div>

          {/* Top Parts Inventory Table */}
          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#EDEDED] flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Fast-Moving Inventory & Critical Spare Parts
              </h3>
              <Link href="/inventory" className="text-xs font-bold text-[#0D7A5F] hover:underline">
                Open Stock Manager →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#EDEDED] text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Item & SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Available Stock</th>
                    <th className="py-3 px-4 text-right">Unit Rate</th>
                    <th className="py-3 px-4 text-right">Total Asset Value</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {(inventory.topItems || []).map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#F9FAFB] transition">
                      <td className="py-3 px-4 font-bold text-zinc-900">
                        {item.name}
                        <span className="block text-[10px] text-zinc-500 font-mono font-normal">{item.sku}</span>
                      </td>
                      <td className="py-3 px-4 text-zinc-600">{item.category}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{item.currentStock}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{formatCurrency(item.value)}</td>
                      <td className="py-3 px-4 text-right">
                        {item.isLow ? (
                          <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-bold">
                            ⚠️ Low Stock
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                            Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: HRM & WORKFORCE                                                    */}
      {/* ========================================================================= */}
      {activeTab === "hrm" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Company Headcount</span>
              <span className="text-2xl font-black font-mono text-zinc-900">{hrm.totalStaff || 0}</span>
              <span className="text-[11px] text-zinc-500 block mt-1">Across all branches</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Biometric Attendance %</span>
              <span className="text-2xl font-black font-mono text-emerald-600">{hrm.attendancePct || 0}%</span>
              <span className="text-[11px] text-emerald-700 block mt-1">Verified check-in today</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Pending Leave Requests</span>
              <span className="text-2xl font-black font-mono text-amber-600">{hrm.pendingLeaves || 0}</span>
              <span className="text-[11px] text-amber-700 block mt-1">Awaiting HR manager review</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Active Salary Advances</span>
              <span className="text-2xl font-black font-mono text-zinc-900">
                {formatCurrency(hrm.totalAdvancesAmount || 0)}
              </span>
              <span className="text-[11px] text-zinc-500 block mt-1">Disbursed employee loans</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#EDEDED] shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-2 border-b border-[#EDEDED]">
              Departmental Headcount Distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {Object.entries(hrm.deptCounts || {}).map(([dept, count]: any) => (
                <div key={dept} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-1">
                  <span className="text-zinc-500 font-medium block capitalize">{dept}</span>
                  <span className="text-xl font-black font-mono text-zinc-900">{count}</span>
                  <span className="text-[10px] text-zinc-400 block">Employees assigned</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CUSTOMER CARE & QUALITY                                            */}
      {/* ========================================================================= */}
      {activeTab === "feedback" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Customer CSAT Rating</span>
              <span className="text-2xl font-black font-mono text-emerald-600">{feedback.csatScore || 4.8} ★</span>
              <span className="text-[11px] text-emerald-700 block mt-1">Based on outbound audit calls</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Clean Completion Rate</span>
              <span className="text-2xl font-black font-mono text-zinc-900">{feedback.resolutionPct || 98}%</span>
              <span className="text-[11px] text-zinc-500 block mt-1">Delivered without disputes</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Disputed Jobs in Review</span>
              <span className="text-2xl font-black font-mono text-rose-600">{feedback.disputeCount || 0}</span>
              <span className="text-[11px] text-rose-700 block mt-1">Escalated to operations supervisor</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#EDEDED] flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Recent Customer Quality Call Logs
              </h3>
              <Link href="/feedback" className="text-xs font-bold text-[#0D7A5F] hover:underline">
                Call Center Queue →
              </Link>
            </div>
            <div className="divide-y divide-[#EDEDED] text-xs">
              {(feedback.recentCalls || []).map((c: any) => (
                <div key={c.id} className="p-4 flex items-center justify-between hover:bg-[#F9FAFB] transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-zinc-900">{c.customerName}</p>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded">
                        Job: {c.jobNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600">{c.notes || "No call notes logged"}</p>
                    <p className="text-[10px] text-zinc-400">Technician: {c.technicianName}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      c.status === "satisfied"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: COMMERCIAL PROJECTS & BOQ                                          */}
      {/* ========================================================================= */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Total Contract Portfolio</span>
              <span className="text-2xl font-black font-mono text-[#0D7A5F]">
                {formatCurrency(projects.totalContractValue || 0)}
              </span>
              <span className="text-[11px] text-zinc-500 block mt-1">Multi-unit commercial HVAC projects</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Active Projects</span>
              <span className="text-2xl font-black font-mono text-zinc-900">{projects.activeProjects || 0}</span>
              <span className="text-[11px] text-zinc-500 block mt-1">Currently on site</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-[#EDEDED] shadow-2xs">
              <span className="text-xs text-zinc-500 font-semibold block mb-1">Completed Deliveries</span>
              <span className="text-2xl font-black font-mono text-emerald-600">{projects.completedProjects || 0}</span>
              <span className="text-[11px] text-emerald-700 block mt-1">Finalized & billed</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#EDEDED] flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Commercial Contract Tracking & Progress
              </h3>
              <Link href="/projects" className="text-xs font-bold text-[#0D7A5F] hover:underline">
                View All BOQ Contracts →
              </Link>
            </div>
            <div className="divide-y divide-[#EDEDED] text-xs">
              {(projects.list || []).map((p: any) => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB] transition">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 text-sm">{p.name}</p>
                    <p className="text-[11px] text-zinc-500">Client: {p.customerName}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase">Contract</span>
                      <span className="font-mono font-bold text-zinc-900">{formatCurrency(p.contractValue)}</span>
                    </div>

                    <div className="w-28 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600">
                        <span>Progress</span>
                        <span>{p.completionPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${p.completionPct}%` }}
                          className="h-full bg-[#0D7A5F] rounded-full"
                        />
                      </div>
                    </div>

                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2">
          <div className="w-6 h-6 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
          <span>Loading Dashboards Command Center...</span>
        </div>
      }
    >
      <DashboardsContent />
    </Suspense>
  );
}
