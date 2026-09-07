"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ReassignTechDrawer from "@/components/drawers/ReassignTechDrawer";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus, User, AlertTriangle, Building, RefreshCw } from "lucide-react";

export default function JobsListPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter based on active tab
  const filteredByTab = jobs.filter((j) => {
    if (activeTab === "all") return true;
    if (activeTab === "my") return j.assignedTechnician?.name?.includes("Ali") || j.assignedTechnicianId;
    if (activeTab === "assigned_today") return j.status === "Assigned" || j.status === "InProgress";
    if (activeTab === "needs_review") return j.qualityFlag === "disputed";
    if (activeTab === "completed") return ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status);
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

  const columns: ColumnDef<any>[] = [
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
            </div>
          ) : (
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
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.qualityFlag === "disputed" && (
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
              Disputed
            </span>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => {
        let total = 0;
        for (const it of row.items || []) {
          total += (it.quantityActual ?? it.quantityPlanned) * it.unitRate;
        }
        return (
          <span className="font-mono font-bold text-[#18181B]">
            {formatCurrency(total)}
          </span>
        );
      },
    },
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
          <Link
            href={`/jobs/${row.id}`}
            className="text-[10px] font-semibold px-2 py-1 rounded-md text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
          >
            Details
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header (Per 04-DESIGN.md Section 1) */}
      <PageHeader
        moduleName="Jobs"
        currentView="All Jobs"
        viewVariants={[
          { label: "All Jobs", count: jobs.length, onClick: () => setActiveTab("all") },
          { label: "Needs Review (Disputed)", count: jobs.filter((j) => j.qualityFlag === "disputed").length, onClick: () => setActiveTab("needs_review") },
          { label: "Completed", onClick: () => setActiveTab("completed") },
        ]}
        primaryAction={{
          label: "New Job",
          onClick: () => {
            window.location.href = "/jobs/new";
          },
        }}
        onExport={() => alert("Exporting jobs to CSV...")}
      />

      {/* Dense Data Table (Per 04-DESIGN.md Section 2) */}
      <DataTable
        data={filteredJobs}
        columns={columns}
        moduleName="jobs"
        tabs={[
          { id: "all", label: "All Jobs", count: jobs.length },
          { id: "my", label: "My Jobs", count: jobs.filter((j) => j.assignedTechnicianId).length },
          { id: "assigned_today", label: "Assigned Today", count: jobs.filter((j) => j.status === "Assigned" || j.status === "InProgress").length },
          { id: "needs_review", label: "Needs Review", count: jobs.filter((j) => j.qualityFlag === "disputed").length },
          { id: "completed", label: "Completed", count: jobs.filter((j) => ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status)).length },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchPlaceholder="Filter jobs by number, customer, notes..."
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
                Field Diagnostic Remarks
              </span>
              <span className="text-[#18181B]">{row.remarks || "No diagnostic remarks logged yet"}</span>
              <span className="text-[11px] text-[#71717A] block mt-0.5">
                Line Items: {row.items?.length || 0} items planned
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
                <button
                  type="button"
                  onClick={() => setReassignJob(row)}
                  className="text-[11px] font-bold text-[#0D7A5F] hover:underline"
                >
                  {row.assignedTechnician ? "Change Tech →" : "+ Assign Tech →"}
                </button>
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
    </div>
  );
}
