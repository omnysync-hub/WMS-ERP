"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import AddCustomerDrawer from "@/components/drawers/AddCustomerDrawer";
import { formatCurrency, formatDateTime, formatJobType, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import toast from "@/lib/toast";
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Briefcase,
  Receipt,
  MessageSquare,
  FolderGit2,
  Layers,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  X,
  RefreshCw,
  FileCheck,
  User,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

export default function Customers360Page() {
  const { currentPersona } = useRole();

  // Customer List State
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Selected Customer 360 Full Details State
  const [customer360, setCustomer360] = useState<any | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [activeTab, setActiveTab] = useState<"jobs" | "ledger" | "complaints" | "projects" | "equipment">("jobs");

  // Modals & Drawers
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddLedgerOpen, setIsAddLedgerOpen] = useState(false);
  const [ledgerEntryType, setLedgerEntryType] = useState<"payment" | "invoice" | "credit_note">("payment");
  const [ledgerAmount, setLedgerAmount] = useState("");
  const [ledgerDocNumber, setLedgerDocNumber] = useState("");
  const [ledgerNotes, setLedgerNotes] = useState("");
  const [postingLedger, setPostingLedger] = useState(false);

  const showToast = (msg: string) => {
    toast.success(msg);
  };

  // 1. Fetch Customers Directory
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers?search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
        // Auto-select first customer if none selected
        if (!selectedCustomerId && data.length > 0) {
          setSelectedCustomerId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCustomerId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // 2. Fetch Selected Customer 360 History
  const fetchCustomer360 = useCallback(async (customerId: string) => {
    try {
      setLoading360(true);
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer360(data);
      }
    } catch (err) {
      console.error("Failed loading Customer 360:", err);
    } finally {
      setLoading360(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomer360(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchCustomer360]);

  // 3. Post Direct Customer Ledger Entry
  const handlePostLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !ledgerAmount || Number(ledgerAmount) <= 0) return;

    try {
      setPostingLedger(true);
      const res = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: ledgerEntryType,
          amount: Number(ledgerAmount),
          documentNumber: ledgerDocNumber || undefined,
          notes: ledgerNotes || undefined,
          actorName: currentPersona.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to post ledger entry");
      }

      showToast(`Ledger ${ledgerEntryType.toUpperCase()} entry of PKR ${Number(ledgerAmount).toLocaleString()} recorded successfully!`);
      setIsAddLedgerOpen(false);
      setLedgerAmount("");
      setLedgerDocNumber("");
      setLedgerNotes("");
      fetchCustomer360(selectedCustomerId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPostingLedger(false);
    }
  };

  // Directory Stats Calculations
  const totalCustomers = customers.length;
  const totalActiveJobs = customers.reduce((sum, c) => sum + (c._count?.jobs || 0), 0);

  return (
    <div className="space-y-5 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Customer 360° Records & History"
        subtitle="Comprehensive 360-degree view of client work orders, accounts ledger, service complaints, and warranty history."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-900/10 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-[#E4E4E7] shadow-2xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Total Client Base
          </span>
          <p className="text-2xl font-black text-[#18181B] mt-1 font-mono">
            {totalCustomers}
          </p>
          <span className="text-[11px] text-emerald-700 font-medium">Registered Accounts</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E4E4E7] shadow-2xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Total Work Orders
          </span>
          <p className="text-2xl font-black text-[#0D7A5F] mt-1 font-mono">
            {totalActiveJobs}
          </p>
          <span className="text-[11px] text-[#71717A] font-medium">Historical executions</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E4E4E7] shadow-2xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Selected Client Balance
          </span>
          <p className={cn(
            "text-2xl font-black mt-1 font-mono",
            (customer360?.stats?.ledgerBalance || 0) > 0 ? "text-amber-600" : "text-emerald-700"
          )}>
            {formatCurrency(customer360?.stats?.ledgerBalance || 0)}
          </p>
          <span className="text-[11px] text-[#71717A] font-medium">
            {(customer360?.stats?.ledgerBalance || 0) > 0 ? "Receivable Due" : "Settled / In Credit"}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E4E4E7] shadow-2xs">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            Complaints / Inquiries
          </span>
          <p className="text-2xl font-black text-[#18181B] mt-1 font-mono">
            {customer360?.stats?.totalFeedbackCalls || 0}
          </p>
          <span className="text-[11px] text-[#71717A] font-medium">Call center records</span>
        </div>
      </div>

      {/* Main Split Layout: Customer Selector Directory (Left) + Customer 360 Hub (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CUSTOMER DIRECTORY LIST (col-span-4)                         */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E4E4E7] shadow-sm overflow-hidden flex flex-col h-[760px]">
          {/* List Search Header */}
          <div className="p-3.5 border-b border-[#E4E4E7] bg-[#FAFAFA] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#0D7A5F]" />
                Customer List ({customers.length})
              </span>
              <button
                type="button"
                onClick={fetchCustomers}
                className="p-1 rounded-md text-[#71717A] hover:text-black hover:bg-zinc-200/60 transition"
                title="Refresh list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, address..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#E4E4E7] bg-white text-xs focus:outline-none focus:border-[#0D7A5F] focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          {/* Customer Items Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F4F4F5]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#71717A]">Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#71717A]">
                No customers found matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              customers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={cn(
                      "w-full text-left p-3.5 transition flex items-start justify-between gap-2",
                      isSelected
                        ? "bg-emerald-50/70 border-l-4 border-l-[#0D7A5F]"
                        : "hover:bg-zinc-50/80"
                    )}
                  >
                    <div className="overflow-hidden mr-1">
                      <p className="font-bold text-xs text-[#18181B] truncate">{c.name}</p>
                      <p className="text-[11px] text-[#71717A] font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-[#0D7A5F]" />
                        {c.phone}
                      </p>
                      <p className="text-[10px] text-[#A1A1AA] truncate mt-0.5">
                        {c.addressText}
                      </p>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-bold border border-zinc-200">
                        {c._count?.jobs || 0} jobs
                      </span>
                      <ChevronRight className={cn(
                        "w-3.5 h-3.5 transition",
                        isSelected ? "text-[#0D7A5F] translate-x-0.5" : "text-zinc-300"
                      )} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: COMPLETE 360° PROFILE HUB (col-span-8)                      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E4E4E7] shadow-sm overflow-hidden flex flex-col min-h-[760px]">
          {loading360 ? (
            <div className="p-16 text-center text-xs text-[#71717A] m-auto">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0D7A5F]" />
              Loading complete Customer 360 profile...
            </div>
          ) : !customer360 ? (
            <div className="p-16 text-center text-xs text-[#71717A] m-auto">
              Select a customer on the left to inspect complete 360° operations & ledger history.
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Customer 360 Header Profile Card */}
              <div className="p-5 border-b border-[#E4E4E7] bg-gradient-to-r from-zinc-50 via-white to-emerald-50/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-[#0D7A5F] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-950/20 shrink-0">
                      {customer360.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-[#18181B] tracking-tight">
                          {customer360.name}
                        </h2>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                          ID: {customer360.id.slice(0, 8)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#71717A]">
                        <a
                          href={`tel:${customer360.phone}`}
                          className="font-mono font-semibold text-[#18181B] hover:text-[#0D7A5F] flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#0D7A5F]" />
                          {customer360.phone}
                        </a>
                        {customer360.email && (
                          <a
                            href={`mailto:${customer360.email}`}
                            className="text-[#71717A] hover:text-[#18181B] flex items-center gap-1"
                          >
                            <Mail className="w-3.5 h-3.5 text-[#A1A1AA]" />
                            {customer360.email}
                          </a>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          {customer360.addressText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/jobs/new?customerId=${customer360.id}`}
                      className="px-3 py-1.5 rounded-xl bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold flex items-center gap-1 shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Job</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setIsAddLedgerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-[#E4E4E7] text-xs font-semibold text-zinc-800 flex items-center gap-1 transition"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#0D7A5F]" />
                      <span>Post Ledger Entry</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 360 Navigation Tabs */}
              <div className="px-5 border-b border-[#E4E4E7] bg-white flex items-center gap-6 overflow-x-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("jobs")}
                  className={cn(
                    "py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap",
                    activeTab === "jobs"
                      ? "border-[#0D7A5F] text-[#0D7A5F]"
                      : "border-transparent text-[#71717A] hover:text-[#18181B]"
                  )}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Work Orders & Jobs ({customer360.jobs?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("ledger")}
                  className={cn(
                    "py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap",
                    activeTab === "ledger"
                      ? "border-[#0D7A5F] text-[#0D7A5F]"
                      : "border-transparent text-[#71717A] hover:text-[#18181B]"
                  )}
                >
                  <Receipt className="w-4 h-4" />
                  <span>Sub-Ledger & Invoices ({customer360.customerLedgerEntries?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("complaints")}
                  className={cn(
                    "py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap",
                    activeTab === "complaints"
                      ? "border-[#0D7A5F] text-[#0D7A5F]"
                      : "border-transparent text-[#71717A] hover:text-[#18181B]"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Feedback & Complaints ({customer360.allFeedbackCalls?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("equipment")}
                  className={cn(
                    "py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap",
                    activeTab === "equipment"
                      ? "border-[#0D7A5F] text-[#0D7A5F]"
                      : "border-transparent text-[#71717A] hover:text-[#18181B]"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  <span>Installed Units ({customer360.equipmentHistory?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("projects")}
                  className={cn(
                    "py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap",
                    activeTab === "projects"
                      ? "border-[#0D7A5F] text-[#0D7A5F]"
                      : "border-transparent text-[#71717A] hover:text-[#18181B]"
                  )}
                >
                  <FolderGit2 className="w-4 h-4" />
                  <span>Projects ({customer360.projects?.length || 0})</span>
                </button>
              </div>

              {/* Tab Content Display Area */}
              <div className="flex-1 p-5 overflow-y-auto">
                {/* =============================================================== */}
                {/* TAB 1: WORK ORDERS & JOBS                                       */}
                {/* =============================================================== */}
                {activeTab === "jobs" && (
                  <div className="space-y-3">
                    {customer360.jobs?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#71717A] border border-dashed rounded-xl">
                        No jobs or service work orders created yet for this customer.
                      </div>
                    ) : (
                      <div className="border border-[#E4E4E7] rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase">
                              <th className="py-2.5 px-3">Job Number</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Assigned Tech</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Items / Billed</th>
                              <th className="py-2.5 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E4E7] text-[#18181B]">
                            {customer360.jobs.map((job: any) => {
                              const jobTotal = (job.items || []).reduce(
                                (s: number, it: any) =>
                                  s +
                                  (it.quantityActual !== null && it.quantityActual !== undefined
                                    ? it.quantityActual
                                    : it.quantityPlanned) *
                                    it.unitRate,
                                0
                              ) - (job.discountAmount || 0);

                              return (
                                <tr key={job.id} className="hover:bg-[#FAFAFA] transition">
                                  <td className="py-3 px-3 font-mono font-bold text-[#0D7A5F]">
                                    <Link href={`/jobs/${job.id}`} className="hover:underline flex items-center gap-1">
                                      {job.jobNumber}
                                      <ExternalLink className="w-3 h-3 text-[#A1A1AA]" />
                                    </Link>
                                    {job.manualJobNumber && (
                                      <span className="text-[10px] text-[#A1A1AA] block">
                                        Manual: {job.manualJobNumber}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                                    {formatDateTime(job.createdAt)}
                                  </td>
                                  <td className="py-3 px-3">
                                    {formatJobType(job.jobType) || job.jobType}
                                  </td>
                                  <td className="py-3 px-3 text-[#52525B]">
                                    {job.assignedTechnician ? (
                                      <span className="inline-flex items-center gap-1 font-medium">
                                        <User className="w-3 h-3 text-[#A1A1AA]" />
                                        {job.assignedTechnician.name}
                                      </span>
                                    ) : (
                                      <span className="text-[#A1A1AA] italic">Unassigned</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    <StatusBadge status={job.status} />
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono font-bold">
                                    {formatCurrency(jobTotal)}
                                    <span className="block text-[10px] text-[#A1A1AA] font-normal">
                                      {job.items?.length || 0} line items
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Link
                                      href={`/jobs/${job.id}`}
                                      className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] text-[11px] font-semibold text-zinc-700 transition inline-block"
                                    >
                                      View Details
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* =============================================================== */}
                {/* TAB 2: FINANCIAL SUB-LEDGER & INVOICES                          */}
                {/* =============================================================== */}
                {activeTab === "ledger" && (
                  <div className="space-y-4">
                    {/* Ledger Balance Summary Card */}
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Invoiced (Debits)</span>
                          <span className="text-base font-black font-mono text-zinc-900">
                            {formatCurrency(customer360.stats?.totalDebits || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Payments (Credits)</span>
                          <span className="text-base font-black font-mono text-emerald-700">
                            {formatCurrency(customer360.stats?.totalCredits || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Net Balance Due</span>
                          <span className={cn(
                            "text-base font-black font-mono",
                            (customer360.stats?.ledgerBalance || 0) > 0 ? "text-amber-700" : "text-emerald-700"
                          )}>
                            {formatCurrency(customer360.stats?.ledgerBalance || 0)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsAddLedgerOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Entry / Payment</span>
                      </button>
                    </div>

                    {customer360.customerLedgerEntries?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#71717A] border border-dashed rounded-xl">
                        No financial ledger entries posted for this customer yet.
                      </div>
                    ) : (
                      <div className="border border-[#E4E4E7] rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase font-mono">
                              <th className="py-2.5 px-3">Posting Date</th>
                              <th className="py-2.5 px-3">Document #</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3 text-right">Debit (PKR)</th>
                              <th className="py-2.5 px-3 text-right">Credit (PKR)</th>
                              <th className="py-2.5 px-3 text-right">Running Balance</th>
                              <th className="py-2.5 px-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E4E7] text-[#18181B]">
                            {customer360.customerLedgerEntries.map((e: any) => (
                              <tr key={e.id} className="hover:bg-[#FAFAFA] transition">
                                <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A]">
                                  {formatDateTime(e.postingDate)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-[#18181B]">
                                  {e.documentNumber}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                    e.entryType === "payment"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : e.entryType === "invoice"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-purple-100 text-purple-800"
                                  )}>
                                    {e.entryType}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700">
                                  {e.debit > 0 ? formatCurrency(e.debit) : "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                                  {e.credit > 0 ? formatCurrency(e.credit) : "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-black text-zinc-900">
                                  {formatCurrency(e.runningBalance)}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-[#71717A] max-w-xs truncate">
                                  {e.notes || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* =============================================================== */}
                {/* TAB 3: FEEDBACK, QUALITY CALLS & COMPLAINTS                     */}
                {/* =============================================================== */}
                {activeTab === "complaints" && (
                  <div className="space-y-3">
                    {customer360.allFeedbackCalls?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#71717A] border border-dashed rounded-xl">
                        No quality audit calls or complaints recorded for this customer.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customer360.allFeedbackCalls.map((call: any) => (
                          <div
                            key={call.id}
                            className={cn(
                              "p-4 rounded-xl border transition",
                              call.outcome === "approved"
                                ? "bg-emerald-50/40 border-emerald-200"
                                : call.outcome === "disapproved"
                                ? "bg-rose-50/40 border-rose-200"
                                : "bg-zinc-50 border-zinc-200"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                  call.outcome === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : call.outcome === "disapproved"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                )}>
                                  Outcome: {call.outcome}
                                </span>
                                <Link
                                  href={`/jobs/${call.jobId}`}
                                  className="text-xs font-mono font-bold text-[#0D7A5F] hover:underline"
                                >
                                  Ref Work Order: #{call.jobNumber}
                                </Link>
                              </div>

                              <span className="text-[11px] font-mono text-[#71717A]">
                                {formatDateTime(call.calledAt)}
                              </span>
                            </div>

                            <div className="mt-2 text-xs text-[#18181B] bg-white p-3 rounded-lg border border-zinc-200/80">
                              <span className="font-bold text-[#71717A] text-[10px] uppercase block mb-0.5">
                                Client Remarks / Complaint Log:
                              </span>
                              <p className="italic text-[#3F3F46] leading-relaxed">
                                &ldquo;{call.remarks || "No verbal feedback recorded."}&rdquo;
                              </p>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[11px] text-[#71717A]">
                              <span>Logged by: <strong>{call.calledBy}</strong> (Call Center Quality Desk)</span>
                              {call.followUpDate && (
                                <span className="text-amber-700 font-semibold">
                                  Follow-up scheduled: {formatDateTime(call.followUpDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* =============================================================== */}
                {/* TAB 4: INSTALLED HVAC EQUIPMENT SERVICE HISTORY                */}
                {/* =============================================================== */}
                {activeTab === "equipment" && (
                  <div className="space-y-3">
                    {customer360.equipmentHistory?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#71717A] border border-dashed rounded-xl">
                        No equipment units recorded on job specifications yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {customer360.equipmentHistory.map((eq: any, idx: number) => (
                          <div key={idx} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-900 text-sm">{eq.type}</span>
                              <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-zinc-200 text-[#0D7A5F] font-bold">
                                Work Order #{eq.jobNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-600">
                              <p>Brand: <strong>{eq.brand || "Standard"}</strong> {eq.model && `• Model: ${eq.model}`}</p>
                              {eq.quantity && <p>Units: <strong>{eq.quantity}</strong></p>}
                              {eq.total && <p>Serviced Charge: <strong>{formatCurrency(eq.total)}</strong></p>}
                            </div>
                            <div className="pt-1 border-t border-zinc-200 text-[10px] text-zinc-500 flex items-center justify-between">
                              <span>Tech: {eq.technicianName || "Field Team"}</span>
                              <span>Date: {formatDateTime(eq.serviceDate)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* =============================================================== */}
                {/* TAB 5: COMMERCIAL PROJECTS & BOQS                               */}
                {/* =============================================================== */}
                {activeTab === "projects" && (
                  <div className="space-y-3">
                    {customer360.projects?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#71717A] border border-dashed rounded-xl">
                        No long-term contracts or commercial HVAC projects linked to this customer.
                      </div>
                    ) : (
                      <div className="border border-[#E4E4E7] rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase">
                              <th className="py-2.5 px-3">Project Title</th>
                              <th className="py-2.5 px-3">Code</th>
                              <th className="py-2.5 px-3">Manager</th>
                              <th className="py-2.5 px-3 text-right">Contract Value</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E4E7] text-[#18181B]">
                            {customer360.projects.map((p: any) => (
                              <tr key={p.id} className="hover:bg-[#FAFAFA] transition">
                                <td className="py-3 px-3 font-bold text-zinc-900">{p.name}</td>
                                <td className="py-3 px-3 font-mono text-[11px] text-zinc-500">{p.code}</td>
                                <td className="py-3 px-3 text-zinc-700">{p.projectManager?.name || "—"}</td>
                                <td className="py-3 px-3 text-right font-mono font-bold">
                                  {formatCurrency(p.contractValue || 0)}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: POST CUSTOMER LEDGER ENTRY */}
      {isAddLedgerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Post Ledger Entry</h3>
                  <p className="text-[10px] text-zinc-500">Record customer payment, receipt, or balance adjustment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLedgerOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostLedgerEntry} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-zinc-800 block mb-1">
                  Entry Type *
                </label>
                <select
                  value={ledgerEntryType}
                  onChange={(e: any) => setLedgerEntryType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs bg-zinc-50 focus:bg-white focus:border-[#0D7A5F] outline-none"
                >
                  <option value="payment">Payment Received (Credit Client)</option>
                  <option value="invoice">Manual Invoice / Bill (Debit Client)</option>
                  <option value="credit_note">Credit Note / Rebate (Credit Client)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-800 block mb-1">
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={ledgerAmount}
                  onChange={(e) => setLedgerAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-mono font-bold focus:border-[#0D7A5F] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-800 block mb-1">
                  Document Number (Optional)
                </label>
                <input
                  type="text"
                  value={ledgerDocNumber}
                  onChange={(e) => setLedgerDocNumber(e.target.value)}
                  placeholder="e.g. REC-2026-9041"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-mono focus:border-[#0D7A5F] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-800 block mb-1">
                  Description / Remarks
                </label>
                <textarea
                  value={ledgerNotes}
                  onChange={(e) => setLedgerNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Advance cash received for compressor replacement"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs focus:border-[#0D7A5F] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddLedgerOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingLedger}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  {postingLedger ? "Posting..." : "Confirm & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Quick Add Customer Drawer */}
      <AddCustomerDrawer
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={(c) => {
          showToast(`Customer "${c.name}" added successfully.`);
          fetchCustomers();
          setSelectedCustomerId(c.id);
        }}
      />
    </div>
  );
}
