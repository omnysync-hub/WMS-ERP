"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import {
  Cpu,
  Tag,
  Layers,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  X,
  ArrowLeft,
  Settings2,
  Info,
  ExternalLink,
  Sparkles,
  Search,
} from "lucide-react";
import SearchableCombobox from "@/components/ui/SearchableCombobox";

const DEFAULT_EQUIPMENT_TYPES = [
  "Split Air Conditioner (Wall Mounted)",
  "Inverter AC (1.0 / 1.5 / 2.0 Ton)",
  "Floor Standing / Tower AC",
  "Cassette Type Air Conditioner",
  "Ducted Split System",
  "Multi-Split / VRF Outdoor & Indoor Unit",
  "Air Handling Unit (AHU) / FCU",
  "Chiller Unit (Air-Cooled / Water-Cooled)",
  "Commercial Package Unit",
  "Cold Storage / Walk-in Freezer",
];

const DEFAULT_BRANDS = [
  "Daikin",
  "O General",
  "Mitsubishi Electric",
  "Carrier",
  "Gree",
  "Haier",
  "Kenwood",
  "Orient",
  "Dawlance",
  "LG",
  "York",
  "Trane",
  "Samsung",
  "Panasonic",
  "Midea",
  "Voltas",
];

const DEFAULT_MODELS = [
  "Inverter Split 1.5 Ton Fairy Series",
  "Inverter Split 1.0 Ton Fairy Series",
  "Inverter Split 2.0 Ton Fairy Series",
  "Floor Standing 2.0 Ton / 4.0 Ton",
  "Cassette 2.0 Ton Inverter",
  "Cassette 4.0 Ton Inverter",
  "Ducted Split 3.0 Ton High Static",
  "VRF Outdoor Condenser Unit 10 HP",
  "AHU / FCU 600 CFM Ducted",
  "Commercial Package Unit 5.0 Ton",
  "Commercial Package Unit 10.0 Ton",
  "Cold Storage Freezer Unit 3HP",
];

const DEFAULT_JOB_TYPES = [
  "Installation & Commissioning",
  "Emergency Repair & Breakdown",
  "Preventive Maintenance Service",
  "AC Gas Recharge & Leakage Repair",
  "Duct Cleaning & Sanitization",
  "Compressor Overhaul & Replacement",
  "System Inspection & Thermostat Audit",
  "Annual Maintenance Contract (AMC)",
];

export default function ProductDropdownSettingsPage() {
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>(DEFAULT_EQUIPMENT_TYPES);
  const [brands, setBrands] = useState<string[]>(DEFAULT_BRANDS);
  const [models, setModels] = useState<string[]>(DEFAULT_MODELS);
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);

  const [newEquip, setNewEquip] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newJobType, setNewJobType] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  // Live interactive preview states for the 3 searchable combobox textboxes
  const [previewEquip, setPreviewEquip] = useState(DEFAULT_EQUIPMENT_TYPES[1]); // Inverter AC (1.0 / 1.5 / 2.0 Ton)
  const [previewBrand, setPreviewBrand] = useState("Gree");
  const [previewModel, setPreviewModel] = useState("Inverter Split 1.5 Ton Fairy Series");

  // Inline editing state
  const [editingCategory, setEditingCategory] = useState<"equip" | "brand" | "model" | "job" | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string>("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedEquip = localStorage.getItem("custom_equipment_types");
      if (savedEquip) setEquipmentTypes(JSON.parse(savedEquip));

      const savedBrands = localStorage.getItem("custom_hvac_brands");
      if (savedBrands) setBrands(JSON.parse(savedBrands));

      const savedModels = localStorage.getItem("custom_hvac_models");
      if (savedModels) setModels(JSON.parse(savedModels));

      const savedJobs = localStorage.getItem("custom_job_types");
      if (savedJobs) setJobTypes(JSON.parse(savedJobs));
    } catch (e) {
      console.error("Failed loading dropdown settings", e);
    }
  }, []);

  const saveSettings = (
    nextEquip = equipmentTypes,
    nextBrands = brands,
    nextModels = models,
    nextJobs = jobTypes
  ) => {
    try {
      localStorage.setItem("custom_equipment_types", JSON.stringify(nextEquip));
      localStorage.setItem("custom_hvac_brands", JSON.stringify(nextBrands));
      localStorage.setItem("custom_hvac_models", JSON.stringify(nextModels));
      localStorage.setItem("custom_job_types", JSON.stringify(nextJobs));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("custom_job_types_updated", { detail: nextJobs }));
      window.dispatchEvent(new CustomEvent("custom_hvac_models_updated", { detail: nextModels }));
      setSavedNotice("Settings saved! Searchable textboxes and dropdowns synced across the system.");
      setTimeout(() => setSavedNotice(""), 4000);
    } catch (e) {
      console.error("Failed saving dropdown settings", e);
    }
  };

  const handleStartEdit = (category: "equip" | "brand" | "model" | "job", item: string) => {
    setEditingCategory(category);
    setEditingOriginal(item);
    setEditingValue(item);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingOriginal("");
    setEditingValue("");
  };

  const handleSaveEdit = (category: "equip" | "brand" | "model" | "job", original: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;

    if (category === "equip") {
      const next = equipmentTypes.map((x) => (x === original ? trimmed : x));
      setEquipmentTypes(next);
      saveSettings(next, brands, models, jobTypes);
    } else if (category === "brand") {
      const next = brands.map((x) => (x === original ? trimmed : x));
      setBrands(next);
      saveSettings(equipmentTypes, next, models, jobTypes);
    } else if (category === "model") {
      const next = models.map((x) => (x === original ? trimmed : x));
      setModels(next);
      saveSettings(equipmentTypes, brands, next, jobTypes);
    } else if (category === "job") {
      const next = jobTypes.map((x) => (x === original ? trimmed : x));
      setJobTypes(next);
      saveSettings(equipmentTypes, brands, models, next);
    }

    handleCancelEdit();
  };

  // Add handlers
  const handleAddEquip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquip.trim() || equipmentTypes.includes(newEquip.trim())) return;
    const next = [...equipmentTypes, newEquip.trim()];
    setEquipmentTypes(next);
    setNewEquip("");
    saveSettings(next, brands, models, jobTypes);
  };

  const handleDeleteEquip = (item: string) => {
    const next = equipmentTypes.filter((x) => x !== item);
    setEquipmentTypes(next);
    saveSettings(next, brands, models, jobTypes);
  };

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim() || brands.includes(newBrand.trim())) return;
    const next = [...brands, newBrand.trim()];
    setBrands(next);
    setNewBrand("");
    saveSettings(equipmentTypes, next, models, jobTypes);
  };

  const handleDeleteBrand = (item: string) => {
    const next = brands.filter((x) => x !== item);
    setBrands(next);
    saveSettings(equipmentTypes, next, models, jobTypes);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModel.trim() || models.includes(newModel.trim())) return;
    const next = [...models, newModel.trim()];
    setModels(next);
    setNewModel("");
    saveSettings(equipmentTypes, brands, next, jobTypes);
  };

  const handleDeleteModel = (item: string) => {
    const next = models.filter((x) => x !== item);
    setModels(next);
    saveSettings(equipmentTypes, brands, next, jobTypes);
  };

  const handleAddJobType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobType.trim() || jobTypes.includes(newJobType.trim())) return;
    const next = [...jobTypes, newJobType.trim()];
    setJobTypes(next);
    setNewJobType("");
    saveSettings(equipmentTypes, brands, models, next);
  };

  const handleDeleteJobType = (item: string) => {
    const next = jobTypes.filter((x) => x !== item);
    setJobTypes(next);
    saveSettings(equipmentTypes, brands, models, next);
  };

  const handleResetDefaults = () => {
    if (!confirm("Reset all dropdown options to HVAC industry standard defaults?")) return;
    setEquipmentTypes(DEFAULT_EQUIPMENT_TYPES);
    setBrands(DEFAULT_BRANDS);
    setModels(DEFAULT_MODELS);
    setJobTypes(DEFAULT_JOB_TYPES);
    saveSettings(DEFAULT_EQUIPMENT_TYPES, DEFAULT_BRANDS, DEFAULT_MODELS, DEFAULT_JOB_TYPES);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in">
      <PageHeader
        moduleName="Settings"
        currentView="Product, Brand & Model Dropdown Options"
        primaryAction={{
          label: "Reset to Defaults",
          onClick: handleResetDefaults,
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings Hub
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/job-types"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-white border border-[#EDEDED] text-[#0D7A5F] hover:bg-emerald-50 rounded-lg shadow-2xs transition"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Job Nature / Types Manager</span>
          </Link>
          <span className="text-xs text-[#71717A] bg-white border border-[#EDEDED] px-3 py-1 rounded-full shadow-2xs font-mono">
            Searchable Textbox Engine Active
          </span>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Info Notice */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 text-xs text-sky-950">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Configurable Searchable Textboxes & Autocomplete Dropdowns</p>
          <p className="text-sky-800 leading-relaxed">
            The options configured below empower the <strong>searchable textboxes</strong> across Job Creation (<code>/jobs/new</code>) and inventory requisition. Users can click to search presets, or type directly into the textboxes to use custom values.
          </p>
        </div>
      </div>

      {/* Interactive Live Demo matching user screenshot */}
      <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0D7A5F]" />
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Live Preview: Searchable Equipment Textboxes
            </h3>
          </div>
          <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
            Matches /jobs/new fields
          </span>
        </div>

        <p className="text-xs text-[#71717A]">
          Try typing in any field or click the arrow to test the searchable dropdown behavior:
        </p>

        {/* The 3 fields matching user screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* 1. Product / Appliance Type */}
          <div>
            <label className="font-semibold text-[#18181B] text-xs block mb-1">
              Product / Appliance Type *
            </label>
            <SearchableCombobox
              options={equipmentTypes}
              value={previewEquip}
              onChange={setPreviewEquip}
              placeholder="Type or pick appliance..."
              className="w-full"
            />
            <span className="text-[10px] text-[#71717A] mt-1 block">
              Type or pick HVAC appliance
            </span>
          </div>

          {/* 2. Equipment Brand */}
          <div>
            <label className="font-semibold text-[#18181B] text-xs block mb-1">
              Equipment Brand (Type or Select)
            </label>
            <SearchableCombobox
              options={brands}
              value={previewBrand}
              onChange={setPreviewBrand}
              placeholder="Type or pick brand..."
              className="w-full"
            />
            <span className="text-[10px] text-[#71717A] mt-1 block">
              Brand manufacturer
            </span>
          </div>

          {/* 3. Model / Specification */}
          <div>
            <label className="font-semibold text-[#18181B] text-xs block mb-1">
              Model / Specification
            </label>
            <SearchableCombobox
              options={models}
              value={previewModel}
              onChange={setPreviewModel}
              placeholder="Type or pick model..."
              className="w-full"
            />
            <span className="text-[10px] text-[#71717A] mt-1 block">
              Series specification
            </span>
          </div>
        </div>
      </div>

      {/* 4 Management Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Appliance / Equipment Types */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#0D7A5F]" />
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Appliance Types ({equipmentTypes.length})
                </h3>
              </div>
            </div>

            <form onSubmit={handleAddEquip} className="flex gap-1.5">
              <input
                type="text"
                placeholder="+ Add appliance..."
                value={newEquip}
                onChange={(e) => setNewEquip(e.target.value)}
                className="flex-1 bg-[#F9FAFB] px-2.5 py-1.5 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:outline-none focus:border-[#0D7A5F]"
              />
              <button
                type="submit"
                disabled={!newEquip.trim()}
                className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                Add
              </button>
            </form>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {equipmentTypes.map((item) => {
                const isEditing = editingCategory === "equip" && editingOriginal === item;
                if (isEditing) {
                  return (
                    <div key={`edit-equip-${item}`} className="flex items-center gap-1 p-1 bg-emerald-50 rounded-lg border border-emerald-300">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit("equip", item);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                        className="flex-1 bg-white px-2 py-1 rounded text-xs border border-emerald-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit("equip", item)}
                        className="p-1 text-emerald-700 hover:text-emerald-900"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1 text-zinc-500 hover:text-zinc-800"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={item}
                    className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-emerald-50/50 border border-[#F4F4F5] hover:border-emerald-200 transition text-xs"
                  >
                    <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleStartEdit("equip", item)}
                        className="text-[#71717A] hover:text-[#0D7A5F] transition p-1"
                        title="Edit / Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEquip(item)}
                        className="text-[#71717A] hover:text-rose-600 transition p-1"
                        title="Remove from options"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. Equipment Brands */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Brands ({brands.length})
                </h3>
              </div>
            </div>

            <form onSubmit={handleAddBrand} className="flex gap-1.5">
              <input
                type="text"
                placeholder="+ Add brand..."
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                className="flex-1 bg-[#F9FAFB] px-2.5 py-1.5 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:outline-none focus:border-purple-600"
              />
              <button
                type="submit"
                disabled={!newBrand.trim()}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                Add
              </button>
            </form>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {brands.map((item) => {
                const isEditing = editingCategory === "brand" && editingOriginal === item;
                if (isEditing) {
                  return (
                    <div key={`edit-brand-${item}`} className="flex items-center gap-1 p-1 bg-purple-50 rounded-lg border border-purple-300">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit("brand", item);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                        className="flex-1 bg-white px-2 py-1 rounded text-xs border border-purple-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit("brand", item)}
                        className="p-1 text-purple-700 hover:text-purple-900"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1 text-zinc-500 hover:text-zinc-800"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={item}
                    className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-purple-50/50 border border-[#F4F4F5] hover:border-purple-200 transition text-xs"
                  >
                    <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleStartEdit("brand", item)}
                        className="text-[#71717A] hover:text-purple-700 transition p-1"
                        title="Edit / Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBrand(item)}
                        className="text-[#71717A] hover:text-rose-600 transition p-1"
                        title="Remove from options"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Model / Specification Presets */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Models ({models.length})
                </h3>
              </div>
            </div>

            <form onSubmit={handleAddModel} className="flex gap-1.5">
              <input
                type="text"
                placeholder="+ Add model..."
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                className="flex-1 bg-[#F9FAFB] px-2.5 py-1.5 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:outline-none focus:border-amber-600"
              />
              <button
                type="submit"
                disabled={!newModel.trim()}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                Add
              </button>
            </form>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {models.map((item) => {
                const isEditing = editingCategory === "model" && editingOriginal === item;
                if (isEditing) {
                  return (
                    <div key={`edit-model-${item}`} className="flex items-center gap-1 p-1 bg-amber-50 rounded-lg border border-amber-300">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit("model", item);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                        className="flex-1 bg-white px-2 py-1 rounded text-xs border border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit("model", item)}
                        className="p-1 text-amber-700 hover:text-amber-900"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1 text-zinc-500 hover:text-zinc-800"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={item}
                    className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-amber-50/50 border border-[#F4F4F5] hover:border-amber-200 transition text-xs"
                  >
                    <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleStartEdit("model", item)}
                        className="text-[#71717A] hover:text-amber-700 transition p-1"
                        title="Edit / Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteModel(item)}
                        className="text-[#71717A] hover:text-rose-600 transition p-1"
                        title="Remove from options"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Job Types */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Job Types ({jobTypes.length})
                </h3>
              </div>
              <Link
                href="/settings/job-types"
                className="text-[11px] font-semibold text-blue-700 hover:underline flex items-center gap-0.5"
                title="Open full interactive manager"
              >
                <span>Full View</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <form onSubmit={handleAddJobType} className="flex gap-1.5">
              <input
                type="text"
                placeholder="+ Add job type..."
                value={newJobType}
                onChange={(e) => setNewJobType(e.target.value)}
                className="flex-1 bg-[#F9FAFB] px-2.5 py-1.5 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={!newJobType.trim()}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                Add
              </button>
            </form>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {jobTypes.map((item) => {
                const isEditing = editingCategory === "job" && editingOriginal === item;
                if (isEditing) {
                  return (
                    <div key={`edit-job-${item}`} className="flex items-center gap-1 p-1 bg-blue-50 rounded-lg border border-blue-300">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit("job", item);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                        className="flex-1 bg-white px-2 py-1 rounded text-xs border border-blue-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit("job", item)}
                        className="p-1 text-blue-700 hover:text-blue-900"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1 text-zinc-500 hover:text-zinc-800"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={item}
                    className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-blue-50/50 border border-[#F4F4F5] hover:border-blue-200 transition text-xs"
                  >
                    <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handleStartEdit("job", item)}
                        className="text-[#71717A] hover:text-blue-700 transition p-1"
                        title="Edit / Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteJobType(item)}
                        className="text-[#71717A] hover:text-rose-600 transition p-1"
                        title="Remove from options"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
