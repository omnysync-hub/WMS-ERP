"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import SurveillanceMap from "@/components/maps/SurveillanceMap";
import { useRole } from "@/contexts/RoleContext";
import {
  Users,
  Calendar,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Download,
  ShieldCheck,
  AlertTriangle,
  Battery,
  Gauge,
  Navigation,
  Clock,
  MapPin,
  RefreshCw,
  Sliders,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

export default function SurveillanceDashboardPage() {
  const { activeRole, currentPersona } = useRole();

  const getAdminHeaders = () => ({
    "Content-Type": "application/json",
    "x-employee-id": currentPersona?.id || "bcf9ec77-796f-47cc-948e-196057876ed2",
    "x-actor-role": activeRole || "admin",
    "x-actor-name": currentPersona?.name || "Administrator",
  });

  // Technician roster
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [loadingTechs, setLoadingTechs] = useState(true);

  // Filter settings
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "week">("today");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [scope, setScope] = useState<"all" | "on_job" | "on_shift">("all");

  // Telemetry data
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback engine
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPingIndex, setCurrentPingIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 5 | 10>(1);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Retention cleanup modal
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [retentionDaysInput, setRetentionDaysInput] = useState("90");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  // Initialize dates
  useEffect(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    setStartDate(`${todayStr}T00:00`);
    setEndDate(`${todayStr}T23:59`);
  }, []);

  // 1. Load Technician list
  const loadTechnicians = async () => {
    try {
      setLoadingTechs(true);
      const res = await fetch("/api/technicians");
      const data = await res.json();
      if (data?.technicians) {
        setTechnicians(data.technicians);
        if (data.technicians.length > 0 && !selectedTechId) {
          setSelectedTechId(data.technicians[0].id);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load technician roster.");
    } finally {
      setLoadingTechs(false);
    }
  };

  useEffect(() => {
    loadTechnicians();
  }, []);

  // Preset Date Handlers
  const handlePresetSelect = (preset: "today" | "yesterday" | "week") => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(`${todayStr}T00:00`);
      setEndDate(`${todayStr}T23:59`);
    } else if (preset === "yesterday") {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = yesterday.toISOString().slice(0, 10);
      setStartDate(`${yStr}T00:00`);
      setEndDate(`${yStr}T23:59`);
    } else if (preset === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(`${weekAgo.toISOString().slice(0, 10)}T00:00`);
      setEndDate(`${now.toISOString().slice(0, 10)}T23:59`);
    }
  };

  // 2. Fetch Historical Surveillance Telemetry
  const fetchSurveillanceData = async () => {
    if (!selectedTechId) return;

    try {
      setLoadingTelemetry(true);
      setErrorMsg(null);
      setIsPlaying(false);

      const params = new URLSearchParams({
        employeeId: selectedTechId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        scope,
      });

      const res = await fetch(`/api/telemetry/history?${params.toString()}`, {
        headers: getAdminHeaders(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch surveillance history.");
      }

      const data = await res.json();
      setTelemetryData(data);
      setCurrentPingIndex(0);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    if (selectedTechId && startDate && endDate) {
      fetchSurveillanceData();
    }
  }, [selectedTechId, startDate, endDate, scope]);

  // 3. Playback Loop Engine
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    const pingsCount = telemetryData?.pings?.length || 0;
    if (pingsCount <= 1) {
      setIsPlaying(false);
      return;
    }

    const intervalMs = Math.max(100, 1000 / playbackSpeed);

    playbackTimerRef.current = setInterval(() => {
      setCurrentPingIndex((prev) => {
        if (prev >= pingsCount - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, telemetryData, playbackSpeed]);

  const pings = telemetryData?.pings || [];
  const gaps = telemetryData?.offlineGaps || [];
  const summary = telemetryData?.summary || null;
  const currentPing = pings[currentPingIndex] || null;

  const activeTechObj = technicians.find((t) => t.id === selectedTechId);

  // Export Trigger
  const handleExport = (format: "csv" | "json") => {
    if (!selectedTechId) return;
    const params = new URLSearchParams({
      employeeId: selectedTechId,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      format,
    });
    window.open(`/api/telemetry/export?${params.toString()}`, "_blank");
  };

  // Run Retention Policy
  const handleExecuteRetention = async (dryRun: boolean) => {
    try {
      setCleanupLoading(true);
      const res = await fetch("/api/telemetry/cleanup", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          retentionDays: Number(retentionDaysInput) || 90,
          dryRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cleanup failed.");
      setCleanupResult(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Dispatch Map", href: "/dispatch" },
          { label: "Location Surveillance" },
        ]}
        title="Technician Location Surveillance & Playback"
        subtitle="Full historical trajectory tracking, offline signal gap analysis, and movement telemetry"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Audit Surveillance Active
          </span>
        }
        secondaryActions={[
          {
            label: "Live Dispatch Board",
            href: "/dispatch",
          },
          {
            label: "Retention Policy",
            icon: <Trash2 className="w-3.5 h-3.5" />,
            onClick: () => setShowCleanupModal(true),
          },
        ]}
      />

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-rose-700">
            ✕
          </button>
        </div>
      )}

      {/* Surveillance Control & Filter Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* 1. Technician Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Technician
            </label>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.phone})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Time Horizon
            </label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => handlePresetSelect("today")}
                className={`py-1 rounded-lg font-bold transition text-[11px] ${
                  datePreset === "today" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("yesterday")}
                className={`py-1 rounded-lg font-bold transition text-[11px] ${
                  datePreset === "yesterday" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("week")}
                className={`py-1 rounded-lg font-bold transition text-[11px] ${
                  datePreset === "week" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                7 Days
              </button>
            </div>
          </div>

          {/* 3. Scope Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Tracking Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
            >
              <option value="all">All Telemetry Pings</option>
              <option value="on_job">On Active Job Only</option>
              <option value="on_shift">On Shift (Clocked-In)</option>
            </select>
          </div>

          {/* 4. Action Export Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Audit Actions
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="flex-1 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={fetchSurveillanceData}
                disabled={loadingTelemetry}
                className="px-3 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTelemetry ? "animate-spin" : ""}`} />
                Reload
              </button>
            </div>
          </div>
        </div>

        {/* Custom Start & End Date row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-400">Custom Range:</span>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />
          <span>to</span>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />

          {telemetryData?.consentStatus && (
            <div className="ml-auto flex items-center gap-1.5 text-[11px]">
              {telemetryData.consentStatus.hasConsent ? (
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Consent Policy v{telemetryData.consentStatus.policyVersion} Acknowledged
                </span>
              ) : (
                <span className="text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Awaiting Mobile Disclosure Acknowledgment
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metric Quick Stats Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Navigation className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Distance Traveled
            </div>
            <p className="text-xl font-mono font-extrabold text-zinc-900">
              {summary.totalDistanceKm} <span className="text-xs font-sans text-zinc-500">km</span>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Gauge className="w-3.5 h-3.5 text-blue-600" />
              Avg / Max Speed
            </div>
            <p className="text-xl font-mono font-extrabold text-zinc-900">
              {summary.avgSpeedKmH}{" "}
              <span className="text-xs font-sans text-zinc-400 font-normal">/ {summary.maxSpeedKmH} km/h</span>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              Telemetry Pings
            </div>
            <p className="text-xl font-mono font-extrabold text-zinc-900">
              {summary.totalPings} <span className="text-xs font-sans text-zinc-400">pings</span>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Battery className="w-3.5 h-3.5 text-amber-600" />
              Battery Drain
            </div>
            <p className="text-xl font-mono font-extrabold text-zinc-900">
              {summary.batteryDrain != null ? `-${summary.batteryDrain}%` : "—"}
              <span className="text-[11px] font-sans text-zinc-400 ml-1.5">
                ({summary.batteryStart ?? "—"}% → {summary.batteryEnd ?? "—"}%)
              </span>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Offline Gaps
            </div>
            <p className="text-xl font-mono font-extrabold text-rose-600">
              {summary.offlineIncidents}{" "}
              <span className="text-xs font-sans text-zinc-400 font-normal">
                ({summary.totalOfflineMinutes}m total)
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Interactive Map & Surveillance Trajectory View */}
      <div className="space-y-3">
        <SurveillanceMap
          pings={pings}
          gaps={gaps}
          currentPingIndex={currentPingIndex}
          onSelectPingIndex={setCurrentPingIndex}
          technicianName={activeTechObj?.name || "Technician"}
        />

        {/* Playback Control Bar */}
        {pings.length > 0 && (
          <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl border border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Play/Pause & Speed Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Play
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentPingIndex(0);
                  }}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
                  title="Reset to Start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Speed Toggle */}
                <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-xl text-[11px] font-bold">
                  {([1, 2, 5, 10] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-2 py-1 rounded-lg transition ${
                        playbackSpeed === s ? "bg-[#0D7A5F] text-white" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Playback Marker Telemetry */}
              {currentPing && (
                <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-300">
                  <span className="bg-zinc-800 px-2.5 py-1 rounded-lg text-emerald-400 font-bold">
                    🕒 {new Date(currentPing.timestamp).toLocaleTimeString()}
                  </span>
                  <span>
                    ⚡ {currentPing.speed != null ? `${Math.round(currentPing.speed)} km/h` : "0 km/h"}
                  </span>
                  <span>🔋 {currentPing.batteryLevel != null ? `${Math.round(currentPing.batteryLevel)}%` : "—"}</span>
                  <span className={currentPing.isMoving ? "text-emerald-400" : "text-amber-400"}>
                    {currentPing.isMoving ? "In Motion" : "Stopped"}
                  </span>
                  {currentPing.activeJob && (
                    <span className="text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                      Job: {currentPing.activeJob.jobNumber}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Timeline Scrubber */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={pings.length - 1}
                value={currentPingIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentPingIndex(Number(e.target.value));
                }}
                className="w-full accent-[#0D7A5F] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>Start: {new Date(pings[0].timestamp).toLocaleTimeString()}</span>
                <span>
                  Point {currentPingIndex + 1} of {pings.length}
                </span>
                <span>End: {new Date(pings[pings.length - 1].timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Offline Gap Analysis Callout List */}
      {gaps.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-rose-950">
                Offline Signal Gaps Detected ({gaps.length} Incidents)
              </h3>
              <p className="text-xs text-rose-700">
                Periods during scheduled shift hours where no GPS telemetry was received for 10+ minutes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gaps.map((gap: any, idx: number) => (
              <div
                key={gap.id || idx}
                className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900">Incident #{idx + 1}</span>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md text-[11px]">
                    {gap.durationMinutes} mins offline
                  </span>
                </div>
                <p className="text-zinc-600 text-[11px]">
                  <strong>Signal Lost:</strong> {new Date(gap.gapStartAt).toLocaleTimeString()} at (
                  {gap.lastKnownLat.toFixed(4)}, {gap.lastKnownLng.toFixed(4)})
                </p>
                {gap.gapEndAt && (
                  <p className="text-zinc-600 text-[11px]">
                    <strong>Resumed:</strong> {new Date(gap.gapEndAt).toLocaleTimeString()} at (
                    {gap.resumeLat?.toFixed(4)}, {gap.resumeLng?.toFixed(4)})
                  </p>
                )}
                {gap.lastBatteryLevel != null && (
                  <p className="text-zinc-400 text-[10px]">Last reported battery: {gap.lastBatteryLevel}%</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retention Policy Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-zinc-200 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Telemetry Retention Policy</h3>
                <p className="text-zinc-500 text-xs">Purge historical GPS telemetry older than retention window</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-700 block">
                  Retention Threshold (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={retentionDaysInput}
                  onChange={(e) => setRetentionDaysInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                />
                <p className="text-[10px] text-zinc-400">
                  Standard policy: 90 days. Raw pings older than this threshold will be permanently deleted.
                </p>
              </div>

              {cleanupResult && (
                <div className="p-3 bg-zinc-100 rounded-xl space-y-1 text-[11px]">
                  <p className="font-bold text-zinc-900">
                    {cleanupResult.dryRun ? "Dry Run Preview:" : "Purge Complete:"}
                  </p>
                  <p className="text-zinc-600">
                    Eligible pings to purge:{" "}
                    <strong>{cleanupResult.eligiblePings ?? cleanupResult.purgedPingsCount}</strong>
                  </p>
                  <p className="text-zinc-600">
                    Eligible gap logs:{" "}
                    <strong>{cleanupResult.eligibleOfflineGaps ?? cleanupResult.purgedGapsCount}</strong>
                  </p>
                  <p className="text-zinc-400 text-[10px]">
                    Cutoff timestamp: {new Date(cleanupResult.cutoffDate).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setShowCleanupModal(false);
                  setCleanupResult(null);
                }}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRetention(true)}
                disabled={cleanupLoading}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold rounded-xl text-xs"
              >
                Preview Dry Run
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Permanently delete all GPS telemetry older than ${retentionDaysInput} days?`)) {
                    handleExecuteRetention(false);
                  }
                }}
                disabled={cleanupLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                Execute Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
