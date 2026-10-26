"use client";

import React, { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  User,
  ShieldCheck,
  Package,
  Wrench,
  Truck,
  Laptop,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  Building,
  Briefcase,
  FileText,
  Clock,
  AlertCircle,
  RefreshCw,
  Box,
} from "lucide-react";
import toast from "@/lib/toast";

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"assets" | "leaves" | "payslips">("assets");

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hrm/my-profile");
      if (!res.ok) {
        throw new Error("Failed to load employee profile");
      }
      const data = await res.json();
      setEmployee(data.employee);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load profile details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const assetAssignments = Array.isArray(employee?.assetAssignments) ? employee.assetAssignments : [];
  const activeAssets = assetAssignments.filter((a: any) => !a.returnedAt);
  const returnedAssets = assetAssignments.filter((a: any) => Boolean(a.returnedAt));

  const getCategoryIcon = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("vehicle") || cat.includes("truck") || cat.includes("van") || cat.includes("bike") || cat.includes("car")) {
      return <Truck className="w-5 h-5 text-blue-600" />;
    }
    if (cat.includes("laptop") || cat.includes("it") || cat.includes("computer") || cat.includes("phone") || cat.includes("mobile")) {
      return <Laptop className="w-5 h-5 text-indigo-600" />;
    }
    if (cat.includes("gauge") || cat.includes("manifold") || cat.includes("pump") || cat.includes("vacuum") || cat.includes("meter") || cat.includes("tool") || cat.includes("wrench")) {
      return <Wrench className="w-5 h-5 text-amber-600" />;
    }
    return <Box className="w-5 h-5 text-emerald-600" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Employee Profile & Assets" },
        ]}
        title="My Profile & Assigned Assets"
        subtitle="View your company equipment custody, personnel records, and workplace entitlements."
        actions={
          <button
            onClick={fetchProfile}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F9FAFB] text-[#18181B] transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="bg-white border border-[#EDEDED] rounded-2xl p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#71717A] font-medium">Loading your profile and assigned equipment...</p>
        </div>
      ) : !employee ? (
        <div className="bg-white border border-[#EDEDED] rounded-2xl p-12 text-center shadow-xs space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-[#18181B]">No Profile Record Found</h3>
          <p className="text-xs text-[#71717A] max-w-sm mx-auto">
            Your login account is not currently linked to an active employee record. Please contact the system administrator or HR.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Identity & Personnel Card */}
          <div className="bg-white border border-[#EDEDED] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#EDEDED]">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#0D7A5F] text-white flex items-center justify-center text-2xl font-black shadow-sm shrink-0">
                  {employee.name?.charAt(0) || "E"}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-[#18181B]">{employee.name}</h2>
                    <span className="text-[11px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {employee.status || "Active"}
                    </span>
                  </div>
                  <p className="text-sm text-[#71717A] mt-0.5">
                    {employee.designation || employee.role || "Employee"} · {employee.department || "General"}
                  </p>
                </div>
              </div>

              {/* Quick Custody Stat Badges */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider block">
                    Active Assets
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    {activeAssets.length}
                  </span>
                </div>
                <div className="px-4 py-2.5 bg-[#F9FAFB] border border-[#EDEDED] rounded-xl text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider block">
                    Total Issued
                  </span>
                  <span className="text-lg font-black text-[#18181B]">
                    {assetAssignments.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Meta Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-5 text-xs">
              <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <Phone className="w-4 h-4 text-[#71717A] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-[#71717A] block">Phone Contact</span>
                  <span className="font-semibold text-[#18181B] truncate block">{employee.phone || "—"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <Mail className="w-4 h-4 text-[#71717A] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-[#71717A] block">Email Address</span>
                  <span className="font-semibold text-[#18181B] truncate block">{employee.email || "—"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <Building className="w-4 h-4 text-[#71717A] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-[#71717A] block">Department & Role</span>
                  <span className="font-semibold text-[#18181B] truncate block">{employee.department} ({employee.role})</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <Briefcase className="w-4 h-4 text-[#71717A] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-[#71717A] block">Employee ID</span>
                  <span className="font-mono font-bold text-[#18181B] truncate block">{employee.id?.slice(0, 8)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#EDEDED] pb-px">
            <button
              onClick={() => setActiveTab("assets")}
              className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px ${
                activeTab === "assets"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Assigned Equipment & Assets</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "assets" ? "bg-emerald-100 text-emerald-800" : "bg-[#F4F4F5] text-[#71717A]"
              }`}>
                {activeAssets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("leaves")}
              className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px ${
                activeTab === "leaves"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Leave Entitlements</span>
            </button>

            <button
              onClick={() => setActiveTab("payslips")}
              className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px ${
                activeTab === "payslips"
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Payslips</span>
            </button>
          </div>

          {/* TAB 1: ASSIGNED ASSETS */}
          {activeTab === "assets" && (
            <div className="space-y-6">
              {/* Active Custody Section */}
              <div className="bg-white border border-[#EDEDED] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#18181B]">Active Equipment in Your Custody</h3>
                    <p className="text-xs text-[#71717A]">
                      Tools, testing gauges, vehicles, and electronics currently assigned to you for field operations.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    {activeAssets.length} Assigned Items
                  </span>
                </div>

                {activeAssets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {activeAssets.map((a: any) => {
                      const cat = a.asset?.category || "Equipment";
                      return (
                        <div
                          key={a.id}
                          className="bg-white rounded-xl border border-[#EDEDED] p-4.5 shadow-xs hover:border-[#0D7A5F] transition space-y-3.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-[#F9FAFB] border border-[#EDEDED] flex items-center justify-center shrink-0">
                                  {getCategoryIcon(cat)}
                                </div>
                                <div>
                                  <span className="font-mono text-[10px] font-bold text-[#71717A] block">
                                    {a.asset?.tag || "—"}
                                  </span>
                                  <h4 className="text-sm font-bold text-[#18181B] leading-tight">
                                    {a.asset?.name || "Equipment"}
                                  </h4>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Active
                              </span>
                            </div>

                            <p className="text-xs text-[#71717A] mt-2 font-medium">
                              Category: <strong className="text-[#18181B]">{cat}</strong>
                            </p>

                            <div className="mt-3 p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-[#71717A]">Handover Date:</span>
                                <span className="font-semibold text-[#18181B]">
                                  {a.assignedAt ? formatDateTime(a.assignedAt) : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#71717A]">Assigned By:</span>
                                <span className="font-semibold text-[#18181B]">{a.assignedBy || "Storekeeper"}</span>
                              </div>
                              {a.conditionNotes && (
                                <div className="pt-1 border-t border-[#EDEDED]">
                                  <span className="text-[#71717A] text-[10px] block">Condition Notes:</span>
                                  <span className="text-[#3F3F46] font-medium italic">
                                    "{a.conditionNotes}"
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#F4F4F5] flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> In Field Custody
                            </span>
                            <span className="text-[#71717A] text-[10px]">
                              Safe upkeep required
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-10 border border-dashed border-[#EDEDED] rounded-xl text-center space-y-2">
                    <Box className="w-10 h-10 text-[#A1A1AA] mx-auto" />
                    <h4 className="text-sm font-bold text-[#18181B]">No Equipment Currently Assigned</h4>
                    <p className="text-xs text-[#71717A] max-w-md mx-auto">
                      You do not have any company tools, vehicles, or instruments checked out in your custody. If equipment was recently issued to you, please check with the warehouse storekeeper.
                    </p>
                  </div>
                )}
              </div>

              {/* Past Returned History */}
              {returnedAssets.length > 0 && (
                <div className="bg-white border border-[#EDEDED] rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[#18181B]">Handover & Returned History</h3>
                    <p className="text-xs text-[#71717A]">
                      Equipment previously assigned to you and returned back to company inventory.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F9FAFB] text-[#71717A] uppercase text-[10px] font-bold border-y border-[#EDEDED]">
                        <tr>
                          <th className="py-2.5 px-3">Asset Tag</th>
                          <th className="py-2.5 px-3">Equipment Name</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Issued Date</th>
                          <th className="py-2.5 px-3">Returned Date</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDEDED]">
                        {returnedAssets.map((a: any) => (
                          <tr key={a.id} className="hover:bg-[#F9FAFB]">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#18181B]">{a.asset?.tag}</td>
                            <td className="py-2.5 px-3 font-semibold text-[#18181B]">{a.asset?.name}</td>
                            <td className="py-2.5 px-3 text-[#71717A]">{a.asset?.category}</td>
                            <td className="py-2.5 px-3 text-[#71717A]">{formatDateTime(a.assignedAt)}</td>
                            <td className="py-2.5 px-3 text-[#71717A]">{a.returnedAt ? formatDateTime(a.returnedAt) : "—"}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                                Returned
                              </span>
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

          {/* TAB 2: LEAVE ENTITLEMENTS */}
          {activeTab === "leaves" && (
            <div className="bg-white border border-[#EDEDED] rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#18181B]">Leave Entitlements & Balances</h3>
                <p className="text-xs text-[#71717A]">
                  Track your available annual, sick, and casual leave quotas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {employee.leaveBalances && employee.leaveBalances.length > 0 ? (
                  employee.leaveBalances.map((lb: any) => (
                    <div key={lb.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-1">
                      <span className="text-xs text-[#71717A] font-bold block">{lb.leaveType?.name || "Leave"}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-[#0D7A5F]">{lb.balance}</span>
                        <span className="text-xs text-[#71717A]">days available</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#71717A] col-span-3">No leave entitlement quotas configured.</p>
                )}
              </div>

              <div className="pt-4 border-t border-[#EDEDED] space-y-3">
                <h4 className="text-sm font-bold text-[#18181B]">Recent Leave Requests</h4>
                {employee.leaveRequests && employee.leaveRequests.length > 0 ? (
                  <div className="space-y-2">
                    {employee.leaveRequests.map((req: any) => (
                      <div key={req.id} className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[#18181B]">{req.leaveType?.name || "Leave Request"}</p>
                          <p className="text-[11px] text-[#71717A]">
                            {formatDateTime(req.startDate)} · {req.daysCount} days
                          </p>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A]">No leave requests logged.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYSLIPS */}
          {activeTab === "payslips" && (
            <div className="bg-white border border-[#EDEDED] rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#18181B]">Monthly Payslips</h3>
                <p className="text-xs text-[#71717A]">
                  Official monthly salary statements issued to you.
                </p>
              </div>

              {employee.payslips && employee.payslips.length > 0 ? (
                <div className="space-y-2.5">
                  {employee.payslips.map((ps: any) => (
                    <div
                      key={ps.id}
                      className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-[#18181B]">{ps.payrollRun?.period || "Payroll Period"}</p>
                        <p className="text-[11px] text-[#71717A]">
                          Gross: {formatCurrency(ps.grossSalary)} · Deductions: {formatCurrency(ps.deductions || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-base text-emerald-700 block">
                          {formatCurrency(ps.netSalary)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {ps.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#71717A]">No payslips issued yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
