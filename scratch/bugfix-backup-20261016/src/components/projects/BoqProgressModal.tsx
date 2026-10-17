"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  Calculator,
  ArrowRight,
} from "lucide-react";

interface BOQItem {
  id: string;
  projectId: string;
  itemCode: string;
  description: string;
  unit: string;
  plannedQty: number;
  unitRate: number;
  category?: string;
  actualQty?: number;
  actualCost?: number;
  completedQty?: number;
  status?: string;
}

interface BoqProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  boqItem: BOQItem | null;
  onSuccess: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function BoqProgressModal({
  isOpen,
  onClose,
  boqItem,
  onSuccess,
  showToast,
}: BoqProgressModalProps) {
  const [completedQty, setCompletedQty] = useState<number | string>(0);
  const [actualQty, setActualQty] = useState<number | string>(0);
  const [actualCost, setActualCost] = useState<number | string>(0);
  const [status, setStatus] = useState<string>("in_progress");
  const [category, setCategory] = useState<string>("material");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (boqItem) {
      setCompletedQty(boqItem.completedQty ?? 0);
      setActualQty(boqItem.actualQty ?? 0);
      setActualCost(boqItem.actualCost ?? 0);
      setStatus(boqItem.status || "in_progress");
      setCategory(boqItem.category || "material");
    }
  }, [boqItem]);

  if (!isOpen || !boqItem) return null;

  const plannedTotal = boqItem.plannedQty * boqItem.unitRate;
  const currentActualCost = Number(actualCost) || 0;
  const variance = plannedTotal - currentActualCost;
  const isOverrun = currentActualCost > plannedTotal;
  const percentComplete = boqItem.plannedQty > 0
    ? Math.min(100, Math.round(((Number(completedQty) || 0) / boqItem.plannedQty) * 100))
    : 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!boqItem) return;

    try {
      setSaving(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_boq_progress",
          boqItemId: boqItem.id,
          completedQty: Number(completedQty) || 0,
          actualQty: Number(actualQty) || 0,
          actualCost: Number(actualCost) || 0,
          status,
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update BOQ progress.");
      }

      showToast(`Progress updated for ${boqItem.itemCode}`, "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to save progress.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E4E4E7] space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <span>Update Progress & Cost Variance</span>
                <span className="font-mono text-xs text-[#0D7A5F] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {boqItem.itemCode}
                </span>
              </h3>
              <p className="text-xs text-[#71717A] max-w-[320px] truncate" title={boqItem.description}>
                {boqItem.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A1A1AA] hover:text-[#18181B] p-1 rounded-lg hover:bg-[#F4F4F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Variance Preview Card */}
        <div className="grid grid-cols-3 gap-2.5 bg-[#FAFAFA] p-3.5 rounded-xl border border-[#E4E4E7]">
          <div>
            <div className="text-[10px] uppercase font-bold text-[#71717A]">Planned Budget</div>
            <div className="text-xs font-bold text-[#18181B] mt-0.5">
              {formatCurrency(plannedTotal)}
            </div>
            <div className="text-[10px] text-[#71717A] mt-0.5">
              {boqItem.plannedQty} {boqItem.unit} @ {formatCurrency(boqItem.unitRate)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-[#71717A]">Actual Incurred</div>
            <div className="text-xs font-bold text-[#18181B] mt-0.5">
              {formatCurrency(currentActualCost)}
            </div>
            <div className="text-[10px] text-[#71717A] mt-0.5">
              Qty: {actualQty || 0} {boqItem.unit}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-[#71717A]">Variance ($)</div>
            <div
              className={`text-xs font-bold mt-0.5 ${
                isOverrun ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {isOverrun ? `-${formatCurrency(Math.abs(variance))}` : `+${formatCurrency(variance)}`}
            </div>
            <div className="text-[10px] text-[#71717A] mt-0.5">
              {isOverrun ? "Cost Overrun" : "Under Budget"}
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Completed Physical Qty ({boqItem.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={completedQty}
                onChange={(e) => setCompletedQty(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              />
              <div className="text-[10px] text-teal-700 font-medium mt-1">
                Progress: {percentComplete}% of planned
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Actual Material Consumed ({boqItem.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Actual Total Cost Incurred (PKR)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Scope Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              >
                <option value="material">Material Supply</option>
                <option value="labor">Installation / Labor</option>
                <option value="subcontract">Subcontracted Work</option>
                <option value="equipment">Heavy Equipment / Crane</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              BOQ Execution Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            >
              <option value="pending">Pending (Not Started)</option>
              <option value="procuring">Procuring / Ordered</option>
              <option value="in_progress">In Progress (Active Work)</option>
              <option value="completed">Completed & Verified</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E4E4E7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Progress & Actuals"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
