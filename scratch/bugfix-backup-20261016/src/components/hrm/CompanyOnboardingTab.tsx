"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Circle,
  Loader2,
  Save,
  Users,
  FolderTree,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Pencil,
  Trash2,
  RotateCcw,
  Plus,
  X,
  Sparkles,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyProfile, EMPTY_COMPANY_PROFILE, normalizeCompanyProfile } from "@/lib/companyProfile";
import { invalidateCompanyProfile } from "@/hooks/useCompanyProfile";

interface LeaveTypeItem {
  id: string;
  name: string;
  accrualRule: string;
  maxDays: number;
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  description: string | null;
}

interface CompanyReadiness {
  profileComplete: boolean;
  employeeCount: number;
  departmentCount: number;
  designationCount: number;
  leaveTypeCount: number;
  holidayCount: number;
  geofenceCount: number;
}

interface ChecklistItem {
  key: string;
  label: string;
  complete: boolean;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export default function CompanyOnboardingTab() {
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_COMPANY_PROFILE);
  const [readiness, setReadiness] = useState<CompanyReadiness | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [foundationSaving, setFoundationSaving] = useState<"leave" | "holiday" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [leaveTypeName, setLeaveTypeName] = useState("");
  const [leaveDays, setLeaveDays] = useState("");
  const [leaveRule, setLeaveRule] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDescription, setHolidayDescription] = useState("");

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [profileRes, leaveRes] = await Promise.all([
        fetch("/api/company-profile?includeReadiness=1", { cache: "no-store" }),
        fetch("/api/hrm/leave?foundations=true", { cache: "no-store" }),
      ]);
      const data = await profileRes.json();
      if (!profileRes.ok) throw new Error(data.error || "Could not load company onboarding");
      setProfile(normalizeCompanyProfile(data.profile));
      setReadiness(data.readiness || null);
      setChecklist(data.checklist || []);

      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        if (leaveData.leaveTypes) setLeaveTypes(leaveData.leaveTypes);
        if (leaveData.holidays) setHolidays(leaveData.holidays);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load company onboarding");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completion = useMemo(() => {
    if (!checklist.length) return 0;
    return Math.round((checklist.filter((item) => item.complete).length / checklist.length) * 100);
  }, [checklist]);

  const readinessCards = [
    { label: "Employees", value: readiness?.employeeCount || 0, icon: Users },
    { label: "Departments", value: readiness?.departmentCount || 0, icon: FolderTree },
    { label: "Leave types", value: readiness?.leaveTypeCount || 0, icon: CalendarDays },
    { label: "Work sites", value: readiness?.geofenceCount || 0, icon: MapPin },
  ];

  const updateField = (field: keyof CompanyProfile, value: string | number) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save company profile");
      const saved = normalizeCompanyProfile(data.profile);
      setProfile(saved);
      invalidateCompanyProfile(saved);
      setMessage("Company profile saved. Letterheads, receipts, statements, and sign-in branding now use these details.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save company profile");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditLeaveType = (lt: LeaveTypeItem) => {
    setEditingLeaveTypeId(lt.id);
    setLeaveTypeName(lt.name);
    setLeaveDays(String(lt.maxDays));
    setLeaveRule(lt.accrualRule);
  };

  const cancelEditLeaveType = () => {
    setEditingLeaveTypeId(null);
    setLeaveTypeName("");
    setLeaveDays("");
    setLeaveRule("");
  };

  const deleteLeaveType = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete leave type "${name}"? This will also remove associated employee balances.`)) {
      return;
    }
    setDeletingId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_leave_type", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete leave type");
      setMessage(`Leave type "${name}" removed successfully.`);
      if (editingLeaveTypeId === id) cancelEditLeaveType();
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to delete leave type");
    } finally {
      setDeletingId(null);
    }
  };

  const startEditHoliday = (h: HolidayItem) => {
    setEditingHolidayId(h.id);
    setHolidayName(h.name);
    setHolidayDate(h.date ? h.date.slice(0, 10) : "");
    setHolidayDescription(h.description || "");
  };

  const cancelEditHoliday = () => {
    setEditingHolidayId(null);
    setHolidayName("");
    setHolidayDate("");
    setHolidayDescription("");
  };

  const deleteHoliday = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete holiday "${name}"?`)) {
      return;
    }
    setDeletingId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_holiday", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete holiday");
      setMessage(`Holiday "${name}" removed successfully.`);
      if (editingHolidayId === id) cancelEditHoliday();
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to delete holiday");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeedingDefaults(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_defaults" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore default leave types");
      setMessage("Default leave policies (Annual, Sick, Casual, Emergency) ensured successfully.");
      await load();
    } catch (err: any) {
      setError(err.message || "Could not restore defaults");
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const saveFoundation = async (kind: "leave" | "holiday") => {
    setFoundationSaving(kind);
    setMessage("");
    setError("");
    try {
      let payload: any;
      if (kind === "leave") {
        if (editingLeaveTypeId) {
          payload = {
            action: "update_leave_type",
            id: editingLeaveTypeId,
            name: leaveTypeName,
            maxDays: Number(leaveDays),
            accrualRule: leaveRule,
          };
        } else {
          payload = {
            action: "create_leave_type",
            name: leaveTypeName,
            maxDays: Number(leaveDays),
            accrualRule: leaveRule,
          };
        }
      } else {
        if (editingHolidayId) {
          payload = {
            action: "update_holiday",
            id: editingHolidayId,
            name: holidayName,
            date: holidayDate,
            description: holidayDescription,
          };
        } else {
          payload = {
            action: "create_holiday",
            name: holidayName,
            date: holidayDate,
            description: holidayDescription,
          };
        }
      }

      const response = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save HR foundation");
      if (kind === "leave") {
        const wasEditing = Boolean(editingLeaveTypeId);
        cancelEditLeaveType();
        setMessage(wasEditing ? "Leave policy updated successfully." : "Leave type created and balances initialized for active employees.");
      } else {
        const wasEditing = Boolean(editingHolidayId);
        cancelEditHoliday();
        setMessage(wasEditing ? "Company holiday updated successfully." : "Company holiday added to the calendar.");
      }
      await load();
    } catch (foundationError) {
      setError(foundationError instanceof Error ? foundationError.message : "Could not save HR foundation");
    } finally {
      setFoundationSaving("");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-72 rounded-xl border border-zinc-200 bg-white flex items-center justify-center text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading company onboarding…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.55fr_0.75fr]">
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Building2 className="h-4 w-4 text-emerald-700" /> Company identity
              </div>
              <p className="mt-1 text-xs text-zinc-500">Saved once and reused across every department and official document.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Single source of truth
            </span>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Legal company name <span className="text-red-500">*</span>
              <input className={fieldClass} value={profile.legalName} onChange={(event) => updateField("legalName", event.target.value)} placeholder="Registered legal name" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Trade / brand name
              <input className={fieldClass} value={profile.tradeName} onChange={(event) => updateField("tradeName", event.target.value)} placeholder="Name shown in the application" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700 md:col-span-2">
              Registered address <span className="text-red-500">*</span>
              <input className={fieldClass} value={profile.addressText} onChange={(event) => updateField("addressText", event.target.value)} placeholder="Complete registered address" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Company phone <span className="text-red-500">*</span>
              <input className={fieldClass} value={profile.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="Main contact number" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Company email <span className="text-red-500">*</span>
              <input className={fieldClass} type="email" value={profile.email} onChange={(event) => updateField("email", event.target.value)} placeholder="accounts@example.com" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              NTN
              <input className={fieldClass} value={profile.ntnNumber} onChange={(event) => updateField("ntnNumber", event.target.value)} placeholder="Optional tax number" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              STRN
              <input className={fieldClass} value={profile.strnNumber} onChange={(event) => updateField("strnNumber", event.target.value)} placeholder="Optional sales-tax number" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Base currency
              <input className={fieldClass} maxLength={3} value={profile.baseCurrency} onChange={(event) => updateField("baseCurrency", event.target.value.toUpperCase())} placeholder="PKR" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Fiscal year starts
              <select className={fieldClass} value={profile.fiscalYearStartMonth} onChange={(event) => updateField("fiscalYearStartMonth", Number(event.target.value))}>
                {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
            <p className="text-xs text-zinc-500">Required fields prevent blank or demo information from appearing on official records.</p>
            <button type="button" onClick={save} disabled={isSaving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0D7A5F] px-4 text-xs font-bold text-white transition hover:bg-[#0A624C] disabled:opacity-60">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save company profile
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Onboarding progress</p>
                <p className="mt-1 text-3xl font-black text-zinc-900">{completion}%</p>
              </div>
              <ShieldCheck className="h-9 w-9 text-emerald-700" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${completion}%` }} />
            </div>
            <div className="mt-4 space-y-2.5">
              {checklist.map((item) => (
                <div key={item.key} className="flex items-start gap-2 text-xs text-zinc-700">
                  {item.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            {readinessCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                <Icon className="h-4 w-4 text-emerald-700" />
                <p className="mt-2 text-xl font-black text-zinc-900">{value}</p>
                <p className="text-[11px] font-medium text-zinc-500">{label}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>


      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Leave and holiday foundations</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Configure company leave allowances (Annual, Sick, Casual, etc.) and official holidays. Add new types, edit allowances, or delete policies.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={isSeedingDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[#065F46] text-xs font-semibold transition shrink-0 shadow-2xs disabled:opacity-50"
            title="Restore or ensure default statutory leave types (Annual 22d, Sick 15d, Casual 7d, Emergency 5d)"
          >
            {isSeedingDefaults ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
            )}
            <span>Ensure Default Leave Types</span>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ================================================================= */}
          {/* COLUMN 1: LEAVE TYPES & POLICIES                                  */}
          {/* ================================================================= */}
          <div className="space-y-4">
            {/* Create / Edit Form */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveFoundation("leave");
              }}
              className={cn(
                "space-y-3 rounded-xl border p-4 transition",
                editingLeaveTypeId
                  ? "border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-300"
                  : "border-zinc-200 bg-zinc-50/80"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-emerald-700" />
                  <p className="text-xs font-bold text-zinc-900">
                    {editingLeaveTypeId ? "Edit leave policy" : "Add leave type"}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {leaveTypes.length} configured
                </span>
              </div>

              {editingLeaveTypeId && (
                <div className="text-[11px] text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg flex items-center justify-between">
                  <span>Modifying policy: <strong>{leaveTypeName || "Selected type"}</strong></span>
                  <button
                    type="button"
                    onClick={cancelEditLeaveType}
                    className="text-xs font-bold hover:underline inline-flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <label className="space-y-1 text-[11px] font-semibold text-zinc-600">
                  Name (e.g. Annual, Sick, Casual)
                  <input
                    required
                    className={fieldClass}
                    value={leaveTypeName}
                    onChange={(event) => setLeaveTypeName(event.target.value)}
                    placeholder="Annual leave"
                  />
                </label>
                <label className="space-y-1 text-[11px] font-semibold text-zinc-600">
                  Days per year
                  <input
                    required
                    min="0.5"
                    step="0.5"
                    type="number"
                    className={fieldClass}
                    value={leaveDays}
                    onChange={(event) => setLeaveDays(event.target.value)}
                    placeholder="22"
                  />
                </label>
              </div>

              <label className="space-y-1 text-[11px] font-semibold text-zinc-600">
                Accrual / eligibility rule
                <input
                  required
                  className={fieldClass}
                  value={leaveRule}
                  onChange={(event) => setLeaveRule(event.target.value)}
                  placeholder="e.g. 22 days/year (prorated), Certified medical required"
                />
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={foundationSaving === "leave"}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  {foundationSaving === "leave" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingLeaveTypeId ? "Update leave policy" : "Add leave type"}
                </button>

                {editingLeaveTypeId && (
                  <button
                    type="button"
                    onClick={cancelEditLeaveType}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* List of Configured Leave Types */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-1">
                <span>Configured Leave Types ({leaveTypes.length})</span>
                <span className="text-[10px] text-zinc-400 font-normal">Actions: Edit · Delete</span>
              </div>

              {leaveTypes.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 space-y-2">
                  <p className="text-xs text-zinc-500">No leave types configured yet.</p>
                  <button
                    type="button"
                    onClick={handleSeedDefaults}
                    disabled={isSeedingDefaults}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    Click to load standard defaults (Annual, Sick, Casual, Emergency)
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaveTypes.map((lt) => {
                    const isEditing = editingLeaveTypeId === lt.id;
                    const isDeleting = deletingId === lt.id;

                    return (
                      <div
                        key={lt.id}
                        className={cn(
                          "rounded-xl border p-3.5 transition flex items-start justify-between gap-3 shadow-2xs",
                          isEditing
                            ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500"
                            : "border-zinc-200 bg-white hover:border-zinc-300"
                        )}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-zinc-900">{lt.name}</span>
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#065F46] border border-emerald-200">
                              {lt.maxDays} days / yr
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-snug">
                            {lt.accrualRule}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => startEditLeaveType(lt)}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition"
                            title="Edit policy"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLeaveType(lt.id, lt.name)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-zinc-400 transition disabled:opacity-50"
                            title="Delete policy"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* COLUMN 2: COMPANY HOLIDAYS                                        */}
          {/* ================================================================= */}
          <div className="space-y-4">
            {/* Create / Edit Form */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveFoundation("holiday");
              }}
              className={cn(
                "space-y-3 rounded-xl border p-4 transition",
                editingHolidayId
                  ? "border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-300"
                  : "border-zinc-200 bg-zinc-50/80"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <p className="text-xs font-bold text-zinc-900">
                    {editingHolidayId ? "Edit company holiday" : "Add company holiday"}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {holidays.length} configured
                </span>
              </div>

              {editingHolidayId && (
                <div className="text-[11px] text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg flex items-center justify-between">
                  <span>Modifying holiday: <strong>{holidayName || "Selected holiday"}</strong></span>
                  <button
                    type="button"
                    onClick={cancelEditHoliday}
                    className="text-xs font-bold hover:underline inline-flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <label className="space-y-1 text-[11px] font-semibold text-zinc-600">
                  Holiday name
                  <input
                    required
                    className={fieldClass}
                    value={holidayName}
                    onChange={(event) => setHolidayName(event.target.value)}
                    placeholder="Eid Al-Fitr / Independence Day"
                  />
                </label>
                <label className="space-y-1 text-[11px] font-semibold text-zinc-600">
                  Date
                  <input
                    required
                    type="date"
                    className={fieldClass}
                    value={holidayDate}
                    onChange={(event) => setHolidayDate(event.target.value)}
                  />
                </label>
              </div>

              <label className="space-y-1 text-[11px] font-semibold text-zinc-600">
                Description
                <input
                  className={fieldClass}
                  value={holidayDescription}
                  onChange={(event) => setHolidayDescription(event.target.value)}
                  placeholder="National Public Holiday / Federal Holiday"
                />
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={foundationSaving === "holiday"}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  {foundationSaving === "holiday" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingHolidayId ? "Update holiday" : "Add holiday"}
                </button>

                {editingHolidayId && (
                  <button
                    type="button"
                    onClick={cancelEditHoliday}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* List of Configured Holidays */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600 uppercase tracking-wider px-1">
                <span>Configured Holidays ({holidays.length})</span>
                <span className="text-[10px] text-zinc-400 font-normal">Actions: Edit · Delete</span>
              </div>

              {holidays.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 space-y-2">
                  <p className="text-xs text-zinc-500">No company holidays scheduled yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {holidays.map((h) => {
                    const isEditing = editingHolidayId === h.id;
                    const isDeleting = deletingId === h.id;
                    const formattedDate = h.date
                      ? new Date(h.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <div
                        key={h.id}
                        className={cn(
                          "rounded-xl border p-3 transition flex items-center justify-between gap-3 shadow-2xs",
                          isEditing
                            ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500"
                            : "border-zinc-200 bg-white hover:border-zinc-300"
                        )}
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-900 truncate">{h.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {h.description || "Public Holiday"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {formattedDate}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditHoliday(h)}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition"
                            title="Edit holiday"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHoliday(h.id, h.name)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-zinc-400 transition disabled:opacity-50"
                            title="Delete holiday"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
