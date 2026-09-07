"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Package, AlertCircle } from "lucide-react";

interface AddAssetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetAdded?: () => void;
}

export default function AddAssetDrawer({
  isOpen,
  onClose,
  onAssetAdded,
}: AddAssetDrawerProps) {
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tools & Equipment");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag || !name) {
      setErrorMsg("Asset tag and name are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/hrm/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          tag,
          name,
          category,
          purchaseDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onAssetAdded?.();
      setTag("");
      setName("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Register Company Asset"
      subtitle="Add tools, diagnostic instruments, vehicles, or laptops into company asset registry"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-asset-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <Package className="w-3.5 h-3.5" />
            {isSubmitting ? "Registering..." : "Add to Asset Registry"}
          </button>
        </div>
      }
    >
      <form id="add-asset-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Asset Tag / Barcode Identifier *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. AST-2026-009"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full h-9 px-3 text-xs font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Asset Name & Model Description *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Testo 557s Digital Manifold Kit with Bluetooth"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            >
              <option value="Tools & Equipment">Tools & Equipment</option>
              <option value="HVAC Testing Gauges">HVAC Testing Gauges</option>
              <option value="Refrigeration Equipment">Refrigeration Equipment</option>
              <option value="Company Vehicles">Company Vehicles</option>
              <option value="Laptops & Computing">Laptops & Computing</option>
              <option value="Field Computing">Field Tablets / Computing</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
