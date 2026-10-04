"use client";

import React, { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Receipt,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Sparkles,
  ExternalLink,
  Trash2,
  Edit2,
} from "lucide-react";

interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  percentage: number;
  amount: number;
  targetDate?: string | null;
  status: string; // pending, ready_to_bill, billed, paid
  invoiceNumber?: string | null;
  billedAt?: string | null;
  createdAt: string;
}

interface ProjectInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface ProjectBillingTabProps {
  projectId: string;
  projectNumber: string;
  projectName: string;
  contractValue: number;
  totalBudget: number;
  invoicedAmount: number;
  retentionPercent: number;
  milestones: ProjectMilestone[];
  invoices: ProjectInvoice[];
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function ProjectBillingTab({
  projectId,
  projectNumber,
  projectName,
  contractValue,
  totalBudget,
  invoicedAmount,
  retentionPercent,
  milestones,
  invoices,
  onRefresh,
  showToast,
}: ProjectBillingTabProps) {
  // Modal states
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState<number | string>(20);
  const [amount, setAmount] = useState<number | string>("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Quick invoice generation modal
  const [billingMilestone, setBillingMilestone] = useState<ProjectMilestone | null>(null);
  const [billingAmount, setBillingAmount] = useState<number | string>("");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const effectiveContract = contractValue > 0 ? contractValue : totalBudget;
  const invoicedPercent = effectiveContract > 0 ? Math.min(100, (invoicedAmount / effectiveContract) * 100) : 0;
  const remainingToBill = Math.max(0, effectiveContract - invoicedAmount);
  const retentionDeduction = (retentionPercent / 100) * effectiveContract;

  // Auto calculate amount from percentage
  function handlePercentageChange(val: string) {
    setPercentage(val);
    const num = Number(val) || 0;
    if (effectiveContract > 0) {
      setAmount(Math.round((num / 100) * effectiveContract));
    }
  }

  // Create Milestone
  async function handleCreateMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Milestone title is required.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_milestone",
          projectId,
          title,
          description,
          percentage: Number(percentage) || 0,
          amount: Number(amount) || 0,
          targetDate: targetDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create milestone.");

      showToast("Milestone created successfully!", "success");
      setShowAddMilestone(false);
      setTitle("");
      setDescription("");
      setPercentage(20);
      setAmount("");
      setTargetDate("");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // Generate Progress Billing Invoice
  async function handleGenerateInvoice() {
    if (!billingMilestone) return;

    try {
      setGeneratingInvoice(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_progress_invoice",
          projectId,
          milestoneId: billingMilestone.id,
          amount: Number(billingAmount) || billingMilestone.amount,
          milestoneTitle: billingMilestone.title,
          percentage: billingMilestone.percentage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate invoice.");

      showToast(`Tax Invoice ${data.invoice?.invoiceNumber} generated!`, "success");
      setBillingMilestone(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setGeneratingInvoice(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Billing Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#71717A]">Contract Value</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-[#18181B] mt-2">
            {formatCurrency(effectiveContract)}
          </div>
          <div className="text-[11px] text-[#71717A] mt-1 flex items-center gap-1.5">
            <span>Retention: {retentionPercent}%</span>
            <span>({formatCurrency(retentionDeduction)})</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#71717A]">Total Invoiced</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-700 mt-2">
            {formatCurrency(invoicedAmount)}
          </div>
          <div className="w-full bg-[#E4E4E7] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, invoicedPercent)}%` }}
            />
          </div>
          <div className="text-[11px] text-[#71717A] mt-1">
            {invoicedPercent.toFixed(1)}% of total contract billed
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#71717A]">Remaining to Bill</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700 mt-2">
            {formatCurrency(remainingToBill)}
          </div>
          <div className="text-[11px] text-[#71717A] mt-1">
            {(100 - invoicedPercent).toFixed(1)}% pending certification
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#71717A]">Invoices Issued</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-[#18181B] mt-2">
            {invoices.length} Invoices
          </div>
          <div className="text-[11px] text-[#71717A] mt-1">
            Integrated with General Ledger
          </div>
        </div>
      </div>

      {/* Milestones Section */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
              <span>Progress Billing Milestones</span>
              <span className="text-xs font-normal text-[#71717A]">
                ({milestones.length} defined)
              </span>
            </h3>
            <p className="text-xs text-[#71717A] mt-0.5">
              Certify physical work completion and trigger client tax invoices directly into Accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddMilestone(true);
              if (effectiveContract > 0) setAmount(Math.round(0.2 * effectiveContract));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Milestone</span>
          </button>
        </div>

        <div className="divide-y divide-[#E4E4E7]">
          {milestones.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Receipt className="w-8 h-8 text-[#A1A1AA] mx-auto" />
              <div className="text-xs font-bold text-[#18181B]">No Billing Milestones Defined</div>
              <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                Break this commercial project into milestone stages (e.g. Mobilization 15%, First Fix 35%, Handover 20%) to automate progress billing.
              </p>
            </div>
          ) : (
            milestones.map((ms, index) => {
              const isBilled = ms.status === "billed" || ms.status === "paid";
              return (
                <div
                  key={ms.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center text-xs font-bold text-[#52525B] shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#18181B]">{ms.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {ms.percentage}% of Contract
                        </span>
                        {isBilled ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Billed ({ms.invoiceNumber || "Invoice Created"})</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Certification
                          </span>
                        )}
                      </div>
                      {ms.description && (
                        <p className="text-xs text-[#71717A] mt-1">{ms.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-[#71717A] mt-1.5 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#A1A1AA]" />
                          <span>{ms.targetDate ? formatDate(ms.targetDate) : "Flexible date"}</span>
                        </span>
                        <span>•</span>
                        <span className="text-[#18181B] font-bold">
                          Amount: {formatCurrency(ms.amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!isBilled && (
                      <button
                        type="button"
                        onClick={() => {
                          setBillingMilestone(ms);
                          setBillingAmount(ms.amount);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Generate Invoice</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Generated Invoices List */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
            <span>Project Invoices & Tax Billings</span>
            <span className="text-xs font-normal text-[#71717A]">
              ({invoices.length} posted)
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F4F5] text-[#71717A] font-bold border-b border-[#E4E4E7]">
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Created Date</th>
                <th className="py-2.5 px-4 text-right">Invoice Amount</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#71717A]">
                    No invoices generated yet for this project.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 px-4 font-mono font-bold text-[#0D7A5F]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-[#52525B]">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#18181B]">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          inv.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Milestone */}
      {showAddMilestone && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E4E4E7] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#0D7A5F]" />
              <span>Define Billing Milestone</span>
            </h3>

            <form onSubmit={handleCreateMilestone} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#52525B] block mb-1">
                  Milestone Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 50% First Fix Chilled Water Piping"
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#52525B] block mb-1">
                    Contract Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max="100"
                    required
                    value={percentage}
                    onChange={(e) => handlePercentageChange(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#52525B] block mb-1">
                    Billing Amount (PKR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#52525B] block mb-1">
                  Target Certification Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#52525B] block mb-1">
                  Milestone Deliverables / Scope Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Verification checklist required before billing..."
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowAddMilestone(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {submitting ? "Saving..." : "Create Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Invoice Generation */}
      {billingMilestone && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E4E4E7] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <span>Generate Customer Tax Invoice</span>
            </h3>

            <p className="text-xs text-[#52525B] leading-relaxed">
              Generate an official commercial tax invoice for milestone:{" "}
              <strong className="text-[#18181B]">{billingMilestone.title}</strong>. This invoice will be registered in the customer ledger and accounts receivable.
            </p>

            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Certified Billing Amount (PKR)
              </label>
              <input
                type="number"
                step="any"
                value={billingAmount}
                onChange={(e) => setBillingAmount(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2.5 rounded-lg text-sm font-bold border border-[#D4D4D8] focus:ring-2 focus:ring-blue-600 focus:outline-none text-[#18181B]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setBillingMilestone(null)}
                className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={generatingInvoice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                {generatingInvoice ? "Issuing..." : "Confirm & Issue Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
