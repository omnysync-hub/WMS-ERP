"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Phone,
  MapPin,
  Building,
  Check,
  Search,
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { cn, formatCurrency } from "@/lib/utils";

// Standard Dropdown Fallback Data
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

// Helper to read saved custom list from localStorage or fallback
function getSavedList(key: string, fallback: string[]): string[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

interface WorkRow {
  id: string;
  typeOfWork: string;
  product: string;
  brand: string;
  careOff: string;
  qty: number;
  charges: number;
  remarks: string;
}

export default function FastJobIntakePage() {
  const router = useRouter();

  // Master Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [careOfParties, setCareOfParties] = useState<any[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>(DEFAULT_EQUIPMENT_TYPES);
  const [brands, setBrands] = useState<string[]>(DEFAULT_BRANDS);
  const [loading, setLoading] = useState(true);

  // Customer Fields (Rows 1 & 2)
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerSecMobile, setCustomerSecMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Work & Equipment Rows (Rows 3, 4, 5)
  const [rows, setRows] = useState<WorkRow[]>([
    {
      id: "row-1",
      typeOfWork: DEFAULT_JOB_TYPES[0],
      product: DEFAULT_EQUIPMENT_TYPES[1] || DEFAULT_EQUIPMENT_TYPES[0],
      brand: "Gree",
      careOff: "direct",
      qty: 1,
      charges: 4500,
      remarks: "",
    },
  ]);

  // Operational Settings (Technician & Payment)
  const [assignedTechnicianId, setAssignedTechnicianId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"technician" | "office" | "foc">("technician");
  const [focReason, setFocReason] = useState("");
  const [manualJobNumber, setManualJobNumber] = useState("");

  // Modals for Quick Add (+)
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [activeRowIdForAddType, setActiveRowIdForAddType] = useState<string | null>(null);

  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [activeRowIdForAddBrand, setActiveRowIdForAddBrand] = useState<string | null>(null);

  const [showAddCareOfModal, setShowAddCareOfModal] = useState(false);
  const [newCareOfCompany, setNewCareOfCompany] = useState("");
  const [newCareOfPerson, setNewCareOfPerson] = useState("");
  const [newCareOfPhone, setNewCareOfPhone] = useState("");
  const [activeRowIdForAddCareOf, setActiveRowIdForAddCareOf] = useState<string | null>(null);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch Master Data on Mount
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        // Load custom lists from localStorage
        setJobTypes(getSavedList("custom_job_types", DEFAULT_JOB_TYPES));
        setEquipmentTypes(getSavedList("custom_equipment_types", DEFAULT_EQUIPMENT_TYPES));
        setBrands(getSavedList("custom_hvac_brands", DEFAULT_BRANDS));

        const [custRes, techRes, careOfRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/technicians"),
          fetch("/api/care-of-parties"),
        ]);

        if (!cancelled) {
          const custData = await custRes.json();
          if (Array.isArray(custData)) setCustomers(custData);
          else if (Array.isArray(custData?.customers)) setCustomers(custData.customers);

          const techData = await techRes.json();
          if (Array.isArray(techData?.technicians)) setTechnicians(techData.technicians);

          const careOfData = await careOfRes.json();
          if (Array.isArray(careOfData?.careOfParties)) setCareOfParties(careOfData.careOfParties);
        }
      } catch (err) {
        console.error("Error loading job intake data", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter customers for autocomplete
  const matchingCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => {
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const address = (c.address || c.addressText || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || address.includes(q);
      })
      .slice(0, 8);
  }, [customers, customerSearchQuery]);

  // Select customer from dropdown
  function handleSelectCustomer(c: any) {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name || "");
    setCustomerMobile(c.phone || "");
    setCustomerSecMobile(c.secPhone || "");
    setCustomerAddress(c.address || c.addressText || "");
    setShowCustomerDropdown(false);
    setCustomerSearchQuery("");
  }

  // Clear customer selection
  function handleClearCustomer() {
    setSelectedCustomerId(null);
    setCustomerName("");
    setCustomerMobile("");
    setCustomerSecMobile("");
    setCustomerAddress("");
  }

  // Row Manipulation
  function handleAddRow() {
    const newRow: WorkRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      typeOfWork: jobTypes[0] || DEFAULT_JOB_TYPES[0],
      product: equipmentTypes[0] || DEFAULT_EQUIPMENT_TYPES[0],
      brand: brands[0] || DEFAULT_BRANDS[0],
      careOff: rows[0]?.careOff || "direct",
      qty: 1,
      charges: 4500,
      remarks: "",
    };
    setRows((prev) => [...prev, newRow]);
  }

  function handleRemoveRow(id: string) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleUpdateRow(id: string, field: keyof WorkRow, value: any) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, [field]: value };
      })
    );
  }

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = Math.max(1, Number(r.qty) || 1);
      const c = Math.max(0, Number(r.charges) || 0);
      return sum + q * c;
    }, 0);
  }, [rows]);

  // Handle Quick Add (+) Submissions
  function handleSaveNewType() {
    if (!newTypeName.trim()) return;
    const trimmed = newTypeName.trim();
    if (!jobTypes.includes(trimmed)) {
      const updated = [...jobTypes, trimmed];
      setJobTypes(updated);
      try {
        localStorage.setItem("custom_job_types", JSON.stringify(updated));
      } catch (e) {}
    }
    if (activeRowIdForAddType) {
      handleUpdateRow(activeRowIdForAddType, "typeOfWork", trimmed);
    }
    setNewTypeName("");
    setShowAddTypeModal(false);
  }

  function handleSaveNewBrand() {
    if (!newBrandName.trim()) return;
    const trimmed = newBrandName.trim();
    if (!brands.includes(trimmed)) {
      const updated = [...brands, trimmed];
      setBrands(updated);
      try {
        localStorage.setItem("custom_hvac_brands", JSON.stringify(updated));
      } catch (e) {}
    }
    if (activeRowIdForAddBrand) {
      handleUpdateRow(activeRowIdForAddBrand, "brand", trimmed);
    }
    setNewBrandName("");
    setShowAddBrandModal(false);
  }

  async function handleSaveNewCareOf() {
    if (!newCareOfCompany.trim()) return;
    try {
      const res = await fetch("/api/care-of-parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: newCareOfCompany.trim(),
          personName: newCareOfPerson.trim() || undefined,
          phone: newCareOfPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data) {
        const party = data.party || data;
        setCareOfParties((prev) => [party, ...prev]);
        if (activeRowIdForAddCareOf) {
          handleUpdateRow(activeRowIdForAddCareOf, "careOff", party.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNewCareOfCompany("");
      setNewCareOfPerson("");
      setNewCareOfPhone("");
      setShowAddCareOfModal(false);
    }
  }

  // Main Form Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    try {
      setIsSubmitting(true);

      let targetCustomerId = selectedCustomerId;

      // If customer doesn't exist yet, automatically register them inline
      if (!targetCustomerId) {
        if (!customerName.trim()) {
          throw new Error("Please enter customer name.");
        }
        const phoneDigits = customerMobile.replace(/\D/g, "");
        if (phoneDigits.length !== 11) {
          throw new Error("Customer primary mobile must be exactly 11 digits (e.g., 03001234567).");
        }
        if (!customerAddress.trim()) {
          throw new Error("Please enter the customer address.");
        }

        const createCustRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customerName.trim(),
            phone: customerMobile.trim(),
            secPhone: customerSecMobile.trim() || undefined,
            addressText: customerAddress.trim(),
          }),
        });
        const custData = await createCustRes.json();
        if (!createCustRes.ok) {
          throw new Error(custData.error || "Failed to save customer record.");
        }
        targetCustomerId = custData.id;
      }

      // Consolidate Items from Rows
      const jobItems = rows.map((r) => {
        const qty = Math.max(1, Number(r.qty) || 1);
        const rate = Math.max(0, Number(r.charges) || 0);
        return {
          description: `[${r.product || "HVAC"} - ${r.brand || "Standard"}] ${r.typeOfWork}${r.remarks ? ` (${r.remarks})` : ""}`,
          quantityPlanned: qty,
          unitRate: rate,
          isProduct: false,
        };
      });

      // Care Of handling
      const firstCareOf = rows[0]?.careOff;
      const isCareOfActive = firstCareOf && firstCareOf !== "direct";
      const selectedCareOfParty = isCareOfActive ? careOfParties.find((p) => p.id === firstCareOf) : null;

      // Remarks consolidation
      const rowRemarks = rows
        .map((r, i) => {
          const parts = [];
          if (r.remarks) parts.push(r.remarks);
          return parts.length ? `Item ${i + 1}: ${parts.join(" - ")}` : "";
        })
        .filter(Boolean)
        .join(" | ");

      const primaryJobType = rows[0]?.typeOfWork || "General HVAC Service";

      const payload = {
        customerId: targetCustomerId,
        jobType: primaryJobType,
        careOfPartyId: isCareOfActive ? firstCareOf : null,
        careOfCompanyName: selectedCareOfParty?.companyName || null,
        careOfPersonName: selectedCareOfParty?.personName || null,
        manualJobNumber: manualJobNumber.trim() || null,
        isFoc: paymentMode === "foc",
        focReason: paymentMode === "foc" ? focReason.trim() : undefined,
        paymentCollectionMode: paymentMode === "office" ? "office" : "technician",
        remarks: rowRemarks || `${primaryJobType} at client location`,
        assignedTechnicianId: assignedTechnicianId || null,
        technicianIds: assignedTechnicianId ? [assignedTechnicianId] : [],
        items: jobItems,
      };

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create job");

      // Publish Realtime Dispatch Notification
      if (payload.assignedTechnicianId) {
        const assignedTech = technicians.find((t) => t.id === payload.assignedTechnicianId);
        realtimeSync.publish("JOB_ASSIGNED", {
          jobId: data.id,
          jobNumber: data.jobNumber,
          technicianId: payload.assignedTechnicianId,
          technicianName: assignedTech?.name,
          actor: "Operations Intake",
          message: `New Job #${data.jobNumber} assigned to ${assignedTech?.name || "Technician"}`,
          payload: { job: data },
        });
      }

      router.push(`/jobs/${data.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while creating the job.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-4 lg:p-6 flex flex-col justify-start">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between mb-3 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/jobs" className="hover:text-emerald-700 font-semibold transition">
            Jobs
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-800">Fast Job Intake</span>
        </div>

        <Link
          href="/jobs"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Cancel & Close
        </Link>
      </div>

      {/* Main Single-Card Form (Exact Reference Layout) */}
      <div className="max-w-6xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 lg:p-6">
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ========================================================================= */}
          {/* ROW 1: Customer (Name), Mobile, Secondary Mobile No                       */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Name with Autocomplete */}
            <div className="relative" ref={customerDropdownRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Customer:<span className="text-red-500 ml-0.5">*</span>
                </label>
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={handleClearCustomer}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    Change / New
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerDropdown(true);
                  if (selectedCustomerId) setSelectedCustomerId(null);
                }}
                onFocus={() => {
                  if (customerName) {
                    setCustomerSearchQuery(customerName);
                    setShowCustomerDropdown(true);
                  }
                }}
                placeholder="Enter customer name"
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition"
              />

              {/* Autocomplete Dropdown */}
              {showCustomerDropdown && matchingCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                  {matchingCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {c.phone} {c.addressText || c.address ? `· ${c.addressText || c.address}` : ""}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Auto-Fill
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile (Primary) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mobile:<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerMobile}
                onChange={(e) => {
                  setCustomerMobile(e.target.value);
                  if (selectedCustomerId) setSelectedCustomerId(null);
                }}
                placeholder="Mobile (e.g. 03001234567)"
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
              />
            </div>

            {/* Secondary Mobile No */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Secondary Mobile No:
              </label>
              <input
                type="tel"
                value={customerSecMobile}
                onChange={(e) => setCustomerSecMobile(e.target.value)}
                placeholder="Secondary Mobile No"
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 2: Address (Full Width)                                              */}
          {/* ========================================================================= */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Address:
            </label>
            <input
              type="text"
              required
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Enter an Address..."
              className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition"
            />
          </div>

          {/* ========================================================================= */}
          {/* ROWS 3, 4, 5: Work Items & Equipment Details                              */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-1">
            {rows.map((row, index) => {
              const rowTotal = (Math.max(1, Number(row.qty) || 1)) * (Math.max(0, Number(row.charges) || 0));

              return (
                <div
                  key={row.id}
                  className={cn(
                    "rounded-xl border border-slate-200/90 p-4 space-y-3 transition",
                    rows.length > 1 ? "bg-slate-50/50" : "bg-transparent"
                  )}
                >
                  {/* Row Top Indicator (if multiple rows) */}
                  {rows.length > 1 && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Work Item #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  )}

                  {/* ROW 3: Type Of Work, Product, Brand, Care Off */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Type Of Work with Blue (+) Button */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Type Of Work:<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={row.typeOfWork}
                          onChange={(e) => handleUpdateRow(row.id, "typeOfWork", e.target.value)}
                          className="flex-1 h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
                        >
                          {jobTypes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowIdForAddType(row.id);
                            setShowAddTypeModal(true);
                          }}
                          className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition shadow-xs"
                          title="Add new Type of Work"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Product / Equipment */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Product :
                      </label>
                      <select
                        value={row.product}
                        onChange={(e) => handleUpdateRow(row.id, "product", e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
                      >
                        {equipmentTypes.map((eq) => (
                          <option key={eq} value={eq}>
                            {eq}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Brand with Blue (+) Button */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Brand:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={row.brand}
                          onChange={(e) => handleUpdateRow(row.id, "brand", e.target.value)}
                          className="flex-1 h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
                        >
                          {brands.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowIdForAddBrand(row.id);
                            setShowAddBrandModal(true);
                          }}
                          className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition shadow-xs"
                          title="Add new Brand"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Care Off with Blue (+) Button */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Care Off:<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={row.careOff}
                          onChange={(e) => handleUpdateRow(row.id, "careOff", e.target.value)}
                          className="flex-1 h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
                        >
                          <option value="direct">Direct / Cash Customer</option>
                          {careOfParties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.companyName} {p.personName ? `(${p.personName})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowIdForAddCareOf(row.id);
                            setShowAddCareOfModal(true);
                          }}
                          className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition shadow-xs"
                          title="Add new Care Off Company"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ROW 4: Qty, Charges, Total */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => handleUpdateRow(row.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Charges
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={row.charges}
                        onChange={(e) => handleUpdateRow(row.id, "charges", Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="Charges in PKR"
                        className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Total
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formatCurrency(rowTotal)}
                        className="w-full h-10 px-3.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>

                  {/* ROW 5: Remarks */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={row.remarks}
                      onChange={(e) => handleUpdateRow(row.id, "remarks", e.target.value)}
                      placeholder="Enter job remarks, site instructions, access notes, or unit specifications..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition resize-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* ROW 6: + Add Row Button                                                   */}
          {/* ========================================================================= */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="h-10 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Row
            </button>
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM COMPACT DISPATCH & SUBMIT BAR                                     */}
          {/* ========================================================================= */}
          <div className="pt-4 mt-2 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70 p-4 rounded-xl">
            {/* Technician & Payment Options */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Technician Dropdown */}
              <div className="w-60">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Assign Technician:
                </label>
                <select
                  value={assignedTechnicianId}
                  onChange={(e) => setAssignedTechnicianId(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="">Unassigned (Queue in Dispatch)</option>
                  {technicians.map((t) => {
                    const statusText = t.isCheckedIn ? "🟢 Available & Ready" : t.status === "On Job" ? "🔵 On Job" : "⚪ Off Duty";
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({statusText})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Payment Mode Pills */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Payment Collection:
                </label>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("technician")}
                    className={cn(
                      "px-3 py-1 rounded-md transition",
                      paymentMode === "technician" ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Tech Collects
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("office")}
                    className={cn(
                      "px-3 py-1 rounded-md transition",
                      paymentMode === "office" ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Office Billed
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("foc")}
                    className={cn(
                      "px-3 py-1 rounded-md transition",
                      paymentMode === "foc" ? "bg-amber-600 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    FOC
                  </button>
                </div>
              </div>
            </div>

            {/* Total & Action Buttons */}
            <div className="flex items-center gap-4 justify-end">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Grand Total</span>
                <span className="text-lg font-bold text-emerald-700 font-mono">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/jobs"
                  className="h-10 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-6 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold text-xs transition shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving & Dispatching..." : "Save & Dispatch Job"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* QUICK ADD MODALS (+) */}
      {/* 1. Add Type of Work Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sm text-slate-800">Add New Type Of Work</h3>
              <button onClick={() => setShowAddTypeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work / Job Type Name:</label>
              <input
                type="text"
                autoFocus
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g. PCB Board Inspection"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTypeModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewType}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Add & Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Brand Modal */}
      {showAddBrandModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sm text-slate-800">Add New HVAC Brand</h3>
              <button onClick={() => setShowAddBrandModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand Name:</label>
              <input
                type="text"
                autoFocus
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="e.g. Electrolux"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBrandModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewBrand}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Add & Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add Care Of Company Modal */}
      {showAddCareOfModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sm text-slate-800">Add Care Off Partner</h3>
              <button onClick={() => setShowAddCareOfModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company / Partner Name:*</label>
              <input
                type="text"
                autoFocus
                value={newCareOfCompany}
                onChange={(e) => setNewCareOfCompany(e.target.value)}
                placeholder="e.g. Gree Corporate Care"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person (Optional):</label>
              <input
                type="text"
                value={newCareOfPerson}
                onChange={(e) => setNewCareOfPerson(e.target.value)}
                placeholder="e.g. Engr. Usman"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone (Optional):</label>
              <input
                type="text"
                value={newCareOfPhone}
                onChange={(e) => setNewCareOfPhone(e.target.value)}
                placeholder="e.g. 03001234567"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddCareOfModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewCareOf}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Add & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
