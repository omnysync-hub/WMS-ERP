"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Users,
  Building,
  Calendar,
  Clock,
} from "lucide-react";

export default function SubLedgerReconciliationTab() {
  const [subTab, setSubTab] = useState<"receivables" | "payables">("receivables");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [driftData, setDriftData] = useState<any>(null);
  const [arAging, setArAging] = useState<any>(null);
  const [apAging, setApAging] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/accounts?view=subledger_reconciliation&asOfDate=${asOfDate}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load sub-ledger data");

      setDriftData(data.drift);
      setArAging(data.customerAging);
      setApAging(data.vendorAging);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [asOfDate]);

  return (
    <div className="space-y-6">
      {/* Top Header & As of Date */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#0D7A5F]" />
            Sub-Ledger Drift Audit & Aging Engine
          </h3>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            Automated mathematical verification of GL Control Accounts (1100 AR, 2000 AP) against individual party transactional balances
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-[#71717A]" />
            <span className="font-medium text-[#71717A]">As of Date:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-8 px-2.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-mono text-[#18181B] focus:outline-none"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="h-8 px-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-Audit Drift
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Two Control Account Reconciliation Proof Cards */}
      {driftData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Accounts Receivable (AR) Control Card */}
          <div
            className={`p-5 rounded-xl border shadow-xs transition ${
              driftData.receivables.isReconciled
                ? "bg-white border-emerald-300"
                : "bg-rose-50/50 border-rose-300"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5 uppercase tracking-wide">
                <Users className="w-4 h-4 text-[#0D7A5F]" />
                AR Control (GL 1100 vs Customer Ledger)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 border ${
                  driftData.receivables.isReconciled
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}
              >
                {driftData.receivables.isReconciled ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% In Sync (0.00 Drift)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Drift: {formatCurrency(driftData.receivables.driftAmount)}
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 text-xs">
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">GL Account 1100</span>
                <span className="text-sm font-mono font-bold text-[#18181B] mt-0.5 block">
                  {formatCurrency(driftData.receivables.glControlBalance)}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">Ledger Spine</span>
              </div>
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Sub-Ledger Total</span>
                <span className="text-sm font-mono font-bold text-[#18181B] mt-0.5 block">
                  {formatCurrency(driftData.receivables.subledgerTotal)}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">{driftData.receivables.customerCount} Customers</span>
              </div>
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Variance / Drift</span>
                <span
                  className={`text-sm font-mono font-bold mt-0.5 block ${
                    driftData.receivables.isReconciled ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatCurrency(driftData.receivables.driftAmount)}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">Audit Parity</span>
              </div>
            </div>
          </div>

          {/* 2. Accounts Payable (AP) Control Card */}
          <div
            className={`p-5 rounded-xl border shadow-xs transition ${
              driftData.payables.isReconciled
                ? "bg-white border-emerald-300"
                : "bg-rose-50/50 border-rose-300"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5 uppercase tracking-wide">
                <Building className="w-4 h-4 text-[#0D7A5F]" />
                AP Control (GL 2000 vs Vendor Ledger)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 border ${
                  driftData.payables.isReconciled
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}
              >
                {driftData.payables.isReconciled ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% In Sync (0.00 Drift)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Drift: {formatCurrency(driftData.payables.driftAmount)}
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 text-xs">
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">GL Account 2000</span>
                <span className="text-sm font-mono font-bold text-[#18181B] mt-0.5 block">
                  {formatCurrency(driftData.payables.glControlBalance)}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">Ledger Spine</span>
              </div>
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Sub-Ledger Total</span>
                <span className="text-sm font-mono font-bold text-[#18181B] mt-0.5 block">
                  {formatCurrency(driftData.payables.subledgerTotal)}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">{driftData.payables.vendorCount} Vendors</span>
              </div>
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Variance / Drift</span>
                <span
                  className={`text-sm font-mono font-bold mt-0.5 block ${
                    driftData.payables.isReconciled ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatCurrency(driftData.payables.driftAmount)}
                </span>
                <span className="text-[10px] text-[#A1A1AA]">Audit Parity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs: AR Aging vs AP Aging */}
      <div className="flex items-center border-b border-[#E4E4E7] gap-3">
        <button
          onClick={() => setSubTab("receivables")}
          className={`pb-2.5 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition ${
            subTab === "receivables"
              ? "border-[#0D7A5F] text-[#0D7A5F]"
              : "border-transparent text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Accounts Receivable (AR) Aging Schedule
        </button>
        <button
          onClick={() => setSubTab("payables")}
          className={`pb-2.5 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition ${
            subTab === "payables"
              ? "border-[#0D7A5F] text-[#0D7A5F]"
              : "border-transparent text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Accounts Payable (AP) Aging Schedule
        </button>
      </div>

      {/* 1. AR AGING SCHEDULE TABLE */}
      {subTab === "receivables" && arAging && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-semibold text-[#71717A]">
                  <th className="py-3 px-4">Customer Name & Contact</th>
                  <th className="py-3 px-4 text-right font-mono">Total Due</th>
                  <th className="py-3 px-4 text-right font-mono text-emerald-800">Current (0-30d)</th>
                  <th className="py-3 px-4 text-right font-mono text-blue-800">31 - 60 Days</th>
                  <th className="py-3 px-4 text-right font-mono text-amber-800">61 - 90 Days</th>
                  <th className="py-3 px-4 text-right font-mono text-rose-800">90+ Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {arAging.customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#71717A] text-xs">
                      No customer accounts receivable balances outstanding.
                    </td>
                  </tr>
                ) : (
                  arAging.customers.map((c: any) => (
                    <tr key={c.customerId} className="hover:bg-[#FAFAFA]">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#18181B]">{c.customerName}</div>
                        <div className="text-[10px] text-[#71717A] font-mono">{c.phone || "—"}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(c.totalOutstanding)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#52525B]">
                        {c.current > 0 ? formatCurrency(c.current) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#52525B]">
                        {c.days31To60 > 0 ? formatCurrency(c.days31To60) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-800 font-medium">
                        {c.days61To90 > 0 ? formatCurrency(c.days61To90) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700 font-bold">
                        {c.days90Plus > 0 ? formatCurrency(c.days90Plus) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#18181B] bg-[#FAFAFA] font-bold text-xs">
                  <td className="py-3 px-4 uppercase tracking-wider text-[#18181B]">Total Receivables Aging</td>
                  <td className="py-3 px-4 text-right font-mono text-[#18181B]">
                    {formatCurrency(arAging.summary.totalOutstanding)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {formatCurrency(arAging.summary.current)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700">
                    {formatCurrency(arAging.summary.days31To60)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-700">
                    {formatCurrency(arAging.summary.days61To90)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700">
                    {formatCurrency(arAging.summary.days90Plus)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. AP AGING SCHEDULE TABLE */}
      {subTab === "payables" && apAging && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-semibold text-[#71717A]">
                  <th className="py-3 px-4">Vendor / Supplier Name</th>
                  <th className="py-3 px-4 text-right font-mono">Total Payable</th>
                  <th className="py-3 px-4 text-right font-mono text-emerald-800">Current (0-30d)</th>
                  <th className="py-3 px-4 text-right font-mono text-blue-800">31 - 60 Days</th>
                  <th className="py-3 px-4 text-right font-mono text-amber-800">61 - 90 Days</th>
                  <th className="py-3 px-4 text-right font-mono text-rose-800">90+ Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {apAging.vendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#71717A] text-xs">
                      No vendor accounts payable balances outstanding.
                    </td>
                  </tr>
                ) : (
                  apAging.vendors.map((v: any) => (
                    <tr key={v.vendorId} className="hover:bg-[#FAFAFA]">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#18181B]">{v.vendorName}</div>
                        <div className="text-[10px] text-[#71717A]">{v.contactPerson || v.phone || "—"}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(v.totalOutstanding)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#52525B]">
                        {v.current > 0 ? formatCurrency(v.current) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#52525B]">
                        {v.days31To60 > 0 ? formatCurrency(v.days31To60) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-800 font-medium">
                        {v.days61To90 > 0 ? formatCurrency(v.days61To90) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700 font-bold">
                        {v.days90Plus > 0 ? formatCurrency(v.days90Plus) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#18181B] bg-[#FAFAFA] font-bold text-xs">
                  <td className="py-3 px-4 uppercase tracking-wider text-[#18181B]">Total Payables Aging</td>
                  <td className="py-3 px-4 text-right font-mono text-[#18181B]">
                    {formatCurrency(apAging.summary.totalOutstanding)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {formatCurrency(apAging.summary.current)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700">
                    {formatCurrency(apAging.summary.days31To60)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-700">
                    {formatCurrency(apAging.summary.days61To90)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700">
                    {formatCurrency(apAging.summary.days90Plus)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
