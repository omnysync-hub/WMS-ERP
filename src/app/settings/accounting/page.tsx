"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderTree,
  Sliders,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Settings,
  UserCheck,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import CoaManagerTree from "@/components/accounts/CoaManagerTree";
import AccountMappingTab from "@/components/accounts/AccountMappingTab";

export default function AccountingSettingsPage() {
  const { activeRole, currentPersona, setRole } = useRole();
  const [activeSection, setActiveSection] = useState<"coa" | "mappings" | "suggestions">("coa");
  const [targetMappingType, setTargetMappingType] = useState<string>("");

  // COA Hierarchy Data
  const [coaTree, setCoaTree] = useState<any[]>([]);
  const [coaFlat, setCoaFlat] = useState<any[]>([]);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [coaLoading, setCoaLoading] = useState(true);

  // Mappings & Suggestions Summary Badges
  const [completenessBadge, setCompletenessBadge] = useState<string>("");
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState<number>(0);

  const loadCoaData = useCallback(async () => {
    setCoaLoading(true);
    try {
      const [chartRes, mappingRes, suggestionsRes] = await Promise.all([
        fetch("/api/accounts?view=chart"),
        fetch("/api/accounts?view=account_mappings"),
        fetch("/api/accounts?view=mapping_suggestions&status=pending"),
      ]);

      const chartData = await chartRes.json();
      const mappingData = await mappingRes.json();
      const suggestionsData = await suggestionsRes.json();

      if (chartData.success) {
        setCoaTree(chartData.tree || []);
        setCoaFlat(chartData.flat || []);
        setRawAccounts(chartData.rawAccounts || []);
      }

      if (mappingData.success && mappingData.completeness) {
        const c = mappingData.completeness;
        setCompletenessBadge(`${c.configured}/${c.total} (${c.percentage}%)`);
      }

      if (suggestionsData.success && Array.isArray(suggestionsData.suggestions)) {
        setPendingSuggestionsCount(suggestionsData.suggestions.length);
      }
    } catch (err) {
      console.error("Failed to load accounting settings data:", err);
    } finally {
      setCoaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoaData();
  }, [loadCoaData]);

  // Handle navigate from COA deactivation guard directly to mapping
  const handleNavigateToMapping = (transactionType?: string) => {
    if (transactionType) {
      setTargetMappingType(transactionType);
    }
    setActiveSection("mappings");
  };

  // =========================================================================
  // RBAC GATING: RESTRICTED TO ADMIN ROLE ONLY
  // =========================================================================
  if (activeRole !== "admin") {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in">
        <PageHeader
          title="Accounting Settings & System Controls"
          subtitle="Chart of Accounts Hierarchy, Automated Posting Mappings, and AI Transaction Governance"
        />

        <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-base font-bold text-zinc-900">
              Administrator Clearance Required
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              You are currently browsing with the <strong>{currentPersona.name}</strong> persona (
              <span className="font-semibold">{currentPersona.designation}</span>). Modification of Chart of Accounts
              structures, general ledger routing, and transactional posting rules is strictly restricted to Managing
              Directors and Executive Administrators.
            </p>
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setRole("admin")}
              className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              Switch to Haris Qureshi (Admin)
            </button>
            <Link
              href="/dashboards"
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold transition"
            >
              Return to Dashboards Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Breadcrumbs & Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <Link href="/accounts" className="hover:text-zinc-600 transition">
            Finance & Accounts
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-900 font-bold">Accounting Settings</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0D7A5F] flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </span>
              Accounting Settings & Governance
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Manage enterprise 4-level Chart of Accounts, strict double-entry transaction mappings, and AI review proposals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadCoaData}
              disabled={coaLoading}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5 transition shadow-2xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-500", coaLoading && "animate-spin")} />
              Sync State
            </button>

            <Link
              href="/accounts"
              className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5 transition shadow-2xs"
            >
              Daily Ledgers & Cashbook
              <ArrowRight className="w-3 h-3 text-zinc-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-100/80 rounded-2xl border border-zinc-200/80">
        {/* Tab 1: Chart of Accounts */}
        <button
          type="button"
          onClick={() => setActiveSection("coa")}
          className={cn(
            "flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs",
            activeSection === "coa"
              ? "bg-white text-[#0D7A5F] shadow-sm ring-1 ring-black/5"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
          )}
        >
          <FolderTree className="w-4 h-4" />
          <span>Chart of Accounts Manager</span>
          {coaFlat.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-100 text-zinc-700">
              {coaFlat.length} accounts
            </span>
          )}
        </button>

        {/* Tab 2: Account Mapping */}
        <button
          type="button"
          onClick={() => {
            setActiveSection("mappings");
            setTargetMappingType("");
          }}
          className={cn(
            "flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs",
            activeSection === "mappings"
              ? "bg-white text-[#0D7A5F] shadow-sm ring-1 ring-black/5"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
          )}
        >
          <Sliders className="w-4 h-4" />
          <span>Account Mappings</span>
          {completenessBadge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {completenessBadge}
            </span>
          )}
        </button>

        {/* Tab 3: AI Suggestion Queue */}
        <button
          type="button"
          onClick={() => setActiveSection("suggestions")}
          className={cn(
            "flex-1 min-w-[200px] flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs",
            activeSection === "suggestions"
              ? "bg-white text-[#0D7A5F] shadow-sm ring-1 ring-black/5"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
          )}
        >
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>AI Suggestion Queue</span>
          {pendingSuggestionsCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-900 font-bold animate-pulse">
              {pendingSuggestionsCount} pending
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-100 text-zinc-600">
              Clean
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CHART OF ACCOUNTS MANAGER                                      */}
      {/* ========================================================================= */}
      {activeSection === "coa" && (
        <CoaManagerTree
          tree={coaTree}
          flat={coaFlat}
          rawAccounts={rawAccounts}
          onRefresh={loadCoaData}
          onNavigateToMapping={handleNavigateToMapping}
        />
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: ACCOUNT MAPPING MANAGER                                        */}
      {/* ========================================================================= */}
      {activeSection === "mappings" && (
        <div className="space-y-4">
          <AccountMappingTab
            initialSubTab="mappings"
            targetTransactionType={targetMappingType}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: AI SUGGESTION REVIEW QUEUE                                     */}
      {/* ========================================================================= */}
      {activeSection === "suggestions" && (
        <div className="space-y-4">
          <AccountMappingTab initialSubTab="suggestions" />
        </div>
      )}
    </div>
  );
}
