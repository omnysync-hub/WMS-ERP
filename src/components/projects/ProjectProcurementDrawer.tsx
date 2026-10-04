"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart,
  Send,
  Calendar,
  Building,
  AlertCircle,
  FileText,
  CheckCircle2,
  Clock,
  Layers,
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
  actualQty?: number;
  actualCost?: number;
  category?: string;
  status?: string;
}

interface ProjectProcurementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber: string;
  projectName: string;
  selectedItems: BOQItem[];
  onSuccess: (requisition: any) => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function ProjectProcurementDrawer({
  isOpen,
  onClose,
  projectId,
  projectNumber,
  projectName,
  selectedItems,
  onSuccess,
  showToast,
}: ProjectProcurementDrawerProps) {
  const [requestedBy, setRequestedBy] = useState("HVAC Project Engineer");
  const [department, setDepartment] = useState("Project Execution");
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [dateRequired, setDateRequired] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalEstimatedCost = selectedItems.reduce(
    (sum, item) => sum + item.plannedQty * item.unitRate,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItems.length) {
      showToast("No BOQ items selected for procurement.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_requisition_from_boq",
          projectId,
          boqItemIds: selectedItems.map((i) => i.id),
          requestedBy,
          department,
          priority,
          dateRequired,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create requisition.");
      }

      showToast(`Purchase Requisition ${data.prNumber} generated successfully!`, "success");
      onSuccess(data);
      onClose();
    } catch (err: any) {
      showToast(err.message || "An error occurred while creating requisition.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-2xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#18181B] flex items-center gap-2">
              <span>Create Purchase Requisition</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Direct BOQ Link
              </span>
            </div>
            <div className="text-xs text-[#71717A]">
              Project {projectNumber} • {projectName}
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#71717A]">
            Selected: <span className="font-bold text-[#18181B]">{selectedItems.length} items</span> (
            <span className="font-semibold text-emerald-700">{formatCurrency(totalEstimatedCost)}</span>)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="boq-procurement-form"
              disabled={submitting || selectedItems.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Generating PR..." : "Generate Purchase Requisition"}</span>
            </button>
          </div>
        </div>
      }
    >
      <form id="boq-procurement-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Requisition Specs Header */}
        <div className="bg-linear-to-r from-emerald-50/60 to-teal-50/40 p-4 rounded-xl border border-emerald-100/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Direct Link to Procurement Module</span>
            </div>
            <span className="text-[11px] text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
              Status: Draft Requisition
            </span>
          </div>
          <p className="text-xs text-emerald-800/80 leading-relaxed">
            This requisition will instantly sync to the **Procurement &gt; Requisitions** workflow, allowing the purchasing team to solicit vendor RFQ bids and convert directly to POs with budget tracking.
          </p>
        </div>

        {/* Selected BOQ Line Items Table */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#18181B] flex items-center justify-between">
            <span>BOQ Schedule Items to Procure</span>
            <span className="text-[11px] text-[#71717A] font-normal">
              {selectedItems.length} selected
            </span>
          </label>
          <div className="border border-[#E4E4E7] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E4E4E7] text-[11px] font-bold text-[#71717A]">
                  <th className="py-2.5 px-3">Item Code</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Est. Rate</th>
                  <th className="py-2.5 px-3 text-right">Est. Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7] text-xs">
                {selectedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0D7A5F]">{item.itemCode}</td>
                    <td className="py-2.5 px-3 text-[#18181B] max-w-[200px] truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[#18181B]">
                      {item.plannedQty} <span className="text-[10px] text-[#71717A]">{item.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#71717A]">
                      {formatCurrency(item.unitRate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#18181B]">
                      {formatCurrency(item.plannedQty * item.unitRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F4F4F5] border-t border-[#E4E4E7] font-bold text-xs">
                  <td colSpan={4} className="py-2.5 px-3 text-right text-[#52525B]">
                    Total Estimated Sourcing Budget:
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-800">
                    {formatCurrency(totalEstimatedCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Requisitioner / Project Lead
            </label>
            <input
              type="text"
              required
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              placeholder="e.g. Engr. Hamza"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Cost Allocation / Department
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              placeholder="e.g. Commercial MEP Projects"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Procurement Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "Normal" | "Urgent")}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            >
              <option value="Normal">Normal (Standard Lead Time)</option>
              <option value="Urgent">Urgent (Critical Site Dependency)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Site Delivery Required Date
            </label>
            <input
              type="date"
              required
              value={dateRequired}
              onChange={(e) => setDateRequired(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#52525B] block mb-1">
            Procurement Notes & Technical Specifications
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
            placeholder="Special brand approvals (e.g. Daikin, York), certifications, or material testing requirements..."
          />
        </div>
      </form>
    </SideDrawer>
  );
}
