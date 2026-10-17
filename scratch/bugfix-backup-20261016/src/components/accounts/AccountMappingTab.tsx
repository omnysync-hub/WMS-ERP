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
  ShieldCheck,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CoaAccountModal, { CoaModalAccount } from "./CoaAccountModal";
import toast from "@/lib/toast";

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

interface AccountMappingTabProps {
  initialSubTab?: string;
  targetTransactionType?: string;
  /** Compact layout for embedding inside the /setup wizard */
  setupMode?: boolean;
  /** Fired whenever completeness summary changes (setup gate) */
  onCompletenessChange?: (summary: CompletenessSummary | null) => void;
}

/** Preset "same as" groups for cash / bank quick-fill during onboarding */
const SAME_AS_GROUPS: Array<{ id: string; label: string; source: string; targets: string[] }> = [
  {
    id: "cash_vault",
    label: "Cash / Vault receiving & disbursing",
    source: "customer_payment_receiving",
    targets: [
      "customer_payment_receiving",
      "pos_sale_cash",
      "settlement_collection_vault",
      "expense_reimbursement_disbursing",
      "advance_granted_disbursing",
      "payroll_net_disbursing",
      "stock_in_disbursing",
      "tech_expense_settlement_vault",
    ],
  },
  {
    id: "bank_ops",
    label: "Operating bank (receipts & payments)",
    source: "bank_operating",
    targets: [
      "bank_operating",
      "vendor_payment_disbursing",
      "pos_sale_bank",
    ],
  },
  {
    id: "ar_control",
    label: "Accounts receivable control",
    source: "ar_control",
    targets: [
      "ar_control",
      "job_revenue_receivable",
      "customer_payment_receivable",
      "pos_sale_receivable",
      "settlement_collection_receivable",
    ],
  },
  {
    id: "ap_control",
    label: "Accounts payable control",
    source: "ap_control",
    targets: [
      "ap_control",
      "vendor_bill_payable",
      "grn_receipt_payable",
      "vendor_payment_payable",
    ],
  },
];

export default function AccountMappingTab({
  initialSubTab = "mappings",
  targetTransactionType = "",
  setupMode = false,
  onCompletenessChange,
}: AccountMappingTabProps = {}) {
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [applyingSameAs, setApplyingSameAs] = useState<string | null>(null);
  const setSuccessToast = (msg: string | null) => {
    if (msg) toast.success(msg);
  };
  const setErrorToast = (msg: string | null) => {
    if (msg) toast.error(msg);
  };
  const [createFor, setCreateFor] = useState<MappingItem | null>(null);

  // Filters for standard mappings
  const [searchQuery, setSearchQuery] = useState(targetTransactionType);
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIGURED" | "UNSET">("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingRes, chartRes] = await Promise.all([
        fetch("/api/accounts?view=account_mappings"),
        fetch("/api/accounts?view=chart"),
      ]);

      const mappingData = await mappingRes.json();
      const chartData = await chartRes.json();

      if (mappingData.success) {
        setMappings(mappingData.mappings || []);
        const nextCompleteness = mappingData.completeness || null;
        setCompleteness(nextCompleteness);
        onCompletenessChange?.(nextCompleteness);
      }

      if (chartData.success) {
        setAccounts(chartData.rawAccounts || []);
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

  useEffect(() => {
    onCompletenessChange?.(completeness);
  }, [completeness]);

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

  const handleInlineAccountCreated = async (account: CoaModalAccount) => {
    setCreateFor(null);
    await loadData();
    setSuccessToast(
      `Created ${account.code} — ${account.name} and mapped it to the selected software transaction.`
    );
    setTimeout(() => setSuccessToast(null), 4500);
  };

  const handleApplySameAs = async (groupId: string) => {
    const group = SAME_AS_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setApplyingSameAs(groupId);
    setErrorToast(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_same_as",
          sourceTransactionType: group.source,
          targetTransactionTypes: group.targets,
          companyId: "DEFAULT",
          actorName: "Setup Wizard",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to apply same-as fill");
      }
      await loadData();
      setSuccessToast(`Applied "${group.label}" to ${data.updated} transaction types (from ${data.accountCode}).`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || "Same-as fill failed");
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setApplyingSameAs(null);
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

  return (
    <div className="space-y-5 animate-in fade-in">
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
                  Configurable dispatch layer connecting operational transactions to the Chart of Accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {completeness && (
          <div className="flex items-center justify-between gap-3 pt-1 text-xs">
            <span className="font-semibold text-zinc-700">
              Transaction Rules ({mappings.length})
            </span>
            <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* STANDARD MAPPINGS LIST                                                    */}
      {/* ========================================================================= */}
      <div className="space-y-4">
          {/* Same-as quick-fill for cash/bank/control groups */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">Same-as quick-fill</h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Copy one mapped leaf account across related cash, bank, AR, or AP slots. Source mapping must already be set.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SAME_AS_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={!!applyingSameAs}
              onClick={() => handleApplySameAs(g.id)}
              className="text-left p-3 rounded-xl border border-[#E4E4E7] hover:border-[#0D7A5F] hover:bg-emerald-50/40 transition text-xs disabled:opacity-50"
            >
              <span className="font-bold text-[#18181B] block">{g.label}</span>
              <span className="text-[10px] text-[#71717A] font-mono">
                {applyingSameAs === g.id ? "Applying…" : `Source: ${g.source} → ${g.targets.length} slots`}
              </span>
            </button>
          ))}
        </div>
      </div>

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
                    <AlertTriangle className="w-3.5 h-3.5" /> Unmapped Postings Blocked
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Mapping Required Alert Banner */}
          {mappings.filter((m) => !m.isConfigured).length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Manual Mapping Required
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 text-amber-900 border border-amber-300">
                      {mappings.filter((m) => !m.isConfigured).length} Operational Types Unset
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Procurement bills, GRNs, job invoicing, and stock issue postings will fail until an active Level 4 Chart of Account is explicitly bound.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusFilter("UNSET")}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition shrink-0 self-start sm:self-auto"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Filter to Required ({mappings.filter((m) => !m.isConfigured).length})
              </button>
            </div>
          )}

          {/* Filters Bar & Quick Status Pills */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Status Pills */}
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5",
                    statusFilter === "ALL"
                      ? "bg-[#18181B] text-white shadow-xs"
                      : "bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B] border border-[#EDEDED]"
                  )}
                >
                  All ({mappings.length})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("UNSET")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5",
                    statusFilter === "UNSET"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                  )}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Manual Mapping Required ({mappings.filter((m) => !m.isConfigured).length})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("CONFIGURED")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5",
                    statusFilter === "CONFIGURED"
                      ? "bg-[#0D7A5F] text-white shadow-xs"
                      : "bg-emerald-50 text-[#065F46] hover:bg-emerald-100 border border-emerald-200"
                  )}
                >
                  <Check className="w-3 h-3" />
                  Mapped ({mappings.filter((m) => m.isConfigured).length})
                </button>

                <div className="h-5 w-px bg-[#E4E4E7] mx-1" />

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
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search transaction or account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F4F4F5] pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* Domain Groupings */}
          <div className="space-y-4">
            {setupMode && (
              <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_190px_minmax(360px,0.9fr)] gap-4 px-5 py-2.5 rounded-xl bg-[#18181B] text-white text-[10px] font-bold uppercase tracking-wider">
                <span>Software money transaction</span>
                <span>Posting rule</span>
                <span>Customer Chart of Accounts destination</span>
              </div>
            )}
            {domains
              .filter((domain) => selectedDomain === "ALL" || selectedDomain === domain)
              .map((domain) => {
                const domainItems = filteredMappings.filter((m) => m.domain === domain);
                if (domainItems.length === 0) return null;

                const domainUnmapped = domainItems.filter((m) => !m.isConfigured).length;

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
                        {domainUnmapped > 0 && (
                          <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-900 font-mono font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            {domainUnmapped} Manual Mapping Required
                          </span>
                        )}
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
                            className={cn(
                              "p-4 transition grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_190px_minmax(360px,0.9fr)] lg:items-center gap-4",
                              !item.isConfigured
                                ? "bg-amber-50/30 hover:bg-amber-50/60 border-l-4 border-l-amber-500"
                                : "hover:bg-[#FAFAFA]"
                            )}
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#18181B]">
                                  {item.name}
                                </span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#F4F4F5] text-[#71717A] rounded border border-[#E4E4E7]">
                                  {item.transactionType}
                                </span>
                                {!item.isConfigured ? (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-mono">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Manual Mapping Required
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold bg-emerald-50 text-[#065F46] border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-mono">
                                    <Check className="w-3 h-3 text-[#0D7A5F]" />
                                    Mapped
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#71717A] leading-relaxed">
                                {item.description}
                              </p>
                              {item.allowedAccountTypes.length > 0 && (
                                <p className="text-[10px] text-[#A1A1AA] font-mono">
                                  Allowed Account Types: {item.allowedAccountTypes.join(", ")}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <span
                                className={cn(
                                  "inline-flex text-[10px] font-bold uppercase px-2 py-1 rounded border font-mono",
                                  item.defaultDebitOrCredit === "debit"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                                )}
                              >
                                {item.defaultDebitOrCredit.toUpperCase()} role
                              </span>
                              <p className="text-[10px] text-[#71717A] font-mono">
                                Allowed: {item.allowedAccountTypes.join(", ") || "any posting account"}
                              </p>
                            </div>

                            <div className="flex items-end gap-2 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] text-[#71717A] uppercase font-mono">
                                    Mapped GL account
                                  </span>
                                  {item.accountCode && (
                                    <span className="text-[10px] font-bold font-mono text-[#0D7A5F]">
                                      {item.accountCode}
                                    </span>
                                  )}
                                </div>
                                <select
                                  value={item.accountId || ""}
                                  disabled={isSaving}
                                  onChange={(e) => handleUpdateMapping(item.transactionType, e.target.value)}
                                  className={cn(
                                    "w-full text-xs font-medium rounded-lg border px-2.5 py-2 transition focus:outline-none",
                                    item.isConfigured
                                      ? "bg-white border-[#EDEDED] text-[#18181B] focus:border-[#0D7A5F]"
                                      : "bg-amber-50 border-amber-300 text-amber-950 focus:border-amber-500 font-semibold"
                                  )}
                                >
                                  <option value="" disabled>-- Select an existing account --</option>
                                  {compatibleAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.code} — {acc.name} ({acc.type})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {setupMode && (
                                <button
                                  type="button"
                                  onClick={() => setCreateFor(item)}
                                  disabled={isSaving}
                                  className="h-[34px] px-3 rounded-lg border border-[#0D7A5F] text-[#0D7A5F] hover:bg-emerald-50 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                                  title="Create a custom account and map it to this transaction"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Create & map
                                </button>
                              )}

                              {isSaving && (
                                <div className="w-5 h-9 flex items-center justify-center">
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

      <CoaAccountModal
        isOpen={!!createFor}
        mode="create"
        allAccounts={accounts}
        initialType={createFor?.allowedAccountTypes[0] || "expense"}
        initialName={createFor ? `${createFor.name}` : ""}
        initialDescription={createFor?.description || ""}
        allowedTypes={createFor?.allowedAccountTypes || []}
        mapToTransactionType={createFor?.transactionType}
        onClose={() => setCreateFor(null)}
        onSuccess={(message) => {
          setSuccessToast(message);
          setTimeout(() => setSuccessToast(null), 4500);
        }}
        onAccountCreated={handleInlineAccountCreated}
      />
    </div>
  );
}
