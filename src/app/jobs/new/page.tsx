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
  Phone,
  Cpu,
  AlertCircle,
  X,
  Package,
  Wrench,
  Trash2,
  Receipt,
  Boxes,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { cn, formatCurrency } from "@/lib/utils";

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

// Common HVAC Equipment Types
const COMMON_EQUIPMENT_TYPES = [
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

// Common HVAC Equipment Brands
const HVAC_BRANDS = [
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

// Quick HVAC Service Presets with Standard Market Rates (PKR)
const COMMON_SERVICE_PRESETS = [
  { name: "AC Installation & Commissioning", rate: 4500 },
  { name: "AC Gas Leakage Test & Full Recharge", rate: 5500 },
  { name: "General Chemical Master Servicing", rate: 2500 },
  { name: "Compressor Replacement & Vacuum Labor", rate: 7500 },
  { name: "Inverter PCB Board Repair / Replacement Labor", rate: 3500 },
  { name: "Capacitor & Contactor Replacement Labor", rate: 1200 },
  { name: "Thermostat Installation & Wiring", rate: 1800 },
  { name: "Duct Cleaning & Sanitization Service", rate: 6000 },
  { name: "Diagnostic & Fault Troubleshooting Fee", rate: 1500 },
];

interface ProductLineItem {
  id: string;
  productId?: string;
  name: string;
  sku?: string;
  unit?: string;
  availableStock?: number;
  quantity: number;
  unitRate: number;
}

interface ServiceLineItem {
  id: string;
  name: string;
  quantity: number;
  unitRate: number;
}

export default function NewJobIntakePage() {
  const router = useRouter();

  // Master Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // SECTION 1: Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [initialQueryForDrawer, setInitialQueryForDrawer] = useState("");
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // SECTION 2: Job Classification & Equipment Details
  const [selectedJobTypePreset, setSelectedJobTypePreset] = useState("Installation & Commissioning");
  const [customJobType, setCustomJobType] = useState("");
  const [isCustomJobType, setIsCustomJobType] = useState(false);

  // Product, Brand & Model
  const [productType, setProductType] = useState("Inverter AC (1.0 / 1.5 / 2.0 Ton)");
  const [productBrand, setProductBrand] = useState("Gree");
  const [productModel, setProductModel] = useState("Inverter Split 1.5 Ton Fairy Series");

  // SECTION 3: Line Items & Charges (Products from Inventory + Services)
  const [productLines, setProductLines] = useState<ProductLineItem[]>([]);
  const [serviceLines, setServiceLines] = useState<ServiceLineItem[]>([
    {
      id: "srv-initial-1",
      name: "AC Installation & Commissioning",
      quantity: 1,
      unitRate: 4500,
    },
  ]);

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

  // Load Customers, Technicians, and Inventory Products
  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, techRes, invRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/technicians"),
        fetch("/api/inventory"),
      ]);

      const custList = await custRes.json();
      const techData = await techRes.json();
      const invData = await invRes.json();

      if (Array.isArray(custList)) {
        setCustomers(custList);
      }
      if (techData?.technicians) {
        setTechnicians(techData.technicians);
      }
      if (Array.isArray(invData)) {
        setInventoryProducts(invData);
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

  // PRODUCT LINES MANAGEMENT (Linked with Inventory)
  const handleAddProductLine = () => {
    const defaultProd = inventoryProducts[0];
    const newLine: ProductLineItem = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: defaultProd?.id || "",
      name: defaultProd?.name || "",
      sku: defaultProd?.sku || "",
      unit: defaultProd?.unit || "unit",
      availableStock: defaultProd?.stockQuantity ?? 0,
      quantity: 1,
      unitRate: defaultProd?.unitPrice || 0,
    };
    setProductLines([...productLines, newLine]);
  };

  const handleSelectInventoryProduct = (lineId: string, selectedProdId: string) => {
    if (selectedProdId === "CUSTOM") {
      setProductLines(
        productLines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                productId: "",
                name: "",
                sku: "",
                unit: "unit",
                availableStock: undefined,
                unitRate: 0,
              }
            : line
        )
      );
      return;
    }

    const prod = inventoryProducts.find((p) => p.id === selectedProdId);
    if (!prod) return;

    setProductLines(
      productLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              productId: prod.id,
              name: prod.name,
              sku: prod.sku,
              unit: prod.unit,
              availableStock: prod.stockQuantity,
              unitRate: prod.unitPrice || 0,
            }
          : line
      )
    );
  };

  const handleUpdateProductLine = (
    lineId: string,
    field: "name" | "quantity" | "unitRate",
    value: any
  ) => {
    setProductLines(
      productLines.map((line) => {
        if (line.id !== lineId) return line;
        if (field === "quantity") {
          return { ...line, quantity: Math.max(1, Number(value) || 1) };
        }
        if (field === "unitRate") {
          return { ...line, unitRate: Math.max(0, Number(value) || 0) };
        }
        return { ...line, [field]: value };
      })
    );
  };

  const handleRemoveProductLine = (lineId: string) => {
    setProductLines(productLines.filter((l) => l.id !== lineId));
  };

  // SERVICE LINES MANAGEMENT
  const handleAddServiceLine = () => {
    const defaultSrv = COMMON_SERVICE_PRESETS[0];
    const newLine: ServiceLineItem = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: defaultSrv?.name || "General HVAC Labor",
      quantity: 1,
      unitRate: defaultSrv?.rate || 2000,
    };
    setServiceLines([...serviceLines, newLine]);
  };

  const handleUpdateServiceLine = (
    lineId: string,
    field: "name" | "quantity" | "unitRate",
    value: any
  ) => {
    setServiceLines(
      serviceLines.map((line) => {
        if (line.id !== lineId) return line;
        if (field === "quantity") {
          return { ...line, quantity: Math.max(1, Number(value) || 1) };
        }
        if (field === "unitRate") {
          return { ...line, unitRate: Math.max(0, Number(value) || 0) };
        }
        return { ...line, [field]: value };
      })
    );
  };

  const handleRemoveServiceLine = (lineId: string) => {
    setServiceLines(serviceLines.filter((l) => l.id !== lineId));
  };

  // CHARGES FINANCIAL SUMMARY
  const productsSubtotal = productLines.reduce(
    (sum, l) => sum + l.quantity * (l.unitRate || 0),
    0
  );
  const servicesSubtotal = serviceLines.reduce(
    (sum, l) => sum + l.quantity * (l.unitRate || 0),
    0
  );
  const totalEstimatedCharges = productsSubtotal + servicesSubtotal;

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

      // Consolidate remarks with Product (Product Type, Brand & Model)
      const equipPrefix = `[Equipment: ${productType || "HVAC Unit"} | Brand: ${
        productBrand || "Unspecified"
      } | Model: ${productModel || "Standard"}] `;
      const fullRemarks = `${equipPrefix}${remarks.trim()}`;

      // Build consolidated items array for backend JobItem records
      const combinedItems = [
        ...productLines
          .filter((l) => l.name.trim())
          .map((l) => ({
            description: `[Product] ${l.name}${l.sku ? ` (${l.sku})` : ""}`,
            quantityPlanned: l.quantity,
            unitRate: l.unitRate,
            productId: l.productId || null,
            isProduct: true,
          })),
        ...serviceLines
          .filter((s) => s.name.trim())
          .map((s) => ({
            description: `[Service] ${s.name}`,
            quantityPlanned: s.quantity,
            unitRate: s.unitRate,
            productId: null,
            isProduct: false,
          })),
      ];

      const payload = {
        customerId: selectedCustomerId,
        careOfPartyId: null,
        manualJobNumber: isCareOf ? manualJobNumber : null,
        jobType: effectiveJobType.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30),
        remarks: fullRemarks,
        assignedTechnicianId: assignedTechnicianId || null,
        items: combinedItems,
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
    <div className="space-y-6 max-w-5xl mx-auto pb-24 animate-in fade-in">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: "Intake Work Order" },
        ]}
        title="New HVAC Job Intake"
        subtitle="Book a service order, define equipment specs, link inventory parts, and set service charges."
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
                  Search existing customer records or register a new customer with map coordinates.
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
                  placeholder="Start typing customer name or phone number (+92...)"
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
                          <p className="font-bold text-[#18181B] group-hover:text-[#0D7A5F]">
                            {c.name}
                          </p>
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
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-[#71717A]">
                        No matching customer found for <strong className="text-[#18181B]">"{customerSearch}"</strong>
                      </p>
                    </div>
                  )}

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
                          : "Add New Customer"}
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
        {/* SECTION 2: JOB CLASSIFICATION & EQUIPMENT SPECIFICATION                   */}
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
                Select job type, equipment product type before brand, brand, and unit model.
              </p>
            </div>
          </div>

          <div className="space-y-5 text-xs">
            {/* 1. JOB TYPE: Select or Type from Dropdown */}
            <div>
              <label className="font-semibold text-[#18181B] block mb-1.5">
                Job Nature / Type *
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

            {/* 2. PRODUCT SPECIFICATION: PRODUCT TYPE (BEFORE BRAND) -> BRAND -> MODEL */}
            <div className="pt-2 border-t border-[#EDEDED]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  <span className="font-bold text-xs text-[#18181B] uppercase tracking-wider">
                    Equipment Details (Product Type, Brand & Model)
                  </span>
                </div>
                <span className="text-[11px] text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded font-mono">
                  Product column placed before Brand
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Product Column (Placed BEFORE Brand as requested) */}
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Product / Appliance Type *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="hvac-equipment-products-list"
                      placeholder="e.g. Inverter AC 1.5 Ton, Chiller..."
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
                    />
                    <datalist id="hvac-equipment-products-list">
                      {COMMON_EQUIPMENT_TYPES.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </div>
                  <span className="text-[10px] text-[#71717A] mt-1 block">
                    Type or pick from standard HVAC equipment types
                  </span>
                </div>

                {/* Brand */}
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Equipment Brand (Type or Select)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="hvac-brands-list"
                      placeholder="e.g. Daikin, Gree, Haier, Carrier..."
                      value={productBrand}
                      onChange={(e) => setProductBrand(e.target.value)}
                      className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
                    />
                    <datalist id="hvac-brands-list">
                      {HVAC_BRANDS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                  <span className="text-[10px] text-[#71717A] mt-1 block">
                    Brand manufacturer
                  </span>
                </div>

                {/* Model */}
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Model / Unit Specification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Inverter Split 1.5 Ton / VRV IV Outdoor"
                    value={productModel}
                    onChange={(e) => setProductModel(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
                  />
                  <span className="text-[10px] text-[#71717A] mt-1 block">
                    Serial or series specification
                  </span>
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
                      Enable if this job is billed through or performed on behalf of a 3rd party contractor.
                    </span>
                  </div>
                </div>

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
                      placeholder="e.g. Engr. Usman Khan"
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
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: SCOPE OF WORK, PRODUCTS (INVENTORY) & SERVICE CHARGES           */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED] space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDEDED]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  3. Line Items & Charges (Products from Inventory & Services)
                </h2>
                <p className="text-[11px] text-[#71717A]">
                  Add multiple products (linked with inventory stock & prices) and multiple service labor charges.
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-[#71717A] block font-medium">Estimated Job Total:</span>
              <span className="text-base font-extrabold text-[#0D7A5F] font-mono">
                {formatCurrency(totalEstimatedCharges)}
              </span>
            </div>
          </div>

          {/* 3A. PRODUCT LINES (LINKED WITH INVENTORY) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0D7A5F]" />
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Product / Parts Lines (Linked with Live Inventory)
                </span>
                <span className="text-[10px] bg-emerald-50 text-[#0D7A5F] border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  {productLines.length} {productLines.length === 1 ? "part" : "parts"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddProductLine}
                className="text-xs font-bold text-[#0D7A5F] hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add Product Line
              </button>
            </div>

            {productLines.length === 0 ? (
              <div className="p-5 border border-dashed border-[#EDEDED] rounded-xl text-center space-y-2 bg-[#FAFAFA]">
                <Boxes className="w-6 h-6 text-[#A1A1AA] mx-auto" />
                <p className="text-xs text-[#71717A]">
                  No inventory products or physical parts added yet for this job.
                </p>
                <button
                  type="button"
                  onClick={handleAddProductLine}
                  className="text-xs font-bold text-[#0D7A5F] hover:underline"
                >
                  Click to select products from warehouse inventory
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {productLines.map((line, idx) => {
                  const lineTotal = line.quantity * (line.unitRate || 0);
                  const isLowStock =
                    line.availableStock !== undefined && line.availableStock <= 5;
                  const isOutOfStock =
                    line.availableStock !== undefined && line.availableStock <= 0;

                  return (
                    <div
                      key={line.id}
                      className="p-3.5 bg-[#F9FAFB] border border-[#EDEDED] rounded-xl flex flex-col md:flex-row items-start md:items-center gap-3 text-xs animate-in fade-in"
                    >
                      {/* Product Selector / Name */}
                      <div className="flex-1 w-full md:w-auto">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Product / Part #{idx + 1}
                        </label>
                        <select
                          value={line.productId || "CUSTOM"}
                          onChange={(e) => handleSelectInventoryProduct(line.id, e.target.value)}
                          className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none font-medium text-[#18181B]"
                        >
                          <optgroup label="Warehouse Inventory Products">
                            {inventoryProducts.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} ({inv.sku}) — Stock: {inv.stockQuantity} {inv.unit} @ {formatCurrency(inv.unitPrice)}
                              </option>
                            ))}
                          </optgroup>
                          <option value="CUSTOM">+ Custom / Non-Catalog Product...</option>
                        </select>

                        {/* Custom product name input if CUSTOM */}
                        {!line.productId && (
                          <input
                            type="text"
                            placeholder="Type custom product name or model..."
                            value={line.name}
                            onChange={(e) => handleUpdateProductLine(line.id, "name", e.target.value)}
                            className="w-full mt-1.5 bg-white p-1.5 text-xs rounded border border-[#0D7A5F] focus:outline-none font-medium"
                          />
                        )}

                        {/* Stock & SKU badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {line.sku && (
                            <span className="text-[10px] font-mono text-[#52525B] bg-[#E4E4E7] px-1.5 py-0.5 rounded">
                              SKU: {line.sku}
                            </span>
                          )}
                          {line.availableStock !== undefined && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                                isOutOfStock
                                  ? "bg-rose-100 text-rose-800"
                                  : isLowStock
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-[#065F46]"
                              )}
                            >
                              {isOutOfStock
                                ? "Out of Stock (0)"
                                : `${line.availableStock} in inventory`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="w-full md:w-28">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Qty ({line.unit || "unit"})
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(e) =>
                            handleUpdateProductLine(line.id, "quantity", e.target.value)
                          }
                          className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none font-mono text-center font-bold text-[#18181B]"
                        />
                      </div>

                      {/* Unit Price / Charge */}
                      <div className="w-full md:w-36">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Unit Rate (PKR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={line.unitRate}
                          onChange={(e) =>
                            handleUpdateProductLine(line.id, "unitRate", e.target.value)
                          }
                          className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none font-mono text-right font-semibold text-[#18181B]"
                        />
                      </div>

                      {/* Line Subtotal */}
                      <div className="w-full md:w-36 text-right">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Line Total
                        </label>
                        <div className="p-2 font-mono font-bold text-[#18181B] bg-white rounded-lg border border-[#EDEDED] text-right">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>

                      {/* Remove */}
                      <div className="self-end md:self-center pt-2 md:pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveProductLine(line.id)}
                          className="p-2 text-[#71717A] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end pr-1 text-xs text-[#71717A]">
                  <span>Products Subtotal:&nbsp;</span>
                  <span className="font-mono font-bold text-[#18181B]">
                    {formatCurrency(productsSubtotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3B. SERVICE LINES (LABOR & CHARGES) */}
          <div className="space-y-3 pt-4 border-t border-[#EDEDED]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#0D7A5F]" />
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Service Lines & Labor Charges
                </span>
                <span className="text-[10px] bg-emerald-50 text-[#0D7A5F] border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  {serviceLines.length} {serviceLines.length === 1 ? "service" : "services"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddServiceLine}
                className="text-xs font-bold text-[#0D7A5F] hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add Service Line
              </button>
            </div>

            {serviceLines.length === 0 ? (
              <div className="p-5 border border-dashed border-[#EDEDED] rounded-xl text-center space-y-2 bg-[#FAFAFA]">
                <Wrench className="w-6 h-6 text-[#A1A1AA] mx-auto" />
                <p className="text-xs text-[#71717A]">
                  No service lines or labor charges added yet.
                </p>
                <button
                  type="button"
                  onClick={handleAddServiceLine}
                  className="text-xs font-bold text-[#0D7A5F] hover:underline"
                >
                  Click to add service labor charges
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {serviceLines.map((srv, idx) => {
                  const srvTotal = srv.quantity * (srv.unitRate || 0);

                  return (
                    <div
                      key={srv.id}
                      className="p-3.5 bg-[#F9FAFB] border border-[#EDEDED] rounded-xl flex flex-col md:flex-row items-start md:items-center gap-3 text-xs animate-in fade-in"
                    >
                      {/* Service Name / Suggestion */}
                      <div className="flex-1 w-full md:w-auto">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block">
                            Service Task #{idx + 1}
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#71717A]">Quick Presets:</span>
                            <select
                              onChange={(e) => {
                                const selected = COMMON_SERVICE_PRESETS.find(
                                  (p) => p.name === e.target.value
                                );
                                if (selected) {
                                  handleUpdateServiceLine(srv.id, "name", selected.name);
                                  handleUpdateServiceLine(srv.id, "unitRate", selected.rate);
                                }
                              }}
                              className="text-[10px] bg-white border border-[#EDEDED] rounded px-1.5 py-0.5 text-[#52525B]"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Pick Preset...
                              </option>
                              {COMMON_SERVICE_PRESETS.map((p) => (
                                <option key={p.name} value={p.name}>
                                  {p.name} ({formatCurrency(p.rate)})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="e.g. AC Installation, Coil Chemical Wash, Gas Recharge..."
                          value={srv.name}
                          onChange={(e) => handleUpdateServiceLine(srv.id, "name", e.target.value)}
                          className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none font-medium text-[#18181B]"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="w-full md:w-28">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Units / Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={srv.quantity}
                          onChange={(e) =>
                            handleUpdateServiceLine(srv.id, "quantity", e.target.value)
                          }
                          className="w-full bg-white p-2 rounded-lg border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none font-mono text-center font-bold text-[#18181B]"
                        />
                      </div>

                      {/* Service Rate / Charge (Money) */}
                      <div className="w-full md:w-36">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Service Charge (PKR) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={srv.unitRate}
                          onChange={(e) =>
                            handleUpdateServiceLine(srv.id, "unitRate", e.target.value)
                          }
                          className="w-full bg-white p-2 rounded-lg border border-[#0D7A5F] focus:outline-none font-mono text-right font-semibold text-[#18181B]"
                          placeholder="Enter money..."
                        />
                      </div>

                      {/* Line Subtotal */}
                      <div className="w-full md:w-36 text-right">
                        <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                          Service Total
                        </label>
                        <div className="p-2 font-mono font-bold text-[#18181B] bg-white rounded-lg border border-[#EDEDED] text-right">
                          {formatCurrency(srvTotal)}
                        </div>
                      </div>

                      {/* Remove */}
                      <div className="self-end md:self-center pt-2 md:pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceLine(srv.id)}
                          className="p-2 text-[#71717A] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove service"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end pr-1 text-xs text-[#71717A]">
                  <span>Services Subtotal:&nbsp;</span>
                  <span className="font-mono font-bold text-[#18181B]">
                    {formatCurrency(servicesSubtotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3C. SECTION OF CHARGES & FINANCIAL SUMMARY CARD */}
          <div className="p-5 bg-gradient-to-br from-[#F9FAFB] to-[#F4F4F5] border border-[#EDEDED] rounded-xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E4E4E7]">
              <Sparkles className="w-4 h-4 text-[#0D7A5F]" />
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Work Order Quotation & Financial Summary
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-white rounded-lg border border-[#EDEDED] shadow-2xs">
                <span className="text-[#71717A] block text-[11px] mb-1">Products / Parts Total</span>
                <span className="font-mono text-sm font-bold text-[#18181B]">
                  {formatCurrency(productsSubtotal)}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-0.5">
                  {productLines.length} product {productLines.length === 1 ? "line" : "lines"}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#EDEDED] shadow-2xs">
                <span className="text-[#71717A] block text-[11px] mb-1">Services & Labor Total</span>
                <span className="font-mono text-sm font-bold text-[#18181B]">
                  {formatCurrency(servicesSubtotal)}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-0.5">
                  {serviceLines.length} service {serviceLines.length === 1 ? "line" : "lines"}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[#065F46] block text-[11px] font-semibold mb-1">
                  Grand Total Estimated Charges
                </span>
                <span className="font-mono text-base font-extrabold text-[#0D7A5F]">
                  {formatCurrency(totalEstimatedCharges)}
                </span>
                <span className="text-[10px] text-[#065F46] block mt-0.5 font-medium">
                  Planned for customer invoice
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: REMARKS & TECHNICIAN DISPATCH ASSIGNMENT                       */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED] space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#EDEDED]">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                4. Operational Notes & Technician Assignment
              </h2>
              <p className="text-[11px] text-[#71717A]">
                Add customer problem description and assign a field technician or defer to dispatcher.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Remarks Section */}
            <div>
              <label className="font-semibold text-[#18181B] block mb-1.5">
                Remarks / Problem Description & Caller Notes
              </label>
              <textarea
                rows={3}
                placeholder="Describe caller symptoms, site access codes, error codes on display, or special customer instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] resize-none"
              />
            </div>

            {/* Assign Technician */}
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
