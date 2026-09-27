const fs = require("fs");

const page = `"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Building,
  BookOpen,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  ShieldCheck,
  Check,
  Sliders,
  HelpCircle,
  FileSpreadsheet,
  Layers,
  ListChecks,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import AccountMappingTab from "@/components/accounts/AccountMappingTab";

type MappingCompleteness = {
  total: number;
  configured: number;
  percentage: number;
  isComplete: boolean;
  missing?: string[];
  inactiveOrNonLeaf?: string[];
};

export default function SetupWizardPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [settings, setSettings] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tbStatus, setTbStatus] = useState<any>({ totalDebits: 0, totalCredits: 0, variance: 0, isInBalance: true });
  const [counts, setCounts] = useState<any>({ customers: 0, vendors: 0, products: 0 });
  const [mappingCompleteness, setMappingCompleteness] = useState<MappingCompleteness | null>(null);

  // Step 1
  const [legalName, setLegalName] = useState("Enterprise Services (Pvt) Ltd");
  const [tradeName, setTradeName] = useState("Enterprise Services");
  const [ntnNumber, setNtnNumber] = useState("9482710-3");
  const [strnNumber, setStrnNumber] = useState("3277876123456");
  const [addressText, setAddressText] = useState("Main Boulevard, Gulberg III, Lahore, Pakistan");
  const [phone, setPhone] = useState("042-111-0000");
  const [email, setEmail] = useState("finance@company.com");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(7);

  // Step 2 COA
  const [coaCsvText, setCoaCsvText] = useState("");
  const [deactivateCodes, setDeactivateCodes] = useState("");

  // Step 4 Opening Balances
  const [goLiveDate, setGoLiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openingBalances, setOpeningBalances] = useState<Record<string, { debit: string; credit: string }>>({});

  // Optional master data (on go-live step)
  const [importType, setImportType] = useState<"customers" | "vendors" | "inventory">("customers");
  const [csvText, setCsvText] = useState("");

  const loadSetupStatus = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/setup");
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setPeriods(data.periods || []);
        setAccounts(data.accounts || []);
        setTbStatus(data.trialBalanceStatus);
        setCounts(data.counts || {});
        setMappingCompleteness(data.mappingCompleteness || null);

        if (data.settings) {
          setLegalName(data.settings.legalName || "Enterprise Services (Pvt) Ltd");
          setTradeName(data.settings.tradeName || "Enterprise Services");
          setNtnNumber(data.settings.ntnNumber || "");
          setStrnNumber(data.settings.strnNumber || "");
          setAddressText(data.settings.addressText || "");
          setPhone(data.settings.phone || "");
          setEmail(data.settings.email || "");
          setFiscalYearStartMonth(data.settings.fiscalYearStartMonth || 7);
        }

        const initialBal: Record<string, { debit: string; credit: string }> = {};
        if (data.accounts) {
          for (const a of data.accounts) {
            initialBal[a.code] = { debit: "", credit: "" };
          }
        }
        if (data.openingVoucher?.lines) {
          for (const line of data.openingVoucher.lines) {
            if (line.account?.code && line.account.code !== "3900") {
              initialBal[line.account.code] = {
                debit: line.debit > 0 ? String(line.debit) : "",
                credit: line.credit > 0 ? String(line.credit) : "",
              };
            }
          }
        }
        setOpeningBalances(initialBal);
      }
    } catch (e: any) {
      setErrorMsg("Failed to load setup state: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSetupStatus();
  }, []);

  const handleSaveCompany = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_company",
          legalName,
          tradeName,
          addressText,
          phone,
          email,
          ntnNumber,
          strnNumber,
          fiscalYearStartMonth,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save company settings");
      setSuccessMsg("Company profile saved & fiscal periods seeded.");
      await loadSetupStatus();
      setCurrentStep(2);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseCsvRows = (text: string) => {
    const lines = text.split(/\\r?\\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) throw new Error("Please enter a header row plus at least one data row.");
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      const rowObj: any = {};
      header.forEach((h, idx) => {
        rowObj[h] = parts[idx];
      });
      rows.push(rowObj);
    }
    return rows;
  };

  const handleImportCoa = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const rows = parseCsvRows(coaCsvText);
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_coa", rows, companyId: "DEFAULT" }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details ? " — " + data.details.slice(0, 5).join("; ") : "";
        throw new Error((data.error || "COA import failed") + detail);
      }
      setSuccessMsg(data.message || "COA imported.");
      setCoaCsvText("");
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnsureTemplate = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_template_coa", companyId: "DEFAULT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to provision template COA");
      setSuccessMsg(data.message);
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedBaselineMappings = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_baseline_mappings", companyId: "DEFAULT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to seed baseline mappings");
      setSuccessMsg(data.message);
      if (data.completeness) setMappingCompleteness(data.completeness);
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateUnused = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const codes = deactivateCodes
        .split(/[,\\s]+/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (!codes.length) throw new Error("Enter one or more account codes to deactivate.");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate_unused_defaults", codes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deactivate failed");
      setSuccessMsg(\`Deactivation processed for \${data.results?.length || 0} code(s). Posted history is never deleted.\`);
      setDeactivateCodes("");
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedTotals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    for (const code in openingBalances) {
      const d = parseFloat(openingBalances[code]?.debit) || 0;
      const c = parseFloat(openingBalances[code]?.credit) || 0;
      debits += d;
      credits += c;
    }
    const diff = Math.round((debits - credits) * 100) / 100;
    return {
      totalDebits: Math.round(debits * 100) / 100,
      totalCredits: Math.round(credits * 100) / 100,
      difference: diff,
      equityOffsetSide: diff > 0 ? "Credit Opening Balance Equity" : diff < 0 ? "Debit Opening Balance Equity" : "Zero (Exact Balance)",
    };
  }, [openingBalances]);

  const handlePostOpeningBalances = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const rows = [];
      for (const code in openingBalances) {
        const d = parseFloat(openingBalances[code]?.debit) || 0;
        const c = parseFloat(openingBalances[code]?.credit) || 0;
        if (d > 0 || c > 0) rows.push({ accountCode: code, debit: d, credit: c });
      }
      if (rows.length === 0) throw new Error("Please enter at least one opening balance.");

      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post_opening_balances", balances: rows, goLiveDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post opening balances");
      setSuccessMsg(data.message);
      await loadSetupStatus();
      setCurrentStep(5);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportCsv = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const rows = parseCsvRows(csvText);
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_master_data", dataType: importType, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import data");
      setSuccessMsg(data.message);
      setCsvText("");
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteGoLive = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_setup" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign off setup");
      setSuccessMsg("Setup complete — operational modules unlocked.");
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: "1. Company", icon: Building },
    { num: 2, label: "2. Chart of Accounts", icon: BookOpen },
    { num: 3, label: "3. Account Mapping", icon: Sliders },
    { num: 4, label: "4. Opening Balances", icon: DollarSign },
    { num: 5, label: "5. Go-Live", icon: ShieldCheck },
  ];

  const mappingOk = !!mappingCompleteness?.isComplete;
  const canGoLive = mappingOk && !!tbStatus?.isInBalance;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-[#71717A]">
        Loading setup wizard…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#18181B] font-sans pb-20">
      <header className="bg-white border-b border-[#E4E4E7] px-6 py-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#18181B] flex items-center gap-2">
                Client Onboarding & Go-Live Setup
                {settings?.isSetupCompleted && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-[#065F46] font-bold border border-emerald-200">
                    Live
                  </span>
                )}
              </h1>
              <p className="text-xs text-[#71717A]">
                Company → COA → Map transaction types → Opening balances → Sign off (100% mapping required).
              </p>
            </div>
          </div>
          <Link
            href="/accounts"
            className="text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition"
          >
            Exit to Accounts
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 shadow-xs">
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = currentStep === s.num;
              const isPast = currentStep > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setCurrentStep(s.num)}
                  className={cn(
                    "p-2.5 rounded-xl border flex flex-col items-center gap-1 transition",
                    isActive
                      ? "bg-emerald-50 border-[#0D7A5F] text-[#0D7A5F] font-bold shadow-xs"
                      : isPast
                      ? "bg-[#FAFAFA] border-emerald-200 text-emerald-800"
                      : "bg-[#F9FAFB] border-[#EDEDED] text-[#71717A] opacity-70"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {isPast ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Icon className="w-3.5 h-3.5" />}
                    <span>{s.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1 — Company */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4">
              <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-[#0D7A5F]" />
                Step 1: Company Profile & Fiscal Calendar
              </h2>
              <p className="text-xs text-[#71717A] mt-1">
                Legal entity details. Saving seeds 12 open monthly fiscal periods for companyId DEFAULT.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {[
                ["Legal Company Name", legalName, setLegalName],
                ["Trade / Brand Name", tradeName, setTradeName],
                ["National Tax Number (NTN)", ntnNumber, setNtnNumber],
                ["Sales Tax Registration (STRN)", strnNumber, setStrnNumber],
                ["Phone", phone, setPhone],
                ["Finance Email", email, setEmail],
              ].map(([label, val, setter]: any) => (
                <div key={label}>
                  <label className="text-[#71717A] font-semibold block mb-1">{label}</label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-[#71717A] font-semibold block mb-1">Registered Address</label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>
              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Fiscal Year Start Month</label>
                <select
                  value={fiscalYearStartMonth}
                  onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {isSubmitting ? "Saving…" : "Save Profile & Continue"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — COA */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-4">
              <div className="border-b border-[#E4E4E7] pb-4">
                <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0D7A5F]" />
                  Step 2: Chart of Accounts
                </h2>
                <p className="text-xs text-[#71717A] mt-1">
                  Import your client COA, start from the Workman template, or deactivate unused defaults (never deletes posted history).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <HelpCircle className="w-3.5 h-3.5" />
                  CSV / Excel export format
                </div>
                <p>
                  Columns: <code className="font-mono bg-white/80 px-1 rounded">code, name, type, parentCode?, isActive?</code>
                </p>
                <p>
                  <strong>type</strong> must be one of: asset, liability, equity, revenue, expense, contra_revenue.
                  Codes must be unique. Only active level-4 (leaf) accounts can be mapped in the next step.
                </p>
                <p className="font-mono text-[10px] text-sky-900">
                  Example: 1115,Client Operating Bank,asset,1110,true
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleEnsureTemplate}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#18181B] hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Start from Workman template
                </button>
                <button
                  type="button"
                  onClick={handleSeedBaselineMappings}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-[#0D7A5F] text-[#0D7A5F] text-xs font-bold rounded-xl hover:bg-emerald-50 disabled:opacity-50"
                >
                  Apply baseline mappings for template codes
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] flex items-center gap-1.5 mb-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Paste COA CSV (header + rows)
                </label>
                <textarea
                  value={coaCsvText}
                  onChange={(e) => setCoaCsvText(e.target.value)}
                  rows={8}
                  placeholder={"code,name,type,parentCode,isActive\\n1115,Client Operating Bank,asset,1110,true"}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-3 font-mono text-[11px] outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleImportCoa}
                  disabled={isSubmitting || !coaCsvText.trim()}
                  className="mt-2 px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import / Replace COA rows
                </button>
              </div>

              <div className="pt-2 border-t border-[#E4E4E7]">
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Deactivate unused Workman defaults (codes, comma-separated)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={deactivateCodes}
                    onChange={(e) => setDeactivateCodes(e.target.value)}
                    placeholder="e.g. 1011, 1020"
                    className="flex-1 bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-mono text-xs outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleDeactivateUnused}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-amber-300 text-amber-900 bg-amber-50 text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                </div>
                <p className="text-[10px] text-[#71717A] mt-1">
                  Soft-deactivates only. Accounts with journal history are never deleted.
                </p>
              </div>

              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E4E4E7]">
                <span className="text-xs font-bold text-[#18181B] block mb-2">
                  Active leaf accounts ({accounts.length})
                </span>
                <div className="max-h-48 overflow-y-auto font-mono text-[11px] divide-y divide-[#EDEDED] bg-white rounded-lg border border-[#E4E4E7]">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0D7A5F]">{acc.code}</span>
                        <span>{acc.name}</span>
                      </div>
                      <span className="text-[10px] uppercase text-[#71717A]">{acc.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t border-[#E4E4E7]">
                <button type="button" onClick={() => setCurrentStep(1)} className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A] flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl flex items-center gap-2"
                >
                  Continue to Account Mapping <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Mapping */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#0D7A5F]" />
                    Step 3: Account Mapping
                  </h2>
                  <p className="text-xs text-[#71717A] mt-1">
                    Map every required transaction type to an active leaf account. Completeness must reach 100% before go-live.
                  </p>
                </div>
                <div
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-bold font-mono",
                    mappingOk ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-950"
                  )}
                >
                  {mappingCompleteness
                    ? \`\${mappingCompleteness.configured}/\${mappingCompleteness.total} (\${mappingCompleteness.percentage}%)\`
                    : "—"}
                </div>
              </div>
            </div>

            <AccountMappingTab
              setupMode
              initialSubTab="mappings"
              onCompletenessChange={(c) => {
                if (c) setMappingCompleteness(c as MappingCompleteness);
              }}
            />

            <div className="flex justify-between">
              <button type="button" onClick={() => setCurrentStep(2)} className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A] flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!mappingOk) {
                    setErrorMsg("Map all required transaction types to active leaf accounts before continuing (100% completeness).");
                    return;
                  }
                  setErrorMsg("");
                  setCurrentStep(4);
                }}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl flex items-center gap-2"
              >
                {mappingOk ? "Continue to Opening Balances" : "Completeness gate — finish mappings"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Opening balances */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
                  Step 4: Opening Balances
                </h2>
                <p className="text-xs text-[#71717A] mt-1">
                  Enter trial-balance cutover amounts. Net difference offsets to the mapped opening_balance_equity account.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[#71717A]">Go-Live Date:</span>
                <input
                  type="date"
                  value={goLiveDate}
                  onChange={(e) => setGoLiveDate(e.target.value)}
                  className="bg-[#F9FAFB] border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 font-bold text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block">Opening voucher math</span>
                <span className="text-xs text-emerald-800">
                  Debits: <strong>{formatCurrency(calculatedTotals.totalDebits)}</strong> | Credits:{" "}
                  <strong>{formatCurrency(calculatedTotals.totalCredits)}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-900 block">Automatic offset</span>
                <span className="font-mono font-bold text-sm text-[#065F46]">
                  {calculatedTotals.equityOffsetSide} ({formatCurrency(Math.abs(calculatedTotals.difference))})
                </span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-[#E4E4E7] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-4 text-right">Debit</th>
                    <th className="py-2.5 px-4 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {accounts
                    .filter((a) => a.code !== "3900")
                    .map((acc) => {
                      const isNormalDebit = ["asset", "expense", "contra_revenue"].includes(acc.type);
                      return (
                        <tr key={acc.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-2 px-4 font-mono font-bold text-[#0D7A5F]">{acc.code}</td>
                          <td className="py-2 px-4 font-medium">{acc.name}</td>
                          <td className="py-2 px-3 capitalize text-[#71717A]">{acc.type}</td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              placeholder={isNormalDebit ? "0" : ""}
                              value={openingBalances[acc.code]?.debit || ""}
                              onChange={(e) =>
                                setOpeningBalances((prev) => ({
                                  ...prev,
                                  [acc.code]: {
                                    debit: e.target.value,
                                    credit: e.target.value ? "" : prev[acc.code]?.credit || "",
                                  },
                                }))
                              }
                              className="w-28 bg-[#F9FAFB] border border-[#D4D4D8] rounded-lg p-1.5 text-right font-mono text-xs outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              placeholder={!isNormalDebit ? "0" : ""}
                              value={openingBalances[acc.code]?.credit || ""}
                              onChange={(e) =>
                                setOpeningBalances((prev) => ({
                                  ...prev,
                                  [acc.code]: {
                                    credit: e.target.value,
                                    debit: e.target.value ? "" : prev[acc.code]?.debit || "",
                                  },
                                }))
                              }
                              className="w-28 bg-[#F9FAFB] border border-[#D4D4D8] rounded-lg p-1.5 text-right font-mono text-xs outline-hidden"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-2 border-t border-[#E4E4E7]">
              <button type="button" onClick={() => setCurrentStep(3)} className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A]">
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A]"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handlePostOpeningBalances}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2"
                >
                  {isSubmitting ? "Posting…" : "Post Opening Balances"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — Go-live */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-5">
              <div className="border-b border-[#E4E4E7] pb-4">
                <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                  Step 5: Completeness Gate & Go-Live
                </h2>
                <p className="text-xs text-[#71717A] mt-1">
                  Go-live is blocked until all required mappings point to active leaf accounts and the trial balance is in equilibrium.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    ok: !!settings?.legalName,
                    title: "Company profile",
                    detail: settings?.legalName || "Missing",
                  },
                  {
                    ok: periods.length > 0,
                    title: "Fiscal periods",
                    detail: \`\${periods.length} periods initialized\`,
                  },
                  {
                    ok: accounts.length > 0,
                    title: "Chart of Accounts (active leaves)",
                    detail: \`\${accounts.length} leaf accounts\`,
                  },
                  {
                    ok: mappingOk,
                    title: "Account mapping completeness",
                    detail: mappingCompleteness
                      ? \`\${mappingCompleteness.configured}/\${mappingCompleteness.total} (\${mappingCompleteness.percentage}%)\`
                      : "Unknown",
                  },
                  {
                    ok: !!tbStatus.isInBalance,
                    title: "Trial balance equilibrium",
                    detail: \`Debits \${formatCurrency(tbStatus.totalDebits)} / Credits \${formatCurrency(tbStatus.totalCredits)} (var \${tbStatus.variance})\`,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between",
                      item.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.ok ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                      )}
                      <div>
                        <span className={cn("font-bold block", item.ok ? "text-emerald-950" : "text-rose-950")}>
                          {item.title}
                        </span>
                        <span className={cn("text-[11px]", item.ok ? "text-emerald-800" : "text-rose-800")}>
                          {item.detail}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold font-mono px-2 py-0.5 rounded",
                        item.ok ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
                      )}
                    >
                      {item.ok ? "OK" : "BLOCKED"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#18181B]">
                  <ListChecks className="w-4 h-4 text-[#0D7A5F]" />
                  Light smoke checklist (manual)
                </div>
                <ul className="text-[11px] text-[#52525B] list-disc pl-5 space-y-1">
                  <li>Create a draft job and confirm revenue/COGS mappings resolve without AccountMappingError.</li>
                  <li>Post a small cash receipt and verify it hits the mapped receiving account.</li>
                  <li>Open Trial Balance / P&amp;L from Accounts and confirm figures look sane.</li>
                </ul>
              </div>

              {/* Optional master data */}
              <details className="rounded-xl border border-[#E4E4E7] p-4 text-xs">
                <summary className="font-bold cursor-pointer text-[#18181B]">Optional: import customers / vendors / inventory</summary>
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    {(["customers", "vendors", "inventory"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setImportType(t)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-[11px] font-bold capitalize",
                          importType === t ? "bg-emerald-50 border-[#0D7A5F] text-[#0D7A5F]" : "border-[#E4E4E7] text-[#71717A]"
                        )}
                      >
                        {t} ({counts[t] || 0})
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={5}
                    placeholder="Paste CSV with header row…"
                    className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleImportCsv}
                    disabled={isSubmitting || !csvText.trim()}
                    className="px-4 py-2 bg-[#18181B] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    Import {importType}
                  </button>
                </div>
              </details>

              <div className="p-6 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7] text-center space-y-3">
                {settings?.isSetupCompleted ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      Setup signed off — system is live
                    </div>
                    <div className="flex justify-center gap-3 pt-1">
                      <Link href="/accounts" className="px-5 py-2.5 bg-[#0D7A5F] text-white font-bold text-xs rounded-xl">
                        Open Accounts
                      </Link>
                      <Link href="/settings/accounting" className="px-5 py-2.5 bg-[#18181B] text-white font-bold text-xs rounded-xl">
                        Accounting Settings
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!canGoLive && (
                      <p className="text-[11px] text-rose-700 font-semibold">
                        Finish account mapping (100%) and balance the trial balance before signing off.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleCompleteGoLive}
                      disabled={isSubmitting || !canGoLive}
                      className="px-6 py-3 bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md inline-flex items-center gap-2"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      {isSubmitting ? "Signing off…" : "Sign Off Setup & Go Live"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-start">
                <button type="button" onClick={() => setCurrentStep(4)} className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A]">
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
`;

fs.writeFileSync("src/app/setup/page.tsx", page, "utf8");
console.log("setup page written, bytes=", Buffer.byteLength(page));
