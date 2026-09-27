"use client";

import React, { useEffect, useMemo, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { AlertTriangle, Check, AlertCircle, Package } from "lucide-react";

interface MisplacedLineItem {
  id: string;
  item: string;
  qtyIssued: number;
  qtyUsed: number;
  maxReturnable: number;
  selected: boolean;
  quantity: number;
}

interface ReportMisplacedItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  actor: string;
  onSuccess?: () => void;
}

function cleanDescription(desc: string): string {
  return (desc || "")
    .replace(/\s*\[Service Added by.*?\]/gi, "")
    .replace(/\s*\[Discount.*?\]/gi, "")
    .trim();
}

export default function ReportMisplacedItemDrawer({
  isOpen,
  onClose,
  job,
  actor,
  onSuccess,
}: ReportMisplacedItemDrawerProps) {
  const [lines, setLines] = useState<MisplacedLineItem[]>([]);
  const [commonReason, setCommonReason] = useState("");
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [adHocItem, setAdHocItem] = useState("");
  const [adHocQty, setAdHocQty] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !job) return;

    setErrorMsg("");
    setCommonReason("Technician reported item misplaced/lost on site during work execution");
    setShowAdHoc(false);
    setAdHocItem("");
    setAdHocQty("1");

    const items: any[] = Array.isArray(job.items) ? job.items : [];
    const parsedLines: MisplacedLineItem[] = [];

    for (const it of items) {
      const desc = cleanDescription(it.description);
      if (!desc || desc.includes("[Discount Requested:")) continue;

      const qtyIssued = Number(it.quantityPlanned) || 1;
      const hasActual = it.quantityActual !== null && it.quantityActual !== undefined;
      const qtyUsed = hasActual ? Number(it.quantityActual) : qtyIssued;
      const unused = Math.max(1, qtyIssued - (hasActual ? Number(it.quantityActual) : 0));

      parsedLines.push({
        id: it.id,
        item: desc,
        qtyIssued,
        qtyUsed,
        maxReturnable: qtyIssued,
        selected: false,
        quantity: Math.min(1, unused),
      });
    }

    setLines(parsedLines);
  }, [isOpen, job]);

  const selectedLines = useMemo(() => lines.filter((l) => l.selected && l.quantity > 0), [lines]);
  const hasAdHoc = showAdHoc && adHocItem.trim().length > 0 && Number(adHocQty) > 0;
  const totalCount = selectedLines.length + (hasAdHoc ? 1 : 0);

  const updateLine = (id: string, patch: Partial<MisplacedLineItem>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        if (typeof patch.quantity === "number") {
          updated.quantity = Math.max(1, patch.quantity);
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (totalCount === 0) {
      setErrorMsg("Please select at least one issued item or enter an unlisted item to report as misplaced.");
      return;
    }

    if (!commonReason.trim()) {
      setErrorMsg("Please provide a reason / circumstance for the misplaced item(s).");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const itemsToReport: Array<{ item: string; quantity: number; reason: string }> = [
        ...selectedLines.map((l) => ({
          item: l.item,
          quantity: Number(l.quantity),
          reason: commonReason.trim(),
        })),
      ];

      if (hasAdHoc) {
        itemsToReport.push({
          item: adHocItem.trim(),
          quantity: Number(adHocQty),
          reason: commonReason.trim(),
        });
      }

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_misplaced_item",
          technicianId: job?.assignedTechnicianId,
          items: itemsToReport,
          reason: commonReason.trim(),
          actor: actor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record misplaced item(s)");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log misplaced item(s).");
    } finally {
      setIsSubmitting(false);
    }
  };

  const techName = job?.assignedTechnician?.name || "Technician";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-lg"
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Report Misplaced Item
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · Tech: ${techName}`}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-[11px] text-[#71717A]">
            {totalCount > 0 ? `${totalCount} item(s) selected` : "No items selected"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || totalCount === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? "Logging..." : `Log Misplaced (${totalCount})`}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
          <p className="font-semibold text-amber-950 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-amber-700" />
            Select from Items Issued to this Job:
          </p>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Check the items issued to Work Order #{job?.jobNumber} that technician {techName} reported lost or misplaced on site.
          </p>
        </div>

        {/* Issued Items Checklist */}
        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-[#E4E4E7] rounded-xl bg-[#FAFAFA] p-4">
              <p className="text-xs text-[#71717A]">No material line items recorded on this work order yet.</p>
              <p className="text-[11px] text-[#A1A1AA] mt-0.5">Use the unlisted item option below to report missing equipment.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              <div className="grid grid-cols-[auto_1fr_90px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                <span></span>
                <span>Issued Item</span>
                <span className="text-right">Misplaced Qty</span>
              </div>

              {lines.map((line) => (
                <div
                  key={line.id}
                  className={`p-2.5 rounded-lg border transition ${
                    line.selected
                      ? "border-rose-300 bg-rose-50/40 shadow-2xs"
                      : "border-[#E4E4E7] bg-white hover:border-[#D4D4D8]"
                  }`}
                >
                  <div className="grid grid-cols-[auto_1fr_90px] gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={(e) => updateLine(line.id, { selected: e.target.checked })}
                      className="rounded border-[#D4D4D8] text-rose-600 focus:ring-rose-600"
                      aria-label={`Select ${line.item}`}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#18181B] truncate" title={line.item}>
                        {line.item}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#71717A]">
                        <span>Issued: <strong className="font-mono text-[#18181B]">{line.qtyIssued}</strong></span>
                        <span>•</span>
                        <span>Used: <strong className="font-mono text-[#18181B]">{line.qtyUsed}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <input
                        type="number"
                        min="1"
                        max={line.maxReturnable}
                        disabled={!line.selected}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) || 1 })}
                        className="w-full bg-[#F4F4F5] disabled:bg-[#E4E4E7] p-1.5 rounded-md border border-[#D4D4D8] font-mono font-bold text-xs text-right focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ad-hoc / Unlisted Item Toggle */}
        <div className="pt-2 border-t border-[#E4E4E7]">
          {!showAdHoc ? (
            <button
              type="button"
              onClick={() => setShowAdHoc(true)}
              className="text-xs font-semibold text-rose-700 hover:text-rose-800 hover:underline inline-flex items-center gap-1"
            >
              + Report unlisted tool or custom item
            </button>
          ) : (
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-950">Unlisted Tool / Custom Item</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdHoc(false);
                    setAdHocItem("");
                    setAdHocQty("1");
                  }}
                  className="text-[10px] text-[#71717A] hover:text-[#18181B]"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-rose-900 block mb-0.5">Item Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Vacuum Gauge Adapter or Wrench Set"
                    value={adHocItem}
                    onChange={(e) => setAdHocItem(e.target.value)}
                    className="w-full bg-white p-2 rounded-md border border-rose-200 text-xs focus:ring-2 focus:ring-rose-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-rose-900 block mb-0.5">Qty *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={adHocQty}
                    onChange={(e) => setAdHocQty(e.target.value)}
                    className="w-full bg-white p-2 rounded-md border border-rose-200 font-mono font-bold text-xs text-right focus:ring-2 focus:ring-rose-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reason / Circumstances */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Circumstances / Reason *
          </label>
          <textarea
            rows={2}
            required
            value={commonReason}
            onChange={(e) => setCommonReason(e.target.value)}
            placeholder="State why this item was not returned to warehouse..."
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
          />
        </div>

        <div className="p-3 bg-rose-50 rounded-lg text-[11px] text-rose-950 space-y-1 border border-rose-200 leading-relaxed">
          <p className="font-semibold text-rose-900">Accountability & Governance Policy:</p>
          <p>• Records item shortage in audit log under technician accountability.</p>
          <p>• Prevents false inventory restocking for unreturned or missing materials.</p>
          <p>• Logged by {actor}.</p>
        </div>
      </form>
    </SideDrawer>
  );
}
