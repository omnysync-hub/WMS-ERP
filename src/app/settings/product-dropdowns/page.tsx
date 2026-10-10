"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import {
  Cpu,
  Tag,
  Briefcase,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  ArrowLeft,
  Settings2,
  Info,
} from "lucide-react";

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
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);

  const [newEquip, setNewEquip] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newJobType, setNewJobType] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedEquip = localStorage.getItem("custom_equipment_types");
      if (savedEquip) setEquipmentTypes(JSON.parse(savedEquip));

      const savedBrands = localStorage.getItem("custom_hvac_brands");
      if (savedBrands) setBrands(JSON.parse(savedBrands));

      const savedJobs = localStorage.getItem("custom_job_types");
      if (savedJobs) setJobTypes(JSON.parse(savedJobs));
    } catch (e) {
      console.error("Failed loading dropdown settings", e);
    }
  }, []);

  const saveSettings = (
    nextEquip = equipmentTypes,
    nextBrands = brands,
    nextJobs = jobTypes
  ) => {
    try {
      localStorage.setItem("custom_equipment_types", JSON.stringify(nextEquip));
      localStorage.setItem("custom_hvac_brands", JSON.stringify(nextBrands));
      localStorage.setItem("custom_job_types", JSON.stringify(nextJobs));
      setSavedNotice("Settings saved and synced across all job intake and product dropdowns.");
      setTimeout(() => setSavedNotice(""), 4000);
    } catch (e) {
      console.error("Failed saving dropdown settings", e);
    }
  };

  const handleAddEquip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquip.trim() || equipmentTypes.includes(newEquip.trim())) return;
    const next = [...equipmentTypes, newEquip.trim()];
    setEquipmentTypes(next);
    setNewEquip("");
    saveSettings(next, brands, jobTypes);
  };

  const handleDeleteEquip = (item: string) => {
    const next = equipmentTypes.filter((x) => x !== item);
    setEquipmentTypes(next);
    saveSettings(next, brands, jobTypes);
  };

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim() || brands.includes(newBrand.trim())) return;
    const next = [...brands, newBrand.trim()];
    setBrands(next);
    setNewBrand("");
    saveSettings(equipmentTypes, next, jobTypes);
  };

  const handleDeleteBrand = (item: string) => {
    const next = brands.filter((x) => x !== item);
    setBrands(next);
    saveSettings(equipmentTypes, next, jobTypes);
  };

  const handleAddJobType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobType.trim() || jobTypes.includes(newJobType.trim())) return;
    const next = [...jobTypes, newJobType.trim()];
    setJobTypes(next);
    setNewJobType("");
    saveSettings(equipmentTypes, brands, next);
  };

  const handleDeleteJobType = (item: string) => {
    const next = jobTypes.filter((x) => x !== item);
    setJobTypes(next);
    saveSettings(equipmentTypes, brands, next);
  };

  const handleResetDefaults = () => {
    if (!confirm("Reset all dropdown options to HVAC industry standard defaults?")) return;
    setEquipmentTypes(DEFAULT_EQUIPMENT_TYPES);
    setBrands(DEFAULT_BRANDS);
    setJobTypes(DEFAULT_JOB_TYPES);
    saveSettings(DEFAULT_EQUIPMENT_TYPES, DEFAULT_BRANDS, DEFAULT_JOB_TYPES);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 animate-in fade-in">
      <PageHeader
        moduleName="Settings"
        currentView="Product & Equipment Dropdowns"
        primaryAction={{
          label: "Reset to Defaults",
          onClick: handleResetDefaults,
        }}
      />

      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings Hub
        </Link>
        <span className="text-xs text-[#71717A] bg-white border border-[#EDEDED] px-3 py-1 rounded-full shadow-2xs font-mono">
          Live Dropdown Sync Active
        </span>
      </div>

      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Info Notice */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 text-xs text-sky-950">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Configurable HVAC Searchable Dropdowns</p>
          <p className="text-sky-800 leading-relaxed">
            Manage the list of pre-configured Equipment / Appliance Types, Equipment Brands, and Job Types that appear in the searchable dropdowns across Job Creation (<code>/jobs/new</code>), field services, and stock requisition forms.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Appliance / Equipment Types */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
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
              placeholder="+ Add appliance type..."
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

          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {equipmentTypes.map((item) => (
              <div
                key={item}
                className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-emerald-50/50 border border-[#F4F4F5] hover:border-emerald-200 transition text-xs"
              >
                <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteEquip(item)}
                  className="opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-rose-600 transition p-1"
                  title="Remove from options"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Equipment Brands */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-700" />
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                HVAC Brands ({brands.length})
              </h3>
            </div>
          </div>

          <form onSubmit={handleAddBrand} className="flex gap-1.5">
            <input
              type="text"
              placeholder="+ Add manufacturer..."
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

          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {brands.map((item) => (
              <div
                key={item}
                className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-purple-50/50 border border-[#F4F4F5] hover:border-purple-200 transition text-xs"
              >
                <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteBrand(item)}
                  className="opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-rose-600 transition p-1"
                  title="Remove from options"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Job Types */}
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Job Types ({jobTypes.length})
              </h3>
            </div>
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

          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {jobTypes.map((item) => (
              <div
                key={item}
                className="group flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] hover:bg-blue-50/50 border border-[#F4F4F5] hover:border-blue-200 transition text-xs"
              >
                <span className="font-medium text-[#18181B] truncate pr-2">{item}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteJobType(item)}
                  className="opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-rose-600 transition p-1"
                  title="Remove from options"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
