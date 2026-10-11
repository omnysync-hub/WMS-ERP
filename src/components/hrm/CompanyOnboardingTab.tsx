"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { CompanyProfile, EMPTY_COMPANY_PROFILE, normalizeCompanyProfile } from "@/lib/companyProfile";
import { invalidateCompanyProfile } from "@/hooks/useCompanyProfile";

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

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/company-profile?includeReadiness=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load company onboarding");
      setProfile(normalizeCompanyProfile(data.profile));
      setReadiness(data.readiness || null);
      setChecklist(data.checklist || []);
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

  const nextSteps = [
    { title: "Build workforce", description: "Add employees, departments, designations, and reporting lines.", href: "/hrm?tab=employees", icon: Users },
    { title: "Configure leave", description: "Review leave types and maintain the company holiday calendar.", href: "/hrm?tab=leave", icon: CalendarDays },
    { title: "Set attendance sites", description: "Create workplaces and assign staff to approved geofences.", href: "/hrm?tab=attendance", icon: MapPin },
    { title: "Review payroll", description: "Confirm employee salary records before running payroll.", href: "/hrm?tab=payroll", icon: ShieldCheck },
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

  const saveFoundation = async (kind: "leave" | "holiday") => {
    setFoundationSaving(kind);
    setMessage("");
    setError("");
    try {
      const payload = kind === "leave"
        ? { action: "create_leave_type", name: leaveTypeName, maxDays: Number(leaveDays), accrualRule: leaveRule }
        : { action: "create_holiday", name: holidayName, date: holidayDate, description: holidayDescription };
      const response = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save HR foundation");
      if (kind === "leave") {
        setLeaveTypeName("");
        setLeaveDays("");
        setLeaveRule("");
        setMessage("Leave type created and balances initialized for active employees.");
      } else {
        setHolidayName("");
        setHolidayDate("");
        setHolidayDescription("");
        setMessage("Company holiday added to the calendar.");
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

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-zinc-900">Continue HR setup</h3>
          <p className="mt-1 text-xs text-zinc-500">Complete the remaining foundations using live master data, not fixed demo records.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {nextSteps.map(({ title, description, href, icon: Icon }) => (
            <Link key={title} href={href} className="group rounded-xl border border-zinc-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40">
              <Icon className="h-5 w-5 text-emerald-700" />
              <p className="mt-3 text-sm font-bold text-zinc-900">{title}</p>
              <p className="mt-1 min-h-10 text-xs leading-5 text-zinc-500">{description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Open setup <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-zinc-900">Leave and holiday foundations</h3>
          <p className="mt-1 text-xs text-zinc-500">Create policies for this company instead of loading fixed sample calendars or allowances.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={(event) => { event.preventDefault(); void saveFoundation("leave"); }} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-900">Add leave type</p>
              <span className="text-[10px] font-semibold text-zinc-500">{readiness?.leaveTypeCount || 0} configured</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
              <label className="space-y-1 text-[11px] font-semibold text-zinc-600">Name
                <input required className={fieldClass} value={leaveTypeName} onChange={(event) => setLeaveTypeName(event.target.value)} placeholder="Annual leave" />
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-zinc-600">Days per year
                <input required min="0.5" step="0.5" type="number" className={fieldClass} value={leaveDays} onChange={(event) => setLeaveDays(event.target.value)} placeholder="20" />
              </label>
            </div>
            <label className="space-y-1 text-[11px] font-semibold text-zinc-600">Accrual / eligibility rule
              <input required className={fieldClass} value={leaveRule} onChange={(event) => setLeaveRule(event.target.value)} placeholder="Describe how this leave is earned" />
            </label>
            <button disabled={foundationSaving === "leave"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white disabled:opacity-60">
              {foundationSaving === "leave" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Add leave type
            </button>
          </form>

          <form onSubmit={(event) => { event.preventDefault(); void saveFoundation("holiday"); }} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-900">Add company holiday</p>
              <span className="text-[10px] font-semibold text-zinc-500">{readiness?.holidayCount || 0} configured</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
              <label className="space-y-1 text-[11px] font-semibold text-zinc-600">Holiday name
                <input required className={fieldClass} value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="Company holiday" />
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-zinc-600">Date
                <input required type="date" className={fieldClass} value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} />
              </label>
            </div>
            <label className="space-y-1 text-[11px] font-semibold text-zinc-600">Description
              <input className={fieldClass} value={holidayDescription} onChange={(event) => setHolidayDescription(event.target.value)} placeholder="Optional policy note" />
            </label>
            <button disabled={foundationSaving === "holiday"} className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white disabled:opacity-60">
              {foundationSaving === "holiday" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Add holiday
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
