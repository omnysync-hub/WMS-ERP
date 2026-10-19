"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { FileBarChart, RefreshCw, Settings2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function TaxReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/tax-summary?from=${from}&to=${to}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load tax report");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader moduleName="Accounts" currentView="Tax Report" />
      <div className="bg-white border border-[#E4E4E7] rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <FileBarChart className="w-5 h-5 text-[#0D7A5F]" />
          <div>
            <h1 className="text-sm font-bold">Tax summary</h1>
            <p className="text-xs text-[#71717A]">Output tax vs input tax, and withholding tax, for a period (from the general ledger).</p>
          </div>
        </div>
        <label className="text-xs">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block h-8 px-2 border rounded-lg" /></label>
        <label className="text-xs">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block h-8 px-2 border rounded-lg" /></label>
        <button type="button" onClick={load} disabled={loading} className="h-8 px-3 rounded-lg bg-[#0D7A5F] text-white text-xs font-bold inline-flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Run
        </button>
        <Link href="/settings/taxes" className="h-8 px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" />Tax settings</Link>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">{error}</div>}

      {data && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-white border rounded-xl p-4">
              <span className="text-[11px] uppercase text-[#71717A] font-bold">Net sales tax payable</span>
              <div className="text-xl font-black font-mono">{formatCurrency(data.netSalesTaxPayable)}</div>
              <span className="text-[11px] text-[#71717A]">Output tax − input tax for the period</span>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <span className="text-[11px] uppercase text-[#71717A] font-bold">WHT deducted from suppliers</span>
              <div className="text-xl font-black font-mono">{formatCurrency(data.whtPayable)}</div>
              <span className="text-[11px] text-[#71717A]">To deposit with FBR</span>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <span className="text-[11px] uppercase text-[#71717A] font-bold">WHT deducted by customers</span>
              <div className="text-xl font-black font-mono">{formatCurrency(data.whtReceivable)}</div>
              <span className="text-[11px] text-[#71717A]">Claimable against our tax</span>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-bold mb-2">By tax account</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase text-[#71717A] border-b">
                  <th className="py-2">Tax</th><th>Account</th><th className="text-right">Opening</th><th className="text-right">Debits</th><th className="text-right">Credits</th><th className="text-right">Net for period</th><th className="text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {data.gl.map((g: any) => (
                  <tr key={g.role} className="border-b last:border-0">
                    <td className="py-2">{g.label}</td>
                    <td>{g.account ? `${g.account.code} ${g.account.name}` : <span className="text-amber-700">Not mapped</span>}</td>
                    <td className="text-right font-mono">{formatCurrency(g.openingBalance)}</td>
                    <td className="text-right font-mono">{formatCurrency(g.debit)}</td>
                    <td className="text-right font-mono">{formatCurrency(g.credit)}</td>
                    <td className="text-right font-mono font-bold">{formatCurrency(g.net)}</td>
                    <td className="text-right font-mono">{formatCurrency(g.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <h2 className="text-sm font-bold mb-2">Documents in the period (cross-check)</h2>
            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div>Job & project invoices: <b>{data.documents.invoices.count}</b><br />Tax on them: <b>{formatCurrency(data.documents.invoices.tax)}</b></div>
              <div>POS sales: <b>{data.documents.pos.count}</b><br />Tax on them: <b>{formatCurrency(data.documents.pos.tax)}</b></div>
              <div>Approved supplier bills: <b>{data.documents.supplierBills.count}</b><br />Tax on them: <b>{formatCurrency(data.documents.supplierBills.tax)}</b></div>
              <div>WHT on supplier ledger: <b>{formatCurrency(data.documents.supplierWhtFromLedger)}</b></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
