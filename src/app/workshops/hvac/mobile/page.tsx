"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Snowflake,
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  RefreshCw,
  User,
  ShieldCheck,
  Package,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  X,
  Gauge,
  Activity,
  Check,
} from "lucide-react";

export default function HvacMobileTechnicianPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [techName, setTechName] = useState("Khurram Shahzad (Lead HVAC Tech)");
  const [activeTab, setActiveTab] = useState<"assigned" | "inprogress" | "completed">("assigned");

  // Sub-Modals
  const [actionLoading, setActionLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<"diagnose" | "gas" | "bench_test" | "finish" | null>(null);

  const [diagnosisForm, setDiagnosisForm] = useState({
    inspectionFindings: "",
    workRequired: "",
    estimatedHours: "3",
    estimatedCost: "4500",
  });

  const [gasForm, setGasForm] = useState({
    description: "R410A Refrigerant Gas",
    qty: "1.2",
    unit: "kg",
  });

  const [benchTestForm, setBenchTestForm] = useState({
    pressurePsi: "400",
    leakTest: "Pass - 400 PSI Held",
    amps: "6.2",
    notes: "Vacuum 250 microns. Amps stable at 6.2A on 220V load.",
  });

  const [finishForm, setFinishForm] = useState({
    workDoneSummary: "",
    scrapItem: "Burnt Compressor (1.5 Ton Rotary)",
    customerKept: false,
  });

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs?workshopType=hvac");
      const json = await res.json();
      if (json.success) {
        setJobs(json.data || []);
        if (selectedJob) {
          const fresh = json.data.find((j: any) => j.id === selectedJob.id);
          if (fresh) setSelectedJob(fresh);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const openJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/workshops/jobs?id=${jobId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedJob(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Diagnosis
  const handleSaveDiagnosis = async () => {
    if (!diagnosisForm.inspectionFindings.trim() || !diagnosisForm.workRequired.trim()) {
      alert("Please enter inspection findings and work required.");
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
          estimatedHours: Number(diagnosisForm.estimatedHours) || 2,
          estimatedCost: Number(diagnosisForm.estimatedCost) || 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveModal(null);
        openJob(selectedJob.id);
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

  // Request Gas / Parts
  const handleRequestGas = async () => {
    if (!gasForm.description.trim()) {
      alert("Please enter gas or material description.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_material",
          jobCardId: selectedJob.id,
          items: [
            {
              description: gasForm.description,
              requestedQty: Number(gasForm.qty) || 1,
              unit: gasForm.unit,
            },
          ],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveModal(null);
        setGasForm({ description: "R410A Refrigerant Gas", qty: "1.2", unit: "kg" });
        openJob(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to submit requisition");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Log Bench Test
  const handleSaveBenchTest = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          jobCardId: selectedJob.id,
          testingPressurePsi: Number(benchTestForm.pressurePsi) || null,
          testingLeakTest: benchTestForm.leakTest,
          testingRunTestAmps: Number(benchTestForm.amps) || null,
          testingNotes: benchTestForm.notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveModal(null);
        openJob(selectedJob.id);
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

  // Finish Job & Scrap
  const handleFinishJob = async () => {
    if (!finishForm.workDoneSummary.trim()) {
      alert("Please provide a work done summary.");
      return;
    }

    setActionLoading(true);
    try {
      if (finishForm.scrapItem.trim()) {
        await fetch("/api/workshops/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record_scrap",
            jobCardId: selectedJob.id,
            itemDescription: finishForm.scrapItem,
            quantity: 1,
            unit: "pcs",
            customerKept: finishForm.customerKept,
          }),
        });
      }

      const res = await fetch("/api/workshops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          jobCardId: selectedJob.id,
          workDoneSummary: finishForm.workDoneSummary,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActiveModal(null);
        openJob(selectedJob.id);
        fetchJobs();
      } else {
        alert(json.error || "Failed to complete HVAC job");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (activeTab === "assigned") return ["Open", "Assigned", "Under Inspection"].includes(j.status);
    if (activeTab === "inprogress") return ["Pending Approval", "Approved", "In Progress"].includes(j.status);
    return ["Completed", "Closed"].includes(j.status);
  });

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 flex flex-col max-w-md mx-auto shadow-2xl border-x border-zinc-800">
      {/* Mobile Top Header */}
      <div className="bg-[#121215] border-b border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/workshops/hvac"
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                Bench Station • HVAC Tech
              </span>
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Snowflake className="w-4 h-4 text-cyan-400" />
                Workman HVAC App
              </h1>
            </div>
          </div>

          <button
            onClick={fetchJobs}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>

        {/* Tech Persona */}
        <div className="mt-3 flex items-center justify-between bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-white">{techName}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Bench Rig #1</span>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 mt-3 bg-zinc-900 p-1 rounded-xl">
          {[
            { id: "assigned", label: "Intake", count: jobs.filter((j) => ["Open", "Assigned", "Under Inspection"].includes(j.status)).length },
            { id: "inprogress", label: "Testing", count: jobs.filter((j) => ["Pending Approval", "Approved", "In Progress"].includes(j.status)).length },
            { id: "completed", label: "Passed", count: jobs.filter((j) => ["Completed", "Closed"].includes(j.status)).length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-cyan-500 text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="p-4 flex-1 space-y-3 overflow-y-auto">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            onClick={() => openJob(job.id)}
            className="bg-[#141417] border border-zinc-800 hover:border-cyan-500/60 p-4 rounded-2xl cursor-pointer transition active:scale-[0.98] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-extrabold text-cyan-400">
                {job.jobNumber}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  job.status === "Closed"
                    ? "bg-zinc-800 text-zinc-400"
                    : job.status === "Completed"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : job.status === "Pending Approval"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-cyan-500/20 text-cyan-300"
                }`}
              >
                {job.status}
              </span>
            </div>

            <div className="mt-2">
              <h3 className="text-base font-extrabold text-white">❄️ {job.brandModel}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {job.unitType} • S/N: {job.serialNumber || "N/A"}
              </p>
              {job.refrigerantType && (
                <span className="inline-block mt-1 font-mono text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.2 rounded">
                  {job.refrigerantType}
                </span>
              )}
            </div>

            <div className="mt-2.5 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 text-xs text-zinc-300">
              <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Problem:</span>
              <p className="line-clamp-2">{job.complaint}</p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
              <span>{job.customerSite || job.customerName || "Bench Job"}</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrency(job.totalJobCost || 0)}
              </span>
            </div>
          </div>
        ))}

        {filteredJobs.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-2xl">
            No HVAC jobs in this section.
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* FULL JOB MODAL / ACTIONS SHEET                                      */}
      {/* =================================================================== */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-end animate-in fade-in duration-150">
          <div className="bg-[#121215] border-t border-zinc-800 rounded-t-3xl max-h-[88vh] flex flex-col p-5 max-w-md mx-auto w-full">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <span className="font-mono text-xs font-extrabold text-cyan-400 block">{selectedJob.jobNumber}</span>
                <h2 className="text-base font-extrabold text-white">❄️ {selectedJob.brandModel}</h2>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 block mb-1 font-bold">REPORTED FAULT</span>
                <p className="text-white">{selectedJob.complaint}</p>
              </div>

              {/* Bench Testing Stats Strip */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Nitrogen PSI</span>
                  <span className="font-mono font-extrabold text-cyan-400 text-xs">
                    {selectedJob.testingPressurePsi ? `${selectedJob.testingPressurePsi}` : "-"}
                  </span>
                </div>
                <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Vacuum Test</span>
                  <span className="font-bold text-emerald-400 text-xs">
                    {selectedJob.testingLeakTest || "-"}
                  </span>
                </div>
                <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Running Amps</span>
                  <span className="font-mono font-extrabold text-amber-400 text-xs">
                    {selectedJob.testingRunTestAmps ? `${selectedJob.testingRunTestAmps}A` : "-"}
                  </span>
                </div>
              </div>

              {selectedJob.inspectionFindings && (
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-amber-400 block mb-1 font-bold">DIAGNOSIS & ESTIMATE</span>
                  <p className="text-white">{selectedJob.inspectionFindings}</p>
                  <p className="text-zinc-400 mt-1">Work: {selectedJob.workRequired}</p>
                  <div className="mt-2 text-zinc-400 flex justify-between">
                    <span>Est: {selectedJob.estimatedHours} hrs</span>
                    <span className="font-bold text-emerald-400">Gate: {selectedJob.approvalStatus}</span>
                  </div>
                </div>
              )}

              {/* Requisitions */}
              {selectedJob.requisitions && selectedJob.requisitions.length > 0 && (
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-emerald-400 block mb-1 font-bold">REQUISITIONS (GAS / PARTS)</span>
                  <div className="space-y-1.5">
                    {selectedJob.requisitions.map((req: any) => (
                      <div key={req.id} className="flex justify-between text-[11px] border-b border-zinc-900 pb-1">
                        <span>{req.description} ({req.requestedQty} {req.unit})</span>
                        <span className="font-bold text-emerald-400">{req.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bench Action Buttons */}
            <div className="pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveModal("diagnose")}
                className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Diagnose</span>
              </button>

              <button
                onClick={() => {
                  if (!["Approved", "In Progress"].includes(selectedJob.status)) {
                    alert("Manager approval required before requesting gas or parts.");
                    return;
                  }
                  setActiveModal("gas");
                }}
                className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Request Gas</span>
              </button>

              <button
                onClick={() => setActiveModal("bench_test")}
                className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>3. Bench Test</span>
              </button>

              <button
                onClick={() => setActiveModal("finish")}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>4. Complete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK DIAGNOSE */}
      {activeModal === "diagnose" && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">Step 3: Bench Diagnosis</h3>
            <div className="space-y-3 text-xs">
              <textarea
                rows={2}
                placeholder="Findings (e.g. flare nut leak, winding resistance normal)"
                value={diagnosisForm.inspectionFindings}
                onChange={(e) => setDiagnosisForm({ ...diagnosisForm, inspectionFindings: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white"
              />
              <textarea
                rows={2}
                placeholder="Work Needed (e.g. copper brazing, vacuum, 1.2kg R410A gas charge)"
                value={diagnosisForm.workRequired}
                onChange={(e) => setDiagnosisForm({ ...diagnosisForm, workRequired: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Est Hours"
                  value={diagnosisForm.estimatedHours}
                  onChange={(e) => setDiagnosisForm({ ...diagnosisForm, estimatedHours: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white"
                />
                <input
                  type="number"
                  placeholder="Est Cost"
                  value={diagnosisForm.estimatedCost}
                  onChange={(e) => setDiagnosisForm({ ...diagnosisForm, estimatedCost: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button onClick={() => setActiveModal(null)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-zinc-300">
                Cancel
              </button>
              <button onClick={handleSaveDiagnosis} disabled={actionLoading} className="px-3 py-1.5 bg-amber-500 font-bold text-black rounded-lg">
                Submit Diagnosis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK GAS / PARTS */}
      {activeModal === "gas" && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">Step 5: Request Gas / Parts</h3>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Gas / Material (e.g. R410A Refrigerant)"
                value={gasForm.description}
                onChange={(e) => setGasForm({ ...gasForm, description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Quantity (kg)"
                  value={gasForm.qty}
                  onChange={(e) => setGasForm({ ...gasForm, qty: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white"
                />
                <input
                  type="text"
                  placeholder="Unit (kg / feet)"
                  value={gasForm.unit}
                  onChange={(e) => setGasForm({ ...gasForm, unit: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button onClick={() => setActiveModal(null)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-zinc-300">
                Cancel
              </button>
              <button onClick={handleRequestGas} disabled={actionLoading} className="px-3 py-1.5 bg-[#0D7A5F] font-bold text-white rounded-lg">
                Submit to Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BENCH TEST (PSI / VACUUM / AMPS) */}
      {activeModal === "bench_test" && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">Step 8: Log Bench Test Station</h3>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Nitrogen PSI</label>
                  <input
                    type="number"
                    placeholder="400"
                    value={benchTestForm.pressurePsi}
                    onChange={(e) => setBenchTestForm({ ...benchTestForm, pressurePsi: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Running Amps (220V)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="6.2"
                    value={benchTestForm.amps}
                    onChange={(e) => setBenchTestForm({ ...benchTestForm, amps: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Vacuum & Leak Test</label>
                <input
                  type="text"
                  placeholder="Pass - 250 Microns Held"
                  value={benchTestForm.leakTest}
                  onChange={(e) => setBenchTestForm({ ...benchTestForm, leakTest: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Observations</label>
                <textarea
                  rows={2}
                  value={benchTestForm.notes}
                  onChange={(e) => setBenchTestForm({ ...benchTestForm, notes: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button onClick={() => setActiveModal(null)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-zinc-300">
                Cancel
              </button>
              <button onClick={handleSaveBenchTest} disabled={actionLoading} className="px-3 py-1.5 bg-cyan-600 font-bold text-white rounded-lg">
                Save Test Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FINISH & BURNT COMPRESSOR */}
      {activeModal === "finish" && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">Step 9: Complete & Scrap Compressor</h3>
            <div className="space-y-3 text-xs">
              <textarea
                rows={2}
                placeholder="Work Done Summary (e.g. brazed leak, gas charged 1.2kg, tested 6.2A)"
                value={finishForm.workDoneSummary}
                onChange={(e) => setFinishForm({ ...finishForm, workDoneSummary: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white"
              />
              <input
                type="text"
                placeholder="Burnt Compressor / Scrap Item"
                value={finishForm.scrapItem}
                onChange={(e) => setFinishForm({ ...finishForm, scrapItem: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mobileHvacCustKept"
                  checked={finishForm.customerKept}
                  onChange={(e) => setFinishForm({ ...finishForm, customerKept: e.target.checked })}
                  className="rounded border-zinc-700 text-cyan-500"
                />
                <label htmlFor="mobileHvacCustKept" className="text-zinc-300">Customer kept replaced parts</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button onClick={() => setActiveModal(null)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-zinc-300">
                Cancel
              </button>
              <button onClick={handleFinishJob} disabled={actionLoading} className="px-3 py-1.5 bg-emerald-600 font-bold text-white rounded-lg">
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
