"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, Layers } from "lucide-react";

export interface PingData {
  id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  batteryLevel?: number | null;
  isMoving: boolean;
  isShiftActive: boolean;
  activeJob?: {
    id: string;
    jobNumber: string;
    status: string;
    customerName: string;
  } | null;
  source: string;
  timestamp: string;
}

export interface OfflineGapData {
  id: string;
  gapStartAt: string;
  gapEndAt: string | null;
  durationMinutes: number | null;
  lastKnownLat: number;
  lastKnownLng: number;
  resumeLat: number | null;
  resumeLng: number | null;
  lastBatteryLevel: number | null;
  reason: string | null;
}

interface RealSurveillanceMapProps {
  pings: PingData[];
  gaps: OfflineGapData[];
  currentPingIndex: number;
  onSelectPingIndex?: (index: number) => void;
  technicianName: string;
}

type MapLayerType = "streets" | "satellite" | "dark";

export default function RealSurveillanceMap({
  pings,
  gaps,
  currentPingIndex,
  onSelectPingIndex,
  technicianName,
}: RealSurveillanceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pathLayerRef = useRef<L.LayerGroup | null>(null);
  const playbackLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>("streets");

  const TILE_URLS: Record<MapLayerType, { url: string; attribution: string; maxZoom: number }> = {
    streets: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxZoom: 18,
    },
    dark: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    },
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] =
      pings.length > 0 ? [pings[0].lat, pings[0].lng] : [25.2048, 55.2708];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
    });

    const initialTileConfig = TILE_URLS.streets;
    const tileLayer = L.tileLayer(initialTileConfig.url, {
      attribution: initialTileConfig.attribution,
      maxZoom: initialTileConfig.maxZoom,
      subdomains: ["a", "b", "c"],
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    pathLayerRef.current = L.layerGroup().addTo(map);
    playbackLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Tile Layer switcher
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

  // 3. Render Path, Gap Lines, and Start/End Points
  useEffect(() => {
    if (!mapInstanceRef.current || !pathLayerRef.current) return;

    const pathGroup = pathLayerRef.current;
    pathGroup.clearLayers();

    if (pings.length === 0) return;

    const allBounds: L.LatLngTuple[] = [];

    // Draw Polylines between consecutive pings
    for (let i = 0; i < pings.length - 1; i++) {
      const p1 = pings[i];
      const p2 = pings[i + 1];
      allBounds.push([p1.lat, p1.lng]);

      // Color code: Green = On Active Job, Blue = Shift Transit, Slate = Off-shift
      let segmentColor = "#64748B"; // slate
      if (p1.isShiftActive && p1.activeJob) {
        segmentColor = "#0D7A5F"; // on job green
      } else if (p1.isShiftActive) {
        segmentColor = "#2563EB"; // shift transit blue
      }

      const segment = L.polyline(
        [
          [p1.lat, p1.lng],
          [p2.lat, p2.lng],
        ],
        {
          color: segmentColor,
          weight: 4,
          opacity: 0.85,
        }
      );
      pathGroup.addLayer(segment);
    }
    if (pings.length > 0) {
      allBounds.push([pings[pings.length - 1].lat, pings[pings.length - 1].lng]);
    }

    // Draw Offline Gap Lines (Red Dashed) & Markers
    gaps.forEach((gap) => {
      if (gap.lastKnownLat && gap.lastKnownLng) {
        allBounds.push([gap.lastKnownLat, gap.lastKnownLng]);

        if (gap.resumeLat && gap.resumeLng) {
          const gapLine = L.polyline(
            [
              [gap.lastKnownLat, gap.lastKnownLng],
              [gap.resumeLat, gap.resumeLng],
            ],
            {
              color: "#EF4444",
              weight: 3,
              dashArray: "6, 8",
              opacity: 0.9,
            }
          );
          pathGroup.addLayer(gapLine);
        }

        const gapHtml = `
          <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
            <div class="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
              <span class="text-[10px] font-black">!</span>
            </div>
            <div class="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-900 text-white text-[10px] p-2 rounded-lg shadow-xl border border-rose-500 pointer-events-none opacity-0 group-hover:opacity-100 transition z-50">
              <p class="font-bold text-rose-400">Offline Gap: ${gap.durationMinutes || 0} mins</p>
              <p class="text-zinc-300">Started: ${new Date(gap.gapStartAt).toLocaleTimeString()}</p>
              ${gap.gapEndAt ? `<p class="text-zinc-300">Resumed: ${new Date(gap.gapEndAt).toLocaleTimeString()}</p>` : ""}
              ${gap.lastBatteryLevel != null ? `<p class="text-zinc-400">Battery: ${gap.lastBatteryLevel}%</p>` : ""}
            </div>
          </div>
        `;
        const gapIcon = L.divIcon({
          html: gapHtml,
          className: "custom-gap-pin",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const gapMarker = L.marker([gap.lastKnownLat, gap.lastKnownLng], { icon: gapIcon });
        pathGroup.addLayer(gapMarker);
      }
    });

    // Start Marker (Green Pin "A")
    const startPing = pings[0];
    const startHtml = `
      <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
        <div class="px-2 py-1 bg-emerald-600 border-2 border-white text-white rounded-full font-bold text-[10px] shadow-lg flex items-center gap-1">
          <span>START</span>
        </div>
      </div>
    `;
    const startIcon = L.divIcon({
      html: startHtml,
      className: "custom-start-pin",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const startMarker = L.marker([startPing.lat, startPing.lng], { icon: startIcon });
    pathGroup.addLayer(startMarker);

    // End Marker (Black Pin "END")
    if (pings.length > 1) {
      const endPing = pings[pings.length - 1];
      const endHtml = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="px-2 py-1 bg-zinc-900 border-2 border-white text-white rounded-full font-bold text-[10px] shadow-lg flex items-center gap-1">
            <span>END</span>
          </div>
        </div>
      `;
      const endIcon = L.divIcon({
        html: endHtml,
        className: "custom-end-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const endMarker = L.marker([endPing.lat, endPing.lng], { icon: endIcon });
      pathGroup.addLayer(endMarker);
    }

    // Fit map bounds
    if (allBounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(allBounds, {
        padding: [50, 50],
        maxZoom: 16,
      });
    }
  }, [pings, gaps]);

  // 4. Render Active Playback Cursor Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !playbackLayerRef.current) return;

    const playbackGroup = playbackLayerRef.current;
    playbackGroup.clearLayers();

    if (pings.length === 0 || currentPingIndex < 0 || currentPingIndex >= pings.length) {
      return;
    }

    const ping = pings[currentPingIndex];
    const pingTime = new Date(ping.timestamp).toLocaleTimeString();
    const speedStr = ping.speed != null ? `${Math.round(ping.speed)} km/h` : "Stationary";
    const batteryStr = ping.batteryLevel != null ? `${Math.round(ping.batteryLevel)}%` : "—";

    const cursorHtml = `
      <div class="relative cursor-pointer" style="transform: translate(-50%, -50%);">
        <!-- Pulse Radar -->
        <div class="absolute -inset-3 rounded-full bg-[#0D7A5F] opacity-75 animate-ping pointer-events-none"></div>
        
        <!-- Live Marker Pin -->
        <div class="relative px-3 py-1.5 rounded-full bg-[#0D7A5F] text-white border-2 border-white shadow-2xl flex items-center gap-2">
          <div class="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></div>
          <div class="flex flex-col text-[10px] leading-tight font-sans">
            <span class="font-bold whitespace-nowrap">${technicianName}</span>
            <span class="text-[9px] text-emerald-100 font-mono">${pingTime} • ${speedStr}</span>
          </div>
        </div>

        <!-- Floating telemetry stats badge -->
        <div class="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-950/95 text-white text-[10px] py-1 px-2.5 rounded-md shadow-2xl border border-zinc-700 pointer-events-none flex items-center gap-2 z-50">
          <span>🔋 ${batteryStr}</span>
          <span>•</span>
          <span class="${ping.isMoving ? "text-emerald-400 font-semibold" : "text-amber-400"}">
            ${ping.isMoving ? "In Motion" : "Stopped"}
          </span>
          ${ping.activeJob ? `<span>•</span><span class="text-cyan-400">Job: ${ping.activeJob.jobNumber}</span>` : ""}
        </div>
      </div>
    `;

    const cursorIcon = L.divIcon({
      html: cursorHtml,
      className: "custom-playback-cursor",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([ping.lat, ping.lng], { icon: cursorIcon, zIndexOffset: 1000 });
    playbackGroup.addLayer(marker);

    // Pan map to follow cursor
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([ping.lat, ping.lng], { animate: true, duration: 0.5 });
    }
  }, [currentPingIndex, pings, technicianName]);

  return (
    <div className="relative w-full h-[540px] rounded-xl overflow-hidden border border-zinc-200 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Layer Switcher & Zoom Controls Floating Top Right */}
      <div className="absolute top-3 right-3 z-1000 flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 p-1 flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveLayer("streets")}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
              activeLayer === "streets"
                ? "bg-[#0D7A5F] text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Streets
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("satellite")}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
              activeLayer === "satellite"
                ? "bg-[#0D7A5F] text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("dark")}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
              activeLayer === "dark"
                ? "bg-[#0D7A5F] text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Dark
          </button>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 p-1 flex flex-col items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-700 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-4 h-px bg-zinc-200" />
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-700 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend Overlay Floating Bottom Left */}
      <div className="absolute bottom-3 left-3 z-1000 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-lg border border-zinc-200 text-[10px] space-y-1.5 font-medium text-zinc-700">
        <div className="font-bold text-[11px] text-zinc-900 mb-1">Route Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1 bg-[#0D7A5F] rounded-full inline-block" />
          <span>Active Job Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1 bg-[#2563EB] rounded-full inline-block" />
          <span>Shift / Transit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1 border-t-2 border-dashed border-[#EF4444] inline-block" />
          <span className="text-rose-600 font-semibold">Offline Signal Gap</span>
        </div>
      </div>
    </div>
  );
}
