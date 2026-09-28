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
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import PageHeader from "@/components/layout/PageHeader";
import { formatDateTime, cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const fetchParties = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/care-of-parties");
      if (!res.ok) throw new Error("Failed to load care-of parties");
      const data = await res.json();
      if (Array.isArray(data.careOfParties)) {
        setParties(data.careOfParties);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  const openAddModal = () => {
    setEditingParty(null);
    setFormCompany("");
    setFormPerson("");
    setFormPhone("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (party: CareOfPartyItem) => {
    setEditingParty(party);
    setFormCompany(party.companyName);
    setFormPerson(party.personName || "");
    setFormPhone(party.phone || "");
    setFormError("");
    setIsModalOpen(true);
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

      setIsModalOpen(false);
      setSuccessToast(
        editingParty
          ? `Updated "${formCompany.trim()}" successfully`
          : `Added "${formCompany.trim()}" to care-of directory`
      );
      setTimeout(() => setSuccessToast(""), 4000);
      fetchParties();
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
      fetchParties();
    } catch (err: any) {
      alert(err.message || "Failed to delete.");
    } finally {
      setIsDeleting(false);
    }
  };

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

  const totalJobsCount = parties.reduce((sum, p) => sum + (p.jobsCount || 0), 0);

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
        currentView="Care-Of Parties"
        primaryAction={{
          label: "+ Add Care-Of Party",
          onClick: openAddModal,
        }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-xl border border-[#EDEDED] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              Care-Of Organizations
            </p>
            <p className="text-2xl font-mono font-bold text-[#18181B] mt-1">
              {parties.length}
            </p>
            <p className="text-[11px] text-[#A1A1AA] mt-0.5">
              Saved 3rd-party contractors
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
            <Building className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#EDEDED] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              Subcontracted Work Orders
            </p>
            <p className="text-2xl font-mono font-bold text-[#0D7A5F] mt-1">
              {totalJobsCount}
            </p>
            <p className="text-[11px] text-[#A1A1AA] mt-0.5">
              Historical jobs billed/dispatched
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0D7A5F] flex items-center justify-center border border-emerald-200">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#EDEDED] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              Fast Intake Autocomplete
            </p>
            <p className="text-sm font-bold text-[#18181B] mt-1">
              Active in Job Intake
            </p>
            <p className="text-[11px] text-[#A1A1AA] mt-0.5">
              Auto-fills company & contact person
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-[#EDEDED] flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company name, contact person, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F4F4F5] text-xs pl-9 pr-3 py-2 rounded-lg border border-transparent focus:border-[#0D7A5F] focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/jobs/new"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] border border-emerald-200 transition inline-flex items-center gap-1.5"
            >
              <span>+ New Job</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Directory Table */}
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
                      {searchQuery ? "No matching Care-Of parties found" : "No Care-Of parties registered yet"}
                    </p>
                    <p className="text-xs text-[#A1A1AA] mt-1">
                      {searchQuery
                        ? "Try clearing your search query or check spelling."
                        : "Add your subcontracted or 3rd-party organizations here to auto-fill them during job intake."}
                    </p>
                    {!searchQuery && (
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] text-white transition inline-flex items-center gap-1.5"
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
                          onClick={() => openEditModal(party)}
                          className="p-1.5 rounded-md hover:bg-white text-[#52525B] hover:text-[#18181B] border border-transparent hover:border-[#EDEDED] transition shadow-2xs"
                          title="Edit organization"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingParty(party)}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-[#71717A] hover:text-rose-600 border border-transparent hover:border-rose-200 transition shadow-2xs"
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

      {/* Modal: Add or Edit Care-Of Party */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-[#EDEDED] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#18181B]">
                    {editingParty ? "Edit Care-Of Party" : "New Care-Of Party"}
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    {editingParty
                      ? "Update subcontracted partner details"
                      : "Register an organization for auto-complete in job intake"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Facilities Group"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#18181B] mb-1">
                  Authorized Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engr. Usman Khan"
                  value={formPerson}
                  onChange={(e) => setFormPerson(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#18181B] mb-1">
                  Phone / Mobile Contact Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +92 300 1234567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-[#EDEDED] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-semibold px-4 py-2 rounded-lg text-[#52525B] hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] text-white transition shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {submitting && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingParty ? "Save Changes" : "Create Organization"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                className="w-1/2 text-xs font-semibold py-2 rounded-lg text-[#52525B] hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-1/2 text-xs font-semibold py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
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
