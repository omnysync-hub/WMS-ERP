"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import SearchableCombobox from "@/components/ui/SearchableCombobox";
import PakistanAddressAutofill from "@/components/maps/PakistanAddressAutofill";

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
  const [customerLat, setCustomerLat] = useState<number>(31.5204);
  const [customerLng, setCustomerLng] = useState<number>(74.3587);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  // Work & Equipment Rows (Rows 3, 4, 5) - Qty defaults to 0
  const [rows, setRows] = useState<WorkRow[]>([
    {
      id: "row-1",
      typeOfWork: DEFAULT_JOB_TYPES[0],
      product: DEFAULT_EQUIPMENT_TYPES[1] || DEFAULT_EQUIPMENT_TYPES[0],
      brand: "Gree",
      careOff: "direct",
      qty: 0,
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

  // Customer Select Options
  const customerOptions: SelectOption[] = useMemo(() => {
    return [
      {
        value: "__NEW__",
        label: "+ Enter New Walk-in Customer",
        subLabel: "Register a brand new customer profile",
        badge: "NEW",
        badgeTone: "blue",
      },
      ...customers.map((c) => ({
        value: c.id,
        label: c.name || "Unnamed Customer",
        subLabel: `${c.phone || "No phone"}${c.secPhone ? ` / ${c.secPhone}` : ""}${c.addressText || c.address ? ` • ${c.addressText || c.address}` : ""}`,
        badge: c.accountType === "corporate" ? "Corporate" : undefined,
        badgeTone: "green" as const,
      })),
    ];
  }, [customers]);

  // Care-Of Select Options
  const careOfOptions: SelectOption[] = useMemo(() => {
    return careOfParties.map((p) => ({
      value: p.id,
      label: p.companyName,
      subLabel: p.personName ? `${p.personName}${p.phone ? ` • ${p.phone}` : ""}` : p.phone || undefined,
    }));
  }, [careOfParties]);

  // Present Technicians only (Absent / Off-duty technicians cannot be assigned jobs)
  const presentTechnicians = useMemo(() => {
    return technicians.filter((t) => t.isCheckedIn);
  }, [technicians]);

  // Technician Select Options - Absent / off-duty technicians do NOT show up
  const technicianOptions: SelectOption[] = useMemo(() => {
    if (presentTechnicians.length === 0) {
      return [
        {
          value: "",
          label: "Unassigned (Queue in Dispatch - 0 Techs Present Today)",
          badge: "Queue",
          badgeTone: "zinc",
        },
      ];
    }

    return [
      { value: "", label: "Unassigned (Queue in Dispatch)", badge: "Queue", badgeTone: "zinc" },
      ...presentTechnicians.map((t) => {
        const isOnJob = t.status === "On Job" || t.currentStatus === "On Job";
        return {
          value: t.id,
          label: t.name,
          subLabel: t.phone ? `${t.phone} • Checked In` : "Checked In",
          badge: isOnJob ? "On Job" : "Available",
          badgeTone: (isOnJob ? "blue" : "green") as "blue" | "green",
        };
      }),
    ];
  }, [presentTechnicians]);

  // Select customer from dropdown
  function handleSelectCustomer(c: any) {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name || "");
    setCustomerMobile(c.phone || "");
    setCustomerSecMobile(c.secPhone || "");
    setCustomerAddress(c.addressText || c.address || "");
    if (c.lat && c.lng) {
      setCustomerLat(Number(c.lat));
      setCustomerLng(Number(c.lng));
    }
    setIsNewCustomer(false);
  }

  // Clear customer selection
  function handleClearCustomer() {
    setSelectedCustomerId(null);
    setCustomerName("");
    setCustomerMobile("");
    setCustomerSecMobile("");
    setCustomerAddress("");
    setCustomerLat(31.5204);
    setCustomerLng(74.3587);
  }

  // Row Manipulation
  function handleAddRow() {
    const newRow: WorkRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      typeOfWork: jobTypes[0] || DEFAULT_JOB_TYPES[0],
      product: equipmentTypes[0] || DEFAULT_EQUIPMENT_TYPES[0],
      brand: brands[0] || DEFAULT_BRANDS[0],
      careOff: rows[0]?.careOff || "direct",
      qty: 0,
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

  // Grand Total Calculation - handles default qty: 0
  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = Math.max(0, Number(r.qty) || 0);
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
            lat: customerLat || undefined,
            lng: customerLng || undefined,
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
        const qty = Math.max(0, Number(r.qty) || 0);
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

      if (assignedTechnicianId) {
        const isTechPresent = presentTechnicians.some((t) => t.id === assignedTechnicianId);
        if (!isTechPresent) {
          throw new Error("Cannot assign job: Selected technician is off duty and has not checked in today. Jobs can only be assigned to present technicians.");
        }
      }

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
          {/* ROW 1: Customer (Name / Searchable Dropdown), Mobile, Secondary Mobile No */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Searchable Dropdown or Custom Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  Customer:<span className="text-red-500">*</span>
                  {selectedCustomerId ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Presaved
                    </span>
                  ) : isNewCustomer ? (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                      New Walk-in
                    </span>
                  ) : null}
                </label>

                {isNewCustomer ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomer(false);
                      handleClearCustomer();
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition"
                  >
                    <Search className="w-3 h-3" />
                    Select Presaved
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {selectedCustomerId && (
                      <button
                        type="button"
                        onClick={handleClearCustomer}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewCustomer(true);
                        handleClearCustomer();
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      New Customer
                    </button>
                  </div>
                )}
              </div>

              {isNewCustomer ? (
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter full customer name..."
                  className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition"
                />
              ) : (
                <SearchableSelect
                  value={selectedCustomerId || ""}
                  onChange={(val) => {
                    if (val === "__NEW__") {
                      setIsNewCustomer(true);
                      handleClearCustomer();
                      return;
                    }
                    const found = customers.find((c) => c.id === val);
                    if (found) {
                      handleSelectCustomer(found);
                    } else {
                      handleClearCustomer();
                    }
                  }}
                  options={customerOptions}
                  placeholder="Search customer by name, mobile, address..."
                  searchPlaceholder="Type name or phone to search..."
                  clearable={true}
                  className="h-10 bg-white"
                />
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
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
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
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 2: Address (Mapbox Autofill & GPS Pinpoint)                          */}
          {/* ========================================================================= */}
          <div>
            <PakistanAddressAutofill
              value={customerAddress}
              lat={customerLat}
              lng={customerLng}
              onChange={(newAddress, newLat, newLng) => {
                setCustomerAddress(newAddress);
                if (newLat && newLng) {
                  setCustomerLat(newLat);
                  setCustomerLng(newLng);
                }
              }}
              label="Address"
              placeholder="Search address with Mapbox (e.g. DHA Phase 5, Gulberg III, Model Town, Johar Town)..."
              required={true}
              showMapPicker={true}
              cityBias="lahore"
            />
          </div>

          {/* ========================================================================= */}
          {/* ROWS 3, 4, 5: Work Items & Equipment Details                              */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-1">
            {rows.map((row, index) => {
              const rowTotal =
                (Math.max(0, Number(row.qty) || 0)) *
                (Math.max(0, Number(row.charges) || 0));

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
                    {/* Type Of Work with SearchableCombobox + Blue (+) Button */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Type Of Work:<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1">
                          <SearchableCombobox
                            value={row.typeOfWork}
                            onChange={(val) => handleUpdateRow(row.id, "typeOfWork", val)}
                            options={jobTypes}
                            placeholder="Select or type work..."
                            allowCustom={true}
                            inputClassName="h-10 text-xs font-semibold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowIdForAddType(row.id);
                            setShowAddTypeModal(true);
                          }}
                          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition shadow-xs"
                          title="Add new Type of Work"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Product / Equipment with SearchableCombobox */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Product:
                      </label>
                      <SearchableCombobox
                        value={row.product}
                        onChange={(val) => handleUpdateRow(row.id, "product", val)}
                        options={equipmentTypes}
                        placeholder="Select or type equipment..."
                        allowCustom={true}
                        inputClassName="h-10 text-xs font-semibold"
                      />
                    </div>

                    {/* Brand with SearchableCombobox + Blue (+) Button */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Brand:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1">
                          <SearchableCombobox
                            value={row.brand}
                            onChange={(val) => handleUpdateRow(row.id, "brand", val)}
                            options={brands}
                            placeholder="Select or type brand..."
                            allowCustom={true}
                            inputClassName="h-10 text-xs font-semibold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowIdForAddBrand(row.id);
                            setShowAddBrandModal(true);
                          }}
                          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition shadow-xs"
                          title="Add new Brand"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Care Off with Toggle (Direct vs Care-Of) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          Care Off:<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        {/* Care Off Toggle Switch */}
                        <div className="inline-flex rounded-md p-0.5 bg-slate-100 border border-slate-200 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateRow(row.id, "careOff", "direct")}
                            className={cn(
                              "px-2 py-0.5 rounded transition",
                              row.careOff === "direct"
                                ? "bg-white text-emerald-700 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Direct
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const defaultParty = careOfParties[0]?.id || "corporate";
                              handleUpdateRow(row.id, "careOff", defaultParty);
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded transition",
                              row.careOff !== "direct"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Care-Of
                          </button>
                        </div>
                      </div>

                      {row.careOff === "direct" ? (
                        <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                            <Check className="w-3.5 h-3.5" />
                            Direct / Cash Customer
                          </span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1">
                            <SearchableSelect
                              value={row.careOff}
                              onChange={(val) => handleUpdateRow(row.id, "careOff", val)}
                              options={careOfOptions}
                              placeholder="Select Care-Of Partner..."
                              searchPlaceholder="Search company or person..."
                              className="h-10 bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRowIdForAddCareOf(row.id);
                              setShowAddCareOfModal(true);
                            }}
                            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition shadow-xs"
                            title="Add new Care Off Company"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ROW 4: Qty (0 by default), Charges, Total */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={(e) =>
                          handleUpdateRow(
                            row.id,
                            "qty",
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono font-bold"
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
                        onChange={(e) =>
                          handleUpdateRow(
                            row.id,
                            "charges",
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                        placeholder="Charges in PKR"
                        className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition font-mono font-bold"
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
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition resize-none"
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
            <div className="flex flex-wrap items-center gap-4">
              {/* Technician Dropdown */}
              <div className="w-64">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600">
                    Assign Technician:
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    {presentTechnicians.length} Checked In
                  </span>
                </div>
                <SearchableSelect
                  value={assignedTechnicianId}
                  onChange={(val) => setAssignedTechnicianId(val)}
                  options={technicianOptions}
                  placeholder="Unassigned (Queue in Dispatch)"
                  searchPlaceholder="Search technician..."
                  clearable={true}
                  className="h-10 bg-white"
                />
              </div>

              {/* Payment Mode Toggle Pills */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Payment Collection:
                </label>
                <div className="inline-flex rounded-xl bg-white p-1 border border-slate-300 text-xs font-semibold gap-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("technician")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold",
                      paymentMode === "technician"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        paymentMode === "technician" ? "bg-white" : "bg-emerald-500"
                      )}
                    />
                    Tech Collects
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("office")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold",
                      paymentMode === "office"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        paymentMode === "office" ? "bg-white" : "bg-blue-500"
                      )}
                    />
                    Office Billed
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("foc")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold",
                      paymentMode === "foc"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        paymentMode === "foc" ? "bg-white" : "bg-amber-500"
                      )}
                    />
                    FOC
                  </button>
                </div>

                {paymentMode === "foc" && (
                  <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <span className="text-[11px] font-bold text-amber-700 shrink-0">
                      FOC Reason:*
                    </span>
                    <input
                      type="text"
                      required
                      value={focReason}
                      onChange={(e) => setFocReason(e.target.value)}
                      placeholder="e.g. Warranty Claim / Repeat Visit / VIP Goodwill"
                      className="h-8 px-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900 placeholder:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 flex-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Total & Action Buttons */}
            <div className="flex items-center gap-4 justify-end">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">
                  Grand Total
                </span>
                <span className="text-xl font-bold text-emerald-700 font-mono">
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
