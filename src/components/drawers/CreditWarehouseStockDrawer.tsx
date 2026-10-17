"use client";

import React, { useState, useEffect, useMemo } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatCurrency } from "@/lib/utils";
import {
  PackagePlus,
  Building,
  MapPin,
  Boxes,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Search,
} from "lucide-react";

interface CreditWarehouseStockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  branches: any[];
  currentBranchName: string;
  products: any[];
  defaultProductId?: string;
  onStockCredited: (updatedBranches: any[]) => void;
}

export default function CreditWarehouseStockDrawer({
  isOpen,
  onClose,
  branches = [],
  currentBranchName,
  products = [],
  defaultProductId,
  onStockCredited,
}: CreditWarehouseStockDrawerProps) {
  const [selectedBranchName, setSelectedBranchName] = useState(currentBranchName);
  const [productId, setProductId] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("Direct Supplier Receiving");
  const [referenceChallan, setReferenceChallan] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const targetBranch = useMemo(() => {
    return branches.find((b) => b.name === selectedBranchName) || branches[0];
  }, [branches, selectedBranchName]);

  const targetProduct = useMemo(() => {
    return products.find((p) => p.id === productId);
  }, [products, productId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedBranchName(currentBranchName || branches[0]?.name || "");
      setErrorMsg("");
      setQuantity("");
      setNotes("");
      setReferenceChallan(`INB-${Date.now().toString().slice(-5)}`);

      if (defaultProductId) {
        setProductId(defaultProductId);
        const prod = products.find((p) => p.id === defaultProductId);
        if (prod) {
          setUnitCost(String(prod.costPrice || prod.unitPrice || 0));
        }
      } else if (products.length > 0 && !productId) {
        setProductId(products[0].id);
        setUnitCost(String(products[0].costPrice || products[0].unitPrice || 0));
      }
    }
  }, [isOpen, currentBranchName, defaultProductId, products, branches]);

  useEffect(() => {
    if (targetBranch) {
      const existingLoc = targetBranch.itemLocations?.[productId] || targetBranch.locations?.[0] || "Main Storage Bay";
      setLocation(existingLoc);
    }
  }, [targetBranch, productId]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setUnitCost(String(prod.costPrice || prod.unitPrice || 0));
    }
  };

  // Current stock in the selected warehouse
  const currentBranchStock = useMemo(() => {
    if (!targetBranch || !targetProduct) return 0;
    if (targetBranch.customStocks && targetBranch.customStocks[targetProduct.id] !== undefined) {
      return targetBranch.customStocks[targetProduct.id];
    }
    if (targetBranch.isCentral) {
      return targetProduct.stockQuantity || 0;
    }
    const ratio = targetBranch.stockRatio !== undefined ? targetBranch.stockRatio : 0.25;
    return Math.max(0, Math.round((targetProduct.stockQuantity || 0) * ratio));
  }, [targetBranch, targetProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    if (!productId) {
      setErrorMsg("Please select an inventory item to credit.");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg("Quantity must be a positive number greater than 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      // 1. Post to API to increment product stock in database and record stock ledger entry
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stock_adjustment",
          productId,
          quantity: qtyNum,
          type: "increase",
          reason: `${reason} ➔ ${targetBranch.name} (${location || "Main Bay"})`,
          notes: `[Warehouse Restock: ${targetBranch.name} | Bin: ${location || "General"}] Challan #${referenceChallan || "INB"}: ${notes}`.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to credit warehouse stock");
      }

      // 2. Update the target branch's customStocks and itemLocations
      const updatedBranches = branches.map((b) => {
        if (b.id === targetBranch.id) {
          const prevQty =
            b.customStocks?.[productId] !== undefined
              ? b.customStocks[productId]
              : b.isCentral
              ? targetProduct?.stockQuantity || 0
              : Math.max(0, Math.round((targetProduct?.stockQuantity || 0) * (b.stockRatio || 0.25)));

          return {
            ...b,
            customStocks: {
              ...(b.customStocks || {}),
              [productId]: prevQty + qtyNum,
            },
            itemLocations: {
              ...(b.itemLocations || {}),
              [productId]: location || b.locations?.[0] || "Main Bay",
            },
          };
        }
        return b;
      });

      onStockCredited(updatedBranches);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add / Credit Warehouse Stock"
      subtitle="Inbound inventory receipt, supplier restock, or opening stock allocation for branch warehouses"
      width="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#18181B]">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Target Warehouse */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Target Warehouse / Branch *</label>
          <select
            value={selectedBranchName}
            onChange={(e) => setSelectedBranchName(e.target.value)}
            className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name} ({b.city}) — {b.type}
              </option>
            ))}
          </select>
        </div>

        {/* Inventory Item Selection */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Select Inventory Item / SKU *</label>
          <select
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
            required
          >
            <option value="">-- Choose Item --</option>
            {products
              .filter((p) => p.unit !== "service" && p.unit !== "visit" && p.unit !== "job")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.sku}] — Network Total: {p.stockQuantity} {p.unit || "unit"}
                </option>
              ))}
          </select>
        </div>

        {/* Current Warehouse Stock Badge */}
        {targetProduct && (
          <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#71717A]">Current Stock in {targetBranch?.name}:</span>
              <p className="font-bold text-sm text-[#18181B] font-mono mt-0.5">
                {currentBranchStock} {targetProduct.unit || "units"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#71717A]">Network Total (All Hubs):</span>
              <p className="font-bold text-sm text-[#0D7A5F] font-mono mt-0.5">
                {targetProduct.stockQuantity} {targetProduct.unit || "units"}
              </p>
            </div>
          </div>
        )}

        {/* Storage Bin / Location inside this Warehouse */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">
            Storage Bin / Shelf Location in {targetBranch?.name} *
          </label>
          <div className="flex gap-2">
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1 h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
            >
              {(targetBranch?.locations || ["Main Storage Bay"]).map((loc: string) => (
                <option key={loc} value={loc}>
                  📍 {loc}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Or custom bin/rack"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-40 h-9 px-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Quantity & Unit Cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#18181B] block mb-1">Quantity to Credit (+)</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 25"
              className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="font-bold text-[#18181B] block mb-1">Unit Cost (PKR)</label>
            <input
              type="number"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="e.g. 1500"
              className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Credit Reason / Source */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#18181B] block mb-1">Inbound Source / Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 px-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
            >
              <option value="Direct Supplier Receiving">Direct Supplier Receiving</option>
              <option value="Initial Opening Stock">Initial Opening Stock</option>
              <option value="Audit Surplus / Correction">Audit Surplus / Correction</option>
              <option value="Job Return / Unused Material">Job Return / Unused Material</option>
              <option value="Emergency Restock">Emergency Restock</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-[#18181B] block mb-1">Challan / Inbound Doc #</label>
            <input
              type="text"
              value={referenceChallan}
              onChange={(e) => setReferenceChallan(e.target.value)}
              placeholder="e.g. INB-98124"
              className="w-full h-9 px-3 font-mono bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Receiving Notes & Supplier Info</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Received from Haier Official Spares via Bilty #1029..."
            className="w-full p-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EDEDED]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !productId || !quantity}
            className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-zinc-300 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            {isSubmitting ? "Crediting Stock..." : "Confirm & Credit Stock"}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
