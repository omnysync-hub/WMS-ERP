"use client";

import React, { useEffect, useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Building,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Unlink,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Search,
  Check,
  MousePointerClick,
  History,
  ListFilter,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";

export default function BankReconciliationTab() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<any>(null);
  const [unreconciledLines, setUnreconciledLines] = useState<any[]>([]);
  const [reconciledLines, setReconciledLines] = useState<any[]>([]);

  // Navigation tab: manual workspace vs reconciled history
  const [activeTab, setActiveTab] = useState<"manual_rec" | "history">("manual_rec");

  // Selection states for line-by-line matching
  const [selectedStatementLine, setSelectedStatementLine] = useState<any | null>(null);
  const [selectedGlLine, setSelectedGlLine] = useState<any | null>(null);
  const [matchingInProgress, setMatchingInProgress] = useState(false);

  // Search filters
  const [searchStmt, setSearchStmt] = useState("");
  const [searchHistory, setSearchHistory] = useState("");

  // CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  // Status messages
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 1. Fetch available bank accounts
  useEffect(() => {
    fetch("/api/accounts?view=bank_reconciliation")
      .then((res) => res.json())
      .then((data) => {
        if (data.bankAccounts && data.bankAccounts.length > 0) {
          setBankAccounts(data.bankAccounts);
          setSelectedAccountId(data.bankAccounts[0].id);
        }
      })
      .catch((err) => console.error("Failed to load bank accounts", err));
  }, []);

  // 2. Fetch reconciliation data for selected account
  const loadReconciliation = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/accounts?view=bank_reconciliation&bankAccountId=${selectedAccountId}&statementDate=${statementDate}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load bank reconciliation");

      setReconciliationData(data.reconciliationStatement);
      setUnreconciledLines(data.unreconciledLines || []);
      setReconciledLines(data.reconciledLines || []);

      // Retain or clear selection if it no longer exists
      if (selectedStatementLine) {
        const stillExists = (data.unreconciledLines || []).find((l: any) => l.id === selectedStatementLine.id);
        if (!stillExists) {
          setSelectedStatementLine(null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadReconciliation();
    }
  }, [selectedAccountId, statementDate]);

  // 3. Manual Line-by-Line Reconciliation Handler
  const handleManualMatch = async (statementLineId: string, journalLineId: string) => {
    setMatchingInProgress(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bank_rec_manualmatch",
          statementLineId,
          journalLineId,
          actorName: "Fatima Noor (Accountant)",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Manual match failed");

      setSuccessMsg("Line reconciled successfully! General Ledger timing difference cleared.");
      setSelectedStatementLine(null);
      setSelectedGlLine(null);
      await loadReconciliation();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setMatchingInProgress(false);
    }
  };

  // 4. Handle CSV Import
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      alert("Please paste bank statement CSV text.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bank_rec_import",
          bankAccountId: selectedAccountId,
          csvText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setShowImportModal(false);
      setCsvText("");
      setSuccessMsg(`Successfully imported ${data.importedCount || data.count || "rows"} bank statement transactions.`);
      loadReconciliation();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setImporting(false);
    }
  };

  // 5. Unmatch Reconciled Line
  const handleUnmatch = async (statementLineId: string) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bank_rec_unmatch",
          statementLineId,
          actorName: "Fatima Noor (Accountant)",
        }),
      });
      if (!res.ok) throw new Error("Failed to unmatch");
      setSuccessMsg("Line unmatched. Returned to active un-reconciled pool.");
      loadReconciliation();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Filtered lists
  const filteredUnreconciledLines = useMemo(() => {
    if (!searchStmt.trim()) return unreconciledLines;
    const q = searchStmt.toLowerCase();
    return unreconciledLines.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        (l.referenceNumber && l.referenceNumber.toLowerCase().includes(q)) ||
        l.debit.toString().includes(q) ||
        l.credit.toString().includes(q)
    );
  }, [unreconciledLines, searchStmt]);

  const filteredReconciledLines = useMemo(() => {
    if (!searchHistory.trim()) return reconciledLines;
    const q = searchHistory.toLowerCase();
    return reconciledLines.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        (l.referenceNumber && l.referenceNumber.toLowerCase().includes(q)) ||
        l.debit.toString().includes(q) ||
        l.credit.toString().includes(q) ||
        (l.matchedJournalLine?.journalEntry?.memo &&
          l.matchedJournalLine.journalEntry.memo.toLowerCase().includes(q))
    );
  }, [reconciledLines, searchHistory]);

  // Selected statement line details & matching candidates
  const isDepositSelected = selectedStatementLine ? selectedStatementLine.debit > 0 : false;
  const selectedAmount = selectedStatementLine
    ? isDepositSelected
      ? selectedStatementLine.debit
      : selectedStatementLine.credit
    : 0;

  const candidateGlList = useMemo(() => {
    if (!selectedStatementLine || !reconciliationData) return [];
    if (isDepositSelected) {
      return (reconciliationData.unmatchedDeposits || []).map((d: any) => ({
        ...d,
        type: "deposit",
        isExactMatch: Math.abs(d.amount - selectedAmount) < 0.01,
      }));
    } else {
      return (reconciliationData.unmatchedPayments || []).map((p: any) => ({
        ...p,
        type: "payment",
        isExactMatch: Math.abs(p.amount - selectedAmount) < 0.01,
      }));
    }
  }, [selectedStatementLine, reconciliationData, isDepositSelected, selectedAmount]);

  // Sort candidate GL entries: exact amount matches first
  const sortedCandidates = useMemo(() => {
    return [...candidateGlList].sort((a, b) => {
      if (a.isExactMatch && !b.isExactMatch) return -1;
      if (!a.isExactMatch && b.isExactMatch) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [candidateGlList]);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900 font-bold px-1">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg("")} className="text-rose-700 hover:text-rose-900 font-bold px-1">
            ✕
          </button>
        </div>
      )}

      {/* Account Selector & Actions Bar (Auto-Match removed; Manual Reconciliation Workstation prominent) */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <Building className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-semibold text-[#18181B]">Bank Account:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="h-8 px-3 bg-white border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            >
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-[#71717A]" />
            <span className="font-medium text-[#71717A]">Statement Date:</span>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="h-8 px-2.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#18181B] focus:outline-none"
            />
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Manual Line-by-Line Mode
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="h-8 px-3 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Import CSV Statement
          </button>

          <button
            type="button"
            onClick={loadReconciliation}
            disabled={loading}
            className="h-8 px-2.5 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg text-xs font-medium transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 5-Box Reconciliation Metric Grid (GAAP Double-Entry Standard) */}
      {reconciliationData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
            <span className="text-[10px] text-[#71717A] uppercase font-bold block">1. Bank Statement Ending</span>
            <span className="text-base font-mono font-bold text-[#18181B] mt-0.5 block">
              {formatCurrency(reconciliationData.statement.balancePerBank)}
            </span>
            <span className="text-[10px] text-[#A1A1AA]">Per bank statement file</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
            <span className="text-[10px] text-[#71717A] uppercase font-bold block">2. (+) Deposits in Transit</span>
            <span className="text-base font-mono font-bold text-emerald-700 mt-0.5 block">
              +{formatCurrency(reconciliationData.statement.depositsInTransit)}
            </span>
            <span className="text-[10px] text-[#A1A1AA]">
              {reconciliationData.statement.depositsInTransitCount} pending deposits
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
            <span className="text-[10px] text-[#71717A] uppercase font-bold block">3. (-) Unpresented Cheques</span>
            <span className="text-base font-mono font-bold text-rose-700 mt-0.5 block">
              -{formatCurrency(reconciliationData.statement.unpresentedCheques)}
            </span>
            <span className="text-[10px] text-[#A1A1AA]">
              {reconciliationData.statement.unpresentedChequesCount} uncleared payments
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-xs">
            <span className="text-[10px] text-emerald-900 uppercase font-bold block">4. Adjusted Bank Balance</span>
            <span className="text-base font-mono font-bold text-[#0D7A5F] mt-0.5 block">
              {formatCurrency(reconciliationData.statement.adjustedBankBalance)}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">Bank + Deposits - Cheques</span>
          </div>

          <div
            className={`p-3.5 rounded-xl border shadow-xs ${
              reconciliationData.statement.isReconciled
                ? "bg-white border-emerald-300"
                : "bg-rose-50 border-rose-300"
            }`}
          >
            <span className="text-[10px] uppercase font-bold block text-[#71717A]">
              5. GL Book Balance / Diff
            </span>
            <span className="text-base font-mono font-bold text-[#18181B] mt-0.5 block">
              {formatCurrency(reconciliationData.statement.balancePerBooks)}
            </span>
            <span
              className={`text-[10px] font-bold inline-flex items-center gap-1 ${
                reconciliationData.statement.isReconciled ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {reconciliationData.statement.isReconciled ? (
                <>
                  <ShieldCheck className="w-3 h-3" /> Reconciled (0.00)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" /> Diff: {formatCurrency(reconciliationData.statement.discrepancy)}
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-[#E4E4E7]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("manual_rec")}
            className={`pb-3 px-4 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition ${
              activeTab === "manual_rec"
                ? "border-[#0D7A5F] text-[#0D7A5F]"
                : "border-transparent text-[#71717A] hover:text-[#18181B]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Manual Line-by-Line Match
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "manual_rec"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-[#F4F4F5] text-[#71717A]"
              }`}
            >
              {unreconciledLines.length} pending
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-4 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition ${
              activeTab === "history"
                ? "border-[#0D7A5F] text-[#0D7A5F]"
                : "border-transparent text-[#71717A] hover:text-[#18181B]"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Reconciled History & Audit
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "history"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-[#F4F4F5] text-[#71717A]"
              }`}
            >
              {reconciledLines.length} cleared
            </span>
          </button>
        </div>

        <div className="text-[11px] text-[#71717A] pb-2 hidden md:block">
          Accountant verifies each bank line individually against General Ledger
        </div>
      </div>

      {/* TAB 1: MANUAL LINE-BY-LINE RECONCILIATION WORKSPACE */}
      {activeTab === "manual_rec" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN: Bank Statement Lines */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  Imported Bank Statement Lines
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Select a statement line to inspect and pair candidate GL vouchers
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter lines..."
                  value={searchStmt}
                  onChange={(e) => setSearchStmt(e.target.value)}
                  className="w-full h-8 pl-9 pr-2 bg-white border border-[#E4E4E7] rounded-lg text-xs placeholder:text-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description / Ref</th>
                    <th className="py-2.5 px-3 text-right">Debit (Deposit)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Outflow)</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {filteredUnreconciledLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-[#71717A] text-xs">
                        <UploadCloud className="w-8 h-8 mx-auto text-[#A1A1AA] mb-2 opacity-50" />
                        No un-reconciled bank statement lines. Import a CSV statement to begin.
                      </td>
                    </tr>
                  ) : (
                    filteredUnreconciledLines.map((line: any) => {
                      const isSelected = selectedStatementLine?.id === line.id;
                      const hasGlAmountMatch =
                        selectedGlLine &&
                        ((selectedGlLine.type === "deposit" &&
                          line.debit > 0 &&
                          Math.abs(line.debit - selectedGlLine.amount) < 0.01) ||
                          (selectedGlLine.type === "payment" &&
                            line.credit > 0 &&
                            Math.abs(line.credit - selectedGlLine.amount) < 0.01));

                      return (
                        <tr
                          key={line.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedStatementLine(null);
                            } else {
                              setSelectedStatementLine(line);
                              // If a GL line was also selected and matches, accountant can complete pair!
                            }
                          }}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-emerald-50/90 border-l-4 border-l-[#0D7A5F] font-medium"
                              : hasGlAmountMatch
                              ? "bg-amber-50/70 hover:bg-amber-100/70"
                              : "hover:bg-[#FAFAFA]"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="radio"
                              name="selected_statement_line"
                              checked={isSelected}
                              onChange={() => setSelectedStatementLine(line)}
                              className="accent-[#0D7A5F] w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A] whitespace-nowrap">
                            {new Date(line.statementDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#18181B]">{line.description}</div>
                            {line.referenceNumber && (
                              <div className="text-[10px] text-[#71717A] font-mono">
                                Ref: {line.referenceNumber}
                              </div>
                            )}
                            {hasGlAmountMatch && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-bold">
                                Matches Selected GL Voucher
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 whitespace-nowrap font-medium">
                            {line.debit > 0 ? `+${formatCurrency(line.debit)}` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700 whitespace-nowrap font-medium">
                            {line.credit > 0 ? `-${formatCurrency(line.credit)}` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isSelected ? (
                              <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-[#0D7A5F] text-white inline-flex items-center gap-1 shadow-xs">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStatementLine(line);
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold text-[#71717A] hover:text-[#0D7A5F] hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
                              >
                                Match Line →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {selectedStatementLine && (
              <div className="p-3 bg-emerald-50/60 border-t border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-semibold flex items-center gap-1.5">
                  <MousePointerClick className="w-3.5 h-3.5 text-emerald-700" />
                  Active line: {selectedStatementLine.description} (
                  {isDepositSelected
                    ? `+${formatCurrency(selectedStatementLine.debit)}`
                    : `-${formatCurrency(selectedStatementLine.credit)}`}
                  )
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStatementLine(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px] underline"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: General Ledger Timing Differences & Manual Line Pairing Workstation */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA]">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0D7A5F]" />
                General Ledger Timing Differences (Cashbook)
              </h3>
              <p className="text-[11px] text-[#71717A]">
                Transactions posted to Cashbook ledger awaiting bank clearance
              </p>
            </div>

            {/* PAIRING PROMPT BANNER */}
            {selectedStatementLine ? (
              <div className="p-4 bg-emerald-50/50 border-b border-emerald-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      Target Bank Line for Manual Reconciliation:
                    </span>
                    <h4 className="text-sm font-bold text-[#18181B] mt-0.5">
                      {selectedStatementLine.description}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#71717A] mt-1 font-mono">
                      <span>Date: {new Date(selectedStatementLine.statementDate).toLocaleDateString()}</span>
                      {selectedStatementLine.referenceNumber && (
                        <span>Ref: {selectedStatementLine.referenceNumber}</span>
                      )}
                      <span className="font-bold text-emerald-800">
                        Amount: {isDepositSelected ? `+${formatCurrency(selectedStatementLine.debit)}` : `-${formatCurrency(selectedStatementLine.credit)}`}
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-emerald-700 text-white text-[11px] font-bold rounded-lg shrink-0">
                    {isDepositSelected ? "Looking for Deposit" : "Looking for Outflow"}
                  </span>
                </div>

                <p className="text-[11px] text-emerald-800 mt-2 flex items-center gap-1 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Select the corresponding GL timing difference below and click &quot;Reconcile Line&quot; to clear it.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50/60 border-b border-blue-200 text-blue-900 text-xs flex items-center gap-2.5">
                <MousePointerClick className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  <strong>Accountant Instruction:</strong> Click any bank statement line on the left to see matching General Ledger entries and reconcile line-by-line.
                </span>
              </div>
            )}

            {/* CANDIDATE GL ENTRIES LIST */}
            <div className="divide-y divide-[#E4E4E7] max-h-[520px] overflow-y-auto">
              {selectedStatementLine ? (
                // WHEN A STATEMENT LINE IS SELECTED: Show filtered candidate list with exact match priorities
                sortedCandidates.length === 0 ? (
                  <div className="p-10 text-center text-[#71717A] text-xs">
                    <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-[#18181B]">No un-cleared General Ledger entries match this direction.</p>
                    <p className="text-[11px] text-[#71717A] mt-1">
                      If this is an unrecorded bank fee, interest income, or bank charge, please record the cashbook entry in the Journal tab first.
                    </p>
                  </div>
                ) : (
                  sortedCandidates.map((candidate: any) => {
                    const isExact = candidate.isExactMatch;
                    return (
                      <div
                        key={candidate.id}
                        className={`p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isExact
                            ? "bg-emerald-50/60 hover:bg-emerald-50 border-l-4 border-l-emerald-600"
                            : "hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[#71717A]">
                              {new Date(candidate.date).toLocaleDateString()}
                            </span>
                            {isExact && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                🎯 Exact Amount Match
                              </span>
                            )}
                            {candidate.refType && (
                              <span className="px-1.5 py-0.5 bg-[#F4F4F5] text-[#71717A] rounded text-[10px] font-mono">
                                {candidate.refType}
                              </span>
                            )}
                          </div>

                          <div className="font-semibold text-xs text-[#18181B]">
                            {candidate.memo || "General Ledger Entry"}
                          </div>

                          {candidate.refId && (
                            <div className="text-[10px] text-[#71717A] font-mono">
                              Ref ID: {candidate.refId}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span
                            className={`font-mono font-bold text-xs ${
                              candidate.type === "deposit" ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {candidate.type === "deposit"
                              ? `+${formatCurrency(candidate.amount)}`
                              : `-${formatCurrency(candidate.amount)}`}
                          </span>

                          <button
                            type="button"
                            disabled={matchingInProgress}
                            onClick={() => handleManualMatch(selectedStatementLine.id, candidate.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50 ${
                              isExact
                                ? "bg-[#0D7A5F] hover:bg-[#0A624C] text-white"
                                : "bg-[#18181B] hover:bg-black text-white"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {matchingInProgress ? "Reconciling..." : "Reconcile Line"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                // WHEN NO STATEMENT LINE IS SELECTED: Show all timing differences grouped by Deposits and Cheques
                <>
                  {/* Deposits in transit section */}
                  <div className="p-3 bg-emerald-50/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
                      Deposits in Transit ({reconciliationData?.unmatchedDeposits?.length || 0})
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-800">
                      +{formatCurrency(reconciliationData?.statement?.depositsInTransit || 0)}
                    </span>
                  </div>

                  {(!reconciliationData?.unmatchedDeposits || reconciliationData.unmatchedDeposits.length === 0) ? (
                    <div className="p-4 text-center text-[11px] text-[#71717A]">
                      No deposits in transit pending clearance.
                    </div>
                  ) : (
                    reconciliationData.unmatchedDeposits.map((dep: any) => {
                      const isGlSelected = selectedGlLine?.id === dep.id;
                      return (
                        <div
                          key={dep.id}
                          onClick={() =>
                            setSelectedGlLine(isGlSelected ? null : { ...dep, type: "deposit" })
                          }
                          className={`p-3 hover:bg-[#FAFAFA] flex justify-between items-center text-xs cursor-pointer transition ${
                            isGlSelected ? "bg-amber-50 border-l-4 border-l-amber-600 font-medium" : ""
                          }`}
                        >
                          <div>
                            <span className="font-mono text-[11px] text-[#71717A] block">
                              {new Date(dep.date).toLocaleDateString()}
                            </span>
                            <span className="text-[#18181B] font-medium">{dep.memo}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-700 block">
                              +{formatCurrency(dep.amount)}
                            </span>
                            <span className="text-[10px] text-[#71717A]">Click to inspect</span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Unpresented cheques section */}
                  <div className="p-3 bg-rose-50/40 border-t border-[#E4E4E7] flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />
                      Unpresented Cheques & Outflows ({reconciliationData?.unmatchedPayments?.length || 0})
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-800">
                      -{formatCurrency(reconciliationData?.statement?.unpresentedCheques || 0)}
                    </span>
                  </div>

                  {(!reconciliationData?.unmatchedPayments || reconciliationData.unmatchedPayments.length === 0) ? (
                    <div className="p-4 text-center text-[11px] text-[#71717A]">
                      No unpresented cheques or outflows pending clearance.
                    </div>
                  ) : (
                    reconciliationData.unmatchedPayments.map((pay: any) => {
                      const isGlSelected = selectedGlLine?.id === pay.id;
                      return (
                        <div
                          key={pay.id}
                          onClick={() =>
                            setSelectedGlLine(isGlSelected ? null : { ...pay, type: "payment" })
                          }
                          className={`p-3 hover:bg-[#FAFAFA] flex justify-between items-center text-xs cursor-pointer transition ${
                            isGlSelected ? "bg-amber-50 border-l-4 border-l-amber-600 font-medium" : ""
                          }`}
                        >
                          <div>
                            <span className="font-mono text-[11px] text-[#71717A] block">
                              {new Date(pay.date).toLocaleDateString()}
                            </span>
                            <span className="text-[#18181B] font-medium">{pay.memo}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-rose-700 block">
                              -{formatCurrency(pay.amount)}
                            </span>
                            <span className="text-[10px] text-[#71717A]">Click to inspect</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECONCILED HISTORY & AUDIT TRAIL */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#0D7A5F]" />
                Reconciled Bank Statement Lines ({reconciledLines.length})
              </h3>
              <p className="text-[11px] text-[#71717A]">
                Audit history of statement lines manually paired with Cashbook General Ledger entries
              </p>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search reconciled lines..."
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                className="w-full h-8 pl-9 pr-2 bg-white border border-[#E4E4E7] rounded-lg text-xs placeholder:text-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A]">
                <tr>
                  <th className="py-2.5 px-3">Statement Date</th>
                  <th className="py-2.5 px-3">Bank Line Description</th>
                  <th className="py-2.5 px-3 text-right">Bank Amount</th>
                  <th className="py-2.5 px-3">Matched General Ledger Voucher</th>
                  <th className="py-2.5 px-3">Reconciled Details</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {filteredReconciledLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#71717A] text-xs">
                      No reconciled lines found in this account history.
                    </td>
                  </tr>
                ) : (
                  filteredReconciledLines.map((line: any) => {
                    const isDeposit = line.debit > 0;
                    return (
                      <tr key={line.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A] whitespace-nowrap">
                          {new Date(line.statementDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#18181B]">{line.description}</div>
                          {line.referenceNumber && (
                            <div className="text-[10px] text-[#71717A] font-mono">
                              Ref: {line.referenceNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium whitespace-nowrap">
                          {isDeposit ? (
                            <span className="text-emerald-700">+{formatCurrency(line.debit)}</span>
                          ) : (
                            <span className="text-rose-700">-{formatCurrency(line.credit)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {line.matchedJournalLine ? (
                            <div>
                              <div className="font-medium text-[#18181B]">
                                {line.matchedJournalLine.journalEntry?.memo || "Matched Cashbook Voucher"}
                              </div>
                              <div className="text-[10px] text-[#71717A] font-mono">
                                Date:{" "}
                                {new Date(
                                  line.matchedJournalLine.journalEntry?.date || line.statementDate
                                ).toLocaleDateString()}
                                {line.matchedJournalLine.journalEntry?.refId &&
                                  ` • Ref: ${line.matchedJournalLine.journalEntry.refId}`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#71717A] italic">Linked GL Line ID: {line.matchedJournalLineId}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#71717A]">
                          <div>By: {line.reconciledBy || "Accountant"}</div>
                          {line.reconciledAt && (
                            <div className="text-[10px] font-mono">
                              {new Date(line.reconciledAt).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleUnmatch(line.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition inline-flex items-center gap-1"
                            title="Unmatch this line and restore to unreconciled pool"
                          >
                            <Unlink className="w-3 h-3 text-rose-600" />
                            Unmatch
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-[#E4E4E7] overflow-hidden">
            <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#0D7A5F]" />
                  Import Bank Statement (CSV)
                </h3>
                <p className="text-xs text-[#71717A] mt-0.5">
                  Paste bank statement transactions. Expected columns: Date, Description, Ref#, Debit, Credit, Balance
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportCsv} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1.5">
                  Paste CSV Content (Including Header Row):
                </label>
                <textarea
                  rows={8}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Date,Description,Reference,Debit,Credit,Balance\n2026-09-01,Customer Deposit Ref 8941,DEP-8941,150000,0,1150000\n2026-09-03,Vendor Payment HVAC Supply,CHQ-4401,0,45000,1105000`}
                  className="w-full p-3 font-mono text-[11px] bg-white border border-[#E4E4E7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  required
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] space-y-1">
                <span className="font-bold block">Supported Bank Export Formats</span>
                <span>
                  Paste comma-separated rows directly from your online banking statement (Meezan, HBL, MCB, Standard Chartered). Debit represents money coming in (deposits), Credit represents payments leaving.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {importing ? "Parsing & Importing..." : "Confirm & Import Lines"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
