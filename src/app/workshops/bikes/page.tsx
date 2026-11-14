"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Bike,
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  User,
  ShieldCheck,
  Package,
  Layers,
  FileText,
  RotateCcw,
  Smartphone,
  ChevronRight,
  ChevronDown,
  X,
  AlertTriangle,
  Printer,
  Sparkles,
  BarChart3,
  Calendar,
  Check,
  TrendingUp,
  DollarSign,
  Tag,
  ArrowRight,
  Truck,
} from "lucide-react";

export default function BikesWorkshopPage() {
  const [activeTab, setActiveTab] = useState<"jobs" | "tools" | "scrap" | "reports">("jobs");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Reference data for dropdowns
  const [staffList, setStaffList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Sub-action Modals
  const [actionLoading, setActionLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [diagnosisForm, setDiagnosisForm] = useState({
    inspectionFindings: "",
    workRequired: "",
    estimatedHours: "2",
    estimatedCost: "2500",
  });

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialRows, setMaterialRows] = useState<Array<{ productId: string; description: string; qty: string; unit: string }>>([
    { productId: "", description: "", qty: "1", unit: "pcs" },
  ]);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<any>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [returnReason, setReturnReason] = useState("");

  const [showTestingModal, setShowTestingModal] = useState(false);
  const [testingForm, setTestingForm] = useState({
    testingLeakTest: "Pass",
    testingNotes: "Engine sound smooth, brakes calibrated, road test successful at 40km/h.",
  });

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [workDoneSummary, setWorkDoneSummary] = useState("");

  const [showScrapModal, setShowScrapModal] = useState(false);
  const [scrapForm, setScrapForm] = useState({
    itemDescription: "",
    quantity: "1",
    unit: "pcs",
    customerKept: false,
  });

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState({
    closeNotes: "Verified work quality and materials reconciliation.",
    deliveryStatus: "ready_for_delivery",
    deliveredTo: "",
  });

  // Tools state
  const [tools, setTools] = useState<any[]>([]);
  const [showNewToolModal, setShowNewToolModal] = useState(false);
  const [newToolForm, setNewToolForm] = useState({
    toolCode: "",
    name: "",
    category: "Bike Hand Tools",
    totalQuantity: "1",
    location: "Bay 1 Rack A",
  });
  const [showIssueToolModal, setShowIssueToolModal] = useState(false);
  const [selectedToolForIssue, setSelectedToolForIssue] = useState<any>(null);
  const [toolIssueForm, setToolIssueForm] = useState({
    staffName: "",
    jobCardId: "",
    quantity: "1",
  });
  const [showReturnToolModal, setShowReturnToolModal] = useState(false);
  const [selectedToolIssueForReturn, setSelectedToolIssueForReturn] = useState<any>(null);
  const [toolReturnForm, setToolReturnForm] = useState({
    returnCondition: "Operational",
    notes: "",
  });

  // Scrap items state
  const [scrapItems, setScrapItems] = useState<any[]>([]);
  const [showScrapSaleModal, setShowScrapSaleModal] = useState(false);
  const [selectedScrapForSale, setSelectedScrapForSale] = useState<any>(null);
  const [scrapSaleForm, setScrapSaleForm] = useState({
    actionType: "sold",
    saleAmount: "500",
    disposalNotes: "Sold to local metal recycling vendor",
  });

  // Reports state
  const [activeReport, setActiveReport] = useState<string>("bike_history");
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // New Job Card Form
  const [newJobForm, setNewJobForm] = useState({
    bikeRegNo: "",
    chassisNumber: "",
    engineNumber: "",
    currentKm: "",
    bikeMakeModel: "Honda CD 70",
    customerId: "",
    customerName: "",
    customerPhone: "",
    complaint: "",
    assignedStaffId: "",
  });

  // Fetch Options
  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/workshops/options");
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data.staff || []);
        setProductsList(json.data.products || []);
        setCustomersList(json.data.customers || []);
      }
    } catch (e) {
      console.error("Options error:", e);
    }
  };

  // Fetch Jobs
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("workshopType", "bike");
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/workshops/jobs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setJobs(json.data || []);
        if (selectedJob) {
          const fresh = json.data.find((j: any) => j.id === selectedJob.id);
          if (fresh) setSelectedJob(fresh);
        }
      }
    } catch (e) {
      console.error("Fetch jobs error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "jobs") {
      fetchJobs();
    } else if (activeTab === "tools") {
      fetchTools();
    } else if (activeTab === "scrap") {
      fetchScrap();
    } else if (activeTab === "reports") {
      fetchReport(activeReport);
    }
  }, [activeTab, statusFilter, searchQuery]);

  // Fetch single job details when selected
  const openJobDetail = async (jobId: string) => {
    try {
      const res = await fetch(`/api/workshops/jobs?id=${jobId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedJob(json.data);
      }
    } catch (e) {
      console.error("Fetch job detail error:", e);
    }
  };

  // Fetch Tools
  const fetchTools = async () => {
    try {
      const res = await fetch("/api/workshops/tools?workshopType=bike");
      const json = await res.json();
      if (json.success) {
        setTools(json.data || []);
      }
    } catch (e) {
      console.error("Fetch tools error:", e);
    }
  };

  // Fetch Scrap
  const fetchScrap = async () => {
    try {
      const res = await fetch("/api/workshops/scrap?workshopType=bike");
      const json = await res.json();
      if (json.success) {
        setScrapItems(json.data || []);
      }
    } catch (e) {
      console.error("Fetch scrap error:", e);
    }
  };

  // Fetch Report
  const fetchReport = async (repType: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/workshops/reports?reportType=${repType}&workshopType=bike`);
      const json = await res.json();
      if (json.success) {
        setReportData(json.data || []);
      }
    } catch (e) {
      console.error("Fetch report error:", e);
    } finally {
      setReportLoading(false);
    }
  };

  // Handle Create Job Card
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobForm.bikeRegNo.trim() || !newJobForm.complaint.trim()) {
      alert("Registration number and complaint are required.");
      return;
    }

    setActionLoading(true);
    try {
      const assignedEmployee = staffList.find((s) => s.id === newJobForm.assignedStaffId);
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          workshopType: "bike",
          bikeRegNo: newJobForm.bikeRegNo,
          chassisNumber: newJobForm.chassisNumber,
          engineNumber: newJobForm.engineNumber,
          currentKm: Number(newJobForm.currentKm) || 0,
          bikeMakeModel: newJobForm.bikeMakeModel,
          customerId: newJobForm.customerId || undefined,
          customerName: newJobForm.customerName,
          customerPhone: newJobForm.customerPhone,
          complaint: newJobForm.complaint,
          assignedStaffId: newJobForm.assignedStaffId || undefined,
          assignedStaffName: assignedEmployee?.name || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowNewJobModal(false);
        setNewJobForm({
          bikeRegNo: "",
          chassisNumber: "",
          engineNumber: "",
          currentKm: "",
          bikeMakeModel: "Honda CD 70",
          customerId: "",
          customerName: "",
          customerPhone: "",
          complaint: "",
          assignedStaffId: "",
        });
        await fetchJobs();
        openJobDetail(json.data.id);
      } else {
        alert(json.error || "Failed to create job card");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Assign Staff
  const handleAssignStaff = async () => {
    if (!selectedStaffId) return;
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          jobCardId: selectedJob.id,
          staffId: staff.id,
          staffName: staff.name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAssignModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to assign staff");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Submit Diagnosis
  const handleSubmitDiagnosis = async () => {
    if (!diagnosisForm.inspectionFindings.trim() || !diagnosisForm.workRequired.trim()) {
      alert("Please provide both inspection findings and work required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "diagnose",
          jobCardId: selectedJob.id,
          inspectionFindings: diagnosisForm.inspectionFindings,
          workRequired: diagnosisForm.workRequired,
          estimatedHours: Number(diagnosisForm.estimatedHours) || 1,
          estimatedCost: Number(diagnosisForm.estimatedCost) || 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowDiagnoseModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to submit diagnosis");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Manager Approval / Rejection
  const handleManagerDecision = async (decision: "approve" | "reject") => {
    if (decision === "reject" && !rejectionReason.trim()) {
      alert("Please provide a reason for rejecting the diagnosis.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: decision === "approve" ? "approve" : "reject",
          jobCardId: selectedJob.id,
          reason: decision === "reject" ? rejectionReason : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowApprovalModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Approval action failed");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Material Requisition
  const handleRequestMaterial = async () => {
    const validRows = materialRows.filter((r) => r.description.trim() && Number(r.qty) > 0);
    if (validRows.length === 0) {
      alert("Please add at least one material item with description and valid quantity.");
      return;
    }

    setActionLoading(true);
    try {
      const items = validRows.map((r) => {
        const prod = productsList.find((p) => p.id === r.productId);
        return {
          productId: r.productId || undefined,
          itemCode: prod?.sku || undefined,
          description: r.description,
          requestedQty: Number(r.qty),
          unit: r.unit || "unit",
          unitCost: prod?.costPrice || prod?.unitPrice || 0,
        };
      });

      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_material",
          jobCardId: selectedJob.id,
          items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowMaterialModal(false);
        setMaterialRows([{ productId: "", description: "", qty: "1", unit: "pcs" }]);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to submit material requisition");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Material Issue by Storekeeper
  const handleIssueMaterial = async (reqId: string, qty: number) => {
    const promptQty = prompt(`Confirm quantity to issue (Request: ${qty}):`, String(qty));
    if (!promptQty) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_material",
          requisitionId: reqId,
          issuedQty: Number(promptQty),
        }),
      });
      const json = await res.json();
      if (json.success) {
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Material issue failed");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Return Material
  const handleReturnMaterial = async () => {
    if (!returnReason.trim()) {
      alert("Return reason is required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return_material",
          requisitionId: selectedRequisition.id,
          returnedQty: Number(returnQty),
          returnReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowReturnModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Material return failed");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Testing Log
  const handleRecordTesting = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          jobCardId: selectedJob.id,
          testingLeakTest: testingForm.testingLeakTest,
          testingNotes: testingForm.testingNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowTestingModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to log test");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Complete Job
  const handleCompleteJob = async () => {
    if (!workDoneSummary.trim()) {
      alert("Work done summary is required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          jobCardId: selectedJob.id,
          workDoneSummary,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCompleteModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to complete job");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Scrap Recording
  const handleRecordScrap = async () => {
    if (!scrapForm.itemDescription.trim()) {
      alert("Item description is required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_scrap",
          jobCardId: selectedJob.id,
          itemDescription: scrapForm.itemDescription,
          quantity: Number(scrapForm.quantity) || 1,
          unit: scrapForm.unit,
          customerKept: scrapForm.customerKept,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowScrapModal(false);
        setScrapForm({ itemDescription: "", quantity: "1", unit: "pcs", customerKept: false });
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to record scrap");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Close Job Card
  const handleCloseJob = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          jobCardId: selectedJob.id,
          closeNotes: closeForm.closeNotes,
          deliveryStatus: closeForm.deliveryStatus,
          deliveredTo: closeForm.deliveredTo,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCloseModal(false);
        openJobDetail(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to close job card");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // KPIs
  const activeBikesCount = jobs.filter((j) => !["Closed", "Rejected"].includes(j.status)).length;
  const underInspectionCount = jobs.filter((j) => ["Assigned", "Under Inspection"].includes(j.status)).length;
  const pendingApprovalCount = jobs.filter((j) => j.status === "Pending Approval").length;
  const inProgressCount = jobs.filter((j) => j.status === "In Progress").length;
  const readyDeliveryCount = jobs.filter((j) => j.status === "Completed" || j.deliveryStatus === "ready_for_delivery").length;

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* Top Banner / Header */}
      <div className="border-b border-zinc-800 bg-[#121215] px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white uppercase">
                  Bikes Workshop Operations
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  ERP v2.0
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Full 10-step SOP: Intake → Diagnosis → Manager Gate → Store Issue → Testing → Scrap & Close
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/workshops/bikes/mobile"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
              title="Open shop floor mobile mechanic view"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Mobile Mechanic View</span>
            </Link>

            <button
              onClick={() => setShowNewJobModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#0D7A5F] hover:bg-[#0b634d] text-white shadow-lg shadow-emerald-950/40 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Bike Job Card</span>
            </button>
          </div>
        </div>

        {/* Live Workshop KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-zinc-800/60">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium">Bikes In Workshop</span>
              <p className="text-xl font-extrabold text-white mt-0.5">{activeBikesCount}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Bike className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium">Under Inspection</span>
              <p className="text-xl font-extrabold text-sky-400 mt-0.5">{underInspectionCount}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-950/40 border border-sky-800/40 flex items-center justify-center text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium">Pending Approval</span>
              <p className="text-xl font-extrabold text-amber-400 mt-0.5">{pendingApprovalCount}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium">In Repair</span>
              <p className="text-xl font-extrabold text-indigo-400 mt-0.5">{inProgressCount}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
              <Wrench className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium">Ready For Delivery</span>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{readyDeliveryCount}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto">
          {[
            { id: "jobs", label: "Job Cards", icon: Bike },
            { id: "tools", label: "Workshop Tools Register", icon: Wrench },
            { id: "scrap", label: "Scrap & Replaced Parts", icon: RotateCcw },
            { id: "reports", label: "Reports & Audit", icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#27272A] text-white border border-zinc-700 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-zinc-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* ================================================================= */}
        {/* TAB 1: JOB CARDS                                                  */}
        {/* ================================================================= */}
        {activeTab === "jobs" && (
          <div className="space-y-4">
            {/* Filter & View Switcher Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121215] border border-zinc-800/80 p-3 rounded-2xl">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Reg No, Chassis, Job #, Customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                </select>

                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
                  <button
                    onClick={() => setViewMode("kanban")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      viewMode === "kanban" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Kanban
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      viewMode === "table" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Table
                  </button>
                </div>

                <button
                  onClick={fetchJobs}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
                </button>
              </div>
            </div>

            {/* Kanban View */}
            {viewMode === "kanban" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start">
                {[
                  { title: "Intake & Assignment", statuses: ["Open", "Assigned"] },
                  { title: "Diagnosis & Approval", statuses: ["Under Inspection", "Pending Approval", "Approved"] },
                  { title: "Store & Repair Work", statuses: ["In Progress", "On Hold"] },
                  { title: "Testing & Completed", statuses: ["Completed"] },
                  { title: "Closed & Delivered", statuses: ["Closed"] },
                ].map((col, idx) => {
                  const colJobs = jobs.filter((j) => col.statuses.includes(j.status));
                  return (
                    <div key={idx} className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3 flex flex-col min-h-[500px]">
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-800">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                          {col.title}
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                          {colJobs.length}
                        </span>
                      </div>

                      <div className="space-y-3 flex-1 overflow-y-auto">
                        {colJobs.map((job) => (
                          <div
                            key={job.id}
                            onClick={() => openJobDetail(job.id)}
                            className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 p-3.5 rounded-xl cursor-pointer transition shadow-sm hover:shadow-md group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-extrabold text-amber-400">
                                {job.jobNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  job.status === "Closed"
                                    ? "bg-zinc-800 text-zinc-400"
                                    : job.status === "Completed"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : job.status === "Pending Approval"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                }`}
                              >
                                {job.status}
                              </span>
                            </div>

                            <div className="mt-2">
                              <p className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                                🏍️ {job.bikeRegNo}
                              </p>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {job.bikeMakeModel || "Motorbike"} • {job.currentKm ? `${job.currentKm.toLocaleString()} km` : "Km not logged"}
                              </p>
                            </div>

                            <div className="mt-2.5 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 text-[11px] text-zinc-300 line-clamp-2">
                              {job.complaint}
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-zinc-500" />
                                <span className="truncate max-w-[90px]">{job.assignedStaffName || "Unassigned"}</span>
                              </span>
                              <span className="font-mono font-bold text-emerald-400">
                                {formatCurrency(job.totalJobCost || 0)}
                              </span>
                            </div>
                          </div>
                        ))}

                        {colJobs.length === 0 && (
                          <div className="h-32 flex items-center justify-center text-xs text-zinc-600 border border-dashed border-zinc-800/80 rounded-xl">
                            No active cards
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <div className="bg-[#121215] border border-zinc-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Job Number</th>
                      <th className="p-3.5">Bike Reg No</th>
                      <th className="p-3.5">Make / Model</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Assigned Mechanic</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Material Cost</th>
                      <th className="p-3.5">Total Cost</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => openJobDetail(job.id)}
                        className="hover:bg-zinc-800/40 cursor-pointer transition"
                      >
                        <td className="p-3.5 font-mono font-bold text-amber-400">{job.jobNumber}</td>
                        <td className="p-3.5 font-bold text-white">{job.bikeRegNo}</td>
                        <td className="p-3.5 text-zinc-300">{job.bikeMakeModel || "-"}</td>
                        <td className="p-3.5 text-zinc-300">{job.customerName || "-"}</td>
                        <td className="p-3.5 text-zinc-300">{job.assignedStaffName || "Unassigned"}</td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              job.status === "Closed"
                                ? "bg-zinc-800 text-zinc-400"
                                : job.status === "Completed"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : job.status === "Pending Approval"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-sky-500/20 text-sky-300"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-zinc-300">{formatCurrency(job.totalMaterialCost || 0)}</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">{formatCurrency(job.totalJobCost || 0)}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openJobDetail(job.id);
                            }}
                            className="p-1 text-zinc-400 hover:text-white"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {jobs.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-zinc-500">
                          No bike workshop job cards found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: WORKSHOP TOOLS REGISTER                                    */}
        {/* ================================================================= */}
        {activeTab === "tools" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 bg-[#121215] border border-zinc-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-tight">Workshop Tools Register</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Track tools check-out against active job cards, tool condition, and monthly audit count
                </p>
              </div>

              <button
                onClick={() => setShowNewToolModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tool To Register</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool) => (
                <div key={tool.id} className="bg-[#121215] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-amber-400">{tool.toolCode}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tool.condition === "Operational"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {tool.condition}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mt-2">{tool.name}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">{tool.category} • Location: {tool.location || "Bay Rack"}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2 bg-zinc-900 p-2 rounded-xl text-center">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Total Qty</span>
                        <span className="text-xs font-bold text-white">{tool.totalQuantity}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Available</span>
                        <span className="text-xs font-bold text-emerald-400">{tool.availableQuantity}</span>
                      </div>
                    </div>

                    {/* Active Checkouts */}
                    {tool.issues && tool.issues.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Checked Out To:</span>
                        {tool.issues.map((iss: any) => (
                          <div
                            key={iss.id}
                            className="flex items-center justify-between text-xs bg-zinc-950 p-2 rounded-lg border border-zinc-800/80"
                          >
                            <div>
                              <p className="font-semibold text-white">{iss.staffName}</p>
                              <p className="text-[10px] text-zinc-500">
                                {iss.jobCard ? `Job #${iss.jobCard.jobNumber}` : "Daily Use"} (Qty: {iss.quantity})
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedToolIssueForReturn(iss);
                                setShowReturnToolModal(true);
                              }}
                              className="px-2 py-1 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
                            >
                              Check-In
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setSelectedToolForIssue(tool);
                        setShowIssueToolModal(true);
                      }}
                      disabled={tool.availableQuantity <= 0}
                      className="w-full px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-40 transition"
                    >
                      Issue Tool to Mechanic
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SCRAP & REPLACED PARTS REGISTER                            */}
        {/* ================================================================= */}
        {activeTab === "scrap" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 bg-[#121215] border border-zinc-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-tight">Workshop Scrap Register</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Record replaced bike parts, used engine oil, customer kept parts, and manager sale with GL posting
                </p>
              </div>

              <span className="text-xs font-mono font-bold px-3 py-1 bg-zinc-800 text-zinc-300 rounded-xl">
                Total Scrap Records: {scrapItems.length}
              </span>
            </div>

            <div className="bg-[#121215] border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Job Card</th>
                    <th className="p-3.5">Item Description</th>
                    <th className="p-3.5">Quantity</th>
                    <th className="p-3.5">Customer Kept?</th>
                    <th className="p-3.5">Store Status</th>
                    <th className="p-3.5">Sale Value</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {scrapItems.map((sc) => (
                    <tr key={sc.id} className="hover:bg-zinc-800/40 transition">
                      <td className="p-3.5 text-zinc-400">{formatDateTime(sc.createdAt)}</td>
                      <td className="p-3.5 font-mono font-bold text-amber-400">{sc.jobCard?.jobNumber || "-"}</td>
                      <td className="p-3.5 font-bold text-white">{sc.itemDescription}</td>
                      <td className="p-3.5 font-mono text-zinc-300">{sc.quantity} {sc.unit}</td>
                      <td className="p-3.5">
                        {sc.customerKept ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Retained by Customer
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                            Workshop Scrap
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sc.returnedToStore ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {sc.returnedToStore ? "In Store" : "Recorded"}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">
                        {sc.disposalValue ? formatCurrency(sc.disposalValue) : "-"}
                      </td>
                      <td className="p-3.5 text-right">
                        {!sc.customerKept && sc.status !== "sold" && sc.status !== "disposed" && (
                          <div className="flex items-center justify-end gap-1.5">
                            {!sc.returnedToStore && (
                              <button
                                onClick={async () => {
                                  await fetch("/api/workshops/scrap", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "return_to_store", scrapId: sc.id }),
                                  });
                                  fetchScrap();
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg"
                              >
                                Handover Store
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedScrapForSale(sc);
                                setShowScrapSaleModal(true);
                              }}
                              className="px-2 py-1 text-[10px] font-bold bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900 rounded-lg"
                            >
                              Sell / Dispose
                            </button>
                          </div>
                        )}
                        {sc.status === "sold" && (
                          <span className="text-[10px] text-zinc-500">Sold (GL Posted)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {scrapItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-500">
                        No scrap or replaced parts recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ENTERPRISE REPORTS & AUDIT                                 */}
        {/* ================================================================= */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto bg-[#121215] border border-zinc-800 p-2 rounded-2xl">
              {[
                { id: "bike_history", label: "Bike Maintenance History" },
                { id: "mechanic_productivity", label: "Mechanic Productivity" },
                { id: "job_costing", label: "Job Costing Report" },
                { id: "material_flow", label: "Material Issue & Return" },
                { id: "pending_jobs", label: "Pending Jobs Audit" },
                { id: "scrap_report", label: "Scrap Register" },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveReport(r.id);
                    fetchReport(r.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    activeReport === r.id
                      ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-950/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">
                  Report Output: {activeReport.replace("_", " ").toUpperCase()}
                </h4>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
              </div>

              {reportLoading ? (
                <div className="p-12 text-center text-zinc-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Generating report...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <pre className="bg-zinc-950 p-4 rounded-xl text-xs font-mono text-zinc-300 max-h-[500px] overflow-y-auto">
                    {JSON.stringify(reportData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 10-STEP INTERACTIVE JOB CARD DETAIL DRAWER                          */}
      {/* =================================================================== */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#121215] border-l border-zinc-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Top Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-white uppercase tracking-tight">
                      Job Card #{selectedJob.jobNumber}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedJob.status === "Closed"
                          ? "bg-zinc-800 text-zinc-400"
                          : selectedJob.status === "Completed"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : selectedJob.status === "Pending Approval"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-sky-500/20 text-sky-300"
                      }`}
                    >
                      {selectedJob.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Reg No: <span className="text-white font-bold">{selectedJob.bikeRegNo}</span> • Model: {selectedJob.bikeMakeModel || "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  title="Print Job Card"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body - 10-Step Interactive Workflow */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Step 1: Unit Received */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Step 1: Unit Received & Intake Details
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Supervisor: {selectedJob.supervisorName}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Chassis No</span>
                    <span className="font-mono text-zinc-200">{selectedJob.chassisNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Engine No</span>
                    <span className="font-mono text-zinc-200">{selectedJob.engineNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Odometer</span>
                    <span className="font-mono text-zinc-200">{selectedJob.currentKm ? `${selectedJob.currentKm} km` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Customer</span>
                    <span className="text-zinc-200 font-medium">{selectedJob.customerName || "Walk-In"}</span>
                  </div>
                </div>

                <div className="mt-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Customer Complaint / Reported Fault:</span>
                  <p className="text-xs text-zinc-200">{selectedJob.complaint}</p>
                </div>
              </div>

              {/* Step 2: Assign Mechanic */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Step 2: Mechanic Assignment
                  </span>
                  {selectedJob.status !== "Closed" && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
                    >
                      {selectedJob.assignedStaffId ? "Reassign" : "Assign Mechanic"}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 block">Assigned Staff</span>
                    <span className="text-sm font-bold text-white">{selectedJob.assignedStaffName || "Not assigned yet"}</span>
                  </div>
                  {selectedJob.assignedAt && (
                    <div className="text-right">
                      <span className="text-zinc-500 block">Assigned Time</span>
                      <span className="text-zinc-400 font-mono text-[11px]">{formatDateTime(selectedJob.assignedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3 & 4: Inspection, Diagnosis & Manager Approval */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Step 3 & 4: Diagnosis & Manager Approval Gate
                  </span>
                  {selectedJob.status !== "Closed" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDiagnoseModal(true)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
                      >
                        {selectedJob.inspectionFindings ? "Update Diagnosis" : "Log Diagnosis"}
                      </button>
                      {selectedJob.status === "Pending Approval" && (
                        <button
                          onClick={() => setShowApprovalModal(true)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition"
                        >
                          Manager Review
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {selectedJob.inspectionFindings ? (
                  <div className="space-y-2 text-xs">
                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Inspection Findings:</span>
                      <p className="text-zinc-200">{selectedJob.inspectionFindings}</p>
                    </div>

                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Work Required & Parts Needed:</span>
                      <p className="text-zinc-200">{selectedJob.workRequired}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div>
                        <span className="text-zinc-500">Est. Hours:</span> <span className="font-bold text-white">{selectedJob.estimatedHours || 0} hrs</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Est. Cost:</span> <span className="font-bold text-emerald-400">{formatCurrency(selectedJob.estimatedCost || 0)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Manager Status:</span>{" "}
                        <span
                          className={`font-bold ${
                            selectedJob.approvalStatus === "approved"
                              ? "text-emerald-400"
                              : selectedJob.approvalStatus === "rejected"
                              ? "text-red-400"
                              : "text-amber-400"
                          }`}
                        >
                          {selectedJob.approvalStatus?.toUpperCase() || "PENDING"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">No inspection findings recorded yet. Mechanic must submit diagnosis.</p>
                )}
              </div>

              {/* Step 5 & 6: Store Requisitions & Inventory Issuance */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Step 5 & 6: Store Requisition & Inventory Issue
                  </span>
                  {selectedJob.status !== "Closed" && (
                    <button
                      onClick={() => {
                        if (!["Approved", "In Progress", "On Hold"].includes(selectedJob.status)) {
                          alert("Control Policy: Material requisition cannot be submitted before Manager Approval.");
                          return;
                        }
                        setShowMaterialModal(true);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-[#0D7A5F] hover:bg-[#0b634d] text-white rounded-lg transition"
                    >
                      + Request Parts / Oil
                    </button>
                  )}
                </div>

                {selectedJob.requisitions && selectedJob.requisitions.length > 0 ? (
                  <div className="space-y-2">
                    {selectedJob.requisitions.map((req: any) => (
                      <div
                        key={req.id}
                        className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{req.description}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                req.status === "issued"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : req.status === "requested"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-sky-500/20 text-sky-300"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Req: {req.requestedQty} {req.unit} • Issued: {req.issuedQty} • Returned: {req.returnedQty || 0}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-400">{formatCurrency(req.totalCost || 0)}</span>
                          {req.status === "requested" && (
                            <button
                              onClick={() => handleIssueMaterial(req.id, req.requestedQty)}
                              className="px-2 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                            >
                              Issue Stock
                            </button>
                          )}
                          {req.issuedQty > (req.returnedQty || 0) && selectedJob.status !== "Closed" && (
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
                                setReturnQty(String(req.issuedQty - (req.returnedQty || 0)));
                                setShowReturnModal(true);
                              }}
                              className="px-2 py-1 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                            >
                              Return Unused
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">No parts or oil requested yet.</p>
                )}
              </div>

              {/* Step 7 & 8: Testing & Completion */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Step 7 & 8: Quality Testing & Job Completion
                  </span>
                  {selectedJob.status !== "Closed" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowTestingModal(true)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
                      >
                        Log Test Run
                      </button>
                      {selectedJob.status !== "Completed" && (
                        <button
                          onClick={() => setShowCompleteModal(true)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Road Test / Leak Inspection</span>
                    <span className="font-bold text-emerald-400">{selectedJob.testingLeakTest || "Not logged"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Completed By</span>
                    <span className="text-zinc-200">{selectedJob.completedBy || "In Progress"}</span>
                  </div>
                </div>

                {selectedJob.workDoneSummary && (
                  <div className="mt-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Work Done Summary:</span>
                    <p className="text-xs text-zinc-200">{selectedJob.workDoneSummary}</p>
                  </div>
                )}
              </div>

              {/* Step 9 & 10: Scrap Reconciled & Final Close */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Step 9 & 10: Scrap & Final Manager Close
                  </span>
                  {selectedJob.status !== "Closed" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowScrapModal(true)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
                      >
                        + Log Replaced Parts / Scrap
                      </button>
                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="px-3 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition"
                      >
                        Close Job & Deliver
                      </button>
                    </div>
                  )}
                </div>

                {/* Scrap items in this job */}
                {selectedJob.scrapItems && selectedJob.scrapItems.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Replaced Scrap Items:</span>
                    {selectedJob.scrapItems.map((sc: any) => (
                      <div
                        key={sc.id}
                        className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 flex items-center justify-between text-xs"
                      >
                        <span className="text-white font-medium">{sc.itemDescription} ({sc.quantity} {sc.unit})</span>
                        <span className="text-[10px] text-zinc-400">
                          {sc.customerKept ? "Retained by Customer" : sc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic mb-3">No scrap parts recorded for this job.</p>
                )}

                {selectedJob.status === "Closed" && (
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs">
                    <p className="text-emerald-400 font-bold">✓ Job Card Closed by {selectedJob.closedBy}</p>
                    <p className="text-zinc-400 mt-0.5">{selectedJob.closeNotes}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Delivery: {selectedJob.deliveryStatus}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: NEW BIKE JOB CARD                                            */}
      {/* =================================================================== */}
      {showNewJobModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bike className="w-5 h-5 text-amber-400" />
                <span>New Bike Job Card Intake</span>
              </h3>
              <button onClick={() => setShowNewJobModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Bike Reg No *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LE-20-4560"
                    value={newJobForm.bikeRegNo}
                    onChange={(e) => setNewJobForm({ ...newJobForm, bikeRegNo: e.target.value.toUpperCase() })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Make / Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Honda CG 125"
                    value={newJobForm.bikeMakeModel}
                    onChange={(e) => setNewJobForm({ ...newJobForm, bikeMakeModel: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Chassis No</label>
                  <input
                    type="text"
                    placeholder="Chassis #"
                    value={newJobForm.chassisNumber}
                    onChange={(e) => setNewJobForm({ ...newJobForm, chassisNumber: e.target.value.toUpperCase() })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Engine No</label>
                  <input
                    type="text"
                    placeholder="Engine #"
                    value={newJobForm.engineNumber}
                    onChange={(e) => setNewJobForm({ ...newJobForm, engineNumber: e.target.value.toUpperCase() })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Current Km</label>
                  <input
                    type="number"
                    placeholder="e.g. 15400"
                    value={newJobForm.currentKm}
                    onChange={(e) => setNewJobForm({ ...newJobForm, currentKm: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={newJobForm.customerName}
                    onChange={(e) => setNewJobForm({ ...newJobForm, customerName: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Customer Phone</label>
                  <input
                    type="text"
                    placeholder="03001234567"
                    value={newJobForm.customerPhone}
                    onChange={(e) => setNewJobForm({ ...newJobForm, customerPhone: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Initial Fault / Customer Complaint *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Engine oil leak, tuning required, clutch plates slipping, front brake noisy."
                  value={newJobForm.complaint}
                  onChange={(e) => setNewJobForm({ ...newJobForm, complaint: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Initial Mechanic Assignment (Optional)</label>
                <select
                  value={newJobForm.assignedStaffId}
                  onChange={(e) => setNewJobForm({ ...newJobForm, assignedStaffId: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="">-- Assign Later by Supervisor --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.designation || st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewJobModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0b634d] text-white font-bold transition disabled:opacity-40"
                >
                  {actionLoading ? "Creating..." : "Create Job Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ASSIGN STAFF                                                 */}
      {/* =================================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Assign Mechanic / Technician</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Select mechanic responsible for Job #{selectedJob?.jobNumber} ({selectedJob?.bikeRegNo}).
            </p>

            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none mb-4"
            >
              <option value="">-- Select Mechanic --</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.designation || st.role})
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignStaff}
                disabled={actionLoading || !selectedStaffId}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs disabled:opacity-40"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: DIAGNOSIS FORM                                               */}
      {/* =================================================================== */}
      {showDiagnoseModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Inspection & Diagnosis</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Step 3: Record detailed physical diagnosis and estimate for Manager Approval.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Inspection Findings *</label>
                <textarea
                  rows={3}
                  value={diagnosisForm.inspectionFindings}
                  onChange={(e) => setDiagnosisForm({ ...diagnosisForm, inspectionFindings: e.target.value })}
                  placeholder="e.g. Engine oil black & thick, clutch slippage detected, brake pads worn out."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Work Required & Parts Needed *</label>
                <textarea
                  rows={3}
                  value={diagnosisForm.workRequired}
                  onChange={(e) => setDiagnosisForm({ ...diagnosisForm, workRequired: e.target.value })}
                  placeholder="e.g. Oil change 20W50, replace clutch plates, change brake shoes, carburetor tuning."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    value={diagnosisForm.estimatedHours}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, estimatedHours: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Estimated Cost (PKR)</label>
                  <input
                    type="number"
                    value={diagnosisForm.estimatedCost}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, estimatedCost: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDiagnoseModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDiagnosis}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: MANAGER APPROVAL                                             */}
      {/* =================================================================== */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Step 4: Manager Approval Gate</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Hard Control: Work and material requisitions cannot start until diagnosis is approved.
            </p>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs space-y-2 mb-4">
              <div>
                <span className="text-zinc-500">Diagnosis:</span>
                <p className="text-white mt-0.5">{selectedJob?.workRequired}</p>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Est. Cost: <strong className="text-emerald-400">{formatCurrency(selectedJob?.estimatedCost || 0)}</strong></span>
                <span>Est. Time: <strong className="text-white">{selectedJob?.estimatedHours} hrs</strong></span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-zinc-400 text-xs block mb-1">Rejection Reason (if rejecting)</label>
              <input
                type="text"
                placeholder="Reason for return/rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleManagerDecision("reject")}
                className="px-4 py-2 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900 text-xs font-bold"
              >
                Reject & Return Unit
              </button>
              <button
                onClick={() => handleManagerDecision("approve")}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Approve Diagnosis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: STORE MATERIAL REQUISITION                                   */}
      {/* =================================================================== */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Step 5: Store Material Requisition</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Raise material request against Job #{selectedJob?.jobNumber} ({selectedJob?.bikeRegNo}).
            </p>

            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {materialRows.map((row, idx) => (
                <div key={idx} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center gap-2">
                  <div className="flex-1">
                    <select
                      value={row.productId}
                      onChange={(e) => {
                        const prod = productsList.find((p) => p.id === e.target.value);
                        const next = [...materialRows];
                        next[idx].productId = e.target.value;
                        if (prod) {
                          next[idx].description = prod.name;
                          next[idx].unit = prod.unit || "pcs";
                        }
                        setMaterialRows(next);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white mb-1.5 focus:outline-none"
                    >
                      <option value="">-- Choose From Warehouse Product --</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.stockQuantity} {p.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Item Description"
                      value={row.description}
                      onChange={(e) => {
                        const next = [...materialRows];
                        next[idx].description = e.target.value;
                        setMaterialRows(next);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => {
                        const next = [...materialRows];
                        next[idx].qty = e.target.value;
                        setMaterialRows(next);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                    />
                  </div>

                  {materialRows.length > 1 && (
                    <button
                      onClick={() => setMaterialRows(materialRows.filter((_, i) => i !== idx))}
                      className="p-1.5 text-zinc-500 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setMaterialRows([...materialRows, { productId: "", description: "", qty: "1", unit: "pcs" }])}
              className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              + Add Another Item
            </button>

            <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setShowMaterialModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestMaterial}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0b634d] text-white font-bold text-xs"
              >
                Submit Requisition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RETURN UNUSED MATERIAL                                       */}
      {/* =================================================================== */}
      {showReturnModal && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Step 9: Return Unused Material</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Return unconsumed parts/oil for {selectedRequisition.description} back to Store.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Return Quantity ({selectedRequisition.unit})</label>
                <input
                  type="number"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Return Reason *</label>
                <input
                  type="text"
                  placeholder="e.g. Extra oil bottle unsealed / not required"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnMaterial}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Return to Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: LOG TEST RUN                                                 */}
      {/* =================================================================== */}
      {showTestingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Step 8: Bike Test Run & Quality Check</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Verify road test performance, engine sounds, and brake calibration.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Quality Inspection Status</label>
                <select
                  value={testingForm.testingLeakTest}
                  onChange={(e) => setTestingForm({ ...testingForm, testingLeakTest: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="Pass">Pass - Fully Calibrated</option>
                  <option value="Minor Issue">Minor Adjustment Needed</option>
                  <option value="Fail">Fail - Needs Further Work</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Road Test Observations</label>
                <textarea
                  rows={3}
                  value={testingForm.testingNotes}
                  onChange={(e) => setTestingForm({ ...testingForm, testingNotes: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowTestingModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordTesting}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs"
              >
                Log Test Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: COMPLETE JOB                                                 */}
      {/* =================================================================== */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Step 8: Complete Job</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter work done summary before handover to Store for scrap and reconciliation.
            </p>

            <textarea
              rows={4}
              placeholder="e.g. Engine oil replaced with 20W50, clutch plates adjusted, front brake shoes installed, tuning done."
              value={workDoneSummary}
              onChange={(e) => setWorkDoneSummary(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteJob}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Mark Job Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RECORD SCRAP                                                 */}
      {/* =================================================================== */}
      {showScrapModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Record Replaced Parts & Scrap</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Log replaced parts (e.g. old spark plugs, old clutch plates, used engine oil).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Item Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Old Clutch Plates / Used Oil (0.7L)"
                  value={scrapForm.itemDescription}
                  onChange={(e) => setScrapForm({ ...scrapForm, itemDescription: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={scrapForm.quantity}
                    onChange={(e) => setScrapForm({ ...scrapForm, quantity: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={scrapForm.unit}
                    onChange={(e) => setScrapForm({ ...scrapForm, unit: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="customerKept"
                  checked={scrapForm.customerKept}
                  onChange={(e) => setScrapForm({ ...scrapForm, customerKept: e.target.checked })}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                />
                <label htmlFor="customerKept" className="text-zinc-300">
                  Customer kept the old replaced parts
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowScrapModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordScrap}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Save Scrap Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: FINAL CHECK & CLOSE JOB CARD                                 */}
      {/* =================================================================== */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Step 10: Final Check & Close</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Hard Control: Checks all materials and tool returns before closing Job #{selectedJob?.jobNumber}.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Delivery Status</label>
                <select
                  value={closeForm.deliveryStatus}
                  onChange={(e) => setCloseForm({ ...closeForm, deliveryStatus: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="ready_for_delivery">Ready For Delivery</option>
                  <option value="delivered">Delivered to Customer</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Delivered To / Gate Pass</label>
                <input
                  type="text"
                  placeholder="Customer or driver name"
                  value={closeForm.deliveredTo}
                  onChange={(e) => setCloseForm({ ...closeForm, deliveredTo: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Manager Close Notes</label>
                <textarea
                  rows={2}
                  value={closeForm.closeNotes}
                  onChange={(e) => setCloseForm({ ...closeForm, closeNotes: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseJob}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Verify & Close Job Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PRINTABLE JOB CARD                                           */}
      {/* =================================================================== */}
      {showPrintModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-white text-black w-full max-w-2xl rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b-2 border-black pb-4 mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold uppercase tracking-tight">WORKMAN SERVICES</h1>
                <p className="text-xs text-gray-600">Bikes Workshop Division • Official Job Card</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-extrabold text-black block">{selectedJob.jobNumber}</span>
                <span className="text-xs text-gray-500">{formatDateTime(selectedJob.createdAt)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-4 p-3 bg-gray-100 rounded-lg">
              <div>
                <span className="text-gray-500 block">Bike Reg No:</span>
                <span className="text-sm font-extrabold text-black">{selectedJob.bikeRegNo}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Make & Model:</span>
                <span className="font-bold">{selectedJob.bikeMakeModel || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Chassis / Engine:</span>
                <span className="font-mono">{selectedJob.chassisNumber || "-"} / {selectedJob.engineNumber || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Current Km:</span>
                <span className="font-mono">{selectedJob.currentKm ? `${selectedJob.currentKm} km` : "-"}</span>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-xs uppercase border-b border-gray-300 pb-1 mb-1">Customer & Complaint:</h4>
              <p className="text-xs"><strong>Customer:</strong> {selectedJob.customerName || "Walk-In"} ({selectedJob.customerPhone || "-"})</p>
              <p className="text-xs mt-1"><strong>Reported Fault:</strong> {selectedJob.complaint}</p>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-xs uppercase border-b border-gray-300 pb-1 mb-1">Work Done & Summary:</h4>
              <p className="text-xs">{selectedJob.workDoneSummary || selectedJob.workRequired || "Under repair"}</p>
            </div>

            <div className="border-t-2 border-black pt-4 mt-8 grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="h-12 border-b border-gray-400 mb-1"></div>
                <span className="text-gray-600">Mechanic Signature</span>
              </div>
              <div>
                <div className="h-12 border-b border-gray-400 mb-1"></div>
                <span className="text-gray-600">Workshop Manager</span>
              </div>
              <div>
                <div className="h-12 border-b border-gray-400 mb-1"></div>
                <span className="text-gray-600">Customer Received</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 no-print">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-gray-200 text-black font-semibold rounded-lg text-xs"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-black text-white font-bold rounded-lg text-xs"
              >
                Print Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
