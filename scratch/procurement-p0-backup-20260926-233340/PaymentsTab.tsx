"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Landmark,
  Receipt,
  Eye,
  ArrowRight,
  ShieldCheck,
  Building,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface PaymentsTabProps {
  invoices: any[];
  onRefresh: () => void;
  presetInvoiceForPay?: any | null;
}

export default function PaymentsTab({
  invoices,
  onRefresh,
  presetInvoiceForPay,
}: PaymentsTabProps) {
  const { currentRole } = useRole();
  const isStorekeeper = currentRole === "storekeeper";

  const [search, setSearch] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");

  if (isStorekeeper) {
    return (
      <div className="p-8 text-center bg-white border border-[#EDEDED] rounded-xl space-y-3 shadow-2xs">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <CreditCard className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-[#18181B]">Payment Disbursements Restricted</h3>
        <p className="text-xs text-[#71717A] max-w-md mx-auto">
          Supplier disbursements and bank payments are restricted to Finance & Accounts personnel. Storekeepers manage physical stock receiving (GRN) and material allocations.
        </p>
      </div>
    );
  }

  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(Boolean(presetInvoiceForPay));
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(presetInvoiceForPay || null);
  const [paymentAmount, setPaymentAmount] = useState(() => {
    if (presetInvoiceForPay) {
      return String(presetInvoiceForPay.totalAmount - (presetInvoiceForPay.paidAmount || 0));
    }
    return "";
  });
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cheque" | "cash">("bank_transfer");
  const [bankAccountId, setBankAccountId] = useState("1010");
  const [reference, setReference] = useState("");
  const [whtAmount, setWhtAmount] = useState("0");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const payableInvoices = invoices.filter(
    (inv) => inv.matchStatus === "approved_for_payment" || inv.matchStatus === "paid"
  );

  const openPayModal = (inv: any) => {
    setSelectedInvoice(inv);
    const balance = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
    setPaymentAmount(String(balance));

    // Calculate default WHT based on vendor's rate
    const whtRate = inv.vendor?.whtRate || 4.5;
    const calculatedWht = Math.round((balance * whtRate) / 100);
    setWhtAmount(String(calculatedWht));

    setReference(`FT-${Date.now().toString().slice(-6)}`);
    setNotes(`Settlement of 3-Way Matched Bill ${inv.invoiceNumber} for ${inv.vendor?.name}`);
    setShowPayModal(true);
    setFormError("");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = Number(paymentAmount) || 0;
    if (amt <= 0) {
      setFormError("Payment amount must be greater than zero.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payment",
          supplierInvoiceId: selectedInvoice.id,
          amount: amt,
          paymentMethod,
          reference,
          bankAccountId,
          whtAmount: Number(whtAmount) || 0,
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to disburse payment");
      }

      alert("Vendor payment successfully recorded! Accounts Payable cleared and posted to General Ledger.");
      setShowPayModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Payment execution failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = payableInvoices.filter((inv) => {
    const matchStatus =
      filterPaymentStatus === "all" ||
      (filterPaymentStatus === "unpaid" && inv.paymentStatus !== "paid") ||
      (filterPaymentStatus === "paid" && inv.paymentStatus === "paid");

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.referenceNumber?.toLowerCase().includes(q) ||
      inv.vendor?.name?.toLowerCase().includes(q);

    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative min-w-[280px] max-w-md">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search approved bills by invoice #, vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <select
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Payment Statuses</option>
            <option value="unpaid">Awaiting Disbursement (Unpaid)</option>
            <option value="paid">Settled / Fully Paid</option>
          </select>
        </div>
      </div>

      {/* Payable Bills Table */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Invoice # & Reference</th>
                <th className="py-3 px-3">Vendor / Supplier</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Invoice Total</th>
                <th className="py-3 px-3 text-right">Paid to Date</th>
                <th className="py-3 px-3 text-right">Balance Due</th>
                <th className="py-3 px-3 text-center">Settlement Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#71717A]">
                    No approved supplier invoices awaiting payment. Approve invoices in the 3-Way Match console first.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const balanceDue = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
                  const isPaid = inv.paymentStatus === "paid" || balanceDue <= 0.01;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-[#F8FAFC] transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] font-mono">
                          {inv.referenceNumber}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#18181B]">
                          {inv.vendor?.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#71717A]">
                          Bank: {inv.vendor?.bankName || "Main Checking"}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "Immediate"}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#18181B]">
                        {formatCurrency(inv.totalAmount)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {formatCurrency(inv.paidAmount || 0)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                        <span className={balanceDue > 0 ? "text-amber-600" : "text-[#71717A]"}>
                          {formatCurrency(balanceDue)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          {isPaid ? "Fully Settled" : "Pending Payment"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isPaid && (
                          <button
                            onClick={() => openPayModal(inv)}
                            className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Disburse Payment
                          </button>
                        )}
                        {isPaid && (
                          <span className="text-[10px] font-mono text-[#71717A] italic">
                            {inv.payments?.length || 1} payment record(s)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disburse Payment Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <h4 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#0D7A5F]" />
                Disburse Payment to {selectedInvoice.vendor?.name}
              </h4>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-[#71717A] hover:text-[#18181B] font-bold text-lg px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Summary Card */}
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#EDEDED] space-y-1">
                <div className="flex justify-between text-[#71717A]">
                  <span>Vendor Bill Reference:</span>
                  <span className="font-mono text-[#18181B] font-bold">
                    {selectedInvoice.invoiceNumber} ({selectedInvoice.referenceNumber})
                  </span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Gross Invoice Payable:</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {formatCurrency(selectedInvoice.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Banking & Disbursing Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Disbursing Bank / Cash Account *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="1010">1010 - Operating Bank Account (Meezan Bank)</option>
                    <option value="1011">1011 - Commercial Account (HBL)</option>
                    <option value="1000">1000 - Main Cash Drawer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="bank_transfer">Online Bank Transfer / RTGS</option>
                    <option value="cheque">Crossed Corporate Cheque</option>
                    <option value="cash">Cash Voucher</option>
                  </select>
                </div>
              </div>

              {/* Amounts & WHT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Disbursement Amount (PKR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono font-bold focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Withholding Tax (WHT) Deducted
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={whtAmount}
                    onChange={(e) => setWhtAmount(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Bank Reference / Cheque #
                </label>
                <input
                  type="text"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  placeholder="e.g. CHQ-991823 / FT-89102"
                />
              </div>

              {/* Net Bank Outflow Preview */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-xs space-y-1">
                <div className="flex justify-between text-[#18181B]">
                  <span>Accounts Payable Cleared (Debit):</span>
                  <strong>{formatCurrency(Number(paymentAmount) || 0)}</strong>
                </div>
                <div className="flex justify-between text-[#18181B]">
                  <span>Net Outflow from Bank Account (Credit):</span>
                  <strong className="text-emerald-800">
                    {formatCurrency((Number(paymentAmount) || 0) - (Number(whtAmount) || 0))}
                  </strong>
                </div>
                {(Number(whtAmount) || 0) > 0 && (
                  <div className="flex justify-between text-[#18181B]">
                    <span>Credit WHT 2200 Payable:</span>
                    <strong className="text-amber-700">
                      {formatCurrency(Number(whtAmount) || 0)}
                    </strong>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Disbursing..." : "Confirm & Post Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
