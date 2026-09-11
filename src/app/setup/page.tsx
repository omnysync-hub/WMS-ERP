"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building,
  Calendar,
  BookOpen,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Download,
  ShieldCheck,
  Check,
  Layers,
  FolderTree,
  Lock,
  Sparkles,
  HelpCircle,
  FileText,
  Package,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { STANDARD_COA_DEFINITIONS } from "@/lib/constants/chartOfAccountsHierarchy";

export default function SetupWizardPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Setup Data State
  const [settings, setSettings] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tbStatus, setTbStatus] = useState<any>({ totalDebits: 0, totalCredits: 0, variance: 0, isInBalance: true });
  const [counts, setCounts] = useState<any>({ customers: 0, vendors: 0, products: 0 });
  const [isReadyToGoLive, setIsReadyToGoLive] = useState<boolean>(false);

  // Form State - Step 1: Company Profile
  const [legalName, setLegalName] = useState("Workman Services (Pvt) Ltd");
  const [tradeName, setTradeName] = useState("Workman Services");
  const [ntnNumber, setNtnNumber] = useState("9482710-3");
  const [strnNumber, setStrnNumber] = useState("3277876123456");
  const [addressText, setAddressText] = useState("Main Boulevard, Gulberg III, Lahore, Pakistan");
  const [phone, setPhone] = useState("042-111-WORKMAN");
  const [email, setEmail] = useState("finance@workmanservices.pk");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(7); // July

  // Form State - Step 3: Opening Balances
  const [goLiveDate, setGoLiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openingBalances, setOpeningBalances] = useState<Record<string, { debit: string; credit: string }>>({});

  // Form State - Step 4: Master Data Import
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
        setIsReadyToGoLive(data.isReadyToGoLive);

        if (data.settings) {
          setLegalName(data.settings.legalName || "Workman Services (Pvt) Ltd");
          setTradeName(data.settings.tradeName || "Workman Services");
          setNtnNumber(data.settings.ntnNumber || "");
          setStrnNumber(data.settings.strnNumber || "");
          setAddressText(data.settings.addressText || "");
          setPhone(data.settings.phone || "");
          setEmail(data.settings.email || "");
          setFiscalYearStartMonth(data.settings.fiscalYearStartMonth || 7);
        }

        // Initialize empty opening balances
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

  // Step 1 Submit
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
      setSuccessMsg("Company profile saved & 12 fiscal periods seeded successfully!");
      await loadSetupStatus();
      setCurrentStep(2);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3 Calculations
  const calculatedTotals = React.useMemo(() => {
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
      equityOffsetSide: diff > 0 ? "Credit 3900 Equity" : diff < 0 ? "Debit 3900 Equity" : "Zero (Exact Balance)",
    };
  }, [openingBalances]);

  // Step 3 Submit
  const handlePostOpeningBalances = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const rows = [];
      for (const code in openingBalances) {
        const d = parseFloat(openingBalances[code]?.debit) || 0;
        const c = parseFloat(openingBalances[code]?.credit) || 0;
        if (d > 0 || c > 0) {
          rows.push({ accountCode: code, debit: d, credit: c });
        }
      }

      if (rows.length === 0) {
        throw new Error("Please enter at least one opening balance.");
      }

      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "post_opening_balances",
          balances: rows,
          goLiveDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post opening balances");
      setSuccessMsg(data.message);
      await loadSetupStatus();
      setCurrentStep(4);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 4 Quick Import
  const handleImportCsv = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        throw new Error("Please enter at least one data row below header.");
      }

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        const rowObj: any = {};
        header.forEach((h, idx) => {
          rowObj[h] = parts[idx];
        });
        rows.push(rowObj);
      }

      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_master_data",
          dataType: importType,
          rows,
        }),
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

  // Step 5 Complete Go-Live
  const handleCompleteGoLive = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_setup",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign off setup");
      setSuccessMsg("Enterprise setup complete! Operational ERP modules are now live.");
      await loadSetupStatus();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#18181B] font-sans pb-20">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E4E4E7] px-6 py-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#18181B] flex items-center gap-2">
                Enterprise Onboarding & Go-Live Setup Wizard
                {settings?.isSetupCompleted && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-[#065F46] font-bold border border-emerald-200">
                    Live Verified
                  </span>
                )}
              </h1>
              <p className="text-xs text-[#71717A]">
                Guided 5-step SAP/GAAP compliance setup: Company profile, 4-level Chart of Accounts, and opening trial balance.
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

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Step Indicator Bar */}
        <div className="bg-white rounded-2xl border border-[#E4E4E7] p-4 shadow-xs">
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              { num: 1, label: "1. Company Profile", icon: Building },
              { num: 2, label: "2. 4-Level COA Guide", icon: BookOpen },
              { num: 3, label: "3. Opening Balances", icon: DollarSign },
              { num: 4, label: "4. Master Data Import", icon: Users },
              { num: 5, label: "5. Go-Live Sign-off", icon: ShieldCheck },
            ].map((s) => {
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

        {/* Notifications */}
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

        {/* ========================================================================= */}
        {/* STEP 1: COMPANY PROFILE & FISCAL CALENDAR                                */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4">
              <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-[#0D7A5F]" />
                Step 1: Company Profile, Tax IDs & Fiscal Calendar
              </h2>
              <p className="text-xs text-[#71717A] mt-1">
                Configure legal entity information. Saving automatically generates 12 open monthly fiscal periods.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Legal Company Name:</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-bold text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Trade / Brand Name:</label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">National Tax Number (NTN):</label>
                <input
                  type="text"
                  placeholder="e.g. 9482710-3"
                  value={ntnNumber}
                  onChange={(e) => setNtnNumber(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-mono text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Sales Tax Registration (STRN):</label>
                <input
                  type="text"
                  placeholder="e.g. 3277876123456"
                  value={strnNumber}
                  onChange={(e) => setStrnNumber(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-mono text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Official Helpline / Phone:</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Finance Official Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[#71717A] font-semibold block mb-1">Registered Head Office Address:</label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">
                  Fiscal Year Starting Month:
                </label>
                <select
                  value={fiscalYearStartMonth}
                  onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-bold text-xs"
                >
                  <option value={7}>July (Pakistan Tax Year standard: July 1 - June 30)</option>
                  <option value={1}>January (Calendar Year standard: Jan 1 - Dec 31)</option>
                </select>
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Functional Base Currency:</label>
                <input
                  type="text"
                  disabled
                  value="PKR (Pakistani Rupee) — Pure Single-Currency Standard"
                  className="w-full bg-[#F4F4F5] border border-[#E4E4E7] text-[#71717A] rounded-xl p-2.5 font-bold text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {isSubmitting ? "Saving & Seeding Periods..." : "Save Profile & Continue to COA Guide"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: UNDERSTANDING THE 4-LEVEL CHART OF ACCOUNTS (COA)                  */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4">
              <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0D7A5F]" />
                Step 2: Understanding the 4-Level Chart of Accounts (COA)
              </h2>
              <p className="text-xs text-[#71717A] mt-1">
                Rather than forcing a basic template, Workman Services provides the full GAAP 4-tier hierarchy. Here is how your financial data is structured:
              </p>
            </div>

            {/* 4 Cards Educational Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-blue-950">
                  <span>Level 1: Category</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 font-mono uppercase">Header</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  The 5 fundamental GAAP pillars: <strong>Assets (1000)</strong>, <strong>Liabilities (2000)</strong>, <strong>Equity (3000)</strong>, <strong>Revenue (4000)</strong>, and <strong>Expenses (6000)</strong>. Non-posting containers.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-purple-950">
                  <span>Level 2: Type</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 font-mono uppercase">Sub-Group</span>
                </div>
                <p className="text-[11px] text-purple-900 leading-relaxed">
                  Broad sub-groupings: <strong>Current Assets</strong> vs <strong>Fixed Assets</strong>, <strong>Current Liabilities</strong>, <strong>COGS</strong>, and <strong>Operating Expenses</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-amber-950">
                  <span>Level 3: Sub-Type</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono uppercase">Control Parent</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Parent control groups: <strong>Cash & Bank Equivalents</strong>, <strong>Trade Receivables</strong>, <strong>Inventories</strong>, <strong>Utilities & Office Costs</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-bold text-emerald-950">
                  <span>Level 4: Transactional</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono font-bold uppercase">Posting Ready</span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
                  The active ledgers: <strong>1000 Cash Drawer</strong>, <strong>1010 Meezan Bank</strong>, <strong>1100 AR</strong>, <strong>6201 Internet</strong>, <strong>6202 Printer Ink</strong>. All journals post here!
                </p>
              </div>
            </div>

            {/* Tree Preview */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E4E4E7] space-y-2">
              <span className="text-xs font-bold text-[#18181B] block">
                Active Chart of Accounts Overview ({accounts.length} Level 4 Ledgers Provisioned):
              </span>
              <div className="max-h-60 overflow-y-auto font-mono text-xs divide-y divide-[#EDEDED] bg-white rounded-lg border border-[#E4E4E7]">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-2.5 flex items-center justify-between hover:bg-[#F4F4F5]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0D7A5F]">{acc.code}</span>
                      <span className="text-[#18181B] font-medium">{acc.name}</span>
                    </div>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7]">
                      {acc.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A] hover:bg-[#F4F4F5]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                I Understand the 4-Level COA — Enter Opening Balances
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: OPENING BALANCES ENTRY (OFFSET TO 3900 EQUITY)                     */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
                  Step 3: Opening Balances Entry & Go-Live Cutover Date
                </h2>
                <p className="text-xs text-[#71717A] mt-1">
                  Enter starting balances for active Level 4 accounts. The system automatically offsets the net difference into <strong>Account 3900 Opening Balance Equity</strong> so books balance from day one!
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

            {/* Live Equilibrium Monitor Card */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block">Balanced Opening Voucher Math:</span>
                <span className="text-xs text-emerald-800">
                  Total Debits: <strong>{formatCurrency(calculatedTotals.totalDebits)}</strong> | Total Credits: <strong>{formatCurrency(calculatedTotals.totalCredits)}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-900 block">Automatic Offset:</span>
                <span className="font-mono font-bold text-sm text-[#065F46]">
                  {calculatedTotals.equityOffsetSide} ({formatCurrency(Math.abs(calculatedTotals.difference))})
                </span>
              </div>
            </div>

            {/* Accounts Opening Balance Grid */}
            <div className="max-h-96 overflow-y-auto border border-[#E4E4E7] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account Title</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-4 text-right">Debit (PKR)</th>
                    <th className="py-2.5 px-4 text-right">Credit (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {accounts
                    .filter((a) => a.code !== "3900") // Skip equity offset account itself
                    .map((acc) => {
                      const isNormalDebit = ["asset", "expense", "contra_revenue"].includes(acc.type);
                      return (
                        <tr key={acc.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-2 px-4 font-mono font-bold text-[#0D7A5F]">{acc.code}</td>
                          <td className="py-2 px-4 text-[#18181B] font-medium">{acc.name}</td>
                          <td className="py-2 px-3 capitalize text-[#71717A]">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#F4F4F5] border border-[#E4E4E7]">
                              {acc.type}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              placeholder={isNormalDebit ? "0" : ""}
                              value={openingBalances[acc.code]?.debit || ""}
                              onChange={(e) => {
                                setOpeningBalances((prev) => ({
                                  ...prev,
                                  [acc.code]: {
                                    debit: e.target.value,
                                    credit: e.target.value ? "" : prev[acc.code]?.credit || "",
                                  },
                                }));
                              }}
                              className="w-32 bg-[#F9FAFB] border border-[#D4D4D8] rounded-lg p-1.5 text-right font-mono text-xs outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              placeholder={!isNormalDebit ? "0" : ""}
                              value={openingBalances[acc.code]?.credit || ""}
                              onChange={(e) => {
                                setOpeningBalances((prev) => ({
                                  ...prev,
                                  [acc.code]: {
                                    credit: e.target.value,
                                    debit: e.target.value ? "" : prev[acc.code]?.debit || "",
                                  },
                                }));
                              }}
                              className="w-32 bg-[#F9FAFB] border border-[#D4D4D8] rounded-lg p-1.5 text-right font-mono text-xs outline-hidden"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePostOpeningBalances}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {isSubmitting ? "Posting Opening Voucher..." : "Post Opening Balances & Continue"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: MASTER DATA IMPORT (CUSTOMERS, VENDORS, INVENTORY)                 */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0D7A5F]" />
                  Step 4: Master Data Import (CSV / Batch)
                </h2>
                <p className="text-xs text-[#71717A] mt-1">
                  Import existing customer lists, vendors (with customizable WHT rates), and inventory items.
                </p>
              </div>

              <div className="flex gap-1.5 p-1 bg-[#F4F4F5] rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setImportType("customers");
                    setCsvText("name,phone,email,address\nPackages Mall HVAC,042-35889001,admin@packages.pk,Ferozepur Road Lahore\nNishat Hotel Gulberg,042-111-647428,ops@nishat.com,Gulberg III Lahore");
                  }}
                  className={cn("px-3 py-1.5 rounded-lg transition", importType === "customers" ? "bg-white text-[#0D7A5F] shadow-xs" : "text-[#71717A]")}
                >
                  Customers ({counts.customers})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportType("vendors");
                    setCsvText("name,contactPerson,phone,email,ntn,whtRate,whtExempt\nEmirates Refrigeration Supplies,Tariq Mahmood,042-37289110,sales@ers.com.pk,9482100-1,8.0,false\nDanfoss FZE Pakistan,Asim Munir,042-111-326367,info@danfoss.com.pk,8271920-4,11.0,false");
                  }}
                  className={cn("px-3 py-1.5 rounded-lg transition", importType === "vendors" ? "bg-white text-[#0D7A5F] shadow-xs" : "text-[#71717A]")}
                >
                  Vendors ({counts.vendors})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportType("inventory");
                    setCsvText("sku,name,unit,costPrice,unitPrice,stockQuantity\nCAP-45UF,45uF Motor Run Capacitor,pcs,450,750,50\nGAS-R410A,R410A Refrigerant Gas Cylinder (11.3kg),cylinder,18500,24000,12");
                  }}
                  className={cn("px-3 py-1.5 rounded-lg transition", importType === "inventory" ? "bg-white text-[#0D7A5F] shadow-xs" : "text-[#71717A]")}
                >
                  Inventory Items ({counts.products})
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="text-[#71717A] font-semibold block">
                Paste CSV formatted rows below (Header line required):
              </label>
              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="header1,header2,header3..."
                className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-3 font-mono text-xs outline-hidden"
              />

              <button
                type="button"
                onClick={handleImportCsv}
                disabled={isSubmitting || !csvText.trim()}
                className="px-4 py-2 bg-[#18181B] hover:bg-black text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {isSubmitting ? "Importing..." : `Import ${importType.toUpperCase()} Batch`}
              </button>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                Continue to Go-Live Sign-Off
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: GO-LIVE SIGN-OFF & VERIFICATION CHECKLIST                          */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
            <div className="border-b border-[#E4E4E7] pb-4">
              <h2 className="text-sm font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                Step 5: Go-Live Readiness Verification Checklist
              </h2>
              <p className="text-xs text-[#71717A] mt-1">
                Before operational workflows (Job intake, POS counter terminal, and expenses) are unlocked, verify that all financial prerequisites are satisfied:
              </p>
            </div>

            {/* Verification Items */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-950 block">1. Company Profile & Tax Registration</span>
                    <span className="text-[11px] text-emerald-800">{settings?.legalName} (NTN: {settings?.ntnNumber || "Set"})</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">VERIFIED</span>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-950 block">2. Fiscal Year & Monthly Periods</span>
                    <span className="text-[11px] text-emerald-800">{periods.length} Open Fiscal Periods Initialized</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">VERIFIED</span>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-950 block">3. 4-Level Chart of Accounts Hierarchy</span>
                    <span className="text-[11px] text-emerald-800">{accounts.length} Level 4 Transactional Ledgers Active</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">VERIFIED</span>
              </div>

              <div className={cn("p-3 rounded-xl border flex items-center justify-between", tbStatus.isInBalance ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
                <div className="flex items-center gap-2.5">
                  {tbStatus.isInBalance ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                  <div>
                    <span className={cn("font-bold block", tbStatus.isInBalance ? "text-emerald-950" : "text-rose-950")}>
                      4. Trial Balance Equilibrium ($\sum Debits == \sum Credits$)
                    </span>
                    <span className={cn("text-[11px]", tbStatus.isInBalance ? "text-emerald-800" : "text-rose-800")}>
                      Debits: {formatCurrency(tbStatus.totalDebits)} | Credits: {formatCurrency(tbStatus.totalCredits)} (Variance: PKR {tbStatus.variance})
                    </span>
                  </div>
                </div>
                <span className={cn("text-[10px] font-bold font-mono px-2 py-0.5 rounded", tbStatus.isInBalance ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900")}>
                  {tbStatus.isInBalance ? "IN EQUILIBRIUM" : "UNBALANCED"}
                </span>
              </div>
            </div>

            {/* Final Sign-Off Action */}
            <div className="p-6 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7] text-center space-y-3">
              {settings?.isSetupCompleted ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Setup Officially Signed Off & Operational!
                  </div>
                  <p className="text-xs text-[#71717A]">
                    Go-live cutover active since {settings.goLiveDate ? new Date(settings.goLiveDate).toLocaleDateString() : "Today"}.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <Link
                      href="/accounts"
                      className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Open Accounts Suite
                    </Link>
                    <Link
                      href="/pos"
                      className="px-5 py-2.5 bg-[#18181B] hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Open POS Terminal
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#18181B]">
                    Click below to lock in the setup and unlock all live ERP modules:
                  </p>
                  <button
                    type="button"
                    onClick={handleCompleteGoLive}
                    disabled={isSubmitting || !tbStatus.isInBalance}
                    className="px-6 py-3 bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition inline-flex items-center gap-2"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    {isSubmitting ? "Signing off..." : "Sign Off Setup & Go Live"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-start pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold text-[#71717A]"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
