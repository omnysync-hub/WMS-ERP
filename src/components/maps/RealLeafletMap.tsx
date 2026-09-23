"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TechnicianPin } from "./LiveMap";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

interface RealLeafletMapProps {
  technicians: TechnicianPin[];
  unassignedJobs?: any[];
  onSelectTech?: (tech: TechnicianPin) => void;
  selectedTechId?: string | null;
}

type MapLayerType = "streets" | "satellite" | "dark";

export default function RealLeafletMap({
  technicians,
  unassignedJobs = [],
  onSelectTech,
  selectedTechId,
}: RealLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>("streets");

  const TILE_URLS: Record<MapLayerType, { url: string; attribution: string; maxZoom: number }> = {
    streets: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      maxZoom: 18,
    },
    dark: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center around Dubai / UAE Metro Area
    const defaultCenter: [number, number] = [25.2048, 55.2708];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: false,
    });

    const initialTileConfig = TILE_URLS.streets;
    const tileLayer = L.tileLayer(initialTileConfig.url, {
      attribution: initialTileConfig.attribution,
      maxZoom: initialTileConfig.maxZoom,
      subdomains: ["a", "b", "c"],
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when user switches layers
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    const map = mapInstanceRef.current;
    map.removeLayer(tileLayerRef.current);

    const config = TILE_URLS[activeLayer];
    const newTileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: activeLayer === "streets" ? ["a", "b", "c"] : undefined,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [activeLayer]);

  // Update Markers when technicians or jobs change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    // 1. Add Technician Markers
    technicians.forEach((tech) => {
      if (!tech.lat || !tech.lng) return;

      const isSelected = selectedTechId === tech.id;
      const isAvailable = tech.currentStatus === "Available";
      bounds.push([tech.lat, tech.lng]);

      const pinHtml = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
          <!-- Pulse Radar Ring -->
          <div class="absolute -inset-2 rounded-full opacity-70 animate-ping pointer-events-none ${
            isAvailable ? "bg-emerald-400" : "bg-amber-400"
          }"></div>
          
          <!-- Pill Badge -->
          <div class="relative px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xl border-2 text-xs font-bold transition-transform group-hover:scale-110 ${
            isSelected ? "ring-4 ring-[#0D7A5F] ring-offset-2 ring-offset-black" : ""
          } ${
            isAvailable
              ? "bg-[#064E3B] border-emerald-400 text-white"
              : "bg-[#78350F] border-amber-400 text-white"
          }">
            <span class="w-2 h-2 rounded-full ${isAvailable ? "bg-emerald-300 animate-pulse" : "bg-amber-300"}"></span>
            <span class="whitespace-nowrap font-sans text-[11px] font-bold tracking-tight">${tech.name}</span>
          </div>

          <!-- Quick Tooltip -->
          <div class="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#18181B] text-white text-[10px] font-semibold py-1 px-2 rounded shadow-xl border border-zinc-700 pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            ${tech.currentStatus} • ${tech.phone}
            ${tech.activeJob ? `<br /><span class="text-emerald-400 font-mono">Job: ${tech.activeJob.jobNumber}</span>` : ""}
          </div>
        </div>
      `;

      const techIcon = L.divIcon({
        html: pinHtml,
        className: "custom-leaflet-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([tech.lat, tech.lng], { icon: techIcon });
      marker.on("click", () => {
        onSelectTech?.(tech);
      });

      markersGroup.addLayer(marker);
    });

    // 2. Add Unassigned Job Beacons
    unassignedJobs.forEach((job) => {
      const lat = job.customer?.lat || (25.18 + Math.random() * 0.08);
      const lng = job.customer?.lng || (55.24 + Math.random() * 0.1);
      bounds.push([lat, lng]);

      const jobHtml = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
          <!-- Beacon pulse -->
          <div class="absolute -inset-2.5 rounded-full bg-rose-500 opacity-60 animate-ping pointer-events-none"></div>
          
          <div class="relative px-2 py-1 rounded-lg bg-rose-950 border-2 border-rose-500 text-white flex items-center gap-1 shadow-2xl transition-transform group-hover:scale-110">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span class="font-mono text-[10px] font-black tracking-tighter text-rose-200">JOB</span>
          </div>

          <div class="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#18181B] text-white text-[10px] p-2 rounded-lg shadow-xl border border-rose-500/50 pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            <p class="font-bold text-rose-300">${job.jobNumber}</p>
            <p class="text-zinc-300">${job.customer?.name || "Customer"}</p>
            <p class="text-[9px] text-zinc-400 truncate max-w-[160px]">${job.customer?.addressText || ""}</p>
          </div>
        </div>
      `;

      const jobIcon = L.divIcon({
        html: jobHtml,
        className: "custom-job-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon: jobIcon });
      markersGroup.addLayer(marker);
    });

    // Auto-fit view if markers exist and bounds are valid
    if (bounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 14,
      });
    }
  }, [technicians, unassignedJobs, selectedTechId, onSelectTech]);

  // Map Controls Helpers
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitBounds = () => {
    const bounds: L.LatLngTuple[] = [];
    technicians.forEach((t) => t.lat && t.lng && bounds.push([t.lat, t.lng]));
    unassignedJobs.forEach((j) => {
      if (j.customer?.lat && j.customer?.lng) bounds.push([j.customer.lat, j.customer.lng]);
    });
    if (bounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div className="relative w-full h-[640px] rounded-xl overflow-hidden border border-[#E4E4E7] shadow-inner">
      {/* The Real Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Layer Switcher (Streets, Satellite, Dark) */}
      <div className="absolute top-4 left-4 z-10 flex items-center bg-[#18181B]/90 backdrop-blur-md p-1 rounded-xl border border-zinc-700 shadow-xl text-xs">
        <button
          type="button"
          onClick={() => setActiveLayer("streets")}
          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeLayer === "streets"
              ? "bg-[#0D7A5F] text-white shadow-xs"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <span>🗺️ Street Map</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveLayer("satellite")}
          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeLayer === "satellite"
              ? "bg-[#0D7A5F] text-white shadow-xs"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <span>🛰️ Satellite</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveLayer("dark")}
          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeLayer === "dark"
              ? "bg-[#0D7A5F] text-white shadow-xs"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <span>🌙 Night Ops</span>
        </button>
      </div>

      {/* Map Control Buttons (Zoom & Fit Bounds) */}
      <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-1.5 bg-[#18181B]/90 backdrop-blur-md p-1 rounded-xl border border-zinc-700 shadow-xl">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-zinc-700 my-0.5" />
        <button
          type="button"
          onClick={handleFitBounds}
          className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 rounded-lg transition"
          title="Fit All Units on Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Proximity Dispatch Hint Pill */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-2 bg-[#18181B]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-700 text-xs text-zinc-200 shadow-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Click technician pin to slide open dispatch drawer</span>
      </div>
    </div>
  );
}
