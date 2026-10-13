"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useRole } from "@/contexts/RoleContext";
import { realtimeSync } from "@/lib/realtimeSync";
import { formatCurrency, formatDateTime, formatJobType, cn } from "@/lib/utils";
import {
  Receipt,
  User,
  Phone,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Check,
  X,
  CreditCard,
  Banknote,
  Building,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Lock,
} from "lucide-react";
import ImageLightboxModal from "@/components/modals/ImageLightboxModal";

interface ClaimItem {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  amount: number;
  note: string;
  category: string;
  receiptUrl: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
  isPartial: boolean;
}

interface HandledJob {
  id: string;
  jobNumber: string;
  jobType: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    addressText: string;
  };
  claims: ClaimItem[];
}

interface TechnicianSummary {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  totalClaimed: number;
  totalPending: number;
  totalPaid: number;
  hasPending: boolean;
  hasPartial: boolean;
  isAllCleared: boolean;
  claimsCount: number;
  claims: ClaimItem[];
  jobs: HandledJob[];
}

export default function TechnicianExpensesPage() {
  const router = useRouter();
  const { activeRole, currentPersona, hasPermission } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
  const canViewFinancials = hasPermission("jobs.view_financials");

  const [dateParam, setDateParam] = useState<string>(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  });

  const [isAllDates, setIsAllDates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "cleared">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    date: string;
    summary: {
      totalClaimed: number;
      totalPending: number;
      totalPaid: number;
      activeTechniciansCount: number;
      pendingTechniciansCount: number;
      totalClaimsCount: number;
    };
    technicians: TechnicianSummary[];
  } | null>(null);

  // Expanded technician accordion state
  const [expandedTechIds, setExpandedTechIds] = useState<Record<string, boolean>>({});

  // Clearance Modal State
  const [clearanceModalOpen, setClearanceModalOpen] = useState(false);
  const [clearanceTarget, setClearanceTarget] = useState<{
    type: "technician" | "job" | "claim";
    technicianId?: string;
    technicianName?: string;
    jobId?: string;
    jobNumber?: string;
    claimId?: string;
    maxAmount: number;
    noteLabel?: string;
  } | null>(null);

  const [clearanceMode, setClearanceMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [disbursingAccountCode, setDisbursingAccountCode] = useState<string>("1000");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Lightbox Modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const url = `/api/jobs/expenses?date=${isAllDates ? "all" : dateParam}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load expenses");
      }
      const json = await res.json();
      setData(json);

      // Auto-expand technicians that have pending claims
      const initialExpanded: Record<string, boolean> = {};
      (json.technicians || []).forEach((t: TechnicianSummary) => {
        if (t.hasPending) initialExpanded[t.id] = true;
      });
      setExpandedTechIds((prev) => ({ ...initialExpanded, ...prev }));
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchExpenses();
  }, [dateParam, isAllDates]);

  // Real-time synchronization subscription
  useEffect(() => {
    const unsub = realtimeSync.subscribe((evt) => {
      if (
        evt.type === "EXPENSE_CLEARED" ||
        evt.type === "JOB_UPDATED" ||
        evt.message?.toLowerCase().includes("expense")
      ) {
        fetchExpenses();
      }
    });
    return () => unsub();
  }, [dateParam, isAllDates]);

  const toggleExpand = (techId: string) => {
    setExpandedTechIds((prev) => ({ ...prev, [techId]: !prev[techId] }));
  };

  const openClearTechnician = (tech: TechnicianSummary) => {
    setClearanceTarget({
      type: "technician",
      technicianId: tech.id,
      technicianName: tech.name,
      maxAmount: tech.totalPending,
      noteLabel: `All pending claims for ${tech.name} on ${isAllDates ? "all dates" : dateParam}`,
    });
    setClearanceMode("full");
    setPartialAmount(String(tech.totalPending));
    setPaymentNotes("");
    setClearanceModalOpen(true);
  };

  const openClearClaim = (claim: ClaimItem, techName: string) => {
    setClearanceTarget({
      type: "claim",
      claimId: claim.id,
      jobId: claim.jobId,
      jobNumber: claim.jobNumber,
      technicianName: techName,
      maxAmount: claim.amount,
      noteLabel: `${claim.category} (${claim.note}) on Job #${claim.jobNumber}`,
    });
    setClearanceMode("full");
    setPartialAmount(String(claim.amount));
    setPaymentNotes("");
    setClearanceModalOpen(true);
  };

  const handleExecuteClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearanceTarget) return;

    try {
      setIsProcessing(true);
      setErrorMsg("");

      const amountToPay =
        clearanceMode === "partial" ? Number(partialAmount) : clearanceTarget.maxAmount;

      if (!amountToPay || amountToPay <= 0 || amountToPay > clearanceTarget.maxAmount) {
        alert("Please enter a valid disbursement amount.");
        return;
      }

      let payload: any = {
        disbursingAccountCode,
        paymentNotes: paymentNotes.trim(),
        amountToPay,
      };

      if (clearanceTarget.type === "technician") {
        payload.action = "clear_technician";
        payload.technicianId = clearanceTarget.technicianId;
        payload.date = isAllDates ? "all" : dateParam;
      } else if (clearanceTarget.type === "job") {
        payload.action = "clear_job";
        payload.jobId = clearanceTarget.jobId;
      } else if (clearanceTarget.type === "claim") {
        payload.action = "clear_claim";
        payload.claimId = clearanceTarget.claimId;
        payload.jobId = clearanceTarget.jobId;
      }

      const res = await fetch("/api/jobs/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Clearance failed");
      }

      setClearanceModalOpen(false);
      setSuccessMsg(
        `Successfully disbursed ${formatCurrency(amountToPay)} to ${
          clearanceTarget.technicianName || "technician"
        } with balanced General Ledger posting.`
      );
      setTimeout(() => setSuccessMsg(""), 6000);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openLightbox = (url: string) => {
    setLightboxImages([url]);
    setLightboxIndex(0);
    setLightboxOpen(true);
  };

  if (isStorekeeper || !canViewFinancials) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#18181B]">
          Technician Field Expenses Clearance Restricted
        </h3>
        <p className="text-xs text-[#71717A]">
          This section requires accountant or financial clearance privileges. Storekeeper accounts are restricted to material fulfillment queues.
        </p>
        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="px-4 py-2 bg-[#0D7A5F] text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
        >
          Return to Work Orders
        </button>
      </div>
    );
  }

  // Filter technicians based on search and status
  const filteredTechnicians = (data?.technicians || []).filter((tech) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = tech.name.toLowerCase().includes(q);
      const matchPhone = tech.phone.includes(q);
      const matchJob = tech.jobs.some(
        (j) =>
          j.jobNumber.toLowerCase().includes(q) ||
          j.customer.name.toLowerCase().includes(q)
      );
      const matchClaim = tech.claims.some(
        (c) =>
          c.note.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
      if (!matchName && !matchPhone && !matchJob && !matchClaim) return false;
    }

    // Status filter
    if (statusFilter === "pending") return tech.hasPending;
    if (statusFilter === "partial") return tech.hasPartial;
    if (statusFilter === "cleared") return tech.isAllCleared;

    return true;
  });

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto p-4 sm:p-6">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: "Technician Field Expenses" },
        ]}
        title="Technician Field Expenses & Clearance"
        subtitle="Daily on-site expense claims logged by technicians across their assigned & in-progress jobs. Reconcile, approve, and clear in full or partial payouts."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/jobs"
              className="h-8 px-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-2xs"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#71717A]" />
              Jobs Directory
            </Link>
            <button
              type="button"
              onClick={fetchExpenses}
              disabled={loading}
              className="h-8 px-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-2xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-[#0D7A5F]", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Disbursal */}
        <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Pending Disbursal
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-950">
            {formatCurrency(data?.summary.totalPending || 0)}
          </div>
          <p className="text-[11px] text-amber-800">
            {data?.summary.pendingTechniciansCount || 0} technicians with pending payouts
          </p>
        </div>

        {/* Card 2: Disbursed / Cleared */}
        <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
              Disbursed / Cleared
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-950">
            {formatCurrency(data?.summary.totalPaid || 0)}
          </div>
          <p className="text-[11px] text-emerald-800">
            Posted directly to General Ledger
          </p>
        </div>

        {/* Card 3: Total Gross Claimed */}
        <div className="p-4 rounded-xl bg-white border border-[#E4E4E7] shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
              Total Field Claims
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-50 text-[#71717A] flex items-center justify-center border border-zinc-200">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-[#18181B]">
            {formatCurrency(data?.summary.totalClaimed || 0)}
          </div>
          <p className="text-[11px] text-[#71717A]">
            {data?.summary.totalClaimsCount || 0} items logged from mobile app
          </p>
        </div>

        {/* Card 4: Active Technicians */}
        <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
              Active Field Technicians
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-blue-950">
            {data?.summary.activeTechniciansCount || 0}
          </div>
          <p className="text-[11px] text-blue-800">
            Assigned or logged expenses on {isAllDates ? "all dates" : data?.date || "today"}
          </p>
        </div>
      </div>

      {/* Date & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Date Selector Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[#71717A] font-semibold flex items-center gap-1.5 mr-1">
            <Calendar className="w-4 h-4 text-[#0D7A5F]" />
            Date Scope:
          </span>

          <button
            type="button"
            onClick={() => {
              setIsAllDates(false);
              const today = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Karachi",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date());
              setDateParam(today);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition text-xs",
              !isAllDates &&
                dateParam ===
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Karachi",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date())
                ? "bg-[#0D7A5F] text-white shadow-2xs"
                : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
            )}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAllDates(false);
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yStr = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Karachi",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(yesterday);
              setDateParam(yStr);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition text-xs",
              !isAllDates &&
                dateParam !==
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Karachi",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date())
                ? "bg-[#0D7A5F] text-white shadow-2xs"
                : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
            )}
          >
            Specific Date
          </button>

          {/* Custom Date Input */}
          <input
            type="date"
            value={dateParam}
            onChange={(e) => {
              if (e.target.value) {
                setIsAllDates(false);
                setDateParam(e.target.value);
              }
            }}
            className="px-2.5 py-1 rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] font-mono text-xs focus:bg-white focus:ring-1 focus:ring-[#0D7A5F] focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setIsAllDates(true)}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold transition text-xs",
              isAllDates
                ? "bg-[#0D7A5F] text-white shadow-2xs"
                : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
            )}
          >
            All Dates History
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tech, job, claim..."
              className="pl-9 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] text-xs focus:bg-white focus:ring-1 focus:ring-[#0D7A5F] focus:outline-none w-48 sm:w-60"
            />
          </div>

          <div className="inline-flex rounded-lg bg-[#E4E4E7]/70 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md transition text-[11px]",
                statusFilter === "all"
                  ? "bg-white text-zinc-900 shadow-2xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={cn(
                "px-2.5 py-1 rounded-md transition text-[11px]",
                statusFilter === "pending"
                  ? "bg-white text-amber-900 shadow-2xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              Pending Payout
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("partial")}
              className={cn(
                "px-2.5 py-1 rounded-md transition text-[11px]",
                statusFilter === "partial"
                  ? "bg-white text-blue-900 shadow-2xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              Partial
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("cleared")}
              className={cn(
                "px-2.5 py-1 rounded-md transition text-[11px]",
                statusFilter === "cleared"
                  ? "bg-white text-emerald-900 shadow-2xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              Cleared
            </button>
          </div>
        </div>
      </div>

      {/* Main Technicians & Daily Jobs Breakdown Section */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center text-xs text-[#71717A] bg-white rounded-xl border border-[#E4E4E7] flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
            Loading technician daily expenses & work orders...
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-[#E4E4E7] space-y-2">
            <Receipt className="w-10 h-10 text-[#A1A1AA] mx-auto stroke-1" />
            <h3 className="text-sm font-bold text-[#18181B]">No Field Expenses Found</h3>
            <p className="text-xs text-[#71717A] max-w-md mx-auto">
              No technicians have submitted on-site field expenses matching the selected date scope (
              <strong>{isAllDates ? "All Dates" : dateParam}</strong>) and filter.
            </p>
          </div>
        ) : (
          filteredTechnicians.map((tech) => {
            const isExpanded = Boolean(expandedTechIds[tech.id]);
            const initials = tech.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={tech.id}
                className={cn(
                  "bg-white rounded-xl border transition shadow-xs overflow-hidden",
                  tech.hasPending
                    ? "border-amber-200/90 ring-1 ring-amber-100"
                    : "border-[#E4E4E7]"
                )}
              >
                {/* Technician Master Header Card */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FAFAFA] border-b border-[#E4E4E7]/80">
                  {/* Left: Technician Info & Status Badges */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-full bg-emerald-100 text-[#0D7A5F] border border-emerald-200 flex items-center justify-center font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-[#18181B]">{tech.name}</h3>
                        <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.2 rounded font-mono">
                          {tech.role || "Lead Technician"}
                        </span>
                        {tech.hasPending && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                            ⏳ Pending Payout: {formatCurrency(tech.totalPending)}
                          </span>
                        )}
                        {tech.hasPartial && (
                          <span className="text-[10px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            Instalment Cleared
                          </span>
                        )}
                        {tech.isAllCleared && (
                          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            ✓ All Claims Cleared
                          </span>
                        )}
                        {tech.claimsCount === 0 && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                            No Expenses Claimed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#71717A] flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-[#A1A1AA]" />
                          {tech.phone}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-zinc-800">
                          {tech.jobs.length} Active / Handled Jobs Today
                        </span>
                        <span>•</span>
                        <span>{tech.claimsCount} Itemized Expenses Logged</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts & Action Buttons */}
                  <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end">
                    {/* Financial Summary Pill */}
                    <div className="px-3.5 py-2 bg-white rounded-lg border border-[#E4E4E7] text-right space-y-0.5">
                      <div className="text-[10px] text-[#71717A] uppercase font-bold flex items-center justify-end gap-2">
                        <span>Total Claimed:</span>
                        <strong className="font-mono text-zinc-900">{formatCurrency(tech.totalClaimed)}</strong>
                      </div>
                      <div className="text-xs font-mono font-black flex items-center justify-end gap-2">
                        <span className="text-amber-800 font-bold">Due Payout:</span>
                        <span className="text-amber-900 text-sm">{formatCurrency(tech.totalPending)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {tech.hasPending && (
                        <button
                          type="button"
                          onClick={() => openClearTechnician(tech)}
                          className="px-3.5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Clear Expenses ({formatCurrency(tech.totalPending)})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(tech.id)}
                        className="px-3 py-2 bg-white hover:bg-[#F4F4F5] text-zinc-800 border border-[#D4D4D8] rounded-lg text-xs font-bold transition flex items-center gap-1"
                        title="Toggle daily jobs & itemized expenses breakdown"
                      >
                        <span>{isExpanded ? "Hide Details" : "Inspect Day Jobs & Claims"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed View: Daily Jobs & Itemized Claims */}
                {isExpanded && (
                  <div className="p-5 space-y-5 animate-in fade-in duration-150 bg-white">
                    {/* SECTION 1: Technician's Jobs of That Day */}
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#F4F4F5]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#0D7A5F]" />
                          Work Orders Assigned / Handled by {tech.name} on {isAllDates ? "All Dates" : dateParam} ({tech.jobs.length})
                        </h4>
                        <span className="text-[11px] text-[#71717A]">
                          Field mobile expenses are automatically split and mapped to these active work orders.
                        </span>
                      </div>

                      {tech.jobs.length === 0 ? (
                        <div className="p-4 text-center bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs text-[#71717A] italic">
                          No work orders assigned or handled by {tech.name} on this date.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {tech.jobs.map((job) => (
                            <div
                              key={job.id}
                              className="p-3 bg-[#FAFAFA] hover:bg-white rounded-lg border border-[#E4E4E7] hover:border-emerald-300 transition text-xs space-y-2 group shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <Link
                                  href={`/jobs/${job.id}`}
                                  target="_blank"
                                  className="font-mono font-bold text-[#0D7A5F] hover:underline inline-flex items-center gap-1"
                                >
                                  {job.jobNumber}
                                  <ExternalLink className="w-3 h-3 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E4E4E7] text-zinc-800">
                                  {job.status}
                                </span>
                              </div>

                              <div>
                                <p className="font-semibold text-zinc-900 truncate">{job.customer.name}</p>
                                <p className="text-[11px] text-[#71717A] truncate">{job.customer.addressText || "Site address"}</p>
                              </div>

                              <div className="pt-2 border-t border-[#E4E4E7]/70 flex items-center justify-between text-[11px]">
                                <span className="text-[#71717A]">{formatJobType(job.jobType)}</span>
                                <span className="font-mono font-bold text-zinc-800">
                                  {job.claims.length} Claim{job.claims.length === 1 ? "" : "s"} (
                                  {formatCurrency(job.claims.reduce((s, c) => s + c.amount, 0))})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: Itemized Claims Table */}
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#F4F4F5]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-amber-700" />
                          Itemized Expense Claims Breakdown ({tech.claims.length})
                        </h4>
                        <span className="text-[11px] text-[#71717A]">
                          Individual mobile claims submitted by technician with receipts, categories & status.
                        </span>
                      </div>

                      {tech.claims.length === 0 ? (
                        <div className="p-4 text-center bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs text-[#71717A] italic">
                          No expense claims logged for {tech.name} on this date.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F9FAFB]">
                                <th className="py-2.5 px-4">Work Order</th>
                                <th className="py-2.5 px-4">Category</th>
                                <th className="py-2.5 px-4">Claim Description & Notes</th>
                                <th className="py-2.5 px-4 text-center">Receipt</th>
                                <th className="py-2.5 px-4 text-right">Claim Amount</th>
                                <th className="py-2.5 px-4 text-center">Status</th>
                                <th className="py-2.5 px-4 text-right">Clearance Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E4E7]">
                              {tech.claims.map((claim) => (
                                <tr key={claim.id} className="hover:bg-[#FAFAFA] transition">
                                  {/* Work Order */}
                                  <td className="py-2.5 px-4 font-mono font-bold text-[#0D7A5F]">
                                    <Link href={`/jobs/${claim.jobId}`} target="_blank" className="hover:underline">
                                      {claim.jobNumber}
                                    </Link>
                                    <span className="block text-[10px] text-zinc-500 font-normal truncate max-w-[140px]">
                                      {claim.customerName}
                                    </span>
                                  </td>

                                  {/* Category */}
                                  <td className="py-2.5 px-4">
                                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 font-semibold text-[11px] border border-zinc-200">
                                      {claim.category}
                                    </span>
                                  </td>

                                  {/* Description & Partial Note */}
                                  <td className="py-2.5 px-4 max-w-[340px]">
                                    <p className="font-medium text-zinc-900 leading-snug">{claim.note}</p>
                                    <p className="text-[10px] text-zinc-400 mt-0.5">
                                      Logged: {formatDateTime(claim.createdAt)}
                                    </p>
                                    {claim.paidAt && (
                                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                        Cleared on: {formatDateTime(claim.paidAt)}
                                      </p>
                                    )}
                                  </td>

                                  {/* Receipt Image / Proof */}
                                  <td className="py-2.5 px-4 text-center">
                                    {claim.receiptUrl ? (
                                      <button
                                        type="button"
                                        onClick={() => openLightbox(claim.receiptUrl!)}
                                        className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition inline-flex items-center gap-1 border border-zinc-300 text-[10px] font-bold"
                                        title="View full receipt proof"
                                      >
                                        <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                                        <span>Receipt</span>
                                      </button>
                                    ) : (
                                      <span className="text-[#A1A1AA] text-[10px] italic">None</span>
                                    )}
                                  </td>

                                  {/* Amount */}
                                  <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-900 text-sm">
                                    {formatCurrency(claim.amount)}
                                  </td>

                                  {/* Status */}
                                  <td className="py-2.5 px-4 text-center">
                                    {claim.status === "paid" ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] inline-flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        Cleared
                                      </span>
                                    ) : claim.isPartial ? (
                                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px]">
                                        Instalment Due
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px] animate-pulse">
                                        Pending
                                      </span>
                                    )}
                                  </td>

                                  {/* Action */}
                                  <td className="py-2.5 px-4 text-right">
                                    {claim.status === "pending" ? (
                                      <button
                                        type="button"
                                        onClick={() => openClearClaim(claim, tech.name)}
                                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white transition shadow-2xs inline-flex items-center gap-1"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Clear Claim
                                      </button>
                                    ) : (
                                      <span className="text-emerald-700 font-mono text-[11px] font-semibold">
                                        ✓ Reconciled
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ACCOUNTANT EXPENSE CLEARANCE MODAL (FULL & PARTIAL DISBURSEMENT) */}
      {clearanceModalOpen && clearanceTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7] text-xs max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-[#0D7A5F]" />
                  Disburse & Clear Technician Field Expenses
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Reconcile expense payouts and post balanced double-entry General Ledger journals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClearanceModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Breakdown Banner */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    Recipient Technician:
                  </span>
                  <p className="font-bold text-emerald-950 text-sm mt-0.5">
                    {clearanceTarget.technicianName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    Total Due Balance:
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-950">
                    {formatCurrency(clearanceTarget.maxAmount)}
                  </span>
                </div>
              </div>

              {clearanceTarget.noteLabel && (
                <p className="text-[11px] text-emerald-900 pt-1 border-t border-emerald-200/50">
                  <strong>Scope:</strong> {clearanceTarget.noteLabel}
                </p>
              )}
            </div>

            <form onSubmit={handleExecuteClearance} className="space-y-4">
              {/* Payment Source Account */}
              <div>
                <label className="font-bold text-[#18181B] block mb-1">
                  Disbursing Source (Payment Account) *
                </label>
                <select
                  value={disbursingAccountCode}
                  onChange={(e) => setDisbursingAccountCode(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-semibold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                >
                  <option value="1000">1000 — Cash on Hand / Main Drawer (Cash Box / Office Safe)</option>
                  <option value="1010">1010 — Operating Bank Account (Meezan Bank)</option>
                  <option value="1011">1011 — Secondary Corporate Bank (HBL)</option>
                  <option value="1020">1020 — Petty Cash Float (Store / Emergency Float)</option>
                  <option value="2100">2100 — Technician Payable Clearing (Owed to Technician)</option>
                </select>
                <p className="text-[10px] text-[#71717A] mt-1 font-mono">
                  GL Impact: Dr 6100 (Technician Travel & Field Expenses) | Cr {disbursingAccountCode}
                </p>
              </div>

              {/* Clearance Mode: Full vs Partial */}
              <div>
                <label className="font-bold text-[#18181B] block mb-1.5">
                  Clearance Settlement Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClearanceMode("full");
                      setPartialAmount(String(clearanceTarget.maxAmount));
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition font-semibold",
                      clearanceMode === "full"
                        ? "border-[#0D7A5F] bg-[#0D7A5F]/10 text-[#0D7A5F] ring-1 ring-[#0D7A5F]"
                        : "border-[#E4E4E7] bg-white text-[#71717A] hover:border-[#D4D4D8]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Clear Whole Amount</span>
                      <span className="text-[10px] font-mono">100%</span>
                    </div>
                    <p className="text-[10px] text-[#71717A] mt-0.5">
                      Pay full {formatCurrency(clearanceTarget.maxAmount)} now.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setClearanceMode("partial");
                      const half = Math.round(clearanceTarget.maxAmount / 2);
                      setPartialAmount(String(half));
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition font-semibold",
                      clearanceMode === "partial"
                        ? "border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-600"
                        : "border-[#E4E4E7] bg-white text-[#71717A] hover:border-[#D4D4D8]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Partial Clearance</span>
                      <span className="text-[10px] font-bold text-amber-700">Instalment</span>
                    </div>
                    <p className="text-[10px] text-[#71717A] mt-0.5">
                      Pay available cash; remainder stays pending.
                    </p>
                  </button>
                </div>
              </div>

              {/* Partial Amount Input & Real-time Math */}
              {clearanceMode === "partial" && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                  <div>
                    <label className="text-[11px] font-bold text-amber-950 block mb-1">
                      Amount to Disburse Now (PKR) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={clearanceTarget.maxAmount}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="e.g. 2000"
                      className="w-full bg-white p-2 rounded-lg border border-amber-300 font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Percentage shortcuts */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-amber-800 font-semibold">Quick Set:</span>
                    {[0.25, 0.5, 0.75].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setPartialAmount(String(Math.round(clearanceTarget.maxAmount * pct)))
                        }
                        className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-bold text-amber-900 border border-amber-300 transition"
                      >
                        {pct * 100}% ({formatCurrency(Math.round(clearanceTarget.maxAmount * pct))})
                      </button>
                    ))}
                  </div>

                  {/* Real-time Math Summary */}
                  {Number(partialAmount) > 0 && (
                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-amber-800 block">Disbursing Now:</span>
                        <strong className="font-mono font-bold text-emerald-800">
                          {formatCurrency(Number(partialAmount))}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-800 block">Remaining Afterwards:</span>
                        <strong className="font-mono font-bold text-rose-800">
                          {formatCurrency(Math.max(0, clearanceTarget.maxAmount - Number(partialAmount)))}
                        </strong>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-amber-800 italic leading-snug">
                    ℹ️ The remaining unpaid balance of {formatCurrency(Math.max(0, clearanceTarget.maxAmount - (Number(partialAmount) || 0)))} will automatically stay as a pending expense on the job record so you can clear it whenever more cash is available.
                  </p>
                </div>
              )}

              {/* Reference / Notes */}
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Disbursement Reference / Voucher Notes (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cash Voucher #402, Raast Transfer ID, or Cheque Number"
                  className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setClearanceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isProcessing ||
                    (clearanceMode === "partial" &&
                      (!Number(partialAmount) ||
                        Number(partialAmount) <= 0 ||
                        Number(partialAmount) > clearanceTarget.maxAmount))
                  }
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-[#D4D4D8] text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  {isProcessing
                    ? "Posting GL..."
                    : clearanceMode === "partial"
                    ? `Disburse Partial ${formatCurrency(Number(partialAmount) || 0)}`
                    : `Disburse Full ${formatCurrency(clearanceTarget.maxAmount)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Receipt Images */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title="Expense Receipt Proof"
        filePrefix="expense-receipt"
      />
    </div>
  );
}
