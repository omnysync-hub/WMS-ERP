"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, Layers, Compass, Focus, Navigation } from "lucide-react";

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
  autoFollow?: boolean;
  onToggleAutoFollow?: (follow: boolean) => void;
}

type MapLayerType = "streets" | "satellite" | "dark";

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export default function RealSurveillanceMap({
  pings,
  gaps,
  currentPingIndex,
  onSelectPingIndex,
  technicianName,
  autoFollow = true,
  onToggleAutoFollow,
}: RealSurveillanceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pathLayerRef = useRef<L.LayerGroup | null>(null);
  const playbackLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Persistent marker and progress polyline for zero-stutter 60fps playback
  const cursorMarkerRef = useRef<L.Marker | null>(null);
  const progressLineRef = useRef<L.Polyline | null>(null);
  const boundsAllRef = useRef<L.LatLngTuple[]>([]);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>("streets");
  const [internalAutoFollow, setInternalAutoFollow] = useState(autoFollow);

  useEffect(() => {
    setInternalAutoFollow(autoFollow);
  }, [autoFollow]);

  const toggleFollow = () => {
    const next = !internalAutoFollow;
    setInternalAutoFollow(next);
    onToggleAutoFollow?.(next);
  };

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
      pings.length > 0 ? [pings[0].lat, pings[0].lng] : [31.5204, 74.3587];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
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
      cursorMarkerRef.current = null;
      progressLineRef.current = null;
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

  // 3. Render Base Path, Gap Lines, and Start/End Points
  useEffect(() => {
    if (!mapInstanceRef.current || !pathLayerRef.current) return;

    const pathGroup = pathLayerRef.current;
    pathGroup.clearLayers();

    if (pings.length === 0) return;

    const allBounds: L.LatLngTuple[] = [];

    // Background base route (subdued path)
    for (let i = 0; i < pings.length - 1; i++) {
      const p1 = pings[i];
      const p2 = pings[i + 1];
      allBounds.push([p1.lat, p1.lng]);

      let segmentColor = "#94A3B8"; // light slate base
      if (p1.isShiftActive && p1.activeJob) {
        segmentColor = "#0D7A5F";
      } else if (p1.isShiftActive) {
        segmentColor = "#3B82F6";
      }

      const segment = L.polyline(
        [
          [p1.lat, p1.lng],
          [p2.lat, p2.lng],
        ],
        {
          color: segmentColor,
          weight: 4,
          opacity: 0.45,
          dashArray: "3, 6",
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

    // Start Marker (Green Pin "START")
    const startPing = pings[0];
    const startHtml = `
      <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
        <div class="px-2 py-0.5 bg-emerald-600 border-2 border-white text-white rounded-full font-bold text-[9px] shadow-lg flex items-center gap-1">
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

    // End Marker (Black Pin "DESTINATION")
    if (pings.length > 1) {
      const endPing = pings[pings.length - 1];
      const endHtml = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="px-2 py-0.5 bg-zinc-900 border-2 border-white text-white rounded-full font-bold text-[9px] shadow-lg flex items-center gap-1">
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

    boundsAllRef.current = allBounds;

    // Initial fit
    if (allBounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(allBounds, {
        padding: [60, 60],
        maxZoom: 16,
      });
    }
  }, [pings, gaps]);

  // Fit all bounds handler
  const fitAllBounds = () => {
    if (boundsAllRef.current.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(boundsAllRef.current, {
        padding: [60, 60],
        maxZoom: 16,
      });
    }
  };

  // 4. Smooth 60fps Active Playback Cursor & Travelled Progress Trail
  useEffect(() => {
    if (!mapInstanceRef.current || !playbackLayerRef.current) return;

    const playbackGroup = playbackLayerRef.current;

    if (pings.length === 0 || currentPingIndex < 0 || currentPingIndex >= pings.length) {
      if (cursorMarkerRef.current) {
        playbackGroup.removeLayer(cursorMarkerRef.current);
        cursorMarkerRef.current = null;
      }
      if (progressLineRef.current) {
        playbackGroup.removeLayer(progressLineRef.current);
        progressLineRef.current = null;
      }
      return;
    }

    const ping = pings[currentPingIndex];
    const pingTime = new Date(ping.timestamp).toLocaleTimeString();
    const speedStr = ping.speed != null ? `${Math.round(ping.speed)} km/h` : "Idle";
    const batteryStr = ping.batteryLevel != null ? `${Math.round(ping.batteryLevel)}%` : "—";

    // Heading calculation
    let bearing = 0;
    if (currentPingIndex < pings.length - 1) {
      bearing = calculateBearing(ping.lat, ping.lng, pings[currentPingIndex + 1].lat, pings[currentPingIndex + 1].lng);
    } else if (currentPingIndex > 0) {
      bearing = calculateBearing(pings[currentPingIndex - 1].lat, pings[currentPingIndex - 1].lng, ping.lat, ping.lng);
    }

    // 4a. Update Travelled Progress Polyline (Bright Emerald Glow)
    const travelledPoints: L.LatLngTuple[] = pings
      .slice(0, currentPingIndex + 1)
      .map((p) => [p.lat, p.lng]);

    if (!progressLineRef.current) {
      const newLine = L.polyline(travelledPoints, {
        color: "#10B981", // vibrant emerald
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });
      progressLineRef.current = newLine;
      playbackGroup.addLayer(newLine);
    } else {
      progressLineRef.current.setLatLngs(travelledPoints);
    }

    // 4b. Smooth Video-Player Marker Pin with Bearing Direction Arrow
    const cursorHtml = `
      <div class="relative cursor-pointer" style="transform: translate(-50%, -50%);">
        <!-- Pulse Radar Glow -->
        <div class="absolute -inset-2.5 rounded-full bg-emerald-500 opacity-60 animate-ping pointer-events-none"></div>
        
        <!-- Main Marker Pill with Heading Arrow -->
        <div class="relative px-2.5 py-1 rounded-full bg-[#0D7A5F] text-white border-2 border-white shadow-2xl flex items-center gap-1.5 backdrop-blur-sm">
          <div class="w-3.5 h-3.5 rounded-full bg-emerald-400 flex items-center justify-center text-zinc-900 transition-transform duration-300" style="transform: rotate(${Math.round(bearing)}deg);">
            <svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
          <div class="flex flex-col text-[10px] leading-tight font-sans">
            <span class="font-bold whitespace-nowrap">${technicianName}</span>
            <span class="text-[8.5px] text-emerald-100 font-mono">${pingTime} • ${speedStr}</span>
          </div>
        </div>

        <!-- Floating telemetry stats badge -->
        <div class="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-950/90 text-white text-[9.5px] py-0.5 px-2 rounded-md shadow-2xl border border-zinc-700 pointer-events-none flex items-center gap-1.5 z-50">
          <span>🔋 ${batteryStr}</span>
          <span>•</span>
          <span class="${ping.isMoving ? "text-emerald-400 font-bold" : "text-amber-400"}">
            ${ping.isMoving ? "Moving" : "Stopped"}
          </span>
          ${ping.activeJob ? `<span>•</span><span class="text-cyan-400 font-mono font-bold">#${ping.activeJob.jobNumber}</span>` : ""}
        </div>
      </div>
    `;

    const cursorIcon = L.divIcon({
      html: cursorHtml,
      className: "custom-playback-cursor",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    if (!cursorMarkerRef.current) {
      const marker = L.marker([ping.lat, ping.lng], { icon: cursorIcon, zIndexOffset: 2000 });
      cursorMarkerRef.current = marker;
      playbackGroup.addLayer(marker);
    } else {
      cursorMarkerRef.current.setLatLng([ping.lat, ping.lng]);
      cursorMarkerRef.current.setIcon(cursorIcon);
    }

    // 4c. Non-stuttering camera auto-follow: Only pan when marker drifts toward viewport edge
    if (internalAutoFollow && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const bounds = map.getBounds();
      // Comfort zone: 15% inner boundary padding
      const padBounds = bounds.pad(-0.15);
      if (!padBounds.contains([ping.lat, ping.lng])) {
        map.panTo([ping.lat, ping.lng], { animate: true, duration: 0.35 });
      }
    }
  }, [currentPingIndex, pings, technicianName, internalAutoFollow]);

  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-zinc-200 shadow-md">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Layer Switcher & Camera Controls Floating Top Right */}
      <div className="absolute top-3 right-3 z-1000 flex flex-col items-end gap-2">
        {/* Layer Tabs */}
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

        {/* Camera Follow Toggle & Fit Route */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleFollow}
            title={internalAutoFollow ? "Camera is locked to technician (Click to unlock)" : "Camera is free (Click to lock to technician)"}
            className={`px-2.5 py-1.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition ${
              internalAutoFollow
                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20"
                : "bg-white/95 text-zinc-700 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${internalAutoFollow ? "animate-spin" : ""}`} />
            <span>{internalAutoFollow ? "Camera: Follow" : "Camera: Free"}</span>
          </button>

          <button
            type="button"
            onClick={fitAllBounds}
            title="Fit Entire Trajectory Route"
            className="px-2.5 py-1.5 bg-white/95 backdrop-blur-md hover:bg-zinc-50 rounded-xl shadow-lg border border-zinc-200 text-xs font-semibold text-zinc-700 flex items-center gap-1 transition"
          >
            <Focus className="w-3.5 h-3.5 text-[#0D7A5F]" />
            <span>Fit Route</span>
          </button>
        </div>

        {/* Zoom Buttons */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 p-1 flex flex-col items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-700 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-4 h-px bg-zinc-200" />
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-700 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Route Legend Floating Bottom Left */}
      <div className="absolute bottom-3 left-3 z-1000 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-lg border border-zinc-200 text-[10px] space-y-1.5 font-medium text-zinc-700">
        <div className="font-bold text-[11px] text-zinc-900 mb-1 flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-[#0D7A5F]" />
          Trajectory Legend
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#10B981] rounded-full inline-block shadow-xs" />
          <span className="text-emerald-800 font-bold">Played Route (Covered)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1 border-t-2 border-dashed border-slate-400 inline-block" />
          <span>Upcoming Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1 border-t-2 border-dashed border-[#EF4444] inline-block" />
          <span className="text-rose-600 font-semibold">Offline Signal Gap</span>
        </div>
      </div>
    </div>
  );
}
