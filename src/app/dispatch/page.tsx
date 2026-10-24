"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import LiveMap, { TechnicianPin } from "@/components/maps/LiveMap";
import DispatchTechDrawer from "@/components/drawers/DispatchTechDrawer";
import StatusBadge from "@/components/ui/StatusBadge";
import { Users, Briefcase, MapPin, RefreshCw, CheckCircle2, ChevronRight, Phone, ShieldCheck } from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";

export default function DispatchMapPage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState("");

  // Drawer state
  const [selectedTech, setSelectedTech] = useState<TechnicianPin | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/technicians");
      const data = await res.json();
      if (data?.technicians) setTechnicians(data.technicians);
      if (data?.unassignedJobs) setUnassignedJobs(data.unassignedJobs);
    } catch (e) {
      console.error("Failed loading dispatch data", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectTech = (tech: TechnicianPin) => {
    setSelectedTech(tech);
    setIsDrawerOpen(true);
    // Smoothly scroll map into view if scrolled down
    const mapEl = document.getElementById("dispatch-live-map");
    if (mapEl) {
      const rect = mapEl.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        mapEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  const handleAssignJob = async (jobId: string, technicianId: string) => {
    try {
      const assignedTech = technicians.find((t) => t.id === technicianId);
      if (!assignedTech?.isCheckedIn) {
        alert(`Cannot assign job: ${assignedTech?.name || "Technician"} is off duty and has not checked in today.`);
        return;
      }

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          technicianId,
          actor: "Zeeshan Ahmed (Dispatcher)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const jobObj = unassignedJobs.find((j) => j.id === jobId);

      setNotification("Job assigned successfully! WhatsApp dispatch instructions routed to technician.");
      setIsDrawerOpen(false);
      loadData();

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_ASSIGNED", {
        jobId,
        jobNumber: jobObj?.jobNumber,
        technicianId,
        technicianName: assignedTech?.name,
        actor: "Dispatcher Zeeshan Ahmed",
        message: `Dispatcher assigned Job #${jobObj?.jobNumber || ""} to ${assignedTech?.name || "Technician"}`,
        payload: { job: jobObj },
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const presentTechnicians = technicians.filter((t) => t.isCheckedIn);
  const availableCount = presentTechnicians.filter(
    (t) => t.currentStatus === "Available" || t.currentStatus === "Available & Ready"
  ).length;
  const onJobCount = presentTechnicians.filter((t) => t.currentStatus === "On Job").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Dispatch Map" }]}
        title="Live Field Dispatch & Proximity Map"
        subtitle="Real-time GPS technician tracking and proximity-based job assignment"
        secondaryActions={[
          {
            label: "Surveillance & Playback",
            icon: <ShieldCheck className="w-3.5 h-3.5" />,
            href: "/dispatch/surveillance",
          },
          {
            label: "Refresh Pins",
            icon: <RefreshCw className="w-3.5 h-3.5" />,
            onClick: loadData,
          },
        ]}
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
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Quick-Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              Available Techs
            </p>
            <p className="text-lg font-bold text-[#18181B] font-mono">{availableCount} Ready</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              On Active Jobs
            </p>
            <p className="text-lg font-bold text-[#18181B] font-mono">{onJobCount} In Progress</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              Unassigned Queue
            </p>
            <p className="text-lg font-bold text-[#18181B] font-mono">{unassignedJobs.length} Awaiting</p>
          </div>
        </div>
      </div>

      {/* Main Full-Bleed Map Container - Only present technicians plotted on map */}
      <div id="dispatch-live-map" className="relative">
        <LiveMap
          technicians={presentTechnicians}
          unassignedJobs={unassignedJobs}
          onSelectTech={handleSelectTech}
          selectedTechId={selectedTech?.id}
        />
      </div>

      {/* Technician Roster Bar below Map - Only present technicians show up in list */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7] mb-3">
          <div>
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
              <span>Present Field Technicians</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                {presentTechnicians.length} Active
              </span>
            </h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Only checked-in technicians are active on map and eligible for dispatch.
            </p>
          </div>
          {technicians.length > presentTechnicians.length && (
            <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200">
              {technicians.length - presentTechnicians.length} Off-Duty Hidden
            </span>
          )}
        </div>

        {presentTechnicians.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <Users className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-zinc-700">No technicians have checked in today</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Off-duty technicians are hidden. Once technicians check in on mobile attendance, they will immediately appear here and on the map.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {presentTechnicians.map((tech) => (
              <button
                key={tech.id}
                type="button"
                onClick={() => handleSelectTech(tech)}
                className="p-3 rounded-lg border border-[#E4E4E7] hover:border-[#0D7A5F] bg-[#FAFAFA] hover:bg-white text-left transition flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center">
                    {tech.name.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition">
                      {tech.name}
                    </p>
                    <p className="text-[11px] text-[#71717A] flex items-center gap-1 font-mono">
                      <Phone className="w-2.5 h-2.5" /> {tech.phone}
                    </p>
                  </div>
                </div>
                <StatusBadge status={tech.currentStatus} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DISPATCH TECH SIDE DRAWER (Sliding from Right, leaving map visible) */}
      <DispatchTechDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        technician={selectedTech}
        unassignedJobs={unassignedJobs}
        onAssignJob={handleAssignJob}
      />
    </div>
  );
}
