"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Fingerprint, Link2, RefreshCw } from "lucide-react";
import toast from "@/lib/toast";
import { formatDateTime } from "@/lib/utils";

/**
 * Device Punches (ZKBio / Zlink biometric terminals).
 *
 * Punches imported from the attendance machines land in the separate
 * DevicePunch table. This panel lets HR review them and — the important
 * part — map device employee codes (emp_code) to ERP employees. Until a
 * code is mapped its punches carry employeeId = null and stay invisible
 * to the attendance sheet / payroll merge, so unmapped codes are queued
 * at the top with a one-click mapping action (the POST backfills the
 * employeeId onto that code's earlier punches server-side).
 *
 * Data: GET /api/integrations/zkbio/punches,
 *       GET|POST /api/integrations/zkbio/mappings,
 *       GET /api/hrm/employees (picker) — all admin/HR gated server-side.
 */

type DevicePunchRow = {
  id: string;
  empCode: string;
  employeeId: string | null;
  employeeName: string | null;
  employee?: { id: string; name: string } | null;
  punchTime: string;
  punchType: string;
  punchStateText: string | null;
  verifyType: string | null;
  terminalSn: string | null;
  terminalAlias: string | null;
};

type MappingRow = {
  id: string;
  empCode: string;
  employeeId: string;
  zkbioName: string | null;
  employee?: { id: string; name: string; department?: string | null } | null;
};

type UnmappedCode = { empCode: string; employeeName: string | null };

type EmployeeOption = { id: string; name: string; department?: string | null; designation?: string | null };

export default function DevicePunchesPanel() {
  const [punches, setPunches] = useState<DevicePunchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [unmappedCodes, setUnmappedCodes] = useState<UnmappedCode[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [pickerByCode, setPickerByCode] = useState<Record<string, string>>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (fromDate) params.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
      if (toDate) params.set("to", new Date(`${toDate}T23:59:59`).toISOString());
      if (unmappedOnly) params.set("unmapped", "1");

      const [punchRes, mapRes, empRes] = await Promise.all([
        fetch(`/api/integrations/zkbio/punches?${params.toString()}`),
        fetch("/api/integrations/zkbio/mappings"),
        fetch("/api/hrm/employees"),
      ]);
      const punchData = await punchRes.json().catch(() => ({}));
      if (!punchRes.ok) {
        throw new Error(punchData.error || "Failed to load device punches.");
      }
      setPunches(punchData.punches || []);
      setTotal(punchData.count ?? (punchData.punches || []).length);

      const mapData = await mapRes.json().catch(() => ({}));
      if (mapRes.ok) {
        setMappings(mapData.mappings || []);
        setUnmappedCodes(mapData.unmapped || []);
      }
      const empData = await empRes.json().catch(() => ({}));
      if (empRes.ok && empData.employees) setEmployees(empData.employees);
    } catch (e: any) {
      setError(e.message || "Failed to load device punches.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, unmappedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const unmappedCountByCode = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of punches) {
      if (!p.employeeId) counts.set(p.empCode, (counts.get(p.empCode) || 0) + 1);
    }
    return counts;
  }, [punches]);

  const handleMap = async (code: UnmappedCode) => {
    const employeeId = pickerByCode[code.empCode];
    if (!employeeId) {
      toast.error("Pick an employee for this device code first.");
      return;
    }
    setSavingCode(code.empCode);
    try {
      const res = await fetch("/api/integrations/zkbio/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empCode: code.empCode,
          employeeId,
          zkbioName: code.employeeName || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save mapping.");
      toast.success(data.message || `Device code ${code.empCode} mapped.`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save mapping.");
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unmapped device codes — action queue */}
      <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Unmapped Device Codes
            </h3>
            <p className="text-[11px] text-[#71717A]">
              Punches from these device employee codes are imported but not linked to any ERP
              employee, so they do not appear in attendance or payroll. Map each code once —
              earlier punches are linked automatically.
            </p>
          </div>
        </div>

        {unmappedCodes.length === 0 ? (
          <p className="text-xs text-[#71717A] py-2">
            No unmapped device codes. Every imported punch is linked to an employee.
          </p>
        ) : (
          <div className="divide-y divide-[#F4F4F5]">
            {unmappedCodes.map((code) => (
              <div key={code.empCode} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-40">
                  <p className="text-xs font-bold text-[#18181B] font-mono">{code.empCode}</p>
                  <p className="text-[11px] text-[#71717A]">
                    {code.employeeName || "Unknown name on device"}
                    {unmappedCountByCode.get(code.empCode)
                      ? ` · ${unmappedCountByCode.get(code.empCode)} punch(es) in current view`
                      : ""}
                  </p>
                </div>
                <select
                  value={pickerByCode[code.empCode] || ""}
                  onChange={(e) =>
                    setPickerByCode((prev) => ({ ...prev, [code.empCode]: e.target.value }))
                  }
                  className="h-8 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs text-[#18181B] min-w-56"
                >
                  <option value="">Select ERP employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {emp.department ? ` — ${emp.department}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={savingCode === code.empCode}
                  onClick={() => handleMap(code)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A614B] disabled:opacity-50 text-xs font-semibold text-white transition"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {savingCode === code.empCode ? "Mapping…" : "Map Employee"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing mappings */}
      {mappings.length > 0 && (
        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3">
          <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            Mapped Device Codes ({mappings.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {mappings.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-medium text-[#18181B]"
              >
                <Fingerprint className="w-3 h-3 text-[#0D7A5F]" />
                <span className="font-mono font-bold">{m.empCode}</span>
                <span className="text-[#71717A]">→</span>
                <span>{m.employee?.name || m.zkbioName || m.employeeId}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Punches */}
      <div className="bg-white rounded-xl border border-[#EDEDED] shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Device Punches
            </h3>
            <p className="text-[11px] text-[#71717A]">
              {total} punch(es) match the current filters (showing up to 500, newest first).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs text-[#18181B]"
              aria-label="From date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs text-[#18181B]"
              aria-label="To date"
            />
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#18181B]">
              <input
                type="checkbox"
                checked={unmappedOnly}
                onChange={(e) => setUnmappedOnly(e.target.checked)}
                className="accent-[#0D7A5F]"
              />
              Unmapped only
            </label>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#D4D4D8] text-xs font-semibold text-[#18181B] transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 text-xs font-medium rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </div>
        ) : loading ? (
          <p className="text-xs text-[#71717A] py-6 text-center">Loading device punches…</p>
        ) : punches.length === 0 ? (
          <p className="text-xs text-[#71717A] py-6 text-center">
            No device punches found for the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#71717A] border-b border-[#EDEDED]">
                  <th className="py-2 pr-3 font-semibold">Time</th>
                  <th className="py-2 pr-3 font-semibold">Employee</th>
                  <th className="py-2 pr-3 font-semibold">Device Code</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">Verified By</th>
                  <th className="py-2 font-semibold">Terminal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F5]">
                {punches.map((p) => (
                  <tr key={p.id} className={p.employeeId ? "" : "bg-amber-50/50"}>
                    <td className="py-2 pr-3 whitespace-nowrap text-[#18181B]">
                      {formatDateTime(p.punchTime)}
                    </td>
                    <td className="py-2 pr-3">
                      {p.employeeId ? (
                        <span className="font-medium text-[#18181B]">
                          {p.employee?.name || p.employeeName || "—"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          {p.employeeName || "Unmapped"}
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                            Unmapped
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[#18181B]">{p.empCode}</td>
                    <td className="py-2 pr-3 text-[#18181B]">
                      {p.punchStateText ||
                        (p.punchType === "CHECK_IN"
                          ? "Check In"
                          : p.punchType === "CHECK_OUT"
                            ? "Check Out"
                            : p.punchType)}
                    </td>
                    <td className="py-2 pr-3 text-[#71717A]">{p.verifyType || "—"}</td>
                    <td className="py-2 text-[#71717A]">
                      {p.terminalAlias || p.terminalSn || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
