"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import AddCustomerDrawer from "@/components/drawers/AddCustomerDrawer";
import {
  Briefcase,
  User,
  MapPin,
  Building,
  Plus,
  Check,
  ArrowLeft,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Phone,
  Tag,
  Cpu,
  Layers,
  HelpCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { cn } from "@/lib/utils";

// Standard HVAC Job Types
const COMMON_JOB_TYPES = [
  "Installation & Commissioning",
  "Emergency Repair & Breakdown",
  "Preventive Maintenance Service",
  "AC Gas Recharge & Leakage Repair",
  "Duct Cleaning & Sanitization",
  "Compressor Overhaul & Replacement",
  "System Inspection & Thermostat Audit",
  "Annual Maintenance Contract (AMC)",
];

// Common HVAC Equipment Brands
const HVAC_BRANDS = [
  "Daikin",
  "O General",
  "Mitsubishi Electric",
  "Carrier",
  "Gree",
  "LG",
  "York",
  "Trane",
  "Samsung",
  "Panasonic",
  "Midea",
  "Voltas",
];

export default function NewJobIntakePage() {
  const router = useRouter();

  // Master Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // SECTION 1: Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [initialQueryForDrawer, setInitialQueryForDrawer] = useState("");
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // SECTION 2: Job Details, Product, Care-Of, Remarks & Assignment
  const [selectedJobTypePreset, setSelectedJobTypePreset] = useState("Installation & Commissioning");
  const [customJobType, setCustomJobType] = useState("");
  const [isCustomJobType, setIsCustomJobType] = useState(false);

  // Product: Brand & Model
  const [productBrand, setProductBrand] = useState("Daikin");
  const [productModel, setProductModel] = useState("Inverter Split 2.0 Ton");

  // Care-Of Subcontract Toggle
  const [isCareOf, setIsCareOf] = useState(false);
  const [careOfCompanyName, setCareOfCompanyName] = useState("");
  const [careOfPersonName, setCareOfPersonName] = useState("");
  const [manualJobNumber, setManualJobNumber] = useState("");

  // Remarks
  const [remarks, setRemarks] = useState("");

  // Technician Assignment (Optional - can assign later)
  const [assignedTechnicianId, setAssignedTechnicianId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load Customers & Technicians
  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, techRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/technicians"),
      ]);

      const custList = await custRes.json();
      const techData = await techRes.json();

      if (Array.isArray(custList)) {
        setCustomers(custList);
      }
      if (techData?.technicians) {
        setTechnicians(techData.technicians);
      }
    } catch (err) {
      console.error("Failed to load intake data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selected Customer Object
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Filter customers by phone number or name
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const query = customerSearch.toLowerCase().trim();
    const nameMatch = c.name?.toLowerCase().includes(query);
    const phoneMatch = c.phone?.toLowerCase().includes(query);
    const addressMatch = c.addressText?.toLowerCase().includes(query);
    return nameMatch || phoneMatch || addressMatch;
  });

  // Effective Job Type
  const effectiveJobType = isCustomJobType
    ? customJobType.trim() || "General Service"
    : selectedJobTypePreset;

  const handleProductChange = (brand: string, model: string) => {
    setProductBrand(brand);
    setProductModel(model);
  };

  // Form Submission
  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setErrorMsg("Please select or add a customer.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!effectiveJobType.trim()) {
      setErrorMsg("Please specify the job type.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      // Consolidate remarks with Product (Brand + Model)
      const productPrefix = productBrand || productModel
        ? `[Product: ${productBrand || "Unspecified"} - Model: ${productModel || "Standard"}] `
        : "";
      const fullRemarks = `${productPrefix}${remarks.trim()}`;

      const payload = {
        customerId: selectedCustomerId,
        careOfPartyId: null,
        manualJobNumber: isCareOf ? manualJobNumber : null,
        jobType: effectiveJobType.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30),
        remarks: fullRemarks,
        assignedTechnicianId: assignedTechnicianId || null,
      };

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create job");

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
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: "Intake Work Order" },
        ]}
        title="New HVAC Job Intake"
        subtitle="Book a new customer service order, configure equipment details, and schedule dispatch."
      />

      <div className="flex items-center justify-between">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs Directory
        </Link>
        <span className="text-xs font-mono bg-white border border-[#EDEDED] px-3 py-1 rounded-full text-[#71717A] shadow-2xs">
          Auto-generating JOB-2026-XXXX
        </span>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs rounded-xl font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitJob} className="space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 1: CUSTOMER SEARCH & AUTO-RECOMMEND ADD NEW CUSTOMER              */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDEDED]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  1. Customer & Location
                </h2>
                <p className="text-[11px] text-[#71717A]">
                  Search existing records by name or phone number, or register a new customer on Google Maps.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setInitialQueryForDrawer(customerSearch);
                setIsAddCustomerOpen(true);
              }}
              className="text-xs font-bold text-[#0D7A5F] hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add New Customer
            </button>
          </div>

          {/* If a customer is already selected, display the Customer Card */}
          {selectedCustomer ? (
            <div className="p-4 bg-[#F9FAFB] border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#18181B]">
                    {selectedCustomer.name}
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-[#065F46] font-semibold px-2 py-0.5 rounded-full">
                    Selected Customer
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#52525B]">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-[#71717A]" />
                    {selectedCustomer.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#0D7A5F]" />
                    {selectedCustomer.addressText}
                  </span>
                </div>

                {selectedCustomer.lat && selectedCustomer.lng && (
                  <div className="pt-1">
                    <a
                      href={`https://www.google.com/maps?q=${selectedCustomer.lat},${selectedCustomer.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#0D7A5F] hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <span>Google Maps Location ({selectedCustomer.lat.toFixed(4)}, {selectedCustomer.lng.toFixed(4)})</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId("");
                  setCustomerSearch("");
                }}
                className="text-xs font-semibold text-[#71717A] hover:text-[#18181B] px-3 py-1.5 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F4F4F5] transition self-start sm:self-center"
              >
                Change Customer
              </button>
            </div>
          ) : (
            /* Customer Search Input with Interactive Dropdown */
            <div className="relative" ref={customerDropdownRef}>
              <label className="text-xs font-semibold text-[#18181B] block mb-1.5">
                Search Customer (Searchable by Name or Phone Number)
              </label>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  placeholder="Start typing customer name or phone number (+971...)"
                  value={customerSearch}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  className="w-full bg-[#F4F4F5] pl-9 pr-8 py-2.5 rounded-lg text-xs text-[#18181B] border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none transition shadow-2xs font-medium"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions / Dropdown List */}
              {isCustomerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#EDEDED] rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto divide-y divide-[#EDEDED] text-xs animate-in fade-in zoom-in-95 duration-100">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearch("");
                        }}
                        className="p-3 hover:bg-[#F9FAFB] cursor-pointer flex items-center justify-between transition group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#18181B] group-hover:text-[#0D7A5F]">
                              {c.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
                            {c.phone}
                          </p>
                          <p className="text-[11px] text-[#A1A1AA] truncate max-w-md mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#A1A1AA]" />
                            {c.addressText}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#0D7A5F] opacity-0 group-hover:opacity-100 transition px-2 py-1 bg-emerald-50 rounded">
                          Select
                        </span>
                      </div>
                    ))
                  ) : (
                    /* Customer Not Found: Auto-Recommend Add New Button */
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-[#71717A]">
                        No matching customer found for <strong className="text-[#18181B]">"{customerSearch}"</strong>
                      </p>
                    </div>
                  )}

                  {/* Auto-Recommend Add New Customer Action */}
                  <div className="p-2 bg-[#F9FAFB] sticky bottom-0 border-t border-[#EDEDED]">
                    <button
                      type="button"
                      onClick={() => {
                        setInitialQueryForDrawer(customerSearch);
                        setIsAddCustomerOpen(true);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="w-full p-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] font-bold text-xs flex items-center justify-between transition border border-emerald-200"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        {customerSearch.trim()
                          ? `Add "${customerSearch.trim()}" as New Customer`
                          : "Add New Customer (with Google Maps)"}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#0D7A5F] text-white">
                        + New Record
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: JOB TYPE, PRODUCT (BRAND + MODEL), CARE OF, REMARKS, ASSIGN    */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED] space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#EDEDED]">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                2. Job Classification & Equipment Details
              </h2>
              <p className="text-[11px] text-[#71717A]">
                Select job type, equipment brand & model, subcontracting status, notes, and dispatch technician.
              </p>
            </div>
          </div>

          <div className="space-y-5 text-xs">
            {/* 1. JOB TYPE: Select or Type from Dropdown */}
            <div>
              <label className="font-semibold text-[#18181B] block mb-1.5">
                Job Type (Select or Type Custom) *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <select
                    value={isCustomJobType ? "CUSTOM" : selectedJobTypePreset}
                    onChange={(e) => {
                      if (e.target.value === "CUSTOM") {
                        setIsCustomJobType(true);
                      } else {
                        setIsCustomJobType(false);
                        setSelectedJobTypePreset(e.target.value);
                      }
                    }}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
                  >
                    {COMMON_JOB_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Type Custom Job Type...</option>
                  </select>
                </div>

                {isCustomJobType && (
                  <div>
                    <input
                      type="text"
                      placeholder="Type custom job type (e.g. Chiller Chemical Flushing)..."
                      value={customJobType}
                      onChange={(e) => setCustomJobType(e.target.value)}
                      className="w-full bg-white p-2.5 rounded-lg border border-[#0D7A5F] focus:outline-none text-[#18181B] font-medium animate-in fade-in"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 2. PRODUCT: Brand & Model */}
            <div className="pt-2 border-t border-[#EDEDED]">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-3.5 h-3.5 text-[#0D7A5F]" />
                <span className="font-bold text-xs text-[#18181B] uppercase tracking-wider">
                  Product / HVAC Equipment Details
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Brand */}
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Brand (Type or Select)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="hvac-brands-list"
                      placeholder="e.g. Daikin, O General, Mitsubishi, Carrier..."
                      value={productBrand}
                      onChange={(e) => handleProductChange(e.target.value, productModel)}
                      className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
                    />
                    <datalist id="hvac-brands-list">
                      {HVAC_BRANDS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Model */}
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Model / Unit Specification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Inverter Split 2.0 Ton / VRV IV Outdoor / FCU 3-Ton"
                    value={productModel}
                    onChange={(e) => handleProductChange(productBrand, e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
                  />
                </div>
              </div>
            </div>

            {/* 3. CARE-OF TOGGLE BUTTON & SUB-FIELDS */}
            <div className="pt-2 border-t border-[#EDEDED]">
              <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <div className="flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-[#71717A]" />
                  <div>
                    <span className="font-bold text-xs text-[#18181B] block">
                      Care-Of / Subcontracted Order
                    </span>
                    <span className="text-[11px] text-[#71717A]">
                      Enable if this job is performed on behalf of a facility management company or third party.
                    </span>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsCareOf(!isCareOf)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isCareOf ? "bg-[#0D7A5F]" : "bg-[#D4D4D8]"
                  )}
                  role="switch"
                  aria-checked={isCareOf}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isCareOf ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Care Of Subcontract Fields */}
              {isCareOf && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 mt-2 bg-[#F4F4F5] rounded-xl border border-[#EDEDED] animate-in fade-in">
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">
                      Care Of Company Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Facilities Group"
                      value={careOfCompanyName}
                      onChange={(e) => setCareOfCompanyName(e.target.value)}
                      className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">
                      Care Of Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Engr. Rashid Al-Kaabi"
                      value={careOfPersonName}
                      onChange={(e) => setCareOfPersonName(e.target.value)}
                      className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">
                      External Job #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. APX-9981"
                      value={manualJobNumber}
                      onChange={(e) => setManualJobNumber(e.target.value)}
                      className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. REMARKS SECTION */}
            <div className="pt-2 border-t border-[#EDEDED]">
              <label className="font-semibold text-[#18181B] block mb-1.5">
                Remarks / Problem Description & Caller Notes
              </label>
              <textarea
                rows={3}
                placeholder="Describe caller symptoms, site access codes, error codes on display, or special instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] resize-none"
              />
            </div>

            {/* 5. LASTLY: ASSIGN TECHNICIAN (With "Assign Later" option) */}
            <div className="pt-2 border-t border-[#EDEDED]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-[#18181B] block">
                  Assign Technician (Optional — Dispatcher can assign later)
                </label>
                <span className="text-[11px] text-[#71717A]">
                  {assignedTechnicianId ? "Directly Assigned" : "Queued for Later Dispatch"}
                </span>
              </div>

              <select
                value={assignedTechnicianId}
                onChange={(e) => setAssignedTechnicianId(e.target.value)}
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              >
                <option value="">
                  ⏳ Assign Later (Leave Unassigned for Dispatcher)
                </option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    🔧 {t.name} — Status: {t.currentStatus}
                  </option>
                ))}
              </select>

              {!assignedTechnicianId && (
                <p className="text-[11px] text-[#71717A] mt-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Job will be created in <strong>"Created" (Unassigned)</strong> status, appearing in the Dispatch Map & Dispatcher Queue for proximity-based dispatch.
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/jobs"
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? "Creating Work Order..." : "Create Work Order"}
          </button>
        </div>
      </form>

      {/* Slide-over Add Customer Drawer */}
      <AddCustomerDrawer
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        initialQuery={initialQueryForDrawer}
        onCustomerCreated={(newCust) => {
          setCustomers([newCust, ...customers]);
          setSelectedCustomerId(newCust.id);
        }}
      />
    </div>
  );
}
