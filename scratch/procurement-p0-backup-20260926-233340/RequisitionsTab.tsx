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
  User,
  Wrench,
  UserCheck,
  CheckSquare,
  Square,
  ShoppingCart,
  Boxes,
  MapPin,
  Briefcase,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface RequisitionsTabProps {
  prs: any[];
  vendors: any[];
  products: any[];
  employees?: any[];
  jobs?: any[];
  onRefresh: () => void;
  onNavigateToRfq?: (pr: any) => void;
  onNavigateToPo?: () => void;
}

export default function RequisitionsTab({
  prs,
  vendors,
  products,
  employees = [],
  jobs = [],
  onRefresh,
  onNavigateToRfq,
  onNavigateToPo,
}: RequisitionsTabProps) {
  const { currentRole } = useRole();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Determine auto requisitioner name based on role
  const autoRequisitionerName =
    currentRole === "admin"
      ? "Haris Qureshi (Admin User)"
      : currentRole === "accountant"
      ? "Fatima Noor (Accounts User)"
      : currentRole === "storekeeper"
      ? "Bilal Sheikh (Storekeeper)"
      : currentRole === "dispatcher"
      ? "Lead Dispatcher (Operations)"
      : "Operations Lead";

  // Create PR Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetType, setTargetType] = useState<"store" | "job" | "site">("store");
  const [selectedStore, setSelectedStore] = useState("Central Warehouse");
  const [customStore, setCustomStore] = useState("");
  const [selectedJobNumber, setSelectedJobNumber] = useState("");
  const [customJobNumber, setCustomJobNumber] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [customSite, setCustomSite] = useState("");

  const [technicianName, setTechnicianName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [department, setDepartment] = useState("Central Warehouse");
  const [dateRequired, setDateRequired] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [costCenter, setCostCenter] = useState("CC-STORE-01");
  const [budgetCode, setBudgetCode] = useState("OPEX-2026-STORE");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState("");

  // Line items without pricing (strictly items, description, quantity, unit)
  const [items, setItems] = useState<
    {
      productId: string;
      itemCode: string;
      description: string;
      quantity: number;
      unit: string;
    }[]
  >([
    {
      productId: "",
      itemCode: "",
      description: "",
      quantity: 10,
      unit: "pcs",
    },
  ]);

  // Selected PR Details Drawer
  const [selectedPr, setSelectedPr] = useState<any | null>(null);

  // Rejection Reason Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Multi-Selection State for PO generation
  const [selectedPrIds, setSelectedPrIds] = useState<string[]>([]);

  // Convert / Generate PO from PR Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [prsToConvert, setPrsToConvert] = useState<any[]>([]);
  const [convertVendorId, setConvertVendorId] = useState("");
  const [convertPoType, setConvertPoType] = useState<"standard" | "blanket" | "service">("standard");
  const [convertDeliveryDate, setConvertDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [poPricingItems, setPoPricingItems] = useState<
    {
      prId: string;
      prNumber: string;
      prItemId: string;
      productId?: string;
      itemCode?: string;
      description: string;
      quantity: number;
      unit: string;
      unitCost: number;
    }[]
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Handlers for Items in PR Form
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        itemCode: "",
        description: "",
        quantity: 5,
        unit: "unit",
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

  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((i) => !i.description.trim() && !i.productId)) {
      setFormError("Please provide description or select product for all items.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      // Determine target destination name
      let resolvedTargetName = "";
      if (targetType === "store") {
        resolvedTargetName = selectedStore === "CUSTOM" ? customStore : selectedStore;
      } else if (targetType === "job") {
        resolvedTargetName = selectedJobNumber === "CUSTOM" ? customJobNumber : selectedJobNumber;
      } else {
        resolvedTargetName = selectedSite === "CUSTOM" ? customSite : selectedSite;
      }

      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_pr",
          requestedBy: autoRequisitionerName,
          technicianName: technicianName || undefined,
          supervisorName: supervisorName || undefined,
          targetType,
          targetName: resolvedTargetName || undefined,
          department,
          site: resolvedTargetName || "General Store",
          dateRequired,
          priority,
          costCenter,
          projectCode: targetType === "job" ? resolvedTargetName : undefined,
          budgetCode,
          notes,
          attachments,
          items, // Note: no pricing included
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create PR");
      }

      setShowCreateModal(false);
      // Reset form
      setItems([{ productId: "", itemCode: "", description: "", quantity: 10, unit: "pcs" }]);
      setNotes("");
      setAttachments("");
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
          actorName: autoRequisitionerName,
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

  // Open PO Conversion Modal (supports single PR or multiple selected PRs)
  const openPoGenerationModal = (targetPrs: any[]) => {
    setPrsToConvert(targetPrs);
    setConvertVendorId(vendors[0]?.id || "");

    // Flatten all items across selected PRs and initialize with unitCost (0 or product costPrice)
    const aggregatedItems: any[] = [];
    for (const pr of targetPrs) {
      for (const it of pr.items || []) {
        const remainingQty = Math.max(0, it.quantity - (it.convertedQuantity || 0));
        if (remainingQty > 0) {
          aggregatedItems.push({
            prId: pr.id,
            prNumber: pr.prNumber,
            prItemId: it.id,
            productId: it.productId || undefined,
            itemCode: it.itemCode || it.product?.sku || undefined,
            description: it.description || it.product?.name || "Material Item",
            quantity: remainingQty,
            unit: it.unit || "unit",
            unitCost: it.product?.costPrice || 0,
          });
        }
      }
    }

    setPoPricingItems(aggregatedItems);
    setShowConvertModal(true);
  };

  const handlePoItemPriceChange = (index: number, cost: number) => {
    const updated = [...poPricingItems];
    updated[index].unitCost = cost;
    setPoPricingItems(updated);
  };

  const handleGeneratePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prsToConvert.length === 0 || !convertVendorId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_pr_to_po",
          prIds: prsToConvert.map((p) => p.id),
          vendorId: convertVendorId,
          poType: convertPoType,
          expectedDeliveryDate: convertDeliveryDate,
          items: poPricingItems.map((pi) => ({
            productId: pi.productId,
            itemCode: pi.itemCode,
            description: pi.description,
            quantity: pi.quantity,
            unit: pi.unit,
            unitCost: Number(pi.unitCost) || 0,
            prItemId: pi.prItemId,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to convert PR to PO");
      }

      setShowConvertModal(false);
      setSelectedPr(null);
      setSelectedPrIds([]);
      onRefresh();
      if (onNavigateToPo) onNavigateToPo();
    } catch (err: any) {
      alert(err.message || "Error generating Purchase Order");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle selection for multiple PRs
  const togglePrSelection = (prId: string) => {
    setSelectedPrIds((prev) =>
      prev.includes(prId) ? prev.filter((id) => id !== prId) : [...prev, prId]
    );
  };

  // Filter PRs
  const filteredPrs = prs.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchPriority = priorityFilter === "all" || p.priority === priorityFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.prNumber?.toLowerCase().includes(q) ||
      p.requestedBy?.toLowerCase().includes(q) ||
      p.site?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q);
    return matchStatus && matchPriority && matchSearch;
  });

  const approvedPrs = filteredPrs.filter((p) => p.status === "approved");
  const selectedApprovedPrs = prs.filter(
    (p) => selectedPrIds.includes(p.id) && p.status === "approved"
  );

  const calculatedPoSubtotal = poPricingItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search PR number, site, target, requester..."
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

        <div className="flex items-center gap-2">
          {/* Multiple PR Selection to PO Action */}
          {selectedApprovedPrs.length > 0 && (
            <button
              onClick={() => openPoGenerationModal(selectedApprovedPrs)}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition animate-pulse"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Generate PO from Selected ({selectedApprovedPrs.length} PRs)
            </button>
          )}

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
      </div>

      {/* PR Table without Pricing */}
      <div className="bg-white border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={
                      approvedPrs.length > 0 &&
                      approvedPrs.every((p) => selectedPrIds.includes(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPrIds(approvedPrs.map((p) => p.id));
                      } else {
                        setSelectedPrIds([]);
                      }
                    }}
                    title="Select all approved PRs to generate a combined PO"
                    className="rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F]"
                  />
                </th>
                <th className="py-3 px-3">PR Number & Date</th>
                <th className="py-3 px-3">Target (Site / Store / Job)</th>
                <th className="py-3 px-3">Requisitioner & Tech</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3">Required By</th>
                <th className="py-3 px-3">Requested Items</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
              {filteredPrs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#A1A1AA]">
                    No purchase requisitions found. Click &quot;Create Purchase Requisition&quot; to initiate a request.
                  </td>
                </tr>
              ) : (
                filteredPrs.map((pr) => {
                  const isSelected = selectedPrIds.includes(pr.id);
                  const isApproved = pr.status === "approved";

                  return (
                    <tr
                      key={pr.id}
                      className={cn(
                        "hover:bg-[#F8FAFC] transition-colors group cursor-pointer",
                        isSelected && "bg-purple-50/50"
                      )}
                      onClick={() => setSelectedPr(pr)}
                    >
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isApproved ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePrSelection(pr.id)}
                            className="rounded border-[#D4D4D8] text-purple-600 focus:ring-purple-600 cursor-pointer"
                          />
                        ) : (
                          <span className="text-[#D4D4D8]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition-colors">
                          {pr.prNumber}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] font-mono">
                          {formatDateTime(pr.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#18181B] flex items-center gap-1.5">
                          {pr.site?.toLowerCase().includes("job") ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                              JOB
                            </span>
                          ) : pr.site?.toLowerCase().includes("site") ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                              SITE
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                              STORE
                            </span>
                          )}
                          <span className="truncate max-w-[170px]">
                            {pr.site || pr.department || "Central Store"}
                          </span>
                        </div>
                        {pr.projectCode && (
                          <div className="text-[10px] text-[#71717A] font-mono truncate max-w-[170px]">
                            Ref: {pr.projectCode}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-[#18181B] font-medium truncate max-w-[150px]">
                          {pr.requestedBy}
                        </div>
                        {pr.notes && pr.notes.includes("[Tech:") && (
                          <div className="text-[10px] text-[#0D7A5F] font-mono truncate max-w-[150px]">
                            {pr.notes.split("[Supervisor:")[0].replace("[", "").replace("]", "")}
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
                        <div className="font-semibold text-[#18181B]">
                          {pr.items?.length || 0} requested item(s)
                        </div>
                        <div className="text-[10px] text-[#71717A] truncate max-w-[150px]">
                          {pr.items?.[0]?.description || "—"}
                        </div>
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
                          className="p-1.5 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
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

      {/* ========================================================================= */}
      {/* CREATE PR MODAL (NO PRICING + AUTO USER + TECH / SUPERVISOR / TARGET)     */}
      {/* ========================================================================= */}
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
                  Material demand specification for Site, Store, or Job Order (Pricing is assigned at PO stage)
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

              {/* 1. Requisition Target Selection (Site / Store / Job) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#3F3F46]">
                  Requisition Target Destination (Site / Store / Job Selection) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("store")}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      targetType === "store"
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <Boxes className="w-4 h-4 mt-0.5 text-[#0D7A5F]" />
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">Store / Warehouse</div>
                      <div className="text-[10px] text-[#71717A]">General inventory & restocking</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType("job")}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      targetType === "job"
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <Briefcase className="w-4 h-4 mt-0.5 text-[#0D7A5F]" />
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">Job Order</div>
                      <div className="text-[10px] text-[#71717A]">Direct maintenance / repair job</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType("site")}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      targetType === "site"
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <MapPin className="w-4 h-4 mt-0.5 text-[#0D7A5F]" />
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">Project / Client Site</div>
                      <div className="text-[10px] text-[#71717A]">Specific field installation site</div>
                    </div>
                  </button>
                </div>

                {/* Sub-selectors depending on targetType */}
                {targetType === "store" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                        Select Warehouse / Store *
                      </label>
                      <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      >
                        <option value="Central Warehouse">Central Warehouse (Workshop St, Gulberg)</option>
                        <option value="Workshop Spares Store">Workshop Spares Store</option>
                        <option value="Regional Spares Depot">Regional Spares Depot</option>
                        <option value="Mobile Van Inventory">Mobile Van Inventory</option>
                        <option value="CUSTOM">+ Enter Custom Store Name...</option>
                      </select>
                    </div>
                    {selectedStore === "CUSTOM" && (
                      <div>
                        <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                          Custom Store Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={customStore}
                          onChange={(e) => setCustomStore(e.target.value)}
                          placeholder="e.g. Faisalabad Spares Branch"
                          className="w-full bg-white border border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {targetType === "job" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                        Select Active Job *
                      </label>
                      <select
                        value={selectedJobNumber}
                        onChange={(e) => setSelectedJobNumber(e.target.value)}
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      >
                        <option value="">-- Choose Job --</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.jobNumber}>
                            {j.jobNumber} — {j.customer?.name} ({j.jobType})
                          </option>
                        ))}
                        <option value="CUSTOM">+ Enter Custom Job Number...</option>
                      </select>
                    </div>
                    {selectedJobNumber === "CUSTOM" && (
                      <div>
                        <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                          Manual Job Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={customJobNumber}
                          onChange={(e) => setCustomJobNumber(e.target.value)}
                          placeholder="e.g. JOB-2026-9999"
                          className="w-full bg-white border border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {targetType === "site" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                        Select Site Location
                      </label>
                      <select
                        value={selectedSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      >
                        <option value="Packages Mall Site - Lahore">Packages Mall Site - Lahore</option>
                        <option value="Dolmen Mall Site - Karachi">Dolmen Mall Site - Karachi</option>
                        <option value="Emporium Commercial Plant">Emporium Commercial Plant</option>
                        <option value="CUSTOM">+ Enter Custom Site...</option>
                      </select>
                    </div>
                    {selectedSite === "CUSTOM" && (
                      <div>
                        <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                          Custom Site Name / Address *
                        </label>
                        <input
                          type="text"
                          required
                          value={customSite}
                          onChange={(e) => setCustomSite(e.target.value)}
                          placeholder="e.g. Centaurus Mall HVAC Chiller Room"
                          className="w-full bg-white border border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Personnel Details: Auto Requisitioner (User) + Manual Technician & Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div>
                  <label className="block text-[10px] font-mono text-[#71717A] mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-[#0D7A5F]" />
                    Requisitioner (Current User)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={autoRequisitionerName}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] font-semibold cursor-not-allowed opacity-90"
                  />
                  <span className="text-[9px] text-[#0D7A5F] font-mono mt-0.5 block">
                    Auto-recorded from active session
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-[#71717A] mb-1 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-[#71717A]" />
                    Technician (Manual Selection)
                  </label>
                  <select
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose Technician --</option>
                    {employees
                      .filter((e) => e.role === "technician" || !e.role)
                      .map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} ({emp.department || "Field Tech"})
                        </option>
                      ))}
                    {employees.filter((e) => e.role === "technician").length === 0 && (
                      <>
                        <option value="Muhammad Asif (Senior Chiller Tech)">Muhammad Asif (Senior Chiller Tech)</option>
                        <option value="Rashid Ali (VRF Specialist)">Rashid Ali (VRF Specialist)</option>
                        <option value="Tariq Mehmood (Installation Tech)">Tariq Mehmood (Installation Tech)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-[#71717A] mb-1 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-[#71717A]" />
                    Supervisor (Manual Selection)
                  </label>
                  <select
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose Supervisor --</option>
                    {employees
                      .filter((e) => e.role !== "technician")
                      .map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    {employees.filter((e) => e.role !== "technician").length === 0 && (
                      <>
                        <option value="Haris Qureshi (Operations Manager)">Haris Qureshi (Operations Manager)</option>
                        <option value="Khurram Shahzad (Site Supervisor)">Khurram Shahzad (Site Supervisor)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* 3. Dates, Priority & Departments */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  </select>
                </div>
              </div>

              {/* 4. Line Items Builder (NO PRICING) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
                      Requisition Material Items ({items.length})
                    </span>
                    <span className="text-[10px] text-[#71717A]">
                      Specify quantities and materials (Pricing is omitted from PR)
                    </span>
                  </div>
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
                        <div className="sm:col-span-5">
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
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                            Item Description & Specs *
                          </label>
                          <input
                            type="text"
                            required
                            value={it.description}
                            onChange={(e) =>
                              handleItemChange(idx, "description", e.target.value)
                            }
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                            placeholder="Specification / model / brand"
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
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1 text-xs text-[#18181B] font-mono font-bold focus:ring-1 focus:ring-[#0D7A5F] outline-none"
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
                      </div>

                      {items.length > 1 && (
                        <div className="flex items-center justify-end pt-1 border-t border-[#EDEDED]">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-600 hover:text-rose-700 text-[10px] flex items-center gap-1 font-semibold"
                          >
                            <Trash2 className="w-3 h-3" /> Remove Item
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Notes & Justifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Operational Justification / Reason
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="State machine breakdown, replenishment requirement, or urgent ticket context..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Drawing / Specs / Attachment Reference
                  </label>
                  <textarea
                    rows={2}
                    value={attachments}
                    onChange={(e) => setAttachments(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    placeholder="Reference technical drawings, equipment manual page, or contractor quote ref..."
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

      {/* ========================================================================= */}
      {/* CONVERT MULTIPLE OR SINGLE PRs TO PO MODAL (WHERE PRICES ARE ENTERED)     */}
      {/* ========================================================================= */}
      {showConvertModal && prsToConvert.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-3xl p-6 shadow-2xl text-[#18181B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDEDED]">
              <div>
                <h4 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#0D7A5F]" />
                  Generate Purchase Order from {prsToConvert.length} Requisition(s)
                </h4>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Consolidated PO creation: Assign supplier and agree commercial unit prices for requested items.
                </p>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGeneratePoSubmit} className="space-y-4 pt-3 max-h-[75vh] overflow-y-auto">
              {/* Linked PRs Badges */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-800 font-bold block">
                  Consolidated Requisitions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {prsToConvert.map((pr) => (
                    <span
                      key={pr.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white text-purple-700 border border-purple-300"
                    >
                      {pr.prNumber}
                      <span className="text-[10px] text-[#71717A]">
                        ({pr.site || pr.department})
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Vendor & Delivery Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Select Supplier / Vendor *
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

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    PO Contract Type
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
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Expected Delivery Date *
                </label>
                <input
                  type="date"
                  required
                  value={convertDeliveryDate}
                  onChange={(e) => setConvertDeliveryDate(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                />
              </div>

              {/* Items Price Allocation Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Assign Agreed PO Unit Prices ({poPricingItems.length} items)
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Source PR</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right w-44">Agreed Unit Rate (PKR) *</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {poPricingItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#18181B]">{it.description}</div>
                            {it.itemCode && (
                              <span className="text-[10px] font-mono text-[#A1A1AA]">
                                SKU: {it.itemCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-purple-700 font-semibold">
                            {it.prNumber}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={it.unitCost}
                              onChange={(e) =>
                                handlePoItemPriceChange(idx, Number(e.target.value))
                              }
                              placeholder="Unit price"
                              className="w-36 text-right bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs font-mono font-bold text-[#18181B] focus:border-[#0D7A5F] outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency((it.quantity || 0) * (it.unitCost || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#18181B] font-semibold block">
                    Total Order Value (Net Payable):
                  </span>
                  <span className="text-[10px] text-[#71717A] font-mono">
                    Includes {poPricingItems.length} line items from {prsToConvert.length} PRs
                  </span>
                </div>
                <span className="text-lg font-black font-mono text-emerald-800">
                  {formatCurrency(calculatedPoSubtotal)}
                </span>
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
                  disabled={isSubmitting || poPricingItems.length === 0}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {isSubmitting ? "Generating PO..." : `Issue Purchase Order (${formatCurrency(calculatedPoSubtotal)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PR DETAILS DRAWER (NO PRICING DISPLAYED)                                  */}
      {/* ========================================================================= */}
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
                  <span className="block text-[10px] font-mono text-[#71717A]">Site / Target</span>
                  <span className="font-semibold text-[#18181B]">{selectedPr.site || "Central Store"}</span>
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

              {/* Items List (NO PRICING) */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B]">
                  Itemized Material Specifications ({selectedPr.items?.length || 0})
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-right">Quantity Required</th>
                        <th className="py-2 px-3 text-center">Unit</th>
                        <th className="py-2 px-3 text-right">PO Conversion Status</th>
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
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[#71717A]">
                            {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                            {it.convertedQuantity > 0 ? (
                              <span className="text-emerald-700 font-bold">
                                {it.convertedQuantity} ordered
                              </span>
                            ) : (
                              <span className="text-[#A1A1AA]">Pending PO</span>
                            )}
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
                    Requester Notes & Routing:
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
                          openPoGenerationModal([selectedPr]);
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
              Provide formal reason for rejection:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-rose-500 outline-none mb-3"
              placeholder="Material already available in central stock / Duplicate request..."
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
    </div>
  );
}
