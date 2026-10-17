"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import AddEmployeeDrawer from "@/components/drawers/AddEmployeeDrawer";
import LeaveRequestDrawer from "@/components/drawers/LeaveRequestDrawer";
import AddAssetDrawer from "@/components/drawers/AddAssetDrawer";
import AssignAssetDrawer from "@/components/drawers/AssignAssetDrawer";
import NewRequisitionDrawer from "@/components/drawers/NewRequisitionDrawer";
import AddCandidateDrawer from "@/components/drawers/AddCandidateDrawer";
import CreatePayrollDrawer from "@/components/drawers/CreatePayrollDrawer";
import PayrollRunDetailDrawer from "@/components/drawers/PayrollRunDetailDrawer";
import PayslipModal from "@/components/drawers/PayslipModal";
import IssueAdvanceDrawer from "@/components/drawers/IssueAdvanceDrawer";
import GeofenceSitesPanel from "@/components/hrm/GeofenceSitesPanel";
import CompanyOnboardingTab from "@/components/hrm/CompanyOnboardingTab";
import {
  Users,
  Clock,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  MapPin,
  Plus,
  Play,
  Check,
  CreditCard,
  X,
  FileCheck,
  ChevronRight,
  TrendingDown,
  BarChart3,
  Calendar,
  Package,
  UserCheck,
  LifeBuoy,
  UserPlus,
  FolderTree,
  List,
  Eye,
  ArrowRight,
  Send,
  RotateCcw,
  Sparkles,
  Search,
  Briefcase,
  CalendarDays,
} from "lucide-react";

function HrmPayrollContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<
    | "analytics"
    | "company-onboarding"
    | "employees"
    | "leave"
    | "assets"
    | "recruitment"
    | "attendance"
    | "payroll"
    | "advances"
    | "ess"
  >(() => {
    if (
      tabParam &&
      [
        "analytics",
        "company-onboarding",
        "employees",
        "leave",
        "assets",
        "recruitment",
        "attendance",
        "payroll",
        "advances",
        "ess",
      ].includes(tabParam)
    ) {
      return tabParam as any;
    }
    return "analytics";
  });

  useEffect(() => {
    if (
      tabParam &&
      [
        "analytics",
        "company-onboarding",
        "employees",
        "leave",
        "assets",
        "recruitment",
        "attendance",
        "payroll",
        "advances",
        "ess",
      ].includes(tabParam)
    ) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  // General data
  const [employees, setEmployees] = useState<any[]>([]);
  const [notification, setNotification] = useState("");

  // Tab: Analytics
  const [analytics, setAnalytics] = useState<any>(null);

  // Tab: Employees
  const [employeeSubTab, setEmployeeSubTab] = useState<"all" | "technicians" | "office" | "on_leave">("all");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [isOrgChartOpen, setIsOrgChartOpen] = useState(false);
  const [orgTree, setOrgTree] = useState<any[]>([]);
  const [showAddEmployeeDrawer, setShowAddEmployeeDrawer] = useState(false);

  // Tab: Leave Management
  const [leaveSubTab, setLeaveSubTab] = useState<"pending" | "all" | "holidays">("pending");
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [showLeaveDrawer, setShowLeaveDrawer] = useState(false);

  // Tab: Asset Management
  const [assetSubTab, setAssetSubTab] = useState<"All" | "Assigned" | "In Storage" | "Under Repair">("All");
  const [assets, setAssets] = useState<any[]>([]);
  const [showAddAssetDrawer, setShowAddAssetDrawer] = useState(false);
  const [assignTargetAsset, setAssignTargetAsset] = useState<any>(null);

  // Tab: Recruitment (ATS)
  const [atsView, setAtsView] = useState<"pipeline" | "requisitions">("pipeline");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [showNewRequisitionDrawer, setShowNewRequisitionDrawer] = useState(false);
  const [showAddCandidateDrawer, setShowAddCandidateDrawer] = useState(false);
  const [candidateDefaultStage, setCandidateDefaultStage] = useState("Applied");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedRequisitionFilter, setSelectedRequisitionFilter] = useState("all");
  const [onboardCandidate, setOnboardCandidate] = useState<any>(null);

  // Tab: Grievances
  const [grievanceSubTab, setGrievanceSubTab] = useState<"all" | "open" | "resolved">("open");
  const [grievances, setGrievances] = useState<any[]>([]);
  const [showRaiseGrievanceDrawer, setShowRaiseGrievanceDrawer] = useState(false);

  // Tab: ESS (uses the selected live employee record)
  const [essEmployeeId, setEssEmployeeId] = useState("");
  const [essEmployee, setEssEmployee] = useState<any>(null);

  // Existing Attendance States
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [attendanceSubTab, setAttendanceSubTab] = useState<"all" | "flagged">("all");
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [resolveTargetLog, setResolveTargetLog] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [faceScore, setFaceScore] = useState(96.5);
  const [checkInLat, setCheckInLat] = useState<number | "">("");
  const [checkInLng, setCheckInLng] = useState<number | "">("");
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any>(null);

  // Existing Payroll States
  const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
  const [showCreatePayrollDrawer, setShowCreatePayrollDrawer] = useState(false);
  const [selectedPayrollRunForDetail, setSelectedPayrollRunForDetail] = useState<any>(null);
  const [selectedPayslipForModal, setSelectedPayslipForModal] = useState<any>(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advances, setAdvances] = useState<any[]>([]);
  const [advanceEmpId, setAdvanceEmpId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);

  async function loadData() {
    try {
      if (activeTab === "analytics") {
        const res = await fetch("/api/hrm/analytics");
        const data = await res.json();
        if (data.analytics) setAnalytics(data.analytics);
      } else if (activeTab === "employees") {
        const [empRes, treeRes] = await Promise.all([
          fetch(`/api/hrm/employees?tab=${employeeSubTab}`),
          fetch(`/api/hrm/employees?hierarchy=true`),
        ]);
        const empData = await empRes.json();
        const treeData = await treeRes.json();
        if (empData.employees) setEmployees(empData.employees);
        if (treeData.hierarchy) setOrgTree(treeData.hierarchy);
      } else if (activeTab === "leave") {
        const res = await fetch(`/api/hrm/leave?status=${leaveSubTab === "pending" ? "Pending" : ""}`);
        const data = await res.json();
        if (data.requests) setLeaveRequests(data.requests);
        if (data.leaveTypes) setLeaveTypes(data.leaveTypes);
        if (data.holidays) setHolidays(data.holidays);
        // Also ensure employees are loaded for drawer
        const empRes = await fetch("/api/hrm/employees");
        const empData = await empRes.json();
        if (empData.employees) setEmployees(empData.employees);
      } else if (activeTab === "assets") {
        const res = await fetch(`/api/hrm/assets?status=${assetSubTab}`);
        const data = await res.json();
        if (data.assets) setAssets(data.assets);
        const empRes = await fetch("/api/hrm/employees");
        const empData = await empRes.json();
        if (empData.employees) setEmployees(empData.employees);
      } else if (activeTab === "recruitment") {
        const res = await fetch("/api/hrm/recruitment");
        const data = await res.json();
        if (data.candidates) setCandidates(data.candidates);
        if (data.requisitions) setRequisitions(data.requisitions);
      } else if (activeTab === "attendance") {
        const url = `/api/attendance${attendanceSubTab === "flagged" ? "?flagged=true" : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.logs) setAttendanceLogs(data.logs);
        if (data.flaggedCount !== undefined) setFlaggedCount(data.flaggedCount);
        if (data.employees) {
          setEmployees(data.employees);
          if (!selectedEmpId && data.employees.length > 0) {
            setSelectedEmpId(data.employees[0].id);
          }
        }
        if (data.zones) {
          setZones(data.zones);
          if (!selectedZoneId && data.zones.length > 0) {
            setSelectedZoneId(data.zones[0].id);
          }
        }
      } else if (activeTab === "payroll") {
        const res = await fetch("/api/hrm/payroll");
        const data = await res.json();
        if (data.runs) setPayrollRuns(data.runs);
        if (data.employees) setEmployees(data.employees);
      } else if (activeTab === "advances") {
        const res = await fetch("/api/hrm/advances");
        const data = await res.json();
        if (data.advances) setAdvances(data.advances);
        if (data.employees) setEmployees(data.employees);
      } else if (activeTab === "ess") {
        const empRes = await fetch("/api/hrm/employees");
        const empData = await empRes.json();
        if (empData.employees && empData.employees.length > 0) {
          setEmployees(empData.employees);
          const targetId = essEmployeeId || empData.employees[0].id;
          if (!essEmployeeId) setEssEmployeeId(targetId);
          const singleRes = await fetch(`/api/hrm/employees/${targetId}`);
          const singleData = await singleRes.json();
          setEssEmployee(singleData.employee);
        }
      }
    } catch (e) {
      console.error("HRM data fetch failed", e);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab, employeeSubTab, leaveSubTab, assetSubTab, atsView, grievanceSubTab, essEmployeeId, attendanceSubTab]);

  // Leave approval / rejection
  const handleApproveLeave = async (requestId: string) => {
    try {
      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          requestId,
        }),
      });
      if (res.ok) {
        setNotification("Leave request approved and balance deducted.");
        loadData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectLeave = async (requestId: string) => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason) return;
    try {
      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          requestId,
          reason,
        }),
      });
      if (res.ok) {
        setNotification("Leave request rejected.");
        loadData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Asset return
  const handleReturnAsset = async (assetId: string) => {
    const notes = prompt("Enter return condition notes (e.g. good condition, cleaned, tested):");
    try {
      const res = await fetch("/api/hrm/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return",
          assetId,
          conditionNotes: notes || undefined,
        }),
      });
      if (res.ok) {
        setNotification("Asset returned to store inventory.");
        loadData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Approve Requisition
  const handleApproveRequisition = async (reqId: string) => {
    try {
      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_requisition",
          requisitionId: reqId,
        }),
      });
      if (res.ok) {
        setNotification("Requisition approved and opened for hiring.");
        loadData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Move candidate stage
  const handleUpdateCandidateStage = async (candidateId: string, newStage: string) => {
    try {
      const res = await fetch("/api/hrm/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_stage",
          candidateId,
          stage: newStage,
        }),
      });
      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c))
        );
        setNotification(`Candidate advanced to ${newStage}.`);
      }
    } catch (e: any) {
      alert(e.message || "Failed to update candidate stage");
    }
  };

  // Handle Attendance Verification Check-in
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkInLat === "" || checkInLng === "") {
      alert("Enter the attendance latitude and longitude or select a configured work site.");
      return;
    }
    try {
      setIsSubmittingAttendance(true);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmpId,
          geofenceZoneId: selectedZoneId || undefined,
          faceMatchScore: Number(faceScore),
          lat: Number(checkInLat),
          lng: Number(checkInLng),
          timestamp: new Date().toISOString(),
          deviceId: navigator.userAgent,
        }),
      });
      const data = await res.json();
      setAttendanceResult(data);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  // Handle Resolving / Dismissing Flagged Attendance Entries
  const handleResolveFlag = async (action: "approve" | "dismiss") => {
    if (!resolveTargetLog) return;
    try {
      setIsResolving(true);
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: resolveTargetLog.id,
          action,
          notes: resolutionNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(data.message || `Flag ${action}d successfully.`);
        setResolveTargetLog(null);
        setResolutionNotes("");
        loadData();
      } else {
        alert(data.error || data.message || "Failed to resolve flag");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsResolving(false);
    }
  };

  // Handle Payroll Calculation
  const handleCalculatePayroll = async () => {
    try {
      const res = await fetch("/api/hrm/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate_draft",
          period: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date()),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotification("Draft payroll run generated successfully!");
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Handle Payroll Approval
  const handleApprovePayroll = async (runId: string) => {
    try {
      const res = await fetch("/api/hrm/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          runId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotification("Payroll approved! Ready for finance payout disbursement.");
      setSelectedPayrollRunForDetail((prev: any) =>
        prev?.id === runId ? { ...prev, status: "Approved" } : prev
      );
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Handle Payroll Payout
  const handleDisbursePayroll = async (runId: string) => {
    if (!confirm("Disburse payroll now? This will issue payment via WPS Bank transfer and record salary expense.")) {
      return;
    }
    try {
      const res = await fetch("/api/hrm/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disburse",
          runId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotification("Payroll disbursed and posted through Accounts Posting Engine!");
      setSelectedPayrollRunForDetail((prev: any) =>
        prev?.id === runId ? { ...prev, status: "Paid" } : prev
      );
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Handle Discarding Draft Payroll
  const handleDeleteDraftPayroll = async (runId: string) => {
    if (!confirm("Discard this draft payroll cycle? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/hrm/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_draft",
          runId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotification("Draft payroll cycle discarded.");
      if (selectedPayrollRunForDetail?.id === runId) {
        setSelectedPayrollRunForDetail(null);
      }
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete draft");
    }
  };

  // Issue Staff Advance
  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceAmount || Number(advanceAmount) <= 0) return;
    try {
      setIsSubmittingAdvance(true);
      const res = await fetch("/api/hrm/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: advanceEmpId || employees[0]?.id,
          amount: Number(advanceAmount),
          reason: advanceReason.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowAdvanceModal(false);
      setAdvanceAmount("");
      setAdvanceReason("");
      setNotification("Salary advance issued! Advance ledger debited.");
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const tabTitles: Record<string, { label: string; title: string; subtitle: string }> = {
    analytics: {
      label: "HR Dashboard",
      title: "Human Resources & Workforce Overview",
      subtitle: "Executive KPI widgets, department headcounts, live shifts, and workforce metrics",
    },
    "company-onboarding": {
      label: "Company Onboarding",
      title: "Company & HR Onboarding",
      subtitle: "Configure company identity and the HR foundations used across every department",
    },
    employees: {
      label: "Employees",
      title: "Employee Directory & Organization Master",
      subtitle: "Employee records, departments, designations, pay grades, and reporting hierarchies",
    },
    leave: {
      label: "Leave Management",
      title: "Leave Policy & Application Approvals",
      subtitle: "Review pending employee leave requests, leave quotas, and statutory holiday schedules",
    },
    assets: {
      label: "Assets Register",
      title: "Company Assets & Equipment Tracking",
      subtitle: "Company vehicle, tools, and hardware asset registry with assignment audit trails",
    },
    recruitment: {
      label: "Recruitment (ATS)",
      title: "Talent Acquisition & ATS Pipeline",
      subtitle: "Job requisitions, applicant tracking system, interview stages, and offers",
    },
    attendance: {
      label: "Attendance & Face",
      title: "Geofenced Attendance & Facial Verification",
      subtitle: "Multi-site geofencing, facial liveness verification, and dual-gate biometric audit logs",
    },
    payroll: {
      label: "Payroll Runs",
      title: "Automated Monthly Payroll Engine",
      subtitle: "Salary structure calculations, deductions, allowances, bank disbursements, and payslips",
    },
    advances: {
      label: "Advances",
      title: "Staff Salary Advance Ledger",
      subtitle: "Record and manage employee advance disbursements and automated payroll recovery",
    },
    ess: {
      label: "Self-Service (ESS)",
      title: "Employee Self-Service Portal",
      subtitle: "Self-service payslip access, leave balance inquiries, and grievance helpdesk",
    },
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!employeeSearchTerm.trim()) return true;
    const q = employeeSearchTerm.toLowerCase().trim();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.designation && emp.designation.toLowerCase().includes(q)) ||
      (emp.role && emp.role.toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q)) ||
      (emp.phone && emp.phone.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.reportingManager?.name && emp.reportingManager.name.toLowerCase().includes(q)) ||
      (emp.status && emp.status.toLowerCase().includes(q))
    );
  });

  const currentTabInfo = tabTitles[activeTab] || tabTitles.analytics;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "HRM & Workforce" },
          ...(activeTab !== "analytics" ? [{ label: currentTabInfo.label }] : []),
        ]}
        title={currentTabInfo.title}
        subtitle={currentTabInfo.subtitle}
        actions={
          activeTab === "employees" ? (
            <button
              onClick={() => setShowAddEmployeeDrawer(true)}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          ) : activeTab === "leave" ? (
            <button
              onClick={() => setShowLeaveDrawer(true)}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              Apply for Leave
            </button>
          ) : activeTab === "assets" ? (
            <button
              onClick={() => setShowAddAssetDrawer(true)}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Package className="w-3.5 h-3.5" />
              Register Asset
            </button>
          ) : activeTab === "recruitment" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCandidateDefaultStage("Applied");
                  setShowAddCandidateDrawer(true);
                }}
                className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Candidate
              </button>
              <button
                onClick={() => setShowNewRequisitionDrawer(true)}
                className="h-8 px-3.5 rounded-lg bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#71717A]" />
                Raise Requisition
              </button>
            </div>
          ) : activeTab === "payroll" ? (
            <button
              onClick={() => setShowCreatePayrollDrawer(true)}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              Generate Monthly Draft
            </button>
          ) : activeTab === "advances" ? (
            <button
              onClick={() => {
                if (employees.length > 0 && !advanceEmpId) setAdvanceEmpId(employees[0].id);
                setShowAdvanceModal(true);
              }}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Issue Staff Advance
            </button>
          ) : undefined
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button onClick={() => setNotification("")} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {activeTab === "company-onboarding" && <CompanyOnboardingTab />}

      {/* ========================================================================= */}
      {/* TAB 1: HR ANALYTICS DASHBOARD (ROLE-AWARE KPI WIDGETS)                     */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* 1. Quick HR Action Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-[#EDEDED] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0D7A5F]/10 text-[#0D7A5F] flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  HR Management Operations Hub
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Executive workforce command, daily approvals, live attendance, and roster tracking.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAddEmployeeDrawer(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0D7A5F] hover:bg-[#0A614B] rounded-lg transition shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Employee</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveDrawer(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#D4D4D8] rounded-lg transition cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-[#0D7A5F]" />
                <span>Log Leave</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddAssetDrawer(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#D4D4D8] rounded-lg transition cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Issue Asset</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewRequisitionDrawer(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#D4D4D8] rounded-lg transition cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                <span>Post Requisition</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("attendance")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Live Terminal</span>
              </button>
            </div>
          </div>

          {/* 2. Top Executive KPI Metric Cards (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Workforce */}
            <div
              onClick={() => setActiveTab("employees")}
              className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs hover:border-[#0D7A5F]/60 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                    Total Workforce
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-[#18181B]">
                    {analytics?.headcount?.total || 0}
                  </span>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {analytics?.headcount?.active || 0} Active Staff
                  </span>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-[#F4F4F5] flex items-center justify-between text-[11px] text-[#71717A]">
                <span>{analytics?.headcount?.onLeave || 0} on leave today</span>
                <span className="font-semibold text-emerald-700 font-mono">
                  Turnover: {analytics?.turnoverRate || 0}%
                </span>
              </div>
            </div>

            {/* Card 2: Live Shift Attendance Today */}
            <div
              onClick={() => setActiveTab("attendance")}
              className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs hover:border-sky-500/60 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                    Shift Attendance Today
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-[#18181B]">
                    {analytics?.attendance?.present || 0} Present
                  </span>
                  <span className="text-xs font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    {analytics?.attendance?.rate || 0}% Attendance
                  </span>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-[#F4F4F5] flex items-center justify-between text-[11px] text-[#71717A]">
                <span>{analytics?.attendance?.absent || 0} absent / pending</span>
                <span className="font-semibold text-sky-700 font-mono">
                  {analytics?.attendance?.geofenceVerifiedCount || 0} GPS punches
                </span>
              </div>
            </div>

            {/* Card 3: Monthly Wage & Payroll Liability */}
            <div
              onClick={() => setActiveTab("payroll")}
              className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs hover:border-purple-500/60 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                    Monthly Wage & Payroll
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-[#18181B] truncate">
                    {formatCurrency(analytics?.payroll?.monthlyWageLiability || 0)}
                  </span>
                  <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 shrink-0">
                    {analytics?.payroll?.latest?.period || "Current Month"}
                  </span>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-[#F4F4F5] flex items-center justify-between text-[11px] text-[#71717A]">
                <span>Active Advances:</span>
                <span className="font-semibold text-amber-700 font-mono">
                  {formatCurrency(analytics?.payroll?.activeAdvancesTotal || 0)}
                </span>
              </div>
            </div>

            {/* Card 4: Equipment Assets & Talent ATS */}
            <div
              onClick={() => setActiveTab("assets")}
              className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs hover:border-amber-500/60 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                    Assets & Recruitment
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-[#18181B]">
                    {analytics?.assets?.assigned || 0}
                    <span className="text-sm text-[#71717A] font-normal font-sans">
                      /{analytics?.assets?.total || 0} Assets
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {analytics?.openRequisitions || 0} ATS Roles
                  </span>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-[#F4F4F5] flex items-center justify-between text-[11px] text-[#71717A]">
                <span>{analytics?.assets?.inStorage || 0} assets in store</span>
                <span className="font-semibold text-purple-700 font-mono">
                  {analytics?.pendingGrievances || 0} tickets
                </span>
              </div>
            </div>
          </div>

          {/* 3. Operational Hub: Pending HR Approvals vs Live Shift Geofence Terminal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Action Required & Pending Approvals Hub (Col span 7) */}
            <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Priority Actions & Pending HR Approvals
                    </h3>
                    <p className="text-[11px] text-[#71717A]">
                      Leave applications, salary advance authorizations, and probation reviews.
                    </p>
                  </div>
                </div>
                {((analytics?.pendingActions?.pendingLeavesCount || 0) +
                  (analytics?.pendingActions?.pendingAdvancesCount || 0) +
                  (analytics?.probationEndingSoon?.length || 0)) > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                    {((analytics?.pendingActions?.pendingLeavesCount || 0) +
                      (analytics?.pendingActions?.pendingAdvancesCount || 0) +
                      (analytics?.probationEndingSoon?.length || 0))}{" "}
                    Action Required
                  </span>
                )}
              </div>

              {/* Pending Items List */}
              <div className="space-y-3">
                {/* 1. Pending Leaves */}
                {analytics?.pendingActions?.pendingLeaves && analytics.pendingActions.pendingLeaves.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pending Leave Requests ({analytics.pendingActions.pendingLeavesCount})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab("leave")}
                        className="text-[11px] text-[#0D7A5F] hover:underline font-semibold cursor-pointer"
                      >
                        Review all leaves &rarr;
                      </button>
                    </div>
                    {analytics.pendingActions.pendingLeaves.map((lv: any) => (
                      <div
                        key={lv.id}
                        className="flex items-center justify-between p-2.5 bg-amber-50/40 hover:bg-amber-50 rounded-lg border border-amber-200/80 text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-[#18181B]">{lv.employee?.name || "Employee"}</span>
                          <span className="text-[#71717A] text-[11px] ml-2">
                            {lv.employee?.department} • {lv.leaveType?.name || "Leave"} ({lv.daysCount} days)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab("leave")}
                          className="text-[10px] font-bold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 px-2 py-1 rounded transition cursor-pointer"
                        >
                          Review Request
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* 2. Pending Salary Advances */}
                {analytics?.pendingActions?.pendingAdvances && analytics.pendingActions.pendingAdvances.length > 0 ? (
                  <div className="space-y-1.5 pt-2 border-t border-[#F4F4F5]">
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                        <span>Salary Advance Requests ({analytics.pendingActions.pendingAdvancesCount})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab("advances")}
                        className="text-[11px] text-[#0D7A5F] hover:underline font-semibold cursor-pointer"
                      >
                        Open Advance Portal &rarr;
                      </button>
                    </div>
                    {analytics.pendingActions.pendingAdvances.map((adv: any) => (
                      <div
                        key={adv.id}
                        className="flex items-center justify-between p-2.5 bg-purple-50/40 hover:bg-purple-50 rounded-lg border border-purple-200/80 text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-[#18181B]">{adv.employee?.name || "Employee"}</span>
                          <span className="text-[#71717A] text-[11px] ml-2 font-mono">
                            Requested: {formatCurrency(adv.amount)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab("advances")}
                          className="text-[10px] font-bold text-purple-900 bg-white hover:bg-purple-100 border border-purple-300 px-2 py-1 rounded transition cursor-pointer"
                        >
                          Authorize
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* 3. Probation Ending Soon */}
                {analytics?.probationEndingSoon && analytics.probationEndingSoon.length > 0 ? (
                  <div className="space-y-1.5 pt-2 border-t border-[#F4F4F5]">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#18181B]">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Probation Expiring Within 30 Days ({analytics.probationEndingSoon.length})</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-mono font-semibold">Evaluation Due</span>
                    </div>
                    {analytics.probationEndingSoon.slice(0, 3).map((emp: any) => (
                      <Link
                        key={emp.id}
                        href={`/hrm/employees/${emp.id}`}
                        className="flex items-center justify-between p-2.5 bg-[#FAFAFA] hover:bg-zinc-100 rounded-lg border border-[#E4E4E7] text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-[#18181B]">{emp.name}</span>
                          <span className="text-[#71717A] text-[11px] ml-2">
                            {emp.designation} • {emp.department}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Due {formatDateTime(emp.probationEndDate)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {/* All clear state if none of the above */}
                {(!analytics?.pendingActions?.pendingLeaves || analytics.pendingActions.pendingLeaves.length === 0) &&
                  (!analytics?.pendingActions?.pendingAdvances || analytics.pendingActions.pendingAdvances.length === 0) &&
                  (!analytics?.probationEndingSoon || analytics.probationEndingSoon.length === 0) && (
                    <div className="p-6 text-center bg-[#F9FAFB] rounded-lg border border-[#EDEDED] space-y-1.5">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <p className="text-xs font-bold text-[#18181B]">All Clear! No Pending Approvals</p>
                      <p className="text-[11px] text-[#71717A]">
                        All employee leave requests, salary advances, and probation reviews are up to date.
                      </p>
                    </div>
                  )}
              </div>
            </div>

            {/* Right: Live Shift & Geofence Verification Terminal (Col span 5) */}
            <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center shadow-xs">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                        Live Attendance & Geofence
                      </h3>
                      <p className="text-[11px] text-[#71717A]">
                        Real-time GPS geofence checks and shift progress today.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    {analytics?.attendance?.rate || 0}% Present
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#71717A] font-medium">
                    <span>Shift Attendance Rate</span>
                    <span className="font-bold text-[#18181B]">
                      {analytics?.attendance?.present || 0} of {analytics?.headcount?.active || 0} checked in
                    </span>
                  </div>
                  <div className="w-full bg-[#E4E4E7] h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, analytics?.attendance?.rate || 0)}%` }}
                    />
                    <div
                      className="bg-amber-400 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          analytics?.headcount?.active
                            ? ((analytics?.headcount?.onLeave || 0) / analytics.headcount.active) * 100
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#71717A] pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present (
                      {analytics?.attendance?.present || 0})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> On Leave (
                      {analytics?.attendance?.onLeave || 0})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400" /> Absent (
                      {analytics?.attendance?.absent || 0})
                    </span>
                  </div>
                </div>

                {/* Geofence verification callout */}
                <div className="p-3 bg-sky-50/60 rounded-lg border border-sky-200 text-xs text-sky-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>
                      <strong>{analytics?.attendance?.geofenceVerifiedCount || 0} punches</strong> verified inside
                      active geofenced boundaries.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#F4F4F5] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  className="w-full py-2 bg-[#0D7A5F] hover:bg-[#0A614B] text-white text-xs font-semibold rounded-lg text-center transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Open Full Attendance Terminal & Log Punch</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Bottom 3-Column Grid: Departments, Assets & Calendar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Headcount by Department */}
            <div className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  <span>Department Distribution</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("employees")}
                  className="text-[11px] text-[#0D7A5F] hover:underline font-semibold cursor-pointer"
                >
                  Directory &rarr;
                </button>
              </div>
              <div className="space-y-2.5">
                {analytics?.headcount?.byDepartment && analytics.headcount.byDepartment.length > 0 ? (
                  analytics.headcount.byDepartment.map((d: any) => {
                    const total = analytics?.headcount?.total || 1;
                    const pct = Math.round((d.count / total) * 100);
                    return (
                      <div key={d.department} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#18181B]">{d.department || "Unassigned"}</span>
                          <span className="font-mono font-bold text-[#0D7A5F]">
                            {d.count} staff <span className="text-[#71717A] font-normal text-[10px]">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-[#F4F4F5] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#0D7A5F] h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#71717A] py-3 text-center">No departments configured yet.</p>
                )}
              </div>
            </div>

            {/* Column 2: Equipment & Assets Deployed */}
            <div className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Company Equipment & Assets</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("assets")}
                  className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                    <span className="text-xl font-bold font-mono text-blue-900 block">
                      {analytics?.assets?.assigned || 0}
                    </span>
                    <span className="text-[10px] text-blue-700 font-semibold uppercase">Assigned to Staff</span>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EDEDED]">
                    <span className="text-xl font-bold font-mono text-[#18181B] block">
                      {analytics?.assets?.inStorage || 0}
                    </span>
                    <span className="text-[10px] text-[#71717A] font-semibold uppercase">In Storage Store</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAssetDrawer(true)}
                  className="w-full py-1.5 bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#D4D4D8] text-xs font-semibold rounded-lg text-[#18181B] transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  <span>+ Register New Asset</span>
                </button>
              </div>
            </div>

            {/* Column 3: Upcoming Holidays & Recent Joiners */}
            <div className="bg-white p-5 rounded-xl border border-[#EDEDED] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F4F4F5]">
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Calendar & Recent Hires</span>
                </h3>
                <span className="text-[10px] font-mono text-[#71717A]">Workforce Pulse</span>
              </div>
              <div className="space-y-2">
                {/* Upcoming Holidays */}
                {analytics?.upcomingHolidays && analytics.upcomingHolidays.length > 0 ? (
                  analytics.upcomingHolidays.map((h: any) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg border border-emerald-200 text-xs"
                    >
                      <span className="font-semibold text-emerald-950">{h.name}</span>
                      <span className="text-[10px] font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                        {formatDateTime(h.date)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-[#71717A]">No upcoming holidays scheduled this month.</p>
                )}

                {/* Recent Joiners */}
                {analytics?.recentJoiners && analytics.recentJoiners.length > 0 && (
                  <div className="pt-2 border-t border-[#F4F4F5] space-y-1">
                    <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
                      Recent Joiners
                    </span>
                    {analytics.recentJoiners.slice(0, 2).map((emp: any) => (
                      <Link
                        key={emp.id}
                        href={`/hrm/employees/${emp.id}`}
                        className="flex items-center justify-between text-xs py-1 hover:text-[#0D7A5F] transition"
                      >
                        <span className="font-semibold truncate">{emp.name}</span>
                        <span className="text-[10px] text-[#71717A] shrink-0 font-mono">
                          Joined {formatDateTime(emp.joinDate)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EMPLOYEES TABLE & ORG CHART VIEW                                   */}
      {/* ========================================================================= */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Sub-view switcher: Table vs Org Chart & Search Bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-lg">
              {(["all", "technicians", "office", "on_leave"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setEmployeeSubTab(st)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition ${
                    employeeSubTab === st
                      ? "bg-white text-[#18181B] shadow-2xs font-bold"
                      : "text-[#71717A] hover:text-[#18181B]"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 flex-1 max-w-lg justify-end">
              {/* Search Bar for Searching Employees */}
              <div className="relative w-full max-w-xs">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, role, dept, phone..."
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 rounded-xl border border-[#D4D4D8] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] placeholder:text-zinc-400 transition"
                />
                {employeeSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setEmployeeSearchTerm("")}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 text-xs"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={() => setIsOrgChartOpen(!isOrgChartOpen)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition shrink-0 ${
                  isOrgChartOpen
                    ? "bg-[#18181B] text-white border-[#18181B]"
                    : "bg-white text-[#18181B] border-[#E4E4E7] hover:bg-[#F4F4F5]"
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                {isOrgChartOpen ? "Show Dense Table" : "View Org Hierarchy"}
              </button>
            </div>
          </div>

          {/* Org Chart Tree View */}
          {isOrgChartOpen ? (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Organizational Hierarchy & Reporting Lines
              </h3>
              <div className="space-y-4">
                {orgTree.map((rootNode: any) => (
                  <div key={rootNode.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#18181B] text-white flex items-center justify-center font-bold text-xs">
                          {rootNode.name[0]}
                        </div>
                        <div>
                          <Link
                            href={`/hrm/employees/${rootNode.id}`}
                            className="font-bold text-xs text-[#0D7A5F] hover:underline"
                          >
                            {rootNode.name}
                          </Link>
                          <span className="text-[11px] text-[#71717A] ml-2">
                            {rootNode.designation || rootNode.role} ({rootNode.department})
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={rootNode.status} />
                    </div>

                    {/* Direct Reports */}
                    {rootNode.directReports && rootNode.directReports.length > 0 && (
                      <div className="ml-6 pl-4 border-l-2 border-[#0D7A5F]/30 space-y-2">
                        {rootNode.directReports.map((dr: any) => (
                          <div
                            key={dr.id}
                            className="p-2.5 bg-white rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[#0D7A5F] font-mono font-bold">↳</span>
                              <Link
                                href={`/hrm/employees/${dr.id}`}
                                className="font-bold text-[#18181B] hover:text-[#0D7A5F]"
                              >
                                {dr.name}
                              </Link>
                              <span className="text-[11px] text-[#71717A]">
                                {dr.designation || dr.role}
                              </span>
                            </div>
                            <StatusBadge status={dr.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Dense Employee Table (per 04-DESIGN.md Section 2) */
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                    <tr>
                      <th className="p-3 font-semibold">Employee</th>
                      <th className="p-3 font-semibold">Designation</th>
                      <th className="p-3 font-semibold">Department</th>
                      <th className="p-3 font-semibold">Reporting Manager</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-2">
                            <Users className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-bold text-zinc-700">No employees found</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {employeeSearchTerm
                              ? `No employee records match "${employeeSearchTerm}". Try checking your spelling or clear search.`
                              : "No employees in this category."}
                          </p>
                          {employeeSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setEmployeeSearchTerm("")}
                              className="mt-2.5 px-3 py-1 rounded-lg border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                            >
                              Clear Search
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const empInitials = emp.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <tr key={emp.id} className="hover:bg-[#F9FAFB] transition">
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {empInitials}
                                </div>
                                <div>
                                  <Link
                                    href={`/hrm/employees/${emp.id}`}
                                    className="font-bold text-[#0D7A5F] hover:underline block"
                                  >
                                    {emp.name}
                                  </Link>
                                  <span className="text-[10px] text-[#71717A]">{emp.phone}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-[#18181B]">{emp.designation || emp.role}</td>
                            <td className="p-3 text-[#71717A]">{emp.department}</td>
                            <td className="p-3 font-medium text-[#18181B]">
                              {emp.reportingManager ? emp.reportingManager.name : <span className="text-[#71717A]">—</span>}
                            </td>
                            <td className="p-3">
                              <StatusBadge status={emp.status} />
                            </td>
                            <td className="p-3 text-right">
                              <Link
                                href={`/hrm/employees/${emp.id}`}
                                className="px-2.5 py-1 text-xs font-semibold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Profile
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LEAVE MANAGEMENT (REQUESTS, APPROVALS, BALANCES & HOLIDAYS)         */}
      {/* ========================================================================= */}
      {activeTab === "leave" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-lg">
              <button
                onClick={() => setLeaveSubTab("pending")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  leaveSubTab === "pending"
                    ? "bg-white text-[#18181B] shadow-2xs font-bold"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Pending My Approval ({leaveRequests.filter((r) => r.status === "Pending").length})
              </button>
              <button
                onClick={() => setLeaveSubTab("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  leaveSubTab === "all"
                    ? "bg-white text-[#18181B] shadow-2xs font-bold"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                All Requests ({leaveRequests.length})
              </button>
              <button
                onClick={() => setLeaveSubTab("holidays")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  leaveSubTab === "holidays"
                    ? "bg-white text-[#18181B] shadow-2xs font-bold"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Company Holiday Calendar ({holidays.length})
              </button>
            </div>
          </div>

          {leaveSubTab === "holidays" ? (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Company Holiday Calendar
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {holidays.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#18181B]">{h.name}</p>
                      <p className="text-[11px] text-[#71717A]">{h.description}</p>
                    </div>
                    <span className="font-mono font-bold text-[#0D7A5F] bg-white px-2.5 py-1 rounded border">
                      {formatDateTime(h.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                    <tr>
                      <th className="p-3 font-semibold">Employee</th>
                      <th className="p-3 font-semibold">Leave Type</th>
                      <th className="p-3 font-semibold">Dates (Duration)</th>
                      <th className="p-3 font-semibold">Reason</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {leaveRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-3 font-bold text-[#18181B]">{req.employee?.name}</td>
                        <td className="p-3 font-semibold text-[#0D7A5F]">{req.leaveType?.name}</td>
                        <td className="p-3">
                          <span className="font-mono text-[#18181B]">
                            {formatDateTime(req.startDate)} → {formatDateTime(req.endDate)}
                          </span>
                          <span className="text-[10px] text-[#71717A] block font-bold">
                            {req.daysCount} working days
                          </span>
                        </td>
                        <td className="p-3 text-[#52525B] max-w-xs truncate">{req.reason}</td>
                        <td className="p-3">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="p-3 text-right">
                          {req.status === "Pending" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveLeave(req.id)}
                                className="px-2.5 py-1 text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0A624C] rounded-lg shadow-2xs transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectLeave(req.id)}
                                className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#71717A]">
                              {req.approvedBy ? `By ${req.approvedBy}` : "Processed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ASSETS MANAGEMENT REGISTER                                         */}
      {/* ========================================================================= */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-lg">
              {(["All", "Assigned", "In Storage", "Under Repair"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setAssetSubTab(st)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    assetSubTab === st
                      ? "bg-white text-[#18181B] shadow-2xs font-bold"
                      : "text-[#71717A] hover:text-[#18181B]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                  <tr>
                    <th className="p-3 font-semibold">Asset Tag</th>
                    <th className="p-3 font-semibold">Name & Description</th>
                    <th className="p-3 font-semibold">Category</th>
                    <th className="p-3 font-semibold">Current Possession</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Handover Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {assets.map((ast) => {
                    const currentAssignment = ast.assignments?.[0];
                    return (
                      <tr key={ast.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-3 font-mono font-bold text-[#18181B]">{ast.tag}</td>
                        <td className="p-3 font-bold text-[#18181B]">{ast.name}</td>
                        <td className="p-3 text-[#71717A]">{ast.category}</td>
                        <td className="p-3">
                          {ast.status === "Assigned" && currentAssignment ? (
                            <Link
                              href={`/hrm/employees/${currentAssignment.employee?.id}`}
                              className="font-semibold text-[#0D7A5F] hover:underline block"
                            >
                              {currentAssignment.employee?.name}
                            </Link>
                          ) : (
                            <span className="text-[#71717A]">In Warehouse Storage</span>
                          )}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={ast.status} />
                        </td>
                        <td className="p-3 text-right">
                          {ast.status === "Assigned" ? (
                            <button
                              onClick={() => handleReturnAsset(ast.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Return Asset
                            </button>
                          ) : (
                            <button
                              onClick={() => setAssignTargetAsset(ast)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0D7A5F] hover:bg-[#0A624C] rounded-lg transition inline-flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" />
                              Assign Staff
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RECRUITMENT / ATS (KANBAN PIPELINE & REQUISITIONS)                  */}
      {/* ========================================================================= */}
      {activeTab === "recruitment" && (
        <div className="space-y-4">
          {/* Top Controls & Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[#F4F4F5] p-1 rounded-lg">
                <button
                  onClick={() => setAtsView("pipeline")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    atsView === "pipeline"
                      ? "bg-white text-[#18181B] shadow-2xs font-bold"
                      : "text-[#71717A] hover:text-[#18181B]"
                  }`}
                >
                  Candidate Pipeline (Kanban)
                </button>
                <button
                  onClick={() => setAtsView("requisitions")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    atsView === "requisitions"
                      ? "bg-white text-[#18181B] shadow-2xs font-bold"
                      : "text-[#71717A] hover:text-[#18181B]"
                  }`}
                >
                  Job Requisitions ({requisitions.length})
                </button>
              </div>

              {atsView === "pipeline" && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Requisition Filter */}
                  <select
                    value={selectedRequisitionFilter}
                    onChange={(e) => setSelectedRequisitionFilter(e.target.value)}
                    className="h-8 px-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-medium text-[#18181B] focus:outline-hidden"
                  >
                    <option value="all">All Requisitions ({candidates.length})</option>
                    {requisitions.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.role} ({req.requisitionNumber})
                      </option>
                    ))}
                  </select>

                  {/* Candidate Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search candidate, phone, email..."
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      className="h-8 pl-8 pr-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs placeholder:text-[#71717A] text-[#18181B] focus:outline-hidden w-52 md:w-64"
                    />
                    {candidateSearch && (
                      <button
                        onClick={() => setCandidateSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#71717A] hover:text-[#18181B]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCandidateDefaultStage("Applied");
                  setShowAddCandidateDrawer(true);
                }}
                className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Candidate
              </button>
              <button
                onClick={() => setShowNewRequisitionDrawer(true)}
                className="h-8 px-3 rounded-lg bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#71717A]" />
                Raise Requisition
              </button>
            </div>
          </div>

          {atsView === "requisitions" ? (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                    <tr>
                      <th className="p-3 font-semibold">Req #</th>
                      <th className="p-3 font-semibold">Role Title</th>
                      <th className="p-3 font-semibold">Department</th>
                      <th className="p-3 font-semibold">Headcount</th>
                      <th className="p-3 font-semibold">Candidates</th>
                      <th className="p-3 font-semibold">Justification</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {requisitions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-xs text-[#71717A]">
                          No job requisitions found. Raise a requisition to start hiring.
                        </td>
                      </tr>
                    ) : (
                      requisitions.map((req) => {
                        const reqCandidatesCount = candidates.filter((c) => c.requisitionId === req.id).length;
                        return (
                          <tr key={req.id} className="hover:bg-[#F9FAFB] transition">
                            <td className="p-3 font-mono font-bold text-[#18181B]">{req.requisitionNumber}</td>
                            <td className="p-3 font-bold text-[#18181B]">{req.role}</td>
                            <td className="p-3 text-[#71717A]">{req.department}</td>
                            <td className="p-3 font-mono font-bold">{req.headcount}</td>
                            <td className="p-3">
                              <span
                                onClick={() => {
                                  setSelectedRequisitionFilter(req.id);
                                  setAtsView("pipeline");
                                }}
                                className="inline-flex items-center gap-1 cursor-pointer font-bold text-[#0D7A5F] hover:underline"
                              >
                                {reqCandidatesCount} applicant{reqCandidatesCount === 1 ? "" : "s"}
                              </span>
                            </td>
                            <td className="p-3 text-[#52525B] max-w-xs truncate">{req.reason}</td>
                            <td className="p-3">
                              <StatusBadge status={req.status} />
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {req.status === "Draft" ? (
                                  <button
                                    onClick={() => handleApproveRequisition(req.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0A624C] rounded-lg transition"
                                  >
                                    Approve Requisition
                                  </button>
                                ) : (
                                  <>
                                    <span className="text-[11px] text-emerald-800 font-bold mr-2">
                                      ✓ {req.approvedBy || "Approved"}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setSelectedRequisitionFilter(req.id);
                                        setCandidateDefaultStage("Applied");
                                        setShowAddCandidateDrawer(true);
                                      }}
                                      className="px-2 py-1 text-[11px] font-semibold text-[#0D7A5F] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition inline-flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Add Candidate
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Kanban Pipeline Board */
            (() => {
              const q = candidateSearch.toLowerCase().trim();
              const filteredCandidates = candidates.filter((c) => {
                const matchesReq =
                  selectedRequisitionFilter === "all" || c.requisitionId === selectedRequisitionFilter;
                const matchesSearch =
                  !q ||
                  c.name?.toLowerCase().includes(q) ||
                  c.phone?.toLowerCase().includes(q) ||
                  c.email?.toLowerCase().includes(q) ||
                  c.requisition?.role?.toLowerCase().includes(q);
                return matchesReq && matchesSearch;
              });

              const stages = ["Applied", "Screening", "Interview", "Offer", "Hired"] as const;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
                  {stages.map((stage) => {
                    const stageCandidates = filteredCandidates.filter((c) => c.stage === stage);
                    return (
                      <div
                        key={stage}
                        className="bg-[#F9FAFB] rounded-xl border border-[#EDEDED] p-3 space-y-3 min-h-[460px] flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-[#18181B]">{stage}</span>
                              <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E4E4E7] text-[#71717A]">
                                {stageCandidates.length}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setCandidateDefaultStage(stage);
                                setShowAddCandidateDrawer(true);
                              }}
                              className="w-5 h-5 rounded hover:bg-white text-zinc-500 hover:text-emerald-700 flex items-center justify-center transition border border-transparent hover:border-[#E4E4E7]"
                              title={`Add candidate to ${stage}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {stageCandidates.length === 0 ? (
                              <div className="border border-dashed border-[#D4D4D8] rounded-xl p-4 text-center space-y-2 bg-white/60">
                                <p className="text-[11px] text-[#A1A1AA]">No candidates in {stage}</p>
                                <button
                                  onClick={() => {
                                    setCandidateDefaultStage(stage);
                                    setShowAddCandidateDrawer(true);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-[#0D7A5F] hover:bg-emerald-50 rounded-md border border-[#0D7A5F]/20 transition inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Candidate
                                </button>
                              </div>
                            ) : (
                              stageCandidates.map((cand) => (
                                <div
                                  key={cand.id}
                                  className="bg-white p-3 rounded-xl border border-[#EDEDED] shadow-2xs hover:border-[#0D7A5F]/60 transition space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div>
                                      <Link
                                        href={`/hrm/recruitment/candidates/${cand.id}`}
                                        className="font-bold text-xs text-[#18181B] hover:text-[#0D7A5F] transition"
                                      >
                                        {cand.name}
                                      </Link>
                                      <p className="text-[11px] text-[#71717A] truncate">
                                        {cand.requisition?.role || "General Applicant"}
                                      </p>
                                    </div>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                                      {cand.requisition?.department || "HR"}
                                    </span>
                                  </div>

                                  <div className="text-[10px] text-[#71717A] space-y-0.5 pt-1 border-t border-[#F4F4F5]">
                                    <div className="flex items-center justify-between">
                                      <span>{cand.phone}</span>
                                      {cand.email && <span className="truncate max-w-[110px]">{cand.email}</span>}
                                    </div>
                                    {cand.notes && (
                                      <p className="text-[10px] text-zinc-500 italic line-clamp-1 pt-0.5">
                                        &ldquo;{cand.notes}&rdquo;
                                      </p>
                                    )}
                                  </div>

                                  {/* ATS Stage Transition Actions */}
                                  <div className="pt-2 border-t border-[#F4F4F5] space-y-1.5">
                                    {stage === "Applied" && (
                                      <button
                                        onClick={() => handleUpdateCandidateStage(cand.id, "Screening")}
                                        className="w-full py-1 px-2 rounded-lg bg-zinc-50 hover:bg-emerald-50 text-zinc-700 hover:text-emerald-700 border border-zinc-200 hover:border-emerald-300 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                                      >
                                        Move to Screening →
                                      </button>
                                    )}

                                    {stage === "Screening" && (
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Applied")}
                                          className="py-1 px-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-semibold transition"
                                        >
                                          ← Applied
                                        </button>
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Interview")}
                                          className="py-1 px-1.5 rounded-lg bg-zinc-50 hover:bg-emerald-50 text-zinc-700 hover:text-emerald-700 border border-zinc-200 hover:border-emerald-300 text-[10px] font-semibold transition"
                                        >
                                          Interview →
                                        </button>
                                      </div>
                                    )}

                                    {stage === "Interview" && (
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Screening")}
                                          className="py-1 px-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-semibold transition"
                                        >
                                          ← Screening
                                        </button>
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Offer")}
                                          className="py-1 px-1.5 rounded-lg bg-zinc-50 hover:bg-emerald-50 text-zinc-700 hover:text-emerald-700 border border-zinc-200 hover:border-emerald-300 text-[10px] font-semibold transition"
                                        >
                                          Offer →
                                        </button>
                                      </div>
                                    )}

                                    {stage === "Offer" && (
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Interview")}
                                          className="py-1 px-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-semibold transition"
                                        >
                                          ← Interview
                                        </button>
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Hired")}
                                          className="py-1 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs transition"
                                        >
                                          ✓ Mark Hired
                                        </button>
                                      </div>
                                    )}

                                    {stage === "Hired" && (
                                      <div className="space-y-1.5">
                                        <button
                                          onClick={() => {
                                            setOnboardCandidate({
                                              name: cand.name,
                                              phone: cand.phone,
                                              email: cand.email || "",
                                              role: cand.requisition?.role?.toLowerCase().includes("tech")
                                                ? "technician"
                                                : "sales",
                                              department: cand.requisition?.department || "Operations",
                                              designation: cand.requisition?.role || "Staff",
                                              salary: "6000",
                                            });
                                            setShowAddEmployeeDrawer(true);
                                          }}
                                          className="w-full py-1.5 px-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-[11px] font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                                        >
                                          <UserPlus className="w-3.5 h-3.5" />
                                          Onboard as Employee
                                        </button>
                                        <button
                                          onClick={() => handleUpdateCandidateStage(cand.id, "Offer")}
                                          className="w-full text-center text-[10px] text-zinc-400 hover:text-zinc-600 py-0.5 transition"
                                        >
                                          ← Revert to Offer
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Column footer */}
                        <div className="pt-2 border-t border-[#E4E4E7]/60 text-center">
                          <button
                            onClick={() => {
                              setCandidateDefaultStage(stage);
                              setShowAddCandidateDrawer(true);
                            }}
                            className="text-[11px] text-[#71717A] hover:text-[#0D7A5F] font-medium transition inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add candidate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}



      {/* ========================================================================= */}
      {/* TAB 7: ATTENDANCE & BIOMETRICS & GEOFENCE REVIEW                         */}
      {/* ========================================================================= */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <GeofenceSitesPanel
            employees={employees}
            onZonesChanged={(list) => {
              setZones(list.filter((z) => z.isActive));
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Biometric Verification Simulation Form */}
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#0D7A5F]" />
                Dual-Gate Attendance Simulator
              </h3>
              <form onSubmit={handleCheckIn} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Employee</label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full h-9 px-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Target Geofence Zone</label>
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full h-9 px-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                  >
                    <option value="">Auto-Detect Nearest Active Zone</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} (Radius: {z.radiusMeters}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">Facial Match Score (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={faceScore}
                    onChange={(e) => setFaceScore(Number(e.target.value))}
                    className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">Check-in Lat</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={checkInLat}
                      onChange={(e) => setCheckInLat(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Enter latitude"
                      className="w-full h-9 px-3 font-mono text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">Check-in Lng</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={checkInLng}
                      onChange={(e) => setCheckInLng(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Enter longitude"
                      className="w-full h-9 px-3 font-mono text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAttendance}
                  className="w-full py-2.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold rounded-lg transition"
                >
                  {isSubmittingAttendance ? "Verifying with Geofence..." : "Verify & Punch Attendance"}
                </button>
              </form>

              {attendanceResult && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold space-y-1 ${
                    attendanceResult.status === "accepted"
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : attendanceResult.status === "accepted-but-flagged"
                      ? "bg-amber-50 text-amber-900 border border-amber-200"
                      : "bg-rose-50 text-rose-900 border border-rose-200"
                  }`}
                >
                  <div className="font-bold uppercase tracking-wider">
                    Status: {attendanceResult.status || attendanceResult.result}
                  </div>
                  <div>{attendanceResult.message}</div>
                  {attendanceResult.flagReason && (
                    <div className="text-[11px] text-amber-800 font-normal">
                      <strong>Flag Reason:</strong> {attendanceResult.flagReason}
                    </div>
                  )}
                  {attendanceResult.distanceMeters !== undefined && (
                    <div className="text-[11px] text-[#71717A] font-mono">
                      Distance: {attendanceResult.distanceMeters}m | Within Zone: {attendanceResult.withinGeofence ? "Yes" : "No"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Attendance Audit Log Table & Flagged Review Console */}
            <div className="md:col-span-2 bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAttendanceSubTab("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      attendanceSubTab === "all"
                        ? "bg-[#0D7A5F] text-white shadow-xs"
                        : "bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    All Immutable Logs ({attendanceLogs.length})
                  </button>
                  <button
                    onClick={() => setAttendanceSubTab("flagged")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      attendanceSubTab === "flagged"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Flagged for Review
                    {flaggedCount > 0 && (
                      <span
                        className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                          attendanceSubTab === "flagged"
                            ? "bg-white text-amber-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {flaggedCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {attendanceSubTab === "flagged" && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-[11px] text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    The entries below were automatically flagged by server-side verification (outside geofence, implausible travel speed, or PIN override after face failure).
                  </span>
                </div>
              )}

              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F4F4F5] text-[#71717A] sticky top-0">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Staff</th>
                      <th className="p-3">Zone / GPS</th>
                      {attendanceSubTab === "flagged" ? (
                        <>
                          <th className="p-3">Flag Reason</th>
                          <th className="p-3 text-right">Action</th>
                        </>
                      ) : (
                        <>
                          <th className="p-3">Face</th>
                          <th className="p-3">Liveness</th>
                          <th className="p-3">Geofence</th>
                          <th className="p-3">Outcome</th>
                          <th className="p-3 text-right">Review</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {attendanceLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={attendanceSubTab === "flagged" ? 5 : 8}
                          className="p-8 text-center text-[#71717A]"
                        >
                          {attendanceSubTab === "flagged"
                            ? "No flagged entries requiring review. All punches are within authorized boundaries."
                            : "No attendance records found."}
                        </td>
                      </tr>
                    ) : (
                      attendanceLogs.map((lg) => (
                        <tr key={lg.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 font-mono">{formatDateTime(lg.timestamp)}</td>
                          <td className="p-3">
                            <div className="font-semibold text-[#18181B]">{lg.employee?.name}</div>
                            <div className="text-[10px] text-[#71717A]">{lg.employee?.role || lg.employee?.designation}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-[#18181B]">{lg.geofenceZone?.name || "Nearest Zone"}</div>
                            <div className="text-[10px] text-[#71717A] font-mono">
                              {lg.lat?.toFixed(4)}, {lg.lng?.toFixed(4)}
                            </div>
                          </td>
                          {attendanceSubTab === "flagged" ? (
                            <>
                              <td className="p-3 max-w-[280px]">
                                <div className="p-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[11px] leading-tight">
                                  {lg.flagReason || "Flagged by security heuristics"}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => setResolveTargetLog(lg)}
                                  className="px-2.5 py-1 bg-[#18181B] hover:bg-[#27272A] text-white font-semibold rounded text-[11px] transition shadow-2xs"
                                >
                                  Resolve Flag
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-mono font-bold">
                                {lg.faceMatchScore > 1
                                  ? `${Number(lg.faceMatchScore).toFixed(1)}%`
                                  : `${(Number(lg.faceMatchScore) * 100).toFixed(1)}%`}
                              </td>
                              <td className="p-3 font-mono">
                                {lg.livenessScore != null
                                  ? `${(Number(lg.livenessScore) * 100).toFixed(0)}%`
                                  : "—"}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    lg.withinGeofence
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {lg.withinGeofence ? "INSIDE" : "OUTSIDE"}
                                </span>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    lg.flaggedForReview
                                      ? "bg-amber-100 text-amber-800"
                                      : lg.result === "pass"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {lg.flaggedForReview ? "FLAGGED" : lg.result?.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {lg.flaggedForReview ? (
                                  <button
                                    onClick={() => setResolveTargetLog(lg)}
                                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[10px] transition"
                                  >
                                    Review
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-[#A1A1AA]">Clean</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Resolve Flagged Attendance Modal */}
          {resolveTargetLog && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#E4E4E7]">
                <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-sm text-[#18181B]">Resolve Attendance Flag</h3>
                  </div>
                  <button
                    onClick={() => setResolveTargetLog(null)}
                    className="text-[#71717A] hover:text-[#18181B]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Employee:</span>
                    <span className="font-semibold text-[#18181B]">{resolveTargetLog.employee?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Time:</span>
                    <span className="font-mono text-[#18181B]">{formatDateTime(resolveTargetLog.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">GPS Coordinates:</span>
                    <span className="font-mono text-[#18181B]">{resolveTargetLog.lat}, {resolveTargetLog.lng}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Device ID:</span>
                    <span className="font-mono text-[#18181B]">{resolveTargetLog.deviceId || "N/A"}</span>
                  </div>
                  <div className="pt-1 border-t border-[#E2E8F0]">
                    <span className="text-[#71717A] block mb-0.5">Flag Reason:</span>
                    <span className="text-amber-900 font-semibold">{resolveTargetLog.flagReason}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Administrative Resolution Notes
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="E.g., Employee verified en route to remote site with manager's permission..."
                    className="w-full text-xs p-2.5 border border-[#E4E4E7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                  <button
                    onClick={() => setResolveTargetLog(null)}
                    className="px-3 py-2 text-xs font-semibold text-[#71717A] hover:bg-[#F4F4F5] rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isResolving}
                    onClick={() => handleResolveFlag("dismiss")}
                    className="px-3 py-2 text-xs font-semibold bg-[#F4F4F5] hover:bg-rose-50 text-rose-700 border border-[#E4E4E7] rounded-lg transition"
                  >
                    {isResolving ? "Resolving..." : "Dismiss Flag"}
                  </button>
                  <button
                    disabled={isResolving}
                    onClick={() => handleResolveFlag("approve")}
                    className="px-4 py-2 text-xs font-bold bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg transition shadow-xs"
                  >
                    {isResolving ? "Resolving..." : "Approve & Clear Flag"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: PAYROLL RUNS (DETAILED BREAKDOWN & 3-STAGE WORKFLOW)                */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Payroll Cycles</span>
              <p className="text-base font-bold text-[#18181B] font-mono">{payrollRuns.length}</p>
              <span className="text-[10px] text-[#71717A]">Draft & processed runs</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Active Staff Enrolled</span>
              <p className="text-base font-bold text-[#18181B] font-mono">{employees.length}</p>
              <span className="text-[10px] text-[#71717A]">Eligible for salary payout</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Pending Approval</span>
              <p className="text-base font-bold text-amber-700 font-mono">
                {payrollRuns.filter((r) => r.status === "Draft").length}
              </p>
              <span className="text-[10px] text-[#71717A]">Draft cycles awaiting signoff</span>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Disbursed (YTD)</span>
              <p className="text-base font-bold text-[#0D7A5F] font-mono">
                {formatCurrency(
                  payrollRuns
                    .filter((r) => r.status === "Paid")
                    .reduce((acc, curr) => acc + Number(curr.totalNet || 0), 0)
                )}
              </p>
              <span className="text-[10px] text-emerald-700">Processed via WPS transfers</span>
            </div>
          </div>

          {/* Cycles Table Card */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Monthly Payroll Cycles (Draft → Approved → Paid)
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Click on any cycle or &ldquo;View Breakdown&rdquo; to inspect individual employee compensation, attendance records, and payslips.
                </p>
              </div>

              <button
                onClick={() => setShowCreatePayrollDrawer(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Generate Monthly Draft
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                  <tr>
                    <th className="p-3 font-semibold">Payroll Period</th>
                    <th className="p-3 font-semibold">Staff Count</th>
                    <th className="p-3 font-semibold">Gross Salary</th>
                    <th className="p-3 font-semibold">Advances Recovered</th>
                    <th className="p-3 font-semibold">Net Payout</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {payrollRuns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-[#18181B]">No payroll cycles generated yet</p>
                        <p className="text-[11px] text-[#71717A] max-w-sm mx-auto">
                          Click below to preview employee attendance, advances, and generate your first monthly payroll draft.
                        </p>
                        <button
                          onClick={() => setShowCreatePayrollDrawer(true)}
                          className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Generate First Payroll Draft
                        </button>
                      </td>
                    </tr>
                  ) : (
                    payrollRuns.map((r) => {
                      const staffCount = r.payslips?.length || 0;
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-[#F9FAFB] transition cursor-pointer"
                          onClick={() => setSelectedPayrollRunForDetail(r)}
                        >
                          <td className="p-3">
                            <span className="font-bold text-[#18181B] text-xs hover:text-[#0D7A5F] transition">
                              {r.period}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#71717A] bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                              <Users className="w-3 h-3 text-[#71717A]" />
                              {staffCount} staff
                            </span>
                          </td>
                          <td className="p-3 font-mono">{formatCurrency(r.totalGross)}</td>
                          <td className="p-3 font-mono text-rose-600">
                            {r.totalDeductions > 0 ? `-${formatCurrency(r.totalDeductions)}` : "PKR 0"}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{formatCurrency(r.totalNet)}</td>
                          <td className="p-3">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedPayrollRunForDetail(r)}
                                className="px-2.5 py-1 bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B] rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition shadow-2xs hover:border-[#0D7A5F]"
                              >
                                <Eye className="w-3 h-3 text-[#0D7A5F]" />
                                View Breakdown
                              </button>

                              {r.status === "Draft" ? (
                                <button
                                  onClick={() => handleApprovePayroll(r.id)}
                                  className="px-2.5 py-1 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-bold transition shadow-2xs"
                                >
                                  Approve
                                </button>
                              ) : r.status === "Approved" ? (
                                <button
                                  onClick={() => handleDisbursePayroll(r.id)}
                                  className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-2xs inline-flex items-center gap-1"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  Disburse via WPS
                                </button>
                              ) : (
                                <span className="text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Disbursed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 9: STAFF ADVANCES LEDGER & DISBURSEMENTS                              */}
      {/* ========================================================================= */}
      {activeTab === "advances" && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          {(() => {
            const activeAdvances = advances.filter((a) => a.status === "approved");
            const recoveredAdvances = advances.filter((a) => a.status === "recovered");
            const totalOutstanding = activeAdvances.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
            const totalRecovered = recoveredAdvances.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
            const uniqueStaffCount = new Set(activeAdvances.map((a) => a.employeeId)).size;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
                    Outstanding Advances
                  </span>
                  <p className="text-base font-bold text-amber-700 font-mono">{formatCurrency(totalOutstanding)}</p>
                  <span className="text-[10px] text-[#71717A]">{uniqueStaffCount} staff with active balance</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
                    Total Advances Recovered
                  </span>
                  <p className="text-base font-bold text-[#0D7A5F] font-mono">{formatCurrency(totalRecovered)}</p>
                  <span className="text-[10px] text-[#71717A]">Recovered via payroll deductions</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E7] shadow-2xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
                    Total Advances Recorded
                  </span>
                  <p className="text-base font-bold text-[#18181B] font-mono">{advances.length}</p>
                  <span className="text-[10px] text-[#71717A]">Ledger entries on Account 1120</span>
                </div>
              </div>
            );
          })()}

          {/* Advances Ledger Table */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Staff Salary Advance Ledger
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Staff advances are automatically debited to Account 1120 (Employee Advances Receivable) and recovered in monthly payroll runs.
                </p>
              </div>

              <button
                onClick={() => {
                  if (employees.length > 0 && !advanceEmpId) setAdvanceEmpId(employees[0].id);
                  setShowAdvanceModal(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Issue Staff Advance
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                  <tr>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Employee</th>
                    <th className="p-3 font-semibold">Department</th>
                    <th className="p-3 font-semibold">Advance Amount</th>
                    <th className="p-3 font-semibold">Reason / Purpose</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-[#18181B]">No salary advances recorded</p>
                        <p className="text-[11px] text-[#71717A] max-w-sm mx-auto">
                          Disburse staff advances safely with automated accounting entries and monthly payroll deduction tracking.
                        </p>
                        <button
                          onClick={() => {
                            if (employees.length > 0 && !advanceEmpId) setAdvanceEmpId(employees[0].id);
                            setShowAdvanceModal(true);
                          }}
                          className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Issue First Advance
                        </button>
                      </td>
                    </tr>
                  ) : (
                    advances.map((adv) => (
                      <tr key={adv.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-3 font-mono text-[#71717A]">{formatDateTime(adv.createdAt)}</td>
                        <td className="p-3">
                          <p className="font-bold text-[#18181B]">{adv.employee?.name || "Staff"}</p>
                          <p className="text-[10px] text-[#71717A]">{adv.employee?.designation || adv.employee?.role}</p>
                        </td>
                        <td className="p-3 text-[#71717A]">{adv.employee?.department || "Operations"}</td>
                        <td className="p-3 font-mono font-bold text-amber-700">{formatCurrency(adv.amount)}</td>
                        <td className="p-3 text-[#52525B] max-w-xs truncate">{adv.notes || "Salary advance"}</td>
                        <td className="p-3">
                          <StatusBadge status={adv.status} />
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-[11px] font-semibold text-[#18181B]">
                            {adv.approvedBy || "Admin"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 10: EMPLOYEE SELF-SERVICE (ESS) PORTAL                                */}
      {/* ========================================================================= */}
      {activeTab === "ess" && (
        <div className="space-y-6">
          {/* Employee Switcher */}
          <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#18181B]">Simulating Logged-in Staff:</span>
              <select
                value={essEmployeeId}
                onChange={(e) => setEssEmployeeId(e.target.value)}
                className="h-8 px-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs font-semibold"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.designation || e.role})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-[#0D7A5F] font-bold">Personal Self-Service View</span>
          </div>

          {essEmployee && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile & Leave Balances */}
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center font-bold text-base">
                      {essEmployee.name[0]}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#18181B]">{essEmployee.name}</h2>
                      <p className="text-xs text-[#71717A]">{essEmployee.designation || essEmployee.role}</p>
                      <StatusBadge status={essEmployee.status} />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#E4E4E7] text-xs space-y-1">
                    <p><span className="text-[#71717A]">Phone:</span> {essEmployee.phone}</p>
                    <p><span className="text-[#71717A]">Email:</span> {essEmployee.email || "N/A"}</p>
                    <p><span className="text-[#71717A]">Reporting Manager:</span> {essEmployee.reportingManager?.name || "Direct"}</p>
                  </div>
                </div>

                {/* My Leave Balances */}
                <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      My Leave Balances
                    </h3>
                    <button
                      onClick={() => setShowLeaveDrawer(true)}
                      className="text-xs text-[#0D7A5F] font-bold hover:underline"
                    >
                      + Request
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {essEmployee.leaveBalances?.map((lb: any) => (
                      <div key={lb.id} className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-center text-xs">
                        <span className="text-[10px] text-[#71717A] block">{lb.leaveType?.name}</span>
                        <span className="text-base font-bold font-mono text-[#0D7A5F]">{lb.balance}</span>
                        <span className="text-[9px] text-[#71717A] block">days left</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* My Assigned Assets & Payslips */}
              <div className="md:col-span-2 space-y-6">
                {/* My Assigned Assets */}
                <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    My Assigned Company Assets & Tools ({essEmployee.assetAssignments?.length || 0})
                  </h3>
                  {essEmployee.assetAssignments && essEmployee.assetAssignments.length > 0 ? (
                    <div className="space-y-2">
                      {essEmployee.assetAssignments.map((a: any) => (
                        <div key={a.id} className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-[#18181B]">{a.asset?.tag}</span>
                            <p className="font-semibold text-[#18181B]">{a.asset?.name}</p>
                            <p className="text-[11px] text-[#71717A]">{a.conditionNotes}</p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            In My Care
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#71717A]">No company assets assigned.</p>
                  )}
                </div>

                {/* My Payslips */}
                <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    My Recent Payslips ({essEmployee.payslips?.length || 0})
                  </h3>
                  {essEmployee.payslips && essEmployee.payslips.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#F4F4F5] text-[#71717A]">
                          <tr>
                            <th className="p-2.5">Period</th>
                            <th className="p-2.5">Gross</th>
                            <th className="p-2.5">Net Disbursed</th>
                            <th className="p-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E7]">
                          {essEmployee.payslips.map((ps: any) => (
                            <tr key={ps.id}>
                              <td className="p-2.5 font-bold">{ps.payrollRun?.period}</td>
                              <td className="p-2.5 font-mono">{formatCurrency(ps.grossSalary)}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">{formatCurrency(ps.netSalary)}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {ps.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-[#71717A]">No payslips generated yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAWERS & MODALS */}
      <AddEmployeeDrawer
        isOpen={showAddEmployeeDrawer}
        onClose={() => {
          setShowAddEmployeeDrawer(false);
          setOnboardCandidate(null);
        }}
        managers={employees}
        initialValues={onboardCandidate || undefined}
        onEmployeeAdded={() => {
          setNotification("Employee created successfully.");
          setOnboardCandidate(null);
          loadData();
        }}
      />

      <LeaveRequestDrawer
        isOpen={showLeaveDrawer}
        onClose={() => setShowLeaveDrawer(false)}
        employees={employees}
        leaveTypes={leaveTypes}
        defaultEmployeeId={activeTab === "ess" ? essEmployeeId : undefined}
        onLeaveRequested={() => {
          setNotification("Leave application submitted.");
          loadData();
        }}
      />

      <AddAssetDrawer
        isOpen={showAddAssetDrawer}
        onClose={() => setShowAddAssetDrawer(false)}
        onAssetAdded={() => {
          setNotification("Asset registered.");
          loadData();
        }}
      />

      {assignTargetAsset && (
        <AssignAssetDrawer
          isOpen={!!assignTargetAsset}
          onClose={() => setAssignTargetAsset(null)}
          asset={assignTargetAsset}
          employees={employees}
          onAssetAssigned={() => {
            setNotification("Asset assigned.");
            setAssignTargetAsset(null);
            loadData();
          }}
        />
      )}

      <NewRequisitionDrawer
        isOpen={showNewRequisitionDrawer}
        onClose={() => setShowNewRequisitionDrawer(false)}
        onRequisitionCreated={() => {
          setNotification("Requisition raised.");
          loadData();
        }}
      />

      <AddCandidateDrawer
        isOpen={showAddCandidateDrawer}
        onClose={() => setShowAddCandidateDrawer(false)}
        requisitions={requisitions}
        defaultStage={candidateDefaultStage}
        onCandidateAdded={() => {
          setNotification("Candidate profile added to pipeline.");
          loadData();
        }}
      />

      <CreatePayrollDrawer
        isOpen={showCreatePayrollDrawer}
        onClose={() => setShowCreatePayrollDrawer(false)}
        employees={employees}
        existingRuns={payrollRuns}
        onRunCreated={(newRun) => {
          setNotification(`Draft payroll cycle for ${newRun.period} generated!`);
          loadData();
          setSelectedPayrollRunForDetail(newRun);
        }}
      />

      {selectedPayrollRunForDetail && (
        <PayrollRunDetailDrawer
          isOpen={!!selectedPayrollRunForDetail}
          onClose={() => setSelectedPayrollRunForDetail(null)}
          run={selectedPayrollRunForDetail}
          onApprove={handleApprovePayroll}
          onDisburse={handleDisbursePayroll}
          onDeleteDraft={handleDeleteDraftPayroll}
          onViewPayslip={(payslip, run) => {
            setSelectedPayslipForModal({ payslip, run });
          }}
        />
      )}

      {selectedPayslipForModal && (
        <PayslipModal
          isOpen={!!selectedPayslipForModal}
          onClose={() => setSelectedPayslipForModal(null)}
          payslip={selectedPayslipForModal.payslip}
          payrollRun={selectedPayslipForModal.run}
        />
      )}



      {/* Staff Advance Modal */}
      <IssueAdvanceDrawer
        isOpen={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        employees={employees}
        defaultEmployeeId={advanceEmpId}
        onAdvanceIssued={() => {
          setNotification("Salary advance issued! Advance ledger debited.");
          loadData();
        }}
      />
    </div>
  );
}

export default function HrmPayrollPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading HRM & Workforce...</span>
        </div>
      }
    >
      <HrmPayrollContent />
    </Suspense>
  );
}

