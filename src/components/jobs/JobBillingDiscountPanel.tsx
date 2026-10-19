"use client";

import React, { useState } from "react";
import { BadgePercent, Gift, Landmark, Check, X } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import toast from "@/lib/toast";

/**
 * Job billing controls on the ERP job detail page:
 *  - FOC (job referred by an external company) + payment collection mode (technician / office)
 *  - Record FOC payment received from the referring company (Dr Cash/Bank, Cr Revenue)
 *  - Office receipt for office-collected jobs (Dr Cash/Bank, Cr AR) with outstanding balance
 *  - Technician discount requests: approve / reject (jobs.approve_discount)
 */
export default function JobBillingDiscountPanel({ job, onChanged }: { job: any; onChanged: () => void }) {
  const { hasPermission } = useRole();
  const canEdit = hasPermission("jobs.edit_job");
  const canApproveFoc = hasPermission("jobs.approve_foc");
  const canApproveDiscount = hasPermission("jobs.approve_discount");
  const canReceive = hasPermission("accounts.general_ledger");
  const canRecordFoc = canReceive || canApproveFoc;
  const locked = Boolean(job.finalizedAt) || ["Finalized", "Verified", "Cancelled", "TechnicianReassigned"].includes(job.status);
  const summary = job.billingSummary || {};
  const requests: any[] = job.discountRequests || [];

  const [editing, setEditing] = useState(false);
  const [isFoc, setIsFoc] = useState<boolean>(Boolean(job.isFoc));
  const [focReason, setFocReason] = useState<string>(job.focReason || "");
  const [mode, setMode] = useState<string>(job.paymentCollectionMode || "technician");
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState({ amount: "", method: "bank_transfer", account: "", notes: "", wht: "" });
  const [focPay, setFocPay] = useState({
    amount: "",
    method: "bank_transfer",
    account: "",
    date: new Date().toISOString().slice(0, 10),
    reference: "",
    notes: "",
  });

  const patch = async (body: any, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      toast.success(okMsg);
      onChanged();
      return true;
    } catch (e: any) {
      toast.error(e.message || "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveBilling = async () => {
    const ok = await patch(
      { action: "set_billing", isFoc, focReason, paymentCollectionMode: mode },
      "Billing options updated"
    );
    if (ok) setEditing(false);
  };

  const recordFocPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(focPay.amount);
    if (!amount || amount <= 0) {
      toast.warning("Enter the amount received from the company.");
      return;
    }
    const ok = await patch(
      {
        action: "record_foc_payment",
        amount,
        paymentMethod: focPay.method,
        receivingAccountCode: focPay.account || undefined,
        receivedDate: focPay.date,
        reference: focPay.reference || undefined,
        notes: focPay.notes || undefined,
      },
      "FOC payment recorded (Dr Cash/Bank, Cr Revenue)"
    );
    if (ok) setFocPay({ ...focPay, amount: "", reference: "", notes: "" });
  };

  const decide = async (r: any, approve: boolean) => {
    let note = "";
    if (!approve) {
      note = window.prompt("Reason for rejecting this discount request (optional):") || "";
    }
    const override = overrides[r.id];
    await patch(
      {
        action: approve ? "approve_discount_request" : "reject_discount_request",
        requestId: r.id,
        note,
        approvedAmount: approve && override ? Number(override) : undefined,
      },
      approve ? "Discount approved — invoice total updated" : "Discount request rejected"
    );
  };

  const recordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(receipt.amount);
    if (!amount || amount <= 0) {
      toast.warning("Enter a receipt amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_job_payment",
          jobId: job.id,
          amount,
          paymentMethod: receipt.method,
          receivingAccountCode: receipt.account || undefined,
          notes: receipt.notes || undefined,
          whtAmount: Number(receipt.wht) > 0 ? Number(receipt.wht) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Receipt failed");
      toast.success("Office receipt recorded (Dr Cash/Bank, Cr AR)");
      setReceipt({ amount: "", method: "bank_transfer", account: "", notes: "", wht: "" });
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Receipt failed");
    } finally {
      setBusy(false);
    }
  };

  const receivable = summary.receivable;
  const focLabel = job.isFoc
    ? `FOC — referred by ${job.careOfParty?.companyName || "company (not linked!)"}`
    : "Chargeable";
  const modeLabel = job.isFoc
    ? "No collection (FOC)"
    : job.paymentCollectionMode === "office"
      ? "Office / accounts collects"
      : "Technician collects on site";

  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
      <div className="px-5 py-2.5 bg-zinc-50 border-b border-[#E4E4E7] flex items-center gap-2">
        <Landmark className="w-4 h-4 text-[#0D7A5F]" />
        <h3 className="text-sm font-bold text-[#18181B]">Billing, Collection & Discount Requests</h3>
      </div>

      <div className="p-5 space-y-5 text-xs">
        {/* Billing summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
            <span className="text-[10px] text-zinc-600 uppercase font-bold block">Billing</span>
            <span className={`font-bold mt-0.5 block ${job.isFoc ? "text-purple-800" : "text-zinc-900"}`}>{focLabel}</span>
          </div>
          <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
            <span className="text-[10px] text-zinc-600 uppercase font-bold block">Collection</span>
            <span className="font-bold mt-0.5 block text-zinc-900">{modeLabel}</span>
          </div>
          <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
            <span className="text-[10px] text-zinc-600 uppercase font-bold block">Customer pays</span>
            <span className="font-mono font-bold mt-0.5 block text-zinc-900">{formatCurrency(summary.customerPays ?? 0)}</span>
            {summary.tax?.enabled && (
              <span className="text-[10px] text-zinc-600 block">
                incl. {summary.tax.name || "tax"} @ {summary.tax.ratePercent}% = {formatCurrency(summary.tax.taxAmount)}
              </span>
            )}
          </div>
          <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
            <span className="text-[10px] text-zinc-600 uppercase font-bold block">Technician hisaab expects</span>
            <span className="font-mono font-bold mt-0.5 block text-zinc-900">
              {formatCurrency(summary.technicianExpectedCollection ?? 0)}
            </span>
          </div>
        </div>
        {job.isFoc && (
          <p className="text-[11px] text-purple-900">
            Company payment:{" "}
            <strong>
              {(job.focAmountReceived || 0) > 0
                ? `${formatCurrency(job.focAmountReceived)} received${job.focPaymentReceivedAt ? ` (${formatDateTime(job.focPaymentReceivedAt)})` : ""}${job.focPaymentRef ? ` · ref ${job.focPaymentRef}` : ""}`
                : "awaiting company payment"}
            </strong>
            {" · "}Reason: {job.focReason || "—"}
            {job.focApprovedBy ? ` · approved by ${job.focApprovedBy}` : ""}
            {job.focApprovedAt ? ` on ${formatDateTime(job.focApprovedAt)}` : ""}
          </p>
        )}

        {canEdit && !locked && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-8 px-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold"
          >
            Change billing / collection
          </button>
        )}
        {editing && (
          <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 space-y-3">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={isFoc} disabled={!canApproveFoc} onChange={(e) => setIsFoc(e.target.checked)} />
              <Gift className="w-3.5 h-3.5 text-purple-700" /> FOC — referred by an external company (customer pays 0)
              {!canApproveFoc && <span className="text-[10px] text-zinc-500">(requires jobs.approve_foc)</span>}
            </label>
            {isFoc && (
              <div className="grid md:grid-cols-2 gap-3">
                <div className="h-8 px-2 rounded border border-zinc-200 bg-white flex items-center">
                  Company: {job.careOfParty?.companyName || <span className="text-red-700">&nbsp;link a Care-Of company first</span>}
                </div>
                <input
                  value={focReason}
                  disabled={!canApproveFoc}
                  onChange={(e) => setFocReason(e.target.value)}
                  placeholder="FOC reason (required)"
                  className="h-8 px-2 rounded border border-zinc-300 bg-white"
                />
              </div>
            )}
            {!isFoc && (
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-8 px-2 rounded border border-zinc-300 bg-white">
                <option value="technician">Technician collects payment on site</option>
                <option value="office">Office / accountant collects (technician collects nothing)</option>
              </select>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={saveBilling} className="h-8 px-3 rounded-lg bg-[#0D7A5F] text-white font-bold">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-8 px-3 rounded-lg border border-zinc-300 bg-white">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* FOC company payment */}
        {job.isFoc && canRecordFoc && (
          <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2">
            <h4 className="text-[11px] font-bold uppercase text-purple-900">Record FOC payment received</h4>
            <p className="text-zinc-600">
              Enter what {job.careOfParty?.companyName || "the company"} actually paid. Posts Dr Cash/Bank, Cr Revenue
              (revenue is recognised on receipt). List value for reference: {formatCurrency(summary.gross ?? 0)}.
            </p>
            <form onSubmit={recordFocPayment} className="grid md:grid-cols-6 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={focPay.amount}
                onChange={(e) => setFocPay({ ...focPay, amount: e.target.value })}
                placeholder="Amount (PKR)"
                className="h-8 px-2 rounded border border-zinc-300 bg-white"
              />
              <input
                type="date"
                value={focPay.date}
                onChange={(e) => setFocPay({ ...focPay, date: e.target.value })}
                className="h-8 px-2 rounded border border-zinc-300 bg-white"
              />
              <select
                value={focPay.method}
                onChange={(e) => setFocPay({ ...focPay, method: e.target.value })}
                className="h-8 px-2 rounded border border-zinc-300 bg-white"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
              <input
                value={focPay.account}
                onChange={(e) => setFocPay({ ...focPay, account: e.target.value })}
                placeholder="Cash/Bank a/c code"
                className="h-8 px-2 rounded border border-zinc-300 bg-white"
              />
              <input
                value={focPay.reference}
                onChange={(e) => setFocPay({ ...focPay, reference: e.target.value })}
                placeholder="Ref / cheque #"
                className="h-8 px-2 rounded border border-zinc-300 bg-white"
              />
              <button type="submit" disabled={busy} className="h-8 px-3 rounded-lg bg-purple-700 text-white font-bold">
                Record payment
              </button>
            </form>
          </div>
        )}

        {/* Office receipt / outstanding */}
        {!job.isFoc && job.paymentCollectionMode === "office" && (
          <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/50 space-y-2">
            <h4 className="text-[11px] font-bold uppercase text-sky-900">Office collection</h4>
            {receivable ? (
              <p>
                Invoice {receivable.invoiceNumber}: {formatCurrency(receivable.invoiceAmount)} · received{" "}
                {formatCurrency(receivable.paid)} ·{" "}
                <strong className={receivable.outstanding > 0 ? "text-amber-800" : "text-emerald-700"}>
                  outstanding {formatCurrency(receivable.outstanding)}
                </strong>
              </p>
            ) : (
              <p className="text-zinc-600">
                Outstanding {formatCurrency(summary.customerPays ?? summary.net ?? 0)}
                {summary.tax?.enabled ? ` (incl. ${summary.tax.name || "sales tax"} ${formatCurrency(summary.tax.taxAmount)})` : ""} — the receivable is booked when the job is finalized; record the receipt after that.
              </p>
            )}
            {canReceive && receivable && receivable.outstanding > 0 && (
              <form onSubmit={recordReceipt} className="grid md:grid-cols-6 gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={receivable.outstanding}
                  value={receipt.amount}
                  onChange={(e) => setReceipt({ ...receipt, amount: e.target.value })}
                  placeholder={`Amount (max ${receivable.outstanding})`}
                  className="h-8 px-2 rounded border border-zinc-300 bg-white"
                />
                <select
                  value={receipt.method}
                  onChange={(e) => setReceipt({ ...receipt, method: e.target.value })}
                  className="h-8 px-2 rounded border border-zinc-300 bg-white"
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online</option>
                </select>
                <input
                  value={receipt.account}
                  onChange={(e) => setReceipt({ ...receipt, account: e.target.value })}
                  placeholder="Cash/Bank a/c code (default mapping)"
                  className="h-8 px-2 rounded border border-zinc-300 bg-white"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={receipt.wht}
                  onChange={(e) => setReceipt({ ...receipt, wht: e.target.value })}
                  placeholder="WHT deducted by customer"
                  title="Only if Settings > Taxes allows customer-deducted WHT"
                  className="h-8 px-2 rounded border border-zinc-300 bg-white"
                />
                <input
                  value={receipt.notes}
                  onChange={(e) => setReceipt({ ...receipt, notes: e.target.value })}
                  placeholder="Notes"
                  className="h-8 px-2 rounded border border-zinc-300 bg-white"
                />
                <button type="submit" disabled={busy} className="h-8 px-3 rounded-lg bg-sky-700 text-white font-bold">
                  Record receipt
                </button>
              </form>
            )}
          </div>
        )}

        {/* Discount requests */}
        <div>
          <h4 className="text-[11px] font-bold uppercase text-zinc-600 mb-1.5 flex items-center gap-1.5">
            <BadgePercent className="w-3.5 h-3.5 text-amber-600" /> Technician discount requests
          </h4>
          {requests.length === 0 ? (
            <p className="text-zinc-500">No discount requests.</p>
          ) : (
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg">
              {requests.map((r) => {
                const item = r.itemId ? (job.items || []).find((i: any) => i.id === r.itemId) : null;
                return (
                  <div key={r.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold">
                        {r.discountType === "percent" ? `${r.discountValue}%` : formatCurrency(r.discountValue)}{" "}
                        <span className="text-zinc-500">≈ {formatCurrency(r.approvedAmount ?? r.requestedAmount)}</span>
                        {" · "}
                        {item ? item.description : "Whole job"}
                      </div>
                      <div className="text-zinc-600">
                        {r.reason} — {r.requestedByName}, {formatDateTime(r.createdAt)}
                      </div>
                      {r.status !== "pending" && (
                        <div className="text-zinc-500">
                          {r.status} by {r.decidedBy || "—"}
                          {r.decidedAt ? `, ${formatDateTime(r.decidedAt)}` : ""}
                          {r.decisionNote ? ` — ${r.decisionNote}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.status === "pending" && canApproveDiscount && !locked && (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={overrides[r.id] ?? ""}
                            onChange={(e) => setOverrides({ ...overrides, [r.id]: e.target.value })}
                            placeholder="Approve PKR (optional)"
                            className="h-7 w-36 px-2 rounded border border-zinc-300"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(r, true)}
                            className="h-7 px-2 rounded bg-emerald-600 text-white font-bold inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(r, false)}
                            className="h-7 px-2 rounded bg-red-600 text-white font-bold inline-flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
