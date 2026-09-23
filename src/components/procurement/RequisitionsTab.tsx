"use client";

import React, { useState } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  AlertTriangle,
  Building,
  Paperclip,
  Trash2,
  Eye,
  Send,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";

interface RequisitionsTabProps {
  prs: any[];
  vendors: any[];
  products: any[];
  onRefresh: () => void;
  onNavigateToRfq?: (pr: any) => void;
}

export default function RequisitionsTab({
  prs,
  vendors,
  products,
  onRefresh,
  onNavigateToRfq,
}: RequisitionsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Create PR Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prAgainst, setPrAgainst] = useState<"store" | "job" | "project">("store");
  const [linkedJobNumber, setLinkedJobNumber] = useState("");
  const [requestedBy, setRequestedBy] = useState("Bilal Sheikh (Warehouse)");
  const [department, setDepartment] = useState("Central Warehouse");
  const [site, setSite] = useState("Central Workshop, Lahore");
  const [dateRequired, setDateRequired] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [costCenter, setCostCenter] = useState("CC-STORE-01");
  const [projectCode, setProjectCode] = useState("");
  const [budgetCode, setBudgetCode] = useState("OPEX-2026-STORE");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState("");

  const [items, setItems] = useState<
    {
      productId: string;
      itemCode: string;
      description: string;
      quantity: number;
      unit: string;
      estimatedPrice: number;
    }[]
  >([
    {
      productId: "",
      itemCode: "",
      description: "",
      quantity: 10,
      unit: "pcs",
      estimatedPrice: 0,
    },
  ]);

  // Selected PR Details Drawer
  const [selectedPr, setSelectedPr] = useState<any | null>(null);

  // Rejection Reason Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Convert to PO Modal
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertVendorId, setConvertVendorId] = useState("");
  const [convertPoType, setConvertPoType] = useState<"standard" | "blanket" | "service">("standard");
  const [convertDeliveryDate, setConvertDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Handlers for Items in Form
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        itemCode: "",
        description: "",
        quantity: 5,
        unit: "unit",
        estimatedPrice: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleProductSelect = (index: number, pId: string) => {
    const product = products.find((p) => p.id === pId);
    const updated = [...items];
    if (product) {
      updated[index] = {
        productId: product.id,
        itemCode: product.sku,
        description: product.name,
        quantity: updated[index].quantity || 1,
        unit: product.unit || "unit",
        estimatedPrice: product.costPrice || 0,
      };
    } else {
      updated[index].productId = "";
    }
    setItems(updated);
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  const calculatedTotal = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.estimatedPrice) || 0),
    0
  );

  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((i) => !i.description.trim() && !i.productId)) {
      setFormError("Please provide description or select product for all items.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const formattedNotes = `[Target: ${
        prAgainst === "store"
          ? "Central Store Replenishment"
          : prAgainst === "job"
          ? `Job Order #${linkedJobNumber}`
          : "Project Site Engineering"
      }] ${notes}`.trim();

      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_pr",
          requestedBy,
          department,
          site,
          dateRequired,
          priority,
          costCenter,
          projectCode: prAgainst === "job" ? linkedJobNumber : projectCode,
          budgetCode,
          notes: formattedNotes,
          attachments,
          items,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create PR");
      }

      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to submit PR");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    status: "submitted" | "approved" | "rejected",
    reason?: string
  ) => {
    if (!selectedPr) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: `${status}_pr`,
          id: selectedPr.id,
          actorName: status === "approved" ? "Haris Qureshi (Managing Director)" : "Bilal Sheikh (Storekeeper)",
          reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }

      setShowRejectModal(false);
      setSelectedPr(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Error updating status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPr || !convertVendorId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_pr_to_po",
          prIds: [selectedPr.id],
          vendorId: convertVendorId,
          poType: convertPoType,
          expectedDeliveryDate: convertDeliveryDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to convert PR to PO");
      }

      setShowConvertModal(false);
      setSelectedPr(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Error converting to PO");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPrs = prs.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchPriority = priorityFilter === "all" || p.priority === priorityFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.prNumber?.toLowerCase().includes(q) ||
      p.requestedBy?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q);
    return matchStatus && matchPriority && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search PR number, requester, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D4D4D8] rounded-lg text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All PR Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted (Pending Approval)</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="converted_to_po">Converted to PO</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Priorities</option>
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setFormError("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Purchase Requisition
        </button>
      </div>

      {/* PR Table */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">PR Number & Date</th>
                <th className="py-3 px-3">Department & Site</th>
                <th className="py-3 px-3">Requested By</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3">Required By</th>
                <th className="py-3 px-3">Items</th>
                <th className="py-3 px-3 text-right">Est. Amount</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredPrs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#A1A1AA]">
                    No purchase requisitions found. Click &quot;Create Purchase Requisition&quot; to initiate a procurement request.
                  </td>
                </tr>
              ) : (
                filteredPrs.map((pr) => {
                  const estTotal = (pr.items || []).reduce(
                    (sum: number, it: any) => sum + (it.quantity || 0) * (it.estimatedPrice || 0),
                    0
                  );

                  return (
                    <tr
                      key={pr.id}
                      className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                      onClick={() => setSelectedPr(pr)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors">
                          {pr.prNumber}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] font-mono">
                          {formatDateTime(pr.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-[#18181B]">
                          {pr.department || "Operations"}
                        </div>
                        <div className="text-[10px] text-[#71717A] truncate max-w-[140px]">
                          {pr.site || "Central Store"}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[#18181B] font-medium">
                          {pr.requestedBy}
                        </span>
                        {pr.costCenter && (
                          <div className="text-[10px] font-mono text-[#A1A1AA]">
                            CC: {pr.costCenter}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider font-mono",
                            pr.priority === "Urgent"
                              ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          )}
                        >
                          {pr.priority || "Normal"}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-[#71717A]">
                        {pr.dateRequired ? new Date(pr.dateRequired).toLocaleDateString() : "Flexible"}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-[#18181B]">
                          {pr.items?.length || 0} line item(s)
                        </div>
                        <div className="text-[10px] text-[#71717A] truncate max-w-[130px]">
                          {pr.items?.[0]?.description || "—"}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(estTotal)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono",
                            pr.status === "draft"
                              ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                              : pr.status === "submitted"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : pr.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : pr.status === "converted_to_po"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {pr.status === "converted_to_po"
                            ? "Converted to PO"
                            : pr.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPr(pr);
                          }}
                          className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PR Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D7A5F]" />
                  Raise Purchase Requisition (PR)
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Starting Point of Material Procurement & Spares Acquisition
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePr} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {formError}
                </div>
              )}

              {/* Requisition Target Selector (Store Walay / Job Order / Project) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#3F3F46]">
                  Requisition Target (Acquisition Purpose) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrAgainst("store")}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      prAgainst === "store"
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base mt-0.5">📦</span>
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">Store Replenishment</div>
                      <div className="text-[10px] text-[#71717A]">Store walay general buffer & restock</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrAgainst("job")}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      prAgainst === "job"
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base mt-0.5">🔧</span>
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">Job Work Order</div>
                      <div className="text-[10px] text-[#71717A]">Against dedicated Job # / Ticket</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrAgainst("project")}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      prAgainst === "project"
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base mt-0.5">🏗️</span>
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">Project Site</div>
                      <div className="text-[10px] text-[#71717A]">Engineering project / client site</div>
                    </div>
                  </button>
                </div>

                {prAgainst === "job" && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200">
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                      Link Dedicated Job Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={linkedJobNumber}
                      onChange={(e) => setLinkedJobNumber(e.target.value)}
                      placeholder="e.g. JOB-2026-0042 or Manual Ref #..."
                      className="w-full bg-white border border-[#0D7A5F] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono font-medium focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Requested By *
                  </label>
                  <input
                    type="text"
                    required
                    value={requestedBy}
                    onChange={(e) => setRequestedBy(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="Requester Name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="HVAC Operations">HVAC Operations</option>
                    <option value="Central Warehouse">Central Warehouse</option>
                    <option value="Project Engineering">Project Engineering</option>
                    <option value="Facilities & Fleet">Facilities & Fleet</option>
                    <option value="Head Office">Head Office Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Site / Delivery Location
                  </label>
                  <input
                    type="text"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="e.g. Central Workshop, Lahore"
                  />
                </div>
              </div>

              {/* Priority, Dates & Codes */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">🚨 Urgent (Field Blocker)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Date Required *
                  </label>
                  <input
                    type="date"
                    required
                    value={dateRequired}
                    onChange={(e) => setDateRequired(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Cost Center
                  </label>
                  <input
                    type="text"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="CC-OPS-01"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Budget / Project Code
                  </label>
                  <input
                    type="text"
                    value={budgetCode}
                    onChange={(e) => setBudgetCode(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="CAPEX-2026-Q3"
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
                    Requisition Line Items ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-[11px] text-[#0D7A5F] hover:text-[#0A624C] font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Item
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-2 relative"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        {/* Catalog Product Link */}
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Catalog Product (Optional)
                          </label>
                          <select
                            value={it.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          >
                            <option value="">-- Custom Non-Catalog Item --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Item Description *
                          </label>
                          <input
                            type="text"
                            required
                            value={it.description}
                            onChange={(e) =>
                              handleItemChange(idx, "description", e.target.value)
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                            placeholder="Specification / model"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Qty *
                          </label>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            required
                            value={it.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, "quantity", Number(e.target.value))
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          />
                        </div>

                        {/* Unit */}
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={it.unit}
                            onChange={(e) =>
                              handleItemChange(idx, "unit", e.target.value)
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                            placeholder="pcs"
                          />
                        </div>

                        {/* Est. Unit Price */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Est. Unit Price (PKR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={it.estimatedPrice}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "estimatedPrice",
                                Number(e.target.value)
                              )
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] border-t border-[#EDEDED]">
                        <span className="font-mono text-[#71717A]">
                          Line Total:{" "}
                          <strong className="text-[#18181B] font-mono">
                            {formatCurrency((it.quantity || 0) * (it.estimatedPrice || 0))}
                          </strong>
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-600 hover:text-rose-700 text-[10px] flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#18181B] font-semibold">
                  Total Estimated Purchase Cost:
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-700">
                  {formatCurrency(calculatedTotal)}
                </span>
              </div>

              {/* Notes & Specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Justification / Operational Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="State the requirement or machine breakdown context..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Specifications / Drawing References
                  </label>
                  <textarea
                    rows={2}
                    value={attachments}
                    onChange={(e) => setAttachments(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="Reference drawing # or technical data sheet spec..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting PR..." : "Save Purchase Requisition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected PR Drawer / Modal */}
      {selectedPr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#18181B]">
                    {selectedPr.prNumber}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono",
                      selectedPr.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : selectedPr.status === "rejected"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}
                  >
                    {selectedPr.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Raised by {selectedPr.requestedBy} on {formatDateTime(selectedPr.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedPr(null)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#EDEDED] text-xs">
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Department</span>
                  <span className="font-semibold text-[#18181B]">{selectedPr.department}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Site</span>
                  <span className="font-semibold text-[#18181B]">{selectedPr.site || "Central"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Date Required</span>
                  <span className="font-semibold text-[#18181B] font-mono">
                    {selectedPr.dateRequired ? new Date(selectedPr.dateRequired).toLocaleDateString() : "Flexible"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-[#71717A]">Cost Center</span>
                  <span className="font-semibold text-[#18181B] font-mono">{selectedPr.costCenter || "—"}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B]">
                  Itemized Specifications ({selectedPr.items?.length || 0})
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-right">Est. Unit Price</th>
                        <th className="py-2 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {selectedPr.items?.map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#18181B]">{it.description}</div>
                            {it.itemCode && (
                              <span className="text-[10px] font-mono text-[#A1A1AA]">
                                SKU: {it.itemCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#71717A]">
                            {formatCurrency(it.estimatedPrice || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency((it.quantity || 0) * (it.estimatedPrice || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedPr.notes && (
                <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl text-xs">
                  <span className="block text-[10px] font-mono text-[#71717A] mb-1">
                    Requester Notes:
                  </span>
                  <p className="text-[#18181B]">{selectedPr.notes}</p>
                </div>
              )}

              {selectedPr.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <span className="block text-[10px] font-mono text-rose-600 mb-1">
                    Rejection Reason:
                  </span>
                  <p>{selectedPr.rejectionReason}</p>
                </div>
              )}

              {/* Approval / Workflow Action Bar */}
              <div className="pt-2 border-t border-[#EDEDED] flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedPr(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {selectedPr.status === "draft" && (
                    <button
                      onClick={() => handleUpdateStatus("submitted")}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit for Approval
                    </button>
                  )}

                  {selectedPr.status === "submitted" && (
                    <>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-lg transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleUpdateStatus("approved")}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold rounded-lg transition shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve Requisition
                      </button>
                    </>
                  )}

                  {selectedPr.status === "approved" && (
                    <>
                      {onNavigateToRfq && (
                        <button
                          onClick={() => {
                            const pr = selectedPr;
                            setSelectedPr(null);
                            onNavigateToRfq(pr);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Source via RFQ
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setConvertVendorId(vendors[0]?.id || "");
                          setShowConvertModal(true);
                        }}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold rounded-lg transition shadow-2xs"
                      >
                        <ArrowRight className="w-3.5 h-3.5" /> Convert to PO
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md p-5 shadow-2xl text-[#18181B]">
            <h4 className="text-sm font-bold text-rose-700 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Reject Purchase Requisition
            </h4>
            <p className="text-[11px] text-[#71717A] mb-3">
              Provide formal operational or budgetary reason for rejection:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-rose-500 outline-none mb-3"
              placeholder="Budget ceiling reached / Items already available in regional warehouse..."
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus("rejected", rejectReason)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert PR to PO Modal */}
      {showConvertModal && selectedPr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-lg p-6 shadow-2xl text-[#18181B]">
            <h4 className="text-sm font-bold text-[#18181B] mb-1 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#0D7A5F]" />
              Convert {selectedPr.prNumber} to Purchase Order
            </h4>
            <p className="text-[11px] text-[#71717A] mb-4">
              Select supplier and order contract type to initiate procurement binding order.
            </p>

            <form onSubmit={handleConvertToPo} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Supplier / Vendor *
                </label>
                <select
                  required
                  value={convertVendorId}
                  onChange={(e) => setConvertVendorId(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors
                    .filter((v) => v.status === "Active")
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.vendorCode}) - Terms: {v.paymentTerms}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    PO Type
                  </label>
                  <select
                    value={convertPoType}
                    onChange={(e) => setConvertPoType(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="standard">Standard PO</option>
                    <option value="blanket">Blanket / Framework PO</option>
                    <option value="service">Service PO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    required
                    value={convertDeliveryDate}
                    onChange={(e) => setConvertDeliveryDate(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl text-xs space-y-1">
                <span className="text-[#71717A] block font-mono text-[10px]">Order Summary:</span>
                <div className="flex justify-between text-[#18181B]">
                  <span>Lines: {selectedPr.items?.length || 0} item(s)</span>
                  <span className="font-mono font-bold text-emerald-700">
                    Est: {formatCurrency(
                      (selectedPr.items || []).reduce(
                        (sum: number, it: any) => sum + (it.quantity || 0) * (it.estimatedPrice || 0),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Generating PO..." : "Issue Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
