"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRole } from "@/contexts/RoleContext";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "@/lib/toast";

/**
 * FOC jobs (referred by external companies): awaiting vs received company payment, by company.
 * "Record payment" posts Dr Cash/Bank, Cr Revenue (receipt-time recognition) via the jobs API.
 */
export default function FocPaymentsTab() {
  const { hasPermission } = useRole();
  const canRecord = hasPermission("accounts.general_ledger") || hasPermission("jobs.approve_foc");
  const [status, setStatus] = useState<"pending" | "received" | "all">("pending");
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState<any | null>(null);
  const [form, setForm] = useState({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "bank_transfer",
    account: "",
    reference: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ view: "foc_payments", status });
      if (companyId) qs.set("companyId", companyId);
      const res = await fetch(`/api/accounts?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load FOC jobs");
      setData(json);
    } catch (e: any) {
      toast.error(e.message || "Failed to load FOC jobs");
    } finally {
      setLoading(false);
    }
  }, [status, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.warning("Enter the amount received.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${paying.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_foc_payment",
          amount,
          receivedDate: form.date,
          paymentMethod: form.method,
          receivingAccountCode: form.account || undefined,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      toast.success(`FOC payment recorded for ${paying.jobNumber}`);
      setPaying(null);
      setForm({ ...form, amount: "", reference: "", notes: "" });
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  const summary = data?.summary;
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-[#18181B] mr-auto">FOC Company Payments</h2>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="h-8 px-2 rounded-lg border border-[#D4D4D8] bg-white"
        >
          <option value="pending">Awaiting company payment</option>
          <option value="received">Received</option>
          <option value="all">All FOC jobs</option>
        </select>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="h-8 px-2 rounded-lg border border-[#D4D4D8] bg-white"
        >
          <option value="">All companies</option>
          {(data?.byCompany || [])
            .filter((c: any) => c.companyId)
            .map((c: any) => (
              <option key={c.companyId} value={c.companyId}>
                {c.companyName}
              </option>
            ))}
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-xl border border-[#E4E4E7]">
            <div className="text-[10px] uppercase text-zinc-500 font-bold">FOC jobs</div>
            <div className="text-lg font-black">{summary.total}</div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-amber-200">
            <div className="text-[10px] uppercase text-amber-700 font-bold">Awaiting payment</div>
            <div className="text-lg font-black text-amber-800">{summary.pending}</div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <div className="text-[10px] uppercase text-emerald-700 font-bold">Received</div>
            <div className="text-lg font-black text-emerald-800">{summary.received}</div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <div className="text-[10px] uppercase text-emerald-700 font-bold">Revenue received</div>
            <div className="text-lg font-black font-mono">{formatCurrency(summary.receivedAmount)}</div>
          </div>
        </div>
      )}

      {(data?.byCompany || []).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th className="p-2">Company</th>
                <th className="p-2 text-right">Awaiting</th>
                <th className="p-2 text-right">Received</th>
                <th className="p-2 text-right">Amount received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.byCompany.map((c: any) => (
                <tr key={c.companyId || c.companyName}>
                  <td className="p-2 font-semibold">{c.companyName}</td>
                  <td className="p-2 text-right text-amber-800 font-bold">{c.pending}</td>
                  <td className="p-2 text-right">{c.received}</td>
                  <td className="p-2 text-right font-mono">{formatCurrency(c.receivedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
            <tr>
              <th className="p-2">Job</th>
              <th className="p-2">Company</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">List value (ref.)</th>
              <th className="p-2 text-right">Received</th>
              <th className="p-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">Loading…</td>
              </tr>
            ) : (data?.jobs || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">No FOC jobs for this filter.</td>
              </tr>
            ) : (
              data.jobs.map((j: any) => (
                <tr key={j.jobId}>
                  <td className="p-2 font-mono font-bold text-[#0D7A5F]">
                    <Link href={`/jobs/${j.jobId}`}>{j.jobNumber}</Link>
                  </td>
                  <td className="p-2">{j.companyName}</td>
                  <td className="p-2">{j.customerName}</td>
                  <td className="p-2">
                    {j.status}
                    {j.paymentStatus === "received" ? (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">received</span>
                    ) : (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">awaiting</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono text-zinc-500">{formatCurrency(j.listValue)}</td>
                  <td className="p-2 text-right font-mono">
                    {formatCurrency(j.amountReceived)}
                    {j.lastReceivedAt && <div className="text-[10px] text-zinc-500">{formatDateTime(j.lastReceivedAt)}</div>}
                  </td>
                  <td className="p-2 text-right">
                    {canRecord && (
                      <button
                        type="button"
                        onClick={() => setPaying(j)}
                        className="h-7 px-2 rounded bg-purple-700 text-white font-bold"
                      >
                        Record payment
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paying && (
        <form onSubmit={submit} className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
          <div className="font-bold text-purple-950">
            Record payment from {paying.companyName} for {paying.jobNumber}
          </div>
          <p className="text-purple-900">Posts Dr Cash/Bank, Cr Revenue. Enter the amount the company actually paid.</p>
          <div className="grid md:grid-cols-6 gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount (PKR)"
              className="h-8 px-2 rounded border border-zinc-300 bg-white"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-8 px-2 rounded border border-zinc-300 bg-white"
            />
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="h-8 px-2 rounded border border-zinc-300 bg-white"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
            <input
              value={form.account}
              onChange={(e) => setForm({ ...form, account: e.target.value })}
              placeholder="Cash/Bank a/c code"
              className="h-8 px-2 rounded border border-zinc-300 bg-white"
            />
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Ref / cheque #"
              className="h-8 px-2 rounded border border-zinc-300 bg-white"
            />
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes"
              className="h-8 px-2 rounded border border-zinc-300 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="h-8 px-3 rounded-lg bg-purple-700 text-white font-bold">
              Save payment
            </button>
            <button type="button" onClick={() => setPaying(null)} className="h-8 px-3 rounded-lg border border-zinc-300 bg-white">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
