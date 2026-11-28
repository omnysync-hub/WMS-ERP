"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, Layers, Compass, Focus, Navigation } from "lucide-react";
import {
  formatBatteryPercent,
  formatDurationMinutes,
  formatPktTime,
} from "./surveillanceFormat";
import {
  classifySegment,
  deriveStops,
  haversineKm,
  initialsOf,
  type SegmentKind,
} from "@/lib/routeTrack";

export { formatBatteryPercent, formatDurationMinutes } from "./surveillanceFormat";

export interface PingData {
  id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  /** OS mock-location flag: this fix was rejected as position evidence. */
  mocked?: boolean;
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

/** Base (not yet played) style for one ping-pair segment. */
function basePairStyle(kind: SegmentKind, fromPing: PingData): L.PolylineOptions {
  if (kind !== "track") {
    // Offline gap or impossible GPS jump: never drawn as travel.
    return { color: "#A1A1AA", weight: 3, opacity: 0.8, dashArray: "2, 7", lineCap: "round" };
  }
  const color = fromPing.activeJob ? "#0D7A5F" : fromPing.isShiftActive ? "#3B82F6" : "#94A3B8";
  return { color, weight: 4, opacity: 0.5, lineCap: "round", lineJoin: "round" };
}

/** Style once playback has covered the segment. Gaps stay grey — forever. */
function travelledPairStyle(kind: SegmentKind): L.PolylineOptions {
  if (kind !== "track") {
    return { color: "#71717A", weight: 3, opacity: 0.9, dashArray: "2, 7", lineCap: "round" };
  }
  return { color: "#10B981", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round" };
}

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

  // Persistent cursor marker for zero-stutter playback. The route itself is
  // drawn once per data load as one polyline per ping pair; playback only
  // restyles the pairs behind the cursor (cheap setStyle, no layer rebuild).
  const cursorMarkerRef = useRef<L.Marker | null>(null);
  const cursorCircleRef = useRef<L.Circle | null>(null);
  const pairLayersRef = useRef<
    { layer: L.Polyline; base: L.PolylineOptions; travelled: L.PolylineOptions }[]
  >([]);
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

  // Route structure, derived once per data load with the SAME classifier the
  // history API uses for its distance total — map, totals and timeline agree.
  const segments = useMemo(
    () => pings.slice(1).map((p, i) => classifySegment(pings[i], p)),
    [pings]
  );
  const stops = useMemo(() => deriveStops(pings), [pings]);

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
      cursorCircleRef.current = null;
      pairLayersRef.current = [];
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

  // 3. Render Base Path (segment-aware), Gap Markers, Stops, Start/End Points
  useEffect(() => {
    if (!mapInstanceRef.current || !pathLayerRef.current) return;

    const pathGroup = pathLayerRef.current;
    pathGroup.clearLayers();
    pairLayersRef.current = [];

    if (pings.length === 0) return;

    const allBounds: L.LatLngTuple[] = pings.map((p) => [p.lat, p.lng] as L.LatLngTuple);

    // One polyline per ping pair, styled by segment kind: real movement is a
    // solid line; an offline gap or an impossible GPS jump is a dashed grey
    // connector — the route never pretends unobserved movement happened.
    segments.forEach((seg, i) => {
      const p1 = pings[i];
      const p2 = pings[i + 1];
      const line = L.polyline(
        [
          [p1.lat, p1.lng],
          [p2.lat, p2.lng],
        ],
        basePairStyle(seg.kind, p1)
      );
      pathGroup.addLayer(line);
      pairLayersRef.current.push({
        layer: line,
        base: basePairStyle(seg.kind, p1),
        travelled: travelledPairStyle(seg.kind),
      });
    });

    // Direction chevrons along real segments only (capped for legibility).
    const trackPairs = segments
      .map((seg, i) => (seg.kind === "track" ? i : -1))
      .filter((i) => i >= 0);
    const stride = Math.max(1, Math.floor(trackPairs.length / 28));
    trackPairs.forEach((pairIdx, k) => {
      if (k % stride !== 0) return;
      const a = pings[pairIdx];
      const b = pings[pairIdx + 1];
      if (haversineKm(a.lat, a.lng, b.lat, b.lng) < 0.03) return;
      const bearing = Math.round(calculateBearing(a.lat, a.lng, b.lat, b.lng));
      const chevronIcon = L.divIcon({
        html: `<div style="transform: rotate(${bearing}deg); width:14px; height:14px;">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 15.5 12 8l7 7.5" fill="none" stroke="#64748B" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>`,
        className: "route-chevron",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      pathGroup.addLayer(
        L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
          icon: chevronIcon,
          interactive: false,
        })
      );
    });

    // Offline gap markers (the dashed grey connector itself is drawn by the
    // segment renderer above — the gap's silence IS a segment break).
    gaps.forEach((gap) => {
      if (gap.lastKnownLat && gap.lastKnownLng) {
        const gapIcon = L.divIcon({
          html: `
            <div style="transform: translate(-50%, -50%);">
              <div class="w-6 h-6 rounded-full bg-white text-rose-600 flex items-center justify-center border-2 border-rose-500 shadow-md">
                <span class="text-[11px] font-black leading-none">!</span>
              </div>
            </div>
          `,
          className: "custom-gap-pin",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const gapMarker = L.marker([gap.lastKnownLat, gap.lastKnownLng], { icon: gapIcon });
        gapMarker.bindTooltip(
          `<div style="font-size:11px; line-height:1.5;">
            <strong style="color:#BE123C;">Offline gap · ${formatDurationMinutes(gap.durationMinutes || 0)}</strong><br/>
            Signal lost: ${formatPktTime(gap.gapStartAt)} PKT<br/>
            ${gap.gapEndAt ? `Resumed: ${formatPktTime(gap.gapEndAt)} PKT<br/>` : "Not yet resumed<br/>"}
            ${gap.lastBatteryLevel != null ? `Last battery: ${formatBatteryPercent(gap.lastBatteryLevel)}` : ""}
          </div>`,
          { direction: "top", offset: [0, -14] }
        );
        pathGroup.addLayer(gapMarker);
      }
    });

    // Mocked-fix markers: a device-reported fake location is shown for
    // what it is — a rejected attempt — never as part of the route (the
    // segment classifier already dashes every segment touching one).
    pings.forEach((p) => {
      if (!p.mocked) return;
      const mockMarker = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        color: "#E11D48",
        weight: 2,
        fillColor: "#FB7185",
        fillOpacity: 0.7,
      });
      mockMarker.bindTooltip(
        `<div style="font-size:11px; line-height:1.5;">
          <strong style="color:#BE123C;">Mocked location — rejected</strong><br/>
          Device reported a fake GPS fix at ${formatPktTime(p.timestamp)} PKT.<br/>
          Not used as position evidence.
        </div>`,
        { direction: "top", offset: [0, -8] }
      );
      pathGroup.addLayer(mockMarker);
    });

    // Stop markers, numbered in visit order — derived only from real ping
    // clusters (see deriveStops), never placed by hand or by guessing.
    stops.forEach((stop, idx) => {
      const stopIcon = L.divIcon({
        html: `
          <div style="transform: translate(-50%, -50%);">
            <div class="w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 border-[#0D7A5F] shadow-md">
              <span class="text-[11px] font-extrabold text-[#0D7A5F] leading-none">${idx + 1}</span>
            </div>
          </div>
        `,
        className: "custom-stop-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopIcon });
      stopMarker.bindTooltip(
        `<div style="font-size:11px; line-height:1.5;">
          <strong>Stop ${idx + 1}</strong> · stopped ${formatDurationMinutes(stop.durationMinutes)}<br/>
          ${formatPktTime(stop.startTimestamp)} – ${formatPktTime(stop.endTimestamp)} PKT
        </div>`,
        { direction: "top", offset: [0, -14] }
      );
      pathGroup.addLayer(stopMarker);
    });

    // Start Marker
    const startPing = pings[0];
    const startIcon = L.divIcon({
      html: `
        <div style="transform: translate(-50%, -50%);">
          <div class="flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 bg-emerald-600 border-2 border-white text-white rounded-full shadow-lg">
            <span class="w-3.5 h-3.5 rounded-full bg-white/25 flex items-center justify-center">
              <svg class="w-2 h-2 fill-current" viewBox="0 0 24 24"><path d="M6 3l14 9-14 9z"/></svg>
            </span>
            <span class="font-bold text-[9px] tracking-wide">START</span>
          </div>
        </div>
      `,
      className: "custom-start-pin",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const startMarker = L.marker([startPing.lat, startPing.lng], { icon: startIcon });
    startMarker.bindTooltip(
      `<div style="font-size:11px;">First ping · ${formatPktTime(startPing.timestamp)} PKT</div>`,
      { direction: "top", offset: [0, -12] }
    );
    pathGroup.addLayer(startMarker);

    // End Marker
    if (pings.length > 1) {
      const endPing = pings[pings.length - 1];
      const endIcon = L.divIcon({
        html: `
          <div style="transform: translate(-50%, -50%);">
            <div class="flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 bg-zinc-900 border-2 border-white text-white rounded-full shadow-lg">
              <span class="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center">
                <svg class="w-2 h-2 fill-current" viewBox="0 0 24 24"><path d="M5 3h14v18H5z"/></svg>
              </span>
              <span class="font-bold text-[9px] tracking-wide">END</span>
            </div>
          </div>
        `,
        className: "custom-end-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const endMarker = L.marker([endPing.lat, endPing.lng], { icon: endIcon });
      endMarker.bindTooltip(
        `<div style="font-size:11px;">Last ping · ${formatPktTime(endPing.timestamp)} PKT</div>`,
        { direction: "top", offset: [0, -12] }
      );
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
  }, [pings, gaps, segments, stops]);

  // Fit all bounds handler
  const fitAllBounds = () => {
    if (boundsAllRef.current.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(boundsAllRef.current, {
        padding: [60, 60],
        maxZoom: 16,
      });
    }
  };

  // 4. Playback Cursor & Travelled Progress (restyles the pair polylines
  // behind the cursor — gap/jump pairs stay dashed grey even when "covered",
  // so playback never draws travel that was not observed).
  useEffect(() => {
    if (!mapInstanceRef.current || !playbackLayerRef.current) return;

    const playbackGroup = playbackLayerRef.current;

    if (pings.length === 0 || currentPingIndex < 0 || currentPingIndex >= pings.length) {
      if (cursorMarkerRef.current) {
        playbackGroup.removeLayer(cursorMarkerRef.current);
        cursorMarkerRef.current = null;
      }
      if (cursorCircleRef.current) {
        playbackGroup.removeLayer(cursorCircleRef.current);
        cursorCircleRef.current = null;
      }
      pairLayersRef.current.forEach(({ layer, base }) => layer.setStyle(base));
      return;
    }

    // Restyle pairs: index < cursor = travelled, the rest = base.
    pairLayersRef.current.forEach(({ layer, base, travelled }, i) => {
      layer.setStyle(i < currentPingIndex ? travelled : base);
    });

    const ping = pings[currentPingIndex];
    const pingTime = formatPktTime(ping.timestamp);
    const speedStr = ping.speed != null ? `${Math.round(ping.speed)} km/h` : "Idle";
    const accuracyStr =
      ping.accuracy != null && ping.accuracy > 0 ? `±${Math.round(ping.accuracy)} m` : null;
    const batteryStr = ping.batteryLevel != null ? formatBatteryPercent(ping.batteryLevel) : "—";

    // Accuracy circle under the cursor: the ground area this fix actually
    // localises the technician to. Follows the cursor; hidden when the fix
    // carries no accuracy (legacy rows).
    if (accuracyStr) {
      if (!cursorCircleRef.current) {
        cursorCircleRef.current = L.circle([ping.lat, ping.lng], {
          radius: ping.accuracy as number,
          color: "#0D7A5F",
          weight: 1,
          opacity: 0.5,
          fillColor: "#0D7A5F",
          fillOpacity: 0.08,
          interactive: false,
        });
        playbackGroup.addLayer(cursorCircleRef.current);
      } else {
        cursorCircleRef.current.setLatLng([ping.lat, ping.lng]);
        cursorCircleRef.current.setRadius(ping.accuracy as number);
      }
    } else if (cursorCircleRef.current) {
      playbackGroup.removeLayer(cursorCircleRef.current);
      cursorCircleRef.current = null;
    }

    // Heading calculation
    let bearing = 0;
    if (currentPingIndex < pings.length - 1) {
      bearing = calculateBearing(ping.lat, ping.lng, pings[currentPingIndex + 1].lat, pings[currentPingIndex + 1].lng);
    } else if (currentPingIndex > 0) {
      bearing = calculateBearing(pings[currentPingIndex - 1].lat, pings[currentPingIndex - 1].lng, ping.lat, ping.lng);
    }

    // Status ring driven by real state: on a job → brand emerald, on shift →
    // blue, otherwise (off shift) → neutral zinc.
    const ringColor = ping.activeJob ? "#0D7A5F" : ping.isShiftActive ? "#2563EB" : "#71717A";
    const initials = initialsOf(technicianName);

    const cursorHtml = `
      <div class="relative cursor-pointer" style="transform: translate(-50%, -50%);">
        <div class="flex items-center gap-2">
          <!-- Avatar pin: initials in a status-ringed circle + heading chip -->
          <div class="relative shrink-0">
            <div class="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center" style="border: 3px solid ${ringColor};">
              <span class="text-[13px] font-extrabold leading-none" style="color: ${ringColor};">${initials}</span>
            </div>
            <div class="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-zinc-900 text-white flex items-center justify-center border border-white shadow" style="transform: rotate(${Math.round(bearing)}deg);">
              <svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
          </div>

          <!-- Name pill -->
          <div class="bg-white/95 backdrop-blur-sm border border-zinc-200 rounded-xl shadow-xl px-2.5 py-1 font-sans">
            <div class="text-[11px] font-bold text-zinc-900 whitespace-nowrap leading-tight">${technicianName}</div>
            <div class="text-[9.5px] text-zinc-500 font-mono whitespace-nowrap leading-tight">${pingTime} PKT • ${speedStr}${accuracyStr ? ` • ${accuracyStr}` : ""}</div>
            ${ping.mocked ? `<div class="text-[9.5px] font-bold text-rose-600 whitespace-nowrap leading-tight">MOCKED FIX — REJECTED</div>` : ""}
          </div>
        </div>

        <!-- Floating telemetry stats badge -->
        <div class="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-950/90 text-white text-[9.5px] py-0.5 px-2 rounded-md shadow-2xl border border-zinc-700 pointer-events-none flex items-center gap-1.5 z-50">
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
          <span className="text-emerald-800 font-bold">Travelled (Played)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#0D7A5F] rounded-full inline-block opacity-60" />
          <span>On-Job Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#3B82F6] rounded-full inline-block opacity-60" />
          <span>On-Shift Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1 border-t-2 border-dotted border-zinc-400 inline-block" />
          <span className="text-zinc-500">No Signal / GPS Jump / Poor Fix — Not Travel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-rose-100 border-2 border-rose-500 inline-block" />
          <span className="text-rose-700 font-semibold">Mocked Fix — Rejected</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#0D7A5F] text-[#0D7A5F] text-[8px] font-extrabold flex items-center justify-center inline-flex">
            1
          </span>
          <span>Stop (Numbered in Visit Order)</span>
        </div>
      </div>
    </div>
  );
}
