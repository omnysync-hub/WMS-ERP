"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Users, CheckCircle2, Briefcase, MapPin, Loader2 } from "lucide-react";

export interface TechnicianPin {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  currentStatus: string;
  activeJob?: {
    id: string;
    jobNumber: string;
    customerName: string;
    status: string;
  } | null;
}

interface LiveMapProps {
  technicians: TechnicianPin[];
  unassignedJobs?: any[];
  onSelectTech?: (tech: TechnicianPin) => void;
  selectedTechId?: string | null;
}

// Client-only dynamic import for Leaflet map to prevent SSR window issues
const RealLeafletMap = dynamic(() => import("./RealLeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[640px] rounded-xl bg-[#18181B] border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 gap-3">
      <Loader2 className="w-8 h-8 text-[#0D7A5F] animate-spin" />
      <span className="text-xs font-semibold">Initializing GPS Satellite Map...</span>
    </div>
  ),
});

export default function LiveMap({
  technicians,
  unassignedJobs = [],
  onSelectTech,
  selectedTechId,
}: LiveMapProps) {
  const [filter, setFilter] = useState<"ALL" | "AVAILABLE" | "ON_JOB">("ALL");
  const [showUnassigned, setShowUnassigned] = useState(true);

  const filteredTechnicians = technicians.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "AVAILABLE") return t.currentStatus === "Available";
    if (filter === "ON_JOB") return t.currentStatus === "On Job";
    return true;
  });

  const availableCount = technicians.filter((t) => t.currentStatus === "Available").length;
  const onJobCount = technicians.filter((t) => t.currentStatus === "On Job").length;

  return (
    <div className="space-y-3">
      {/* Top Filter & Dispatch Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#EDEDED] shadow-2xs">
        {/* Left: Quick Status Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filter === "ALL"
                ? "bg-[#0D7A5F] text-white shadow-xs"
                : "bg-[#F4F4F5] text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Technicians ({technicians.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("AVAILABLE")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              filter === "AVAILABLE"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Available ({availableCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ON_JOB")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              filter === "ON_JOB"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            On Job ({onJobCount})
          </button>
        </div>

        {/* Right: Unassigned Jobs Toggle */}
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setShowUnassigned(!showUnassigned)}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 border ${
              showUnassigned
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Unassigned Jobs ({unassignedJobs.length})</span>
            <span className="text-[10px] font-mono ml-0.5">{showUnassigned ? "Visible" : "Hidden"}</span>
          </button>
        </div>
      </div>

      {/* The Real Interactive Leaflet Map */}
      <RealLeafletMap
        technicians={filteredTechnicians}
        unassignedJobs={showUnassigned ? unassignedJobs : []}
        onSelectTech={onSelectTech}
        selectedTechId={selectedTechId}
      />
    </div>
  );
}
