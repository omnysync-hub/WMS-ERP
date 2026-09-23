"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import TimelineStepper, { TimelineStep } from "@/components/ui/TimelineStepper";
import DiscountDrawer from "@/components/drawers/DiscountDrawer";
import ReassignTechDrawer from "@/components/drawers/ReassignTechDrawer";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  MapPin,
  Building,
  CheckCircle,
  Lock,
  Percent,
  AlertTriangle,
  Receipt,
  Package,
  Clock,
  Briefcase,
  Phone,
  FileCheck,
  Calendar,
  Layers,
  Check,
  X,
  Plus,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const { activeRole, currentPersona, hasPermission } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
  const isAccountant = activeRole === "accountant";
  const isAdmin = activeRole === "admin";
  const canViewFinancials = hasPermission("jobs.view_financials");
  const canAddService = hasPermission("jobs.add_service");
  const canIssueStock = hasPermission("jobs.issue_stock");
  const canStockReturn = hasPermission("jobs.stock_return");
  const canMisplacedItem = hasPermission("jobs.misplaced_item");
  const canGenerateInvoice = hasPermission("jobs.generate_invoice");
  const canCollectPayment = hasPermission("jobs.collect_payment");
  const canReassignTech = hasPermission("jobs.reassign_tech");
  const canEditJob = hasPermission("jobs.edit_job");

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Drawers & Modals
  const [showDiscountDrawer, setShowDiscountDrawer] = useState(false);
  const [showReassignDrawer, setShowReassignDrawer] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [itemDiscountModalOpen, setItemDiscountModalOpen] = useState(false);
  const [selectedItemToDiscount, setSelectedItemToDiscount] = useState<any>(null);
  const [approvedDiscountAmount, setApprovedDiscountAmount] = useState("");
  const [verifyChecklist, setVerifyChecklist] = useState({
    workConfirmed: false,
    paymentReconciled: false,
    inventoryReturned: false,
  });

  // Accountant clearing technician expense
  const [clearExpenseModalOpen, setClearExpenseModalOpen] = useState(false);
  const [selectedClaimToClear, setSelectedClaimToClear] = useState<any>(null);
  const [disbursingAccountCode, setDisbursingAccountCode] = useState("1000");

  // Storekeeper issuing inventory to job
  const [issueInventoryModalOpen, setIssueInventoryModalOpen] = useState(false);
  const [warehouseProducts, setWarehouseProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [issueQuantity, setIssueQuantity] = useState("1");
  const [issueRequestId, setIssueRequestId] = useState<string | undefined>(undefined);
  const [issueProductSearch, setIssueProductSearch] = useState("");

  // Accountant adding service / extra item
  const [addServiceModalOpen, setAddServiceModalOpen] = useState(false);
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceQty, setServiceQty] = useState("1");
  const [serviceUnitRate, setServiceUnitRate] = useState("");
  const [catalogServices, setCatalogServices] = useState<any[]>([]);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState("");

  useEffect(() => {
    if (addServiceModalOpen) {
      fetch("/api/inventory")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const services = data.filter(
              (p: any) =>
                p.isService ||
                (p.sku && (p.sku.startsWith("SRV-") || p.sku.startsWith("SVC-"))) ||
                ["service", "visit", "job", "hr", "hour"].includes((p.unit || "").toLowerCase())
            );
            setCatalogServices(services);
          }
        })
        .catch(console.error);
    }
  }, [addServiceModalOpen]);

  // Storekeeper Stock Return modal
  const [stockReturnModalOpen, setStockReturnModalOpen] = useState(false);
  const [returnItemName, setReturnItemName] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnNotes, setReturnNotes] = useState("");

  // Storekeeper Misplaced Item modal
  const [misplacedModalOpen, setMisplacedModalOpen] = useState(false);
  const [misplacedItemName, setMisplacedItemName] = useState("");
  const [misplacedQuantity, setMisplacedQuantity] = useState("1");
  const [misplacedReason, setMisplacedReason] = useState("Technician reported item misplaced/lost during site work");

  // Custom Invoice Modal
  const [customInvoiceModalOpen, setCustomInvoiceModalOpen] = useState(false);
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  // Accountant Add Service / Item Submit Handler
  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceDescription.trim() || Number(serviceQty) <= 0) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_service",
          description: serviceDescription.trim(),
          quantity: Number(serviceQty),
          unitRate: Number(serviceUnitRate || 0),
          actor: `${currentPersona.name} (${currentPersona.designation})`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setAddServiceModalOpen(false);
      setServiceDescription("");
      setSelectedCatalogServiceId("");
      setServiceQty("1");
      setServiceUnitRate("");
      setSuccessMsg(`Service / item added to Job #${job?.jobNumber || ""} successfully.`);
      fetchJob();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Storekeeper Stock Return Submit Handler
  const handleStockReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnItemName.trim() || Number(returnQuantity) <= 0) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_stock_return",
          technicianId: job?.assignedTechnicianId,
          item: returnItemName.trim(),
          quantity: Number(returnQuantity),
          notes: returnNotes.trim(),
          actor: `${currentPersona.name} (${currentPersona.designation})`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setStockReturnModalOpen(false);
      setReturnItemName("");
      setReturnQuantity("1");
      setReturnNotes("");
      setSuccessMsg(`Stock return recorded and restocked in warehouse ledger.`);
      fetchJob();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Storekeeper Misplaced Item Submit Handler
  const handleMisplacedItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!misplacedItemName.trim() || Number(misplacedQuantity) <= 0) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_misplaced_item",
          technicianId: job?.assignedTechnicianId,
          item: misplacedItemName.trim(),
          quantity: Number(misplacedQuantity),
          reason: misplacedReason.trim(),
          actor: `${currentPersona.name} (${currentPersona.designation})`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setMisplacedModalOpen(false);
      setMisplacedItemName("");
      setMisplacedQuantity("1");
      setSuccessMsg(`Misplaced item recorded in audit log. Technician accountability flagged.`);
      fetchJob();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Custom Invoice Submit Handler
  const handleGenerateCustomInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_custom_invoice",
          invoiceNumber: customInvoiceNumber.trim(),
          actor: `${currentPersona.name} (${currentPersona.designation})`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      setCustomInvoiceModalOpen(false);
      setSuccessMsg(`Tax Invoice ${data.invoiceNumber} created successfully!`);
      fetchJob();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Accountant Expense Clearance Handler
  const handleClearExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimToClear) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_expense",
          claimId: selectedClaimToClear.id,
          actor: `${currentPersona.name} (${currentPersona.designation})`,
          disbursingAccountCode,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setClearExpenseModalOpen(false);
      setSuccessMsg(`Expense claim of $${selectedClaimToClear.amount} cleared and posted to General Ledger.`);
      fetchJob();

      realtimeSync.publish("EXPENSE_APPROVED", {
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianId: job.assignedTechnicianId,
        actor: currentPersona.name,
        message: `Accountant ${currentPersona.name} cleared $${selectedClaimToClear.amount} field expense on Job #${job.jobNumber}`,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Issue Inventory modal & prefetch inventory products
  const openIssueInventoryModal = async (reqItem?: any) => {
    setIssueInventoryModalOpen(true);
    if (reqItem) {
      setIssueRequestId(reqItem.id);
      setIssueQuantity(String(reqItem.qtyRequested || 1));
      setIssueProductSearch(reqItem.item || "");
    } else {
      setIssueRequestId(undefined);
      setIssueQuantity("1");
      setIssueProductSearch("");
    }
    try {
      setLoadingProducts(true);
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (Array.isArray(data)) {
        setWarehouseProducts(data);
        if (reqItem) {
          const match = data.find((p: any) =>
            p.name.toLowerCase().includes(reqItem.item.toLowerCase()) ||
            reqItem.item.toLowerCase().includes(p.name.toLowerCase()) ||
            p.sku?.toLowerCase().includes(reqItem.item.toLowerCase())
          );
          if (match) setSelectedProductId(match.id);
          else if (data.length > 0) setSelectedProductId(data[0].id);
        } else if (data.length > 0) {
          setSelectedProductId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed loading inventory products", e);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Submit Inventory Issuance
  const handleIssueInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !issueQuantity || Number(issueQuantity) <= 0) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_inventory",
          productId: selectedProductId,
          quantity: Number(issueQuantity),
          requestId: issueRequestId,
          actor: `${currentPersona.name} (${currentPersona.designation})`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setIssueInventoryModalOpen(false);
      setSuccessMsg(`Successfully issued ${issueQuantity} units from warehouse to Job #${job.jobNumber}.`);
      fetchJob();

      realtimeSync.publish("INVENTORY_FULFILLED", {
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianId: job.assignedTechnicianId,
        actor: currentPersona.name,
        message: `Storekeeper ${currentPersona.name} issued materials from warehouse for Job #${job.jobNumber}`,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };


  // Handle accountant giving / approving item discount
  const handleGiveItemDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemToDiscount || !approvedDiscountAmount) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "give_item_discount",
          itemId: selectedItemToDiscount.id,
          discountAmount: Number(approvedDiscountAmount),
          actor: "Fatima Noor (Accountant)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setItemDiscountModalOpen(false);
      setSuccessMsg(`Discount of $${approvedDiscountAmount} approved on item. Line item rate updated live.`);
      fetchJob();

      // Publish Real-time Sync Event
      realtimeSync.publish("DISCOUNT_GRANTED", {
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianId: job.assignedTechnicianId,
        actor: "Accountant Fatima Noor",
        message: `Accountant Fatima Noor approved $${approvedDiscountAmount} discount on ${selectedItemToDiscount.description}`,
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  async function fetchJob() {
    try {
      setLoading(true);
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to load job details");
      const data = await res.json();
      setJob(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (jobId) fetchJob();
  }, [jobId]);

  useEffect(() => {
    async function loadTechs() {
      try {
        const res = await fetch("/api/technicians");
        const data = await res.json();
        if (data?.technicians) setTechnicians(data.technicians);
      } catch (e) {
        console.error("Failed loading technicians", e);
      }
    }
    loadTechs();
  }, []);

  // Real-time synchronization for active job
  useEffect(() => {
    const unsub = realtimeSync.subscribe((evt) => {
      if (evt.jobId === jobId) {
        fetchJob();
        setSuccessMsg(`Live Field Update: ${evt.message}`);
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    });
    return () => unsub();
  }, [jobId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#71717A] flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
        Loading HVAC work order details...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-12 text-center text-xs text-rose-600">
        Job not found. <Link href="/jobs" className="underline ml-1">Return to list</Link>
      </div>
    );
  }

  // Calculate totals
  let plannedTotal = 0;
  let actualTotal = 0;
  let hasAnyActual = false;

  for (const item of job.items || []) {
    plannedTotal += item.quantityPlanned * item.unitRate;
    if (item.quantityActual !== null && item.quantityActual !== undefined) {
      hasAnyActual = true;
      actualTotal += item.quantityActual * item.unitRate;
    }
  }

  const effectiveBillAmount = hasAnyActual ? actualTotal : plannedTotal;
  const netPayable = Math.max(0, effectiveBillAmount - (job.discountAmount || 0));

  // Build state machine timeline steps
  const standardStatuses = [
    "Created",
    "Assigned",
    "Accepted",
    "InProgress",
    "Paused",
    "CompletedPendingVerification",
    "Finalized",
    "Verified",
  ];

  const currentIdx = standardStatuses.indexOf(job.status);

  const timelineSteps: TimelineStep[] = standardStatuses.map((st, idx) => {
    const historyEntry = job.statusHistory?.find(
      (h: any) => h.toStatus === st
    );

    let isCompleted = false;
    let isCurrent = false;

    if (job.status === st) {
      isCurrent = true;
    } else if (idx < currentIdx || (currentIdx === -1 && historyEntry)) {
      isCompleted = true;
    }

    let label = st;
    if (st === "CompletedPendingVerification") label = "Completed (Pending Verification)";

    return {
      status: st,
      label,
      isCompleted,
      isCurrent,
      timestamp: historyEntry?.changedAt || null,
      changedBy: historyEntry?.changedBy || null,
    };
  });

  // Handle accountant finalizing job
  const handleFinalizeJob = async () => {
    if (
      !confirm(
        "Finalize this job? This will lock the record as READ-ONLY, generate the invoice, and post revenue through the Accounts Posting Engine."
      )
    ) {
      return;
    }
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          actor: "Fatima Noor (Accountant)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setSuccessMsg("Job successfully finalized and locked into read-only!");
      fetchJob();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle admin checklist verification
  const handleVerifyJob = async () => {
    if (
      !verifyChecklist.workConfirmed ||
      !verifyChecklist.paymentReconciled ||
      !verifyChecklist.inventoryReturned
    ) {
      alert("All 3 checklist items must be ticked to verify the job.");
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          checklist: verifyChecklist,
          actor: "Haris Qureshi (Admin)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowVerifyModal(false);
      setSuccessMsg(
        "Job verified! It has now been automatically queued into Call Center for quality feedback."
      );
      fetchJob();

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_VERIFIED", {
        jobId: job?.id || jobId,
        jobNumber: job?.jobNumber,
        technicianId: job?.assignedTechnicianId,
        actor: "Admin Haris Qureshi",
        message: `Job #${job?.jobNumber || ""} verified and settled in accounting ledger.`,
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: job.jobNumber },
        ]}
        title={`Work Order ${job.jobNumber}`}
        subtitle={`${job.customer?.name} • ${job.jobType?.toUpperCase() || "HVAC SERVICE"}`}
        badge={
          <div className="flex items-center gap-2">
            {job.finalizedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F4F4F5] text-[#3F3F46] px-2.5 py-0.5 rounded-full border border-[#E4E4E7]">
                <Lock className="w-3 h-3 text-[#71717A]" />
                Locked / Read-Only
              </span>
            )}
            <StatusBadge status={job.status} />
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canIssueStock && (
              <button
                type="button"
                onClick={() => openIssueInventoryModal()}
                className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Package className="w-3.5 h-3.5 text-amber-700" />
                + Issue Warehouse Stock
              </button>
            )}
            {canStockReturn && (
              <button
                type="button"
                onClick={() => setStockReturnModalOpen(true)}
                className="h-8 px-3 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-900 inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-700" />
                Record Stock Return
              </button>
            )}
            {canMisplacedItem && (
              <button
                type="button"
                onClick={() => setMisplacedModalOpen(true)}
                className="h-8 px-3 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-900 inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                Report Misplaced Item
              </button>
            )}

            {canAddService && (
              <button
                type="button"
                onClick={() => setAddServiceModalOpen(true)}
                className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-900 inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                + Add Service / Item
              </button>
            )}
            {canGenerateInvoice && (
              <button
                type="button"
                onClick={() => {
                  setCustomInvoiceNumber(`INV-${job.jobNumber}`);
                  setCustomInvoiceModalOpen(true);
                }}
                className="h-8 px-3 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-xs font-bold text-purple-900 inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Receipt className="w-3.5 h-3.5 text-purple-700" />
                Tax Invoice
              </button>
            )}

            {canViewFinancials && !job.finalizedAt && (
              <button
                type="button"
                onClick={() => setShowDiscountDrawer(true)}
                className="h-8 px-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
              >
                <Percent className="w-3.5 h-3.5 text-[#D97706]" />
                Mid-Job Discount
              </button>
            )}

            {(canGenerateInvoice || canCollectPayment) && job.status === "CompletedPendingVerification" && !job.finalizedAt && (
              <button
                type="button"
                onClick={handleFinalizeJob}
                disabled={isProcessing}
                className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
              >
                <Lock className="w-3.5 h-3.5 text-white" />
                Sync & Lock Record
              </button>
            )}

            {isAdmin && job.status === "Finalized" && (
              <button
                type="button"
                onClick={() => setShowVerifyModal(true)}
                className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Admin Verify
              </button>
            )}

            {job.status === "Verified" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Audited & Verified
              </span>
            )}
          </div>
        }
      />

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Disputed Alert Banner */}
      {job.qualityFlag === "disputed" && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-950">
              Disputed Quality Flag Registered
            </p>
            <p className="text-xs text-rose-800 mt-0.5">
              The customer expressed dissatisfaction during the outbound call center check. Review remarks in the Call Center queue. All accounting journal postings remain immutable.
            </p>
          </div>
        </div>
      )}

      {/* Read-Only Lock Banner */}
      {job.finalizedAt && (
        <div className="p-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg flex items-center gap-2.5 text-xs text-[#52525B]">
          <Lock className="w-4 h-4 text-[#71717A] shrink-0" />
          <span>
            This job was finalized on <strong>{formatDateTime(job.finalizedAt)}</strong>. Financial entries are locked into read-only mode in accordance with GAAP posting compliance.
          </span>
        </div>
      )}

      {/* TWO-COLUMN ENTERPRISE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Customer, Line Items, Financials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Site Details Card */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#0D7A5F]" />
                <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Customer & Site Details
                </h2>
              </div>
              <a
                href={`https://maps.google.com/?q=${job.customer?.lat || 25.2048},${job.customer?.lng || 55.2708}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#0D7A5F] hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0D7A5F] rounded"
              >
                <MapPin className="w-3.5 h-3.5" />
                Navigate GPS
              </a>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[#71717A] text-[11px] uppercase font-semibold">Customer Name</p>
                <p className="text-sm font-bold text-[#18181B] mt-0.5">{job.customer?.name}</p>
                <p className="text-[#52525B] mt-1 flex items-center gap-1.5 font-mono">
                  <Phone className="w-3 h-3 text-[#71717A]" />
                  {job.customer?.phone}
                </p>
              </div>

              <div>
                <p className="text-[#71717A] text-[11px] uppercase font-semibold">Service Site Address</p>
                <p className="text-[#27272A] font-medium mt-0.5 leading-relaxed">{job.customer?.addressText}</p>
              </div>

              {job.careOfParty && (
                <div className="sm:col-span-2 p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-lg">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                    <Building className="w-3.5 h-3.5 text-emerald-700" />
                    Subcontracted Care-Of Party
                  </div>
                  <p className="text-xs text-[#27272A] mt-1">
                    Company: <span className="font-semibold">{job.careOfParty.companyName}</span>
                    {job.careOfParty.personName && ` (Contact: ${job.careOfParty.personName})`}
                  </p>
                  {job.manualJobNumber && (
                    <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
                      External Manual Reference #: {job.manualJobNumber}
                    </p>
                  )}
                </div>
              )}

              {job.remarks && (
                <div className="sm:col-span-2 pt-3 border-t border-[#E4E4E7]">
                  <p className="text-[11px] font-semibold text-[#71717A] uppercase">Problem Diagnosis & Work Notes</p>
                  <p className="text-xs text-[#27272A] mt-0.5 leading-relaxed">{job.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* ACCOUNTANT SUPER-VIEW FINANCIAL & STOCK RECONCILIATION SUMMARY */}
          {(isAccountant || isAdmin) && (
            <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-900 text-white rounded-xl p-5 border border-emerald-800/40 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Accountant End-to-End Job Reconciliation
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      Material lifecycle: Used, Left, Returned & Financial Settlements
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddServiceModalOpen(true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Service
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomInvoiceNumber(`INV-${job.jobNumber}`);
                      setCustomInvoiceModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Invoice
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Total Planned</span>
                  <span className="text-base font-black font-mono text-white mt-0.5 block">
                    {job.items?.reduce((s: number, it: any) => s + (it.quantityPlanned || 0), 0) || 0} units
                  </span>
                  <span className="text-[10px] text-zinc-500">Scope of Work</span>
                </div>
                <div className="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Installed / Used</span>
                  <span className="text-base font-black font-mono text-emerald-400 mt-0.5 block">
                    {job.items?.reduce((s: number, it: any) => s + (it.quantityActual ?? it.quantityPlanned ?? 0), 0) || 0} units
                  </span>
                  <span className="text-[10px] text-emerald-500">Billable Actuals</span>
                </div>
                <div className="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold block">Unused / Left</span>
                  <span className="text-base font-black font-mono text-amber-400 mt-0.5 block">
                    {Math.max(
                      0,
                      (job.items?.reduce((s: number, it: any) => s + (it.quantityPlanned || 0), 0) || 0) -
                      (job.items?.reduce((s: number, it: any) => s + (it.quantityActual ?? it.quantityPlanned ?? 0), 0) || 0)
                    )} units
                  </span>
                  <span className="text-[10px] text-amber-400">
                    Returned: {job.stockReturns?.reduce((s: number, r: any) => s + (r.qtyReturned || 0), 0) || 0} units
                  </span>
                </div>
                <div className="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                  <span className="text-[10px] text-purple-400 uppercase font-semibold block">Net Invoice Total</span>
                  <span className="text-base font-black font-mono text-purple-300 mt-0.5 block">
                    {formatCurrency(netPayable)}
                  </span>
                  <span className="text-[10px] text-purple-400">
                    Collected: {formatCurrency(job.hisaabSettlements?.reduce((s: number, st: any) => s + (st.amountCollected || 0), 0) || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PLANNED VS ACTUAL LINE ITEMS TABLE (Invariable rule: billing driven strictly by quantity_actual) */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Planned vs Actual Line Items & Services
                </h2>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Billing, invoices, and warehouse stock deductions are calculated strictly from actual completed quantities.
                </p>
              </div>
              {canAddService && (
                <button
                  type="button"
                  onClick={() => setAddServiceModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  + Add Line Item
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">Item Description</th>
                    <th className="py-2.5 px-4 text-center">Planned Qty</th>
                    <th className="py-2.5 px-4 text-center">Actual Qty</th>
                    {canViewFinancials ? (
                      <>
                        <th className="py-2.5 px-4 text-right">Unit Rate</th>
                        <th className="py-2.5 px-4 text-right">Row Total</th>
                        <th className="py-2.5 px-4 text-right">Discount Action</th>
                      </>
                    ) : (
                      <th className="py-2.5 px-4 text-center">Warehouse Status</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {job.items && job.items.length > 0 ? (
                    job.items.map((item: any) => {
                      const actualQty = item.quantityActual;
                      const rowActualTotal =
                        actualQty !== null && actualQty !== undefined
                          ? actualQty * item.unitRate
                          : item.quantityPlanned * item.unitRate;

                      const isRequested = item.description?.includes("[Discount Requested:");
                      const isApproved = item.description?.includes("[Discount Approved:");
                      const isIssuedByStore = item.description?.includes("[Issued by Storekeeper]");
                      const cleanTitle = item.description?.replace(/\s*\[Discount.*?\]/gi, "");

                      return (
                        <tr key={item.id} className="hover:bg-[#FAFAFA] transition">
                          <td className="py-2.5 px-4 font-medium text-[#18181B]">
                            <div>{cleanTitle}</div>
                            {isRequested && canViewFinancials && (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  ⏳ {item.description.match(/\[Discount Requested: ([^\]]+)\]/)?.[1] || "Discount Requested"}
                                </span>
                              </div>
                            )}
                            {isApproved && canViewFinancials && (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  ✓ {item.description.match(/\[Discount Approved: ([^\]]+)\]/)?.[1] || "Discount Approved"}
                                </span>
                              </div>
                            )}
                            {isIssuedByStore && (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  📦 Issued by Warehouse Storekeeper
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center text-[#71717A] font-mono">
                            {item.quantityPlanned}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {actualQty !== null && actualQty !== undefined ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold font-mono text-[11px]">
                                {actualQty}
                              </span>
                            ) : (
                              <span className="text-[#A1A1AA] italic text-[11px]">
                                Pending Tech Completion
                              </span>
                            )}
                          </td>
                          {canViewFinancials ? (
                            <>
                              <td className="py-2.5 px-4 text-right font-mono text-[#52525B]">
                                {formatCurrency(item.unitRate)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                                {formatCurrency(rowActualTotal)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {!job.finalizedAt && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedItemToDiscount(item);
                                      const match = item.description?.match(/\[Discount Requested: \$?([0-9.]+)/i);
                                      setApprovedDiscountAmount(match ? match[1] : "");
                                      setItemDiscountModalOpen(true);
                                    }}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition shadow-2xs ${
                                      isRequested
                                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                                        : "bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B]"
                                    }`}
                                  >
                                    {isRequested ? "Authorize Discount" : "Give Discount"}
                                  </button>
                                )}
                              </td>
                            </>
                          ) : (
                            <td className="py-2.5 px-4 text-center">
                              {isIssuedByStore ? (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  ✓ Warehouse Issued
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                                  Scope Item
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={canViewFinancials ? 6 : 4} className="py-8 text-center text-[#71717A] text-xs">
                        No planned line items recorded during intake. Scope of work and materials will be recorded by the technician or accountant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary vs Physical Scope Footer */}
            {canViewFinancials ? (
              <div className="p-5 bg-[#FAFAFA] border-t border-[#E4E4E7] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[#71717A]">
                  <span>Planned Estimated Total:</span>
                  <span className="font-mono">{formatCurrency(plannedTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[#18181B] font-semibold">
                  <span>Actual Completed Subtotal:</span>
                  <span className="font-mono">{formatCurrency(effectiveBillAmount)}</span>
                </div>
                {job.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-[#D97706] font-medium">
                    <span>
                      Approved Mid-Job Discount
                      {job.discountReason && ` (${job.discountReason})`}:
                    </span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(job.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold text-[#18181B] pt-2 border-t border-[#E4E4E7]">
                  <span>Final Invoiced Amount:</span>
                  <span className="font-mono text-[#0D7A5F] text-base font-black">
                    {formatCurrency(netPayable)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/40 border-t border-amber-200/60 flex items-center justify-between text-xs text-[#52525B]">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-700" />
                  <span className="font-semibold text-amber-950">
                    Physical Warehouse Scope: {job.items?.length || 0} line items listed
                  </span>
                </div>
                <span className="text-[11px] text-[#71717A] font-mono">
                  Financial pricing & billing rates masked for current permission level
                </span>
              </div>
            )}
          </div>

          {/* Settlements & Field Expenses (Masked if lacks financial permission) */}
          {canViewFinancials && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Settlements */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B] uppercase tracking-wider pb-2 border-b border-[#E4E4E7]">
                  <Receipt className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  Field Settlement & Customer Collections
                </div>
                {!job.hisaabSettlements || job.hisaabSettlements.length === 0 ? (
                  <p className="text-xs text-[#A1A1AA] py-3 text-center">
                    No cash settlement recorded yet.
                  </p>
                ) : (
                  job.hisaabSettlements.map((s: any) => (
                    <div
                      key={s.id}
                      className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 font-mono">
                          {formatCurrency(s.amountCollected)} Collected
                        </span>
                        <span className="text-[10px] text-[#71717A]">
                          {formatDateTime(s.settledAt)}
                        </span>
                      </div>
                      <p className="text-[#52525B] text-[11px]">
                        Expected: {formatCurrency(s.amountExpected)} • Balance Due: {formatCurrency(s.balanceDue)}
                      </p>
                      <p className="text-[#71717A] text-[10px]">
                        Settled by {s.settledBy}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Field Expenses with Accountant Clearance */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    <Receipt className="w-3.5 h-3.5 text-[#D97706]" />
                    Technician Field Expenses
                  </div>
                  {job.expenseClaims?.some((c: any) => c.status === "pending") && (isAccountant || isAdmin) && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Clearance Pending
                    </span>
                  )}
                </div>
                {!job.expenseClaims || job.expenseClaims.length === 0 ? (
                  <p className="text-xs text-[#A1A1AA] py-3 text-center">
                    No field expenses claimed.
                  </p>
                ) : (
                  job.expenseClaims.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#18181B] font-mono text-sm">
                          {formatCurrency(c.amount)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={c.status} />
                          {c.status === "pending" && (isAccountant || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClaimToClear(c);
                                setClearExpenseModalOpen(true);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition shadow-2xs"
                            >
                              Clear Expense
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[#52525B] text-[11px]">{c.note}</p>
                      {c.status === "paid" && c.paidAt && (
                        <p className="text-[10px] text-emerald-800 font-medium">
                          ✓ Cleared: {formatDateTime(c.paidAt)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Central Warehouse Material & Inventory Issuance Card (Controlled by permissions) */}
          {(canIssueStock || canStockReturn) && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-700" />
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Warehouse Inventory & Material Issuance
                  </h3>
                </div>
                {canIssueStock && (
                  <button
                    type="button"
                    onClick={() => openIssueInventoryModal()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Issue Stock to Job
                  </button>
                )}
              </div>

              {/* Material Requests Table / List */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[#71717A] uppercase">
                  Technician Material Requests ({job.inventoryRequests?.length || 0})
                </p>
                {!job.inventoryRequests || job.inventoryRequests.length === 0 ? (
                  <p className="text-xs text-[#A1A1AA] py-3 text-center bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                    No material requests logged for this work order.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {job.inventoryRequests.map((req: any) => (
                      <div
                        key={req.id}
                        className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-[#18181B]">{req.item}</p>
                          <p className="text-[11px] text-[#71717A]">
                            Requested Qty: <span className="font-mono font-bold text-[#18181B]">{req.qtyRequested}</span> • {formatDateTime(req.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={req.status} />
                          {req.status === "pending" && canIssueStock && (
                            <button
                              type="button"
                              onClick={() => openIssueInventoryModal(req)}
                              className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-[11px] font-bold rounded-md shadow-2xs transition"
                            >
                              Fulfill & Issue
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stock Returns from Technician */}
              {job.stockReturns && job.stockReturns.length > 0 && (
                <div className="pt-3 border-t border-[#E4E4E7] space-y-2">
                  <p className="text-[11px] font-bold text-[#71717A] uppercase">
                    Unused Parts Returned to Warehouse
                  </p>
                  <div className="space-y-1.5">
                    {job.stockReturns.map((ret: any) => (
                      <div
                        key={ret.id}
                        className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-emerald-950">{ret.item}</span>
                          <span className="text-[11px] text-emerald-800 ml-2 font-mono">
                            Qty: {ret.qtyReturned}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-700">
                          {ret.acknowledgedAt ? `✓ Acknowledged` : "Awaiting Storekeeper Sign-off"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: State Machine Stepper & Assigned Tech */}
        <div className="space-y-6">
          {/* Assigned Technician Card */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider pb-2 border-b border-[#E4E4E7] flex items-center justify-between">
              <span>Assigned Technician</span>
              <Briefcase className="w-3.5 h-3.5 text-[#71717A]" />
            </h3>
            {job.assignedTechnician ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-800 shrink-0">
                    {job.assignedTechnician.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#18181B]">{job.assignedTechnician.name}</p>
                    <p className="text-[11px] text-[#71717A] font-mono">{job.assignedTechnician.phone}</p>
                  </div>
                </div>
                {!job.finalizedAt && canReassignTech && (
                  <button
                    type="button"
                    onClick={() => setShowReassignDrawer(true)}
                    className="w-full py-1.5 px-3 rounded-lg border border-[#EDEDED] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] transition flex items-center justify-center gap-1 shadow-2xs"
                  >
                    Change Technician
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-[#A1A1AA] italic">No technician assigned to this work order.</p>
                {!job.finalizedAt && canReassignTech && (
                  <button
                    type="button"
                    onClick={() => setShowReassignDrawer(true)}
                    className="w-full py-2 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    + Assign Technician
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lifecycle State Machine Vertical Stepper */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider pb-2 border-b border-[#E4E4E7] flex items-center justify-between">
              <span>Lifecycle State Machine</span>
              <Clock className="w-3.5 h-3.5 text-[#71717A]" />
            </h3>

            <TimelineStepper steps={timelineSteps} />
          </div>
        </div>
      </div>

      {/* MID-JOB DISCOUNT DRAWER */}
      <DiscountDrawer
        isOpen={showDiscountDrawer}
        onClose={() => setShowDiscountDrawer(false)}
        jobId={job.id}
        jobNumber={job.jobNumber}
        onDiscountApplied={() => {
          setSuccessMsg("Discount applied successfully to job ledger.");
          fetchJob();
        }}
      />

      {/* REASSIGN / ASSIGN TECHNICIAN DRAWER */}
      <ReassignTechDrawer
        isOpen={showReassignDrawer}
        onClose={() => setShowReassignDrawer(false)}
        job={job}
        technicians={technicians}
        onAssigned={() => {
          setSuccessMsg("Technician assigned and dispatch alert sent successfully!");
          fetchJob();
        }}
      />

      {/* ADMIN CHECKLIST VERIFICATION MODAL */}
      {showVerifyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-modal-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowVerifyModal(false);
          }}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 id="verify-modal-title" className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#0D7A5F]" />
                Admin Verification Checklist
              </h3>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5] transition"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#52525B]">
              All 3 conditions must be physically verified before final audit sign-off. Once verified, this job will automatically enter the Call Center feedback queue.
            </p>

            <div className="space-y-3 bg-[#FAFAFA] p-4 rounded-lg border border-[#E4E4E7]">
              <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-[#18181B]">
                <input
                  type="checkbox"
                  checked={verifyChecklist.workConfirmed}
                  onChange={(e) =>
                    setVerifyChecklist({
                      ...verifyChecklist,
                      workConfirmed: e.target.checked,
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                />
                <span>1. Work Confirmed Physically & Photos Inspected</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-[#18181B]">
                <input
                  type="checkbox"
                  checked={verifyChecklist.paymentReconciled}
                  onChange={(e) =>
                    setVerifyChecklist({
                      ...verifyChecklist,
                      paymentReconciled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                />
                <span>2. Customer Payment Reconciled by Accounts</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-[#18181B]">
                <input
                  type="checkbox"
                  checked={verifyChecklist.inventoryReturned}
                  onChange={(e) =>
                    setVerifyChecklist({
                      ...verifyChecklist,
                      inventoryReturned: e.target.checked,
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                />
                <span>3. Unused Materials / Old Parts Returned to Warehouse</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyJob}
                disabled={isProcessing}
                className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
              >
                Approve & Mark Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNTANT ITEM-LEVEL DISCOUNT APPROVAL MODAL */}
      {itemDiscountModalOpen && selectedItemToDiscount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-discount-modal-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setItemDiscountModalOpen(false);
          }}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 id="item-discount-modal-title" className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#0D7A5F]" />
                Accountant Item Discount Authorization
              </h3>
              <button
                type="button"
                onClick={() => setItemDiscountModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              <p className="font-bold text-amber-950">
                {selectedItemToDiscount.description.replace(/\s*\[Discount.*?\]/gi, "")}
              </p>
              <div className="flex items-center justify-between text-[11px] text-amber-900 pt-1">
                <span>Standard Unit Rate:</span>
                <span className="font-mono font-bold">${selectedItemToDiscount.unitRate}</span>
              </div>
            </div>

            <form onSubmit={handleGiveItemDiscount} className="space-y-4">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Discount Amount to Deduct from Unit Rate ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItemToDiscount.unitRate}
                  required
                  placeholder="e.g. 25"
                  value={approvedDiscountAmount}
                  onChange={(e) => setApprovedDiscountAmount(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                />
                {approvedDiscountAmount && Number(approvedDiscountAmount) > 0 && (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                    New Invoiced Unit Rate: ${Math.max(0, selectedItemToDiscount.unitRate - Number(approvedDiscountAmount))} (Saved & synchronized live to technician app)
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setItemDiscountModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                >
                  Authorize & Apply Discount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNTANT CLEAR EXPENSE MODAL */}
      {clearExpenseModalOpen && selectedClaimToClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-700" />
                Clear & Disburse Technician Expense
              </h3>
              <button
                type="button"
                onClick={() => setClearExpenseModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-800 uppercase font-semibold">Claim Amount:</span>
                <span className="font-mono text-base font-black text-emerald-950">{formatCurrency(selectedClaimToClear.amount)}</span>
              </div>
              <p className="text-[11px] text-[#52525B]"><strong>Purpose:</strong> {selectedClaimToClear.note}</p>
            </div>

            <form onSubmit={handleClearExpense} className="space-y-4">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Disbursing Account (Cash / Bank)
                </label>
                <select
                  value={disbursingAccountCode}
                  onChange={(e) => setDisbursingAccountCode(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-semibold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                >
                  <option value="1000">1000 — Cash in Hand (Petty Cash)</option>
                  <option value="1010">1010 — Emirates NBD Operating Account</option>
                  <option value="2100">2100 — Technician Payable Clearing</option>
                </select>
                <p className="text-[11px] text-[#71717A] mt-1">
                  Will debit 6100 (Technician Travel & Expenses) and credit selected disbursing account.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setClearExpenseModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {isProcessing ? "Posting..." : "Confirm & Disburse Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOREKEEPER ISSUE WAREHOUSE INVENTORY MODAL */}
      {issueInventoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-amber-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-700" />
                Issue Warehouse Inventory to Job #{job.jobNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIssueInventoryModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingProducts ? (
              <div className="py-8 text-center text-xs text-[#71717A]">
                Loading warehouse inventory catalogue...
              </div>
            ) : (
              <form onSubmit={handleIssueInventorySubmit} className="space-y-4">
                {issueRequestId && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                    Fulfilling linked material request for: <strong>{issueProductSearch}</strong>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Select Warehouse Product *
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    required
                    className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  >
                    {warehouseProducts.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — Available Stock: {p.stockQuantity} {p.unitOfMeasure || "units"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Quantity to Issue *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={issueQuantity}
                    onChange={(e) => setIssueQuantity(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-[#F4F4F5] rounded-lg text-[11px] text-[#52525B] space-y-1">
                  <p>• Deducts stock immediately from central warehouse inventory.</p>
                  <p>• Automatically records stock ledger entry and COGS double-entry posting.</p>
                  <p>• Adds material item to this job record and marks material request fulfilled.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                  <button
                    type="button"
                    onClick={() => setIssueInventoryModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    {isProcessing ? "Issuing..." : "Confirm & Issue Material"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ACCOUNTANT / ADMIN ADD SERVICE OR LINE ITEM MODAL */}
      {addServiceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-emerald-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-700" />
                Add Billable Service / Line Item
              </h3>
              <button
                type="button"
                onClick={() => setAddServiceModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddServiceSubmit} className="space-y-3.5">
              {catalogServices.length > 0 && (
                <div>
                  <label className="font-semibold text-purple-900 block mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Wrench className="w-3.5 h-3.5 text-purple-700" />
                      Select Predefined Service (Catalog)
                    </span>
                    <span className="text-[10px] text-purple-700 font-normal">Auto-fills description & rate</span>
                  </label>
                  <select
                    value={selectedCatalogServiceId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCatalogServiceId(id);
                      const srv = catalogServices.find((s) => s.id === id);
                      if (srv) {
                        setServiceDescription(srv.name);
                        setServiceUnitRate(String(srv.unitPrice || 0));
                      }
                    }}
                    className="w-full bg-purple-50/70 p-2.5 rounded-lg border border-purple-200 font-medium text-xs focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-[#18181B]"
                  >
                    <option value="">-- Choose from Predefined Service Catalog or enter custom below --</option>
                    {catalogServices.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({srv.sku}) — {formatCurrency(srv.unitPrice)} / {srv.unit || "service"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Service / Item Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Coil Chemical Servicing / Vacuum Testing"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={serviceQty}
                    onChange={(e) => setServiceQty(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Unit Rate (PKR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 3500"
                    value={serviceUnitRate}
                    onChange={(e) => setServiceUnitRate(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg text-[11px] text-emerald-950 space-y-1 border border-emerald-200">
                <p>• Added service will be immediately incorporated into actual billing & revenue.</p>
                <p>• Line item marked as added by {currentPersona.name} in audit log.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setAddServiceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {isProcessing ? "Adding..." : "Add to Job Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOREKEEPER RECORD STOCK RETURN MODAL */}
      {stockReturnModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-blue-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-700" />
                Record Stock Return from Technician
              </h3>
              <button
                type="button"
                onClick={() => setStockReturnModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockReturnSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Returned Item / Product *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Copper Pipe 1/2' Roll or R410A Refrigerant"
                  value={returnItemName}
                  onChange={(e) => setReturnItemName(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Quantity Returned *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Condition / Verification Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unopened box, verified in Central Warehouse"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg text-[11px] text-blue-950 space-y-1 border border-blue-200">
                <p>• Automatically restocks matching inventory items in warehouse ledger.</p>
                <p>• Acknowledged by Storekeeper {currentPersona.name} for Job #{job.jobNumber}.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setStockReturnModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {isProcessing ? "Recording..." : "Acknowledge Stock Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOREKEEPER REPORT MISPLACED ITEM BY TECHNICIAN MODAL */}
      {misplacedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-rose-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Report Misplaced Item by Technician
              </h3>
              <button
                type="button"
                onClick={() => setMisplacedModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMisplacedItemSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Copper Fitting 3/4' or Gauge Adapter"
                  value={misplacedItemName}
                  onChange={(e) => setMisplacedItemName(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Quantity Misplaced *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={misplacedQuantity}
                  onChange={(e) => setMisplacedQuantity(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Circumstances / Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={misplacedReason}
                  onChange={(e) => setMisplacedReason(e.target.value)}
                  placeholder="State reason item was not returned to warehouse..."
                  className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-rose-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-rose-50 rounded-lg text-[11px] text-rose-950 space-y-1 border border-rose-200">
                <p>• Records item shortage in audit log under technician accountability.</p>
                <p>• Prevents false inventory restocking for unreturned stock.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setMisplacedModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {isProcessing ? "Logging..." : "Log Misplaced Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM TAX INVOICE MODAL */}
      {customInvoiceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-purple-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-700" />
                Generate Official Tax Invoice
              </h3>
              <button
                type="button"
                onClick={() => setCustomInvoiceModalOpen(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateCustomInvoice} className="space-y-3.5">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Custom Tax Invoice Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-JOB-2026-0842"
                  value={customInvoiceNumber}
                  onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-lg text-[11px] text-purple-950 space-y-1 border border-purple-200">
                <p>• Customer: <strong>{job.customer?.name}</strong></p>
                <p>• Invoiced Total: <strong>{formatCurrency(netPayable)}</strong></p>
                <p>• Invoice will be registered in Accounts module and customer receivables.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setCustomInvoiceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {isProcessing ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
