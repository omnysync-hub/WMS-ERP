"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  FileText,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

export default function FinancialStatementsTab() {
  const [activeStatement, setActiveStatement] = useState<
    "trial_balance" | "balance_sheet" | "income_statement" | "cash_flow"
  >("trial_balance");

  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState(false);
  const [trialBalanceData, setTrialBalanceData] = useState<any>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);
  const [incomeStatementData, setIncomeStatementData] = useState<any>(null);
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchStatement = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      let url = `/api/accounts?view=financial_statements&statement=${activeStatement}`;
      if (activeStatement === "trial_balance" || activeStatement === "balance_sheet") {
        url += `&asOfDate=${asOfDate}`;
      } else {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load financial statement");
      }

      if (activeStatement === "trial_balance") setTrialBalanceData(data.trialBalance);
      if (activeStatement === "balance_sheet") setBalanceSheetData(data.balanceSheet);
      if (activeStatement === "income_statement") setIncomeStatementData(data.incomeStatement);
      if (activeStatement === "cash_flow") setCashFlowData(data.cashFlow);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [activeStatement]);

  return (
    <div className="space-y-6">
      {/* Statement Selector & Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[#F4F4F5] p-1 rounded-lg">
          {[
            { id: "trial_balance", label: "Trial Balance", icon: Scale },
            { id: "balance_sheet", label: "Balance Sheet", icon: Layers },
            { id: "income_statement", label: "Profit & Loss (P&L)", icon: TrendingUp },
            { id: "cash_flow", label: "Cash Flow Statement", icon: FileText },
          ].map((st) => {
            const Icon = st.icon;
            const isActive = activeStatement === st.id;
            return (
              <button
                key={st.id}
                onClick={() => setActiveStatement(st.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  isActive
                    ? "bg-white text-[#0D7A5F] shadow-xs border border-[#E4E4E7]"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {st.label}
              </button>
            );
          })}
        </div>

        {/* Date Filters & Actions */}
        <div className="flex items-center gap-3">
          {activeStatement === "trial_balance" || activeStatement === "balance_sheet" ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#71717A] font-medium">As of Date:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-8 px-2.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#71717A] font-medium">Period:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#18181B] focus:outline-none"
              />
              <span className="text-[#A1A1AA]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#18181B] focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={fetchStatement}
            disabled={loading}
            className="h-8 px-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Apply Filter
          </button>

          <button
            onClick={() => window.print()}
            className="h-8 px-3 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5 text-[#71717A]" />
            Print / PDF
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* 1. TRIAL BALANCE STATEMENT */}
      {activeStatement === "trial_balance" && trialBalanceData && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[#71717A] block">
                Financial Accounts • General Ledger
              </span>
              <h2 className="text-lg font-bold text-[#18181B]">Extended 4-Level Trial Balance</h2>
              <p className="text-xs text-[#71717A] mt-0.5 font-mono">
                As of {new Date(trialBalanceData.asOfDate).toLocaleDateString()} • Base Currency: PKR
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  trialBalanceData.isBalanced
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-rose-50 text-rose-800 border-rose-300"
                }`}
              >
                {trialBalanceData.isBalanced ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Double-Entry In Balance
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Out of Balance: {formatCurrency(trialBalanceData.variance)}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-semibold text-[#71717A]">
                  <th className="py-3 px-4 w-28 font-mono">Code</th>
                  <th className="py-3 px-4">Account Title & Hierarchy</th>
                  <th className="py-3 px-3 w-32 text-center">Hierarchy Level</th>
                  <th className="py-3 px-3 w-28 capitalize">Class</th>
                  <th className="py-3 px-4 w-36 text-right font-mono">Debit (PKR)</th>
                  <th className="py-3 px-4 w-36 text-right font-mono">Credit (PKR)</th>
                  <th className="py-3 px-4 w-36 text-right font-mono">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {trialBalanceData.accounts.map((row: any) => {
                  const isGrp = row.level < 4;
                  return (
                    <tr
                      key={row.code}
                      className={
                        isGrp
                          ? "bg-[#FAFAFA] font-bold text-[#18181B]"
                          : "hover:bg-[#F9FAFB] text-[#3F3F46]"
                      }
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-[#18181B]">{row.code}</td>
                      <td className="py-2.5 px-4">
                        <span
                          style={{ paddingLeft: `${(row.level - 1) * 16}px` }}
                          className="inline-flex items-center gap-1.5"
                        >
                          {row.level > 1 && <span className="text-[#A1A1AA] font-mono text-[10px]">└──</span>}
                          {row.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            row.level === 1
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : row.level === 2
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : row.level === 3
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold"
                          }`}
                        >
                          Level {row.level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 capitalize text-[#71717A] text-[11px]">{row.type}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#18181B]">
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#18181B] bg-[#FAFAFA] font-bold text-xs">
                  <td colSpan={4} className="py-3 px-4 uppercase tracking-wider text-[#18181B]">
                    Grand Total Footing
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#18181B]">
                    {formatCurrency(trialBalanceData.totalDebit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#18181B]">
                    {formatCurrency(trialBalanceData.totalCredit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {trialBalanceData.isBalanced ? "BALANCED (0.00)" : `DIFF: ${formatCurrency(trialBalanceData.variance)}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. BALANCE SHEET STATEMENT */}
      {activeStatement === "balance_sheet" && balanceSheetData && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[#71717A] block">
                Financial Accounts • Financial Position
              </span>
              <h2 className="text-lg font-bold text-[#18181B]">Statement of Financial Position (Balance Sheet)</h2>
              <p className="text-xs text-[#71717A] mt-0.5 font-mono">
                As of {new Date(balanceSheetData.asOfDate).toLocaleDateString()} • Strict GAAP Principle: Assets = Liabilities + Equity
              </p>
            </div>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  balanceSheetData.isBalanced
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-rose-50 text-rose-800 border-rose-300"
                }`}
              >
                {balanceSheetData.isBalanced ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Equation Balanced (A = L + E)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Equation Discrepancy: {formatCurrency(balanceSheetData.discrepancy)}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-[#E4E4E7]">
            {/* ASSETS COLUMN */}
            <div className="space-y-6">
              <div className="border-b border-[#E4E4E7] pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#18181B] uppercase tracking-wide">Assets</h3>
                <span className="text-xs font-mono font-bold text-[#0D7A5F]">
                  Total: {formatCurrency(balanceSheetData.assets.totalAssets)}
                </span>
              </div>

              {/* Current Assets */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#3F3F46] bg-[#F4F4F5] p-2 rounded">
                  <span>Current Assets</span>
                  <span className="font-mono">{formatCurrency(balanceSheetData.assets.currentAssets.total)}</span>
                </div>
                <div className="divide-y divide-[#E4E4E7] text-xs">
                  {balanceSheetData.assets.currentAssets.accounts.map((acc: any) => (
                    <div key={acc.code} className="py-1.5 px-2 flex justify-between hover:bg-[#FAFAFA]">
                      <span className="text-[#52525B]">
                        <span className="font-mono font-bold mr-2 text-[#18181B]">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Non-Current / Fixed Assets */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#3F3F46] bg-[#F4F4F5] p-2 rounded">
                  <span>Non-Current & Fixed Assets</span>
                  <span className="font-mono">{formatCurrency(balanceSheetData.assets.fixedAssets.total)}</span>
                </div>
                <div className="divide-y divide-[#E4E4E7] text-xs">
                  {balanceSheetData.assets.fixedAssets.accounts.map((acc: any) => (
                    <div key={acc.code} className="py-1.5 px-2 flex justify-between hover:bg-[#FAFAFA]">
                      <span className="text-[#52525B]">
                        <span className="font-mono font-bold mr-2 text-[#18181B]">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center font-bold text-xs">
                <span className="text-emerald-950 uppercase tracking-wide">TOTAL ASSETS</span>
                <span className="text-base font-mono text-[#0D7A5F]">
                  {formatCurrency(balanceSheetData.assets.totalAssets)}
                </span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY COLUMN */}
            <div className="space-y-6 md:pl-8 pt-6 md:pt-0">
              <div className="border-b border-[#E4E4E7] pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#18181B] uppercase tracking-wide">Liabilities & Equity</h3>
                <span className="text-xs font-mono font-bold text-[#18181B]">
                  Total: {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </span>
              </div>

              {/* Current Liabilities */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#3F3F46] bg-[#F4F4F5] p-2 rounded">
                  <span>Current Liabilities</span>
                  <span className="font-mono">{formatCurrency(balanceSheetData.liabilities.currentLiabilities.total)}</span>
                </div>
                <div className="divide-y divide-[#E4E4E7] text-xs">
                  {balanceSheetData.liabilities.currentLiabilities.accounts.map((acc: any) => (
                    <div key={acc.code} className="py-1.5 px-2 flex justify-between hover:bg-[#FAFAFA]">
                      <span className="text-[#52525B]">
                        <span className="font-mono font-bold mr-2 text-[#18181B]">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equity Section */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#3F3F46] bg-[#F4F4F5] p-2 rounded">
                  <span>Owners' Equity & Retained Earnings</span>
                  <span className="font-mono">{formatCurrency(balanceSheetData.equity.total)}</span>
                </div>
                <div className="divide-y divide-[#E4E4E7] text-xs">
                  {balanceSheetData.equity.accounts.map((acc: any) => (
                    <div key={acc.code} className="py-1.5 px-2 flex justify-between hover:bg-[#FAFAFA]">
                      <span className="text-[#52525B]">
                        <span className="font-mono font-bold mr-2 text-[#18181B]">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  {/* Current Net Income */}
                  <div className="py-1.5 px-2 flex justify-between bg-emerald-50/50 font-semibold">
                    <span className="text-emerald-900">Current Period Net Profit / (Loss)</span>
                    <span className="font-mono text-emerald-800">
                      {formatCurrency(balanceSheetData.equity.currentPeriodNetIncome)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-zinc-100 border border-zinc-300 rounded-xl flex justify-between items-center font-bold text-xs">
                <span className="text-zinc-900 uppercase tracking-wide">TOTAL LIABILITIES & EQUITY</span>
                <span className="text-base font-mono text-[#18181B]">
                  {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. INCOME STATEMENT (P&L) */}
      {activeStatement === "income_statement" && incomeStatementData && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[#71717A] block">
                Financial Accounts • Operating Performance
              </span>
              <h2 className="text-lg font-bold text-[#18181B]">Statement of Comprehensive Income (P&L)</h2>
              <p className="text-xs text-[#71717A] mt-0.5 font-mono">
                From {new Date(incomeStatementData.startDate).toLocaleDateString()} to {new Date(incomeStatementData.endDate).toLocaleDateString()} • Single Currency PKR
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#71717A] block">Net Operating Margin</span>
              <span className="text-xl font-bold font-mono text-[#0D7A5F]">
                {incomeStatementData.netProfitMargin}%
              </span>
            </div>
          </div>

          <div className="p-6 max-w-4xl mx-auto space-y-6 text-xs">
            {/* 1. Operating Revenue */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#F4F4F5] p-2.5 rounded-lg font-bold text-xs text-[#18181B]">
                <span>1. Operating Revenue</span>
                <span className="font-mono">{formatCurrency(incomeStatementData.revenue.total)}</span>
              </div>
              <div className="divide-y divide-[#E4E4E7] pl-4">
                {incomeStatementData.revenue.accounts.map((acc: any) => (
                  <div key={acc.code} className="py-2 flex justify-between hover:bg-[#FAFAFA]">
                    <span className="text-[#52525B]">
                      <span className="font-mono font-semibold mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#F4F4F5] p-2.5 rounded-lg font-bold text-xs text-[#18181B]">
                <span>2. Cost of Goods & Services Sold (COGS)</span>
                <span className="font-mono text-rose-700">({formatCurrency(incomeStatementData.cogs.total)})</span>
              </div>
              <div className="divide-y divide-[#E4E4E7] pl-4">
                {incomeStatementData.cogs.accounts.map((acc: any) => (
                  <div key={acc.code} className="py-2 flex justify-between hover:bg-[#FAFAFA]">
                    <span className="text-[#52525B]">
                      <span className="font-mono font-semibold mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GROSS PROFIT */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex justify-between items-center font-bold text-xs">
              <div>
                <span className="text-emerald-950 uppercase tracking-wide block">GROSS OPERATING PROFIT</span>
                <span className="text-[11px] text-emerald-800 font-normal">
                  Gross Margin: {incomeStatementData.grossMargin}%
                </span>
              </div>
              <span className="text-base font-mono text-[#0D7A5F]">
                {formatCurrency(incomeStatementData.grossProfit)}
              </span>
            </div>

            {/* 3. Operating Expenses */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#F4F4F5] p-2.5 rounded-lg font-bold text-xs text-[#18181B]">
                <span>3. Operating Expenses (OPEX)</span>
                <span className="font-mono text-rose-700">({formatCurrency(incomeStatementData.operatingExpenses.total)})</span>
              </div>
              <div className="divide-y divide-[#E4E4E7] pl-4">
                {incomeStatementData.operatingExpenses.accounts.map((acc: any) => (
                  <div key={acc.code} className="py-2 flex justify-between hover:bg-[#FAFAFA]">
                    <span className="text-[#52525B]">
                      <span className="font-mono font-semibold mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className="font-mono font-medium text-[#18181B]">{formatCurrency(acc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* NET OPERATING PROFIT */}
            <div
              className={`p-4 rounded-xl border flex justify-between items-center font-bold text-sm ${
                incomeStatementData.isProfitable
                  ? "bg-emerald-100/70 border-emerald-300 text-emerald-950"
                  : "bg-rose-100/70 border-rose-300 text-rose-950"
              }`}
            >
              <div>
                <span className="uppercase tracking-wide block">
                  {incomeStatementData.isProfitable ? "NET OPERATING PROFIT" : "NET OPERATING LOSS"}
                </span>
                <span className="text-xs font-normal">
                  {incomeStatementData.isProfitable
                    ? "Profitable accounting period"
                    : "Expenditures exceeded recognized revenues"}
                </span>
              </div>
              <span className="text-xl font-mono">
                {formatCurrency(incomeStatementData.netIncome)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. CASH FLOW STATEMENT */}
      {activeStatement === "cash_flow" && cashFlowData && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[#71717A] block">
                Financial Accounts • Liquidity
              </span>
              <h2 className="text-lg font-bold text-[#18181B]">Statement of Cash Flows (Indirect Method)</h2>
              <p className="text-xs text-[#71717A] mt-0.5 font-mono">
                From {new Date(cashFlowData.startDate).toLocaleDateString()} to {new Date(cashFlowData.endDate).toLocaleDateString()} • Inflows & Outflows in PKR
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#71717A] block">Net Change in Cash</span>
              <span
                className={`text-lg font-mono font-bold ${
                  cashFlowData.netCashChange >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatCurrency(cashFlowData.netCashChange)}
              </span>
            </div>
          </div>

          <div className="p-6 max-w-4xl mx-auto space-y-6 text-xs">
            {/* Operating Activities */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#F4F4F5] p-2.5 rounded-lg font-bold text-xs text-[#18181B]">
                <span>Cash Flows from Operating Activities</span>
                <span className="font-mono">{formatCurrency(cashFlowData.operatingActivities.total)}</span>
              </div>
              <div className="divide-y divide-[#E4E4E7] pl-4">
                <div className="py-2 flex justify-between">
                  <span className="text-[#52525B]">Net Income (from P&L)</span>
                  <span className="font-mono font-medium">{formatCurrency(cashFlowData.operatingActivities.netIncome)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#52525B]">Adjustment: Depreciation & Amortization Non-Cash Charge</span>
                  <span className="font-mono font-medium">{formatCurrency(cashFlowData.operatingActivities.depreciation)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#52525B]">Change in Working Capital (AR, AP, Inventories)</span>
                  <span className="font-mono font-medium">{formatCurrency(cashFlowData.operatingActivities.workingCapitalChanges)}</span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#F4F4F5] p-2.5 rounded-lg font-bold text-xs text-[#18181B]">
                <span>Cash Flows from Investing Activities</span>
                <span className="font-mono">{formatCurrency(cashFlowData.investingActivities.total)}</span>
              </div>
              <div className="divide-y divide-[#E4E4E7] pl-4">
                <div className="py-2 flex justify-between">
                  <span className="text-[#52525B]">Capital Expenditures (Additions to Plant, Equipment, Vehicles)</span>
                  <span className="font-mono font-medium">{formatCurrency(cashFlowData.investingActivities.capitalExpenditures)}</span>
                </div>
              </div>
            </div>

            {/* Financing Activities */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#F4F4F5] p-2.5 rounded-lg font-bold text-xs text-[#18181B]">
                <span>Cash Flows from Financing Activities</span>
                <span className="font-mono">{formatCurrency(cashFlowData.financingActivities.total)}</span>
              </div>
              <div className="divide-y divide-[#E4E4E7] pl-4">
                <div className="py-2 flex justify-between">
                  <span className="text-[#52525B]">Equity Contributions / Drawings</span>
                  <span className="font-mono font-medium">{formatCurrency(cashFlowData.financingActivities.equityChanges)}</span>
                </div>
              </div>
            </div>

            {/* Reconciliation of Cash Balances */}
            <div className="p-4 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl space-y-2">
              <div className="flex justify-between text-xs text-[#52525B]">
                <span>Cash & Cash Equivalents at Beginning of Period</span>
                <span className="font-mono font-bold text-[#18181B]">{formatCurrency(cashFlowData.beginningCash)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#52525B]">
                <span>Net Increase / (Decrease) in Cash</span>
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(cashFlowData.netCashChange)}</span>
              </div>
              <div className="border-t border-[#E4E4E7] pt-2 flex justify-between text-xs font-bold text-[#18181B]">
                <span>Cash & Cash Equivalents at End of Period</span>
                <span className="font-mono text-base text-[#0D7A5F]">{formatCurrency(cashFlowData.endingCash)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
