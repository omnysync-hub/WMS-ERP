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
import GeofenceSitesPanel from "@/components/hrm/GeofenceSitesPanel";
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
} from "lucide-react";

function HrmPayrollContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<
    | "analytics"
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

  // Tab: Grievances
  const [grievanceSubTab, setGrievanceSubTab] = useState<"all" | "open" | "resolved">("open");
  const [grievances, setGrievances] = useState<any[]>([]);
  const [showRaiseGrievanceDrawer, setShowRaiseGrievanceDrawer] = useState(false);

  // Tab: ESS (Logged-in employee simulation: Ali Hassan)
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
  const [checkInLat, setCheckInLat] = useState(25.2048);
  const [checkInLng, setCheckInLng] = useState(55.2708);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any>(null);

  // Existing Payroll States
  const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceEmpId, setAdvanceEmpId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
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
      } else if (activeTab === "payroll" || activeTab === "advances") {
        const res = await fetch("/api/hrm/payroll");
        const data = await res.json();
        if (data.runs) setPayrollRuns(data.runs);
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
          approverName: "Haris Qureshi (Executive Director)",
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
          approverName: "Haris Qureshi (Executive Director)",
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
          approverName: "Haris Qureshi (Managing Director)",
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

  // Handle Attendance Verification Check-in
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
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
          deviceId: "admin-simulator-browser",
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
          resolvedBy: "HR Administrator",
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
          period: "September 2026",
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
          approverName: "Haris Qureshi (Executive Director)",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotification("Payroll approved! Ready for finance payout disbursement.");
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
          action: "pay",
          runId,
          paymentMethod: "WPS_BANK_TRANSFER",
          disbursedBy: "Fatima Noor (Accountant)",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotification("Payroll disbursed and posted through Accounts Posting Engine!");
      loadData();
    } catch (e: any) {
      alert(e.message);
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
          reason: "Emergency salary advance",
          approvedBy: "Haris Qureshi (HR Director)",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowAdvanceModal(false);
      setAdvanceAmount("");
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
            <button
              onClick={() => setShowNewRequisitionDrawer(true)}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Raise Requisition
            </button>
          ) : activeTab === "payroll" ? (
            <button
              onClick={handleCalculatePayroll}
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

      {/* ========================================================================= */}
      {/* TAB 1: HR ANALYTICS DASHBOARD (ROLE-AWARE KPI WIDGETS)                     */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
                Total Headcount
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold font-mono text-[#18181B]">
                  {analytics?.headcount?.total || 0}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {analytics?.headcount?.active || 0} Active
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-2">
                {analytics?.headcount?.onLeave || 0} currently on approved leave
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
                Attrition / Turnover Rate
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold font-mono text-emerald-700">
                  {analytics?.turnoverRate || 0}%
                </span>
                <span className="text-xs font-semibold text-[#71717A]">Target: &lt; 5%</span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-2">Calculated from offboarded records</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
                Open Requisitions (ATS)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold font-mono text-[#0D7A5F]">
                  {analytics?.openRequisitions || 0}
                </span>
                <Link href="/hrm?tab=recruitment" className="text-xs text-[#0D7A5F] hover:underline font-semibold">
                  View Pipeline →
                </Link>
              </div>
              <p className="text-[11px] text-[#71717A] mt-2">Approved roles currently in hiring</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
                Departments & Units
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold font-mono text-[#18181B]">
                  6 Active
                </span>
                <span className="text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Operations & Mgmt
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-2">Field Ops, Accounts, HR, QA, Stores, Maint</p>
            </div>
          </div>

          {/* Department Breakdown & Probation Ending Soon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center justify-between">
                <span>Headcount By Department</span>
                <span className="text-[10px] font-mono text-[#71717A]">Workforce Allocation</span>
              </h3>
              <div className="space-y-2">
                {analytics?.headcount?.byDepartment?.map((d: any) => (
                  <div
                    key={d.department}
                    className="flex items-center justify-between p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-xs"
                  >
                    <span className="font-semibold text-[#18181B]">{d.department}</span>
                    <span className="font-mono font-bold text-[#0D7A5F] bg-white px-2.5 py-0.5 rounded border">
                      {d.count} staff
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center justify-between">
                <span>Probation Ending Soon (&lt; 30 Days)</span>
                <span className="text-[10px] font-mono text-amber-700 font-bold">Review Required</span>
              </h3>
              {analytics?.probationEndingSoon && analytics.probationEndingSoon.length > 0 ? (
                <div className="space-y-2">
                  {analytics.probationEndingSoon.map((emp: any) => (
                    <Link
                      key={emp.id}
                      href={`/hrm/employees/${emp.id}`}
                      className="flex items-center justify-between p-2.5 bg-amber-50/50 hover:bg-amber-50 rounded-lg border border-amber-200 text-xs transition"
                    >
                      <div>
                        <p className="font-bold text-[#18181B]">{emp.name}</p>
                        <p className="text-[11px] text-[#71717A]">{emp.designation} • {emp.department}</p>
                      </div>
                      <span className="text-[10px] font-mono text-amber-900 font-bold bg-white px-2 py-0.5 rounded border border-amber-200">
                        Ends {formatDateTime(emp.probationEndDate)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#71717A] p-4 text-center">No probation reviews pending in the next 30 days.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EMPLOYEES TABLE & ORG CHART VIEW                                   */}
      {/* ========================================================================= */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Sub-view switcher: Table vs Org Chart */}
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

            <button
              onClick={() => setIsOrgChartOpen(!isOrgChartOpen)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition ${
                isOrgChartOpen
                  ? "bg-[#18181B] text-white border-[#18181B]"
                  : "bg-white text-[#18181B] border-[#E4E4E7] hover:bg-[#F4F4F5]"
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              {isOrgChartOpen ? "Show Dense Table" : "View Org Hierarchy"}
            </button>
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
                    {employees.map((emp) => {
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
                    })}
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
                Annual Company Public & Islamic Holidays (2026)
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#F4F4F5] p-1 rounded-lg">
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
                      <th className="p-3 font-semibold">Justification</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {requisitions.map((req) => (
                      <tr key={req.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-3 font-mono font-bold text-[#18181B]">{req.requisitionNumber}</td>
                        <td className="p-3 font-bold text-[#18181B]">{req.role}</td>
                        <td className="p-3 text-[#71717A]">{req.department}</td>
                        <td className="p-3 font-mono font-bold">{req.headcount}</td>
                        <td className="p-3 text-[#52525B] max-w-xs truncate">{req.reason}</td>
                        <td className="p-3">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="p-3 text-right">
                          {req.status === "Draft" ? (
                            <button
                              onClick={() => handleApproveRequisition(req.id)}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-[#0D7A5F] hover:bg-[#0A624C] rounded-lg transition"
                            >
                              Approve Requisition
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-800 font-bold">
                              ✓ {req.approvedBy || "Approved"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Kanban Pipeline Board */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {(["Applied", "Screening", "Interview", "Offer", "Hired"] as const).map((stage) => {
                const stageCandidates = candidates.filter((c) => c.stage === stage);
                return (
                  <div
                    key={stage}
                    className="bg-[#F9FAFB] rounded-xl border border-[#EDEDED] p-3 space-y-3 min-h-[400px]"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                      <span className="font-bold text-xs text-[#18181B]">{stage}</span>
                      <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border text-[#71717A]">
                        {stageCandidates.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {stageCandidates.map((cand) => (
                        <Link
                          key={cand.id}
                          href={`/hrm/recruitment/candidates/${cand.id}`}
                          className="block bg-white p-3 rounded-lg border border-[#EDEDED] shadow-2xs hover:border-[#0D7A5F] transition space-y-1.5"
                        >
                          <p className="font-bold text-xs text-[#18181B]">{cand.name}</p>
                          <p className="text-[11px] text-[#71717A] truncate">
                            {cand.requisition?.role || "Applicant"}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-[#71717A] pt-1 border-t border-[#F4F4F5]">
                            <span>{cand.phone}</span>
                            <span className="text-[#0D7A5F] font-bold">View →</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
                      onChange={(e) => setCheckInLat(Number(e.target.value))}
                      className="w-full h-9 px-3 font-mono text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">Check-in Lng</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={checkInLng}
                      onChange={(e) => setCheckInLng(Number(e.target.value))}
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
      {/* TAB 8: PAYROLL RUNS (3-STAGE WORKFLOW PRESERVED)                           */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Monthly Payroll Cycles (Draft → Approved → Paid)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
                <tr>
                  <th className="p-3 font-semibold">Payroll Period</th>
                  <th className="p-3 font-semibold">Gross Salary</th>
                  <th className="p-3 font-semibold">Advances Recovered</th>
                  <th className="p-3 font-semibold">Net Payout</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Workflow Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {payrollRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F9FAFB] transition">
                    <td className="p-3 font-bold text-[#18181B]">{r.period}</td>
                    <td className="p-3 font-mono">{formatCurrency(r.totalGross)}</td>
                    <td className="p-3 font-mono text-rose-600">-{formatCurrency(r.totalDeductions)}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">{formatCurrency(r.totalNet)}</td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 text-right">
                      {r.status === "Draft" ? (
                        <button
                          onClick={() => handleApprovePayroll(r.id)}
                          className="px-3 py-1 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-bold transition"
                        >
                          Approve Payroll
                        </button>
                      ) : r.status === "Approved" ? (
                        <button
                          onClick={() => handleDisbursePayroll(r.id)}
                          className="px-3 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition"
                        >
                          Disburse via WPS
                        </button>
                      ) : (
                        <span className="text-emerald-800 font-bold text-xs">✓ Disbursed & Posted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 9: STAFF ADVANCES (PRESERVED)                                         */}
      {/* ========================================================================= */}
      {activeTab === "advances" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Staff Salary Advance Ledger
            </h3>
            <button
              onClick={() => setShowAdvanceModal(true)}
              className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold"
            >
              + Issue Advance
            </button>
          </div>
          <p className="text-xs text-[#71717A]">
            Staff advances are automatically debited to Account 1120 (Employee Advances Receivable) and recovered in the next monthly payroll run.
          </p>
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
        onClose={() => setShowAddEmployeeDrawer(false)}
        managers={employees}
        onEmployeeAdded={() => {
          setNotification("Employee created successfully.");
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



      {/* Staff Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#EDEDED] text-xs">
            <h3 className="text-sm font-bold text-[#18181B]">Issue Staff Salary Advance</h3>
            <form onSubmit={handleIssueAdvance} className="space-y-3">
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">Employee</label>
                <select
                  value={advanceEmpId}
                  onChange={(e) => setAdvanceEmpId(e.target.value)}
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
                <label className="font-semibold text-[#18181B] block mb-1">Advance Amount ($)</label>
                <input
                  type="number"
                  required
                  min="50"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdvance}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {isSubmittingAdvance ? "Processing..." : "Confirm Advance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

