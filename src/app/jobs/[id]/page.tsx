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
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";
import { procurementActorHeaders } from "@/lib/procurementClient";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const { activeRole, currentPersona, hasPermission } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
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
  const [clearanceMode, setClearanceMode] = useState<"full" | "partial">("full");
  const [partialAmountToPay, setPartialAmountToPay] = useState<string>("");
  const [expensePaymentNotes, setExpensePaymentNotes] = useState<string>("");

  // Action Side Drawers
  const [issueStockDrawerOpen, setIssueStockDrawerOpen] = useState(false);
  const [selectedReqItem, setSelectedReqItem] = useState<any>(null);
  const [stockReturnDrawerOpen, setStockReturnDrawerOpen] = useState(false);
  const [misplacedDrawerOpen, setMisplacedDrawerOpen] = useState(false);
  const [addServiceDrawerOpen, setAddServiceDrawerOpen] = useState(false);
  const [taxInvoiceDrawerOpen, setTaxInvoiceDrawerOpen] = useState(false);
  const [receiveCashDrawerOpen, setReceiveCashDrawerOpen] = useState(false);
  const [selectedSettlementForHandover, setSelectedSettlementForHandover] = useState<any | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // Accountant Expense Clearance Handler (Bulk / All Pending or Specific)
  const handleClearExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const pendingClaims = (job.expenseClaims || []).filter((c: any) => c.status === "pending");
    const totalPending = pendingClaims.reduce((s: number, c: any) => s + c.amount, 0);
    const targetMax = selectedClaimToClear ? selectedClaimToClear.amount : totalPending;

    if (targetMax <= 0) {
      alert("There are no pending expenses to clear.");
      return;
    }

    const amountToDisburse =
      clearanceMode === "partial" ? Number(partialAmountToPay) : targetMax;

    if (!amountToDisburse || amountToDisburse <= 0) {
      alert("Please enter a valid disbursement amount greater than 0");
      return;
    }
    if (amountToDisburse > targetMax) {
      alert(`Disbursement amount cannot exceed pending balance of ${formatCurrency(targetMax)}`);
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_expense",
          claimId: selectedClaimToClear?.id,
          actor: `${currentPersona.name} (${currentPersona.designation})`,
          disbursingAccountCode,
          amountToPay: amountToDisburse,
          paymentNotes: expensePaymentNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setClearExpenseModalOpen(false);

      if (amountToDisburse < targetMax) {
        const remaining = targetMax - amountToDisburse;
        setSuccessMsg(
          `Partial disbursement of ${formatCurrency(amountToDisburse)} posted to General Ledger. Remaining balance of ${formatCurrency(remaining)} stays pending on this job to be cleared afterwards.`
        );
      } else {
        setSuccessMsg(
          `Technician expenses of ${formatCurrency(targetMax)} fully cleared and posted to General Ledger.`
        );
      }

      fetchJob();

      realtimeSync.publish("EXPENSE_APPROVED", {
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianId: job.assignedTechnicianId,
        actor: currentPersona.name,
        message: `Accountant ${currentPersona.name} cleared ${formatCurrency(amountToDisburse)} field expenses on Job #${job.jobNumber}`,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Issue Inventory drawer
  const openIssueInventoryModal = (reqItem?: any) => {
    setSelectedReqItem(reqItem || null);
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
      alert("A send-back note is required.");
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
        "Job sent back to accountant (CompletedPendingVerification). Re-finalize after corrections."
      );
      fetchJob();
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
        subtitle={`${job.customer?.name} • ${formatJobType(job.jobType)}`}
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

                {canAddService && !isRestrictedRole && (
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

                {canVerify && job.status === "Finalized" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Auditor Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSendBackNote("");
                        setShowSendBackModal(true);
                      }}
                      className="h-8 px-3.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-950 inline-flex items-center gap-1.5 transition shadow-xs"
                    >
                      Send Back
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

      {/* Storekeeper Specific Queue & Fulfillment Banner */}
      {isStorekeeper && (!job.inventoryRequests || job.inventoryRequests.length === 0) && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Storekeeper Notice:</strong> This work order currently has no material or inventory requests logged. Storekeeper actions are restricted solely to fulfilling warehouse stock requests.
          </span>
        </div>
      )}
      {isStorekeeper && job.inventoryRequests && job.inventoryRequests.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-950 text-xs font-medium rounded-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Storekeeper Mode:</strong> Viewing material requests for Work Order #{job.jobNumber}. You have sole authorization to issue physical stock from warehouse inventory.
            </span>
          </div>
          <button
            type="button"
            onClick={() => openIssueInventoryModal()}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-md shadow-2xs transition shrink-0 inline-flex items-center gap-1"
          >
            <Package className="w-3.5 h-3.5" />
            + Issue Stock Now
          </button>
        </div>
      )}

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
                <div className="sm:col-span-2 pt-2">
                  <JobRemarksCard
                    remarks={job.remarks}
                    showCustomerPayment={canViewFinancials && !isRestrictedRole}
                    showUnusedStockReason={!isRestrictedRole}
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
                if (photos.length === 0) return null;
                return (
                  <div className="sm:col-span-2 pt-3 border-t border-[#E4E4E7]">
                    <p className="text-[11px] font-semibold text-[#71717A] uppercase mb-2">
                      Completion photos ({photos.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-20 h-20 rounded-lg overflow-hidden border border-[#E4E4E7] bg-zinc-100 hover:ring-2 hover:ring-[#0D7A5F]"
                          title={`Proof photo ${i + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Job completion ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

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
                  <button
                    type="button"
                    onClick={() => setAddServiceDrawerOpen(true)}
                    className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Service</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxInvoiceDrawerOpen(true)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{job.invoice ? `Print Invoice (${job.invoice.invoiceNumber})` : "Tax Invoice"}</span>
                  </button>
                </div>
              </div>

              {(() => {
                const stockItems = (job.items || []).filter((it: any) => !isServiceItem(it));
                const stockPlanned = stockItems.reduce((s: number, it: any) => s + (it.quantityPlanned || 0), 0);
                const stockActual = stockItems.reduce(
                  (s: number, it: any) => s + (it.quantityActual ?? it.quantityPlanned ?? 0),
                  0
                );
                const stockUnused = Math.max(0, stockPlanned - stockActual);
                const stockReturned = job.stockReturns?.reduce((s: number, r: any) => s + (r.qtyReturned || 0), 0) || 0;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 bg-zinc-50/80 rounded-xl border border-zinc-200">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Total Planned</span>
                      <span className="text-xl font-black font-mono text-[#18181B] mt-1 block">
                        {stockPlanned} <span className="text-xs font-semibold text-zinc-500 font-sans">units</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Stock Items</span>
                    </div>
                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider block">Installed / Used</span>
                      <span className="text-xl font-black font-mono text-[#0D7A5F] mt-1 block">
                        {stockActual} <span className="text-xs font-semibold text-emerald-700 font-sans">units</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">Stock Consumed</span>
                    </div>
                    <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-800 uppercase font-bold tracking-wider block">Unused / Left</span>
                      <span className="text-xl font-black font-mono text-amber-900 mt-1 block">
                        {stockUnused} <span className="text-xs font-semibold text-amber-700 font-sans">units</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-medium mt-0.5 block">
                        Returned: {stockReturned} units
                      </span>
                    </div>
                    <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200">
                      <span className="text-[10px] text-purple-800 uppercase font-bold tracking-wider block">Net Invoice Total</span>
                      <span className="text-xl font-black font-mono text-purple-950 mt-1 block">
                        {formatCurrency(netPayable)}
                      </span>
                      <span className="text-[10px] text-purple-700 font-medium mt-0.5 block">
                        Collected: {formatCurrency(job.hisaabSettlements?.reduce((s: number, st: any) => s + (st.amountCollected || 0), 0) || 0)}
                      </span>
                    </div>
                  </div>
                );
              })()}
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
              {canAddService && !isRestrictedRole && (
                <button
                  type="button"
                  onClick={() => setAddServiceDrawerOpen(true)}
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
                    {canViewFinancials && !isRestrictedRole ? (
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
                      const isService = isServiceItem(item);
                      const rowActualTotal =
                        actualQty !== null && actualQty !== undefined
                          ? actualQty * item.unitRate
                          : item.quantityPlanned * item.unitRate;

                      const isRequested = item.description?.includes("[Discount Requested:");
                      const isApproved = item.description?.includes("[Discount Approved:");
                      const isIssuedByStore = item.description?.includes("[Issued by Storekeeper]");
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

                      return (
                        <tr key={item.id} className="hover:bg-[#FAFAFA] transition">
                          <td className="py-2.5 px-4 font-medium text-[#18181B]">
                            <div>{cleanTitle}</div>
                            {isRequested && canViewFinancials && !isRestrictedRole && (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  ⏳ {item.description.match(/\[Discount Requested: ([^\]]+)\]/)?.[1] || "Discount Requested"}
                                </span>
                              </div>
                            )}
                            {isApproved && canViewFinancials && !isRestrictedRole && (
                              <div className="mt-1">
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  ✓ {item.description.match(/\[Discount Approved: ([^\]]+)\]/)?.[1] || "Discount Approved"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center text-[#71717A] font-mono">
                            {isService ? (
                              <span className="text-[#A1A1AA] font-mono select-none" title="Flat Service Rate (Quantity Not Applicable)">—</span>
                            ) : (
                              item.quantityPlanned
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {isService ? (
                              <span className="text-[#A1A1AA] font-mono select-none" title="Flat Service Rate (Quantity Not Applicable)">—</span>
                            ) : actualQty !== null && actualQty !== undefined ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold font-mono text-[11px]">
                                {actualQty}
                              </span>
                            ) : (
                              <span className="text-[#A1A1AA] italic text-[11px]">
                                Pending Tech Completion
                              </span>
                            )}
                          </td>
                          {canViewFinancials && !isRestrictedRole ? (
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
                              {isService ? (
                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                  Service Line
                                </span>
                              ) : isIssuedByStore ? (
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
                      <td colSpan={canViewFinancials && !isRestrictedRole ? 6 : 4} className="py-8 text-center text-[#71717A] text-xs">
                        No planned line items recorded during intake. Scope of work and materials will be recorded by the technician or accountant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary vs Physical Scope Footer */}
            {canViewFinancials && !isRestrictedRole ? (
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
            ) : null}
          </div>

          {/* Settlements & Field Expenses (Masked if lacks financial permission or restricted role) */}
          {canViewFinancials && !isRestrictedRole && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Settlements & Technician Cash Handover */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    <Receipt className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    <span>Field Settlement & Customer Collections</span>
                  </div>
                  {(isAccountant || isAdmin || canViewFinancials) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSettlementForHandover(null);
                        setReceiveCashDrawerOpen(true);
                      }}
                      className="text-[11px] font-bold text-[#0D7A5F] hover:text-[#0A624C] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition shadow-2xs inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Receive Cash</span>
                    </button>
                  )}
                </div>

                {!job.hisaabSettlements || job.hisaabSettlements.length === 0 ? (
                  <div className="p-4 bg-[#FAFAFA] rounded-xl border border-dashed border-[#E4E4E7] text-center space-y-1.5">
                    <p className="text-xs text-[#71717A]">
                      No customer cash settlement recorded yet.
                    </p>
                    {(isAccountant || isAdmin || canViewFinancials) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSettlementForHandover(null);
                          setReceiveCashDrawerOpen(true);
                        }}
                        className="text-xs font-semibold text-[#0D7A5F] hover:underline"
                      >
                        + Record Cash Received from Technician
                      </button>
                    )}
                  </div>
                ) : (
                  job.hisaabSettlements.map((s: any) => {
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
                      <div
                        key={s.id}
                        className="p-3.5 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7] text-xs space-y-2.5 transition hover:border-emerald-200 shadow-2xs"
                      >
                        {/* 1. Customer Collection Line */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-950 font-mono text-xs flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              {formatCurrency(s.amountCollected)} Collected
                            </span>
                            <span className="text-[10px] text-[#71717A] font-mono">
                              {formatDateTime(s.settledAt)}
                            </span>
                          </div>
                          <p className="text-[#52525B] text-[11px]">
                            Expected: {formatCurrency(s.amountExpected)} • Balance Due: {formatCurrency(s.balanceDue)}
                          </p>
                          {s.settledBy && (
                            <p className="text-[#71717A] text-[10px]">
                              {s.settledBy}
                            </p>
                          )}
                        </div>

                        {/* 2. Accountant Cash Handover Verification Status */}
                        <div className="pt-2 border-t border-[#EDEDED]">
                          {hasHandover ? (
                            <div
                              className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                                isFullyHandedOver
                                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                                  : "bg-amber-50/80 border-amber-200 text-amber-950"
                              }`}
                            >
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <span className="font-bold text-xs font-mono flex items-center gap-1.5">
                                  {isFullyHandedOver ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  )}
                                  Received by Accounts: {formatCurrency(s.amountReceivedByAccountant)}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isFullyHandedOver
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {isFullyHandedOver
                                    ? "Fully Handed Over"
                                    : `Partial (${formatCurrency(pendingHandoverAmount)} with Tech)`}
                                </span>
                              </div>

                              <p className="text-[11px] opacity-90">
                                Received by <strong>{s.accountantReceivedBy || "Accounts"}</strong>
                                {s.accountantReceivedAt ? ` on ${formatDateTime(s.accountantReceivedAt)}` : ""}
                              </p>
                              {s.accountantDepositAccount && (
                                <p className="text-[10px] opacity-75 font-mono">
                                  Vault / Safe: {s.accountantDepositAccount}
                                </p>
                              )}
                              {s.accountantNotes && (
                                <p className="text-[11px] italic opacity-85 mt-0.5">
                                  "{s.accountantNotes}"
                                </p>
                              )}

                              {(isAccountant || isAdmin || canViewFinancials) && (
                                <div className="pt-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSettlementForHandover(s);
                                      setReceiveCashDrawerOpen(true);
                                    }}
                                    className="text-[10px] font-semibold text-[#0D7A5F] hover:underline"
                                  >
                                    Update Received Amount →
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  Pending Handover to Accounts
                                </span>
                                <p className="text-[11px] text-amber-800">
                                  {formatCurrency(s.amountCollected)} is currently with the technician.
                                </p>
                              </div>

                              {(isAccountant || isAdmin || canViewFinancials) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSettlementForHandover(s);
                                    setReceiveCashDrawerOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap flex items-center justify-center gap-1.5"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  <span>Receive from Tech</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Field Expenses with Accountant Clearance */}
              {(() => {
                const claims = job.expenseClaims || [];
                const totalClaimed = claims.reduce((s: number, c: any) => s + c.amount, 0);
                const totalPaid = claims.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + c.amount, 0);
                const totalPending = claims.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + c.amount, 0);
                const pendingClaimsCount = claims.filter((c: any) => c.status === "pending").length;

                const openClearanceModalForJob = () => {
                  setSelectedClaimToClear(null);
                  setClearanceMode("full");
                  setPartialAmountToPay(String(totalPending));
                  setExpensePaymentNotes("");
                  setDisbursingAccountCode("1000");
                  setClearExpenseModalOpen(true);
                };

                return (
                  <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B] uppercase tracking-wider">
                        <Receipt className="w-3.5 h-3.5 text-[#D97706]" />
                        Technician Field Expenses
                      </div>
                      <div className="flex items-center gap-2">
                        {totalPending > 0 && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            {pendingClaimsCount} Pending • {formatCurrency(totalPending)} Due
                          </span>
                        )}
                        {totalPending > 0 && (isAccountant || isAdmin) && (
                          <button
                            type="button"
                            onClick={openClearanceModalForJob}
                            className="px-3 py-1 text-xs font-bold bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Clear Expenses ({formatCurrency(totalPending)})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Financial Metrics Summary Banner */}
                    {claims.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 text-center pb-1">
                        <div className="bg-[#F4F4F5] p-2.5 rounded-lg border border-[#E4E4E7]">
                          <span className="text-[10px] text-[#71717A] uppercase font-bold block">Total Claimed</span>
                          <span className="font-mono font-bold text-[#18181B] text-sm">
                            {formatCurrency(totalClaimed)}
                          </span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-lg">
                          <span className="text-[10px] text-emerald-800 uppercase font-bold block">Cleared / Paid</span>
                          <span className="font-mono font-bold text-emerald-900 text-sm">
                            {formatCurrency(totalPaid)}
                          </span>
                        </div>
                        <div className={cn(
                          "p-2.5 rounded-lg border",
                          totalPending > 0 ? "bg-amber-50 border-amber-300" : "bg-zinc-50 border-zinc-200"
                        )}>
                          <span className={cn(
                            "text-[10px] uppercase font-bold block",
                            totalPending > 0 ? "text-amber-800" : "text-[#71717A]"
                          )}>
                            Pending Due
                          </span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            totalPending > 0 ? "text-amber-950" : "text-[#71717A]"
                          )}>
                            {formatCurrency(totalPending)}
                          </span>
                        </div>
                      </div>
                    )}

                    {claims.length === 0 ? (
                      <p className="text-xs text-[#A1A1AA] py-3 text-center">
                        No field expenses claimed.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {claims.map((c: any) => {
                          const isPartialPending = c.status === "pending" && c.note?.includes("[Remaining Balance");
                          return (
                            <div
                              key={c.id}
                              className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] text-xs space-y-1.5 hover:border-[#D4D4D8] transition"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#18181B] font-mono text-sm">
                                  {formatCurrency(c.amount)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {isPartialPending ? (
                                    <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                      Remaining Balance Pending
                                    </span>
                                  ) : (
                                    <StatusBadge status={c.status} />
                                  )}
                                </div>
                              </div>
                              <p className="text-[#52525B] text-[11px] leading-relaxed">{c.note}</p>
                              {c.status === "paid" && c.paidAt && (
                                <p className="text-[10px] text-emerald-800 font-medium flex items-center gap-1">
                                  ✓ Cleared & Disbursed: {formatDateTime(c.paidAt)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Action Bar at bottom when expenses are pending */}
                    {totalPending > 0 && (isAccountant || isAdmin) && (
                      <div className="pt-2 border-t border-[#E4E4E7] flex items-center justify-between bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                        <div>
                          <p className="text-xs font-bold text-amber-950">
                            Outstanding Technician Expenses: {formatCurrency(totalPending)}
                          </p>
                          <p className="text-[10px] text-amber-800">
                            Clear in full or disburse partial amount available now.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={openClearanceModalForJob}
                          className="px-3 py-1.5 text-xs font-bold bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Clear Expenses
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

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

          {/* Central Warehouse Material & Inventory Issuance Card (Shown under Assigned Technician) */}
          {(canIssueStock || canStockReturn || (job.inventoryRequests && job.inventoryRequests.length > 0) || (job.stockReturns && job.stockReturns.length > 0)) && (
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

      {/* AUDITOR SEND-BACK MODAL */}
      {showSendBackModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B]">Send Back Job</h3>
              <button
                type="button"
                onClick={() => setShowSendBackModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#52525B]">
              Supervisor override unlocks this Finalized job back to CompletedPendingVerification.
              Provide a clear note for the accountant. Ledger postings are not reversed.
            </p>
            <textarea
              value={sendBackNote}
              onChange={(e) => setSendBackNote(e.target.value)}
              rows={4}
              placeholder="Reason for send-back…"
              className="w-full p-2.5 rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
            />
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Send Back
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
      {clearExpenseModalOpen && (() => {
        const pendingClaims = (job.expenseClaims || []).filter((c: any) => c.status === "pending");
        const totalPendingExpenses = pendingClaims.reduce((s: number, c: any) => s + c.amount, 0);
        const maxPayable = selectedClaimToClear ? selectedClaimToClear.amount : totalPendingExpenses;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7] text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                <div>
                  <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#0D7A5F]" />
                    Clear Technician Field Expenses
                  </h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Select payment source and disburse in full or in partial instalments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClearExpenseModalOpen(false)}
                  className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md hover:bg-[#F4F4F5]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Expense Summary Header */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                      {selectedClaimToClear ? "Individual Claim Balance" : "Total Pending Expenses Due"}
                    </span>
                    <span className="font-mono text-xl font-black text-emerald-950">
                      {formatCurrency(maxPayable)}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    {selectedClaimToClear ? "Single Claim" : `${pendingClaims.length} Claims Pending`}
                  </span>
                </div>

                {/* Itemized List */}
                {!selectedClaimToClear && pendingClaims.length > 0 && (
                  <div className="pt-2 border-t border-emerald-200/60 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                      Breakdown of Pending Claims:
                    </span>
                    {pendingClaims.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between bg-white/80 p-1.5 rounded border border-emerald-200/50 text-[11px]"
                      >
                        <span className="text-[#3F3F46] truncate max-w-[280px]" title={c.note}>
                          • {c.note}
                        </span>
                        <span className="font-mono font-bold text-[#18181B] shrink-0 ml-2">
                          {formatCurrency(c.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedClaimToClear && (
                  <p className="text-[11px] text-[#52525B] leading-relaxed">
                    <strong>Claim Note:</strong> {selectedClaimToClear.note}
                  </p>
                )}
              </div>

              <form onSubmit={handleClearExpense} className="space-y-4">
                {/* Payment Source Selection */}
                <div>
                  <label className="font-bold text-[#18181B] block mb-1">
                    Disbursing Source (Payment Account) *
                  </label>
                  <select
                    value={disbursingAccountCode}
                    onChange={(e) => setDisbursingAccountCode(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-semibold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                  >
                    <option value="1000">1000 — Cash on Hand / Main Drawer (Cash Box)</option>
                    <option value="1010">1010 — Operating Bank Account (Meezan Bank)</option>
                    <option value="1011">1011 — Secondary Corporate Bank (HBL)</option>
                    <option value="1020">1020 — Petty Cash Float (Store / Emergency Float)</option>
                    <option value="2100">2100 — Technician Payable Clearing (Owed to Technician)</option>
                  </select>
                  <p className="text-[10px] text-[#71717A] mt-1 font-mono">
                    GL Impact: Dr 6100 (Technician Travel & Expenses) | Cr {disbursingAccountCode}
                  </p>
                </div>

                {/* Settlement Mode: Full vs Partial */}
                <div>
                  <label className="font-bold text-[#18181B] block mb-1.5">
                    Clearance Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClearanceMode("full");
                        setPartialAmountToPay(String(maxPayable));
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition font-semibold",
                        clearanceMode === "full"
                          ? "border-[#0D7A5F] bg-[#0D7A5F]/10 text-[#0D7A5F] ring-1 ring-[#0D7A5F]"
                          : "border-[#E4E4E7] bg-white text-[#71717A] hover:border-[#D4D4D8]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Clear Whole Amount</span>
                        <span className="text-[10px] font-mono">100%</span>
                      </div>
                      <p className="text-[10px] text-[#71717A] mt-0.5">
                        Pay full {formatCurrency(maxPayable)} now.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setClearanceMode("partial");
                        const half = Math.round(maxPayable / 2);
                        setPartialAmountToPay(String(half));
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition font-semibold",
                        clearanceMode === "partial"
                          ? "border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-600"
                          : "border-[#E4E4E7] bg-white text-[#71717A] hover:border-[#D4D4D8]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Partial Clearance</span>
                        <span className="text-[10px] font-bold text-amber-700">Constrained</span>
                      </div>
                      <p className="text-[10px] text-[#71717A] mt-0.5">
                        Pay available funds; clear remainder afterwards.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Partial Amount Input & Breakdown */}
                {clearanceMode === "partial" && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                    <div>
                      <label className="text-[11px] font-bold text-amber-950 block mb-1">
                        Amount to Disburse Now (PKR) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={maxPayable}
                        value={partialAmountToPay}
                        onChange={(e) => setPartialAmountToPay(e.target.value)}
                        placeholder="e.g. 3000"
                        className="w-full bg-white p-2 rounded-lg border border-amber-300 font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                    </div>

                    {/* Quick percentage shortcuts */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-amber-800 font-semibold">Quick Set:</span>
                      {[0.25, 0.5, 0.75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPartialAmountToPay(String(Math.round(maxPayable * pct)))}
                          className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-bold text-amber-900 border border-amber-300 transition"
                        >
                          {pct * 100}% ({formatCurrency(Math.round(maxPayable * pct))})
                        </button>
                      ))}
                    </div>

                    {/* Real-time Math Summary */}
                    {Number(partialAmountToPay) > 0 && (
                      <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-amber-800 block">Disbursing Now:</span>
                          <strong className="font-mono font-bold text-emerald-800">
                            {formatCurrency(Number(partialAmountToPay))}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-amber-800 block">Remaining Afterwards:</span>
                          <strong className="font-mono font-bold text-rose-800">
                            {formatCurrency(Math.max(0, maxPayable - Number(partialAmountToPay)))}
                          </strong>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-amber-800 italic leading-snug">
                      ℹ️ The remaining balance of {formatCurrency(Math.max(0, maxPayable - (Number(partialAmountToPay) || 0)))} will automatically stay as pending expenses on this job so you can clear it whenever more funds become available.
                    </p>
                  </div>
                )}

                {/* Reference / Notes */}
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Disbursement Reference / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={expensePaymentNotes}
                    onChange={(e) => setExpensePaymentNotes(e.target.value)}
                    placeholder="e.g. Cash Voucher #402, Raast Ref, or Cheque Number"
                    className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                  />
                </div>

                {/* Footer Actions */}
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
                    disabled={
                      isProcessing ||
                      (clearanceMode === "partial" && (!Number(partialAmountToPay) || Number(partialAmountToPay) <= 0 || Number(partialAmountToPay) > maxPayable))
                    }
                    className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-[#D4D4D8] text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    {isProcessing
                      ? "Posting to GL..."
                      : clearanceMode === "partial"
                      ? `Disburse Partial ${formatCurrency(Number(partialAmountToPay) || 0)}`
                      : `Disburse Full ${formatCurrency(maxPayable)}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
        isOpen={addServiceDrawerOpen}
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
    </div>
  );
}
