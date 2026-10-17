"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  FolderKanban,
  Plus,
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Trash2,
} from "lucide-react";

interface BOQChangeOrder {
  id: string;
  projectId: string;
  changeNumber: string;
  title: string;
  description?: string | null;
  requestedBy?: string | null;
  amountImpact: number;
  daysImpact: number;
  status: string;
  approvedAt?: string | null;
  createdAt: string;
}

interface BOQItem {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  plannedQty: number;
  unitRate: number;
  version?: number;
  changeOrderRef?: string | null;
}

interface ProjectChangeOrdersTabProps {
  projectId: string;
  projectNumber: string;
  projectName: string;
  currentRevision: number;
  changeOrders: BOQChangeOrder[];
  boqItems: BOQItem[];
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function ProjectChangeOrdersTab({
  projectId,
  projectNumber,
  projectName,
  currentRevision,
  changeOrders,
  boqItems,
  onRefresh,
  showToast,
}: ProjectChangeOrdersTabProps) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedBy, setRequestedBy] = useState("Client Representative");
  const [amountImpact, setAmountImpact] = useState<number | string>(0);
  const [daysImpact, setDaysImpact] = useState<number | string>(0);
  const [newItems, setNewItems] = useState<
    Array<{ itemCode: string; description: string; unit: string; plannedQty: number; unitRate: number }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  function handleAddNewItemRow() {
    setNewItems([
      ...newItems,
      {
        itemCode: `BOQ-VAR-${newItems.length + 1}`,
        description: "",
        unit: "unit",
        plannedQty: 1,
        unitRate: 0,
      },
    ]);
  }

  function handleItemChange(index: number, field: string, value: any) {
    const updated = [...newItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewItems(updated);

    // Auto update total amount impact
    const calculated = updated.reduce(
      (sum, item) => sum + (Number(item.plannedQty) || 0) * (Number(item.unitRate) || 0),
      0
    );
    if (calculated > 0) {
      setAmountImpact(calculated);
    }
  }

  function handleRemoveItemRow(index: number) {
    const updated = newItems.filter((_, i) => i !== index);
    setNewItems(updated);
    const calculated = updated.reduce(
      (sum, item) => sum + (Number(item.plannedQty) || 0) * (Number(item.unitRate) || 0),
      0
    );
    setAmountImpact(calculated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Change order title is required.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_change_order",
          projectId,
          title,
          description,
          requestedBy,
          amountImpact: Number(amountImpact) || 0,
          daysImpact: Number(daysImpact) || 0,
          newBoqItems: newItems.filter((i) => i.description.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create change order.");

      showToast(`Change Order ${data.changeNumber} approved! Scope baseline updated to Rev ${currentRevision + 1}.`, "success");
      setShowDrawer(false);
      setTitle("");
      setDescription("");
      setAmountImpact(0);
      setDaysImpact(0);
      setNewItems([]);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const totalVariationsAmount = changeOrders.reduce((sum, co) => sum + co.amountImpact, 0);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#18181B]">BOQ Versioning & Change Orders</h3>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Current Baseline: Rev {currentRevision}.0
            </span>
          </div>
          <p className="text-xs text-[#71717A]">
            Audit history of contractual variation orders, client scope amendments, and approved budget adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-[#71717A]">Approved Variations</div>
            <div className="text-sm font-bold text-emerald-700">
              +{formatCurrency(totalVariationsAmount)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Change Order</span>
          </button>
        </div>
      </div>

      {/* Change Orders History List */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
          <h4 className="text-xs font-bold text-[#52525B]">Approved Variation Orders Register</h4>
          <span className="text-xs text-[#71717A]">{changeOrders.length} Logged Variations</span>
        </div>

        {changeOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-[#A1A1AA] mx-auto" />
            <div className="text-xs font-bold text-[#18181B]">Initial Baseline Scope (Rev 1.0)</div>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto">
              No change orders or client variations have been registered yet for this project.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E4E7]">
            {changeOrders.map((co) => {
              const linkedItems = boqItems.filter((b) => b.changeOrderRef === co.changeNumber);
              return (
                <div key={co.id} className="p-4.5 hover:bg-[#FAFAFA] transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {co.changeNumber}
                        </span>
                        <span className="text-sm font-bold text-[#18181B]">{co.title}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Approved
                        </span>
                      </div>
                      {co.description && (
                        <p className="text-xs text-[#71717A]">{co.description}</p>
                      )}
                    </div>

                    <div className="text-right sm:text-right">
                      <div className="text-sm font-bold text-emerald-700">
                        +{formatCurrency(co.amountImpact)}
                      </div>
                      <div className="text-[11px] text-[#71717A]">
                        {co.daysImpact > 0 ? `+${co.daysImpact} days schedule extension` : "Zero schedule delay"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#71717A]">
                    <span>Requested by: <strong className="text-[#18181B]">{co.requestedBy}</strong></span>
                    <span>•</span>
                    <span>Approved: {formatDate(co.approvedAt || co.createdAt)}</span>
                    {linkedItems.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-[#0D7A5F]">
                          {linkedItems.length} new BOQ line items added
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SideDrawer: Create Change Order */}
      <SideDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        width="max-w-2xl"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#18181B]">
                Issue Project Change Order (Variation)
              </div>
              <div className="text-xs text-[#71717A]">
                Will bump baseline to Revision {currentRevision + 1}.0
              </div>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="px-3.5 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="change-order-form"
              disabled={submitting}
              className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {submitting ? "Approving..." : "Approve & Update Baseline"}
            </button>
          </div>
        }
      >
        <form id="change-order-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Variation / Change Order Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Additional Acoustic Attenuators & Fresh Air Louvers"
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Requested By / Client Auth
              </label>
              <input
                type="text"
                required
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Schedule Impact (Days)
              </label>
              <input
                type="number"
                value={daysImpact}
                onChange={(e) => setDaysImpact(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Net Budget Impact (PKR)
            </label>
            <input
              type="number"
              step="any"
              required
              value={amountImpact}
              onChange={(e) => setAmountImpact(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Detailed Justification / Site Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Client requested modification due to revised architectural layout..."
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
            />
          </div>

          {/* New Scope Items Section */}
          <div className="space-y-2 pt-2 border-t border-[#E4E4E7]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#18181B]">
                New BOQ Scope Items (Optional)
              </label>
              <button
                type="button"
                onClick={handleAddNewItemRow}
                className="text-xs font-semibold text-[#0D7A5F] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Item Row</span>
              </button>
            </div>

            {newItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={item.itemCode}
                    onChange={(e) => handleItemChange(idx, "itemCode", e.target.value)}
                    placeholder="Code"
                    className="w-28 p-1.5 text-xs bg-white border border-[#D4D4D8] rounded font-mono font-bold text-[#0D7A5F]"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                    placeholder="Scope Description..."
                    className="grow p-1.5 text-xs bg-white border border-[#D4D4D8] rounded"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                    placeholder="Unit (e.g. sq.m, pcs)"
                    className="p-1.5 text-xs bg-white border border-[#D4D4D8] rounded"
                  />
                  <input
                    type="number"
                    value={item.plannedQty}
                    onChange={(e) => handleItemChange(idx, "plannedQty", e.target.value)}
                    placeholder="Qty"
                    className="p-1.5 text-xs bg-white border border-[#D4D4D8] rounded"
                  />
                  <input
                    type="number"
                    value={item.unitRate}
                    onChange={(e) => handleItemChange(idx, "unitRate", e.target.value)}
                    placeholder="Rate (PKR)"
                    className="p-1.5 text-xs bg-white border border-[#D4D4D8] rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}
