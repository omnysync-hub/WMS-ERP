"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import TimelineStepper, { TimelineStep } from "@/components/ui/TimelineStepper";
import DiscountDrawer from "@/components/drawers/DiscountDrawer";
import ReassignTechDrawer from "@/components/drawers/ReassignTechDrawer";
import IssueWarehouseStockDrawer from "@/components/drawers/IssueWarehouseStockDrawer";
import RecordStockReturnDrawer from "@/components/drawers/RecordStockReturnDrawer";
import ReportMisplacedItemDrawer from "@/components/drawers/ReportMisplacedItemDrawer";
import AddServiceDrawer from "@/components/drawers/AddServiceDrawer";
import TaxInvoiceDrawer from "@/components/drawers/TaxInvoiceDrawer";
import WorkOrderDrawer from "@/components/drawers/WorkOrderDrawer";
import ReceiveTechnicianCashDrawer from "@/components/drawers/ReceiveTechnicianCashDrawer";
import JobRemarksCard from "@/components/jobs/JobRemarksCard";
import { cn, formatCurrency, formatDateTime, formatJobType, isServiceItem } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  MapPin,
  Building,
  CheckCircle,
  CheckCircle2,
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
  Banknote,
  Undo2,
  Eye,
  Download,
  Maximize2,
  Printer,
  Sparkles,
} from "lucide-react";
import ImageLightboxModal, { downloadImageFile } from "@/components/modals/ImageLightboxModal";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";
import { procurementActorHeaders } from "@/lib/procurementClient";
import { canAddServiceOrItem, canChangeTechnician } from "@/lib/jobStatus";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const { activeRole, currentPersona, hasPermission } = useRole();
  const isStorekeeper =
    activeRole === "storekeeper" ||
    currentPersona?.role === "storekeeper" ||
    (activeRole || "").toLowerCase().includes("store");
  const isAccountant = activeRole === "accountant";
  const isAdmin = activeRole === "admin";
  const isDispatcher = activeRole === "dispatcher";
  const isCallCenter = activeRole === "call_center";
  const isRestrictedRole = isDispatcher || isCallCenter;
  const canViewFinancials = hasPermission("jobs.view_financials");
  const canAddService = hasPermission("jobs.add_service");
  const canIssueStock = hasPermission("jobs.issue_stock");
  const canStockReturn = hasPermission("jobs.stock_return");
  const canMisplacedItem = hasPermission("jobs.misplaced_item");
  const canGenerateInvoice = hasPermission("jobs.generate_invoice");
  const canCollectPayment = hasPermission("jobs.collect_payment");
  const canReassignTech = hasPermission("jobs.reassign_tech");
  const canEditJob = hasPermission("jobs.edit_job");
  const canVerify = hasPermission("jobs.verify");

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Drawers & Modals
  const [showDiscountDrawer, setShowDiscountDrawer] = useState(false);
  const [showReassignDrawer, setShowReassignDrawer] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [sendBackNote, setSendBackNote] = useState("");
  const [disapproveTarget, setDisapproveTarget] = useState<
    "InProgress" | "AwaitingFeedback" | "CompletedPendingVerification"
  >("InProgress");
  const [itemDiscountModalOpen, setItemDiscountModalOpen] = useState(false);
  const [selectedItemToDiscount, setSelectedItemToDiscount] = useState<any>(null);
  const [approvedDiscountAmount, setApprovedDiscountAmount] = useState("");
  const [verifyChecklist, setVerifyChecklist] = useState({
    workConfirmed: false,
    paymentReconciled: false,
    inventoryReturned: false,
  });


  // Action Side Drawers
  const [issueStockDrawerOpen, setIssueStockDrawerOpen] = useState(false);
  const [selectedReqItem, setSelectedReqItem] = useState<any>(null);
  const [stockReturnDrawerOpen, setStockReturnDrawerOpen] = useState(false);
  const [misplacedDrawerOpen, setMisplacedDrawerOpen] = useState(false);
  const [addServiceDrawerOpen, setAddServiceDrawerOpen] = useState(false);
  const [taxInvoiceDrawerOpen, setTaxInvoiceDrawerOpen] = useState(false);
  const [workOrderDrawerOpen, setWorkOrderDrawerOpen] = useState(false);
  const [receiveCashDrawerOpen, setReceiveCashDrawerOpen] = useState(false);
  const [selectedSettlementForHandover, setSelectedSettlementForHandover] = useState<any | null>(null);
  const [deliverableActiveTab, setDeliverableActiveTab] = useState<"all" | "services" | "inventory">("all");

  // Fullscreen Photo Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);


  // Open Issue Inventory drawer
  const openIssueInventoryModal = (reqItem?: any) => {
    const target =
      reqItem ||
      job?.inventoryRequests?.find(
        (r: any) =>
          r.status !== "issued" &&
          (Number(r.qtyIssued || 0) < Number(r.qtyRequested || 0))
      ) ||
      (job?.inventoryRequests && job.inventoryRequests.length > 0 ? job.inventoryRequests[0] : null);
    setSelectedReqItem(target || null);
    setIssueStockDrawerOpen(true);
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
    "AwaitingFeedback",
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
    if (st === "Paused") label = "Paused";
    if (st === "AwaitingFeedback") label = "Awaiting Feedback (call center)";
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

  // Handle auditor / admin checklist verification
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
        headers: procurementActorHeaders(
          activeRole || "anonymous",
          currentPersona?.name,
          currentPersona?.id
        ),
        body: JSON.stringify({
          action: "verify",
          checklist: verifyChecklist,
          actor: currentPersona?.name || "Auditor",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowVerifyModal(false);
      setSuccessMsg(
        "Job verified by auditor. Feedback was completed earlier in the call-center step."
      );
      fetchJob();

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_VERIFIED", {
        jobId: job?.id || jobId,
        jobNumber: job?.jobNumber,
        technicianId: job?.assignedTechnicianId,
        actor: currentPersona?.name || "Auditor",
        message: `Job #${job?.jobNumber || ""} verified and settled in accounting ledger.`,
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendBackFromVerification = async () => {
    if (!sendBackNote.trim()) {
      alert("A disapproval note / reason is required.");
      return;
    }
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: procurementActorHeaders(
          activeRole || "anonymous",
          currentPersona?.name,
          currentPersona?.id
        ),
        body: JSON.stringify({
          action: "send_back",
          note: sendBackNote.trim(),
          targetStatus: disapproveTarget,
          actor: currentPersona?.name || "Auditor",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowSendBackModal(false);
      setSendBackNote("");
      setSuccessMsg(
        `Job disapproved by auditor and routed to ${
          disapproveTarget === "InProgress"
            ? "Technician (In Progress for Rework)"
            : disapproveTarget === "AwaitingFeedback"
            ? "Call Center (Awaiting Feedback Re-Check)"
            : "Auditor / Accounting Hold (Disputed)"
        }.`
      );
      fetchJob();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: job.jobNumber },
        ]}
        title={`Work Order ${job.jobNumber}`}
        subtitle={`${job.customer?.name} • ${formatJobType(job.jobType)}`}
        badge={
          !isStorekeeper ? (
            <div className="flex items-center gap-2">
              {job.isFoc && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full border border-purple-300 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-purple-700" />
                  FOC Order (Company Billed)
                </span>
              )}
              {job.finalizedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F4F4F5] text-[#3F3F46] px-2.5 py-0.5 rounded-full border border-[#E4E4E7]">
                  <Lock className="w-3 h-3 text-[#71717A]" />
                  Locked / Read-Only
                </span>
              )}
              <StatusBadge status={job.status} />
            </div>
          ) : null
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isStorekeeper ? (
              // Storekeeper actions: issue warehouse stock and record store returns
              <>
                {canIssueStock && (
                  <button
                    type="button"
                    onClick={() => openIssueInventoryModal()}
                    className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Package className="w-3.5 h-3.5" />
                    + Issue Warehouse Stock
                  </button>
                )}
                {canStockReturn && (
                  <button
                    type="button"
                    onClick={() => setStockReturnDrawerOpen(true)}
                    className="h-8 px-3 rounded-lg border border-emerald-400 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Record Store Return
                  </button>
                )}
              </>
            ) : (
              <>
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
                {canStockReturn && !isAccountant && (
                  <button
                    type="button"
                    onClick={() => setStockReturnDrawerOpen(true)}
                    className="h-8 px-3 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-900 inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-700" />
                    Record Store Return
                  </button>
                )}
                {canMisplacedItem && (
                  <button
                    type="button"
                    onClick={() => setMisplacedDrawerOpen(true)}
                    className="h-8 px-3 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-900 inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    Report Misplaced Item
                  </button>
                )}

                {canAddService && !isRestrictedRole && canAddServiceOrItem(job) && (
                  <button
                    type="button"
                    onClick={() => setAddServiceDrawerOpen(true)}
                    className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-900 inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-700" />
                    + Add Service / Item
                  </button>
                )}
                {canViewFinancials && (canGenerateInvoice || job.invoice) && !isRestrictedRole && (
                  <button
                    type="button"
                    onClick={() => setTaxInvoiceDrawerOpen(true)}
                    className="h-8 px-3 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-xs font-bold text-purple-900 inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Receipt className="w-3.5 h-3.5 text-purple-700" />
                    {job.invoice ? `Tax Invoice (${job.invoice.invoiceNumber})` : "Tax Invoice"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setWorkOrderDrawerOpen(true)}
                  className="h-8 px-3 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5 transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  Print Work Order
                </button>

                {canViewFinancials && !job.finalizedAt && !isRestrictedRole && (
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

                {canVerify && (job.status === "Finalized" || job.status === "CompletedPendingVerification") && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Auditor Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSendBackNote("");
                        setDisapproveTarget("InProgress");
                        setShowSendBackModal(true);
                      }}
                      className="h-8 px-3.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-950 inline-flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Auditor Disapprove
                    </button>
                  </>
                )}

                {job.status === "Verified" && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Audited & Verified
                  </span>
                )}
              </>
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
      {!isStorekeeper && job.qualityFlag === "disputed" && (
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
      {!isStorekeeper && job.finalizedAt && (
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

              {job.isFoc && (
                <div className="sm:col-span-2 p-3 bg-purple-50/80 border border-purple-200 rounded-lg flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-200">
                    FOC
                  </div>
                  <div>
                    <span className="font-bold text-xs text-purple-950 block">
                      Free of Charge (FOC) Work Order
                    </span>
                    <span className="text-[11px] text-purple-800 leading-relaxed block mt-0.5">
                      Customer pays <strong>PKR 0</strong> at completion. Services and parts are billed directly to <strong>{job.careOfParty?.companyName || "the principal company"}</strong> and settled in Accounts.
                    </span>
                  </div>
                </div>
              )}

              {!isStorekeeper && job.careOfParty && (
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
                <div className="sm:col-span-2 pt-2">
                  <JobRemarksCard
                    remarks={job.remarks}
                    showCustomerPayment={canViewFinancials && !isRestrictedRole}
                    showUnusedStockReason={!isRestrictedRole}
                    showFieldExecution={!isStorekeeper}
                    showPhotosCard={!isStorekeeper}
                  />
                </div>
              )}

              {(() => {
                let photos: string[] = [];
                try {
                  const raw = job.completionPhotos;
                  if (typeof raw === "string" && raw.trim()) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) photos = parsed.filter((p: unknown) => typeof p === "string");
                  }
                } catch {
                  photos = [];
                }
                if (photos.length === 0 || isStorekeeper) return null;
                return (
                  <div className="sm:col-span-2 pt-3 border-t border-[#E4E4E7]">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
                        <span>Completion photos ({photos.length})</span>
                      </p>
                      {photos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            photos.forEach((src, idx) => {
                              setTimeout(() => {
                                downloadImageFile(src, `job-${job.jobNumber}-photo-${idx + 1}.png`);
                              }, idx * 250);
                            });
                          }}
                          className="text-[11px] font-semibold text-[#0D7A5F] hover:text-[#0A624C] hover:underline inline-flex items-center gap-1 transition"
                          title="Download all completion photos"
                        >
                          <Download className="w-3 h-3" />
                          Download All ({photos.length})
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {photos.map((src, i) => (
                        <div
                          key={i}
                          className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border-2 border-[#E4E4E7] hover:border-[#0D7A5F] bg-zinc-100 shadow-xs hover:shadow-md transition cursor-pointer"
                          onClick={() => {
                            setLightboxImages(photos);
                            setLightboxIndex(i);
                            setLightboxOpen(true);
                          }}
                          title={`Click to view Photo ${i + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`Job completion ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages(photos);
                                setLightboxIndex(i);
                                setLightboxOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-zinc-900 shadow-md transition"
                              title="Open full image viewer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImageFile(src, `job-${job.jobNumber}-photo-${i + 1}.png`);
                              }}
                              className="p-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white shadow-md transition"
                              title="Download photo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Index Badge */}
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono font-bold text-white group-hover:opacity-0 transition-opacity">
                            #{i + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Assigned Tech, Warehouse Inventory & Lifecycle Stepper */}
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-[#18181B]">{job.assignedTechnician.name}</p>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                        ★ Lead Tech
                      </span>
                    </div>
                    <p className="text-[11px] text-[#71717A] font-mono">{job.assignedTechnician.phone}</p>
                  </div>
                </div>

                {job.assignments && job.assignments.length > 1 && (
                  <div className="pt-2 border-t border-[#F4F4F5] space-y-1.5">
                    <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                      Crew Members ({job.assignments.length})
                    </p>
                    <div className="space-y-1">
                      {job.assignments.map((asgn: any) => {
                        const isLead = asgn.role === "primary" || asgn.technicianId === job.assignedTechnicianId;
                        return (
                          <div key={asgn.id} className="flex items-center justify-between text-xs py-0.5">
                            <span className="font-medium text-[#18181B] flex items-center gap-1">
                              {asgn.technician?.name || "Technician"}
                              {isLead ? (
                                <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1 rounded">
                                  ★ Lead
                                </span>
                              ) : (
                                <span className="text-[9px] text-[#71717A] bg-[#F4F4F5] px-1 rounded">
                                  Crew
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-[#71717A] font-mono">{asgn.technician?.phone}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canReassignTech && canChangeTechnician(job) && (
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
                {canReassignTech && canChangeTechnician(job) && (
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

          {/* Central Warehouse Material & Inventory Issuance Card (Strictly visible only to Warehouse Storekeeper) */}
          {isStorekeeper && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-700" />
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Warehouse Inventory & Material Issuance
                  </h3>
                </div>
              </div>

              {/* Material Requests Table / List */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[#71717A] uppercase">
                  Technician Material Requests ({job.inventoryRequests?.length || 0})
                </p>
                {!job.inventoryRequests || job.inventoryRequests.length === 0 ? (
                  <div className="py-5 text-center bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] space-y-2">
                    <p className="text-xs text-[#A1A1AA]">
                      No material requests logged for this work order.
                    </p>
                    {canIssueStock && (
                      <button
                        type="button"
                        onClick={() => openIssueInventoryModal()}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Issue Stock Directly
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {job.inventoryRequests.map((req: any) => {
                      const reqQty = Number(req.qtyRequested || 0);
                      const issuedQty = Number(req.qtyIssued || 0);
                      const pendingQty = Math.max(0, reqQty - issuedQty);
                      const isFullyIssued =
                        req.status === "issued" || (reqQty > 0 && issuedQty >= reqQty);
                      const isPartial = !isFullyIssued && issuedQty > 0;

                      return (
                        <div
                          key={req.id}
                          className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <p className="font-bold text-[#18181B]">{req.item}</p>
                            <div className="flex items-center gap-2 text-[11px] text-[#71717A] flex-wrap">
                              <span>
                                Req Qty: <strong className="font-mono text-[#18181B]">{reqQty}</strong>
                              </span>
                              <span>•</span>
                              <span className={issuedQty > 0 ? "text-emerald-700 font-semibold" : ""}>
                                Issued: <strong className="font-mono">{issuedQty}</strong>
                              </span>
                              <span>•</span>
                              <span className={pendingQty > 0 ? "text-amber-800 font-semibold" : ""}>
                                Pending / Left: <strong className="font-mono">{pendingQty}</strong>
                              </span>
                              <span>•</span>
                              <span>{formatDateTime(req.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge
                              status={
                                isFullyIssued
                                  ? "issued"
                                  : isPartial
                                  ? "partially_issued"
                                  : "pending"
                              }
                            />
                            {!isFullyIssued && req.status !== "rejected" && canIssueStock && (
                              <button
                                type="button"
                                onClick={() => openIssueInventoryModal(req)}
                                className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-[11px] font-bold rounded-md shadow-2xs transition inline-flex items-center gap-1"
                              >
                                {isPartial ? "Issue Remaining Stock" : "Fulfill & Issue"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

          {/* Lifecycle State Machine Vertical Stepper (Hidden for Storekeeper) */}
          {!isStorekeeper && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider pb-2 border-b border-[#E4E4E7] flex items-center justify-between">
                <span>Lifecycle State Machine</span>
                <Clock className="w-3.5 h-3.5 text-[#71717A]" />
              </h3>

              <TimelineStepper steps={timelineSteps} />
            </div>
          )}
        </div>
      </div>

      {/* FULL-WIDTH VIEWPORT SECTIONS: Reconciliation, Deliverables & Settlements */}
      <div className="space-y-6">

        {/* ACCOUNTANT SUPER-VIEW FINANCIAL & STOCK RECONCILIATION SUMMARY */}
          {(isAccountant || isAdmin) && (
            <div className="bg-white rounded-xl p-5 border border-[#E4E4E7] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4F4F5]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0D7A5F] border border-emerald-200 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B]">
                      Accountant End-to-End Job Reconciliation
                    </h3>
                    <p className="text-[11px] text-[#71717A]">
                      Material lifecycle: Used, Left, Returned & Financial Settlements
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canAddService && !isRestrictedRole && canAddServiceOrItem(job) && (
                  <button
                    type="button"
                    onClick={() => setAddServiceDrawerOpen(true)}
                    className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Service</span>
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTaxInvoiceDrawerOpen(true)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{job.invoice ? `Print Invoice (${job.invoice.invoiceNumber})` : "Tax Invoice"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkOrderDrawerOpen(true)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print Work Order</span>
                  </button>
                </div>
              </div>


            </div>
          )}          {/* SEPARATE SERVICES & INVENTORY DELIVERABLES SECTION */}
          {(() => {
            const allItems = job.items || [];
            const serviceItems = allItems.filter((it: any) => isServiceItem(it));
            const inventoryItems = allItems.filter((it: any) => !isServiceItem(it));
            const storeIssuedItems = inventoryItems.filter(
              (it: any) =>
                it.description?.includes("[Issued by Storekeeper]") ||
                it.description?.toLowerCase().includes("issued by storekeeper")
            );
            const visibleInventoryItems = isStorekeeper ? storeIssuedItems : inventoryItems;

            const servicesPlannedTotal = serviceItems.reduce((s: number, it: any) => s + (it.quantityPlanned || 0) * (it.unitRate || 0), 0);
            const servicesActualTotal = serviceItems.reduce((s: number, it: any) => {
              const qty = it.quantityActual !== null && it.quantityActual !== undefined ? it.quantityActual : it.quantityPlanned;
              return s + (qty || 0) * (it.unitRate || 0);
            }, 0);

            const inventoryPlannedTotal = inventoryItems.reduce((s: number, it: any) => s + (it.quantityPlanned || 0) * (it.unitRate || 0), 0);
            const inventoryActualTotal = inventoryItems.reduce((s: number, it: any) => {
              const qty = it.quantityActual !== null && it.quantityActual !== undefined ? it.quantityActual : it.quantityPlanned;
              return s + (qty || 0) * (it.unitRate || 0);
            }, 0);            const parseItemPricing = (item: any) => {
              const desc = item.description || "";
              const matchApproved = desc.match(/\[Discount Approved:\s*-?\$?([0-9.]+),\s*Rate:\s*\$?([0-9.]+)\s*->\s*\$?([0-9.]+)\]/i);
              const matchRequested = desc.match(/\[Discount Requested:\s*\$?([0-9.]+)/i);
              const isIssuedByStore = desc.includes("[Issued by Storekeeper]") || desc.toLowerCase().includes("issued by storekeeper");

              const actualQty = item.quantityActual !== null && item.quantityActual !== undefined ? Number(item.quantityActual) : Number(item.quantityPlanned || 1);
              const issuedQty = Number(item.quantityPlanned !== null && item.quantityPlanned !== undefined ? item.quantityPlanned : actualQty);
              const currentRate = Number(item.unitRate || 0);

              if (matchApproved) {
                const discountAmt = parseFloat(matchApproved[1]);
                const originalRate = parseFloat(matchApproved[2]) || (currentRate + discountAmt);
                const discountedRate = parseFloat(matchApproved[3]) || currentRate;
                return {
                  originalRate,
                  discountAmt,
                  discountedRate,
                  hasDiscount: true,
                  isPendingDiscount: false,
                  issuedQty,
                  actualQty,
                  lineTotal: actualQty * discountedRate,
                  isIssuedByStore,
                };
              }

              if (matchRequested) {
                const requestedAmt = parseFloat(matchRequested[1]);
                return {
                  originalRate: currentRate,
                  discountAmt: requestedAmt,
                  discountedRate: currentRate,
                  hasDiscount: false,
                  isPendingDiscount: true,
                  issuedQty,
                  actualQty,
                  lineTotal: actualQty * currentRate,
                  isIssuedByStore,
                };
              }

              return {
                originalRate: currentRate,
                discountAmt: 0,
                discountedRate: currentRate,
                hasDiscount: false,
                isPendingDiscount: false,
                issuedQty,
                actualQty,
                lineTotal: actualQty * currentRate,
                isIssuedByStore,
              };
            };

            const renderItemRow = (item: any) => {
              const isService = isServiceItem(item);
              const pricing = parseItemPricing(item);

              const cleanTitle = (item.description || "")
                .replace(/^\s*\[Service\]\s*/gi, "")
                .replace(/\s*\[Service\]/gi, "")
                .replace(/^\s*\[Product\]\s*/gi, "")
                .replace(/\s*\[Product\]/gi, "")
                .replace(/\s*\[Service Added by.*?\]/gi, "")
                .replace(/\s*\[Issued by Storekeeper\]/gi, "")
                .replace(/\s*\[Issued by.*?\]/gi, "")
                .replace(/\s*\[Discount.*?\]/gi, "")
                .trim();

              const brandMatch = (job.remarks || "").match(/Brand:\s*([^|\]]+)/i);
              const extractedBrand = brandMatch ? brandMatch[1].trim() : null;

              return (
                <tr key={item.id} className="hover:bg-[#FAFAFA] transition">
                  {/* 1. Name */}
                  <td className="py-2.5 px-4 font-medium text-[#18181B]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-900">{cleanTitle}</span>
                      {isService ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                          Service Task
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                          Warehouse Stock
                        </span>
                      )}
                      {extractedBrand && !isService && (
                        <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                          Brand: {extractedBrand}
                        </span>
                      )}
                    </div>
                  </td>

                  {!isStorekeeper && canViewFinancials && !isRestrictedRole ? (
                    <>
                      {/* 2. Unit Price */}
                      <td className="py-2.5 px-4 text-right font-mono text-[#52525B]">
                        {formatCurrency(pricing.originalRate)}
                      </td>

                      {/* 3. Issued Qty */}
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-bold font-mono text-[11px]">
                          {pricing.issuedQty}
                        </span>
                      </td>

                      {/* 4. Used Qty */}
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold font-mono text-xs shadow-2xs">
                          {pricing.actualQty}
                        </span>
                      </td>

                      {/* 5. Discounted Price (if any) */}
                      <td className="py-2.5 px-4 text-right font-mono">
                        {pricing.hasDiscount ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(pricing.discountedRate)}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded mt-0.5">
                              -{formatCurrency(pricing.discountAmt)} off
                            </span>
                          </div>
                        ) : pricing.isPendingDiscount ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="text-zinc-600 font-mono">{formatCurrency(pricing.originalRate)}</span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded mt-0.5">
                              Pending -{formatCurrency(pricing.discountAmt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#A1A1AA] font-mono">—</span>
                        )}
                      </td>

                      {/* 6. Total */}
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(pricing.lineTotal)}
                      </td>

                      {/* 7. Discount Action */}
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
                              pricing.isPendingDiscount
                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                : "bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B]"
                            }`}
                          >
                            {pricing.isPendingDiscount ? "Authorize Discount" : "Give Discount"}
                          </button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-zinc-800">
                        {pricing.issuedQty}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-800">
                        {pricing.actualQty}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {isService ? (
                          <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Service Line
                          </span>
                        ) : pricing.isIssuedByStore ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ✓ Warehouse Issued
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                            Scope Item
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            };

            return (
              <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden space-y-0">
                {/* Master Header with Tab Navigation */}
                <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      {isStorekeeper
                        ? "Warehouse Stock Issued"
                        : "Planned vs Actual Deliverables · Services & Inventory"}
                    </h2>
                    <p className="text-[11px] text-[#71717A] mt-0.5">
                      {isStorekeeper
                        ? "Materials and spare parts dispatched from warehouse for this work order."
                        : "Services and warehouse inventory are tracked separately with dedicated subtotals and verification."}
                    </p>
                  </div>

                  {/* Section View Tabs & Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isStorekeeper && (
                      <div className="inline-flex rounded-lg bg-[#E4E4E7]/70 p-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setDeliverableActiveTab("all")}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition text-[11px]",
                            deliverableActiveTab === "all"
                              ? "bg-white text-zinc-900 shadow-2xs font-bold"
                              : "text-zinc-600 hover:text-zinc-900"
                          )}
                        >
                          All ({allItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliverableActiveTab("services")}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition text-[11px] inline-flex items-center gap-1",
                            deliverableActiveTab === "services"
                              ? "bg-white text-emerald-800 shadow-2xs font-bold"
                              : "text-zinc-600 hover:text-zinc-900"
                          )}
                        >
                          <Wrench className="w-3 h-3 text-emerald-600" />
                          Services ({serviceItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliverableActiveTab("inventory")}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition text-[11px] inline-flex items-center gap-1",
                            deliverableActiveTab === "inventory"
                              ? "bg-white text-blue-800 shadow-2xs font-bold"
                              : "text-zinc-600 hover:text-zinc-900"
                          )}
                        >
                          <Package className="w-3 h-3 text-blue-600" />
                          Inventory ({inventoryItems.length})
                        </button>
                      </div>
                    )}

                    {!isStorekeeper && canAddService && !isRestrictedRole && canAddServiceOrItem(job) && (
                      <button
                        type="button"
                        onClick={() => setAddServiceDrawerOpen(true)}
                        className="px-2.5 py-1 text-xs font-bold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        + Add Service
                      </button>
                    )}

                    {canIssueStock && (
                      <button
                        type="button"
                        onClick={() => openIssueInventoryModal()}
                        className="px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition flex items-center gap-1 shadow-2xs"
                      >
                        <Package className="w-3 h-3 text-amber-700" />
                        + Issue Stock
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. SECTION: SERVICES & TECHNICAL LABOR */}
                {!isStorekeeper && (deliverableActiveTab === "all" || deliverableActiveTab === "services") && (
                  <div className="border-b border-[#E4E4E7]">
                    <div className="px-5 py-2.5 bg-emerald-50/50 border-b border-emerald-100/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#0D7A5F]" />
                        <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          1. Services & Technical Labor ({serviceItems.length})
                        </span>
                        <span className="text-[10px] text-emerald-700 hidden sm:inline">
                          • Diagnostic inspections, maintenance tasks & service fees
                        </span>
                      </div>
                      {!isStorekeeper && canViewFinancials && !isRestrictedRole && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded">
                            Subtotal: {formatCurrency(servicesActualTotal)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F9FAFB]">
                            <th className="py-2 px-4">Service Description</th>
                            {!isStorekeeper && canViewFinancials && !isRestrictedRole ? (
                              <>
                                <th className="py-2 px-4 text-right">Unit Price</th>
                                <th className="py-2 px-4 text-center">Issued Qty</th>
                                <th className="py-2 px-4 text-center">Used Qty</th>
                                <th className="py-2 px-4 text-right">Discounted Price</th>
                                <th className="py-2 px-4 text-right">Total</th>
                                <th className="py-2 px-4 text-right">Discount Action</th>
                              </>
                            ) : (
                              <>
                                <th className="py-2 px-4 text-center">Issued Qty</th>
                                <th className="py-2 px-4 text-center">Used Qty</th>
                                <th className="py-2 px-4 text-center">Service Status</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E7]">
                          {serviceItems.length > 0 ? (
                            serviceItems.map(renderItemRow)
                          ) : (
                            <tr>
                              <td
                                colSpan={!isStorekeeper && canViewFinancials && !isRestrictedRole ? 7 : 4}
                                className="py-6 text-center text-[#71717A] text-xs italic bg-white"
                              >
                                No technical service or labor items recorded. Use &quot;+ Add Service&quot; to log work scopes.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. SECTION: INVENTORY, SPARE PARTS & MATERIALS */}
                {(isStorekeeper || deliverableActiveTab === "all" || deliverableActiveTab === "inventory") && (
                  <div>
                    <div className="px-5 py-2.5 bg-blue-50/50 border-b border-blue-100/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-700" />
                        <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                          {isStorekeeper
                            ? `Warehouse Stock Dispatched (${visibleInventoryItems.length})`
                            : `2. Inventory, Spare Parts & Warehouse Materials (${inventoryItems.length})`}
                        </span>
                        <span className="text-[10px] text-blue-700 hidden sm:inline">
                          {isStorekeeper
                            ? "• Physical spare parts and items issued by the storekeeper"
                            : "• Physical parts, consumables & appliances deducted from warehouse"}
                        </span>
                      </div>
                      {!isStorekeeper && canViewFinancials && !isRestrictedRole && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-blue-900 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded">
                            Subtotal: {formatCurrency(inventoryActualTotal)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F9FAFB]">
                            <th className="py-2 px-4">Item Description & Brand</th>
                            {!isStorekeeper && canViewFinancials && !isRestrictedRole ? (
                              <>
                                <th className="py-2 px-4 text-right">Unit Price</th>
                                <th className="py-2 px-4 text-center">Issued Qty</th>
                                <th className="py-2 px-4 text-center">Used Qty</th>
                                <th className="py-2 px-4 text-right">Discounted Price</th>
                                <th className="py-2 px-4 text-right">Total</th>
                                <th className="py-2 px-4 text-right">Discount Action</th>
                              </>
                            ) : (
                              <>
                                <th className="py-2 px-4 text-center">Qty Issued</th>
                                <th className="py-2 px-4 text-center">Qty (Used)</th>
                                <th className="py-2 px-4 text-center">Warehouse Status</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E7]">
                          {visibleInventoryItems.length > 0 ? (
                            visibleInventoryItems.map(renderItemRow)
                          ) : (
                            <tr>
                              <td
                                colSpan={!isStorekeeper && canViewFinancials && !isRestrictedRole ? 7 : 4}
                                className="py-6 text-center text-[#71717A] text-xs italic bg-white"
                              >
                                {isStorekeeper
                                  ? "No warehouse materials have been issued by the storekeeper yet."
                                  : "No physical spare parts or inventory items assigned to this work order."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Combined Financial Reconciliation Footer */}
                {!isStorekeeper && canViewFinancials && !isRestrictedRole ? (
                  <div className="p-5 bg-[#FAFAFA] border-t border-[#E4E4E7] space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-[#E4E4E7]/80">
                      <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold block">Services Subtotal</span>
                        <span className="font-mono font-bold text-emerald-950 text-sm mt-0.5 block">
                          {formatCurrency(servicesActualTotal)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200">
                        <span className="text-[10px] text-blue-800 uppercase font-bold block">Inventory & Parts Subtotal</span>
                        <span className="font-mono font-bold text-blue-950 text-sm mt-0.5 block">
                          {formatCurrency(inventoryActualTotal)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200">
                        <span className="text-[10px] text-zinc-600 uppercase font-bold block">Gross Deliverables Subtotal</span>
                        <span className="font-mono font-bold text-zinc-900 text-sm mt-0.5 block">
                          {formatCurrency(effectiveBillAmount)}
                        </span>
                      </div>
                    </div>

                    {job.discountAmount > 0 && (
                      <div className="flex items-center justify-between text-[#D97706] font-medium pt-1">
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
                ) : null}
              </div>
            );
          })()}

          {/* Field Settlements & Customer Collections (Masked if lacks financial permission or restricted role) */}
          {canViewFinancials && !isRestrictedRole && (
            <div className="space-y-6">
              {/* 3. SECTION: FIELD SETTLEMENT & CUSTOMER COLLECTIONS */}
              {(() => {
                const activeSettlements = (job.hisaabSettlements || []).filter((s: any) => s.status !== "superseded");
                const totalSettled = activeSettlements.reduce((sum: number, s: any) => sum + (Number(s.amountCollected) || 0), 0);

                return (
                  <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
                    <div className="px-5 py-2.5 bg-emerald-50/50 border-b border-emerald-100/80 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#0D7A5F]" />
                        <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          3. Field Settlement & Customer Collections ({activeSettlements.length})
                        </span>
                        <span className="text-[10px] text-emerald-700 hidden sm:inline">
                          • Customer cash handovers, digital payments & safe verification
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {totalSettled > 0 && (
                          <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded">
                            Collected: {formatCurrency(totalSettled)}
                          </span>
                        )}
                        {(isAccountant || isAdmin || canViewFinancials) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSettlementForHandover(null);
                              setReceiveCashDrawerOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Receive Cash</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F9FAFB]">
                            <th className="py-2.5 px-4">Date & Time</th>
                            <th className="py-2.5 px-4">Settled By</th>
                            <th className="py-2.5 px-4 text-right">Expected Amount</th>
                            <th className="py-2.5 px-4 text-right">Collected Amount</th>
                            <th className="py-2.5 px-4">Accounts Handover & Safe Status</th>
                            <th className="py-2.5 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E7]">
                          {activeSettlements.length > 0 ? (
                            activeSettlements.map((s: any) => {
                              const isFieldReported = s.status === "field_reported";
                              const hasHandover =
                                s.amountReceivedByAccountant !== null &&
                                s.amountReceivedByAccountant !== undefined;
                              const isFullyHandedOver =
                                hasHandover &&
                                Number(s.amountReceivedByAccountant) >= Number(s.amountCollected);
                              const pendingHandoverAmount = Math.max(
                                0,
                                Number(s.amountCollected) - (Number(s.amountReceivedByAccountant) || 0)
                              );

                              return (
                                <tr key={s.id} className="hover:bg-[#FAFAFA] transition">
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="font-mono text-xs text-[#18181B]">
                                      {formatDateTime(s.settledAt)}
                                    </div>
                                    {isFieldReported && (
                                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                        Field-reported (Pending GL)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-[#52525B]">
                                    {s.settledBy || "Technician"}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono text-[#52525B]">
                                    <div>{formatCurrency(s.amountExpected)}</div>
                                    {s.balanceDue ? (
                                      <div className="text-[10px] text-[#A1A1AA]">
                                        Bal Due: {formatCurrency(s.balanceDue)}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 text-sm whitespace-nowrap">
                                    {formatCurrency(s.amountCollected)}
                                  </td>
                                  <td className="py-3 px-4">
                                    {hasHandover ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {isFullyHandedOver ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              Fully Handed Over ({formatCurrency(s.amountReceivedByAccountant)})
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                                              Partial ({formatCurrency(s.amountReceivedByAccountant)}) • {formatCurrency(pendingHandoverAmount)} with Tech
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-[#71717A]">
                                          Received by <strong>{s.accountantReceivedBy || "Accounts"}</strong>
                                          {s.accountantReceivedAt && ` on ${formatDateTime(s.accountantReceivedAt)}`}
                                          {s.accountantDepositAccount && (
                                            <span className="font-mono ml-1.5">• Safe: {s.accountantDepositAccount}</span>
                                          )}
                                          {s.accountantNotes && (
                                            <span className="italic block text-[10px] text-[#71717A] mt-0.5">
                                              &ldquo;{s.accountantNotes}&rdquo;
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                          <Clock className="w-3 h-3 text-amber-600" />
                                          Pending Handover to Safe ({formatCurrency(s.amountCollected)} with Tech)
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    {(isAccountant || isAdmin || canViewFinancials) && (
                                      hasHandover ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedSettlementForHandover(s);
                                            setReceiveCashDrawerOpen(true);
                                          }}
                                          className="text-[11px] font-semibold text-[#0D7A5F] hover:underline"
                                        >
                                          Update Received →
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedSettlementForHandover(s);
                                            setReceiveCashDrawerOpen(true);
                                          }}
                                          className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1"
                                        >
                                          <Banknote className="w-3 h-3" />
                                          <span>Receive from Tech</span>
                                        </button>
                                      )
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-8 text-center text-[#71717A] text-xs bg-white space-y-2"
                              >
                                <p className="italic">No customer cash settlement recorded yet.</p>
                                {(isAccountant || isAdmin || canViewFinancials) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSettlementForHandover(null);
                                      setReceiveCashDrawerOpen(true);
                                    }}
                                    className="text-xs font-semibold text-[#0D7A5F] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Record Cash Received from Technician</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

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
        isOpen={showReassignDrawer && canChangeTechnician(job)}
        onClose={() => setShowReassignDrawer(false)}
        job={job}
        technicians={technicians}
        onAssigned={(successor?: any) => {
          if (successor?.id && successor.id !== job?.id) {
            setSuccessMsg(`Work Order #${job?.jobNumber} ended & reassigned to Work Order #${successor.jobNumber || "new job"}. Loading new job...`);
            setTimeout(() => {
              router.push(`/jobs/${successor.id}`);
            }, 600);
          } else {
            setSuccessMsg("Technician assigned and dispatch alert sent successfully!");
            fetchJob();
          }
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
                Auditor Verification Checklist
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
              All 3 conditions must be physically verified before final audit sign-off. Feedback (customer + technician calls) already happened after complete. Call-center feedback (customer + technician) already ran after complete; this step is auditor sign-off.
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

      {/* AUDITOR DISAPPROVE MODAL */}
      {showSendBackModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-rose-700" />
                Disapprove Work Order #{job.jobNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowSendBackModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#52525B]">
              Audit objection: Disapproving this job marks its quality flag as disputed and routes it back
              for correction. Select the remediation destination:
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#18181B] block">
                Routing Destination *
              </label>
              <div className="grid grid-cols-1 gap-2">
                <label
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs transition",
                    disapproveTarget === "InProgress"
                      ? "border-amber-500 bg-amber-50/60 font-semibold"
                      : "border-[#E4E4E7] bg-white"
                  )}
                >
                  <input
                    type="radio"
                    name="jobDisapproveTarget"
                    checked={disapproveTarget === "InProgress"}
                    onChange={() => setDisapproveTarget("InProgress")}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div>
                    <span className="text-[#18181B] block font-medium">Technician Rework (In Progress)</span>
                    <span className="text-[11px] text-[#71717A]">
                      Send back to assigned technician to re-do work or take required photos.
                    </span>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs transition",
                    disapproveTarget === "AwaitingFeedback"
                      ? "border-amber-500 bg-amber-50/60 font-semibold"
                      : "border-[#E4E4E7] bg-white"
                  )}
                >
                  <input
                    type="radio"
                    name="jobDisapproveTarget"
                    checked={disapproveTarget === "AwaitingFeedback"}
                    onChange={() => setDisapproveTarget("AwaitingFeedback")}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div>
                    <span className="text-[#18181B] block font-medium">Call Center Re-Check (Awaiting Feedback)</span>
                    <span className="text-[11px] text-[#71717A]">
                      Return to call center queue for customer follow-up or re-clarification.
                    </span>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs transition",
                    disapproveTarget === "CompletedPendingVerification"
                      ? "border-amber-500 bg-amber-50/60 font-semibold"
                      : "border-[#E4E4E7] bg-white"
                  )}
                >
                  <input
                    type="radio"
                    name="jobDisapproveTarget"
                    checked={disapproveTarget === "CompletedPendingVerification"}
                    onChange={() => setDisapproveTarget("CompletedPendingVerification")}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div>
                    <span className="text-[#18181B] block font-medium">Accounting / Audit Hold (Disputed Flag)</span>
                    <span className="text-[11px] text-[#71717A]">
                      Hold in verification queue with Disputed flag for management review.
                    </span>
                  </div>
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#18181B] block mb-1">
                Disapproval Reason / Auditor Notes *
              </label>
              <textarea
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                rows={3}
                required
                placeholder="Explain what failed audit check (e.g., photo mismatch, complaint unresolved, billing discrepancy)..."
                className="w-full p-2.5 rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowSendBackModal(false)}
                className="px-3 py-1.5 text-xs text-[#71717A] rounded-lg hover:bg-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSendBackFromVerification}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Disapproval
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


      {/* ISSUE WAREHOUSE STOCK DRAWER */}
      <IssueWarehouseStockDrawer
        isOpen={issueStockDrawerOpen}
        onClose={() => {
          setIssueStockDrawerOpen(false);
          setSelectedReqItem(null);
        }}
        job={job}
        reqItem={selectedReqItem}
        actor={`${currentPersona.name} (${currentPersona.designation || "Storekeeper"})`}
        isStorekeeper={isStorekeeper}
        onSuccess={() => {
          setSuccessMsg(`Successfully issued warehouse stock to Job #${job?.jobNumber || ""}.`);
          fetchJob();
        }}
      />

      {/* RECORD STOCK RETURN DRAWER */}
      <RecordStockReturnDrawer
        isOpen={stockReturnDrawerOpen}
        onClose={() => setStockReturnDrawerOpen(false)}
        job={job}
        storekeeperName={`${currentPersona.name} (${currentPersona.designation || "Storekeeper"})`}
        onSuccess={() => {
          setSuccessMsg("Stock return recorded and restocked in warehouse ledger.");
          fetchJob();
        }}
      />

      {/* REPORT MISPLACED ITEM DRAWER */}
      <ReportMisplacedItemDrawer
        isOpen={misplacedDrawerOpen}
        onClose={() => setMisplacedDrawerOpen(false)}
        job={job}
        actor={`${currentPersona.name} (${currentPersona.designation || "Storekeeper"})`}
        onSuccess={() => {
          setSuccessMsg("Misplaced item recorded in audit log. Technician accountability flagged.");
          fetchJob();
        }}
      />

      {/* ADD SERVICE / LINE ITEM DRAWER */}
      <AddServiceDrawer
        isOpen={addServiceDrawerOpen && canAddServiceOrItem(job)}
        onClose={() => setAddServiceDrawerOpen(false)}
        job={job}
        actor={`${currentPersona.name} (${currentPersona.designation || "Accountant"})`}
        onSuccess={() => {
          setSuccessMsg(`Service item added to Job #${job?.jobNumber || ""} successfully.`);
          fetchJob();
        }}
      />

      {/* TAX INVOICE DRAWER */}
      <TaxInvoiceDrawer
        isOpen={taxInvoiceDrawerOpen}
        onClose={() => setTaxInvoiceDrawerOpen(false)}
        job={job}
        actor={`${currentPersona.name} (${currentPersona.designation || "Accountant"})`}
        netPayable={netPayable}
        onSuccess={(invNumber) => {
          setSuccessMsg(`Tax Invoice ${invNumber} generated successfully!`);
          fetchJob();
        }}
      />

      {/* WORK ORDER TECHNICAL PRINT DRAWER */}
      <WorkOrderDrawer
        isOpen={workOrderDrawerOpen}
        onClose={() => setWorkOrderDrawerOpen(false)}
        job={job}
      />

      {/* RECEIVE TECHNICIAN CASH HANDOVER DRAWER */}
      <ReceiveTechnicianCashDrawer
        isOpen={receiveCashDrawerOpen}
        onClose={() => {
          setReceiveCashDrawerOpen(false);
          setSelectedSettlementForHandover(null);
        }}
        job={job}
        settlement={selectedSettlementForHandover}
        currentAccountantName={`${currentPersona.name} (${currentPersona.designation || "Accountant"})`}
        onSuccess={() => {
          setSuccessMsg(`Technician cash handover recorded and reconciled successfully!`);
          fetchJob();
        }}
      />

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={`Work Order #${job?.jobNumber || ""} — Completion Proof`}
        filePrefix={`job-${job?.jobNumber || "job"}-proof`}
      />
    </div>
  );
}
