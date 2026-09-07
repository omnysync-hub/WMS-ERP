"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import LiveMap, { TechnicianPin } from "@/components/maps/LiveMap";
import DispatchTechDrawer from "@/components/drawers/DispatchTechDrawer";
import StatusBadge from "@/components/ui/StatusBadge";
import { Users, Briefcase, MapPin, RefreshCw, CheckCircle2, ChevronRight, Phone } from "lucide-react";
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
  };

  const handleAssignJob = async (jobId: string, technicianId: string) => {
    try {
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
      const assignedTech = technicians.find((t) => t.id === technicianId);
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

  const availableCount = technicians.filter((t) => t.currentStatus === "Available").length;
  const onJobCount = technicians.filter((t) => t.currentStatus === "On Job").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Dispatch Map" }]}
        title="Live Field Dispatch & Proximity Map"
        subtitle="Real-time GPS technician tracking and proximity-based job assignment"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live GPS Sync
          </span>
        }
        primaryAction={{
          label: "New Job Intake",
          href: "/jobs/new",
        }}
        secondaryActions={[
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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

        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
              Telemetry Status
            </p>
            <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PubSub Streaming
            </p>
          </div>
          <button
            onClick={loadData}
            title="Refresh map pins"
            className="p-2 rounded-lg bg-[#FAFAFA] hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#71717A] hover:text-[#18181B] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            aria-label="Refresh telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Full-Bleed Map Container */}
      <div className="relative">
        <LiveMap
          technicians={technicians}
          unassignedJobs={unassignedJobs}
          onSelectTech={handleSelectTech}
          selectedTechId={selectedTech?.id}
        />
      </div>

      {/* Technician Roster Bar below Map */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7] mb-3">
          <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            Field Technicians Directory
          </h3>
          <span className="text-xs text-[#71717A]">
            Click any technician to open dispatch drawer
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {technicians.map((tech) => (
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
