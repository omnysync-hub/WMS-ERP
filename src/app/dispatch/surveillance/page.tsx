"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
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
  SkipBack,
  SkipForward,
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
  Compass,
  Sparkles,
  Focus,
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
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2 | 4 | 8>(1);
  const [autoFollow, setAutoFollow] = useState(true);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Retention cleanup modal
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [retentionDaysInput, setRetentionDaysInput] = useState("90");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [confirmPurgeStep, setConfirmPurgeStep] = useState(false);

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
      let list = Array.isArray(data?.technicians) ? data.technicians : [];

      if (list.length === 0) {
        // Fallback to HRM endpoint
        try {
          const hrmRes = await fetch("/api/hrm/employees?tab=technicians");
          const hrmData = await hrmRes.json();
          const emps = Array.isArray(hrmData?.employees) ? hrmData.employees : [];
          if (emps.length > 0) {
            list = emps.map((e: any) => ({
              id: e.id,
              name: e.name,
              phone: e.phone || "",
              department: e.department || "Operations",
              currentStatus: e.currentStatus || "Available",
            }));
          }
        } catch {
          // ignore
        }
      }

      if (list.length > 0) {
        setTechnicians(list);
        if (!selectedTechId) {
          setSelectedTechId(list[0].id);
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

    // Interval scaled by playback speed (e.g. 1x = 1000ms, 2x = 500ms, 4x = 250ms, 8x = 125ms, 0.5x = 2000ms)
    const intervalMs = Math.max(80, Math.round(1000 / playbackSpeed));

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

  // Playback Step Controls
  const handleStepBackward = () => {
    setIsPlaying(false);
    setCurrentPingIndex((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentPingIndex((prev) => Math.min(pings.length - 1, prev + 1));
  };

  const togglePlayPause = useCallback(() => {
    if (pings.length <= 1) return;
    if (!isPlaying && currentPingIndex >= pings.length - 1) {
      setCurrentPingIndex(0);
    }
    setIsPlaying((prev) => !prev);
  }, [isPlaying, currentPingIndex, pings.length]);

  // Keyboard Shortcuts (Space: Play/Pause, ArrowLeft: Step Back, ArrowRight: Step Forward)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleStepBackward();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleStepForward();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause]);

  // Demo Sample Route Generator (Instantly test video playback when pings are 0)
  const handleLoadDemoRoute = () => {
    const baseLat = 31.4700;
    const baseLng = 74.3100;
    const now = new Date();
    const demoPings = [];
    const waypoints = 18;

    for (let i = 0; i < waypoints; i++) {
      const pingTime = new Date(now.getTime() - (waypoints - i) * 3 * 60 * 1000);
      const isStopped = i === 0 || i === 8 || i === waypoints - 1;
      const speed = isStopped ? 0 : 35 + (i % 4) * 6;

      demoPings.push({
        id: `demo-ping-${i}`,
        lat: baseLat + i * 0.0042 + Math.sin(i * 0.8) * 0.002,
        lng: baseLng + i * 0.0055 + Math.cos(i * 0.8) * 0.002,
        accuracy: 12,
        speed,
        batteryLevel: Math.max(25, 92 - i * 3),
        isMoving: !isStopped,
        isShiftActive: true,
        activeJob:
          i >= 4 && i <= 11
            ? {
                id: "demo-job-1",
                jobNumber: "JOB-DEMO-2026",
                status: "InProgress",
                customerName: "Metro Commercial Center",
              }
            : null,
        source: "demo_simulation",
        timestamp: pingTime.toISOString(),
      });
    }

    setTelemetryData({
      employee: activeTechObj || { name: "Technician" },
      pings: demoPings,
      offlineGaps: [
        {
          id: "demo-gap-1",
          gapStartAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
          gapEndAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
          durationMinutes: 10,
          lastKnownLat: baseLat + 7 * 0.0042,
          lastKnownLng: baseLng + 7 * 0.0055,
          resumeLat: baseLat + 8 * 0.0042,
          resumeLng: baseLng + 8 * 0.0055,
          lastBatteryLevel: 71,
          reason: "Basement parking signal drop",
        },
      ],
      summary: {
        totalDistanceKm: 14.2,
        totalPings: waypoints,
        avgSpeedKmH: 34,
        maxSpeedKmH: 52,
        batteryStart: 92,
        batteryEnd: 41,
        batteryDrain: 51,
        offlineIncidents: 1,
        totalOfflineMinutes: 10,
      },
    });
    setCurrentPingIndex(0);
    setIsPlaying(true);
  };

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
      setCleanupError(null);
      const res = await fetch("/api/telemetry/cleanup", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          retentionDays: Number(retentionDaysInput) || 90,
          dryRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retention cleanup failed.");
      setCleanupResult(data);
      if (!dryRun) {
        setConfirmPurgeStep(false);
      }
    } catch (e: any) {
      setCleanupError(e.message || "Failed to execute retention policy.");
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
          { label: "Location Surveillance & Playback" },
        ]}
        title="Technician Location Surveillance & Playback"
        subtitle="GPS route playback, movement velocity tracking, and offline signal analysis"
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
            onClick: () => {
              setCleanupResult(null);
              setCleanupError(null);
              setConfirmPurgeStep(false);
              setShowCleanupModal(true);
            },
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
              disabled={loadingTechs}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.phone || t.department || "Operations"})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Date Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Time Window Preset
            </label>
            <div className="flex rounded-xl bg-zinc-100 p-1 border border-zinc-200">
              {(["today", "yesterday", "week"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                    datePreset === p ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {p === "week" ? "Last 7 Days" : p}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Scope Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Filter Trajectory By Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
            >
              <option value="all">Full Route (All Pings)</option>
              <option value="on_job">Only Active Job Transit</option>
              <option value="on_shift">Only Scheduled Shift Hours</option>
            </select>
          </div>

          {/* 4. Action Cluster */}
          <div className="flex items-center gap-2 pt-5">
            <button
              type="button"
              onClick={fetchSurveillanceData}
              disabled={loadingTelemetry}
              className="flex-1 px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTelemetry ? "animate-spin" : ""}`} />
              <span>{loadingTelemetry ? "Loading..." : "Load GPS"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport("csv")}
              className="p-2 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-xl transition"
              title="Export Trajectory to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0D7A5F]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setCleanupResult(null);
                setCleanupError(null);
                setConfirmPurgeStep(false);
                setShowCleanupModal(true);
              }}
              className="p-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition"
              title="Telemetry Retention Policy"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Custom Date Inputs */}
        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <span>From</span>
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

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadDemoRoute}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Test Demo Route</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Quick Stats Strip */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          autoFollow={autoFollow}
          onToggleAutoFollow={setAutoFollow}
        />

        {/* Video-Player Playback Deck */}
        {pings.length > 0 ? (
          <div className="bg-zinc-950 text-white rounded-2xl p-4 shadow-2xl border border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Playback Controls (Play/Pause, Step Back/Forward, Reset) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentPingIndex(0);
                  }}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition border border-zinc-800"
                  title="Rewind to Start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleStepBackward}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition border border-zinc-800"
                  title="Step Backward (Left Arrow)"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
                  title="Play / Pause (Spacebar)"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" /> Play Replay
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleStepForward}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition border border-zinc-800"
                  title="Step Forward (Right Arrow)"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                {/* Speed Toggle Chips */}
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl text-[11px] font-bold border border-zinc-800 ml-1">
                  {([0.5, 1, 2, 4, 8] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-2 py-0.5 rounded-lg transition ${
                        playbackSpeed === s ? "bg-[#0D7A5F] text-white shadow-xs" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* Auto-Follow Toggle */}
                <button
                  type="button"
                  onClick={() => setAutoFollow(!autoFollow)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ml-1 ${
                    autoFollow
                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                  title="Toggle Camera Follow"
                >
                  <Compass className={`w-3.5 h-3.5 ${autoFollow ? "text-emerald-400" : ""}`} />
                  <span>{autoFollow ? "Camera: Locked" : "Camera: Free"}</span>
                </button>
              </div>

              {/* Current Playback Marker HUD Telemetry */}
              {currentPing && (
                <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-300 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    {new Date(currentPing.timestamp).toLocaleTimeString()}
                  </span>
                  <span>
                    ⚡ {currentPing.speed != null ? `${Math.round(currentPing.speed)} km/h` : "0 km/h"}
                  </span>
                  <span>🔋 {currentPing.batteryLevel != null ? `${Math.round(currentPing.batteryLevel)}%` : "—"}</span>
                  <span className={currentPing.isMoving ? "text-emerald-400 font-bold" : "text-amber-400"}>
                    {currentPing.isMoving ? "Moving" : "Idle"}
                  </span>
                  {currentPing.activeJob && (
                    <span className="text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 font-semibold">
                      Job #{currentPing.activeJob.jobNumber}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Video-Style Timeline Scrubber */}
            <div className="space-y-1 pt-1">
              <input
                type="range"
                min={0}
                max={Math.max(0, pings.length - 1)}
                value={currentPingIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentPingIndex(Number(e.target.value));
                }}
                className="w-full accent-[#0D7A5F] cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>Start: {new Date(pings[0].timestamp).toLocaleTimeString()}</span>
                <span className="font-bold text-emerald-400">
                  Waymark {currentPingIndex + 1} of {pings.length} (
                  {Math.round(((currentPingIndex + 1) / pings.length) * 100)}%)
                </span>
                <span>End: {new Date(pings[pings.length - 1].timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Route Helper */
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#0D7A5F] flex items-center justify-center mx-auto">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">No Location Telemetry In Selected Range</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                No GPS location pings were reported for <strong>{activeTechObj?.name || "this technician"}</strong> between{" "}
                {new Date(startDate).toLocaleDateString()} and {new Date(endDate).toLocaleDateString()}.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handlePresetSelect("yesterday")}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition"
              >
                Check Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("week")}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition"
              >
                Check Last 7 Days
              </button>
              <button
                type="button"
                onClick={handleLoadDemoRoute}
                className="px-3.5 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate Route & Test Playback</span>
              </button>
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

      {/* Modern, Reliable Retention Policy Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-zinc-200 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Telemetry Retention Policy</h3>
                <p className="text-zinc-500 text-xs">Purge historical GPS pings older than retention window</p>
              </div>
            </div>

            {cleanupError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cleanupError}</span>
              </div>
            )}

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
                  onChange={(e) => {
                    setRetentionDaysInput(e.target.value);
                    setCleanupResult(null);
                    setConfirmPurgeStep(false);
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
                <p className="text-[10px] text-zinc-400">
                  Standard policy: 90 days. Raw location pings older than this threshold will be permanently deleted to save storage.
                </p>
              </div>

              {cleanupResult && (
                <div className="p-3.5 bg-zinc-100 rounded-xl space-y-1.5 text-[11px] border border-zinc-200">
                  <p className="font-bold text-zinc-900 flex items-center gap-1.5">
                    {cleanupResult.dryRun ? (
                      <span className="text-blue-700">🔍 Dry Run Analysis:</span>
                    ) : (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Purge Successfully Executed!
                      </span>
                    )}
                  </p>
                  <p className="text-zinc-700">
                    Pings matching threshold:{" "}
                    <strong>{cleanupResult.eligiblePings ?? cleanupResult.purgedPingsCount}</strong>
                  </p>
                  <p className="text-zinc-700">
                    Offline gaps matching threshold:{" "}
                    <strong>{cleanupResult.eligibleOfflineGaps ?? cleanupResult.purgedGapsCount}</strong>
                  </p>
                  <p className="text-zinc-400 text-[10px]">
                    Cutoff timestamp: {new Date(cleanupResult.cutoffDate).toLocaleString()}
                  </p>
                </div>
              )}

              {confirmPurgeStep && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2 animate-in fade-in">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Are you sure you want to permanently delete this telemetry?
                  </p>
                  <p className="text-[11px] text-amber-800">
                    This action will purge all raw GPS location pings older than {retentionDaysInput} days.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExecuteRetention(false)}
                      disabled={cleanupLoading}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs"
                    >
                      {cleanupLoading ? "Purging..." : "Yes, Purge Now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeStep(false)}
                      className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg font-semibold text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setShowCleanupModal(false);
                  setCleanupResult(null);
                  setCleanupError(null);
                  setConfirmPurgeStep(false);
                }}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRetention(true)}
                disabled={cleanupLoading}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold rounded-xl text-xs flex items-center gap-1"
              >
                {cleanupLoading ? "Analyzing..." : "Preview Dry Run"}
              </button>
              {!confirmPurgeStep && (
                <button
                  type="button"
                  onClick={() => setConfirmPurgeStep(true)}
                  disabled={cleanupLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  Execute Purge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
