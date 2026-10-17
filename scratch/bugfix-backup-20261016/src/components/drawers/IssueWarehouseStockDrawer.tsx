"use client";

import React, { useEffect, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Package, AlertTriangle, Check, AlertCircle } from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";

interface IssueWarehouseStockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  reqItem?: {
    id?: string;
    item?: string;
    productId?: string | null;
    qtyRequested?: number;
    qtyIssued?: number;
    status?: string;
  } | null;
  actor: string;
  onSuccess?: () => void;
  isStorekeeper?: boolean;
}

export default function IssueWarehouseStockDrawer({
  isOpen,
  onClose,
  job,
  reqItem,
  actor,
  onSuccess,
  isStorekeeper: _propIsStorekeeper,
}: IssueWarehouseStockDrawerProps) {
  const [warehouseProducts, setWarehouseProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [issueQuantity, setIssueQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const totalRequested = Number(reqItem?.qtyRequested || 0);
  const alreadyIssued = Number(reqItem?.qtyIssued || 0);
  const remainingNeeded = Math.max(0, totalRequested - alreadyIssued);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const res = await fetch("/api/inventory");
        const data = await res.json();
        if (Array.isArray(data)) {
          setWarehouseProducts(data);
          let matched: any = null;

          if (reqItem?.productId) {
            matched = data.find((p: any) => p.id === reqItem.productId);
          }

          if (!matched && reqItem?.item) {
            const reqSearch = reqItem.item.toLowerCase();
            matched = data.find((p: any) => {
              const sku = (p.sku || "").toLowerCase();
              const name = (p.name || "").toLowerCase();
              return (
                (sku && reqSearch.includes(sku)) ||
                (name && reqSearch.includes(name)) ||
                (name && name.includes(reqSearch))
              );
            });
          }

          if (matched) {
            setSelectedProductId(matched.id);
            const canIssue = remainingNeeded > 0
              ? Math.min(matched.stockQuantity || 0, remainingNeeded)
              : matched.stockQuantity || 1;
            setIssueQuantity(String(Math.max(1, canIssue || 1)));
          } else if (data.length > 0) {
            setSelectedProductId(data[0].id);
            const canIssue = remainingNeeded > 0
              ? Math.min(data[0].stockQuantity || 0, remainingNeeded)
              : data[0].stockQuantity || 1;
            setIssueQuantity(String(Math.max(1, canIssue || 1)));
          }
        }
      } catch (err: any) {
        console.error("Failed loading inventory products", err);
        setErrorMsg("Failed to load inventory catalogue.");
      } finally {
        setLoadingProducts(false);
      }
    }

    loadProducts();
  }, [isOpen, reqItem, remainingNeeded]);

  const selectedProduct = warehouseProducts.find((p) => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(issueQuantity);

    if (!selectedProductId || isNaN(qty) || qty <= 0) {
      setErrorMsg("Please select a valid product and enter a quantity greater than zero.");
      return;
    }

    if (remainingNeeded > 0 && qty > remainingNeeded) {
      setErrorMsg(
        `Cannot issue more than the remaining requested amount (${remainingNeeded} unit${
          remainingNeeded === 1 ? "" : "s"
        } left out of ${totalRequested} requested).`
      );
      return;
    }

    if (selectedProduct && qty > selectedProduct.stockQuantity) {
      setErrorMsg(
        `Insufficient warehouse stock. '${selectedProduct.name}' only has ${selectedProduct.stockQuantity} unit(s) available in Central Warehouse.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_inventory",
          productId: selectedProductId,
          quantity: qty,
          requestId: reqItem?.id,
          actor: actor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to issue inventory");
      }

      realtimeSync.publish("INVENTORY_FULFILLED", {
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianId: job.assignedTechnicianId,
        actor: actor,
        message: `${actor} issued warehouse materials for Job #${job.jobNumber}`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to issue warehouse stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-lg"
      title={
        <span className="inline-flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600" />
          Issue Warehouse Stock
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · Central Warehouse Stock`}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
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
            disabled={
              isSubmitting ||
              loadingProducts ||
              !selectedProduct ||
              selectedProduct.stockQuantity <= 0 ||
              (remainingNeeded > 0 && remainingNeeded <= 0)
            }
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "Issuing..." : "Confirm & Issue Material"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {reqItem && (
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 space-y-2.5">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Fulfilling Material Request
              </span>
              <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded-full font-mono font-bold">
                {alreadyIssued > 0
                  ? `${alreadyIssued}/${totalRequested} Issued`
                  : `Req Qty: ${totalRequested}`}
              </span>
            </div>
            <p className="text-[11px] text-amber-900 mt-0.5 font-medium">
              Requested Item: <strong className="text-amber-950">{reqItem.item}</strong>
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-center">
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <span className="text-[10px] text-[#71717A] block font-medium">Requested</span>
                <span className="text-xs font-mono font-bold text-[#18181B]">{totalRequested}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <span className="text-[10px] text-emerald-700 block font-medium">Issued</span>
                <span className="text-xs font-mono font-bold text-emerald-800">{alreadyIssued}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <span className="text-[10px] text-amber-800 block font-medium">Left / Pending</span>
                <span className="text-xs font-mono font-bold text-amber-900">{remainingNeeded}</span>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loadingProducts ? (
          <div className="py-12 text-center text-xs text-[#71717A] flex flex-col items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            Loading warehouse inventory catalogue...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Automatic Product Card - No dropdown, product comes auto and locked */}
            <div className="p-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
                  Warehouse Product
                </label>
                {selectedProduct && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      selectedProduct.stockQuantity > 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {selectedProduct.stockQuantity > 0 ? "In Stock" : "Out of Stock"}
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-[#18181B]">
                {selectedProduct?.name || reqItem?.item || "Matching Warehouse Product..."}
              </div>
              {selectedProduct?.sku && (
                <div className="text-[11px] text-[#71717A] font-mono">
                  SKU: <span className="font-semibold text-[#18181B]">{selectedProduct.sku}</span>
                </div>
              )}
            </div>

            {/* Warehouse Stock Display (No unit cost, no cost masked) */}
            {selectedProduct && (
              <div className="p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#71717A] font-medium">Available in Central Warehouse:</span>
                <span className="font-mono font-bold text-[#18181B] text-sm">
                  {selectedProduct.stockQuantity} {selectedProduct.unitOfMeasure || "units"}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-[#18181B] block">
                  Quantity to Issue *
                </label>
                {remainingNeeded > 0 && (
                  <span className="text-[10px] text-[#71717A]">
                    Max allowed: <strong className="text-[#18181B] font-mono">{remainingNeeded}</strong>
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                max={remainingNeeded > 0 ? remainingNeeded : undefined}
                required
                value={issueQuantity}
                onChange={(e) => setIssueQuantity(e.target.value)}
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            {/* If warehouse stock is less than remaining needed, show partial issuance advisory */}
            {selectedProduct && selectedProduct.stockQuantity < remainingNeeded && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <p className="font-bold">Partial Stock Issuance</p>
                  <p className="text-[11px]">
                    Warehouse only has <strong>{selectedProduct.stockQuantity}</strong> units in stock out of <strong>{remainingNeeded}</strong> units needed.
                    Issuing <strong>{issueQuantity || 0}</strong> unit(s) will leave the remaining units as <strong>pending</strong> for the technician until additional stock arrives.
                  </p>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </SideDrawer>
  );
}
