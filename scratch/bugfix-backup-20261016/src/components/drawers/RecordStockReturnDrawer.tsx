"use client";

import React, { useEffect, useMemo, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Package, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";

export type ReturnLineState = {
  key: string;
  kind: "job_item" | "pending_return";
  itemLabel: string;
  qtyIssued: number;
  qtyUsed: number;
  qtyUnused: number;
  qtyAlreadyReturned: number;
  maxReturnable: number;
  returnQty: number;
  pendingReturnId?: string;
  pendingQty?: number;
  /** Source job line (lets the server resolve the product via "(SKU)"). */
  jobItemId?: string;
  include: boolean;
};

interface RecordStockReturnDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any | null;
  storekeeperName: string;
  onSuccess?: () => void;
}

function matchReturnToItem(returnItem: string, description: string): boolean {
  if (!returnItem || !description) return false;
  const a = returnItem.toLowerCase();
  const b = description.toLowerCase();
  return a.includes(b) || b.includes(a.split(" [unused")[0].trim());
}

function buildLines(job: any): ReturnLineState[] {
  if (!job) return [];

  const returns: any[] = Array.isArray(job.stockReturns) ? job.stockReturns : [];
  const items: any[] = Array.isArray(job.items) ? job.items : [];
  const matchedReturnIds = new Set<string>();
  const lines: ReturnLineState[] = [];

  for (const it of items) {
    const description = String(it.description || "Item");
    // Skip pure discount / note lines
    if (description.includes("[Discount Requested:")) continue;

    const qtyIssued = Number(it.quantityPlanned) || 0;
    const hasActual = it.quantityActual !== null && it.quantityActual !== undefined;
    const qtyUsed = hasActual ? Number(it.quantityActual) : qtyIssued;
    const qtyUnused = Math.max(0, qtyIssued - qtyUsed);

    const matching = returns.filter((r) => matchReturnToItem(String(r.item || ""), description));
    matching.forEach((r) => matchedReturnIds.add(r.id));

    const qtyAlreadyReturned = matching
      .filter((r) => r.acknowledgedAt)
      .reduce((s: number, r: any) => s + (Number(r.qtyReturned) || 0), 0);

    const pending = matching.find((r) => !r.acknowledgedAt);
    const pendingQty = pending ? Number(pending.qtyReturned) || 0 : 0;
    const maxReturnable = Math.max(0, qtyUnused - qtyAlreadyReturned);

    // Show line if there is unused stock remaining or a pending ack for this item
    if (maxReturnable <= 0 && !pending) continue;

    lines.push({
      key: `item-${it.id}`,
      kind: "job_item",
      itemLabel: description,
      qtyIssued,
      qtyUsed,
      qtyUnused,
      qtyAlreadyReturned,
      maxReturnable,
      returnQty: maxReturnable > 0 ? maxReturnable : 0,
      pendingReturnId: pending?.id,
      pendingQty,
      jobItemId: it.id,
      include: maxReturnable > 0 || Boolean(pending),
    });
  }

  // Orphan pending returns (tech-filed, not matched to a line item)
  for (const r of returns) {
    if (r.acknowledgedAt || matchedReturnIds.has(r.id)) continue;
    const qty = Number(r.qtyReturned) || 0;
    lines.push({
      key: `pending-${r.id}`,
      kind: "pending_return",
      itemLabel: String(r.item || "Returned item"),
      qtyIssued: qty,
      qtyUsed: 0,
      qtyUnused: qty,
      qtyAlreadyReturned: 0,
      maxReturnable: qty,
      returnQty: qty,
      pendingReturnId: r.id,
      pendingQty: qty,
      include: true,
    });
  }

  return lines;
}

export default function RecordStockReturnDrawer({
  isOpen,
  onClose,
  job,
  storekeeperName,
  onSuccess,
}: RecordStockReturnDrawerProps) {
  const [lines, setLines] = useState<ReturnLineState[]>([]);
  const [adHocItem, setAdHocItem] = useState("");
  const [adHocQty, setAdHocQty] = useState("1");
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen && job) {
      setLines(buildLines(job));
      setAdHocItem("");
      setAdHocQty("1");
      setShowAdHoc(false);
      setNotes("");
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen, job]);

  const selectedCount = useMemo(
    () => lines.filter((l) => l.include && (l.returnQty > 0 || l.pendingReturnId)).length,
    [lines]
  );

  const updateLine = (key: string, patch: Partial<ReturnLineState>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (typeof patch.returnQty === "number") {
          next.returnQty = Math.min(Math.max(0, patch.returnQty), l.maxReturnable || patch.returnQty);
        }
        return next;
      })
    );
  };

  const handleConfirm = async () => {
    if (!job) return;
    const actionable = lines.filter((l) => l.include && (l.returnQty > 0 || l.pendingReturnId));
    const hasAdHoc = adHocItem.trim() && Number(adHocQty) > 0;
    if (actionable.length === 0 && !hasAdHoc) {
      setErrorMsg("Select at least one line with a return quantity or specify an unlisted item.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");

      let acknowledged = 0;
      let recorded = 0;

      for (const line of actionable) {
        // Prefer acknowledge path (restock + reverse COGS) for pending tech returns
        if (line.pendingReturnId) {
          const res = await fetch("/api/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "acknowledge_return",
              stockReturnId: line.pendingReturnId,
              storeKeeperName: storekeeperName,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Failed to acknowledge return for ${line.itemLabel}`);
          }
          acknowledged += 1;

          // If storekeeper returns more than the pending tech qty, record the extra
          const extra = Math.max(0, Number(line.returnQty) - Number(line.pendingQty || 0));
          if (extra > 0 && line.kind === "job_item") {
            const resExtra = await fetch(`/api/jobs/${job.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "record_stock_return",
                technicianId: job.assignedTechnicianId,
                item: line.itemLabel,
                jobItemId: line.jobItemId,
                quantity: extra,
                notes: notes || undefined,
                actor: storekeeperName,
              }),
            });
            if (!resExtra.ok) {
              const err = await resExtra.json().catch(() => ({}));
              throw new Error(err.error || `Failed to record extra return for ${line.itemLabel}`);
            }
            recorded += 1;
          }
          continue;
        }

        if (line.returnQty > 0) {
          const res = await fetch(`/api/jobs/${job.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "record_stock_return",
              technicianId: job.assignedTechnicianId,
              item: line.itemLabel,
              jobItemId: line.jobItemId,
              quantity: Number(line.returnQty),
              notes: notes || undefined,
              actor: storekeeperName,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Failed to record return for ${line.itemLabel}`);
          }
          recorded += 1;
        }
      }

      if (hasAdHoc) {
        const resAdHoc = await fetch(`/api/jobs/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record_stock_return",
            technicianId: job.assignedTechnicianId,
            item: adHocItem.trim(),
            quantity: Number(adHocQty),
            notes: notes || undefined,
            actor: storekeeperName,
          }),
        });
        if (!resAdHoc.ok) {
          const err = await resAdHoc.json().catch(() => ({}));
          throw new Error(err.error || `Failed to record return for ${adHocItem}`);
        }
        recorded += 1;
      }

      realtimeSync.publish("STOCK_RETURN_ACKNOWLEDGED", {
        actor: storekeeperName,
        message: `${storekeeperName} recorded unused stock return for Job #${job.jobNumber}`,
        payload: { jobId: job.id, acknowledged, recorded },
      });

      setSuccessMsg(
        `Return recorded. ${acknowledged ? `${acknowledged} acknowledged` : ""}${
          acknowledged && recorded ? ", " : ""
        }${recorded ? `${recorded} new return line(s)` : ""}. Warehouse restocked & COGS reversed.`
      );
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to record stock return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const jobNumber = job?.jobNumber || "—";
  const techName = job?.assignedTechnician?.name || "Technician";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-xl"
      title={
        <span className="inline-flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-700" />
          Record Unused Stock Return
        </span>
      }
      subtitle={
        <span>
          Job <strong className="font-mono text-[#18181B]">#{jobNumber}</strong> · Tech:{" "}
          <strong className="text-[#18181B]">{techName}</strong>
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-[11px] text-[#71717A]">
            {selectedCount > 0
              ? `${selectedCount} line${selectedCount === 1 ? "" : "s"} selected`
              : (adHocItem.trim() ? "1 unlisted item entered" : "No lines selected")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || (selectedCount === 0 && (!adHocItem.trim() || !Number(adHocQty)))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? "Recording…" : "Confirm return"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-950 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-700" />
            Storekeeper physical check-in
          </p>
          <p>
            Confirm unused materials returned by the technician. Matching warehouse stock is restocked and
            COGS is reversed via the acknowledge path.
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px]">
            {successMsg}
          </div>
        )}

        {lines.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-[#E4E4E7] rounded-xl bg-[#FAFAFA]">
            <Package className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
            <p className="font-semibold text-[#18181B] text-sm">No returnable stock on this job</p>
            <p className="text-[11px] text-[#71717A] mt-1 max-w-xs mx-auto">
              There is no unused quantity and no pending technician returns waiting for acknowledgement.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[auto_1fr_64px_64px_72px_88px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
              <span></span>
              <span>Item</span>
              <span className="text-right">Issued</span>
              <span className="text-right">Used</span>
              <span className="text-right">Unused</span>
              <span className="text-right">Return qty</span>
            </div>

            {lines.map((line) => (
              <div
                key={line.key}
                className={`rounded-lg border p-2.5 transition ${
                  line.include
                    ? "border-blue-200 bg-white shadow-2xs"
                    : "border-[#E4E4E7] bg-[#FAFAFA] opacity-70"
                }`}
              >
                <div className="grid grid-cols-[auto_1fr_64px_64px_72px_88px] gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={line.include}
                    onChange={(e) => updateLine(line.key, { include: e.target.checked })}
                    className="rounded border-[#D4D4D8] text-blue-600 focus:ring-blue-600"
                    aria-label={`Include ${line.itemLabel}`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#18181B] truncate" title={line.itemLabel}>
                      {line.itemLabel}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {line.pendingReturnId && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Pending tech return · {line.pendingQty}
                        </span>
                      )}
                      {line.qtyAlreadyReturned > 0 && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                          Already returned · {line.qtyAlreadyReturned}
                        </span>
                      )}
                      {line.kind === "pending_return" && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                          Tech-filed return
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-right font-mono text-[#3F3F46]">{line.qtyIssued}</span>
                  <span className="text-right font-mono text-[#3F3F46]">{line.qtyUsed}</span>
                  <span className="text-right font-mono font-bold text-purple-800">{line.qtyUnused}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    max={line.maxReturnable}
                    disabled={!line.include || line.kind === "pending_return"}
                    value={line.returnQty}
                    onChange={(e) =>
                      updateLine(line.key, { returnQty: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-[#F4F4F5] disabled:bg-[#E4E4E7] p-1.5 rounded-md border border-[#D4D4D8] font-mono font-bold text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ad-hoc unlisted item return option */}
        <div className="pt-2 border-t border-[#E4E4E7]">
          {!showAdHoc ? (
            <button
              type="button"
              onClick={() => setShowAdHoc(true)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
            >
              + Return unlisted / custom item
            </button>
          ) : (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-950">Unlisted / Custom Returned Item</span>
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
                  <label className="text-[10px] font-semibold text-blue-900 block mb-0.5">Item Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Copper Pipe 1/2' Roll"
                    value={adHocItem}
                    onChange={(e) => setAdHocItem(e.target.value)}
                    className="w-full bg-white p-2 rounded-md border border-blue-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-blue-900 block mb-0.5">Qty *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder="1"
                    value={adHocQty}
                    onChange={(e) => setAdHocQty(e.target.value)}
                    className="w-full bg-white p-2 rounded-md border border-blue-200 font-mono font-bold text-xs text-right focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="font-semibold text-[#18181B] block mb-1">Condition / verification notes</label>
          <input
            type="text"
            placeholder="e.g. Unopened box, verified in Central Warehouse"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
      </div>
    </SideDrawer>
  );
}
