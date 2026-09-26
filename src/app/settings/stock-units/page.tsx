"use client";

import React, { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Edit2,
  Trash2,
} from "lucide-react";

interface StockUnit {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

const DEFAULT_UNITS: StockUnit[] = [
  {
    id: "unit-pcs",
    name: "Pieces",
    status: "Active",
  },
];

const UNWANTED_PRESET_IDS = new Set([
  "unit-cyl",
  "unit-kg",
  "unit-mtr",
  "unit-ft",
  "unit-roll",
  "unit-box",
  "unit-set",
  "unit-ltr",
]);

export default function StockUnitsPage() {
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StockUnit | null>(null);

  // Form State - Single simple unit input
  const [unitInput, setUnitInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("workman_stock_units");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out unwanted complex preset units
        const filtered = (parsed as any[])
          .filter((u) => !UNWANTED_PRESET_IDS.has(u.id))
          .map((u) => ({
            id: u.id,
            name: u.name || u.code || "Unit",
            status: (u.status || "Active") as "Active" | "Inactive",
          }));
        const finalUnits = filtered.length > 0 ? filtered : DEFAULT_UNITS;
        setUnits(finalUnits);
        localStorage.setItem("workman_stock_units", JSON.stringify(finalUnits));
      } catch {
        setUnits(DEFAULT_UNITS);
      }
    } else {
      setUnits(DEFAULT_UNITS);
      localStorage.setItem("workman_stock_units", JSON.stringify(DEFAULT_UNITS));
    }
  }, []);

  const saveUnits = (newUnits: StockUnit[]) => {
    setUnits(newUnits);
    localStorage.setItem("workman_stock_units", JSON.stringify(newUnits));
  };

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setUnitInput("");
    setShowModal(true);
  };

  const handleOpenEdit = (unit: StockUnit) => {
    setEditingUnit(unit);
    setUnitInput(unit.name);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUnit = unitInput.trim();
    if (!cleanUnit) {
      return alert("Please enter a unit");
    }

    const formattedName = cleanUnit.charAt(0).toUpperCase() + cleanUnit.slice(1);

    if (editingUnit) {
      // Update
      const updated = units.map((u) => {
        if (u.id === editingUnit.id) {
          return {
            ...u,
            name: formattedName,
          };
        }
        return u;
      });
      saveUnits(updated);
      setNotification(`Stock Unit '${formattedName}' updated successfully`);
    } else {
      // Create
      if (units.some((u) => u.name.toLowerCase() === cleanUnit.toLowerCase())) {
        return alert(`A unit '${cleanUnit}' already exists`);
      }
      const newUnit: StockUnit = {
        id: `unit-${Date.now()}`,
        name: formattedName,
        status: "Active",
      };
      saveUnits([...units, newUnit]);
      setNotification(`Stock Unit '${formattedName}' added successfully`);
    }

    setShowModal(false);
  };

  const handleDeleteUnit = (unit: StockUnit) => {
    if (!confirm(`Are you sure you want to remove unit '${unit.name}'?`)) return;
    const updated = units.filter((u) => u.id !== unit.id);
    saveUnits(updated);
    setNotification(`Stock Unit '${unit.name}' deleted successfully`);
  };

  const handleToggleStatus = (id: string) => {
    const updated = units.map((u) => {
      if (u.id === id) {
        return {
          ...u,
          status: (u.status === "Active" ? "Inactive" : "Active") as "Active" | "Inactive",
        };
      }
      return u;
    });
    saveUnits(updated);
  };

  const filteredUnits = units.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Stock Units" },
        ]}
        title="Stock Units of Measure (UOM)"
        subtitle="Manage measurement units for inventory, materials, and services"
        actions={
          <button
            onClick={handleOpenAdd}
            className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Unit
          </button>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            onClick={() => setNotification("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Units Table Card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search units..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <span className="text-xs font-mono text-[#71717A]">
            Showing {filteredUnits.length} of {units.length} units
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                <th className="py-3 px-4 w-16 text-center">#</th>
                <th className="py-3 px-4">Unit Name</th>
                <th className="py-3 px-4 text-center w-28">Status</th>
                <th className="py-3 px-4 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7] text-[#18181B]">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-[#71717A]">
                    No stock units found. Click &quot;Add New Unit&quot; to create one.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u, index) => (
                  <tr key={u.id} className="hover:bg-[#FAFAFA] transition">
                    <td className="py-3 px-4 text-center font-mono text-[#71717A]">
                      {index + 1}
                    </td>

                    <td className="py-3 px-4 font-semibold text-[#18181B] text-sm">
                      {u.name}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border font-mono ${
                          u.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Edit Unit Name"
                          className="p-1.5 rounded-lg text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          title={u.status === "Active" ? "Deactivate Unit" : "Activate Unit"}
                          className={`text-[11px] px-2 py-1 rounded-md border font-medium transition ${
                            u.status === "Active"
                              ? "text-zinc-600 hover:text-zinc-900 border-zinc-200 hover:bg-zinc-100"
                              : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                          }`}
                        >
                          {u.status === "Active" ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleDeleteUnit(u)}
                          title="Delete Unit"
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT UNIT SIDE DRAWER */}
      <SideDrawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUnit ? "Edit Stock Unit" : "Add Stock Unit"}
        subtitle="Configure physical measurement unit for catalog items and jobs"
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs font-semibold text-[#71717A] hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!unitInput.trim()}
              className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {editingUnit ? "Update Unit" : "Add Unit"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1.5">
              Unit Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Pieces, Box, Packet, Meter, Roll"
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              className="w-full bg-[#FAFAFA] border border-[#D4D4D8] rounded-lg px-3.5 py-2.5 text-xs text-[#18181B] font-medium focus:ring-2 focus:ring-[#0D7A5F] focus:bg-white focus:outline-none transition shadow-2xs"
            />
            <p className="text-[11px] text-[#71717A] mt-2">
              This unit of measurement will be selectable across procurement, inventory restocks, and material allocations.
            </p>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}
