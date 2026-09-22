"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Package,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronLeft,
  ArrowRight,
  Plus,
  Check,
  LifeBuoy,
  FileText,
  UserX,
  Send,
  Smartphone,
  KeyRound,
  Copy,
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<
    "overview" | "employment" | "related" | "onboarding" | "offboarding" | "mobile_access"
  >("overview");

  // Notification
  const [notification, setNotification] = useState("");

  // Mobile App Login State
  const [mobileActionLoading, setMobileActionLoading] = useState(false);
  const [mobileActionError, setMobileActionError] = useState<string | null>(null);
  const [oneTimePin, setOneTimePin] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);

  // Edit / Status update modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState("Active");

  // Exit interview form states
  const [exitReason, setExitReason] = useState("Relocation / Better Opportunity");
  const [exitFeedback, setExitFeedback] = useState("");
  const [rehireEligible, setRehireEligible] = useState(true);

  // Final settlement calculation states
  const [proRatedSalary, setProRatedSalary] = useState("3200");
  const [leaveEncashmentDays, setLeaveEncashmentDays] = useState("5");
  const [dailyRate, setDailyRate] = useState("200");
  const [advanceDeduction, setAdvanceDeduction] = useState("500");
  const [expenseAdjustment, setExpenseAdjustment] = useState("0");
  const [disbursingAccount, setDisbursingAccount] = useState("1010");
  const [isSettling, setIsSettling] = useState(false);

  async function loadEmployee() {
    try {
      setLoading(true);
      const res = await fetch(`/api/hrm/employees/${employeeId}`);
      if (!res.ok) throw new Error("Employee not found");
      const data = await res.json();
      setEmployee(data.employee);
      setTargetStatus(data.employee.status || "Active");
      if (data.employee.salary) {
        const dRate = Math.round(data.employee.salary / 30);
        setDailyRate(String(dRate));
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (employeeId) loadEmployee();
  }, [employeeId]);

  // Mobile App Credentials Lifecycle Handlers
  const handleCreateMobileLogin = async () => {
    try {
      setMobileActionLoading(true);
      setMobileActionError(null);
      const res = await fetch(`/api/employees/${employeeId}/mobile-login/create`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create mobile login");
      }
      setOneTimePin(data.tempPin);
      setShowPinModal(true);
      setNotification("Mobile app credentials provisioned successfully.");
      await loadEmployee();
    } catch (err: any) {
      setMobileActionError(err.message);
    } finally {
      setMobileActionLoading(false);
    }
  };

  const handleResetMobilePin = async () => {
    try {
      setMobileActionLoading(true);
      setMobileActionError(null);
      const res = await fetch(`/api/employees/${employeeId}/mobile-login/reset-pin`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset mobile PIN");
      }
      setOneTimePin(data.tempPin);
      setShowPinModal(true);
      setNotification("Mobile PIN reset successfully.");
      await loadEmployee();
    } catch (err: any) {
      setMobileActionError(err.message);
    } finally {
      setMobileActionLoading(false);
    }
  };

  const handleDeactivateMobileLogin = async () => {
    try {
      setMobileActionLoading(true);
      setMobileActionError(null);
      const res = await fetch(`/api/employees/${employeeId}/mobile-login/deactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to deactivate mobile access");
      }
      setNotification("Mobile access deactivated. Any active tokens have been invalidated.");
      await loadEmployee();
    } catch (err: any) {
      setMobileActionError(err.message);
    } finally {
      setMobileActionLoading(false);
    }
  };

  const handleReactivateMobileLogin = async () => {
    try {
      setMobileActionLoading(true);
      setMobileActionError(null);
      const res = await fetch(`/api/employees/${employeeId}/mobile-login/reactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate mobile access");
      }
      setNotification("Mobile access reactivated successfully.");
      await loadEmployee();
    } catch (err: any) {
      setMobileActionError(err.message);
    } finally {
      setMobileActionLoading(false);
    }
  };

  const copyPinToClipboard = async () => {
    if (!oneTimePin) return;
    try {
      await navigator.clipboard.writeText(oneTimePin);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const dismissPinModal = () => {
    setOneTimePin(null);
    setShowPinModal(false);
    setPinCopied(false);
  };

  // Toggle Onboarding Item
  const handleToggleOnboarding = async (itemId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/hrm/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          itemId,
          isDone: !currentStatus,
        }),
      });
      if (res.ok) {
        setNotification("Onboarding item updated.");
        loadEmployee();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Offboarding Item
  const handleToggleOffboarding = async (itemId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/hrm/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          itemId,
          isDone: !currentStatus,
        }),
      });
      if (res.ok) {
        setNotification("Offboarding checklist item updated.");
        loadEmployee();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update Employee Lifecycle Status
  const handleUpdateStatus = async () => {
    try {
      const res = await fetch(`/api/hrm/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          active: targetStatus !== "Inactive" && targetStatus !== "Terminated",
        }),
      });
      if (res.ok) {
        // If moved to Resigning or Terminated, seed offboarding checklist
        if (targetStatus === "Resigning" || targetStatus === "Terminated") {
          await fetch("/api/hrm/offboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "seed",
              employeeId,
            }),
          });
        }
        setShowStatusModal(false);
        setNotification(`Employee status updated to ${targetStatus}.`);
        loadEmployee();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Submit Exit Interview
  const handleSubmitExitInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/hrm/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exit_interview",
          employeeId,
          reason: exitReason,
          feedback: exitFeedback,
          rehireEligible,
        }),
      });
      if (res.ok) {
        setNotification("Exit interview recorded successfully.");
        loadEmployee();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Submit Final Settlement (Double-Entry via AccountsPostingService)
  const handlePostFinalSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !confirm(
        "Post final exit settlement? This will execute double-entry journal vouchers through AccountsPostingService and mark the employee Inactive."
      )
    ) {
      return;
    }

    try {
      setIsSettling(true);
      const res = await fetch("/api/hrm/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "final_settlement",
          employeeId,
          proRatedSalary: Number(proRatedSalary),
          leaveEncashmentDays: Number(leaveEncashmentDays),
          dailyRate: Number(dailyRate),
          advanceDeduction: Number(advanceDeduction),
          expenseAdjustment: Number(expenseAdjustment),
          disbursingAccountCode: disbursingAccount,
          settledBy: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setNotification("Final settlement posted successfully via Accounts Engine! Employee set to Inactive.");
      loadEmployee();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSettling(false);
    }
  };

  if (loading || !employee) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-xs text-[#71717A]">
        Loading employee profile master...
      </div>
    );
  }

  const initials = employee.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isOffboardingActive =
    employee.status === "Resigning" ||
    employee.status === "Terminated" ||
    employee.status === "Inactive";

  // Compute settlement live preview
  const grossCalc = Number(proRatedSalary) + Number(leaveEncashmentDays) * Number(dailyRate);
  const netCalc = Math.max(0, grossCalc - Number(advanceDeduction) + Number(expenseAdjustment));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "HRM & Payroll", href: "/hrm" },
          { label: "Employees", href: "/hrm?tab=employees" },
          { label: employee.name },
        ]}
        title={employee.name}
        subtitle={`${employee.designation || employee.role} • ${employee.department} Department`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStatusModal(true)}
              className="h-8 px-3 rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
            >
              <User className="w-3.5 h-3.5 text-[#71717A]" />
              Manage Status ({employee.status})
            </button>
            <Link
              href="/hrm"
              className="h-8 px-3 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to HRM
            </Link>
          </div>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            onClick={() => setNotification("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Master Summary Card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-[#18181B]">{employee.name}</h1>
                <StatusBadge status={employee.status} />
                {employee.probationStatus === "On Probation" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    ⏳ On Probation
                  </span>
                )}
                {employee.probationStatus === "Confirmed" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    ✓ Confirmed Staff
                  </span>
                )}
              </div>
              <p className="text-xs text-[#71717A] mt-0.5">
                {employee.designation || employee.role} • {employee.employmentType} • Joined {formatDateTime(employee.joinDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-[#E4E4E7] pt-3 md:pt-0 md:pl-6 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#71717A] block tracking-wider">
                Monthly Salary
              </span>
              <span className="font-mono font-bold text-sm text-[#18181B]">
                {formatCurrency(employee.salary || 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#71717A] block tracking-wider">
                Reporting Manager
              </span>
              <span className="font-semibold text-xs text-[#18181B]">
                {employee.reportingManager ? employee.reportingManager.name : "None (Executive)"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#71717A] block tracking-wider">
                Biometric Enrolled
              </span>
              <span className={`font-semibold text-xs ${employee.faceEnrolled ? "text-[#0D7A5F]" : "text-amber-700"}`}>
                {employee.faceEnrolled
                  ? `✓ Active (v${employee.faceEnrollmentCount || 1}${employee.faceEnrolledAt ? ` • ${formatDateTime(employee.faceEnrolledAt)}` : ""})`
                  : "Pending Enrollment"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#71717A] block tracking-wider">
                Mobile App Access
              </span>
              <span
                className={`font-semibold text-xs ${
                  employee.lockedUntil && new Date(employee.lockedUntil) > new Date()
                    ? "text-rose-600 font-bold"
                    : employee.mobileLoginActive
                    ? "text-[#0D7A5F]"
                    : employee.mobilePinSetAt
                    ? "text-zinc-600"
                    : "text-amber-700"
                }`}
              >
                {employee.lockedUntil && new Date(employee.lockedUntil) > new Date()
                  ? "⚠ Locked Out"
                  : employee.mobileLoginActive
                  ? "✓ Active Access"
                  : employee.mobilePinSetAt
                  ? "✕ Deactivated"
                  : "Not Provisioned"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Left Vertical Section Nav + Right Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Vertical Section Nav */}
        <div className="space-y-1 bg-white p-2 rounded-xl border border-[#E4E4E7] shadow-xs h-fit">
          <button
            onClick={() => setActiveSection("overview")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
              activeSection === "overview"
                ? "bg-[#0D7A5F] text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            }`}
          >
            <span className="flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Personal & Contact Info
            </span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </button>

          <button
            onClick={() => setActiveSection("mobile_access")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
              activeSection === "mobile_access"
                ? "bg-[#0D7A5F] text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            }`}
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" />
              Mobile App Access
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                employee.lockedUntil && new Date(employee.lockedUntil) > new Date()
                  ? "bg-rose-100 text-rose-800"
                  : employee.mobileLoginActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {employee.lockedUntil && new Date(employee.lockedUntil) > new Date()
                ? "Locked"
                : employee.mobileLoginActive
                ? "Active"
                : "Off"}
            </span>
          </button>

          <button
            onClick={() => setActiveSection("employment")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
              activeSection === "employment"
                ? "bg-[#0D7A5F] text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            }`}
          >
            <span className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              Employment Details
            </span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </button>

          <button
            onClick={() => setActiveSection("related")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
              activeSection === "related"
                ? "bg-[#0D7A5F] text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            }`}
          >
            <span className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              Related Hub (Leave, Assets, Payslips)
            </span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </button>

          <button
            onClick={() => setActiveSection("onboarding")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
              activeSection === "onboarding"
                ? "bg-[#0D7A5F] text-white"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            }`}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Onboarding Checklist
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10">
              {employee.onboardingChecklists?.filter((i: any) => i.isDone).length || 0}/
              {employee.onboardingChecklists?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveSection("offboarding")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
              activeSection === "offboarding"
                ? "bg-rose-700 text-white"
                : isOffboardingActive
                ? "text-rose-700 bg-rose-50 hover:bg-rose-100"
                : "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]"
            }`}
          >
            <span className="flex items-center gap-2">
              <UserX className="w-3.5 h-3.5" />
              Offboarding & Final Settlement
            </span>
            {isOffboardingActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Right Detail Panel */}
        <div className="md:col-span-3 space-y-6">
          {/* SECTION 1: PERSONAL & CONTACT */}
          {activeSection === "overview" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#18181B] pb-2 border-b border-[#E4E4E7] flex items-center gap-2">
                <User className="w-4 h-4 text-[#0D7A5F]" />
                Personal & Contact Profile
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#71717A] block">Full Legal Name</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{employee.name}</p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Employee ID (System UUID)</span>
                  <p className="font-mono text-[#71717A] text-[11px] mt-0.5">{employee.id}</p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Primary Mobile Phone</span>
                  <p className="font-semibold text-[#18181B] mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    {employee.phone}
                  </p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Corporate Email Address</span>
                  <p className="font-semibold text-[#18181B] mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    {employee.email || "No email provisioned"}
                  </p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Current Status</span>
                  <div className="mt-1">
                    <StatusBadge status={employee.status} />
                  </div>
                </div>
                <div>
                  <span className="text-[#71717A] block">Date Created in ERP</span>
                  <p className="font-mono text-[#18181B] mt-0.5">{formatDateTime(employee.createdAt)}</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: MOBILE APP ACCESS & CREDENTIALS */}
          {(activeSection === "overview" || activeSection === "mobile_access") && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E4E4E7] gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#0D7A5F]" />
                    Mobile App Access & Security Lifecycle
                  </h2>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Manage mobile credentials, one-time temporary PIN provisioning, brute-force lockouts, and access authorization.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {employee.lockedUntil && new Date(employee.lockedUntil) > new Date() ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      Locked Out
                    </span>
                  ) : employee.mobileLoginActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Active Access
                    </span>
                  ) : employee.mobilePinSetAt ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      <UserX className="w-3.5 h-3.5 text-zinc-500" />
                      Deactivated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Not Provisioned
                    </span>
                  )}
                </div>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block tracking-wider">
                    Provisioning Status
                  </span>
                  <p className="font-semibold text-[#18181B] mt-1 text-sm flex items-center gap-1.5">
                    {employee.mobileLoginActive ? (
                      <span className="text-emerald-700 font-bold">Enabled & Active</span>
                    ) : employee.mobilePinSetAt ? (
                      <span className="text-zinc-600">Access Suspended</span>
                    ) : (
                      <span className="text-amber-700">No Mobile Account</span>
                    )}
                  </p>
                  <span className="text-[10px] text-[#94A3B8] block mt-1">
                    {employee.mobilePinSetAt
                      ? `Credentials updated ${formatDateTime(employee.mobilePinSetAt)}`
                      : "Never provisioned"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block tracking-wider">
                    PIN Status & Force Reset
                  </span>
                  <p className="font-semibold text-[#18181B] mt-1 text-sm">
                    {employee.mustResetPinOnNextLogin ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                        Forced Reset Required
                      </span>
                    ) : employee.mobilePinSetAt ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        PIN Configured by User
                      </span>
                    ) : (
                      <span className="text-zinc-500">Unprovisioned</span>
                    )}
                  </p>
                  <span className="text-[10px] text-[#94A3B8] block mt-1">
                    {employee.mustResetPinOnNextLogin
                      ? "User will be prompted to set personal PIN on next login"
                      : employee.mobilePinSetAt
                      ? "PIN active with no pending reset"
                      : "Must provision account first"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block tracking-wider">
                    Brute-Force & Lockout
                  </span>
                  <p className="font-semibold text-[#18181B] mt-1 text-sm">
                    {employee.lockedUntil && new Date(employee.lockedUntil) > new Date() ? (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                        Locked out ({formatDateTime(employee.lockedUntil)})
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                        Clean ({employee.failedLoginAttempts || 0}/5 failed)
                      </span>
                    )}
                  </p>
                  <span className="text-[10px] text-[#94A3B8] block mt-1">
                    {employee.failedLoginAttempts > 0
                      ? `${employee.failedLoginAttempts} unsuccesful attempt(s) recorded`
                      : "Zero recent authentication failures"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#F1F5F9]">
                {!employee.mobileLoginActive && !employee.mobilePinSetAt ? (
                  <button
                    type="button"
                    disabled={mobileActionLoading}
                    onClick={handleCreateMobileLogin}
                    className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {mobileActionLoading ? "Provisioning..." : "Provision Mobile Access"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={mobileActionLoading}
                      onClick={handleResetMobilePin}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {mobileActionLoading ? "Generating PIN..." : "Reset Mobile PIN"}
                    </button>

                    {employee.mobileLoginActive ? (
                      <button
                        type="button"
                        disabled={mobileActionLoading}
                        onClick={handleDeactivateMobileLogin}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                        {mobileActionLoading ? "Updating..." : "Deactivate Mobile Access"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={mobileActionLoading}
                        onClick={handleReactivateMobileLogin}
                        className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                        {mobileActionLoading ? "Updating..." : "Reactivate Mobile Access"}
                      </button>
                    )}
                  </>
                )}

                {mobileActionError && (
                  <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {mobileActionError}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: EMPLOYMENT DETAILS */}
          {activeSection === "employment" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#18181B] pb-2 border-b border-[#E4E4E7] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#0D7A5F]" />
                Employment & Organizational Positioning
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#71717A] block">Job Title / Designation</span>
                  <p className="font-bold text-[#18181B] mt-0.5">{employee.designation || employee.role}</p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Department</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{employee.department}</p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Employment Classification</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">{employee.employmentType}</p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Official Join Date</span>
                  <p className="font-mono text-[#18181B] mt-0.5">{formatDateTime(employee.joinDate)}</p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Reporting Line Manager</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">
                    {employee.reportingManager ? (
                      <span className="text-[#0D7A5F] font-bold">
                        {employee.reportingManager.name} ({employee.reportingManager.designation || employee.reportingManager.role})
                      </span>
                    ) : (
                      "None (Reports directly to Board/Executive)"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[#71717A] block">Probation Status & End Date</span>
                  <p className="font-semibold text-[#18181B] mt-0.5">
                    {employee.probationStatus === "On Probation" ? (
                      <span className="text-amber-800">
                        Ending {employee.probationEndDate ? formatDateTime(employee.probationEndDate) : "N/A"}
                      </span>
                    ) : (
                      <span className="text-emerald-700">Permanent Confirmed Employee</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Direct Reports Sub-table */}
              <div className="pt-4 border-t border-[#E4E4E7]">
                <h3 className="text-xs font-bold text-[#18181B] mb-2 uppercase tracking-wider">
                  Direct Reports Under This Manager ({employee.directReports?.length || 0})
                </h3>
                {employee.directReports && employee.directReports.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {employee.directReports.map((r: any) => (
                      <Link
                        key={r.id}
                        href={`/hrm/employees/${r.id}`}
                        className="p-2.5 bg-[#F9FAFB] hover:bg-[#F4F4F5] rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <p className="font-bold text-[#18181B]">{r.name}</p>
                          <p className="text-[11px] text-[#71717A]">{r.designation} • {r.department}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A]">No direct reports assigned.</p>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: RELATED HUB (LEAVE BALANCES, ASSET ASSIGNMENTS, PAYROLL HISTORY) */}
          {activeSection === "related" && (
            <div className="space-y-6">
              {/* Leave Balances Card */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0D7A5F]" />
                    Leave Balances & Accrual
                  </h2>
                  <Link
                    href="/hrm?tab=leave"
                    className="text-xs text-[#0D7A5F] hover:underline font-semibold"
                  >
                    View Leave Module →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {employee.leaveBalances?.map((lb: any) => (
                    <div
                      key={lb.id}
                      className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] text-center"
                    >
                      <span className="text-[10px] font-bold text-[#71717A] block uppercase">
                        {lb.leaveType?.name}
                      </span>
                      <span className="text-xl font-bold font-mono text-[#0D7A5F] block my-0.5">
                        {lb.balance}
                      </span>
                      <span className="text-[10px] text-[#71717A]">
                        {lb.taken} taken of {lb.accrued} total
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned Company Assets */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#0D7A5F]" />
                    Assigned Company Assets & Instruments
                  </h2>
                  <Link
                    href="/hrm?tab=assets"
                    className="text-xs text-[#0D7A5F] hover:underline font-semibold"
                  >
                    Asset Register →
                  </Link>
                </div>

                {employee.assetAssignments && employee.assetAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {employee.assetAssignments.map((asgn: any) => (
                      <div
                        key={asgn.id}
                        className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#18181B]">
                              {asgn.asset?.tag}
                            </span>
                            <span className="font-semibold text-[#18181B]">
                              {asgn.asset?.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#71717A] mt-0.5">
                            Category: {asgn.asset?.category} • Notes: {asgn.conditionNotes}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#71717A] block">
                            Assigned {formatDateTime(asgn.assignedAt)}
                          </span>
                          <span className="text-[10px] font-bold text-[#0D7A5F]">
                            {asgn.returnedAt ? "Returned" : "Active Possession"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A]">No company assets currently assigned to this employee.</p>
                )}
              </div>

              {/* Payslip History */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#0D7A5F]" />
                    Payroll Payslip History
                  </h2>
                  <Link
                    href="/hrm?tab=payroll"
                    className="text-xs text-[#0D7A5F] hover:underline font-semibold"
                  >
                    Payroll Center →
                  </Link>
                </div>

                {employee.payslips && employee.payslips.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F4F4F5] text-[#71717A] border-b">
                        <tr>
                          <th className="p-2.5">Period</th>
                          <th className="p-2.5">Gross</th>
                          <th className="p-2.5">Advance Deduction</th>
                          <th className="p-2.5">Net Disbursed</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {employee.payslips.map((ps: any) => (
                          <tr key={ps.id}>
                            <td className="p-2.5 font-bold">{ps.payrollRun?.period || "Period"}</td>
                            <td className="p-2.5 font-mono">{formatCurrency(ps.grossSalary)}</td>
                            <td className="p-2.5 font-mono text-rose-600">-{formatCurrency(ps.advanceDeduction)}</td>
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
                  <p className="text-xs text-[#71717A]">No historical payslips generated yet.</p>
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: ONBOARDING CHECKLIST */}
          {activeSection === "onboarding" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                <div>
                  <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                    New Hire Onboarding Checklist
                  </h2>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Track statutory compliance, equipment handover, induction, and account creation
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#0D7A5F] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {employee.onboardingChecklists?.filter((i: any) => i.isDone).length || 0} /{" "}
                  {employee.onboardingChecklists?.length || 0} Tasks Completed
                </span>
              </div>

              <div className="space-y-2">
                {employee.onboardingChecklists?.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleOnboarding(item.id, item.isDone)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                      item.isDone
                        ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                        : "bg-[#F9FAFB] hover:bg-[#F4F4F5] border-[#EDEDED] text-[#18181B]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          item.isDone
                            ? "bg-[#0D7A5F] border-[#0D7A5F] text-white"
                            : "border-[#D4D4D8] bg-white"
                        }`}
                      >
                        {item.isDone && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <p className={`font-semibold ${item.isDone ? "line-through opacity-80" : ""}`}>
                          {item.item}
                        </p>
                        <p className="text-[11px] text-[#71717A]">Responsible Owner: {item.owner}</p>
                      </div>
                    </div>

                    <div className="text-right text-[10px]">
                      {item.isDone ? (
                        <span className="text-emerald-700 font-bold">
                          ✓ Done {formatDateTime(item.completedAt)}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pending Action
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5: OFFBOARDING & FINAL SETTLEMENT */}
          {activeSection === "offboarding" && (
            <div className="space-y-6">
              {/* Offboarding Checklist */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <div>
                    <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                      <UserX className="w-4 h-4 text-rose-600" />
                      Employee Exit & Clearance Checklist
                    </h2>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      Verify asset return, email access deactivation, and exit formalities
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    {employee.offboardingChecklists?.filter((i: any) => i.isDone).length || 0} /{" "}
                    {employee.offboardingChecklists?.length || 0} Cleared
                  </span>
                </div>

                <div className="space-y-2">
                  {employee.offboardingChecklists && employee.offboardingChecklists.length > 0 ? (
                    employee.offboardingChecklists.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleOffboarding(item.id, item.isDone)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                          item.isDone
                            ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                            : "bg-[#F9FAFB] hover:bg-[#F4F4F5] border-[#EDEDED] text-[#18181B]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                              item.isDone
                                ? "bg-[#0D7A5F] border-[#0D7A5F] text-white"
                                : "border-[#D4D4D8] bg-white"
                            }`}
                          >
                            {item.isDone && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className={`font-semibold ${item.isDone ? "line-through opacity-80" : ""}`}>
                              {item.item}
                            </p>
                            <p className="text-[11px] text-[#71717A]">Sign-Off Owner: {item.owner}</p>
                          </div>
                        </div>

                        <div className="text-right text-[10px]">
                          {item.isDone ? (
                            <span className="text-emerald-700 font-bold">
                              ✓ Cleared {formatDateTime(item.completedAt)}
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Pending Sign-off
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                      <span>Checklist not initialized yet. Change status to Resigning or Terminated to activate.</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/hrm/offboarding", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "seed", employeeId }),
                          });
                          loadEmployee();
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition"
                      >
                        Seed Checklist Now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Exit Interview Form */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-[#18181B] pb-2 border-b border-[#E4E4E7] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D7A5F]" />
                  Exit Interview Form
                </h2>

                {employee.exitInterview ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                    <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Exit Interview Completed
                    </p>
                    <p className="text-emerald-900">
                      <span className="font-semibold">Reason:</span> {employee.exitInterview.reason}
                    </p>
                    <p className="text-emerald-900">
                      <span className="font-semibold">Feedback / Notes:</span> {employee.exitInterview.feedback}
                    </p>
                    <p className="text-emerald-900">
                      <span className="font-semibold">Rehire Eligible:</span>{" "}
                      {employee.exitInterview.rehireEligible ? "Yes" : "No"}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitExitInterview} className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-[#18181B] block mb-1">
                        Reason for Leaving *
                      </label>
                      <input
                        type="text"
                        required
                        value={exitReason}
                        onChange={(e) => setExitReason(e.target.value)}
                        placeholder="e.g. Higher compensation offer / Family relocation"
                        className="w-full h-9 px-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B]"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#18181B] block mb-1">
                        Exit Feedback & Suggestions *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={exitFeedback}
                        onChange={(e) => setExitFeedback(e.target.value)}
                        placeholder="Feedback on tools, fleet vans, management support, or process improvement..."
                        className="w-full p-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rehire"
                        checked={rehireEligible}
                        onChange={(e) => setRehireEligible(e.target.checked)}
                        className="rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F]"
                      />
                      <label htmlFor="rehire" className="font-semibold text-[#18181B]">
                        Eligible for Future Rehire
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#18181B] hover:bg-black text-white rounded-lg font-bold transition"
                    >
                      Save Exit Interview
                    </button>
                  </form>
                )}
              </div>

              {/* Final Settlement Calculation (GAAP Balanced Posting) */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                  <div>
                    <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
                      Final Settlement Payout (Accounts Posting Engine)
                    </h2>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      Pro-rated salary + leave encashment − advance recovery posted as double-entry journal voucher
                    </p>
                  </div>
                </div>

                {employee.finalSettlements && employee.finalSettlements.length > 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                    <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Final Settlement Completed & Posted!
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                      <div>Gross: {formatCurrency(employee.finalSettlements[0].grossAmount)}</div>
                      <div>Deductions: -{formatCurrency(employee.finalSettlements[0].advanceDeduction)}</div>
                      <div className="font-bold text-emerald-800">
                        Net Paid: {formatCurrency(employee.finalSettlements[0].netAmount)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePostFinalSettlement} className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="font-semibold text-[#18181B] block mb-1">
                          Pro-Rated Salary ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={proRatedSalary}
                          onChange={(e) => setProRatedSalary(e.target.value)}
                          className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-[#18181B] block mb-1">
                          Leave Encashment (Days)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={leaveEncashmentDays}
                          onChange={(e) => setLeaveEncashmentDays(e.target.value)}
                          className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-[#18181B] block mb-1">
                          Daily Rate ($/day)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={dailyRate}
                          onChange={(e) => setDailyRate(e.target.value)}
                          className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-[#18181B] block mb-1">
                          Advance Recovery ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={advanceDeduction}
                          onChange={(e) => setAdvanceDeduction(e.target.value)}
                          className="w-full h-9 px-3 font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-rose-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-[#18181B] block mb-1">
                          Disbursing Account (Chart of Accounts)
                        </label>
                        <select
                          value={disbursingAccount}
                          onChange={(e) => setDisbursingAccount(e.target.value)}
                          className="w-full h-9 px-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg font-mono text-xs"
                        >
                          <option value="1010">1010 - Corporate Operating Bank Account (WPS Transfer)</option>
                          <option value="1000">1000 - Main Cash Drawer</option>
                        </select>
                      </div>

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                            Calculated Net Payout
                          </span>
                          <span className="text-lg font-bold font-mono text-emerald-800">
                            {formatCurrency(netCalc)}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#71717A]">
                          Gross: ${grossCalc} | Ded: ${advanceDeduction}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSettling}
                      className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs transition disabled:opacity-50"
                    >
                      {isSettling ? "Posting Settlement Journal..." : "Disburse Final Settlement & Mark Inactive"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lifecycle Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#EDEDED] text-xs">
            <h3 className="text-sm font-bold text-[#18181B]">Update Employee Lifecycle Status</h3>
            <p className="text-[#71717A]">
              Moving to <strong>Resigning</strong> or <strong>Terminated</strong> initiates the formal Offboarding checklist and asset return clearance.
            </p>

            <div>
              <label className="font-semibold text-[#18181B] block mb-1">Select Status</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full h-9 px-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-xs"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Resigning">Resigning (Exit in progress)</option>
                <option value="Terminated">Terminated (Exit in progress)</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDEDED]">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-Time Temporary PIN Modal */}
      {showPinModal && oneTimePin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-zinc-200 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#0D7A5F] flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Temporary Mobile PIN Generated</h3>
                <p className="text-zinc-500 text-xs">One-time provisioning credential for {employee?.name}</p>
              </div>
            </div>

            <div className="bg-zinc-950 text-white rounded-xl p-5 text-center border border-zinc-800 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                One-Time Temporary PIN
              </span>
              <div className="text-3xl font-mono font-extrabold tracking-widest text-emerald-400 select-all py-1">
                {oneTimePin}
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Employee will be forced to configure their own PIN upon next login.
              </span>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Security Notice:</strong> This PIN is displayed only once and will <strong>never</strong> be shown again or stored in plaintext. Copy it and transmit it securely to the employee.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={copyPinToClipboard}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold rounded-xl text-xs flex items-center gap-2 transition"
              >
                {pinCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy PIN
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={dismissPinModal}
                className="px-5 py-2.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
