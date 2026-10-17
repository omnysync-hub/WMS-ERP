"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RotateCcw,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  RefreshCw,
  Download,
  Eye,
  X,
  ChevronRight,
  Database,
  Code2,
  Sparkles,
  ArrowRight,
  FileText,
} from "lucide-react";
import { realtimeSync, notifySync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";

interface RollbackRecord {
  id: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  entityNumber: string;
  action: string;
  actorName: string;
  actorRole: string;
  stateBefore: string;
  stateAfter: string;
  status: "ACTIVE" | "ROLLED_BACK";
  rolledBackAt?: string | null;
  rolledBackBy?: string | null;
  canRollback: boolean;
  reason?: string | null;
}

// Key mapping dictionary for layman-friendly labels
const FIELD_LABELS: Record<string, string> = {
  status: "Job Status",
  assignedTechnicianId: "Assigned Technician",
  technicianId: "Technician",
  technicianName: "Technician Name",
  discountAmount: "Discount Amount",
  discountReason: "Discount Reason",
  qualityFlag: "Quality Inspection Flag",
  oldRate: "Original Price / Rate",
  newRate: "New Discounted Rate",
  rate: "Unit Rate",
  price: "Price",
  cost: "Cost",
  totalAmount: "Total Amount",
  amount: "Amount",
  paidAmount: "Paid Amount",
  balance: "Balance Due",
  itemId: "Item Reference",
  itemName: "Item Name",
  action: "Action Taken",
  reason: "Reason",
  notes: "Notes / Remarks",
  note: "Note",
  customerName: "Customer Name",
  jobNumber: "Job Reference #",
  invoiceNumber: "Invoice Reference #",
  meta: "Transaction Details",
};

function formatFieldKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isCurrencyField(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("amount") ||
    lower.includes("rate") ||
    lower.includes("price") ||
    lower.includes("cost") ||
    lower.includes("total") ||
    lower.includes("balance") ||
    lower.includes("discount") ||
    lower.includes("fee")
  );
}

function safeParseJson(raw: any) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function formatActionText(action: string): string {
  if (!action) return "";
  return action
    .replace(/item_discount_approved/gi, "Item Discount Approved")
    .replace(/job_created/gi, "Job Created")
    .replace(/job_assigned/gi, "Job Assigned")
    .replace(/job_completed/gi, "Job Completed")
    .replace(/->/g, "→")
    .replace(/inprogress/gi, "In Progress");
}

function formatFieldValue(key: string, value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[#A1A1AA] italic text-[11px]">None / Not set</span>;
  }

  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700">
        No
      </span>
    );
  }

  if (typeof value === "number") {
    if (isCurrencyField(key)) {
      return (
        <span className="font-semibold font-mono text-[#18181B]">
          PKR {value.toLocaleString()}
        </span>
      );
    }
    return <span className="font-semibold font-mono text-[#18181B]">{value.toLocaleString()}</span>;
  }

  if (typeof value === "string") {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "status") {
      const statusColors: Record<string, string> = {
        inprogress: "bg-blue-50 text-blue-700 border-blue-200",
        assigned: "bg-purple-50 text-purple-700 border-purple-200",
        created: "bg-zinc-100 text-zinc-700 border-zinc-200",
        completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
        paused: "bg-amber-50 text-amber-700 border-amber-200",
        cancelled: "bg-rose-50 text-rose-700 border-rose-200",
      };
      const colorClass =
        statusColors[value.toLowerCase()] || "bg-zinc-100 text-zinc-800 border-zinc-200";
      const label = value.replace(/([A-Z])/g, " $1").trim();
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}
        >
          {label}
        </span>
      );
    }

    if (lowerKey === "action") {
      return (
        <span className="font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md text-[11px]">
          {value.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
        </span>
      );
    }

    // Shorten raw UUIDs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return (
        <span
          className="font-mono text-[10px] text-[#71717A] bg-[#F4F4F5] px-1.5 py-0.5 rounded border border-[#EDEDED]"
          title={value}
        >
          #{value.slice(0, 8)}...
        </span>
      );
    }

    return <span className="font-medium text-[#18181B]">{value}</span>;
  }

  // Nested object or array
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-[#A1A1AA] italic text-[11px]">Empty list</span>;
      }
      return (
        <div className="space-y-1">
          {value.map((item, idx) => (
            <div key={idx} className="p-1.5 bg-white/60 rounded border border-[#EDEDED] text-[11px]">
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </div>
          ))}
        </div>
      );
    }

    // Object
    return (
      <div className="p-2.5 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-1.5 mt-1">
        {Object.entries(value).map(([subKey, subVal]) => (
          <div
            key={subKey}
            className="flex items-center justify-between gap-2 py-1 border-b border-zinc-100 last:border-none"
          >
            <span className="text-[#71717A] text-[11px] font-medium">{formatFieldKey(subKey)}:</span>
            <span className="text-right">{formatFieldValue(subKey, subVal)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function LaymanStateCard({
  title,
  subtitle,
  variant,
  data,
}: {
  title: string;
  subtitle: string;
  variant: "prior" | "current";
  data: any;
}) {
  const isPrior = variant === "prior";
  const borderColor = isPrior ? "border-emerald-200" : "border-rose-200";
  const bgHeader = isPrior ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900";
  const badgeClass = isPrior
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : "bg-rose-100 text-rose-800 border-rose-300";

  if (!data || typeof data !== "object") {
    return (
      <div className={`border ${borderColor} rounded-2xl p-4 bg-white flex flex-col shadow-2xs`}>
        <div className={`p-2.5 rounded-xl ${bgHeader} font-bold text-xs flex items-center justify-between`}>
          <span>{title}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${badgeClass}`}>{subtitle}</span>
        </div>
        <p className="p-3 text-xs text-[#71717A] italic">No structured data found in snapshot.</p>
      </div>
    );
  }

  const entries = Object.entries(data);
  const primitiveEntries = entries.filter(([_, v]) => typeof v !== "object" || v === null);
  const nestedEntries = entries.filter(([_, v]) => typeof v === "object" && v !== null);

  return (
    <div className={`border ${borderColor} rounded-2xl overflow-hidden bg-white flex flex-col shadow-2xs`}>
      <div className={`p-3.5 border-b ${borderColor} ${bgHeader} flex items-center justify-between`}>
        <div className="flex items-center gap-1.5 font-bold text-xs">
          {isPrior ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{title}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${badgeClass}`}>
          {subtitle}
        </span>
      </div>

      <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[380px]">
        {primitiveEntries.length === 0 && nestedEntries.length === 0 && (
          <p className="text-[#71717A] text-xs italic">No attributes recorded in snapshot.</p>
        )}

        {/* Regular Field Rows */}
        <div className="space-y-1 divide-y divide-[#F4F4F5]">
          {primitiveEntries.map(([key, val]) => (
            <div key={key} className="flex items-center justify-between py-2 first:pt-0 gap-3">
              <span className="text-xs font-semibold text-[#71717A]">{formatFieldKey(key)}</span>
              <div className="text-right">{formatFieldValue(key, val)}</div>
            </div>
          ))}
        </div>

        {/* Nested Objects (e.g. Transaction Details / Meta) */}
        {nestedEntries.map(([nestedKey, nestedVal]) => (
          <div key={nestedKey} className="mt-3 pt-2.5 border-t border-zinc-200">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] uppercase font-bold text-[#18181B] tracking-wider">
                {formatFieldKey(nestedKey)}
              </span>
            </div>
            {formatFieldValue(nestedKey, nestedVal)}
          </div>
        ))}
      </div>
    </div>
  );
}

function DifferencesBanner({ beforeObj, afterObj }: { beforeObj: any; afterObj: any }) {
  const flatten = (obj: any, prefix = ""): Record<string, any> => {
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        Object.assign(out, flatten(v, `${prefix}${k}.`));
      } else {
        out[`${prefix}${k}`] = v;
      }
    }
    return out;
  };

  const flatBefore = flatten(beforeObj);
  const flatAfter = flatten(afterObj);
  const keys = Array.from(new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]));

  const diffs: { key: string; label: string; before: any; after: any }[] = [];
  for (const k of keys) {
    const b = flatBefore[k];
    const a = flatAfter[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      if (k.endsWith("Id") && b && a) continue;
      const label = k.split(".").map(formatFieldKey).join(" › ");
      diffs.push({ key: k, label, before: b, after: a });
    }
  }

  if (diffs.length === 0) {
    return (
      <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
        <span>Verified state snapshot captured for transaction audit and rollback safety.</span>
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <span>What Changed in this Record (Layman Summary):</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {diffs.map((d, i) => (
          <div key={i} className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs flex items-center justify-between gap-2">
            <span className="font-bold text-[#18181B] text-xs">{d.label}:</span>
            <div className="flex items-center gap-1.5 text-right font-medium">
              <span className="line-through text-rose-600 font-mono text-xs">
                {d.before === null || d.before === undefined
                  ? "None"
                  : typeof d.before === "number" && isCurrencyField(d.key)
                  ? `PKR ${d.before.toLocaleString()}`
                  : String(d.before)}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
              <span className="text-emerald-700 font-bold font-mono text-xs">
                {d.after === null || d.after === undefined
                  ? "None"
                  : typeof d.after === "number" && isCurrencyField(d.key)
                  ? `PKR ${d.after.toLocaleString()}`
                  : String(d.after)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditHubPage() {
  const { currentPersona } = useRole();

  // Rollback state
  const [rollbacks, setRollbacks] = useState<RollbackRecord[]>([]);
  const [rollbackLoading, setRollbackLoading] = useState(true);
  const [rollbackSearch, setRollbackSearch] = useState("");
  const [rollbackEntityFilter, setRollbackEntityFilter] = useState("ALL");
  const [rollbackStatusFilter, setRollbackStatusFilter] = useState("ALL");

  // Selected item for Diff / Rollback Modal
  const [selectedRollback, setSelectedRollback] = useState<RollbackRecord | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<"layman" | "raw">("layman");
  const [rollbackReason, setRollbackReason] = useState("");
  const [isExecutingRollback, setIsExecutingRollback] = useState(false);
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);

  // Fetch Rollbacks
  const fetchRollbacks = useCallback(async () => {
    try {
      setRollbackLoading(true);
      const params = new URLSearchParams({ tab: "rollbacks" });
      if (rollbackSearch) params.set("search", rollbackSearch);
      if (rollbackEntityFilter !== "ALL") params.set("entityType", rollbackEntityFilter);
      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data.rollbacks) {
        setRollbacks(data.rollbacks);
      }
    } catch (e) {
      console.error("Failed to fetch rollbacks:", e);
    } finally {
      setRollbackLoading(false);
    }
  }, [rollbackSearch, rollbackEntityFilter]);

  useEffect(() => {
    fetchRollbacks();
  }, [fetchRollbacks]);

  // Real-time synchronization
  useEffect(() => {
    const unsub = realtimeSync.subscribe((event) => {
      if (
        event.type === "AUDIT_LOG_UPDATE" ||
        event.type === "JOB_UPDATED" ||
        event.type === "TECHNICIAN_SYNC" ||
        event.type === "INVENTORY_SYNC"
      ) {
        fetchRollbacks();
      }
    });

    return () => {
      unsub();
    };
  }, [fetchRollbacks]);

  // Execute safe rollback
  const handleExecuteRollback = async () => {
    if (!selectedRollback) return;
    try {
      setIsExecutingRollback(true);
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          rollbackLogId: selectedRollback.id,
          rollbackId: selectedRollback.id,
          reason: rollbackReason || "User executed manual rollback via Audit Hub",
          actorName: currentPersona.name,
          actorRole: currentPersona.role.toUpperCase(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRollbackSuccessMsg(`Successfully reverted ${selectedRollback.entityNumber} to its prior state.`);
        setIsDiffModalOpen(false);
        fetchRollbacks();
        notifySync("AUDIT_LOG_UPDATE", { rolledBackId: selectedRollback.id });
      } else {
        alert(data.error || "Failed to execute rollback.");
      }
    } catch (err: any) {
      alert("Error executing rollback: " + err.message);
    } finally {
      setIsExecutingRollback(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = "ID,Timestamp,EntityType,EntityNumber,Action,ActorName,ActorRole,Status\n";
    const rows = rollbacks
      .map(
        (r) =>
          `"${r.id}","${r.timestamp}","${r.entityType}","${r.entityNumber}","${r.action}","${r.actorName}","${r.actorRole}","${r.status}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rollbacks_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Filtered rollbacks
  const filteredRollbacks = rollbacks.filter((r) => {
    if (rollbackStatusFilter !== "ALL" && r.status !== rollbackStatusFilter) return false;
    return true;
  });

  const activeRollbacksCount = rollbacks.filter((r) => r.status === "ACTIVE").length;
  const revertedRollbacksCount = rollbacks.filter((r) => r.status === "ROLLED_BACK").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#18181B] tracking-tight">
                Audit Log & State Rollback Hub
              </h1>
              <p className="text-xs text-[#71717A] mt-0.5">
                Reversible transaction state rollbacks and data mutation audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Global Hub Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            data-audit="Button: Export Audit CSV"
            className="px-3 py-1.5 rounded-lg bg-white border border-[#EDEDED] text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] shadow-2xs flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-[#71717A]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              fetchRollbacks();
            }}
            data-audit="Button: Refresh Audit Logs"
            className="p-1.5 rounded-lg bg-white border border-[#EDEDED] text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Success Alert Banner */}
      {rollbackSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{rollbackSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRollbackSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-2xs">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Total Logged Mutations
            </span>
            <Database className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-[#18181B] mt-2 tracking-tight">
            {rollbacks.length}
          </p>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Reversible state snapshots saved
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-2xs">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Available for Rollback
            </span>
            <RotateCcw className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-[#18181B] mt-2 tracking-tight">
            {activeRollbacksCount}
          </p>
          <p className="text-[10px] text-[#71717A] mt-0.5">
            Active states ready to revert safely
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-2xs">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Successfully Reverted
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-[#18181B] mt-2 tracking-tight">
            {revertedRollbacksCount}
          </p>
          <p className="text-[10px] text-amber-600 font-medium mt-0.5">
            Archived rollback histories
          </p>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EDEDED]">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-[#0D7A5F]" />
          <h2 className="text-sm font-bold text-[#18181B]">State Mutation & Rollback Hub</h2>
          <span className="text-[10px] bg-[#F4F4F5] px-2 py-0.5 rounded-full text-[#71717A] font-bold">
            {rollbacks.length} {rollbacks.length === 1 ? "record" : "records"}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#71717A]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Role: <strong className="text-[#18181B]">{currentPersona.name} ({currentPersona.role.toUpperCase()})</strong></span>
        </div>
      </div>

      {/* ROLLBACK ENGINE */}
      <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by ref # (e.g. JOB-2026-0001, IR-8821), action, or actor..."
                  value={rollbackSearch}
                  onChange={(e) => setRollbackSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#EDEDED] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Entity Filter */}
              <select
                value={rollbackEntityFilter}
                onChange={(e) => setRollbackEntityFilter(e.target.value)}
                className="text-xs bg-white border border-[#EDEDED] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B]"
              >
                <option value="ALL">All Entity Types</option>
                <option value="Job">Work Order (Job)</option>
                <option value="InventoryRequest">Inventory Issue</option>
                <option value="StockReturn">Stock Return</option>
                <option value="Discount">Item Discount</option>
                <option value="Expense">Field Expense</option>
                <option value="JournalEntry">Financial Journal Entry</option>
              </select>

              {/* Status Filter */}
              <select
                value={rollbackStatusFilter}
                onChange={(e) => setRollbackStatusFilter(e.target.value)}
                className="text-xs bg-white border border-[#EDEDED] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active (Can Revert)</option>
                <option value="ROLLED_BACK">Reverted (Archived)</option>
              </select>
            </div>
          </div>

          {/* Rollbacks Table */}
          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
            {rollbackLoading ? (
              <div className="p-12 text-center text-xs text-[#71717A] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#0D7A5F]" />
                <span>Loading reversible snapshots...</span>
              </div>
            ) : filteredRollbacks.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                No mutation records found matching filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F7F8] border-b border-[#EDEDED] text-[#71717A] font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Entity Ref</th>
                      <th className="py-3 px-4">Type & Mutation</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-center">State Diff</th>
                      <th className="py-3 px-4 text-right">Reversion Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEDED]">
                    {filteredRollbacks.map((item) => {
                      const isRolledBack = item.status === "ROLLED_BACK";
                      const dateObj = new Date(item.timestamp);
                      const formattedDate = dateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                      const formattedTime = dateObj.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#F9FAFB] transition ${
                            isRolledBack ? "opacity-75 bg-[#FAFAFA]" : ""
                          }`}
                        >
                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isRolledBack ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                Reverted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Active (Reversible)
                              </span>
                            )}
                          </td>

                          {/* Ref */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-[#18181B] bg-[#F4F4F5] px-2 py-0.5 rounded">
                              {item.entityNumber}
                            </span>
                          </td>

                          {/* Entity Type & Action */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#18181B]">
                              {item.action}
                            </div>
                            <span className="text-[10px] text-[#71717A] uppercase font-mono tracking-wide">
                              {item.entityType}
                            </span>
                          </td>

                          {/* Actor */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-[#27272A] text-white flex items-center justify-center font-bold text-[10px]">
                                {item.actorName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[#18181B] leading-none">
                                  {item.actorName}
                                </p>
                                <p className="text-[10px] text-[#71717A] mt-0.5 leading-none">
                                  {item.actorRole}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Timestamp */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-[#71717A]">
                            <div className="flex items-center gap-1.5 text-xs text-[#18181B]">
                              <Clock className="w-3.5 h-3.5 text-[#A1A1AA]" />
                              <span>{formattedTime}</span>
                            </div>
                            <span className="text-[10px] text-[#71717A] block mt-0.5">
                              {formattedDate}
                            </span>
                          </td>

                          {/* State Diff Inspection */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedRollback(item);
                                setIsDiffModalOpen(true);
                              }}
                              data-audit={`Button: Inspect Diff for ${item.entityNumber}`}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Compare Diff</span>
                            </button>
                          </td>

                          {/* Rollback Trigger */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {isRolledBack ? (
                              <span className="text-[11px] text-[#71717A] italic">
                                Reverted on {new Date(item.rolledBackAt || "").toLocaleDateString()}
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedRollback(item);
                                  setRollbackReason(`Reversion initiated by ${currentPersona.name}`);
                                  setIsDiffModalOpen(true);
                                }}
                                data-audit={`Button: Revert ${item.entityNumber}`}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0B664F] shadow-xs inline-flex items-center gap-1.5 transition active:scale-95"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Revert to Prior State</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {/* STATE DIFF & ROLLBACK CONFIRMATION MODAL */}
      {isDiffModalOpen && selectedRollback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-[#EDEDED] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#EDEDED] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#F7F7F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#18181B] tracking-tight">
                    Inspect State Snapshot & Execute Rollback
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Entity: <strong className="text-[#18181B]">{selectedRollback.entityNumber}</strong> ({selectedRollback.entityType})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {/* View Switcher: Layman vs Raw JSON */}
                <div className="flex items-center gap-1 bg-[#EDEDED] p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDiffViewMode("layman")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition text-xs ${
                      diffViewMode === "layman"
                        ? "bg-white text-[#18181B] shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Plain-Language View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiffViewMode("raw")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition text-xs ${
                      diffViewMode === "raw"
                        ? "bg-white text-[#18181B] shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>Raw JSON</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsDiffModalOpen(false)}
                  className="text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg hover:bg-zinc-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Mutation Context Summary */}
              <div className="p-3.5 bg-[#F4F4F5] rounded-xl border border-[#EDEDED] grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Action</span>
                  <p className="font-semibold text-[#18181B] mt-0.5 text-xs leading-snug">
                    {formatActionText(selectedRollback.action)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Logged By</span>
                  <p className="font-semibold text-[#18181B] mt-0.5 text-xs">
                    {selectedRollback.actorName} ({selectedRollback.actorRole})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Snapshot Date</span>
                  <p className="font-semibold text-[#18181B] mt-0.5 text-xs">
                    {new Date(selectedRollback.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Status</span>
                  <div className="mt-0.5">
                    {selectedRollback.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        ROLLED BACK
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* View 1: Layman-Friendly Formatted Cards */}
              {diffViewMode === "layman" ? (
                <div className="space-y-3.5">
                  {/* Highlight What Changed */}
                  <DifferencesBanner
                    beforeObj={safeParseJson(selectedRollback.stateBefore)}
                    afterObj={safeParseJson(selectedRollback.stateAfter)}
                  />

                  {/* Side-by-side formatted cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <LaymanStateCard
                      title="State BEFORE (Target of Rollback)"
                      subtitle="PRIOR — Will Be Restored"
                      variant="prior"
                      data={safeParseJson(selectedRollback.stateBefore)}
                    />

                    <LaymanStateCard
                      title="State AFTER (Current Mutated State)"
                      subtitle="CURRENT — Active Now"
                      variant="current"
                      data={safeParseJson(selectedRollback.stateAfter)}
                    />
                  </div>
                </div>
              ) : (
                /* View 2: Raw JSON View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* State Before */}
                  <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200 text-emerald-800 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        State BEFORE (Target of Rollback)
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-mono">PRIOR</span>
                    </div>
                    <pre className="mt-2 text-[11px] font-mono text-emerald-950 whitespace-pre-wrap overflow-x-auto bg-white/70 p-2.5 rounded-lg border border-emerald-100 flex-1">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedRollback.stateBefore), null, 2);
                        } catch {
                          return selectedRollback.stateBefore;
                        }
                      })()}
                    </pre>
                  </div>

                  {/* State After */}
                  <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between pb-2 border-b border-rose-200 text-rose-800 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        State AFTER (Current Mutated State)
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-mono">CURRENT</span>
                    </div>
                    <pre className="mt-2 text-[11px] font-mono text-rose-950 whitespace-pre-wrap overflow-x-auto bg-white/70 p-2.5 rounded-lg border border-rose-100 flex-1">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedRollback.stateAfter), null, 2);
                        } catch {
                          return selectedRollback.stateAfter;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}

              {/* Rollback Reason Input (if active) */}
              {selectedRollback.status === "ACTIVE" && (
                <div className="space-y-1.5 pt-2">
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-[#52525B] flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-[#0D7A5F] shrink-0" />
                    <span>
                      <strong>Reversion Impact:</strong> Executing rollback will safely revert this record back to the <strong>PRIOR State</strong> above. Any newly updated fields will be returned to their previous values.
                    </span>
                  </div>

                  <label className="text-xs font-semibold text-[#18181B] block pt-1">
                    Reason for Rollback / Reversion:
                  </label>
                  <input
                    type="text"
                    value={rollbackReason}
                    onChange={(e) => setRollbackReason(e.target.value)}
                    placeholder="e.g., Job marked complete in error; technician still has 2 AC units to mount tomorrow..."
                    className="w-full text-xs p-2.5 rounded-xl border border-[#EDEDED] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                  />
                  <p className="text-[10px] text-[#71717A]">
                    Reverting will restore the database record safely, restock any inventory if applicable, and log the action in the permanent telemetry trail.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#EDEDED] bg-[#F7F7F8] flex items-center justify-between">
              <button
                onClick={() => setIsDiffModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#EDEDED] transition"
              >
                Close
              </button>

              {selectedRollback.status === "ACTIVE" ? (
                <button
                  onClick={handleExecuteRollback}
                  disabled={isExecutingRollback}
                  data-audit={`Confirm: Execute Rollback for ${selectedRollback.entityNumber}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0B664F] disabled:opacity-50 transition flex items-center gap-1.5 shadow-sm"
                >
                  {isExecutingRollback ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm & Execute Rollback</span>
                </button>
              ) : (
                <span className="text-xs font-medium text-[#71717A]">
                  This mutation is already in a reverted state.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
