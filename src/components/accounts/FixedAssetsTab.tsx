"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Layers,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building,
  TrendingDown,
  Wrench,
} from "lucide-react";

export default function FixedAssetsTab() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDepreciationModal, setShowDepreciationModal] = useState(false);

  // Form states: New Asset
  const [assetName, setAssetName] = useState("");
  const [assetCategory, setAssetCategory] = useState("Tools & Equipment");
  const [assetCost, setAssetCost] = useState("");
  const [salvageValue, setSalvageValue] = useState("0");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");
  const [inServiceDate, setInServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);

  // Form states: Depreciation Run
  const [deprYear, setDeprYear] = useState<number>(new Date().getFullYear());
  const [deprMonth, setDeprMonth] = useState<number>(new Date().getMonth() + 1);
  const [isRunningDepr, setIsRunningDepr] = useState(false);

  const loadAssets = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/accounts?view=fixed_assets");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load fixed assets");
      setAssets(data.assets || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  // Submit New Asset
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || Number(assetCost) <= 0) {
      alert("Please provide asset title and positive cost");
      return;
    }

    setIsSubmittingAsset(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_fixed_asset",
          name: assetName,
          category: assetCategory,
          cost: Number(assetCost),
          salvageValue: Number(salvageValue) || 0,
          usefulLifeMonths: Number(usefulLifeMonths) || 60,
          inServiceDate,
          assetAccountCode: "1500",
          depExpenseAccountCode: "6350",
          accumDepAccountCode: "1590",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Asset creation failed");

      setShowAddModal(false);
      setAssetName("");
      setAssetCost("");
      setSuccessMsg(`Asset ${data.asset?.assetNumber || "FA"} registered in Fixed Asset Ledger.`);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingAsset(false);
    }
  };

  // Submit Monthly Depreciation Routine
  const handleRunDepreciation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunningDepr(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_depreciation",
          year: deprYear,
          month: deprMonth,
          actorName: "Fatima Noor (Accountant)",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Depreciation run failed");

      setShowDepreciationModal(false);
      setSuccessMsg(
        data.message ||
          `Depreciation processed: PKR ${data.totalDepreciation} allocated across ${data.processedCount} assets. Posted to GL (Dr 6350 / Cr 1590).`
      );
      loadAssets();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsRunningDepr(false);
    }
  };

  // Calculations
  const totalCost = assets.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalAccum = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0);
  const totalNetBookValue = assets.reduce((s, a) => s + a.bookValue, 0);
  const activeCount = assets.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg("")} className="text-rose-700 hover:text-rose-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
          <span className="text-[10px] text-[#71717A] uppercase font-bold block">Total Capitalized Cost</span>
          <span className="text-xl font-mono font-bold text-[#18181B] mt-1 block">
            {formatCurrency(totalCost)}
          </span>
          <span className="text-[10px] text-[#A1A1AA]">GL Account 1500 (Gross PP&E)</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
          <span className="text-[10px] text-[#71717A] uppercase font-bold block">Accumulated Depreciation</span>
          <span className="text-xl font-mono font-bold text-rose-700 mt-1 block">
            -{formatCurrency(totalAccum)}
          </span>
          <span className="text-[10px] text-[#A1A1AA]">Contra-Asset Account 1590</span>
        </div>

        <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] text-emerald-900 uppercase font-bold block">Net Carrying Book Value</span>
          <span className="text-xl font-mono font-bold text-[#0D7A5F] mt-1 block">
            {formatCurrency(totalNetBookValue)}
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">Balance Sheet Net PP&E</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
          <span className="text-[10px] text-[#71717A] uppercase font-bold block">Active In-Service Assets</span>
          <span className="text-xl font-mono font-bold text-[#18181B] mt-1 block">
            {activeCount} / {assets.length}
          </span>
          <span className="text-[10px] text-[#A1A1AA]">Straight-line monthly schedule</span>
        </div>
      </div>

      {/* Action Header */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            Fixed Asset Sub-Ledger & Depreciation Engine
          </h3>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            Idempotent straight-line monthly depreciation posted directly into GAAP ledger (Dr 6350 / Cr 1590)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDepreciationModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Monthly Depreciation
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-[#18181B] hover:bg-black text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Capitalize New Asset
          </button>

          <button
            type="button"
            onClick={loadAssets}
            disabled={loading}
            className="p-2 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Assets Register Table */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-semibold text-[#71717A]">
                <th className="py-3 px-4 w-28 font-mono">Asset Tag</th>
                <th className="py-3 px-4">Asset Title & Category</th>
                <th className="py-3 px-3 w-28">In-Service Date</th>
                <th className="py-3 px-4 w-32 text-right font-mono">Gross Cost</th>
                <th className="py-3 px-3 w-24 text-center">Life (Mo)</th>
                <th className="py-3 px-4 w-32 text-right font-mono">Accum Depr</th>
                <th className="py-3 px-4 w-32 text-right font-mono">Net Book Value</th>
                <th className="py-3 px-3 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#71717A]">
                    No fixed assets registered in the system yet. Click "Capitalize New Asset" to add equipment, tools, or vehicles.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#FAFAFA] transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#0D7A5F]">{asset.assetNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#18181B]">{asset.name}</div>
                      <div className="text-[10px] text-[#71717A] capitalize">{asset.category}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                      {new Date(asset.acquisitionDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#18181B]">
                      {formatCurrency(asset.acquisitionCost)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[#71717A]">{asset.usefulLifeMonths}m</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-rose-700">
                      -{formatCurrency(asset.accumulatedDepreciation)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                      {formatCurrency(asset.bookValue)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          asset.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-zinc-100 text-zinc-700 border-zinc-200"
                        }`}
                      >
                        {asset.status === "active" ? "Active (Depreciating)" : "Fully Depreciated"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Register New Fixed Asset */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E4E4E7] overflow-hidden">
            <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#0D7A5F]" />
                Capitalize New Fixed Asset (PP&E)
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#71717A] hover:text-[#18181B] p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">Asset Description / Name:</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. Master Diagnostic Rig 410A"
                  className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Category:</label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs focus:outline-none"
                  >
                    <option value="Tools & Equipment">Tools & Equipment</option>
                    <option value="Vehicles & Transport">Vehicles & Transport</option>
                    <option value="Machinery & Plant">Machinery & Plant</option>
                    <option value="IT & Office Electronics">IT & Office Electronics</option>
                    <option value="Furniture & Fixtures">Furniture & Fixtures</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">In-Service Date:</label>
                  <input
                    type="date"
                    value={inServiceDate}
                    onChange={(e) => setInServiceDate(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Gross Cost (PKR):</label>
                  <input
                    type="number"
                    value={assetCost}
                    onChange={(e) => setAssetCost(e.target.value)}
                    placeholder="250000"
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Useful Life (Mos):</label>
                  <input
                    type="number"
                    value={usefulLifeMonths}
                    onChange={(e) => setUsefulLifeMonths(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Salvage Value (PKR):</label>
                  <input
                    type="number"
                    value={salvageValue}
                    onChange={(e) => setSalvageValue(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl space-y-1 text-[11px] text-[#71717A]">
                <span className="font-semibold text-[#18181B] block">GL Accounts Mapping (GAAP standard):</span>
                <span>• Asset: 1500 (Equipment & Tools)</span><br />
                <span>• Accumulated Depreciation: 1590 (Contra-Asset)</span><br />
                <span>• Monthly Expense: 6350 (Depreciation Expense)</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAsset}
                  className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSubmittingAsset ? "Capitalizing..." : "Capitalize Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Run Monthly Depreciation */}
      {showDepreciationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#E4E4E7] overflow-hidden">
            <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Play className="w-4 h-4 text-[#0D7A5F] fill-current" />
                Run Monthly Depreciation Routine
              </h3>
              <button
                onClick={() => setShowDepreciationModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunDepreciation} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Fiscal Year:</label>
                  <input
                    type="number"
                    value={deprYear}
                    onChange={(e) => setDeprYear(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Month Number (1-12):</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={deprMonth}
                    onChange={(e) => setDeprMonth(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Idempotent General Ledger Posting
                </span>
                <span>
                  This calculates straight-line depreciation for all eligible active assets for period {deprYear}-
                  {String(deprMonth).padStart(2, "0")}. It automatically generates a balanced voucher (Dr 6350 / Cr 1590)
                  and prevents double-posting if executed multiple times for the same month.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowDepreciationModal(false)}
                  className="px-4 py-2 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRunningDepr}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isRunningDepr ? "Calculating & Posting..." : "Execute Depreciation Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
