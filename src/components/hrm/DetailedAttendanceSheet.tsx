"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  LogOut,
  LogIn,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AttendanceRecord {
  employee: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
    department: string;
    designation: string;
    faceEnrolled: boolean;
  };
  dutyStatus: "Available & Ready" | "On Job" | "Checked Out" | "Absent" | "On Leave";
  isCheckedIn: boolean;
  firstCheckIn: {
    id: string;
    timestamp: string;
    timeStr: string;
    type: "CHECK_IN";
    zoneName: string;
    withinGeofence: boolean;
    faceMatchScore: number;
    livenessScore: number | null;
    flaggedForReview: boolean;
    flagReason: string | null;
    notes: string | null;
  } | null;
  lastCheckOut: {
    id: string;
    timestamp: string;
    timeStr: string;
    type: "CHECK_OUT";
    zoneName: string;
    withinGeofence: boolean;
    faceMatchScore: number;
    livenessScore: number | null;
    flaggedForReview: boolean;
    flagReason: string | null;
    notes: string | null;
  } | null;
  hoursWorkedMinutes: number;
  hoursWorkedFormatted: string;
  punchesCount: number;
  punches: Array<{
    id: string;
    timestamp: string;
    timeStr: string;
    type: "CHECK_IN" | "CHECK_OUT";
    zoneName: string;
    withinGeofence: boolean;
    faceMatchScore: number;
    flaggedForReview: boolean;
    flagReason: string | null;
    notes: string | null;
  }>;
  hasFlag: boolean;
  activeJob: {
    id: string;
    jobNumber: string;
    title: string;
  } | null;
}

interface SummaryData {
  date: string;
  isToday: boolean;
  totalEmployees: number;
  availableAndReady: number;
  onJob: number;
  checkedOut: number;
  absent: number;
  flaggedCount: number;
}

export default function DetailedAttendanceSheet() {
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectRecord, setInspectRecord] = useState<AttendanceRecord | null>(null);

  const fetchSheet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        date: selectedDate,
        ...(departmentFilter !== "all" ? { department: departmentFilter } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
      });

      const res = await fetch(`/api/hrm/attendance-sheet?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to load attendance sheet");
      }
      const data = await res.json();
      setRecords(data.records || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, departmentFilter, searchQuery]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  // Date stepper handlers
  const handlePrevDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + 1);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setSelectedDate(getTodayStr());
  };

  // Filter records by status locally for instantaneous filtering
  const filteredRecords = records.filter((rec) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "available") return rec.dutyStatus === "Available & Ready";
    if (statusFilter === "on_job") return rec.dutyStatus === "On Job";
    if (statusFilter === "checked_out") return rec.dutyStatus === "Checked Out";
    if (statusFilter === "absent") return rec.dutyStatus === "Absent";
    if (statusFilter === "flagged") return rec.hasFlag;
    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Designation",
      "Role",
      "Phone",
      "Date",
      "Duty Status",
      "First Check-In",
      "Check-In Site",
      "Last Check-Out",
      "Check-Out Site",
      "Hours Logged",
      "Total Punches",
      "Flagged",
    ];

    const rows = records.map((r) => [
      r.employee.id,
      `"${r.employee.name}"`,
      r.employee.department,
      `"${r.employee.designation}"`,
      r.employee.role,
      r.employee.phone,
      selectedDate,
      `"${r.dutyStatus}"`,
      r.firstCheckIn ? r.firstCheckIn.timeStr : "N/A",
      r.firstCheckIn ? `"${r.firstCheckIn.zoneName}"` : "N/A",
      r.lastCheckOut ? r.lastCheckOut.timeStr : "N/A",
      r.lastCheckOut ? `"${r.lastCheckOut.zoneName}"` : "N/A",
      r.hoursWorkedFormatted,
      r.punchesCount,
      r.hasFlag ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Workman_Attendance_Sheet_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const departments = [
    "all",
    "Operations",
    "Accounts",
    "HR",
    "Maintenance",
    "Sales",
    "Management",
  ];

  return (
    <div className="space-y-6">
      {/* Top Filter & Date Selector Header */}
      <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Selector Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#F4F4F5] p-1 rounded-xl border border-[#E4E4E7]">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 hover:bg-white rounded-lg text-zinc-700 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-3">
                <Calendar className="w-4 h-4 text-[#0D7A5F]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-bold text-xs text-zinc-900 border-none outline-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={handleNextDay}
                className="p-1.5 hover:bg-white rounded-lg text-zinc-700 transition"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                selectedDate === getTodayStr()
                  ? "bg-[#0D7A5F] text-white border-[#0D7A5F]"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              Today
            </button>
          </div>

          {/* Action buttons (Export, Refresh) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={records.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              Export CSV Sheet
            </button>
            <button
              type="button"
              onClick={fetchSheet}
              disabled={loading}
              className="p-2 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 rounded-lg text-xs transition"
              title="Refresh Attendance Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0D7A5F]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter bar: Department, Status, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-100 text-xs">
          {/* Department Filter */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#EDEDED]">
            <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-500 font-medium">Dept:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 border-none outline-none w-full cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "all" ? "All Departments" : d}
                </option>
              ))}
            </select>
          </div>

          {/* Status Quick Filter */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#EDEDED]">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-500 font-medium">Duty:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 border-none outline-none w-full cursor-pointer"
            >
              <option value="all">All Duty Statuses</option>
              <option value="available">🟢 Available & Ready</option>
              <option value="on_job">🔵 On Active Job</option>
              <option value="checked_out">🟠 Checked Out (Shift Finished)</option>
              <option value="absent">⚪ Absent / Not Checked In</option>
              <option value="flagged">🚨 Flagged Punches</option>
            </select>
          </div>

          {/* Staff Search */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#EDEDED]">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search staff by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent font-medium text-zinc-900 placeholder:text-zinc-400 border-none outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Metric KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
              Total Roster
            </span>
            <span className="text-xl font-bold font-mono text-zinc-900 mt-1 block">
              {summary.totalEmployees}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">Active Personnel</span>
          </div>

          <div
            onClick={() => setStatusFilter("available")}
            className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 shadow-xs cursor-pointer hover:bg-emerald-50 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                Available & Ready
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
              {summary.availableAndReady}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">
              Ready for dispatch
            </span>
          </div>

          <div
            onClick={() => setStatusFilter("on_job")}
            className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 shadow-xs cursor-pointer hover:bg-blue-50 transition"
          >
            <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">
              On Active Job
            </span>
            <span className="text-xl font-bold font-mono text-blue-700 mt-1 block">
              {summary.onJob}
            </span>
            <span className="text-[10px] text-blue-700 font-medium mt-0.5 block">
              Performing work
            </span>
          </div>

          <div
            onClick={() => setStatusFilter("checked_out")}
            className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 shadow-xs cursor-pointer hover:bg-amber-50 transition"
          >
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
              Checked Out
            </span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">
              {summary.checkedOut}
            </span>
            <span className="text-[10px] text-amber-700 font-medium mt-0.5 block">
              Shift completed
            </span>
          </div>

          <div
            onClick={() => setStatusFilter("absent")}
            className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-xs cursor-pointer hover:bg-zinc-100 transition"
          >
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
              Not Checked In
            </span>
            <span className="text-xl font-bold font-mono text-zinc-700 mt-1 block">
              {summary.absent}
            </span>
            <span className="text-[10px] text-zinc-500 mt-0.5 block">Pending check-in</span>
          </div>

          <div
            onClick={() => setStatusFilter("flagged")}
            className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:bg-rose-50 transition"
          >
            <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider block">
              Flagged Punches
            </span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
              {summary.flaggedCount}
            </span>
            <span className="text-[10px] text-rose-700 font-medium mt-0.5 block">
              Review required
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Attendance Sheet Table */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0D7A5F]" />
            <h3 className="text-sm font-bold text-zinc-900">
              Daily Attendance Sheet ({filteredRecords.length} staff)
            </h3>
            <span className="text-xs text-zinc-500 font-medium">
              — {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="text-xs font-semibold text-[#0D7A5F] hover:underline"
            >
              Clear filter ({statusFilter})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F4F4F5] text-zinc-600 border-b border-[#E4E4E7]">
              <tr>
                <th className="p-3 font-bold">Staff Member</th>
                <th className="p-3 font-bold">Role & Dept</th>
                <th className="p-3 font-bold">Duty Status</th>
                <th className="p-3 font-bold">First Check-In</th>
                <th className="p-3 font-bold">Last Check-Out</th>
                <th className="p-3 font-bold">Hours Logged</th>
                <th className="p-3 font-bold">Geofence Site</th>
                <th className="p-3 font-bold">Biometric</th>
                <th className="p-3 font-bold text-right">Punches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#0D7A5F] mx-auto mb-2" />
                    <span>Loading attendance sheet...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-zinc-500">
                    <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-semibold text-zinc-700">No attendance records found</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      No matching staff records found for the selected filters on this date.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.employee.id}
                    className={`hover:bg-[#F9FAFB] transition ${
                      r.hasFlag ? "bg-amber-50/30" : ""
                    }`}
                  >
                    {/* Employee Profile */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-zinc-700 text-xs shrink-0">
                          {r.employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-zinc-900">{r.employee.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {r.employee.phone}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Department */}
                    <td className="p-3">
                      <div className="font-semibold text-zinc-800">
                        {r.employee.designation || r.employee.role}
                      </div>
                      <div className="text-[10px] text-zinc-500">{r.employee.department}</div>
                    </td>

                    {/* Duty Status */}
                    <td className="p-3">
                      {r.dutyStatus === "Available & Ready" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Available & Ready
                        </span>
                      ) : r.dutyStatus === "On Job" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Briefcase className="w-3 h-3 text-blue-600" />
                          On Job ({r.activeJob?.jobNumber || "Active"})
                        </span>
                      ) : r.dutyStatus === "Checked Out" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <LogOut className="w-3 h-3 text-amber-600" />
                          Checked Out
                        </span>
                      ) : r.dutyStatus === "On Leave" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          On Leave
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                          Not Checked In
                        </span>
                      )}
                    </td>

                    {/* First Check-In */}
                    <td className="p-3">
                      {r.firstCheckIn ? (
                        <div>
                          <div className="font-mono font-bold text-zinc-900 flex items-center gap-1">
                            <LogIn className="w-3 h-3 text-emerald-600" />
                            {r.firstCheckIn.timeStr}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                            {r.firstCheckIn.zoneName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Last Check-Out */}
                    <td className="p-3">
                      {r.lastCheckOut ? (
                        <div>
                          <div className="font-mono font-bold text-zinc-900 flex items-center gap-1">
                            <LogOut className="w-3 h-3 text-amber-600" />
                            {r.lastCheckOut.timeStr}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                            {r.lastCheckOut.zoneName}
                          </div>
                        </div>
                      ) : r.isCheckedIn ? (
                        <span className="text-emerald-700 font-semibold text-[11px]">
                          Still on duty
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Hours Logged */}
                    <td className="p-3">
                      <span className="font-mono font-bold text-zinc-900">
                        {r.hoursWorkedFormatted}
                      </span>
                    </td>

                    {/* Geofence Site */}
                    <td className="p-3">
                      {r.firstCheckIn ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#0D7A5F] shrink-0" />
                          <span
                            className={`truncate max-w-[130px] font-medium ${
                              r.firstCheckIn.withinGeofence
                                ? "text-zinc-800"
                                : "text-amber-700 font-semibold"
                            }`}
                          >
                            {r.firstCheckIn.zoneName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Biometric Status */}
                    <td className="p-3">
                      {r.firstCheckIn ? (
                        <div className="flex items-center gap-1">
                          {r.firstCheckIn.faceMatchScore >= 50 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              {Math.round(r.firstCheckIn.faceMatchScore)}% Match
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Backup PIN
                            </span>
                          )}
                        </div>
                      ) : r.employee.faceEnrolled ? (
                        <span className="text-[10px] text-zinc-400">Enrolled</span>
                      ) : (
                        <span className="text-[10px] text-zinc-300">Unenrolled</span>
                      )}
                    </td>

                    {/* Punches Count & Action */}
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectRecord(r)}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[11px] rounded-lg transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-zinc-500" />
                        {r.punchesCount} punch{r.punchesCount === 1 ? "" : "es"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Punches Inspection Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <h4 className="font-bold text-zinc-900 text-sm">
                  Attendance Punches — {inspectRecord.employee.name}
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {inspectRecord.employee.designation} • {inspectRecord.employee.department} •{" "}
                  {selectedDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="text-zinc-400 hover:text-zinc-700 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {inspectRecord.punches.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">
                  No punch records logged for this employee on this date.
                </p>
              ) : (
                inspectRecord.punches.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {p.type === "CHECK_OUT" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            CHECK-OUT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            CHECK-IN
                          </span>
                        )}
                        <span className="font-mono font-bold text-zinc-900">{p.timeStr}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-zinc-400" />
                        <span>{p.zoneName}</span>
                        <span className="text-zinc-400">
                          ({p.withinGeofence ? "Within site" : "Outside site"})
                        </span>
                      </div>
                      {p.flagReason && (
                        <div className="text-[11px] text-amber-800 font-semibold mt-1">
                          Flag: {p.flagReason}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-mono text-zinc-500">
                        Face: {Math.round(p.faceMatchScore)}%
                      </div>
                      {p.flaggedForReview ? (
                        <span className="text-[10px] text-rose-700 font-bold">Flagged</span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-semibold">Pass</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
