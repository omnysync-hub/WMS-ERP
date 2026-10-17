"use client";

import React, { useState, useEffect, useMemo } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowRightLeft,
  Building,
  MapPin,
  Boxes,
  Truck,
  AlertCircle,
  CheckCircle2,
  Package,
} from "lucide-react";

interface WarehouseTransferDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  branches: any[];
  products: any[];
  defaultFromBranch?: string;
  defaultToBranch?: string;
  defaultProductId?: string;
  onTransferCompleted: (updatedBranches: any[]) => void;
}

export default function WarehouseTransferDrawer({
  isOpen,
  onClose,
  branches = [],
  products = [],
  defaultFromBranch,
  defaultToBranch,
  defaultProductId,
  onTransferCompleted,
}: WarehouseTransferDrawerProps) {
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [challanNumber, setChallanNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setQuantity("");
      setNotes("");
      setChallanNumber(`TRF-${Date.now().toString().slice(-5)}`);

      const initialFrom = defaultFromBranch || branches[0]?.name || "";
      setFromBranch(initialFrom);

      const otherBranch = branches.find((b) => b.name !== initialFrom) || branches[1] || branches[0];
      setToBranch(defaultToBranch || otherBranch?.name || "");

      if (defaultProductId) {
        setProductId(defaultProductId);
      } else if (products.length > 0 && !productId) {
        setProductId(products[0].id);
      }
    }
  }, [isOpen, defaultFromBranch, defaultToBranch, defaultProductId, branches, products]);

  const sourceBranchObj = useMemo(() => {
    return branches.find((b) => b.name === fromBranch) || branches[0];
  }, [branches, fromBranch]);

  const destBranchObj = useMemo(() => {
    return branches.find((b) => b.name === toBranch) || branches[1] || branches[0];
  }, [branches, toBranch]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId);
  }, [products, productId]);

  useEffect(() => {
    if (destBranchObj) {
      const existingLoc = destBranchObj.itemLocations?.[productId] || destBranchObj.locations?.[0] || "Main Bay";
      setDestinationLocation(existingLoc);
    }
  }, [destBranchObj, productId]);

  const getStockInBranch = (branch: any, product: any): number => {
    if (!branch || !product) return 0;
    if (branch.customStocks && branch.customStocks[product.id] !== undefined) {
      return branch.customStocks[product.id];
    }
    if (branch.isCentral) {
      return product.stockQuantity || 0;
    }
    const ratio = branch.stockRatio !== undefined ? branch.stockRatio : 0.25;
    return Math.max(0, Math.round((product.stockQuantity || 0) * ratio));
  };

  const availableSourceStock = useMemo(() => {
    return getStockInBranch(sourceBranchObj, selectedProduct);
  }, [sourceBranchObj, selectedProduct]);

  const destCurrentStock = useMemo(() => {
    return getStockInBranch(destBranchObj, selectedProduct);
  }, [destBranchObj, selectedProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);

    if (!productId) {
      setErrorMsg("Please select an inventory item to transfer.");
      return;
    }
    if (fromBranch === toBranch) {
      setErrorMsg("Source and destination warehouses cannot be the same.");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg("Transfer quantity must be greater than 0.");
      return;
    }
    if (qtyNum > availableSourceStock) {
      setErrorMsg(
        `Insufficient stock at ${fromBranch}. Available: ${availableSourceStock} ${selectedProduct?.unit || "units"}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "branch_transfer",
          productId,
          quantity: qtyNum,
          fromBranch,
          toBranch,
          challanNumber: challanNumber || `TRF-${Date.now().toString().slice(-4)}`,
          notes: `${notes} (Target Bin: ${destinationLocation || "General"})`.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to dispatch branch transfer");
      }

      // Update both source and destination branches
      const updatedBranches = branches.map((b) => {
        if (b.name === fromBranch) {
          const current = getStockInBranch(b, selectedProduct);
          return {
            ...b,
            customStocks: {
              ...(b.customStocks || {}),
              [productId]: Math.max(0, current - qtyNum),
            },
          };
        }
        if (b.name === toBranch) {
          const current = getStockInBranch(b, selectedProduct);
          return {
            ...b,
            customStocks: {
              ...(b.customStocks || {}),
              [productId]: current + qtyNum,
            },
            itemLocations: {
              ...(b.itemLocations || {}),
              [productId]: destinationLocation || b.locations?.[0] || "Main Storage Bay",
            },
          };
        }
        return b;
      });

      onTransferCompleted(updatedBranches);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Dispatch Inter-Branch Stock Transfer"
      subtitle="Transfer inventory materials, spare parts, and tools between regional warehouse hubs"
      width="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#18181B]">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Source and Destination Warehouses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#18181B] block mb-1">Source Warehouse (From) *</label>
            <select
              value={fromBranch}
              onChange={(e) => setFromBranch(e.target.value)}
              className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[#18181B] block mb-1">Destination Warehouse (To) *</label>
            <select
              value={toBranch}
              onChange={(e) => setToBranch(e.target.value)}
              className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name} disabled={b.name === fromBranch}>
                  {b.name} ({b.city}) {b.name === fromBranch ? "(Source)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Selection */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Select Item to Transfer *</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
            required
          >
            <option value="">-- Choose Item --</option>
            {products
              .filter((p) => p.unit !== "service" && p.unit !== "visit" && p.unit !== "job")
              .map((p) => {
                const stockAtSource = getStockInBranch(sourceBranchObj, p);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.sku}] — Avail in {fromBranch}: {stockAtSource} {p.unit || "unit"}
                  </option>
                );
              })}
          </select>
        </div>

        {/* Live Availability Comparison */}
        {selectedProduct && (
          <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#EDEDED] grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                Available at {fromBranch}:
              </span>
              <p
                className={`text-sm font-bold font-mono mt-0.5 ${
                  availableSourceStock > 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {availableSourceStock} {selectedProduct.unit || "units"}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                Current at {toBranch}:
              </span>
              <p className="text-sm font-bold font-mono text-[#18181B] mt-0.5">
                {destCurrentStock} {selectedProduct.unit || "units"}
              </p>
            </div>
          </div>
        )}

        {/* Quantity and Challan */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#18181B] block mb-1">Transfer Quantity *</label>
            <input
              type="number"
              min="1"
              max={availableSourceStock || undefined}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="font-bold text-[#18181B] block mb-1">Gate Pass / Challan #</label>
            <input
              type="text"
              value={challanNumber}
              onChange={(e) => setChallanNumber(e.target.value)}
              placeholder="e.g. TRF-2026-09"
              className="w-full h-9 px-3 font-mono bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Destination Storage Bin */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">
            Target Bin / Storage Location in {toBranch}
          </label>
          <select
            value={destinationLocation}
            onChange={(e) => setDestinationLocation(e.target.value)}
            className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold text-[#18181B] focus:outline-hidden"
          >
            {(destBranchObj?.locations || ["Main Storage Bay"]).map((loc: string) => (
              <option key={loc} value={loc}>
                📍 {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle & Delivery Notes */}
        <div>
          <label className="font-bold text-[#18181B] block mb-1">Dispatch Vehicle, Driver & Cargo Ref</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Suzuki Carry #LEG-4820, Driver: Aslam (Cell: 0301-8849201)"
            className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs text-[#18181B] focus:outline-hidden"
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
            disabled={isSubmitting || !productId || !quantity || Number(quantity) > availableSourceStock}
            className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-zinc-300 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            {isSubmitting ? "Dispatching Transfer..." : "Confirm & Dispatch Transfer"}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
