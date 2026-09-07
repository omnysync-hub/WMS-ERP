"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RotateCcw,
  Activity,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MousePointer,
  Navigation,
  RefreshCw,
  Download,
  Eye,
  X,
  ExternalLink,
  Laptop,
  Smartphone,
  ChevronRight,
  Database,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { realtimeSync, notifySync } from "@/lib/realtimeSync";
import { logActivity } from "@/lib/telemetry";
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

interface ActivityRecord {
  id: string;
  timestamp: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  category: "UI_CLICK" | "NAVIGATION" | "ROLE_SWITCH" | "DATA_MUTATION" | "SEARCH" | "MOBILE_APP";
  action: string;
  target: string;
  metadata?: string | null;
  ipAddress?: string | null;
}

export default function AuditHubPage() {
  const { currentPersona } = useRole();
  const [activeTab, setActiveTab] = useState<"rollbacks" | "activity">("rollbacks");

  // Rollback state
  const [rollbacks, setRollbacks] = useState<RollbackRecord[]>([]);
  const [rollbackLoading, setRollbackLoading] = useState(true);
  const [rollbackSearch, setRollbackSearch] = useState("");
  const [rollbackEntityFilter, setRollbackEntityFilter] = useState("ALL");
  const [rollbackStatusFilter, setRollbackStatusFilter] = useState("ALL");

  // Selected item for Diff / Rollback Modal
  const [selectedRollback, setSelectedRollback] = useState<RollbackRecord | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState("");
  const [isExecutingRollback, setIsExecutingRollback] = useState(false);
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);

  // Activity Telemetry state
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState("ALL");
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [isTelemetryDrawerOpen, setIsTelemetryDrawerOpen] = useState(false);

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

  // Fetch Activities
  const fetchActivities = useCallback(async () => {
    try {
      setActivityLoading(true);
      const params = new URLSearchParams({ tab: "activity" });
      if (activitySearch) params.set("search", activitySearch);
      if (activityCategoryFilter !== "ALL") params.set("category", activityCategoryFilter);
      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data.activities) {
        setActivities(data.activities);
      }
    } catch (e) {
      console.error("Failed to fetch activities:", e);
    } finally {
      setActivityLoading(false);
    }
  }, [activitySearch, activityCategoryFilter]);

  useEffect(() => {
    fetchRollbacks();
    fetchActivities();
  }, [fetchRollbacks, fetchActivities]);

  // Real-time synchronization
  useEffect(() => {
    const handleLocalBatch = () => {
      fetchActivities();
    };
    window.addEventListener("audit_telemetry_batch", handleLocalBatch);

    const unsub = realtimeSync.subscribe((event) => {
      if (
        event.type === "AUDIT_LOG_UPDATE" ||
        event.type === "JOB_UPDATED" ||
        event.type === "TECHNICIAN_SYNC" ||
        event.type === "INVENTORY_SYNC"
      ) {
        fetchRollbacks();
        fetchActivities();
      }
    });

    return () => {
      window.removeEventListener("audit_telemetry_batch", handleLocalBatch);
      unsub();
    };
  }, [fetchRollbacks, fetchActivities]);

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
        fetchActivities();
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

  // Trigger test click to show live telemetry
  const handleTriggerTestClick = (actionName: string) => {
    logActivity({
      action: "CLICK",
      target: `Interactive Demo Button: "${actionName}"`,
      category: "UI_CLICK",
      actorName: currentPersona.name,
      actorRole: currentPersona.role.toUpperCase(),
      metadata: { testEvent: true, triggerTime: new Date().toISOString() },
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    if (activeTab === "rollbacks") {
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
    } else {
      const headers = "ID,Timestamp,ActorName,ActorRole,Category,Action,Target\n";
      const rows = activities
        .map(
          (a) =>
            `"${a.id}","${a.timestamp}","${a.actorName}","${a.actorRole}","${a.category}","${a.action}","${a.target.replace(/"/g, '""')}"`
        )
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omni_activity_telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
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
                Two-tier enterprise audit system: reversible transaction rollbacks and real-time omni-activity click telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Global Hub Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleTriggerTestClick("Live Telemetry Ping")}
            data-audit="Button: Test Telemetry Ping"
            className="px-3 py-1.5 rounded-lg bg-white border border-[#EDEDED] text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] shadow-2xs flex items-center gap-1.5 transition"
            title="Log an immediate click to demonstrate instant telemetry capture"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Test Telemetry Click</span>
          </button>

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
              fetchActivities();
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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

        <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-2xs">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Omni-Activity Events
            </span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-[#18181B] mt-2 tracking-tight">
            {activities.length}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 font-medium">
              Every single click logged live
            </span>
          </div>
        </div>
      </div>

      {/* Primary Section Switcher Tabs */}
      <div className="border-b border-[#EDEDED] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("rollbacks")}
            data-audit="Tab: State Mutation & Rollback Hub"
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "rollbacks"
                ? "border-[#0D7A5F] text-[#0D7A5F]"
                : "border-transparent text-[#71717A] hover:text-[#18181B]"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>State Mutation & Rollback Hub</span>
            <span className="text-[10px] bg-[#F4F4F5] px-1.5 py-0.5 rounded-full text-[#71717A] font-bold">
              {rollbacks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            data-audit="Tab: Omni-Activity & Click Telemetry"
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "activity"
                ? "border-[#0D7A5F] text-[#0D7A5F]"
                : "border-transparent text-[#71717A] hover:text-[#18181B]"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Omni-Activity & Click Telemetry</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Stream
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#71717A] pb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Role: <strong className="text-[#18181B]">{currentPersona.name} ({currentPersona.role.toUpperCase()})</strong></span>
        </div>
      </div>

      {/* TAB 1: ROLLBACK ENGINE */}
      {activeTab === "rollbacks" && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
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
      )}

      {/* TAB 2: OMNI-ACTIVITY & CLICK TELEMETRY STREAM */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user clicks, target elements, account names..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#EDEDED] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Pills */}
              <div className="flex items-center gap-1 bg-[#F4F4F5] p-1 rounded-xl border border-[#EDEDED] text-xs">
                {[
                  { id: "ALL", label: "All Events" },
                  { id: "UI_CLICK", label: "Clicks" },
                  { id: "NAVIGATION", label: "Pages" },
                  { id: "ROLE_SWITCH", label: "Role Switches" },
                  { id: "DATA_MUTATION", label: "Mutations" },
                  { id: "MOBILE_APP", label: "Mobile Companion" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActivityCategoryFilter(cat.id)}
                    data-audit={`Filter: Category ${cat.label}`}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      activityCategoryFilter === cat.id
                        ? "bg-white text-[#18181B] shadow-2xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Feed / Table */}
          <div className="bg-white rounded-2xl border border-[#EDEDED] shadow-2xs overflow-hidden">
            {activityLoading ? (
              <div className="p-12 text-center text-xs text-[#71717A] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#0D7A5F]" />
                <span>Streaming live telemetry click events...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                No user activity events recorded yet. Click anywhere in the app to generate logs.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F7F8] border-b border-[#EDEDED] text-[#71717A] font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Timestamp & Date</th>
                      <th className="py-3 px-4">Account / Member</th>
                      <th className="py-3 px-4">Event Category</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Target Element & Context</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEDED]">
                    {activities.map((act) => {
                      const dateObj = new Date(act.timestamp);
                      const formattedTime = dateObj.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                      const formattedDate = dateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      let categoryBadge = (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          <MousePointer className="w-3 h-3" />
                          UI Click
                        </span>
                      );

                      if (act.category === "NAVIGATION") {
                        categoryBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                            <Navigation className="w-3 h-3" />
                            Navigation
                          </span>
                        );
                      } else if (act.category === "ROLE_SWITCH") {
                        categoryBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <User className="w-3 h-3" />
                            Role Switch
                          </span>
                        );
                      } else if (act.category === "DATA_MUTATION") {
                        categoryBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Database className="w-3 h-3" />
                            Data Mutation
                          </span>
                        );
                      } else if (act.category === "MOBILE_APP") {
                        categoryBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                            <Smartphone className="w-3 h-3" />
                            Field App
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={act.id}
                          className="hover:bg-[#F9FAFB] transition group"
                        >
                          {/* Timestamp */}
                          <td className="py-3 px-4 whitespace-nowrap text-[#71717A]">
                            <div className="font-mono text-xs font-semibold text-[#18181B]">
                              {formattedTime}
                            </div>
                            <div className="text-[10px] text-[#A1A1AA]">
                              {formattedDate}
                            </div>
                          </td>

                          {/* Member / Account */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-[#18181B] text-white flex items-center justify-center font-bold text-[10px]">
                                {act.actorName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold text-[#18181B] block">
                                  {act.actorName}
                                </span>
                                <span className="text-[10px] text-[#71717A] block font-mono">
                                  {act.actorRole}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {categoryBadge}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold font-mono text-[#18181B] bg-[#F4F4F5] px-2 py-0.5 rounded text-[11px]">
                              {act.action}
                            </span>
                          </td>

                          {/* Target */}
                          <td className="py-3 px-4 max-w-md">
                            <p className="font-medium text-[#18181B] truncate text-xs" title={act.target}>
                              {act.target}
                            </p>
                          </td>

                          {/* Details Drawer Trigger */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedActivity(act);
                                setIsTelemetryDrawerOpen(true);
                              }}
                              data-audit={`Button: View Details for activity ${act.id}`}
                              className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#E4E4E7] transition"
                              title="View technical metadata and telemetry coordinates"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
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
      )}

      {/* STATE DIFF & ROLLBACK CONFIRMATION MODAL */}
      {isDiffModalOpen && selectedRollback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#EDEDED] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#EDEDED] flex items-center justify-between bg-[#F7F7F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#18181B]">
                    Inspect State Snapshot & Execute Rollback
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Entity: <strong className="text-[#18181B]">{selectedRollback.entityNumber}</strong> ({selectedRollback.entityType})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDiffModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Before vs After Diff */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Mutation Context Summary */}
              <div className="p-3 bg-[#F4F4F5] rounded-xl border border-[#EDEDED] grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Action</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{selectedRollback.action}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Logged By</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{selectedRollback.actorName} ({selectedRollback.actorRole})</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Snapshot Date</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{new Date(selectedRollback.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Status</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{selectedRollback.status}</p>
                </div>
              </div>

              {/* Diff Viewer: Side-by-side JSON comparison */}
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

              {/* Rollback Reason Input (if active) */}
              {selectedRollback.status === "ACTIVE" && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-[#18181B] block">
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

      {/* TELEMETRY ACTIVITY DETAILS DRAWER */}
      {isTelemetryDrawerOpen && selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white h-full max-w-md w-full shadow-2xl border-l border-[#EDEDED] flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#EDEDED] flex items-center justify-between bg-[#F7F7F8]">
              <div className="flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm text-[#18181B]">
                  Click Telemetry Event
                </h3>
              </div>
              <button
                onClick={() => setIsTelemetryDrawerOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#71717A]">Target Element</span>
                <p className="font-semibold text-sm text-[#18181B] break-words">
                  {selectedActivity.target}
                </p>
              </div>

              <div className="p-3 bg-[#F4F4F5] rounded-xl space-y-2 border border-[#EDEDED]">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Member Account:</span>
                  <strong className="text-[#18181B]">{selectedActivity.actorName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Role:</span>
                  <span className="font-mono font-bold text-purple-700">{selectedActivity.actorRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Category:</span>
                  <span className="font-mono text-[#18181B]">{selectedActivity.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Action:</span>
                  <span className="font-mono text-[#18181B]">{selectedActivity.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Timestamp:</span>
                  <span className="text-[#18181B]">{new Date(selectedActivity.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Technical Telemetry Metadata */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-[#71717A]">
                  Technical Telemetry Context
                </span>
                <pre className="text-[11px] font-mono bg-[#18181B] text-[#E4E4E7] p-3 rounded-xl overflow-x-auto whitespace-pre-wrap">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedActivity.metadata || "{}"), null, 2);
                    } catch {
                      return selectedActivity.metadata || "No additional metadata";
                    }
                  })()}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#EDEDED] bg-[#F7F7F8] flex justify-end">
              <button
                onClick={() => setIsTelemetryDrawerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-[#EDEDED] text-[#18181B] hover:bg-[#F4F4F5]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
