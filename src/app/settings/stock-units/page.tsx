"use client";

import React, { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Sliders,
  Scale,
  Ruler,
  Boxes,
  Flame,
  Check,
  Edit2,
  Trash2,
  ShieldCheck,
  Info,
} from "lucide-react";

interface StockUnit {
  id: string;
  code: string;
  name: string;
  category: "Count" | "Weight" | "Length" | "Volume";
  decimals: number;
  isDefault: boolean;
  status: "Active" | "Inactive";
  description: string;
}

const DEFAULT_UNITS: StockUnit[] = [
  {
    id: "unit-pcs",
    code: "pcs",
    name: "Pieces",
    category: "Count",
    decimals: 0,
    isDefault: true,
    status: "Active",
    description: "Standard discrete single-item units (Capacitors, Contactors, Relays)",
  },
  {
    id: "unit-cyl",
    code: "cyl",
    name: "Cylinders",
    category: "Volume",
    decimals: 2,
    isDefault: false,
    status: "Active",
    description: "Refrigerant gas cylinders (R22, R410A, R32, R134a)",
  },
  {
    id: "unit-kg",
    code: "kg",
    name: "Kilograms",
    category: "Weight",
    decimals: 2,
    isDefault: false,
    status: "Active",
    description: "Bulk chemicals, loose refrigerant charging, and welding filler",
  },
  {
    id: "unit-mtr",
    code: "mtr",
    name: "Meters",
    category: "Length",
    decimals: 1,
    isDefault: false,
    status: "Active",
    description: "Copper pipe tubing, drainage pipes, and multi-core cabling",
  },
  {
    id: "unit-ft",
    code: "ft",
    name: "Feet",
    category: "Length",
    decimals: 1,
    isDefault: false,
    status: "Active",
    description: "Insulation piping, flexible ducting, and electrical wire runs",
  },
  {
    id: "unit-roll",
    code: "roll",
    name: "Rolls",
    category: "Count",
    decimals: 0,
    isDefault: false,
    status: "Active",
    description: "PVC insulation tape, duct wrapping tape, and cable coils",
  },
  {
    id: "unit-box",
    code: "box",
    name: "Cartons / Boxes",
    category: "Count",
    decimals: 0,
    isDefault: false,
    status: "Active",
    description: "Master bulk cartons containing individual parts or screws",
  },
  {
    id: "unit-set",
    code: "set",
    name: "Sets",
    category: "Count",
    decimals: 0,
    isDefault: false,
    status: "Active",
    description: "Complete pairing assemblies (Indoor + Outdoor bracket pairs, flaring set)",
  },
  {
    id: "unit-ltr",
    code: "ltr",
    name: "Liters",
    category: "Volume",
    decimals: 2,
    isDefault: false,
    status: "Active",
    description: "Vacuum pump lubrication oil, coil chemical cleaner wash",
  },
];

export default function StockUnitsPage() {
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [notification, setNotification] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StockUnit | null>(null);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<StockUnit["category"]>("Count");
  const [formDecimals, setFormDecimals] = useState("0");
  const [formDescription, setFormDescription] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("workman_stock_units");
    if (saved) {
      try {
        setUnits(JSON.parse(saved));
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
    setFormCode("");
    setFormName("");
    setFormCategory("Count");
    setFormDecimals("0");
    setFormDescription("");
    setFormIsDefault(false);
    setShowModal(true);
  };

  const handleOpenEdit = (unit: StockUnit) => {
    setEditingUnit(unit);
    setFormCode(unit.code);
    setFormName(unit.name);
    setFormCategory(unit.category);
    setFormDecimals(String(unit.decimals));
    setFormDescription(unit.description);
    setFormIsDefault(unit.isDefault);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toLowerCase();
    if (!cleanCode || !formName.trim()) {
      return alert("Code and Name are required");
    }

    if (editingUnit) {
      // Update
      const updated = units.map((u) => {
        if (u.id === editingUnit.id) {
          return {
            ...u,
            code: cleanCode,
            name: formName.trim(),
            category: formCategory,
            decimals: Number(formDecimals) || 0,
            description: formDescription.trim(),
            isDefault: formIsDefault,
          };
        }
        if (formIsDefault) {
          return { ...u, isDefault: false };
        }
        return u;
      });
      saveUnits(updated);
      setNotification(`Stock Unit '${cleanCode}' updated successfully`);
    } else {
      // Create
      if (units.some((u) => u.code === cleanCode)) {
        return alert(`A unit with code '${cleanCode}' already exists`);
      }
      const newUnit: StockUnit = {
        id: `unit-${cleanCode}-${Date.now().toString().slice(-4)}`,
        code: cleanCode,
        name: formName.trim(),
        category: formCategory,
        decimals: Number(formDecimals) || 0,
        isDefault: formIsDefault,
        status: "Active",
        description: formDescription.trim(),
      };
      const updated = formIsDefault
        ? units.map((u) => ({ ...u, isDefault: false })).concat(newUnit)
        : [...units, newUnit];
      saveUnits(updated);
      setNotification(`Stock Unit '${cleanCode}' created successfully`);
    }

    setShowModal(false);
  };

  const handleSetDefault = (id: string) => {
    const updated = units.map((u) => ({
      ...u,
      isDefault: u.id === id,
    }));
    saveUnits(updated);
    setNotification("Default standard stock unit updated");
  };

  const handleToggleStatus = (id: string) => {
    const updated = units.map((u) => {
      if (u.id === id) {
        if (u.isDefault) {
          alert("Cannot deactivate the system default stock unit");
          return u;
        }
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
    const matchCat = categoryFilter === "all" || u.category === categoryFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.code.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const getCategoryIcon = (cat: StockUnit["category"]) => {
    switch (cat) {
      case "Count":
        return <Boxes className="w-3.5 h-3.5 text-blue-600" />;
      case "Weight":
        return <Scale className="w-3.5 h-3.5 text-emerald-600" />;
      case "Length":
        return <Ruler className="w-3.5 h-3.5 text-amber-600" />;
      case "Volume":
        return <Flame className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Stock Units of Measure" },
        ]}
        title="Stock Units of Measure (UOM)"
        subtitle="Configure physical measurement units, decimal precisions, and cylinder packaging for warehouse & procurement"
        actions={
          <button
            onClick={handleOpenAdd}
            className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Stock Unit
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

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
              Configured Units
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#18181B]">{units.length}</span>
            <span className="text-xs text-[#71717A]">active units</span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-1">Across all materials & procurement catalogs</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
              Default UOM
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#18181B]">
              {units.find((u) => u.isDefault)?.code || "pcs"}
            </span>
            <span className="text-xs text-[#71717A]">
              ({units.find((u) => u.isDefault)?.name || "Pieces"})
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-1">Standard default for new items & jobs</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
              Gas & Volume UOM
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-900">cyl & ltr</span>
            <span className="text-xs text-purple-700">decimals: 2</span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-1">Refrigerant charge & compressor oil</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
              Linear Piping UOM
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Ruler className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-900">mtr & ft</span>
            <span className="text-xs text-amber-700">decimals: 1</span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-1">Copper pipes, drain lines, cable ducting</p>
        </div>
      </div>

      {/* Main Units Table Card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search unit code, name, usage..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            >
              <option value="all">All Categories</option>
              <option value="Count">Count / Pieces (pcs, box, roll)</option>
              <option value="Volume">Gas & Liquid Volume (cyl, ltr)</option>
              <option value="Weight">Weight / Mass (kg)</option>
              <option value="Length">Linear Measurement (mtr, ft)</option>
            </select>
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
                <th className="py-2.5 px-4">Unit Code</th>
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-center">Decimals</th>
                <th className="py-2.5 px-4">Usage & Material Scope</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7] text-[#18181B]">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#71717A]">
                    No stock units matching search.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAFAFA] transition">
                    <td className="py-3 px-4 font-mono font-bold text-sm text-[#0D7A5F] flex items-center gap-2">
                      <span>{u.code}</span>
                      {u.isDefault && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#0D7A5F]/10 text-[#0D7A5F] border border-[#0D7A5F]/30">
                          DEFAULT
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-semibold text-[#18181B]">
                      {u.name}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F4F4F5] border border-[#E4E4E7]">
                        {getCategoryIcon(u.category)}
                        <span>{u.category}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {u.decimals}
                    </td>

                    <td className="py-3 px-4 text-[#71717A] text-[11px] max-w-xs">
                      {u.description}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono ${
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
                        {!u.isDefault && (
                          <button
                            onClick={() => handleSetDefault(u.id)}
                            title="Set as Default Standard"
                            className="p-1 rounded text-[#71717A] hover:text-[#0D7A5F] hover:bg-[#0D7A5F]/10 transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Edit Unit"
                          className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          title={u.status === "Active" ? "Deactivate Unit" : "Activate Unit"}
                          className={`text-[10px] px-2 py-0.5 rounded border transition ${
                            u.status === "Active"
                              ? "text-zinc-600 hover:text-rose-700 hover:border-rose-200"
                              : "text-emerald-700 hover:border-emerald-300"
                          }`}
                        >
                          {u.status === "Active" ? "Disable" : "Enable"}
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

      {/* CREATE / EDIT UNIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h4 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0D7A5F]" />
                  {editingUnit ? `Edit Stock Unit: ${editingUnit.code}` : "Add New Stock Unit of Measure"}
                </h4>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Define code symbol, precision decimals, and material usage scope
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Unit Code (Symbol) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. cyl, pcs, mtr"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono font-bold focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Full Unit Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cylinders, Pieces"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Measurement Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] outline-none"
                  >
                    <option value="Count">Count / Pieces</option>
                    <option value="Volume">Gas & Liquid Volume</option>
                    <option value="Weight">Weight / Mass</option>
                    <option value="Length">Linear Measurement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Decimal Precision *
                  </label>
                  <select
                    value={formDecimals}
                    onChange={(e) => setFormDecimals(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono outline-none"
                  >
                    <option value="0">0 decimals (whole count: pcs, box)</option>
                    <option value="1">1 decimal (0.1: mtr, ft)</option>
                    <option value="2">2 decimals (0.01: kg, cyl, ltr)</option>
                    <option value="3">3 decimals (0.001: precise weight)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Description / Material Usage Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Used for R22, R410A, R32 refrigerant cylinders and gas charging"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="chkDefault"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded text-[#0D7A5F] focus:ring-[#0D7A5F]"
                />
                <label htmlFor="chkDefault" className="text-xs text-[#18181B] cursor-pointer">
                  Set as system default unit for new products and work orders
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold shadow-xs transition"
                >
                  {editingUnit ? "Update Unit" : "Save Stock Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
