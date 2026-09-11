"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Building,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  Unlink,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
} from "lucide-react";

export default function BankReconciliationTab() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<any>(null);
  const [unreconciledLines, setUnreconciledLines] = useState<any[]>([]);

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

  // 3. Trigger Auto-Match
  const handleAutoMatch = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bank_rec_automatch",
          bankAccountId: selectedAccountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auto-match failed");

      setSuccessMsg(
        `Auto-match completed! Matched ${data.matchedCount} lines with Cashbook General Ledger entries.`
      );
      loadReconciliation();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
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

  // 5. Unmatch Line
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
      setSuccessMsg("Line unmatched and returned to un-reconciled pool.");
      loadReconciliation();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg("")} className="text-rose-700 hover:text-rose-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Account Selector & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <Building className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-semibold text-[#18181B]">Bank Account:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="h-8 px-3 bg-white border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-none"
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
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleAutoMatch}
            disabled={loading}
            className="h-8 px-3 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Run Auto-Match (±3 Days)
          </button>

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

      {/* 5-Box Reconciliation Metric Grid */}
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

      {/* Main Reconciliation Workspace: Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Bank Statement Lines */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Imported Bank Statement Lines
              </h3>
              <p className="text-[11px] text-[#71717A]">
                {unreconciledLines.length} un-reconciled rows pending matching
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description / Ref</th>
                  <th className="py-2.5 px-3 text-right">Debit (Deposit)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Outflow)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {unreconciledLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#71717A] text-xs">
                      No unreconciled bank statement lines. Import a CSV statement to begin.
                    </td>
                  </tr>
                ) : (
                  unreconciledLines.map((line: any) => (
                    <tr key={line.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-2 px-3 font-mono text-[11px] text-[#71717A]">
                        {new Date(line.statementDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-[#18181B]">{line.description}</div>
                        {line.referenceNumber && (
                          <div className="text-[10px] text-[#71717A] font-mono">Ref: {line.referenceNumber}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">
                        {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-rose-700">
                        {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Unmatched
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: Outstanding Book Items (Deposits in Transit & Unpresented Cheques) */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA]">
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              General Ledger Timing Differences
            </h3>
            <p className="text-[11px] text-[#71717A]">
              Transactions posted to General Ledger Cashbook but not yet appearing on bank statement
            </p>
          </div>

          <div className="divide-y divide-[#E4E4E7] max-h-[460px] overflow-y-auto">
            {/* Deposits in transit */}
            <div className="p-3 bg-emerald-50/40">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
                Deposits in Transit ({reconciliationData?.unmatchedDeposits?.length || 0})
              </span>
            </div>
            {reconciliationData?.unmatchedDeposits?.map((dep: any) => (
              <div key={dep.id} className="p-3 hover:bg-[#FAFAFA] flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono text-[11px] text-[#71717A] block">
                    {new Date(dep.date).toLocaleDateString()}
                  </span>
                  <span className="text-[#18181B] font-medium">{dep.memo}</span>
                </div>
                <span className="font-mono font-bold text-emerald-700">+{formatCurrency(dep.amount)}</span>
              </div>
            ))}

            {/* Unpresented cheques */}
            <div className="p-3 bg-rose-50/40 border-t border-[#E4E4E7]">
              <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />
                Unpresented Cheques & Outflows ({reconciliationData?.unmatchedPayments?.length || 0})
              </span>
            </div>
            {reconciliationData?.unmatchedPayments?.map((pay: any) => (
              <div key={pay.id} className="p-3 hover:bg-[#FAFAFA] flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono text-[11px] text-[#71717A] block">
                    {new Date(pay.date).toLocaleDateString()}
                  </span>
                  <span className="text-[#18181B] font-medium">{pay.memo}</span>
                </div>
                <span className="font-mono font-bold text-rose-700">-{formatCurrency(pay.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                <span className="font-bold block">Pro Tip: Supported Bank Export Formats</span>
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
