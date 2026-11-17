"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Scale, CheckCircle2 } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

export interface ProjectExpense {
  id: string;
  kind?: string | null; // expense | petty_topup | petty_spend
  title: string;
  amount: number;
  category?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface ProjectExpensesTabProps {
  projectId: string;
  expenses: ProjectExpense[];
  pettyBalance?: number;
  expensesTotal?: number;
  hisaabStatus?: string | null;
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

const inputCls =
  "h-8 px-2.5 text-xs bg-white border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B] w-full";
const btnPrimary =
  "h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50";
const btnGhost =
  "h-8 px-2.5 rounded-lg border border-[#D4D4D8] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#52525B] inline-flex items-center gap-1.5 transition disabled:opacity-50";

const KIND_CHIP: Record<string, { label: string; cls: string }> = {
  expense: { label: "Expense", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  petty_topup: { label: "Petty In", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  petty_spend: { label: "Petty Out", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const HISAAB_LABELS: Record<string, string> = {
  contractValue: "Contract Value",
  totalBudget: "Total Budget",
  invoicedAmount: "Invoiced",
  totalInvoiced: "Invoiced",
  paidAmount: "Received / Paid",
  totalPaid: "Received / Paid",
  expensesTotal: "Expenses",
  totalExpenses: "Expenses",
  pettyBalance: "Petty Cash Balance",
  pettyIn: "Petty Cash In",
  pettyOut: "Petty Cash Out",
  retentionPercent: "Retention %",
  retentionAmount: "Retention Held",
  balanceDue: "Balance Due",
  outstanding: "Outstanding",
  boqTotal: "BOQ Scheduled",
  actualCost: "Actual Cost",
};

export default function ProjectExpensesTab({
  projectId,
  expenses,
  pettyBalance,
  expensesTotal,
  hisaabStatus,
  onRefresh,
  showToast,
}: ProjectExpensesTabProps) {
  const { hasPermission } = useRole();
  const canExpense = hasPermission("projects.expenses");
  const canPetty = hasPermission("projects.petty_cash");
  const canHisaab = hasPermission("projects.hisaab");

  const [busy, setBusy] = useState(false);
  const [hisaab, setHisaab] = useState<Record<string, any> | null>(null);
  const [hisaabLoading, setHisaabLoading] = useState(false);

  // Expense form
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("");
  const [expNotes, setExpNotes] = useState("");

  // Petty cash form
  const [pettyTitle, setPettyTitle] = useState("");
  const [pettyAmount, setPettyAmount] = useState("");
  const [pettyNotes, setPettyNotes] = useState("");

  const computedExpensesTotal = useMemo(
    () =>
      expenses
        .filter((e) => (e.kind || "expense") === "expense")
        .reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses]
  );
  const computedPettyBalance = useMemo(
    () =>
      expenses.reduce((s, e) => {
        const amt = Number(e.amount) || 0;
        if (e.kind === "petty_topup") return s + amt;
        if (e.kind === "petty_spend") return s - amt;
        return s;
      }, 0),
    [expenses]
  );

  const displayExpensesTotal = expensesTotal !== undefined ? expensesTotal : computedExpensesTotal;
  const displayPettyBalance = pettyBalance !== undefined ? pettyBalance : computedPettyBalance;
  const settled = (hisaabStatus || hisaab?.hisaabStatus || "open").toLowerCase() === "settled";

  const loadHisaab = useCallback(async () => {
    try {
      setHisaabLoading(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "project_hisaab", projectId }),
      });
      if (!res.ok) throw new Error("hisaab unavailable");
      const data = await res.json();
      setHisaab(data?.summary || data || null);
    } catch {
      setHisaab(null);
    } finally {
      setHisaabLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadHisaab();
  }, [loadHisaab, expenses.length]);

  async function postAction(action: string, extra: Record<string, any>, successMsg: string) {
    try {
      setBusy(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Action failed");
      }
      showToast(successMsg, "success");
      onRefresh();
      return true;
    } catch (e: any) {
      showToast(e.message || "Action failed", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const handleAddExpense = async () => {
    if (!expTitle.trim() || !(Number(expAmount) > 0)) {
      showToast("Expense title and a positive amount are required.", "error");
      return;
    }
    const ok = await postAction(
      "add_expense",
      {
        title: expTitle.trim(),
        amount: Number(expAmount),
        category: expCategory.trim() || undefined,
        notes: expNotes.trim() || undefined,
      },
      "Expense recorded."
    );
    if (ok) {
      setExpTitle("");
      setExpAmount("");
      setExpCategory("");
      setExpNotes("");
    }
  };

  const handlePetty = async (action: "petty_topup" | "petty_spend") => {
    if (!(Number(pettyAmount) > 0)) {
      showToast("Enter a positive petty cash amount.", "error");
      return;
    }
    const ok = await postAction(
      action,
      {
        title: pettyTitle.trim() || (action === "petty_topup" ? "Petty cash top-up" : "Petty cash spend"),
        amount: Number(pettyAmount),
        notes: pettyNotes.trim() || undefined,
      },
      action === "petty_topup" ? "Petty cash topped up." : "Petty cash spend recorded."
    );
    if (ok) {
      setPettyTitle("");
      setPettyAmount("");
      setPettyNotes("");
    }
  };

  const handleSettle = async () => {
    const note = window.prompt("Settlement note (optional):", "");
    if (note === null) return;
    await postAction(
      "settle_hisaab",
      { note: note.trim() || undefined },
      "Project hisaab settled."
    );
  };

  const hisaabEntries = useMemo(() => {
    if (!hisaab || typeof hisaab !== "object") return [];
    return Object.entries(hisaab).filter(
      ([k, v]) => typeof v === "number" && HISAAB_LABELS[k]
    ) as Array<[string, number]>;
  }, [hisaab]);

  return (
    <div className="space-y-4">
      {/* Header figures */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Total Expenses
          </span>
          <span className="font-mono font-bold text-sm text-rose-700 mt-1 block">
            {formatCurrency(displayExpensesTotal)}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Petty Cash Balance
          </span>
          <span className="font-mono font-bold text-sm text-[#0D7A5F] mt-1 block">
            {formatCurrency(displayPettyBalance)}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Hisaab Status
          </span>
          <span
            className={cn(
              "text-[11px] font-bold px-2 py-0.5 rounded-full capitalize inline-block mt-1.5",
              settled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            )}
          >
            {settled ? "Settled" : "Open"}
          </span>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7]">
          <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#0D7A5F]" />
            Project Expenses & Petty Cash
          </h3>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            Miscellaneous site expenses and the project petty-cash float are managed inside the
            project.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {expenses.length === 0 ? (
            <p className="text-xs text-[#71717A] italic">No expenses or petty cash entries yet.</p>
          ) : (
            <div className="divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-lg overflow-hidden">
              {expenses.map((e) => {
                const chip = KIND_CHIP[e.kind || "expense"] || KIND_CHIP.expense;
                return (
                  <div key={e.id} className="px-3 py-2.5 flex items-center gap-3">
                    <span
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide shrink-0",
                        chip.cls
                      )}
                    >
                      {chip.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#18181B] truncate">{e.title}</p>
                      <p className="text-[10px] text-[#71717A]">
                        {e.category ? `${e.category} · ` : ""}
                        {e.notes ? `${e.notes} · ` : ""}
                        {e.createdAt ? formatDate(e.createdAt) : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-mono font-bold text-xs",
                        e.kind === "petty_topup" ? "text-emerald-700" : "text-rose-700"
                      )}
                    >
                      {e.kind === "petty_topup" ? "+" : "−"} {formatCurrency(e.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-dashed border-[#E4E4E7]">
            {/* Add expense */}
            {canExpense ? (
              <div>
                <h4 className="text-[11px] font-bold text-[#18181B] uppercase tracking-wider mb-2">
                  Record Expense
                </h4>
                <div className="space-y-2">
                  <input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="Expense title" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="Amount" className={inputCls} />
                    <input value={expCategory} onChange={(e) => setExpCategory(e.target.value)} placeholder="Category (optional)" className={inputCls} />
                  </div>
                  <input value={expNotes} onChange={(e) => setExpNotes(e.target.value)} placeholder="Notes (optional)" className={inputCls} />
                  <button type="button" onClick={handleAddExpense} disabled={busy} className={btnPrimary}>
                    <Plus className="w-3.5 h-3.5" /> Add Expense
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#A1A1AA] italic">
                You need the &quot;Record Project Expenses&quot; permission to add expenses.
              </p>
            )}

            {/* Petty cash */}
            {canPetty ? (
              <div>
                <h4 className="text-[11px] font-bold text-[#18181B] uppercase tracking-wider mb-2">
                  Petty Cash
                </h4>
                <div className="space-y-2">
                  <input value={pettyTitle} onChange={(e) => setPettyTitle(e.target.value)} placeholder="Title (optional)" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min="0" value={pettyAmount} onChange={(e) => setPettyAmount(e.target.value)} placeholder="Amount" className={inputCls} />
                    <input value={pettyNotes} onChange={(e) => setPettyNotes(e.target.value)} placeholder="Notes (optional)" className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handlePetty("petty_topup")} disabled={busy} className={btnPrimary}>
                      <ArrowDownCircle className="w-3.5 h-3.5" /> Top Up
                    </button>
                    <button type="button" onClick={() => handlePetty("petty_spend")} disabled={busy} className={btnGhost}>
                      <ArrowUpCircle className="w-3.5 h-3.5" /> Spend
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#A1A1AA] italic">
                You need the &quot;Manage Project Petty Cash&quot; permission for petty cash entries.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hisaab */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#0D7A5F]" />
            Project Hisaab (Settlement Summary)
          </h3>
          {canHisaab && !settled && (
            <button type="button" onClick={handleSettle} disabled={busy} className={btnPrimary}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Settle Hisaab
            </button>
          )}
        </div>
        <div className="p-4">
          {hisaabLoading ? (
            <p className="text-xs text-[#71717A]">Loading hisaab…</p>
          ) : hisaabEntries.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {hisaabEntries.map(([key, value]) => (
                <div key={key} className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
                    {HISAAB_LABELS[key]}
                  </span>
                  <span className="font-mono font-bold text-sm text-[#18181B] mt-1 block">
                    {key === "retentionPercent" ? `${value}%` : formatCurrency(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#71717A] italic">
              Hisaab summary is not available right now. Contract, invoiced and received figures are
              shown in the Billing tab.
            </p>
          )}
          {settled && (
            <p className="text-[11px] text-emerald-700 font-semibold mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> This project&apos;s hisaab has been settled
              with the cashier / accountant.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
