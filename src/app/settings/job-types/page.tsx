"use client";
import { pushSharedSetting } from "@/lib/sharedSettings";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  X,
  ArrowLeft,
  Info,
  Search,
  ChevronDown,
  ChevronUp,
  Cpu,
  Tag,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const DEFAULT_JOB_TYPES = [
  "Installation & Commissioning",
  "Emergency Repair & Breakdown",
  "Preventive Maintenance Service",
  "AC Gas Recharge & Leakage Repair",
  "Duct Cleaning & Sanitization",
  "Compressor Overhaul & Replacement",
  "System Inspection & Thermostat Audit",
  "Annual Maintenance Contract (AMC)",
];

export default function JobTypesSettingsPage() {
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);
  const [newJobType, setNewJobType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Live preview state
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewSelected, setPreviewSelected] = useState(DEFAULT_JOB_TYPES[0]);
  const [previewSearch, setPreviewSearch] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("custom_job_types");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setJobTypes(parsed);
          setPreviewSelected(parsed[0]);
        }
      }
    } catch (e) {
      console.error("Failed loading job types settings", e);
    }
  }, []);

  // Listen for storage changes across tabs or windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      try {
        const saved = localStorage.getItem("custom_job_types");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setJobTypes(parsed);
          }
        }
      } catch (err) {
        console.error("Failed syncing job types", err);
      }
    };

    window.addEventListener("storage", handleStorageChange as EventListener);
    window.addEventListener("custom_job_types_updated", handleStorageChange as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorageChange as EventListener);
      window.removeEventListener("custom_job_types_updated", handleStorageChange as EventListener);
    };
  }, []);

  const persistJobTypes = (next: string[], actionNotice: string) => {
    try {
      localStorage.setItem("custom_job_types", JSON.stringify(next));
      pushSharedSetting("custom_job_types", next).catch((err) => setErrorMessage(err.message));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("custom_job_types_updated", { detail: next }));
      setJobTypes(next);
      setSavedNotice(actionNotice);
      setErrorMessage("");
      setTimeout(() => setSavedNotice(""), 3500);

      // If currently selected preview item was deleted, pick the first
      if (!next.includes(previewSelected) && next.length > 0) {
        setPreviewSelected(next[0]);
      }
    } catch (e) {
      console.error("Failed persisting job types", e);
      setErrorMessage("Could not save to browser storage.");
    }
  };

  const handleAddJobType = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newJobType.trim();
    if (!trimmed) return;

    if (jobTypes.some((jt) => jt.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`"${trimmed}" already exists in the dropdown options.`);
      return;
    }

    const next = [...jobTypes, trimmed];
    persistJobTypes(next, `Added "${trimmed}" to Job Types dropdown.`);
    setNewJobType("");
  };

  const startEditing = (index: number, currentVal: string) => {
    setEditingIndex(index);
    setEditingValue(currentVal);
    setErrorMessage("");
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleSaveEdit = (originalVal: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setErrorMessage("Job type name cannot be blank.");
      return;
    }

    if (
      trimmed.toLowerCase() !== originalVal.toLowerCase() &&
      jobTypes.some((jt) => jt.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrorMessage(`"${trimmed}" already exists in the dropdown.`);
      return;
    }

    const next = jobTypes.map((item) => (item === originalVal ? trimmed : item));
    persistJobTypes(next, `Updated "${originalVal}" to "${trimmed}".`);
    if (previewSelected === originalVal) {
      setPreviewSelected(trimmed);
    }
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleDelete = (item: string) => {
    if (jobTypes.length <= 1) {
      setErrorMessage("You must keep at least one job type option.");
      return;
    }
    if (!confirm(`Are you sure you want to remove "${item}" from the dropdown list?`)) {
      return;
    }

    const next = jobTypes.filter((x) => x !== item);
    persistJobTypes(next, `Removed "${item}" from Job Types.`);
  };

  const handleResetDefaults = () => {
    if (!confirm("Reset Job Types back to standard HVAC industry defaults? This will restore the 8 default options.")) {
      return;
    }
    persistJobTypes(DEFAULT_JOB_TYPES, "Reset all Job Types to standard HVAC defaults.");
    setPreviewSelected(DEFAULT_JOB_TYPES[0]);
  };

  // Filtered list for display in the management column
  const filteredList = useMemo(() => {
    if (!filterSearch.trim()) return jobTypes;
    const q = filterSearch.toLowerCase();
    return jobTypes.filter((x) => x.toLowerCase().includes(q));
  }, [jobTypes, filterSearch]);

  // Filtered options for the interactive preview dropdown
  const previewFiltered = useMemo(() => {
    if (!previewSearch.trim()) return jobTypes;
    const q = previewSearch.toLowerCase();
    return jobTypes.filter((x) => x.toLowerCase().includes(q));
  }, [jobTypes, previewSearch]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in">
      <PageHeader
        moduleName="Settings"
        currentView="Job Nature / Type Dropdown Options"
        primaryAction={{
          label: "Reset to HVAC Defaults",
          onClick: handleResetDefaults,
        }}
      />

      {/* Breadcrumb Navigation & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings Hub
          </Link>
          <span className="text-zinc-300">|</span>
          <Link
            href="/settings/product-dropdowns"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D7A5F] hover:underline"
          >
            <Cpu className="w-3.5 h-3.5" />
            Appliance & Brand Dropdowns
          </Link>
        </div>

        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0A614B] px-3.5 py-1.5 rounded-lg shadow-sm transition"
        >
          <Briefcase className="w-3.5 h-3.5" />
          + Create New Job
        </Link>
      </div>

      {/* Notifications */}
      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-rose-600 hover:text-rose-800 font-bold p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}


      {/* Main Content: Left Column (Management) & Right Column (Live Dropdown Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Management List & Add Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0D7A5F]">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Configured Job Types ({jobTypes.length})
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Manage active items in the selection dropdown
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#71717A] bg-[#F4F4F5] px-2.5 py-0.5 rounded-md">
                {filteredList.length} shown
              </span>
            </div>

            {/* Add New Job Type Input Box */}
            <form onSubmit={handleAddJobType} className="space-y-2">
              <label className="text-[11px] font-bold text-[#52525B] uppercase tracking-wider block">
                + Add New Job Type
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Chiller Chemical Flushing & Descaling..."
                  value={newJobType}
                  onChange={(e) => setNewJobType(e.target.value)}
                  className="flex-1 bg-[#F9FAFB] px-3.5 py-2 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] transition"
                />
                <button
                  type="submit"
                  disabled={!newJobType.trim()}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Option</span>
                </button>
              </div>
            </form>

            {/* Search Filter Box */}
            {jobTypes.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search existing options to edit or remove..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full bg-[#FAFAFA] pl-9 pr-3 py-1.5 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:outline-none focus:border-[#0D7A5F] transition"
                />
                {filterSearch && (
                  <button
                    type="button"
                    onClick={() => setFilterSearch("")}
                    className="absolute right-2.5 top-2 text-[#A1A1AA] hover:text-[#18181B]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* List of Job Types with Edit, Rename, and Delete */}
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredList.length === 0 ? (
                <div className="text-center py-8 text-[#71717A] text-xs bg-[#FAFAFA] rounded-lg border border-dashed border-[#E4E4E7]">
                  No job types match &quot;{filterSearch}&quot;.
                </div>
              ) : (
                filteredList.map((item, idx) => {
                  const isEditing = editingIndex === idx;
                  const isDefault = DEFAULT_JOB_TYPES.includes(item);

                  if (isEditing) {
                    return (
                      <div
                        key={`edit-${item}-${idx}`}
                        className="p-2.5 rounded-lg bg-teal-50/70 border border-[#0D7A5F]/40 shadow-2xs space-y-2 animate-in fade-in"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#0D7A5F] uppercase tracking-wider">
                            Editing Job Type:
                          </span>
                          <span className="text-[10px] text-[#71717A]">
                            Press Enter or click Save
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEdit(item);
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            autoFocus
                            className="flex-1 bg-white px-2.5 py-1.5 rounded-md border border-[#0D7A5F] text-xs font-medium text-[#18181B] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item)}
                            className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-md text-xs font-bold transition shadow-2xs flex items-center gap-1"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-2.5 py-1.5 bg-white border border-[#E4E4E7] text-[#71717A] hover:text-[#18181B] rounded-md text-xs font-semibold transition"
                            title="Cancel Editing"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`item-${item}-${idx}`}
                      className="group flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] hover:bg-emerald-50/40 border border-[#F4F4F5] hover:border-emerald-200 transition text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-[10px] font-mono font-semibold text-[#A1A1AA] w-5 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="font-semibold text-[#18181B] truncate">
                          {item}
                        </span>
                        {isDefault ? (
                          <span className="text-[9px] font-medium text-[#71717A] bg-[#EDEDED] px-1.5 py-0.5 rounded shrink-0">
                            Default
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                            Custom
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => startEditing(idx, item)}
                          className="text-[#71717A] hover:text-[#0D7A5F] hover:bg-white border border-transparent hover:border-[#EDEDED] transition p-1.5 rounded-md"
                          title={`Edit / Rename "${item}"`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="text-[#71717A] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition p-1.5 rounded-md"
                          title={`Remove "${item}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-[#F4F4F5] flex items-center justify-between text-[11px] text-[#71717A]">
              <span>Tip: Click pencil icon to rename any job type.</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[#0D7A5F] hover:underline font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview Matching the Screenshot (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0D7A5F]" />
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Live Dropdown Preview
                </h3>
              </div>
              <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                Matches /jobs/new
              </span>
            </div>

            <p className="text-xs text-[#71717A] leading-relaxed">
              This interactive widget reflects exactly how the <strong>Job Nature / Type *</strong> selector renders on the job creation screen.
            </p>

            {/* Mock Job Intake Form Field */}
            <div className="pt-2">
              <label className="font-semibold text-[#18181B] text-xs block mb-1.5">
                Job Nature / Type *
              </label>

              {/* Main Dropdown Container */}
              <div className="relative">
                {/* Trigger box styled exactly like the screenshot */}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(!previewOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border-2 border-[#0D7A5F] bg-white text-xs font-semibold text-[#18181B] shadow-2xs hover:bg-[#FAFAFA] transition"
                >
                  <span className="truncate pr-2">{previewSelected || "Select job type..."}</span>
                  {previewOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#0D7A5F] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#0D7A5F] shrink-0" />
                  )}
                </button>

                {/* Dropdown Menu (shown in the screenshot) */}
                {previewOpen && (
                  <div className="mt-1.5 w-full bg-white border border-[#E4E4E7] rounded-xl shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95 z-20">
                    {/* Search Input Bar with magnifying glass and teal focus border */}
                    <div className="p-2 border-b border-[#F4F4F5]">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          placeholder="Type to search standard HVAC job types..."
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-md border border-[#0D7A5F] bg-white text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
                        />
                      </div>
                    </div>

                    {/* Scrollable list of job types */}
                    <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                      {previewFiltered.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-[#71717A]">
                          No job types match &quot;{previewSearch}&quot;
                        </div>
                      ) : (
                        previewFiltered.map((type) => {
                          const isSelected = type === previewSelected;
                          return (
                            <button
                              key={`preview-${type}`}
                              type="button"
                              onClick={() => {
                                setPreviewSelected(type);
                                setPreviewSearch("");
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition text-left ${
                                isSelected
                                  ? "bg-emerald-50 text-[#0D7A5F] font-semibold"
                                  : "text-[#18181B] hover:bg-[#F4F4F5]"
                              }`}
                            >
                              <span className="truncate pr-2">{type}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#0D7A5F] shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}

                      {/* Custom Job Type option */}
                      <div className="pt-1 mt-1 border-t border-[#F4F4F5]">
                        <div className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50/50 rounded-lg flex items-center justify-between">
                          <span>+ Type Custom Job Type...</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-[11px] text-[#71717A] space-y-1">
              <p className="font-semibold text-[#18181B]">How it works:</p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li>Adding an option makes it searchable in the job intake form immediately.</li>
                <li>Editing an option updates its label for all future job creations.</li>
                <li>Removing an option safely removes it from the picker list without affecting existing jobs.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
