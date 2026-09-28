"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ReassignTechDrawer from "@/components/drawers/ReassignTechDrawer";
import RecordStockReturnDrawer from "@/components/drawers/RecordStockReturnDrawer";
import JobsKpiDashboard from "@/components/jobs/JobsKpiDashboard";
import StorekeeperKpiDashboard from "@/components/jobs/StorekeeperKpiDashboard";
import { formatCurrency, formatDateTime, formatJobType, capitalizeWords, cn } from "@/lib/utils";
import {
  Plus,
  User,
  AlertTriangle,
  Building,
  RefreshCw,
  Package,
  Receipt,
  DollarSign,
  ShieldCheck,
  BarChart3,
  Briefcase,
  Lock,
  MapPin,
  ChevronRight,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  CheckCheck,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";

export default function JobsListPage() {
  const { activeRole, currentPersona, hasPermission } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
  const isAccountant = activeRole === "accountant";
  const isAdmin = activeRole === "admin";
  const isDispatcher = activeRole === "dispatcher";
  const canViewFinancials = hasPermission("jobs.view_financials");
  const canReassignTech = hasPermission("jobs.reassign_tech");
  const canCreateJob = hasPermission("jobs.create_job");
  const canViewDirectory = hasPermission("jobs.view_directory");
  const canStockReturn = hasPermission("jobs.stock_return");
  const canViewReports = hasPermission("jobs.reports") && !isStorekeeper;
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect legacy /jobs?view=reports links to dedicated /jobs/reports page
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "reports" || params.get("tab") === "reports") {
        router.replace("/jobs/reports");
      }
    }
  }, [router]);

  // Reassign Drawer state
  const [reassignJob, setReassignJob] = useState<any>(null);
  const [returnJob, setReturnJob] = useState<any>(null);

  async function fetchJobs() {
    try {
      setLoading(true);
      const [jobsRes, techRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/technicians"),
      ]);
      const jobsData = await jobsRes.json();
      const techData = await techRes.json();

      if (Array.isArray(jobsData)) setJobs(jobsData);
      if (techData?.technicians) setTechnicians(techData.technicians);
    } catch (e) {
      console.error("Failed loading jobs", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  // Filter states for individual chips
  const [selectedTechFilter, setSelectedTechFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("");

  // Filter based on active tab & role
  const filteredByTab = jobs.filter((j) => {
    if (isStorekeeper) {
      // The storekeeper should see ONLY jobs with requests for inventory or returns, NEVER unrelated jobs
      const hasInventoryReq = Boolean(j.inventoryRequests && j.inventoryRequests.length > 0);
      const hasReturns = Boolean(j.stockReturns && j.stockReturns.length > 0);
      const isDoneOrPaused = ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified", "Paused"].includes(j.status);
      const returnableQty = j.items?.reduce((sum: number, it: any) => {
        if (it.quantityActual !== null && it.quantityActual !== undefined && it.quantityPlanned > it.quantityActual) {
          return sum + (it.quantityPlanned - it.quantityActual);
        }
        return sum;
      }, 0) || 0;
      const isReturnable = hasReturns || (isDoneOrPaused && returnableQty > 0);

      // Strictly isolate: hide jobs that have no inventory activity or returnable materials
      if (!hasInventoryReq && !isReturnable) return false;

      if (kpiFilter) {
        if (kpiFilter === "pending_requests" || kpiFilter === "pending_stock") {
          return j.inventoryRequests?.some((r: any) => r.status === "pending");
        }
        if (kpiFilter === "done_requests" || kpiFilter === "approved_stock") {
          return j.inventoryRequests?.some(
            (r: any) => r.status === "issued" || r.status === "fulfilled"
          );
        }
        if (kpiFilter === "returnable_stock" || kpiFilter === "returnable") {
          return isReturnable;
        }
        if (kpiFilter === "recorded_returns") {
          return hasReturns;
        }
        if (kpiFilter === "all_requisitions") {
          return true;
        }
      }

      if (activeTab === "pending_materials") {
        return j.inventoryRequests?.some((r: any) => r.status === "pending");
      }
      if (activeTab === "returnable") {
        return isReturnable;
      }
      return true;
    }

    if (kpiFilter) {
      if (kpiFilter === "unassigned") {
        const isUnassigned =
          j.status === "Created" ||
          (!j.assignedTechnicianId &&
            (!j.technicianIds || j.technicianIds.length === 0) &&
            (!j.assignments || j.assignments.length === 0));
        if (!isUnassigned) return false;
      } else if (kpiFilter === "assigned") {
        if (j.status !== "Assigned") return false;
      } else if (kpiFilter === "accepted") {
        if (j.status !== "Accepted") return false;
      } else if (kpiFilter === "in_progress") {
        if (j.status !== "InProgress") return false;
      } else if (kpiFilter === "paused") {
        if (j.status !== "Paused") return false;
      } else if (kpiFilter === "completed") {
        if (
          ![
            "CompletedPendingVerification",
            "Finalized",
            "Verified",
            "AwaitingFeedback",
          ].includes(j.status)
        )
          return false;
      } else if (kpiFilter === "pending_stock") {
        if (!j.inventoryRequests?.some((r: any) => r.status === "pending")) return false;
      } else if (kpiFilter === "approved_stock") {
        if (
          !j.inventoryRequests?.some(
            (r: any) => r.status === "issued" || r.status === "fulfilled"
          )
        )
          return false;
      } else if (kpiFilter === "pending_discount") {
        if (!j.items?.some((it: any) => it.description?.includes("[Discount Requested:"))) return false;
      } else if (kpiFilter === "approved_discount") {
        const hasApprovedDiscount =
          (j.discountAmount && j.discountAmount > 0) ||
          j.items?.some(
            (it: any) =>
              it.description?.includes("[Discount Approved:") ||
              it.description?.includes("[Discount:")
          );
        if (!hasApprovedDiscount) return false;
      }
    }

    if (activeTab === "all") return true;

    if (isAccountant) {
      if (activeTab === "awaiting_feedback") return j.status === "AwaitingFeedback";
    if (activeTab === "pending_clearance") return j.status === "CompletedPendingVerification";
      if (activeTab === "discount_requests") return j.items?.some((it: any) => it.description?.includes("[Discount Requested:"));
      if (activeTab === "pending_expenses") return j.expenseClaims?.some((c: any) => c.status === "pending");
      if (activeTab === "completed") return ["Finalized", "Verified"].includes(j.status);
    } else if (isDispatcher) {
      if (activeTab === "unassigned") {
        return (
          j.status === "Created" ||
          (!j.assignedTechnicianId &&
            (!j.technicianIds || j.technicianIds.length === 0) &&
            (!j.assignments || j.assignments.length === 0))
        );
      }
      if (activeTab === "assigned") return j.status === "Assigned";
      if (activeTab === "in_progress") return j.status === "InProgress" || j.status === "Accepted";
      if (activeTab === "paused") return j.status === "Paused";
      if (activeTab === "completed") {
        return ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified"].includes(j.status);
      }
    } else {
      // Admin / Manager / Ops / Call Center / Cashier / Auditor
      if (activeTab === "assigned_today") return j.status === "Assigned" || j.status === "InProgress";
      if (activeTab === "needs_review") return j.qualityFlag === "disputed";
      if (activeTab === "completed") return ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified"].includes(j.status);
    }

    return true;
  });

  // Filter based on search query and filter chips
  const filteredJobs = filteredByTab.filter((j) => {
    if (selectedTechFilter && j.assignedTechnician?.name !== selectedTechFilter) return false;
    if (selectedStatusFilter && j.status !== selectedStatusFilter) return false;
    if (selectedTypeFilter && j.jobType !== selectedTypeFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const formattedType = formatJobType(j.jobType).toLowerCase();
    return (
      j.jobNumber?.toLowerCase().includes(q) ||
      j.manualJobNumber?.toLowerCase().includes(q) ||
      j.customer?.name?.toLowerCase().includes(q) ||
      j.customer?.phone?.toLowerCase().includes(q) ||
      j.remarks?.toLowerCase().includes(q) ||
      j.careOfParty?.companyName?.toLowerCase().includes(q) ||
      j.careOfParty?.personName?.toLowerCase().includes(q) ||
      j.assignedTechnician?.name?.toLowerCase().includes(q) ||
      j.jobType?.toLowerCase().includes(q) ||
      formattedType.includes(q)
    );
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || a.jobDate || 0).getTime();
    const dateB = new Date(b.createdAt || b.created_at || b.jobDate || 0).getTime();
    if (dateA && dateB && dateA !== dateB) return dateB - dateA;
    return 0;
  });

  function getJobTypeBadge(type: string | null | undefined) {
    const formatted = formatJobType(type);
    const lower = (type || "").toLowerCase();

    let colorClasses = "bg-zinc-100/90 text-zinc-700 border-zinc-200/90";
    let dotColor = "bg-zinc-400";

    if (lower.includes("install") || lower.includes("commission")) {
      colorClasses = "bg-sky-50 text-sky-800 border-sky-200/90";
      dotColor = "bg-sky-500";
    } else if (lower.includes("duct") || lower.includes("clean") || lower.includes("sanitiz")) {
      colorClasses = "bg-teal-50 text-teal-800 border-teal-200/90";
      dotColor = "bg-teal-500";
    } else if (lower.includes("repair") || lower.includes("breakdown") || lower.includes("leak")) {
      colorClasses = "bg-amber-50 text-amber-800 border-amber-200/90";
      dotColor = "bg-amber-500";
    } else if (lower.includes("maint") || lower.includes("inspect") || lower.includes("audit") || lower.includes("amc")) {
      colorClasses = "bg-emerald-50 text-emerald-800 border-emerald-200/90";
      dotColor = "bg-emerald-500";
    } else if (lower.includes("emergency") || lower.includes("overhaul")) {
      colorClasses = "bg-rose-50 text-rose-800 border-rose-200/90";
      dotColor = "bg-rose-500";
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-tight shadow-2xs whitespace-nowrap",
          colorClasses
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
        <span>{formatted}</span>
      </span>
    );
  }

  // Base columns
  const allColumns: ColumnDef<any>[] = [
    {
      id: "jobNumber",
      header: "Job # & External Ref",
      accessorKey: "jobNumber",
      isPrimaryLink: true,
      getHref: (row) => `/jobs/${row.id}`,
      cell: (row) => {
        const successors = (row.childJobs || []).filter(
          (c: any) => c && c.id
        ) as { id: string; jobNumber: string; status?: string }[];
        const openSuccessor =
          successors.find((c) => c.status !== "TechnicianReassigned") || successors[0];
        const parent = row.parentJob as
          | { id: string; jobNumber: string; status?: string }
          | null
          | undefined;
        const showParent =
          parent?.id &&
          (row.parentJobId || row.reassignedFromJobId || row.status !== "TechnicianReassigned");

        return (
          <div className="space-y-0.5">
            <span className="font-mono font-bold text-xs text-[#0D7A5F] hover:underline block whitespace-nowrap">
              {row.jobNumber}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {row.manualJobNumber && (
                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded font-mono inline-block">
                  Ext: #{row.manualJobNumber}
                </span>
              )}
              {row.careOfParty && (
                <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1 rounded font-medium inline-flex items-center gap-0.5">
                  <Building className="w-2.5 h-2.5 text-purple-500" />
                  c/o {row.careOfParty.companyName}
                </span>
              )}
              {row.status === "TechnicianReassigned" && openSuccessor && (
                <Link
                  href={`/jobs/${openSuccessor.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-violet-800 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-0.5 hover:bg-violet-100"
                  title="Open successor work order"
                >
                  <ArrowUpRight className="w-2.5 h-2.5" />
                  Successor {openSuccessor.jobNumber}
                </Link>
              )}
              {showParent && parent && (
                <Link
                  href={`/jobs/${parent.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-slate-700 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-0.5 hover:bg-slate-100"
                  title="Open parent / reassigned-from work order"
                >
                  From {parent.jobNumber}
                </Link>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "customer",
      header: "Customer",
      cell: (row) => {
        const customerName = capitalizeWords(row.customer?.name || "Customer");
        const address = row.customer?.addressText || "";
        const formattedAddress = address.startsWith("GPS Location")
          ? address.replace("GPS Location", "GPS: ")
          : capitalizeWords(address);

        return (
          <div className="max-w-[210px]">
            <p className="font-semibold text-[#18181B] text-xs truncate" title={customerName}>
              {customerName}
            </p>
            {address ? (
              <p
                className="text-[11px] text-[#71717A] truncate flex items-center gap-1 mt-0.5"
                title={address}
              >
                <MapPin className="w-3 h-3 text-[#A1A1AA] shrink-0" />
                <span className="truncate">{formattedAddress}</span>
              </p>
            ) : (
              <p className="text-[11px] text-[#A1A1AA] italic">No address on file</p>
            )}
          </div>
        );
      },
    },
    {
      id: "type",
      header: "Job Type",
      accessorKey: "jobType",
      cell: (row) => getJobTypeBadge(row.jobType),
    },
    {
      id: "technician",
      header: "Technician",
      cell: (row) => {
        const techName = row.assignedTechnician?.name
          ? capitalizeWords(row.assignedTechnician.name)
          : null;

        const initials = techName
          ? techName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : "";

        return (
          <div className="flex items-center">
            {row.assignedTechnician ? (
              <div className="inline-flex items-center gap-2 bg-white border border-[#E4E4E7] hover:border-emerald-300 rounded-full pl-1 pr-2 py-0.5 shadow-2xs transition group max-w-full">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#0D7A5F] text-[9px] font-bold inline-flex items-center justify-center shrink-0 border border-emerald-200">
                  {initials}
                </span>
                <span
                  className="font-semibold text-[#18181B] truncate text-xs max-w-[110px]"
                  title={techName || ""}
                >
                  {techName}
                </span>
                {canReassignTech && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReassignJob(row);
                    }}
                    title="Change assigned technician"
                    className="text-[10px] font-semibold text-[#71717A] hover:text-[#0D7A5F] bg-[#F4F4F5] hover:bg-emerald-50 px-1.5 py-0.5 rounded-full border border-[#E4E4E7] hover:border-emerald-200 transition shrink-0 ml-0.5"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : canReassignTech ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReassignJob(row);
                }}
                className="text-[11px] font-semibold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 transition inline-flex items-center gap-1 shadow-2xs group"
              >
                <Plus className="w-3 h-3 group-hover:scale-110 transition" />
                <span>+ Assign Tech</span>
              </button>
            ) : (
              <span className="text-xs text-[#A1A1AA] italic">Unassigned</span>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: isStorekeeper ? "Material Status" : "Status",
      cell: (row) => {
        if (isStorekeeper) {
          const pendingCount = row.inventoryRequests?.filter((r: any) => r.status === "pending").length || 0;
          const issuedCount = row.inventoryRequests?.filter((r: any) => r.status === "issued" || r.status === "fulfilled").length || 0;
          const returns = row.stockReturns || [];
          const pendingAckCount = returns.filter((r: any) => !r.acknowledgedAt).length;
          const ackedCount = returns.filter((r: any) => r.acknowledgedAt).length;
          const ackedQty = returns.filter((r: any) => r.acknowledgedAt).reduce((s: number, r: any) => s + (Number(r.qtyReturned) || 0), 0);
          const isDone = ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified", "Paused"].includes(row.status);
          const returnableQty = row.items?.reduce((sum: number, it: any) => {
            if (it.quantityActual !== null && it.quantityActual !== undefined && it.quantityPlanned > it.quantityActual) {
              return sum + (it.quantityPlanned - it.quantityActual);
            }
            return sum;
          }, 0) || 0;
          const remainingReturnable = Math.max(0, returnableQty - ackedQty);

          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {pendingCount > 0 && (
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 animate-pulse">
                    <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Material Req Pending ({pendingCount})</span>
                  </span>
                )}
                {issuedCount > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{issuedCount} {issuedCount === 1 ? "Item" : "Items"} Issued</span>
                  </span>
                )}
                {pendingAckCount > 0 && (
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{pendingAckCount} Return Awaiting Ack</span>
                  </span>
                )}
                {isDone && remainingReturnable > 0 && (
                  <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{remainingReturnable} Returnable</span>
                  </span>
                )}
                {ackedCount > 0 && (
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5">
                    <CheckCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{ackedCount} Return Logged</span>
                  </span>
                )}
                {pendingCount === 0 && issuedCount === 0 && !remainingReturnable && ackedCount === 0 && (
                  <span className="text-[11px] text-[#71717A] italic">
                    No Material Requests
                  </span>
                )}
              </div>
            </div>
          );
        }

        const hasPendingReq = row.inventoryRequests?.some((r: any) => r.status === "pending");
        const hasDiscountReq = row.items?.some((it: any) => it.description?.includes("[Discount Requested:"));
        const hasPendingExpense = row.expenseClaims?.some((c: any) => c.status === "pending");

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={row.status} />
              {row.qualityFlag === "disputed" && (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                  Disputed
                </span>
              )}
              {row.status === "TechnicianReassigned" &&
                (row.childJobs || []).some((c: any) => c?.id) && (
                  <Link
                    href={`/jobs/${(row.childJobs.find((c: any) => c.status !== "TechnicianReassigned") || row.childJobs[0]).id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-bold text-violet-800 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 hover:bg-violet-100"
                  >
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    Open successor
                  </Link>
                )}
              {(row.parentJob?.id || row.reassignedFromJobId) && row.parentJob?.jobNumber && (
                <Link
                    href={`/jobs/${row.parentJob.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 hover:bg-slate-100"
                  >
                    Parent {row.parentJob.jobNumber}
                  </Link>
                )}
            </div>
            {isStorekeeper && hasPendingReq && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                <Package className="w-2.5 h-2.5 text-amber-600" />
                Material Req Pending
              </span>
            )}
            {isAccountant && hasDiscountReq && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                Discount Requested
              </span>
            )}
            {isAccountant && hasPendingExpense && (
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                <Receipt className="w-2.5 h-2.5 text-blue-600" />
                Expense Pending
              </span>
            )}
          </div>
        );      },
    },
    // Strictly hide Amount column if user lacks financial permission, showing warehouse material status instead
    ...(!canViewFinancials && !isStorekeeper
      ? [
          {
            id: "storeInventorySummary",
            header: "Warehouse Material Status",
            cell: (row: any) => {
              const pendingCount = row.inventoryRequests?.filter((r: any) => r.status === "pending").length || 0;
              const issuedCount = row.inventoryRequests?.filter((r: any) => r.status === "issued").length || 0;
              const returns = row.stockReturns || [];
              const returnedCount = returns.length;
              const pendingAckCount = returns.filter((r: any) => !r.acknowledgedAt).length;
              const ackedCount = returns.filter((r: any) => r.acknowledgedAt).length;
              const ackedQty = returns.filter((r: any) => r.acknowledgedAt).reduce((s: number, r: any) => s + (Number(r.qtyReturned) || 0), 0);
              const isDone = ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified", "Paused"].includes(row.status);
              const returnableQty = row.items?.reduce((sum: number, it: any) => {
                if (it.quantityActual !== null && it.quantityActual !== undefined && it.quantityPlanned > it.quantityActual) {
                  return sum + (it.quantityPlanned - it.quantityActual);
                }
                return sum;
              }, 0) || 0;
              const remainingReturnable = Math.max(0, returnableQty - ackedQty);

              return (
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {issuedCount > 0 && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-1.5 py-0.5 rounded">
                        {issuedCount} Item{issuedCount === 1 ? "" : "s"} Issued
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 font-bold px-1.5 py-0.5 rounded animate-pulse">
                        {pendingCount} Pending Req
                      </span>
                    )}
                    {pendingAckCount > 0 && (
                      <span className="bg-amber-50 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded animate-pulse">
                        {pendingAckCount} Awaiting Ack
                      </span>
                    )}
                    {isDone && remainingReturnable > 0 && (
                      <span className="bg-purple-50 text-purple-800 border border-purple-200 font-bold px-1.5 py-0.5 rounded">
                        {remainingReturnable} Returnable
                      </span>
                    )}
                    {ackedCount > 0 && (
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-1.5 py-0.5 rounded">
                        {ackedCount} Return Recorded
                      </span>
                    )}
                    {returnedCount > 0 && ackedCount === 0 && pendingAckCount === 0 && (
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-1.5 py-0.5 rounded">
                        {returnedCount} Return Recorded
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          },
        ]
      : !isDispatcher && (isAdmin || isAccountant || canViewFinancials)
      ? [
          {
            id: "amount",
            header: "Amount",
            align: "right" as const,
            cell: (row: any) => {
              let total = 0;
              for (const it of row.items || []) {
                total += (it.quantityActual ?? it.quantityPlanned) * it.unitRate;
              }
              const net = Math.max(0, total - (row.discountAmount || 0));
              return (
                <div className="text-right">
                  <span className="font-mono font-bold text-[#18181B] text-xs block">
                    {formatCurrency(net)}
                  </span>
                  {row.discountAmount > 0 && (
                    <span className="text-[10px] text-amber-700 font-mono inline-block bg-amber-50 border border-amber-200 px-1 rounded mt-0.5">
                      -{formatCurrency(row.discountAmount)}
                    </span>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
    {
      id: "createdAt",
      header: "Created",
      align: "right",
      cell: (row) => {
        if (!row.createdAt) return <span className="text-xs text-[#A1A1AA] font-mono">Ã¢â‚¬â€</span>;
        const d = new Date(row.createdAt);
        const dateStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
        const timeStr = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
        return (
          <div className="text-right">
            <span className="text-[11px] font-medium text-[#3F3F46] block">{dateStr}</span>
            <span className="text-[10px] text-[#A1A1AA] font-mono block">{timeStr}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Quick Action",
      align: "right",
      cell: (row) => {
        const onReturnableTab =
          isStorekeeper &&
          (activeTab === "returnable" ||
            kpiFilter === "returnable_stock" ||
            kpiFilter === "returnable");
        const showRecordReturn = onReturnableTab && canStockReturn;

        if (showRecordReturn) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReturnJob(row);
                }}
                className="text-[11px] font-bold px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Record return</span>
              </button>
              <Link
                href={`/jobs/${row.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg text-[#52525B] bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#E4E4E7] transition"
                title="Open job details / issue stock"
              >
                Details
              </Link>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end">
            <Link
              href={`/jobs/${row.id}`}
              className={
                isStorekeeper
                  ? "text-[11px] font-bold px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition inline-flex items-center gap-1.5"
                  : isAccountant
                  ? "text-[11px] font-semibold px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition inline-flex items-center gap-1"
                  : "text-[11px] font-semibold px-2.5 py-1 rounded-lg text-[#0D7A5F] bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200/90 transition inline-flex items-center gap-1 shadow-2xs group"
              }
            >
              {isStorekeeper ? (
                <>
                  <Package className="w-3.5 h-3.5" />
                  <span>Details & Issue Stock</span>
                </>
              ) : isAccountant ? (
                <>
                  <Receipt className="w-3 h-3" />
                  <span>Financials</span>
                </>
              ) : (
                <>
                  <span>Details</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform text-[#0D7A5F]" />
                </>
              )}
            </Link>
          </div>
        );
      },
    },
  ];

  // Role-specific tab presets
  const accountantTabs = [
    { id: "all", label: "All Jobs Ledger", count: jobs.length },
    { id: "awaiting_feedback", label: "Awaiting Feedback", count: jobs.filter((j) => j.status === "AwaitingFeedback").length },
    { id: "pending_clearance", label: "Needs Finalization", count: jobs.filter((j) => j.status === "CompletedPendingVerification").length },
    { id: "discount_requests", label: "Discount Requested", count: jobs.filter((j) => j.items?.some((it: any) => it.description?.includes("[Discount Requested:"))).length },
    { id: "pending_expenses", label: "Pending Expenses", count: jobs.filter((j) => j.expenseClaims?.some((c: any) => c.status === "pending")).length },
    { id: "completed", label: "Finalized / Verified", count: jobs.filter((j) => ["Finalized", "Verified"].includes(j.status)).length },
  ];

  const storekeeperJobs = jobs.filter((j) => {
    const hasInventoryReq = Boolean(j.inventoryRequests && j.inventoryRequests.length > 0);
    const hasReturns = Boolean(j.stockReturns && j.stockReturns.length > 0);
    const isDoneOrPaused = ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified", "Paused"].includes(j.status);
    const returnableQty = j.items?.reduce((sum: number, it: any) => {
      if (it.quantityActual !== null && it.quantityActual !== undefined && it.quantityPlanned > it.quantityActual) {
        return sum + (it.quantityPlanned - it.quantityActual);
      }
      return sum;
    }, 0) || 0;
    return hasInventoryReq || hasReturns || (isDoneOrPaused && returnableQty > 0);
  });

  const storekeeperPendingJobs = storekeeperJobs.filter((j) =>
    j.inventoryRequests?.some((r: any) => r.status === "pending")
  );

  const storekeeperReturnableJobs = storekeeperJobs.filter((j) => {
    const hasReturns = Boolean(j.stockReturns && j.stockReturns.length > 0);
    const isDoneOrPaused = ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified", "Paused"].includes(j.status);
    const returnableQty = j.items?.reduce((sum: number, it: any) => {
      if (it.quantityActual !== null && it.quantityActual !== undefined && it.quantityPlanned > it.quantityActual) {
        return sum + (it.quantityPlanned - it.quantityActual);
      }
      return sum;
    }, 0) || 0;
    return hasReturns || (isDoneOrPaused && returnableQty > 0);
  });

  const storekeeperTabs = [
    { id: "all", label: "Inventory Requested Jobs", count: storekeeperJobs.length },
    { id: "pending_materials", label: "Pending Material Requests", count: storekeeperPendingJobs.length },
    { id: "returnable", label: "Unused / Returnable Stock", count: storekeeperReturnableJobs.length },
  ];

  const adminTabs = [
    { id: "all", label: "All Jobs", count: jobs.length },
    { id: "assigned_today", label: "Assigned Today", count: jobs.filter((j) => j.status === "Assigned" || j.status === "InProgress").length },
    { id: "needs_review", label: "Needs Review", count: jobs.filter((j) => j.qualityFlag === "disputed").length },
    { id: "completed", label: "Completed", count: jobs.filter((j) => ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified"].includes(j.status)).length },
  ];

  const dispatcherTabs = [
    { id: "all", label: "All Jobs", count: jobs.length },
    {
      id: "unassigned",
      label: "Unassigned Queue",
      count: jobs.filter(
        (j) =>
          j.status === "Created" ||
          (!j.assignedTechnicianId &&
            (!j.technicianIds || j.technicianIds.length === 0) &&
            (!j.assignments || j.assignments.length === 0))
      ).length,
    },
    { id: "assigned", label: "Assigned", count: jobs.filter((j) => j.status === "Assigned").length },
    {
      id: "in_progress",
      label: "In Progress / Active",
      count: jobs.filter((j) => j.status === "InProgress" || j.status === "Accepted").length,
    },
    { id: "paused", label: "Paused on Site", count: jobs.filter((j) => j.status === "Paused").length },
    {
      id: "completed",
      label: "Completed",
      count: jobs.filter((j) =>
        ["AwaitingFeedback", "CompletedPendingVerification", "Finalized", "Verified"].includes(j.status)
      ).length,
    },
  ];

  const activeTabsList = isAccountant
    ? accountantTabs
    : isStorekeeper
    ? storekeeperTabs
    : isDispatcher
    ? dispatcherTabs
    : adminTabs;

  return (
    <div className="space-y-4">
      {!canViewDirectory ? (
        <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#18181B]">
            Work Orders Directory Access Restricted
          </h3>
          <p className="text-xs text-[#71717A] max-w-md mx-auto">
            Permission to view the jobs directory has been toggled off for your user account or role (<code className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded">jobs.view_directory</code>). Please contact your administrator.
          </p>
        </div>
      ) : (
        <>
          {/* Role Banner / Context */}
          {isAccountant && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Finance & Accounts View:</strong> Monitor active work order costs, approve mid-job discount requests, clear technician expenses, and finalize revenue recognition.
                </span>
              </div>
              <Link
                href="/accounts"
                className="font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 ml-2"
              >
                General Ledger Ã¢â€ â€™
              </Link>
            </div>
          )}

          {isDispatcher && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-950 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  <strong>Lead Dispatcher Operational Command:</strong> Live fleet technician assignment, queue monitoring, and field lifecycle control. Financial pricing is masked.
                </span>
              </div>
              <Link
                href="/dispatch/map"
                className="font-bold text-blue-800 hover:text-blue-950 underline shrink-0 ml-2 inline-flex items-center gap-1"
              >
                <span>Live Dispatch Map &rarr;</span>
              </Link>
            </div>
          )}

          {/* Page Header (Per 04-DESIGN.md Section 1) */}
          <PageHeader
            moduleName={isStorekeeper ? "Warehouse Material Dispatch" : isAccountant ? "Jobs Financial Ledger" : "Jobs"}
            currentView={isStorekeeper ? "Active Work Orders" : isAccountant ? "Work Orders & Clearance" : "All Jobs"}
            viewVariants={activeTabsList.map((tab) => ({
              label: tab.label,
              count: tab.count,
              onClick: () => setActiveTab(tab.id),
            }))}
            primaryAction={
              canCreateJob
                ? {
                    label: "+ New Job",
                    onClick: () => {
                      window.location.href = "/jobs/new";
                    },
                  }
                : undefined
            }
            onExport={() => alert("Exporting jobs list...")}
          />

          {/* Warehouse Storekeeper vs General / Dispatcher KPI Dashboard Cards */}
          {isStorekeeper ? (
            <StorekeeperKpiDashboard
              jobs={jobs}
              activeFilter={kpiFilter}
              onFilterSelect={setKpiFilter}
            />
          ) : (
            <JobsKpiDashboard
              jobs={jobs}
              activeFilter={kpiFilter}
              onFilterSelect={setKpiFilter}
            />
          )}

          {/* Dense Data Table (Per 04-DESIGN.md Section 2) */}
          <DataTable
            data={filteredJobs}
            columns={allColumns}
            moduleName="jobs"
            tabs={activeTabsList}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchPlaceholder={
              isStorekeeper
                ? "Filter work orders by number, customer, materials..."
                : "Filter jobs by number, customer, notes..."
            }
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            filterChips={[
              {
                id: "technician",
                label: "Technician",
                options: technicians.map((t) => ({
                  label: capitalizeWords(t.name),
                  value: t.name,
                })),
                selected: selectedTechFilter,
                onSelect: setSelectedTechFilter,
              },
              {
                id: "status",
                label: "Status",
                options: [
                  { label: "Created", value: "Created" },
                  { label: "Assigned", value: "Assigned" },
                  { label: "Accepted", value: "Accepted" },
                  { label: "In Progress", value: "InProgress" },
                  { label: "Paused", value: "Paused" },
                  { label: "Pending Verification", value: "CompletedPendingVerification" },
                  { label: "Finalized", value: "Finalized" },
                  { label: "Verified", value: "Verified" },
                ],
                selected: selectedStatusFilter,
                onSelect: setSelectedStatusFilter,
              },
              {
                id: "jobType",
                label: "Job Type",
                options: Array.from(new Set(jobs.map((j) => j.jobType).filter(Boolean))).map((t) => ({
                  label: formatJobType(t),
                  value: t,
                })),
                selected: selectedTypeFilter,
                onSelect: setSelectedTypeFilter,
              },
            ]}
            renderExpandedRow={(row) => (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#52525B]">
                <div>
                  <span className="font-semibold text-[#71717A] text-[10px] uppercase block">
                    Site Address & Coordinates
                  </span>
                  <span className="text-[#18181B] font-medium">{row.customer?.addressText || "Physical site address verified on GPS"}</span>
                  <span className="text-[11px] text-[#71717A] block font-mono mt-0.5">
                    GPS Lat: 25.2048, Lng: 55.2708 (Verified geofence)
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-[#71717A] text-[10px] uppercase block">
                    {isStorekeeper ? "Materials & Stock Usage" : "Field Diagnostic Remarks"}
                  </span>
                  <span className="text-[#18181B]">{row.remarks || "No diagnostic remarks logged yet"}</span>
                  <span className="text-[11px] text-[#71717A] block mt-0.5">
                    Line Items: {row.items?.length || 0} items | Requests: {row.inventoryRequests?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-[#71717A] text-[10px] uppercase block">
                    Care-Of Party & Billing Entity
                  </span>
                  <span className="text-[#18181B]">
                    {row.careOfParty?.companyName ? `c/o ${row.careOfParty.companyName} (${row.careOfParty.partyType})` : "Direct Customer Work Order"}
                  </span>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-[#EDEDED]">
                    <span className="text-[11px] text-[#71717A]">
                      Tech: <strong className="text-[#18181B]">{row.assignedTechnician?.name || "Unassigned"}</strong>
                    </span>
                    {!isStorekeeper ? (
                      <button
                        type="button"
                        onClick={() => setReassignJob(row)}
                        className="text-[11px] font-bold text-[#0D7A5F] hover:underline"
                      >
                        {row.assignedTechnician ? "Change Tech Ã¢â€ â€™" : "+ Assign Tech Ã¢â€ â€™"}
                      </button>
                    ) : activeTab === "returnable" && canStockReturn ? (
                      <button
                        type="button"
                        onClick={() => setReturnJob(row)}
                        className="text-[11px] font-bold text-blue-700 hover:underline"
                      >
                        Record unused return
                      </button>
                    ) : (
                      <Link
                        href={`/jobs/${row.id}`}
                        className="text-[11px] font-bold text-[#0D7A5F] hover:underline"
                      >
                        Open Details & Issue Materials
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
            bulkActions={[
              {
                label: "Export Selected",
                onClick: (ids) => alert(`Exporting ${ids.length} jobs`),
              },
            ]}
            emptyMessage={
              isStorekeeper && activeTab === "returnable"
                ? "No unused or returnable stock in the queue. Completed/paused jobs with leftover materials or pending tech returns will appear here."
                : isStorekeeper && activeTab === "pending_materials"
                ? "No pending material requests. New technician inventory requests will show up here for fulfillment."
                : "There is no data to show in this view. Try adjusting filters."
            }
            onRefresh={fetchJobs}
          />

          {/* Reassign Technician Drawer */}
          <ReassignTechDrawer
            isOpen={Boolean(reassignJob)}
            onClose={() => setReassignJob(null)}
            job={reassignJob}
            technicians={technicians}
            onAssigned={fetchJobs}
          />

          <RecordStockReturnDrawer
            isOpen={Boolean(returnJob)}
            onClose={() => setReturnJob(null)}
            job={returnJob}
            storekeeperName={`${currentPersona.name} (${currentPersona.designation || "Storekeeper"})`}
            onSuccess={fetchJobs}
          />
        </>
      )}
    </div>
  );
}
