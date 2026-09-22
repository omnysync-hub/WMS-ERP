"use client";

import React, { useState } from "react";
import {
  FolderTree,
  Table as TableIcon,
  Search,
  Plus,
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  Edit2,
  Lock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  RotateCcw,
  Check,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import CoaAccountModal, { CoaModalAccount } from "./CoaAccountModal";

interface CoaManagerTreeProps {
  tree: any[];
  flat: any[];
  rawAccounts: any[];
  onRefresh: () => void;
  onNavigateToMapping?: (transactionType?: string) => void;
}

export default function CoaManagerTree({
  tree,
  flat,
  rawAccounts,
  onRefresh,
  onNavigateToMapping,
}: CoaManagerTreeProps) {
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["1000-GRP", "2000-GRP", "3000-GRP", "4000-GRP", "5000-GRP", "6000-GRP"])
  );

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedAccount, setSelectedAccount] = useState<CoaModalAccount | null>(null);

  // Deactivation Guard Dialog state
  const [guardDialog, setGuardDialog] = useState<{
    isOpen: boolean;
    account: any | null;
    mappedTypes: string[];
    isChecking: boolean;
    isDeactivating: boolean;
  }>({
    isOpen: false,
    account: null,
    mappedTypes: [],
    isChecking: false,
    isDeactivating: false,
  });

  // Delete Confirmation Dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    account: any | null;
    canDelete: boolean;
    reason: string | null;
    isChecking: boolean;
    isDeleting: boolean;
  }>({
    isOpen: false,
    account: null,
    canDelete: false,
    reason: null,
    isChecking: false,
    isDeleting: false,
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const expandAll = () => {
    const allCodes = new Set<string>();
    const recurse = (node: any) => {
      allCodes.add(node.code);
      if (node.children) node.children.forEach(recurse);
    };
    tree.forEach(recurse);
    setExpandedNodes(allCodes);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Export CSV
  const handleExportCsv = () => {
    if (flat.length === 0) return;
    const headers = "code,name,type,level,parentCode,balance,isSystem,isActive,currency,entriesCount";
    const rows = flat.map(
      (a) =>
        `"${a.code}","${a.name}","${a.type}","${a.level}","${a.parentCode || ""}","${a.balance}","${
          a.isSystem ? "TRUE" : "FALSE"
        }","${a.isActive ? "ACTIVE" : "INACTIVE"}","${a.currency || "PKR"}","${a.entriesCount || 0}"`
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `chart_of_accounts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Chart of Accounts exported to CSV.");
  };

  // Toggle Active/Inactive handler with reassignment check
  const handleToggleActive = async (account: any) => {
    // If we are activating an inactive account, no mapping conflict exists
    if (!account.isActive) {
      try {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_account",
            id: account.id,
            isActive: true,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to activate account");
        showToast(`Account ${account.code} activated.`);
        onRefresh();
      } catch (err: any) {
        showToast(err.message, "error");
      }
      return;
    }

    // We are trying to DEACTIVATE an active account: check usage first!
    setGuardDialog({
      isOpen: true,
      account,
      mappedTypes: [],
      isChecking: true,
      isDeactivating: false,
    });

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_account_usage",
          id: account.id,
        }),
      });
      const data = await res.json();
      setGuardDialog((prev) => ({
        ...prev,
        isChecking: false,
        mappedTypes: data.mappedTransactionTypes || [],
      }));
    } catch (err: any) {
      setGuardDialog((prev) => ({
        ...prev,
        isChecking: false,
      }));
      showToast("Failed to verify account mapping usage", "error");
    }
  };

  const handleConfirmDeactivate = async (force: boolean = false) => {
    if (!guardDialog.account) return;
    setGuardDialog((prev) => ({ ...prev, isDeactivating: true }));

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_account",
          id: guardDialog.account.id,
          isActive: false,
          forceDeactivate: force,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to deactivate account");
      }

      showToast(`Account ${guardDialog.account.code} deactivated.`);
      setGuardDialog({ isOpen: false, account: null, mappedTypes: [], isChecking: false, isDeactivating: false });
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
      setGuardDialog((prev) => ({ ...prev, isDeactivating: false }));
    }
  };

  // Delete Account Handler
  const handleInitiateDelete = async (account: any) => {
    setDeleteDialog({
      isOpen: true,
      account,
      canDelete: false,
      reason: null,
      isChecking: true,
      isDeleting: false,
    });

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_account_usage",
          id: account.id,
        }),
      });
      const data = await res.json();
      setDeleteDialog((prev) => ({
        ...prev,
        isChecking: false,
        canDelete: data.canDelete,
        reason: data.deleteBlockReason,
      }));
    } catch (err: any) {
      setDeleteDialog((prev) => ({
        ...prev,
        isChecking: false,
        reason: "Failed to inspect account constraints.",
      }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.account) return;
    setDeleteDialog((prev) => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_account",
          id: deleteDialog.account.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete account");
      }

      showToast(`Account ${deleteDialog.account.code} permanently deleted.`);
      setDeleteDialog({ isOpen: false, account: null, canDelete: false, reason: null, isChecking: false, isDeleting: false });
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
      setDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          className={cn(
            "p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-150",
            toastMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          )}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{toastMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-[#71717A] hover:text-[#18181B] font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E4E7]">
          <div>
            <h3 className="text-sm font-bold text-[#18181B]">Chart of Accounts Hierarchy</h3>
            <p className="text-[11px] text-[#71717A]">
              Standard 4-level enterprise Chart of Accounts. Level 4 accounts receive automated posting lines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl border border-[#EDEDED] p-1 bg-[#F4F4F5]">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                  viewMode === "tree" ? "bg-white text-[#0D7A5F] shadow-xs" : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                <FolderTree className="w-3.5 h-3.5" />
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                  viewMode === "table" ? "bg-white text-[#0D7A5F] shadow-xs" : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Table
              </button>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={() => {
                setSelectedAccount(null);
                setModalMode("create");
                setModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Account
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 bg-white border border-[#EDEDED] hover:bg-[#F4F4F5] text-[#18181B] rounded-xl font-semibold text-xs inline-flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#71717A]" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === "tree" && (
              <>
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2 py-1 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-lg text-[11px] transition"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2 py-1 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-lg text-[11px] transition"
                >
                  Collapse All
                </button>
              </>
            )}

            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2 py-1 text-xs font-semibold text-[#18181B]"
            >
              <option value="ALL">All Levels (L1-L4)</option>
              <option value="1">Level 1: Categories</option>
              <option value="2">Level 2: Groups</option>
              <option value="3">Level 3: Parent Controls</option>
              <option value="4">Level 4: Posting Ledgers</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2 py-1 text-xs font-semibold text-[#18181B] capitalize"
            >
              <option value="ALL">All Classifications</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expenses</option>
              <option value="contra_revenue">Contra Revenue</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2 py-1 text-xs font-semibold text-[#18181B]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Deactivated Only</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search code or account title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F4F4F5] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TREE VIEW                                                                 */}
      {/* ========================================================================= */}
      {viewMode === "tree" && (
        <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F4F4F5] border-b border-[#E4E4E7] flex items-center justify-between text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
            <span>Account Hierarchy & Title</span>
            <span>Balance & Management Controls</span>
          </div>

          <div className="divide-y divide-[#EDEDED]">
            {tree.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                No Chart of Accounts found. Ensure system accounts are seeded.
              </div>
            ) : (
              tree.map((rootNode) => {
                const renderTreeNode = (node: any): React.ReactNode => {
                  const isExpanded = expandedNodes.has(node.code);
                  const hasChildren = node.children && node.children.length > 0;

                  // Filter check
                  const matchesSearch =
                    !searchQuery.trim() ||
                    node.code.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                    node.name.toLowerCase().includes(searchQuery.toLowerCase().trim());

                  const matchesLevel = levelFilter === "ALL" || String(node.level) === levelFilter;
                  const matchesType = typeFilter === "ALL" || node.type === typeFilter;
                  const matchesStatus =
                    statusFilter === "ALL" ||
                    (statusFilter === "ACTIVE" ? node.isActive !== false : node.isActive === false);

                  const hasMatchingDescendant = (n: any): boolean => {
                    if (!searchQuery.trim() && levelFilter === "ALL" && typeFilter === "ALL" && statusFilter === "ALL") {
                      return true;
                    }
                    const selfMatch =
                      (!searchQuery.trim() ||
                        n.code.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                        n.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) &&
                      (levelFilter === "ALL" || String(n.level) === levelFilter) &&
                      (typeFilter === "ALL" || n.type === typeFilter) &&
                      (statusFilter === "ALL" ||
                        (statusFilter === "ACTIVE" ? n.isActive !== false : n.isActive === false));

                    if (selfMatch) return true;
                    return n.children?.some((c: any) => hasMatchingDescendant(c)) || false;
                  };

                  if (!hasMatchingDescendant(node)) return null;

                  const levelStyles: Record<number, { bg: string; border: string; badge: string; label: string }> = {
                    1: {
                      bg: "bg-[#F4F4F5] font-bold text-[#18181B]",
                      border: "border-l-4 border-l-blue-600",
                      badge: "bg-blue-100 text-blue-900 border-blue-200",
                      label: "L1 · Category",
                    },
                    2: {
                      bg: "bg-[#FAFAFA] font-semibold text-[#27272A]",
                      border: "border-l-4 border-l-purple-500",
                      badge: "bg-purple-100 text-purple-900 border-purple-200",
                      label: "L2 · Group",
                    },
                    3: {
                      bg: "bg-white font-medium text-[#3F3F46]",
                      border: "border-l-4 border-l-amber-500",
                      badge: "bg-amber-100 text-amber-900 border-amber-200",
                      label: "L3 · Parent",
                    },
                    4: {
                      bg: "bg-[#F9FAFB]/70 hover:bg-emerald-50/40 text-[#18181B]",
                      border: "border-l-4 border-l-emerald-600",
                      badge: "bg-emerald-100 text-emerald-900 border-emerald-200 font-bold",
                      label: "L4 · Posting",
                    },
                  };

                  const style = levelStyles[node.level] || levelStyles[4];
                  const indent =
                    node.level === 1 ? "pl-3" : node.level === 2 ? "pl-7" : node.level === 3 ? "pl-12" : "pl-18";

                  return (
                    <div key={node.code} className="border-b border-[#EDEDED] last:border-b-0">
                      <div
                        className={cn(
                          "flex items-center justify-between text-xs pr-4 py-2.5 transition",
                          style.bg,
                          style.border,
                          indent,
                          node.isActive === false && "opacity-60 bg-zinc-100 line-through-label"
                        )}
                      >
                        {/* Left Side: Code, Name, System Badge, Type */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleNode(node.code)}
                              className="p-1 hover:bg-[#E4E4E7] rounded text-[#71717A] transition"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            </div>
                          )}

                          <span className="font-mono font-bold text-[11px] text-[#18181B] bg-white border border-[#EDEDED] px-2 py-0.5 rounded shadow-2xs">
                            {node.code}
                          </span>

                          <span className="truncate font-medium text-[#18181B]">{node.name}</span>

                          {/* Level Badge */}
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono shrink-0",
                              style.badge
                            )}
                          >
                            {style.label}
                          </span>

                          {/* System Lock Badge */}
                          {node.isSystem && (
                            <span
                              title="Permanent system core account (cannot be deleted)"
                              className="inline-flex items-center gap-1 text-[9px] font-bold bg-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded font-mono shrink-0"
                            >
                              <Lock className="w-2.5 h-2.5 text-zinc-600" />
                              System
                            </span>
                          )}

                          {/* Inactive Badge */}
                          {node.isActive === false && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Right Side: Balance, Status Toggle, Edit, Delete */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-xs text-[#18181B]">
                            {formatCurrency(node.balance)}
                          </span>

                          {/* Controls (Level 4 Leaf accounts or editable) */}
                          <div className="flex items-center gap-1.5">
                            {/* Activate / Deactivate Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(node)}
                              title={node.isActive === false ? "Click to Activate" : "Click to Deactivate"}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border transition",
                                node.isActive !== false
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                  : "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
                              )}
                            >
                              {node.isActive !== false ? "Active" : "Inactive"}
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAccount(node);
                                setModalMode("edit");
                                setModalOpen(true);
                              }}
                              title="Edit account title, description, or parent"
                              className="p-1 hover:bg-[#E4E4E7] rounded text-[#71717A] hover:text-[#18181B] transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button (Allowed for non-system accounts) */}
                            {!node.isSystem && node.level === 4 && (
                              <button
                                type="button"
                                onClick={() => handleInitiateDelete(node)}
                                title="Delete account (only if zero journal entries & zero mappings)"
                                className="p-1 hover:bg-rose-50 rounded text-rose-600 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasChildren && (isExpanded || Boolean(searchQuery.trim())) && (
                        <div>{node.children.map((c: any) => renderTreeNode(c))}</div>
                      )}
                    </div>
                  );
                };

                return renderTreeNode(rootNode);
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TABULAR VIEW                                                              */}
      {/* ========================================================================= */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Account Title</th>
                  <th className="py-2.5 px-3 text-center">Level</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Parent</th>
                  <th className="py-2.5 px-3 text-center">System Lock</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Balance</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {flat
                  .filter((a) => {
                    if (levelFilter !== "ALL" && String(a.level) !== levelFilter) return false;
                    if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
                    if (statusFilter === "ACTIVE" && a.isActive === false) return false;
                    if (statusFilter === "INACTIVE" && a.isActive !== false) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase().trim();
                      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map((acc) => (
                    <tr
                      key={acc.code}
                      className={cn(
                        "hover:bg-[#F9FAFB] transition",
                        acc.isActive === false && "opacity-60 bg-zinc-50"
                      )}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-[#18181B]">{acc.code}</td>
                      <td className="py-2.5 px-4 text-[#18181B] font-medium">{acc.name}</td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 border text-zinc-700">
                          L{acc.level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 capitalize text-[#71717A]">{acc.type}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A]">{acc.parentCode || "—"}</td>
                      <td className="py-2.5 px-3 text-center">
                        {acc.isSystem ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-600 bg-zinc-100 border px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(acc)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border transition",
                            acc.isActive !== false
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
                          )}
                        >
                          {acc.isActive !== false ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(acc.balance)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccount(acc);
                              setModalMode("edit");
                              setModalOpen(true);
                            }}
                            className="p-1 hover:bg-[#E4E4E7] rounded text-[#71717A] hover:text-[#18181B]"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!acc.isSystem && acc.level === 4 && (
                            <button
                              type="button"
                              onClick={() => handleInitiateDelete(acc)}
                              className="p-1 hover:bg-rose-50 rounded text-rose-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEACTIVATION GUARD DIALOG                                                 */}
      {/* ========================================================================= */}
      {guardDialog.isOpen && guardDialog.account && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E4E4E7] text-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">
                  Deactivation Guard: {guardDialog.account.code}
                </h3>
                <p className="text-[#71717A] text-xs mt-0.5">{guardDialog.account.name}</p>
              </div>
            </div>

            {guardDialog.isChecking ? (
              <div className="py-6 text-center text-[#71717A] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
                Checking active account mapping dependencies...
              </div>
            ) : guardDialog.mappedTypes.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-1">
                  <p className="font-bold">⚠️ Warning: Account is Actively Mapped</p>
                  <p className="text-[11px] leading-relaxed">
                    This account is currently assigned to <strong>{guardDialog.mappedTypes.length}</strong> operational
                    transaction type(s). If you deactivate it without reassigning, transactions hitting these roles will
                    be blocked by the accounting engine:
                  </p>
                </div>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#EDEDED] p-2 bg-[#FAFAFA] space-y-1 font-mono text-[11px]">
                  {guardDialog.mappedTypes.map((t) => (
                    <div key={t} className="flex items-center justify-between p-1 hover:bg-white rounded">
                      <span className="text-zinc-800">{t}</span>
                      {onNavigateToMapping && (
                        <button
                          type="button"
                          onClick={() => {
                            setGuardDialog({ isOpen: false, account: null, mappedTypes: [], isChecking: false, isDeactivating: false });
                            onNavigateToMapping(t);
                          }}
                          className="text-[10px] text-[#0D7A5F] font-bold hover:underline"
                        >
                          Reassign →
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-zinc-500">
                  Recommended action: reassign these mappings in the <strong>Account Mapping</strong> tab first. If you
                  proceed, you will force-deactivate this account.
                </p>
              </div>
            ) : (
              <p className="text-zinc-600 leading-relaxed">
                This account has zero active mapping dependencies. Deactivating it will prevent future manual selections
                while retaining historical reporting data.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() =>
                  setGuardDialog({ isOpen: false, account: null, mappedTypes: [], isChecking: false, isDeactivating: false })
                }
                className="px-3.5 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B]"
              >
                Cancel
              </button>

              {guardDialog.mappedTypes.length > 0 ? (
                <button
                  type="button"
                  disabled={guardDialog.isDeactivating}
                  onClick={() => handleConfirmDeactivate(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
                >
                  {guardDialog.isDeactivating ? "Deactivating..." : "Force Deactivate"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={guardDialog.isDeactivating}
                  onClick={() => handleConfirmDeactivate(false)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
                >
                  {guardDialog.isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION DIALOG                                                */}
      {/* ========================================================================= */}
      {deleteDialog.isOpen && deleteDialog.account && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E4E4E7] text-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">Delete Account: {deleteDialog.account.code}</h3>
                <p className="text-[#71717A] text-xs mt-0.5">{deleteDialog.account.name}</p>
              </div>
            </div>

            {deleteDialog.isChecking ? (
              <div className="py-6 text-center text-[#71717A] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
                Verifying audit constraints...
              </div>
            ) : deleteDialog.canDelete ? (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-1">
                  <p className="font-bold">✓ Safe for Deletion</p>
                  <p className="text-[11px] leading-relaxed">
                    This account is a custom Level 4 account with <strong>0 posted journal entries</strong> and{" "}
                    <strong>0 active mappings</strong>. It can be safely and permanently removed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl space-y-1">
                  <p className="font-bold">❌ Deletion Blocked</p>
                  <p className="text-[11px] leading-relaxed">{deleteDialog.reason}</p>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Accounts with financial ledger history cannot be destroyed per GAAP rules. You may deactivate it instead.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() =>
                  setDeleteDialog({ isOpen: false, account: null, canDelete: false, reason: null, isChecking: false, isDeleting: false })
                }
                className="px-3.5 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B]"
              >
                Close
              </button>

              {deleteDialog.canDelete && (
                <button
                  type="button"
                  disabled={deleteDialog.isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition disabled:opacity-50"
                >
                  {deleteDialog.isDeleting ? "Deleting..." : "Permanently Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COA Account Add/Edit Modal */}
      <CoaAccountModal
        isOpen={modalOpen}
        mode={modalMode}
        accountToEdit={selectedAccount}
        allAccounts={flat}
        onClose={() => setModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          onRefresh();
        }}
      />
    </div>
  );
}
