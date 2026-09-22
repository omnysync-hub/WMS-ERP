"use client";

import React, { useEffect, useState } from "react";
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
  XCircle,
  Lightbulb,
  History,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  isSystem: boolean;
  isActive: boolean;
}

interface MappingItem {
  transactionType: string;
  name: string;
  domain: string;
  description: string;
  defaultDebitOrCredit: "debit" | "credit";
  allowedAccountTypes: string[];
  mappingId: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  isConfigured: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface CompletenessSummary {
  total: number;
  configured: number;
  percentage: number;
  isComplete: boolean;
  missing: string[];
}

interface SuggestionItem {
  id: string;
  transactionType: string;
  transactionTypeName: string;
  domain: string;
  currentAccountId: string | null;
  currentAccountCode: string | null;
  currentAccountName: string | null;
  suggestedAccountId: string;
  suggestedAccountCode: string;
  suggestedAccountName: string;
  suggestedAccountType: string;
  confidenceScore: number;
  confidencePercentage: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  rationale: string;
  sourceTransactionIds: string[];
  sampleDescriptions: string[];
  totalAmountSampled: number;
  status: "pending" | "accepted" | "rejected" | "skipped";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface AccountMappingTabProps {
  initialSubTab?: "mappings" | "suggestions";
  targetTransactionType?: string;
}

export default function AccountMappingTab({
  initialSubTab = "mappings",
  targetTransactionType = "",
}: AccountMappingTabProps = {}) {
  const [activeSubTab, setActiveSubTab] = useState<"mappings" | "suggestions">(initialSubTab);
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessSummary | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [customOverrides, setCustomOverrides] = useState<Record<string, string>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Filters for standard mappings
  const [searchQuery, setSearchQuery] = useState(targetTransactionType);
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIGURED" | "UNSET">("ALL");

  // Filters for suggestions
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<"pending" | "accepted" | "skipped" | "ALL">("pending");

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingRes, chartRes, suggestionsRes] = await Promise.all([
        fetch("/api/accounts?view=account_mappings"),
        fetch("/api/accounts?view=chart"),
        fetch("/api/accounts?view=mapping_suggestions&status=ALL"),
      ]);

      const mappingData = await mappingRes.json();
      const chartData = await chartRes.json();
      const suggestionsData = await suggestionsRes.json();

      if (mappingData.success) {
        setMappings(mappingData.mappings || []);
        setCompleteness(mappingData.completeness || null);
      }

      if (chartData.success) {
        setAccounts(chartData.rawAccounts || []);
      }

      if (suggestionsData.success) {
        setSuggestions(suggestionsData.suggestions || []);
      }
    } catch (err: any) {
      setErrorToast(err.message || "Failed to load mapping data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateMapping = async (transactionType: string, newAccountId: string) => {
    if (!newAccountId) return;
    setSavingKey(transactionType);
    setErrorToast(null);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_account_mapping",
          transactionType,
          accountId: newAccountId,
          companyId: "DEFAULT",
          actorName: "Admin User",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save mapping");
      }

      // Update local state
      const targetAccount = accounts.find((a) => a.id === newAccountId);
      setMappings((prev) =>
        prev.map((m) =>
          m.transactionType === transactionType
            ? {
                ...m,
                accountId: newAccountId,
                accountCode: targetAccount?.code || null,
                accountName: targetAccount?.name || null,
                accountType: targetAccount?.type || null,
                isConfigured: true,
                updatedAt: new Date().toISOString(),
                updatedBy: "Admin User",
              }
            : m
        )
      );

      // Recompute completeness
      setCompleteness((prev) => {
        if (!prev) return null;
        const nowConfigured = mappings.filter(
          (m) => (m.transactionType === transactionType ? true : m.isConfigured)
        ).length;
        return {
          ...prev,
          configured: nowConfigured,
          percentage: Math.round((nowConfigured / prev.total) * 100),
          isComplete: nowConfigured === prev.total,
        };
      });

      setSuccessToast(`Mapping for "${transactionType}" saved successfully.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorToast(err.message);
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setSavingKey(null);
    }
  };

  const handleScanTransactions = async () => {
    setIsScanning(true);
    setErrorToast(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scan_suggestions",
          companyId: "DEFAULT",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to scan transactions");
      }

      await loadData();
      setSuccessToast(
        `AI scan complete. Evaluated ${data.scannedCount} transactions. Found ${data.newSuggestionsCount} new proposals.`
      );
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || "Failed to scan transactions");
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setIsScanning(false);
    }
  };

  const handleReviewSuggestion = async (
    auditId: string,
    action: "accept" | "skip" | "reject",
    overrideAccountId?: string
  ) => {
    setReviewingId(auditId);
    setErrorToast(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_suggestion",
          auditId,
          decision: action,
          overrideAccountId,
          companyId: "DEFAULT",
          actorName: "Admin User",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to review suggestion");
      }

      // Update local suggestions
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === auditId
            ? {
                ...s,
                status: action === "accept" ? "accepted" : action === "skip" ? "skipped" : "rejected",
                reviewedBy: "Admin User",
                reviewedAt: new Date().toISOString(),
              }
            : s
        )
      );

      // If accepted, reload mappings to update GL account code
      if (action === "accept") {
        await loadData();
      }

      setSuccessToast(
        action === "accept"
          ? "Suggestion accepted! Chart of Accounts mapping updated."
          : `Suggestion marked as ${action}.`
      );
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorToast(err.message || "Failed to process review");
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setReviewingId(null);
    }
  };

  const handleAcceptAllHighConfidence = async () => {
    setIsAcceptingAll(true);
    setErrorToast(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept_high_confidence",
          companyId: "DEFAULT",
          actorName: "Admin User",
          threshold: 0.85,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to accept high confidence suggestions");
      }

      await loadData();
      setSuccessToast(`Accepted ${data.acceptedCount} high-confidence suggestion(s) successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || "Failed to accept high confidence suggestions");
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const domains = Array.from(new Set(mappings.map((m) => m.domain)));

  const filteredMappings = mappings.filter((m) => {
    const matchesSearch =
      !searchQuery.trim() ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      m.transactionType.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (m.accountCode && m.accountCode.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
      (m.accountName && m.accountName.toLowerCase().includes(searchQuery.toLowerCase().trim()));

    const matchesDomain = selectedDomain === "ALL" || m.domain === selectedDomain;

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "CONFIGURED" && m.isConfigured) ||
      (statusFilter === "UNSET" && !m.isConfigured);

    return matchesSearch && matchesDomain && matchesStatus;
  });

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const highConfidencePending = pendingSuggestions.filter((s) => s.confidenceScore >= 0.85);

  const filteredSuggestions = suggestions.filter((s) => {
    if (suggestionStatusFilter === "ALL") return true;
    return s.status === suggestionStatusFilter;
  });

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Toast Notifications */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#0D7A5F] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successToast}
        </div>
      )}
      {errorToast && (
        <div className="fixed top-5 right-5 z-50 bg-rose-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4" />
          {errorToast}
        </div>
      )}

      {/* Header & Sub-Navigation Card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E4E4E7]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B] uppercase tracking-wider">
                  Settings · Enterprise Account Mapping Engine
                </h3>
                <p className="text-xs text-[#71717A]">
                  Configurable dispatch layer connecting operational transactions to the Chart of Accounts, backed by an AI Suggestion Agent.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanTransactions}
              disabled={isScanning || loading}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Sparkles className={cn("w-3.5 h-3.5", isScanning && "animate-spin")} />
              {isScanning ? "Scanning Transactions..." : "Scan Transactions"}
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-[#EDEDED] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-[#0D7A5F]")} />
              Refresh
            </button>
          </div>
        </div>

        {/* View Toggle Bar (Standard Mappings vs AI Review Queue) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="inline-flex p-1 bg-[#F4F4F5] rounded-xl border border-[#EDEDED]">
            <button
              type="button"
              onClick={() => setActiveSubTab("mappings")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition",
                activeSubTab === "mappings"
                  ? "bg-white text-[#18181B] shadow-xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Account Mappings
              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-[#F4F4F5] rounded text-[#71717A]">
                {mappings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("suggestions")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition relative",
                activeSubTab === "suggestions"
                  ? "bg-white text-[#18181B] shadow-xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              AI Review Queue
              {pendingSuggestions.length > 0 && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-amber-500 text-white rounded-full">
                  {pendingSuggestions.length}
                </span>
              )}
            </button>
          </div>

          {/* Completeness Summary (Small Pill) */}
          {completeness && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#71717A]">Completeness:</span>
              <span
                className={cn(
                  "font-mono font-bold px-2 py-0.5 rounded text-[11px]",
                  completeness.isComplete
                    ? "bg-emerald-100 text-[#065F46]"
                    : "bg-amber-100 text-amber-900"
                )}
              >
                {completeness.configured} of {completeness.total} ({completeness.percentage}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: STANDARD MAPPINGS LIST                                        */}
      {/* ========================================================================= */}
      {activeSubTab === "mappings" && (
        <div className="space-y-4">
          {/* Completeness Diagnostic Card */}
          {completeness && (
            <div className="p-4 rounded-xl bg-white border border-[#E4E4E7] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-[#18181B]">
                    <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                    Mapping Completeness Diagnostic
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-mono font-bold",
                      completeness.isComplete
                        ? "bg-emerald-100 text-[#065F46]"
                        : "bg-amber-100 text-amber-900"
                    )}
                  >
                    {completeness.configured} of {completeness.total} Configured ({completeness.percentage}%)
                  </span>
                </div>

                <div className="w-full h-2 bg-[#E4E4E7] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      completeness.isComplete ? "bg-[#0D7A5F]" : "bg-amber-500"
                    )}
                    style={{ width: `${completeness.percentage}%` }}
                  />
                </div>
              </div>

              <div className="text-right shrink-0">
                {completeness.isComplete ? (
                  <div className="text-[11px] font-bold text-[#065F46] inline-flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <Check className="w-3.5 h-3.5" /> All Operational Paths Mapped
                  </div>
                ) : (
                  <div className="text-[11px] font-bold text-amber-800 inline-flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Unmapped Postings Will Be Blocked
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#18181B] focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Operational Domains</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#18181B] focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIGURED">Configured Only</option>
                <option value="UNSET">Unset / Incomplete</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                placeholder="Search transaction or account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F4F4F5] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Domain Groupings */}
          <div className="space-y-4">
            {domains
              .filter((domain) => selectedDomain === "ALL" || selectedDomain === domain)
              .map((domain) => {
                const domainItems = filteredMappings.filter((m) => m.domain === domain);
                if (domainItems.length === 0) return null;

                return (
                  <div key={domain} className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
                    <div className="px-5 py-3 bg-[#F4F4F5] border-b border-[#E4E4E7] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#0D7A5F]" />
                        <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                          {domain}
                        </h4>
                        <span className="text-[10px] bg-white border border-[#E4E4E7] font-mono px-1.5 py-0.2 rounded text-[#71717A]">
                          {domainItems.length} transactions
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#EDEDED]">
                      {domainItems.map((item) => {
                        const isSaving = savingKey === item.transactionType;
                        const compatibleAccounts = accounts.filter(
                          (acc) =>
                            acc.level === 4 &&
                            acc.isActive &&
                            (item.allowedAccountTypes.length === 0 ||
                              item.allowedAccountTypes.includes(acc.type))
                        );

                        return (
                          <div
                            key={item.transactionType}
                            className="p-4 hover:bg-[#FAFAFA] transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#18181B]">
                                  {item.name}
                                </span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#F4F4F5] text-[#71717A] rounded border border-[#E4E4E7]">
                                  {item.transactionType}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border font-mono",
                                    item.defaultDebitOrCredit === "debit"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-purple-50 text-purple-700 border-purple-200"
                                  )}
                                >
                                  Normal: {item.defaultDebitOrCredit.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#71717A] leading-relaxed">
                                {item.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex flex-col text-right">
                                <span className="text-[10px] text-[#A1A1AA] uppercase font-mono">
                                  Mapped GL Account
                                </span>
                                {item.accountCode ? (
                                  <span className="text-xs font-bold font-mono text-[#0D7A5F]">
                                    {item.accountCode}
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-amber-600">
                                    Unmapped
                                  </span>
                                )}
                              </div>

                              <div className="w-64 sm:w-80">
                                <select
                                  value={item.accountId || ""}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    handleUpdateMapping(item.transactionType, e.target.value)
                                  }
                                  className={cn(
                                    "w-full text-xs font-medium rounded-lg border px-2.5 py-2 transition focus:outline-none",
                                    item.isConfigured
                                      ? "bg-white border-[#EDEDED] text-[#18181B] focus:border-[#0D7A5F]"
                                      : "bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500 font-semibold"
                                  )}
                                >
                                  <option value="" disabled>
                                    -- Select Chart of Account Target --
                                  </option>
                                  {compatibleAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.code} — {acc.name} ({acc.type})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {isSaving && (
                                <div className="w-5 h-5 flex items-center justify-center">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0D7A5F]" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: AI SUGGESTION REVIEW QUEUE                                    */}
      {/* ========================================================================= */}
      {activeSubTab === "suggestions" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Agent Banner & Batch Action Bar */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-900 via-[#0D7A5F] to-teal-800 text-white shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    AI Transaction Suggestion Agent & Review Queue
                  </h4>
                </div>
                <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
                  Automated scanner parses historical journal entries, field expense vouchers, and stock notes to detect broad account allocations (e.g. 6100, 6200, 5000) and propose targeted Chart of Accounts splits with confidence scores.
                </p>
              </div>

              {/* Batch Action Button */}
              {highConfidencePending.length > 0 && (
                <button
                  type="button"
                  onClick={handleAcceptAllHighConfidence}
                  disabled={isAcceptingAll}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs flex items-center gap-2 shadow-md transition shrink-0"
                >
                  <CheckCheck className={cn("w-4 h-4", isAcceptingAll && "animate-spin")} />
                  {isAcceptingAll
                    ? "Applying High Confidence Mappings..."
                    : `Accept All High Confidence (${highConfidencePending.length})`}
                </button>
              )}
            </div>

            {/* Filter Toggle Pills */}
            <div className="flex items-center gap-2 pt-2 border-t border-emerald-700/50">
              <button
                type="button"
                onClick={() => setSuggestionStatusFilter("pending")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition",
                  suggestionStatusFilter === "pending"
                    ? "bg-white text-[#0D7A5F]"
                    : "bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800"
                )}
              >
                Pending Review ({pendingSuggestions.length})
              </button>

              <button
                type="button"
                onClick={() => setSuggestionStatusFilter("accepted")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition",
                  suggestionStatusFilter === "accepted"
                    ? "bg-white text-[#0D7A5F]"
                    : "bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800"
                )}
              >
                Accepted History (
                {suggestions.filter((s) => s.status === "accepted").length})
              </button>

              <button
                type="button"
                onClick={() => setSuggestionStatusFilter("skipped")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition",
                  suggestionStatusFilter === "skipped"
                    ? "bg-white text-[#0D7A5F]"
                    : "bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800"
                )}
              >
                Skipped (
                {suggestions.filter((s) => s.status === "skipped").length})
              </button>

              <button
                type="button"
                onClick={() => setSuggestionStatusFilter("ALL")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition",
                  suggestionStatusFilter === "ALL"
                    ? "bg-white text-[#0D7A5F]"
                    : "bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800"
                )}
              >
                All Records ({suggestions.length})
              </button>
            </div>
          </div>

          {/* Suggestion Cards */}
          {filteredSuggestions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0D7A5F] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#18181B]">
                Review Queue is Clear
              </h4>
              <p className="text-xs text-[#71717A] max-w-md mx-auto">
                No suggestions matching the selected filter. Click &ldquo;Scan Transactions&rdquo; above to run the AI pattern detector across recent activity.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSuggestions.map((item) => {
                const isReviewing = reviewingId === item.id;
                const selectedOverride = customOverrides[item.id] || item.suggestedAccountId;

                // Compatible accounts if user wants to change
                const compatibleAccounts = accounts.filter(
                  (acc) => acc.level === 4 && acc.isActive
                );

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "bg-white rounded-xl border p-5 shadow-xs transition space-y-4",
                      item.status === "pending"
                        ? "border-[#E4E4E7] hover:border-emerald-300"
                        : "border-[#EDEDED] bg-[#FAFAFA]"
                    )}
                  >
                    {/* Top Row: Domain, Title, Confidence Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDEDED]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7]">
                          {item.domain}
                        </span>
                        <h4 className="text-xs font-bold text-[#18181B]">
                          {item.transactionTypeName}
                        </h4>
                        <span className="font-mono text-[10px] text-[#71717A]">
                          ({item.transactionType})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Confidence Score Pill */}
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono inline-flex items-center gap-1",
                            item.confidenceLevel === "HIGH"
                              ? "bg-emerald-100 text-[#065F46] border border-emerald-200"
                              : item.confidenceLevel === "MEDIUM"
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                          )}
                        >
                          <TrendingUp className="w-3 h-3" />
                          {item.confidencePercentage}% Match · {item.confidenceLevel} Confidence
                        </span>

                        {/* Status Badge */}
                        {item.status !== "pending" && (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              item.status === "accepted"
                                ? "bg-emerald-50 text-[#0D7A5F] border border-emerald-200"
                                : item.status === "skipped"
                                ? "bg-zinc-100 text-zinc-600"
                                : "bg-rose-50 text-rose-600"
                            )}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Comparison (Current -> Suggested) */}
                    <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                      {/* Current Account */}
                      <div className="md:col-span-5 p-3 rounded-lg bg-[#F4F4F5] border border-[#EDEDED] space-y-1">
                        <span className="text-[10px] font-bold uppercase text-[#71717A] block font-mono">
                          Current Mapping
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#18181B]">
                            {item.currentAccountCode || "Unset"}
                          </span>
                          <span className="text-xs text-[#71717A] truncate">
                            {item.currentAccountName || "No account assigned"}
                          </span>
                        </div>
                      </div>

                      {/* Transition Icon */}
                      <div className="md:col-span-1 flex justify-center text-[#71717A]">
                        <ArrowRight className="w-4 h-4" />
                      </div>

                      {/* Suggested Account */}
                      <div className="md:col-span-5 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-[#065F46] block font-mono">
                          AI Suggested Target
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#0D7A5F]">
                            {item.suggestedAccountCode}
                          </span>
                          <span className="text-xs font-bold text-[#18181B] truncate">
                            {item.suggestedAccountName}
                          </span>
                          <span className="text-[10px] font-mono uppercase bg-white text-[#71717A] px-1.5 py-0.2 rounded border border-emerald-200">
                            {item.suggestedAccountType}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rationale & Keyword Evidence */}
                    <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#EDEDED] text-xs text-[#3F3F46] space-y-2">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="leading-relaxed font-medium">
                          {item.rationale}
                        </p>
                      </div>

                      {item.sampleDescriptions.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-mono text-[#71717A]">
                            Pattern triggers:
                          </span>
                          {item.sampleDescriptions.map((desc, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-white border border-[#E4E4E7] px-1.5 py-0.2 rounded font-mono text-[#71717A]"
                            >
                              #{desc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Review Action Controls (If Pending) */}
                    {item.status === "pending" && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#EDEDED]">
                        {/* Change Account Dropdown */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                          <span className="text-[11px] font-semibold text-[#71717A] shrink-0">
                            Customize:
                          </span>
                          <select
                            value={selectedOverride}
                            disabled={isReviewing}
                            onChange={(e) =>
                              setCustomOverrides((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-full text-xs font-medium rounded-lg border border-[#EDEDED] px-2 py-1.5 bg-white text-[#18181B] focus:outline-none focus:border-[#0D7A5F]"
                          >
                            <option value={item.suggestedAccountId}>
                              Use Suggested: {item.suggestedAccountCode} — {item.suggestedAccountName}
                            </option>
                            {compatibleAccounts
                              .filter((acc) => acc.id !== item.suggestedAccountId)
                              .map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} — {acc.name} ({acc.type})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReviewSuggestion(item.id, "skip")}
                            disabled={isReviewing}
                            className="px-3 py-1.5 rounded-lg border border-[#EDEDED] hover:bg-[#F4F4F5] text-xs font-semibold text-[#71717A] transition"
                          >
                            Skip
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleReviewSuggestion(item.id, "accept", selectedOverride)
                            }
                            disabled={isReviewing}
                            className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
                          >
                            <Check className={cn("w-3.5 h-3.5", isReviewing && "animate-spin")} />
                            {isReviewing ? "Applying..." : "Accept Suggestion"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Review Metadata (If Reviewed) */}
                    {item.status !== "pending" && item.reviewedBy && (
                      <div className="flex items-center gap-2 text-[11px] text-[#A1A1AA] pt-1">
                        <History className="w-3 h-3" />
                        <span>
                          Reviewed by {item.reviewedBy} on{" "}
                          {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : "recent"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
