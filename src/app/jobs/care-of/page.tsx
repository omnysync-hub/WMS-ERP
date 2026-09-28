"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Building,
  User,
  Phone,
  Plus,
  Search,
  Briefcase,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import PageHeader from "@/components/layout/PageHeader";
import SideDrawer from "@/components/ui/SideDrawer";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDateTime, formatCurrency, cn } from "@/lib/utils";

interface CareOfPartyItem {
  id: string;
  companyName: string;
  personName: string;
  phone?: string | null;
  jobsCount: number;
  createdAt: string;
}

export default function CareOfSettingsPage() {
  const { activeRole, hasPermission } = useRole();
  const [parties, setParties] = useState<CareOfPartyItem[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"reporting" | "directory">("reporting");

  // Drawer State for Add / Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<CareOfPartyItem | null>(null);
  const [formCompany, setFormCompany] = useState("");
  const [formPerson, setFormPerson] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Delete Confirm State
  const [deletingParty, setDeletingParty] = useState<CareOfPartyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [partiesRes, jobsRes] = await Promise.all([
        fetch("/api/care-of-parties"),
        fetch("/api/jobs"),
      ]);

      if (partiesRes.ok) {
        const partiesData = await partiesRes.json();
        if (Array.isArray(partiesData.careOfParties)) {
          setParties(partiesData.careOfParties);
        }
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        if (Array.isArray(jobsData)) {
          setJobs(jobsData);
        }
      }
    } catch (err: any) {
      console.error("Failed fetching data in care-of page:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddDrawer = () => {
    setEditingParty(null);
    setFormCompany("");
    setFormPerson("");
    setFormPhone("");
    setFormError("");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (party: CareOfPartyItem) => {
    setEditingParty(party);
    setFormCompany(party.companyName);
    setFormPerson(party.personName || "");
    setFormPhone(party.phone || "");
    setFormError("");
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim()) {
      setFormError("Company name is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const url = editingParty
        ? `/api/care-of-parties/${editingParty.id}`
        : "/api/care-of-parties";
      const method = editingParty ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formCompany.trim(),
          personName: formPerson.trim(),
          phone: formPhone.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save care-of party");

      setIsDrawerOpen(false);
      setSuccessToast(
        editingParty
          ? `Updated "${formCompany.trim()}" successfully`
          : `Added "${formCompany.trim()}" to care-of directory`
      );
      setTimeout(() => setSuccessToast(""), 4000);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingParty) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/care-of-parties/${deletingParty.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete care-of party");
      setSuccessToast(`Deleted "${deletingParty.companyName}"`);
      setTimeout(() => setSuccessToast(""), 4000);
      setDeletingParty(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Only jobs that have a Care-Of Party linked or careOfPartyId assigned
  const careOfJobs = useMemo(() => {
    return jobs.filter((j) => Boolean(j.careOfParty || j.careOfPartyId));
  }, [jobs]);

  // Grouped Care-Of reporting analytics
  const careOfGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        partyName: string;
        contactPerson?: string;
        phone?: string;
        partyId?: string;
        jobs: any[];
        totalBilled: number;
        totalCollected: number;
        doneCount: number;
      }
    > = {};

    for (const j of careOfJobs) {
      const key = j.careOfParty?.companyName || "Direct / Independent Customer";
      if (!groups[key]) {
        groups[key] = {
          partyName: key,
          contactPerson: j.careOfParty?.personName,
          phone: j.careOfParty?.phone,
          partyId: j.careOfParty?.id,
          jobs: [],
          totalBilled: 0,
          totalCollected: 0,
          doneCount: 0,
        };
      }
      groups[key].jobs.push(j);

      // Financials: compute invoiced amount from items
      let netBilled = 0;
      if (j.financials?.netBilled !== undefined) {
        netBilled = j.financials.netBilled;
      } else {
        let itemsTotal = 0;
        for (const it of j.items || []) {
          itemsTotal +=
            (it.quantityActual ?? it.quantityPlanned ?? 1) * (it.unitRate || 0);
        }
        netBilled = Math.max(0, itemsTotal - (j.discountAmount || 0));
      }

      const collected = j.financials?.collected ?? 0;

      groups[key].totalBilled += netBilled;
      groups[key].totalCollected += collected;

      if (
        [
          "CompletedPendingVerification",
          "Finalized",
          "Verified",
          "AwaitingFeedback",
        ].includes(j.status)
      ) {
        groups[key].doneCount++;
      }
    }

    return Object.values(groups);
  }, [careOfJobs]);

  // Filtered Care-Of Groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return careOfGroups;
    const q = searchQuery.toLowerCase();
    return careOfGroups
      .map((grp) => ({
        ...grp,
        jobs: grp.jobs.filter(
          (j) =>
            grp.partyName.toLowerCase().includes(q) ||
            grp.contactPerson?.toLowerCase().includes(q) ||
            j.jobNumber?.toLowerCase().includes(q) ||
            j.manualJobNumber?.toLowerCase().includes(q) ||
            j.customer?.name?.toLowerCase().includes(q) ||
            j.assignedTechnician?.name?.toLowerCase().includes(q)
        ),
      }))
      .filter((grp) => grp.partyName.toLowerCase().includes(q) || grp.jobs.length > 0);
  }, [careOfGroups, searchQuery]);

  // Filtered directory parties
  const filteredParties = useMemo(() => {
    if (!searchQuery.trim()) return parties;
    const q = searchQuery.toLowerCase();
    return parties.filter(
      (p) =>
        p.companyName.toLowerCase().includes(q) ||
        p.personName?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
    );
  }, [parties, searchQuery]);

  // Grand totals across all care-of jobs
  const grandTotalInvoiced = careOfGroups.reduce((acc, g) => acc + g.totalBilled, 0);
  const grandTotalCollected = careOfGroups.reduce((acc, g) => acc + g.totalCollected, 0);
  const grandBalanceDue = Math.max(0, grandTotalInvoiced - grandTotalCollected);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-emerald-700 animate-in fade-in slide-in-from-top-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        moduleName="Jobs Settings"
        currentView="Care-Of Management"
        primaryAction={{
          label: "+ Add Care-Of Party",
          onClick: openAddDrawer,
        }}
      />

      {/* KPI Cards: High-Level Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-[#EDEDED] p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Care-Of Organizations
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-[#18181B] mt-1">
              {parties.length}
            </p>
            <p className="text-[10px] text-[#A1A1AA] mt-0.5">
              Saved 3rd-party partners
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
            <Building className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#EDEDED] p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Subcontracted Work Orders
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-[#0D7A5F] mt-1">
              {careOfJobs.length}
            </p>
            <p className="text-[10px] text-[#A1A1AA] mt-0.5">
              Active affiliate orders
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0D7A5F] flex items-center justify-center border border-emerald-200 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#EDEDED] p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Total Invoiced
            </p>
            <p className="text-lg sm:text-xl font-mono font-bold text-[#18181B] mt-1">
              {formatCurrency(grandTotalInvoiced)}
            </p>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
              {formatCurrency(grandTotalCollected)} collected
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#EDEDED] p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
              Balance Due / Receivable
            </p>
            <p
              className={cn(
                "text-lg sm:text-xl font-mono font-bold mt-1",
                grandBalanceDue > 0 ? "text-rose-700" : "text-[#18181B]"
              )}
            >
              {formatCurrency(grandBalanceDue)}
            </p>
            <p className="text-[10px] text-[#71717A] mt-0.5">
              Pending affiliate settlement
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs overflow-hidden space-y-0">
        {/* Navigation Tabs Bar */}
        <div className="px-4 pt-3 border-b border-[#EDEDED] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("reporting")}
              className={cn(
                "pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer",
                activeTab === "reporting"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Care-Of Parties Reporting</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-normal">
                {careOfGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("directory")}
              className={cn(
                "pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer",
                activeTab === "directory"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Organizations Directory</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 font-normal">
                {parties.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="pb-2.5 flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === "reporting"
                    ? "Filter affiliate work orders, tech, customer..."
                    : "Search organizations, contact person, phone..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#F4F4F5] border border-transparent focus:border-[#0D7A5F] focus:bg-white rounded-lg text-xs text-[#18181B] focus:outline-hidden w-64 sm:w-72 transition"
              />
            </div>
            {activeTab === "directory" && (
              <button
                type="button"
                onClick={openAddDrawer}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] text-white transition inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Party</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: Care-Of Parties Reporting (Full Breakdown by Affiliate)            */}
        {/* ========================================================================= */}
        {activeTab === "reporting" && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Informational Banner */}
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-700 shrink-0" />
                <span>
                  <strong>Care-Of Parties & Subcontractor Reporting:</strong> Dedicated breakdown of work orders, customer accounts, and billings grouped by Care-Of affiliate.
                </span>
              </div>
              <span className="font-mono font-bold text-purple-900 text-xs shrink-0">
                {filteredGroups.length} Entity Group{filteredGroups.length === 1 ? "" : "s"}
              </span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-xs text-[#71717A]">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
                  <span>Loading Care-Of affiliate reporting...</span>
                </div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A] bg-[#FAFAFA] rounded-xl border border-dashed border-[#D4D4D8]">
                <Building className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2" />
                <p className="font-semibold text-sm text-[#18181B]">
                  {searchQuery
                    ? "No matching Care-Of work orders found"
                    : "No Care-Of party jobs recorded yet"}
                </p>
                <p className="text-xs text-[#A1A1AA] mt-1 max-w-sm mx-auto">
                  When creating work orders with the Care-Of toggle enabled, they will be automatically aggregated and reported here.
                </p>
                <Link
                  href="/jobs/new"
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Subcontracted Job</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((grp, gIdx) => {
                  const balanceDue = Math.max(0, grp.totalBilled - grp.totalCollected);
                  const completionPercent =
                    grp.jobs.length > 0
                      ? Math.round((grp.doneCount / grp.jobs.length) * 100)
                      : 0;

                  return (
                    <div
                      key={gIdx}
                      className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-2xs"
                    >
                      {/* Affiliate Card Header */}
                      <div className="p-4 bg-white border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#18181B]">
                              {grp.partyName}
                            </span>
                            {grp.contactPerson && (
                              <span className="text-xs text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full border border-[#E4E4E7] inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-[#71717A]" />
                                Contact: {grp.contactPerson}
                              </span>
                            )}
                            {grp.phone && (
                              <span className="text-xs text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full border border-[#E4E4E7] font-mono inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#71717A]" />
                                {grp.phone}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#71717A] mt-1">
                            {grp.jobs.length} total work order{grp.jobs.length === 1 ? "" : "s"} • {grp.doneCount} completed ({completionPercent}%)
                          </p>
                        </div>

                        {/* Financial Metrics Badges */}
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-[#71717A] block">
                              Total Invoiced:
                            </span>
                            <span className="font-bold text-[#18181B]">
                              {formatCurrency(grp.totalBilled)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 block">
                              Collected:
                            </span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(grp.totalCollected)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-700 block">
                              Balance Due:
                            </span>
                            <span
                              className={cn(
                                "font-bold",
                                balanceDue > 0 ? "text-rose-700" : "text-[#71717A]"
                              )}
                            >
                              {formatCurrency(balanceDue)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Work Orders Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#F4F4F5] text-[#71717A] font-semibold border-b border-[#E4E4E7] text-[11px]">
                              <th className="py-2.5 px-4">Job # & Ext Ref</th>
                              <th className="py-2.5 px-4">Customer</th>
                              <th className="py-2.5 px-4">Technician</th>
                              <th className="py-2.5 px-4 text-center">Status</th>
                              <th className="py-2.5 px-4 text-right">Invoiced</th>
                              <th className="py-2.5 px-4 text-right">Collected</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E4E7] bg-white">
                            {grp.jobs.map((j: any) => {
                              let rowBilled = 0;
                              if (j.financials?.netBilled !== undefined) {
                                rowBilled = j.financials.netBilled;
                              } else {
                                let total = 0;
                                for (const it of j.items || []) {
                                  total +=
                                    (it.quantityActual ?? it.quantityPlanned ?? 1) *
                                    (it.unitRate || 0);
                                }
                                rowBilled = Math.max(0, total - (j.discountAmount || 0));
                              }
                              const rowCollected = j.financials?.collected ?? 0;

                              return (
                                <tr
                                  key={j.id}
                                  className="hover:bg-[#FAFAFA] transition-colors"
                                >
                                  <td className="py-2.5 px-4 font-mono font-bold text-[#0D7A5F]">
                                    <Link
                                      href={`/jobs/${j.id}`}
                                      className="hover:underline inline-flex items-center gap-1"
                                    >
                                      <span>{j.jobNumber}</span>
                                    </Link>
                                    {j.manualJobNumber && (
                                      <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded ml-1.5 font-normal">
                                        Ext: #{j.manualJobNumber}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <span className="font-semibold text-[#18181B] block">
                                      {j.customer?.name}
                                    </span>
                                    <span className="text-[10px] text-[#71717A] truncate block max-w-xs">
                                      {j.customer?.addressText}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-[#52525B]">
                                    {j.assignedTechnician?.name || (
                                      <span className="text-[#A1A1AA] italic">
                                        Unassigned
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <StatusBadge status={j.status} />
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                                    {formatCurrency(rowBilled)}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                                    {formatCurrency(rowCollected)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: Organizations Directory (Manage / Edit / Delete Saved Partners)   */}
        {/* ========================================================================= */}
        {activeTab === "directory" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#EDEDED] text-[#71717A] uppercase text-[10px] tracking-wider font-semibold select-none">
                  <tr>
                    <th className="py-3 px-4">Care-Of Organization</th>
                    <th className="py-3 px-4">Primary Contact Person</th>
                    <th className="py-3 px-4">Phone / Mobile</th>
                    <th className="py-3 px-4 text-center">Linked Jobs</th>
                    <th className="py-3 px-4 text-right">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#71717A]">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
                          <span>Loading Care-Of parties directory...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredParties.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#71717A]">
                        <Building className="w-8 h-8 text-[#D4D4D8] mx-auto mb-2" />
                        <p className="font-semibold text-sm text-[#18181B]">
                          {searchQuery
                            ? "No matching Care-Of parties found"
                            : "No Care-Of parties registered yet"}
                        </p>
                        <p className="text-xs text-[#A1A1AA] mt-1">
                          {searchQuery
                            ? "Try clearing your search query or check spelling."
                            : "Add your subcontracted or 3rd-party organizations here to auto-fill them during job intake."}
                        </p>
                        {!searchQuery && (
                          <button
                            type="button"
                            onClick={openAddDrawer}
                            className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] text-white transition inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First Care-Of Party</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredParties.map((party) => (
                      <tr
                        key={party.id}
                        className="hover:bg-[#F4F4F5]/60 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                              <Building className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-semibold text-[#18181B] block group-hover:text-[#0D7A5F] transition-colors">
                                {party.companyName}
                              </span>
                              <span className="text-[10px] text-[#A1A1AA] font-mono">
                                ID: {party.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {party.personName ? (
                            <div className="flex items-center gap-1.5 text-[#3F3F46]">
                              <User className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                              <span className="font-medium">{party.personName}</span>
                            </div>
                          ) : (
                            <span className="text-[#A1A1AA] italic text-[11px]">
                              Not assigned
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {party.phone ? (
                            <div className="flex items-center gap-1.5 text-[#3F3F46] font-mono text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                              <span>{party.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[#A1A1AA] italic text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full font-mono font-bold text-[11px] inline-flex items-center gap-1",
                              party.jobsCount > 0
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                            )}
                          >
                            <Briefcase className="w-3 h-3" />
                            {party.jobsCount} {party.jobsCount === 1 ? "Job" : "Jobs"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right text-[11px] text-[#71717A] font-mono">
                          {formatDateTime(party.createdAt)}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(party)}
                              className="p-1.5 rounded-md hover:bg-white text-[#52525B] hover:text-[#18181B] border border-transparent hover:border-[#EDEDED] transition shadow-2xs cursor-pointer"
                              title="Edit organization"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingParty(party)}
                              className="p-1.5 rounded-md hover:bg-rose-50 text-[#71717A] hover:text-rose-600 border border-transparent hover:border-rose-200 transition shadow-2xs cursor-pointer"
                              title="Delete organization"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Side Drawer: Add or Edit Care-Of Party */}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        width="max-w-md"
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">
                {editingParty ? "Edit Care-Of Party" : "New Care-Of Party"}
              </h3>
              <p className="text-[11px] text-[#71717A] font-normal">
                {editingParty
                  ? "Update subcontracted partner details"
                  : "Register an organization for auto-complete in job intake"}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="text-xs font-semibold px-4 py-2 rounded-lg text-[#52525B] hover:bg-[#F4F4F5] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] text-white transition shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{editingParty ? "Save Changes" : "Create Organization"}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Care-Of Company Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="e.g. Apex Facilities Group"
                value={formCompany}
                onChange={(e) => setFormCompany(e.target.value)}
                className="w-full text-xs pl-8.5 pr-3 py-2.5 bg-white rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Authorized Contact Person
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Engr. Usman Khan"
                value={formPerson}
                onChange={(e) => setFormPerson(e.target.value)}
                className="w-full text-xs pl-8.5 pr-3 py-2.5 bg-white rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Phone / Mobile Contact Number
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. +92 300 1234567"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full text-xs pl-8.5 pr-3 py-2.5 bg-white rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl text-[11px] text-[#71717A] space-y-1 mt-4">
            <p className="font-semibold text-purple-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Automatic Intake Sync</span>
            </p>
            <p>
              Once saved, this partner will immediately appear in the searchable autocomplete dropdown on the New Job intake screen.
            </p>
          </div>
        </form>
      </SideDrawer>

      {/* Delete Confirmation Modal */}
      {deletingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-xl w-full max-w-sm overflow-hidden p-5 space-y-4 animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-[#18181B]">
                Delete "{deletingParty.companyName}"?
              </h3>
              <p className="text-xs text-[#71717A]">
                {deletingParty.jobsCount > 0
                  ? `Warning: This organization is linked to ${deletingParty.jobsCount} work order(s). Deleting it will unlink it from those jobs.`
                  : "This Care-Of party will be permanently removed from your directory."}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingParty(null)}
                className="w-1/2 text-xs font-semibold py-2 rounded-lg text-[#52525B] hover:bg-[#F4F4F5] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-1/2 text-xs font-semibold py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs disabled:opacity-60 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting && (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
