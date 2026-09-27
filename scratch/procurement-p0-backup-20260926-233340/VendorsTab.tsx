"use client";

import React, { useState } from "react";
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Ban,
  ExternalLink,
  Edit2,
  Landmark,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface VendorsTabProps {
  vendors: any[];
  onRefresh: () => void;
  onSelectVendorForPo?: (vendor: any) => void;
}

export default function VendorsTab({
  vendors,
  onRefresh,
  onSelectVendorForPo,
}: VendorsTabProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Form State
  const [vendorCode, setVendorCode] = useState("");
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressText, setAddressText] = useState("");
  const [ntnNumber, setNtnNumber] = useState("");
  const [strnNumber, setStrnNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [currency, setCurrency] = useState("PKR");
  const [bankName, setBankName] = useState("");
  const [bankAccountTitle, setBankAccountTitle] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [category, setCategory] = useState("Spares & Raw Material");
  const [status, setStatus] = useState("Active");
  const [whtRate, setWhtRate] = useState("4.5");

  const openCreateModal = () => {
    setEditingVendor(null);
    setVendorCode(`VND-${String(vendors.length + 1).padStart(4, "0")}`);
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddressText("");
    setNtnNumber("");
    setStrnNumber("");
    setTaxId("");
    setPaymentTerms("Net 30");
    setCurrency("PKR");
    setBankName("Meezan Bank Ltd");
    setBankAccountTitle("");
    setBankAccountNumber("");
    setCategory("Spares & Raw Material");
    setStatus("Active");
    setWhtRate("4.5");
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (v: any) => {
    setEditingVendor(v);
    setVendorCode(v.vendorCode || "");
    setName(v.name || "");
    setContactPerson(v.contactPerson || "");
    setPhone(v.phone || "");
    setEmail(v.email || "");
    setAddressText(v.addressText || "");
    setNtnNumber(v.ntnNumber || "");
    setStrnNumber(v.strnNumber || "");
    setTaxId(v.taxId || "");
    setPaymentTerms(v.paymentTerms || "Net 30");
    setCurrency(v.currency || "PKR");
    setBankName(v.bankName || "");
    setBankAccountTitle(v.bankAccountTitle || "");
    setBankAccountNumber(v.bankAccountNumber || "");
    setCategory(v.category || "Spares & Raw Material");
    setStatus(v.status || "Active");
    setWhtRate(String(v.whtRate ?? "4.5"));
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Vendor Name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload: any = {
        name,
        vendorCode: vendorCode || undefined,
        contactPerson,
        phone,
        email,
        addressText,
        ntnNumber,
        strnNumber,
        taxId: taxId || ntnNumber,
        paymentTerms,
        currency,
        bankName,
        bankAccountTitle,
        bankAccountNumber,
        category,
        status,
        whtRate: Number(whtRate) || 0,
      };

      if (editingVendor) {
        const res = await fetch("/api/procurement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_vendor",
            id: editingVendor.id,
            data: payload,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update vendor");
        }
      } else {
        const res = await fetch("/api/procurement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_vendor",
            ...payload,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create vendor");
        }
      }

      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const matchCat = selectedCategory === "all" || v.category === selectedCategory;
    const matchStat = selectedStatus === "all" || v.status === selectedStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      v.name?.toLowerCase().includes(q) ||
      v.vendorCode?.toLowerCase().includes(q) ||
      v.contactPerson?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.ntnNumber?.toLowerCase().includes(q);
    return matchCat && matchStat && matchSearch;
  });

  const categories = [
    "Raw Material",
    "Spares & Raw Material",
    "Service",
    "Capital",
    "Consumables",
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor name, code, NTN, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Blocked">Blocked</option>
            <option value="Blacklisted">Blacklisted</option>
          </select>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Supplier / Vendor
        </button>
      </div>

      {/* Vendors Table */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Vendor Code & Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Tax & NTN / STRN</th>
                <th className="py-3 px-3">Terms & Bank</th>
                <th className="py-3 px-3 text-right">PO Spend</th>
                <th className="py-3 px-3 text-right">Payable Balance</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B] font-sans">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#71717A]">
                    No vendors found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-[#F8FAFC] transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center font-mono font-bold text-[10px] text-emerald-800 shrink-0">
                          {v.vendorCode?.slice(-4) || "VND"}
                        </div>
                        <div>
                          <div className="font-semibold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors">
                            {v.name}
                          </div>
                          <div className="text-[10px] font-mono text-[#A1A1AA]">
                            {v.vendorCode || "NO-CODE"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-[#71717A] border border-zinc-200">
                        {v.category}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-[#18181B]">
                        {v.contactPerson || "—"}
                      </div>
                      <div className="text-[10px] text-[#71717A] flex items-center gap-2">
                        {v.phone && <span>{v.phone}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      {v.ntnNumber ? (
                        <div>
                          <span className="text-[#71717A]">NTN:</span> {v.ntnNumber}
                        </div>
                      ) : (
                        <span className="text-[#A1A1AA]">No NTN</span>
                      )}
                      {v.strnNumber && (
                        <div className="text-[10px] text-[#71717A]">
                          STRN: {v.strnNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#18181B]">
                        {v.paymentTerms || "Net 30"}
                      </div>
                      <div className="text-[10px] text-[#71717A] truncate max-w-[140px]" title={v.bankName || "No Bank"}>
                        {v.bankName || "No Bank Details"}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#18181B]">
                      {formatCurrency(v.totalPoSpend || 0)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span
                        className={
                          (v.outstandingPayable || 0) > 0
                            ? "text-amber-600"
                            : "text-[#71717A]"
                        }
                      >
                        {formatCurrency(v.outstandingPayable || 0)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          v.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : v.status === "Blocked"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}
                      >
                        {v.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(v)}
                          title="Edit Vendor Master"
                          className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-zinc-100 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onSelectVendorForPo && v.status === "Active" && (
                          <button
                            onClick={() => onSelectVendorForPo(v)}
                            title="Issue Purchase Order"
                            className="text-[10px] bg-zinc-100 hover:bg-[#0D7A5F] hover:text-white text-[#18181B] px-2 py-1 rounded transition font-medium border border-zinc-200"
                          >
                            + Issue PO
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0D7A5F]" />
                  {editingVendor ? "Edit Vendor Master" : "Register New Vendor Master"}
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  FBR Tax Credentials, Bank Accounts & Commercial Credit Terms
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Vendor Identification */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Vendor Code (Auto)
                  </label>
                  <input
                    type="text"
                    value={vendorCode}
                    onChange={(e) => setVendorCode(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="VND-0001"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Vendor Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="e.g. Pak HVAC Spares & Engineering Ltd"
                  />
                </div>
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Category / Type
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Vendor Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Blacklisted">Blacklisted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Immediate">Immediate / Cash</option>
                    <option value="Advance">100% Advance</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="e.g. Tariq Mehmood"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="+92-300-1234567"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="orders@vendor.pk"
                  />
                </div>
              </div>

              {/* Physical Address */}
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Physical Office / Warehouse Address
                </label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  placeholder="Plot #, Street, Industrial Area, City"
                />
              </div>

              {/* Tax Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    NTN Number (7 digits)
                  </label>
                  <input
                    type="text"
                    value={ntnNumber}
                    onChange={(e) => setNtnNumber(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="4198234-1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    STRN / Sales Tax ID
                  </label>
                  <input
                    type="text"
                    value={strnNumber}
                    onChange={(e) => setStrnNumber(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="1700419823418"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    WHT Rate % (ITO Sec 153)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={whtRate}
                    onChange={(e) => setWhtRate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="4.5"
                  />
                </div>
              </div>

              {/* Banking Information */}
              <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#18181B]">
                  <Landmark className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  Bank Account & Settlement Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      placeholder="e.g. Meezan Bank Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                      Account Title
                    </label>
                    <input
                      type="text"
                      value={bankAccountTitle}
                      onChange={(e) => setBankAccountTitle(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      placeholder="Legal Company Title"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                      IBAN / Account Number
                    </label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      placeholder="PK00MEZN01020304050607"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingVendor
                    ? "Update Vendor"
                    : "Save Vendor Master"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
