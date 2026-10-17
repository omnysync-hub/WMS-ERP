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
  const hasInitialFitRef = useRef(false);

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

    // Default center around Lahore / Pakistan Metro Area
    const defaultCenter: [number, number] = [31.5204, 74.3587];

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
      subdomains: "abc",
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

      const pinColor = isAvailable
        ? "#0F9D58"
        : tech.currentStatus === "On Job"
        ? "#D97706"
        : "#2563EB";
      const statusBadgeClass = isAvailable
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : tech.currentStatus === "On Job"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-blue-50 text-blue-700 border-blue-200";

      const pinHtml = `
        <div class="relative group cursor-pointer" style="width: 34px; height: 44px;">
          <!-- Ground Ripple for Selected Marker -->
          ${
            isSelected
              ? `<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#0D7A5F]/30 animate-ping pointer-events-none"></div>`
              : ""
          }

          <!-- Google Maps Floating Label Pill -->
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10 transition-transform duration-150 group-hover:scale-105">
            <div class="px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs border border-zinc-200 shadow-md flex items-center gap-1.5 text-zinc-900">
              <span class="w-1.5 h-1.5 rounded-full shrink-0 ${
                isAvailable ? "bg-emerald-500" : "bg-amber-500"
              }"></span>
              <span class="font-sans text-[11px] font-bold tracking-tight text-[#18181B] max-w-[110px] truncate leading-none">${tech.name}</span>
            </div>
          </div>

          <!-- Google Maps Teardrop Pin SVG -->
          <div class="relative w-full h-full transition-transform duration-150 group-hover:-translate-y-1 ${
            isSelected ? "scale-110 drop-shadow-xl" : "drop-shadow-md"
          }">
            <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Ground Contact Shadow -->
              <ellipse cx="17" cy="42" rx="6.5" ry="2" fill="rgba(15,23,42,0.3)"/>
              <!-- Pin Teardrop Body -->
              <path d="M17 1.5C8.99 1.5 2.5 7.99 2.5 16C2.5 26.8 17 41.5 17 41.5C17 41.5 31.5 26.8 31.5 16C31.5 7.99 25.01 1.5 17 1.5Z" fill="${pinColor}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
              <!-- Inner White Disc -->
              <circle cx="17" cy="16" r="7.5" fill="#FFFFFF"/>
              <!-- Icon inside disc -->
              ${
                isAvailable
                  ? `<path d="M17 12.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm-4.2 7c0-1.7 1.9-2.5 4.2-2.5 2.3 0 4.2.8 4.2 2.5v.5h-8.4v-.5z" fill="${pinColor}"/>`
                  : `<path d="M19.5 13.5l-1-1a2.6 2.6 0 00-3.1-.3l1.7 1.7-1.3 1.3-1.7-1.7a2.6 2.6 0 00.3 3.1l.8.8a2.6 2.6 0 003.1.3l-1.7-1.7 1.3-1.3 1.7 1.7a2.6 2.6 0 00-.2-3.1z" fill="${pinColor}"/>`
              }
            </svg>
          </div>

          <!-- Professional Google Infowindow Popover (active when selected or on hover) -->
          <div class="absolute bottom-[50px] left-1/2 -translate-x-1/2 w-52 bg-white rounded-xl shadow-2xl border border-zinc-200/90 p-3 pointer-events-none transition-all duration-200 z-50 origin-bottom ${
            isSelected
              ? "opacity-100 scale-100 ring-2 ring-[#0D7A5F]"
              : "opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
          }">
            <div class="flex items-center justify-between pb-1.5 border-b border-zinc-100 mb-2">
              <span class="font-bold text-xs text-zinc-900 truncate max-w-[120px]">${tech.name}</span>
              <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${statusBadgeClass}">
                ${tech.currentStatus}
              </span>
            </div>
            <div class="text-[11px] text-zinc-600 flex items-center gap-1.5 mb-1 font-mono">
              <span class="text-zinc-400">📞</span>
              <span>${tech.phone || "No phone"}</span>
            </div>
            ${
              tech.activeJob
                ? `
              <div class="mt-1.5 pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px]">
                <span class="text-zinc-500 font-medium">Active Job:</span>
                <span class="text-[#0D7A5F] font-mono font-bold">${tech.activeJob.jobNumber}</span>
              </div>
            `
                : ""
            }
            <!-- Bottom Caret Arrow pointing to pin -->
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-zinc-200 rotate-45"></div>
          </div>
        </div>
      `;

      const techIcon = L.divIcon({
        html: pinHtml,
        className: "custom-google-pin",
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -44],
      });

      const marker = L.marker([tech.lat, tech.lng], { icon: techIcon });
      marker.on("click", () => {
        if (mapInstanceRef.current && tech.lat && tech.lng) {
          mapInstanceRef.current.flyTo([tech.lat, tech.lng], 16, {
            duration: 1.2,
            easeLinearity: 0.25,
          });
        }
        onSelectTech?.(tech);
      });

      markersGroup.addLayer(marker);
    });

    // 2. Add Unassigned Job Beacons
    unassignedJobs.forEach((job) => {
      const lat = job.customer?.lat || 25.18 + Math.random() * 0.08;
      const lng = job.customer?.lng || 55.24 + Math.random() * 0.1;
      bounds.push([lat, lng]);

      const jobHtml = `
        <div class="relative group cursor-pointer" style="width: 32px; height: 42px;">
          <!-- Floating Job Code Pill -->
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10">
            <div class="px-2 py-0.5 rounded-full bg-rose-700 border border-rose-600 shadow-md text-white text-[10px] font-mono font-bold tracking-tight">
              ${job.jobNumber}
            </div>
          </div>

          <!-- Google Maps Job Destination Pin SVG (Red) -->
          <div class="relative w-full h-full transition-transform duration-150 group-hover:-translate-y-1 drop-shadow-md">
            <svg width="32" height="42" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="17" cy="42" rx="6.5" ry="2" fill="rgba(15,23,42,0.3)"/>
              <path d="M17 1.5C8.99 1.5 2.5 7.99 2.5 16C2.5 26.8 17 41.5 17 41.5C17 41.5 31.5 26.8 31.5 16C31.5 7.99 25.01 1.5 17 1.5Z" fill="#EA4335" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="17" cy="16" r="7.5" fill="#FFFFFF"/>
              <!-- Briefcase / Work Order Icon inside -->
              <path d="M14 13h6v1.5h-6z M12 14.5h10v5.5H12z" fill="#EA4335"/>
            </svg>
          </div>

          <!-- Tooltip Popover -->
          <div class="absolute bottom-[48px] left-1/2 -translate-x-1/2 w-52 bg-white rounded-xl shadow-2xl border border-zinc-200/90 p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 scale-95 group-hover:scale-100 origin-bottom">
            <p class="font-bold text-xs text-rose-600 font-mono">${job.jobNumber}</p>
            <p class="text-xs font-semibold text-zinc-800 mt-0.5">${job.customer?.name || "Customer"}</p>
            <p class="text-[10px] text-zinc-500 mt-1 line-clamp-2">${job.customer?.addressText || "No address specified"}</p>
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-zinc-200 rotate-45"></div>
          </div>
        </div>
      `;

      const jobIcon = L.divIcon({
        html: jobHtml,
        className: "custom-job-pin",
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42],
      });

      const marker = L.marker([lat, lng], { icon: jobIcon });
      markersGroup.addLayer(marker);
    });

    // Auto-fit view only on initial load if no technician selected
    if (bounds.length > 0 && mapInstanceRef.current) {
      if (!selectedTechId && !hasInitialFitRef.current) {
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 14,
        });
        hasInitialFitRef.current = true;
      }
    }
  }, [technicians, unassignedJobs, selectedTechId, onSelectTech]);

  // Smoothly zoom in and fly to selected technician whenever selectedTechId changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedTechId) return;
    const targetTech = technicians.find((t) => t.id === selectedTechId);
    if (targetTech?.lat && targetTech?.lng) {
      mapInstanceRef.current.flyTo([targetTech.lat, targetTech.lng], 16, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [selectedTechId, technicians]);

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
