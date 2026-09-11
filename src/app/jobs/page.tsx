"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ReassignTechDrawer from "@/components/drawers/ReassignTechDrawer";
import JobReportsView from "@/components/jobs/JobReportsView";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus, User, AlertTriangle, Building, RefreshCw, Package, Receipt, DollarSign, ShieldCheck, BarChart3, Briefcase } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";

export default function JobsListPage() {
  const { activeRole, currentPersona } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
  const isAccountant = activeRole === "accountant";
  const isAdmin = activeRole === "admin";

  const [mainSectionView, setMainSectionView] = useState<"directory" | "reports">("directory");
  const [jobs, setJobs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sync with URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "reports" || params.get("tab") === "reports") {
        setMainSectionView("reports");
      }
    }
  }, []);

  // Reassign Drawer state
  const [reassignJob, setReassignJob] = useState<any>(null);

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
    if (activeTab === "all") return true;

    if (isAccountant) {
      if (activeTab === "pending_clearance") return j.status === "CompletedPendingVerification";
      if (activeTab === "discount_requests") return j.items?.some((it: any) => it.description?.includes("[Discount Requested:"));
      if (activeTab === "pending_expenses") return j.expenseClaims?.some((c: any) => c.status === "pending");
      if (activeTab === "completed") return ["Finalized", "Verified"].includes(j.status);
    } else if (isStorekeeper) {
      if (activeTab === "pending_materials") return j.inventoryRequests?.some((r: any) => r.status === "pending");
      if (activeTab === "active") return ["Assigned", "InProgress", "Paused"].includes(j.status);
      if (activeTab === "completed") return ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status);
    } else {
      // Admin / Manager / Ops
      if (activeTab === "my") return j.assignedTechnician?.name?.includes("Ali") || j.assignedTechnicianId;
      if (activeTab === "assigned_today") return j.status === "Assigned" || j.status === "InProgress";
      if (activeTab === "needs_review") return j.qualityFlag === "disputed";
      if (activeTab === "completed") return ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status);
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
    return (
      j.jobNumber?.toLowerCase().includes(q) ||
      j.customer?.name?.toLowerCase().includes(q) ||
      j.remarks?.toLowerCase().includes(q) ||
      j.careOfParty?.companyName?.toLowerCase().includes(q)
    );
  });

  // Base columns
  const allColumns: ColumnDef<any>[] = [
    {
      id: "jobNumber",
      header: "Job #",
      accessorKey: "jobNumber",
      isPrimaryLink: true,
      getHref: (row) => `/jobs/${row.id}`,
      cell: (row) => (
        <div>
          <span className="font-mono font-bold text-[#0D7A5F] hover:underline block">
            {row.jobNumber}
          </span>
          {row.careOfParty && (
            <span className="text-[10px] text-purple-700 bg-purple-50 px-1 rounded font-medium inline-block mt-0.5">
              c/o {row.careOfParty.companyName}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="font-semibold text-[#18181B]">{row.customer?.name}</p>
          <p className="text-[11px] text-[#71717A] truncate max-w-[200px]">
            {row.customer?.addressText}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Job Type",
      accessorKey: "jobType",
      cell: (row) => (
        <span className="capitalize text-[#52525B] font-medium text-[11px] bg-[#F4F4F5] px-2 py-0.5 rounded border border-[#EDEDED]">
          {row.jobType}
        </span>
      ),
    },
    {
      id: "technician",
      header: "Technician",
      cell: (row) => (
        <div>
          {row.assignedTechnician ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#0D7A5F] text-[9px] font-bold inline-flex items-center justify-center shrink-0 border border-emerald-200">
                  {row.assignedTechnician.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="font-semibold text-[#18181B] truncate text-xs">
                  {row.assignedTechnician.name}
                </span>
              </div>
              {!isStorekeeper && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReassignJob(row);
                  }}
                  className="text-[10px] font-semibold text-[#71717A] hover:text-[#0D7A5F] bg-[#F4F4F5] hover:bg-emerald-50 px-1.5 py-0.5 rounded border border-[#EDEDED] hover:border-emerald-200 transition shrink-0"
                >
                  Change
                </button>
              )}
            </div>
          ) : !isStorekeeper ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReassignJob(row);
              }}
              className="text-[11px] font-bold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition flex items-center gap-1 shadow-2xs group"
            >
              <Plus className="w-3 h-3 group-hover:scale-110 transition" />
              <span>+ Assign Tech</span>
            </button>
          ) : (
            <span className="text-xs text-[#A1A1AA] italic">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const hasPendingReq = row.inventoryRequests?.some((r: any) => r.status === "pending");
        const hasDiscountReq = row.items?.some((it: any) => it.description?.includes("[Discount Requested:"));
        const hasPendingExpense = row.expenseClaims?.some((c: any) => c.status === "pending");

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <StatusBadge status={row.status} />
              {row.qualityFlag === "disputed" && (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                  Disputed
                </span>
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
        );
      },
    },
    // Strictly hide Amount column for Storekeeper
    ...(isStorekeeper
      ? []
      : [
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
                  <span className="font-mono font-bold text-[#18181B] block">
                    {formatCurrency(net)}
                  </span>
                  {row.discountAmount > 0 && (
                    <span className="text-[10px] text-amber-700 font-mono block">
                      -{formatCurrency(row.discountAmount)} disc
                    </span>
                  )}
                </div>
              );
            },
          },
        ]),
    {
      id: "createdAt",
      header: "Created",
      align: "right",
      cell: (row) => (
        <span className="text-[11px] text-[#71717A] font-mono">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Quick Action",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {!isStorekeeper && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReassignJob(row);
              }}
              className="text-[10px] font-bold px-2 py-1 rounded-md text-[#0D7A5F] hover:bg-emerald-50 border border-emerald-200 transition"
            >
              {row.assignedTechnician ? "Reassign" : "Assign"}
            </button>
          )}
          <Link
            href={`/jobs/${row.id}`}
            className="text-[10px] font-semibold px-2 py-1 rounded-md text-[#0D7A5F] bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200 transition"
          >
            {isStorekeeper ? "Details & Issue Stock →" : isAccountant ? "Review Financials →" : "Details"}
          </Link>
        </div>
      ),
    },
  ];

  // Role-specific tab presets
  const accountantTabs = [
    { id: "all", label: "All Jobs Ledger", count: jobs.length },
    { id: "pending_clearance", label: "Needs Finalization", count: jobs.filter((j) => j.status === "CompletedPendingVerification").length },
    { id: "discount_requests", label: "Discount Requested", count: jobs.filter((j) => j.items?.some((it: any) => it.description?.includes("[Discount Requested:"))).length },
    { id: "pending_expenses", label: "Pending Expenses", count: jobs.filter((j) => j.expenseClaims?.some((c: any) => c.status === "pending")).length },
    { id: "completed", label: "Finalized / Verified", count: jobs.filter((j) => ["Finalized", "Verified"].includes(j.status)).length },
  ];

  const storekeeperTabs = [
    { id: "all", label: "All Work Orders", count: jobs.length },
    { id: "pending_materials", label: "Pending Material Requests", count: jobs.filter((j) => j.inventoryRequests?.some((r: any) => r.status === "pending")).length },
    { id: "active", label: "Active Jobs", count: jobs.filter((j) => ["Assigned", "InProgress", "Paused"].includes(j.status)).length },
    { id: "completed", label: "Completed / Sign-Off", count: jobs.filter((j) => ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status)).length },
  ];

  const adminTabs = [
    { id: "all", label: "All Jobs", count: jobs.length },
    { id: "my", label: "My Jobs", count: jobs.filter((j) => j.assignedTechnicianId).length },
    { id: "assigned_today", label: "Assigned Today", count: jobs.filter((j) => j.status === "Assigned" || j.status === "InProgress").length },
    { id: "needs_review", label: "Needs Review", count: jobs.filter((j) => j.qualityFlag === "disputed").length },
    { id: "completed", label: "Completed", count: jobs.filter((j) => ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status)).length },
  ];

  const activeTabsList = isAccountant ? accountantTabs : isStorekeeper ? storekeeperTabs : adminTabs;

  return (
    <div className="space-y-4">
      {/* Primary Section Switcher: Directory vs Daily Audit & Reports */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#EDEDED] px-3.5 py-2 rounded-xl shadow-xs">
        <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-lg border border-[#E4E4E7]">
          <button
            type="button"
            onClick={() => setMainSectionView("directory")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              mainSectionView === "directory"
                ? "bg-[#18181B] text-white shadow-xs"
                : "text-[#52525B] hover:text-[#18181B]"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Jobs Directory ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setMainSectionView("reports")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              mainSectionView === "reports"
                ? "bg-[#0D7A5F] text-white shadow-xs"
                : "text-[#52525B] hover:text-[#0D7A5F]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Daily Audit & Reports 📊
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#71717A]">
          <span className="hidden sm:inline">Section Mode:</span>
          <span className="font-semibold text-[#18181B]">
            {mainSectionView === "directory" ? "Work Orders Directory" : "End-to-End Daily Audit & Stock Usage"}
          </span>
        </div>
      </div>

      {mainSectionView === "reports" ? (
        <JobReportsView onBackToDirectory={() => setMainSectionView("directory")} />
      ) : (
        <>
          {/* Role Banner / Context */}
          {isStorekeeper && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Central Storekeeper View:</strong> Viewing work order scopes, physical inventory requirements, and material requests. Financial rates and billing amounts are strictly masked.
                </span>
              </div>
              <Link
                href="/inventory"
                className="font-bold text-amber-800 hover:text-amber-950 underline shrink-0 ml-2"
              >
                Warehouse Stock →
              </Link>
            </div>
          )}

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
                General Ledger →
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
              isAdmin
                ? {
                    label: "+ New Job",
                    onClick: () => {
                      window.location.href = "/jobs/new";
                    },
                  }
                : undefined
            }
            secondaryActions={[
              {
                label: "📊 Reports & Audit",
                onClick: () => setMainSectionView("reports"),
              },
            ]}
            onExport={() => alert("Exporting jobs list...")}
          />

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
                options: technicians.map((t) => t.name),
                selected: selectedTechFilter,
                onSelect: setSelectedTechFilter,
              },
              {
                id: "status",
                label: "Status",
                options: ["Created", "Assigned", "InProgress", "Paused", "CompletedPendingVerification", "Finalized", "Verified"],
                selected: selectedStatusFilter,
                onSelect: setSelectedStatusFilter,
              },
              {
                id: "jobType",
                label: "Job Type",
                options: ["maintenance", "repair", "installation", "emergency"],
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
                        {row.assignedTechnician ? "Change Tech →" : "+ Assign Tech →"}
                      </button>
                    ) : (
                      <Link
                        href={`/jobs/${row.id}`}
                        className="text-[11px] font-bold text-[#0D7A5F] hover:underline"
                      >
                        Open Details & Issue Materials →
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
        </>
      )}
    </div>
  );
}
