"use client";

import React, { useEffect, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Package, AlertTriangle, Check, AlertCircle } from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";

interface IssueWarehouseStockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  reqItem?: { id?: string; item?: string; qtyRequested?: number } | null;
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
  isStorekeeper: propIsStorekeeper,
}: IssueWarehouseStockDrawerProps) {
  const { activeRole, currentRole, hasPermission } = useRole();
  const isStorekeeper =
    propIsStorekeeper !== undefined
      ? propIsStorekeeper
      : activeRole === "storekeeper" ||
        currentRole === "storekeeper" ||
        !hasPermission("inventory.view_costs");
  const [warehouseProducts, setWarehouseProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [issueQuantity, setIssueQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    if (reqItem) {
      setIssueQuantity(String(reqItem.qtyRequested || 1));
    } else {
      setIssueQuantity("1");
    }

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const res = await fetch("/api/inventory");
        const data = await res.json();
        if (Array.isArray(data)) {
          setWarehouseProducts(data);
          if (reqItem?.item) {
            const reqSearch = reqItem.item.toLowerCase();
            const match = data.find(
              (p: any) =>
                p.name?.toLowerCase().includes(reqSearch) ||
                reqSearch.includes(p.name?.toLowerCase() || "") ||
                p.sku?.toLowerCase().includes(reqSearch)
            );
            if (match) {
              setSelectedProductId(match.id);
            } else if (data.length > 0) {
              setSelectedProductId(data[0].id);
            }
          } else if (data.length > 0) {
            setSelectedProductId(data[0].id);
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
  }, [isOpen, reqItem]);

  const selectedProduct = warehouseProducts.find((p) => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !issueQuantity || Number(issueQuantity) <= 0) {
      setErrorMsg("Please select a product and valid quantity.");
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
          quantity: Number(issueQuantity),
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
            disabled={isSubmitting || loadingProducts || warehouseProducts.length === 0}
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
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Fulfilling Material Request
              </span>
              <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded-full font-mono">
                Req Qty: {reqItem.qtyRequested}
              </span>
            </div>
            <p className="text-[11px] text-amber-900 mt-0.5">
              Requested Item: <strong>{reqItem.item}</strong>
            </p>
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
            <div>
              <label className="font-semibold text-[#18181B] block mb-1">
                Select Warehouse Product *
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
              >
                {warehouseProducts.length === 0 ? (
                  <option value="">No products in warehouse</option>
                ) : (
                  warehouseProducts.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || "N/A"}) — Stock: {p.stockQuantity} {p.unitOfMeasure || "units"}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedProduct && (
              <div className="p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg flex items-center justify-between text-[11px]">
                <div>
                  <span className="text-[#71717A] block">Available in Central Warehouse:</span>
                  <span className="font-mono font-bold text-[#18181B] text-sm">
                    {selectedProduct.stockQuantity} {selectedProduct.unitOfMeasure || "units"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#71717A] block">Unit Cost:</span>
                  {isStorekeeper ? (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono inline-block mt-0.5">
                      Cost Masked
                    </span>
                  ) : (
                    <span className="font-mono font-semibold text-[#18181B]">
                      PKR {selectedProduct.costPrice || selectedProduct.unitPrice || 0}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="font-semibold text-[#18181B] block mb-1">
                Quantity to Issue *
              </label>
              <input
                type="number"
                min="1"
                required
                value={issueQuantity}
                onChange={(e) => setIssueQuantity(e.target.value)}
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-950 space-y-1.5 leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                <Package className="w-3.5 h-3.5 text-amber-700" />
                Ledger & Inventory Action Summary:
              </p>
              <p>• Central warehouse physical balance will be immediately deducted.</p>
              <p>• Stock ledger entry and automated COGS double-entry will be posted to GL.</p>
              <p>• Material is allocated to Job #{job?.jobNumber} and marked fulfilled in dispatch queue.</p>
            </div>
          </form>
        )}
      </div>
    </SideDrawer>
  );
}
