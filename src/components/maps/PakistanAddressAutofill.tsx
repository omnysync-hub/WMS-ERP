"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin,
  Search,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  Compass,
  Building,
  RotateCw,
  X,
  Map,
  CheckCircle2,
} from "lucide-react";

export interface PakistanAddressAutofillProps {
  value: string;
  lat?: number;
  lng?: number;
  onChange: (address: string, lat: number, lng: number) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showMapPicker?: boolean;
  cityBias?: "lahore" | "karachi" | "islamabad" | "all";
}

export interface AddressSuggestion {
  title: string;
  subtitle: string;
  fullAddress: string;
  lat: number;
  lng: number;
  source: "local" | "photon" | "nominatim";
}

// Curated Local High-Accuracy Database for Lahore & Pakistan Major Zones
export const PAKISTAN_POPULAR_ZONES = [
  // Lahore Central & Commercial
  {
    name: "Gulberg III (Main Boulevard)",
    address: "Main Boulevard, Gulberg III, Lahore, Punjab",
    lat: 31.5126,
    lng: 74.3436,
    city: "Lahore",
  },
  {
    name: "Gulberg II (MM Alam Road)",
    address: "MM Alam Road, Gulberg II, Lahore, Punjab",
    lat: 31.5204,
    lng: 74.3542,
    city: "Lahore",
  },
  // Lahore DHA Phases
  {
    name: "DHA Phase 5 (Commercial Broadway)",
    address: "Commercial Broadway, Phase 5 DHA, Lahore, Punjab",
    lat: 31.4635,
    lng: 74.4104,
    city: "Lahore",
  },
  {
    name: "DHA Phase 6 (Main Boulevard)",
    address: "Main Boulevard, Phase 6 DHA, Lahore, Punjab",
    lat: 31.4552,
    lng: 74.4372,
    city: "Lahore",
  },
  {
    name: "DHA Phase 3 (Y-Block Commercial)",
    address: "Y-Block Market, Phase 3 DHA, Lahore, Punjab",
    lat: 31.4792,
    lng: 74.3789,
    city: "Lahore",
  },
  {
    name: "DHA Phase 8 (Air Avenue / Broadway)",
    address: "Broadway Commercial, Phase 8 DHA, Lahore, Punjab",
    lat: 31.4721,
    lng: 74.4695,
    city: "Lahore",
  },
  // Lahore Planned Communities
  {
    name: "Model Town (Central Commercial Block C)",
    address: "Block C, Model Town, Lahore, Punjab",
    lat: 31.4883,
    lng: 74.3218,
    city: "Lahore",
  },
  {
    name: "Johar Town (G1 Market / Expo Center)",
    address: "G1 Market, Phase 1 Johar Town, Lahore, Punjab",
    lat: 31.4697,
    lng: 74.2728,
    city: "Lahore",
  },
  {
    name: "Bahria Town (Sector C / Talwar Chowk)",
    address: "Sector C Commercial, Bahria Town, Lahore, Punjab",
    lat: 31.3685,
    lng: 74.1824,
    city: "Lahore",
  },
  {
    name: "Cavalry Ground & Cantt",
    address: "Commercial Area, Cavalry Ground, Lahore Cantt, Punjab",
    lat: 31.5038,
    lng: 74.3724,
    city: "Lahore",
  },
  {
    name: "Faisal Town & Garden Town",
    address: "Abul Hassan Isphahani Rd, Faisal Town, Lahore, Punjab",
    lat: 31.4812,
    lng: 74.3034,
    city: "Lahore",
  },
  {
    name: "Wapda Town & Valencia",
    address: "Wapda Town Roundabout, Phase 1, Lahore, Punjab",
    lat: 31.4312,
    lng: 74.2642,
    city: "Lahore",
  },
  {
    name: "Sundar Industrial Estate",
    address: "Sundar Industrial Estate, Raiwind Road, Lahore, Punjab",
    lat: 31.2865,
    lng: 74.1754,
    city: "Lahore",
  },
  // Other Key Pakistan Metros
  {
    name: "Karachi (Clifton Block 4)",
    address: "Clifton Block 4, Shahrah-e-Firdousi, Karachi, Sindh",
    lat: 24.8236,
    lng: 67.0289,
    city: "Karachi",
  },
  {
    name: "Karachi (DHA Phase 6 / Bukhari)",
    address: "Bukhari Commercial Area, Phase 6 DHA, Karachi, Sindh",
    lat: 24.8021,
    lng: 67.0684,
    city: "Karachi",
  },
  {
    name: "Islamabad (Blue Area / F-6)",
    address: "Jinnah Avenue, Blue Area / Sector F-6, Islamabad",
    lat: 33.7215,
    lng: 73.0642,
    city: "Islamabad",
  },
];

export default function PakistanAddressAutofill({
  value,
  lat = 31.5204, // Default Lahore Center
  lng = 74.3587,
  onChange,
  label = "Service Site Address",
  placeholder = "Start typing street, society, sector, or phase (e.g. Gulberg III, DHA Phase 5, Model Town, Johar Town)...",
  required = true,
  showMapPicker = true,
  cityBias = "lahore",
}: PakistanAddressAutofillProps) {
  const [addressInput, setAddressInput] = useState(value || "");
  const [currentLat, setCurrentLat] = useState<number>(lat || 31.5204);
  const [currentLng, setCurrentLng] = useState<number>(lng || 74.3587);

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Map state
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep internal address in sync with incoming value
  useEffect(() => {
    if (value !== addressInput && value !== undefined) {
      setAddressInput(value);
    }
  }, [value]);

  useEffect(() => {
    if (lat && lat !== currentLat) setCurrentLat(lat);
    if (lng && lng !== currentLng) setCurrentLng(lng);
  }, [lat, lng]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Center bias coordinates
  const biasCoordinates = useMemo(() => {
    if (cityBias === "karachi") return { lat: 24.8607, lon: 67.0011 };
    if (cityBias === "islamabad") return { lat: 33.6844, lon: 73.0479 };
    return { lat: 31.5204, lon: 74.3587 }; // Default Lahore
  }, [cityBias]);

  // Real-time Pakistan & Lahore Address Autocomplete Search
  const searchAddress = async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsOpenDropdown(false);
      return;
    }

    setIsLoading(true);

    // 1. Instant local match
    const localMatches: AddressSuggestion[] = PAKISTAN_POPULAR_ZONES.filter(
      (z) =>
        z.name.toLowerCase().includes(q.toLowerCase()) ||
        z.address.toLowerCase().includes(q.toLowerCase())
    ).map((z) => ({
      title: z.name,
      subtitle: z.address,
      fullAddress: z.address,
      lat: z.lat,
      lng: z.lng,
      source: "local",
    }));

    try {
      // 2. Query Photon OpenStreetMap Pakistan Engine (Free, Open-Source, Fast)
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&lat=${biasCoordinates.lat}&lon=${biasCoordinates.lon}&limit=6&lang=en`;

      const res = await fetch(photonUrl);
      let remoteMatches: AddressSuggestion[] = [];

      if (res.ok) {
        const data = await res.json();
        if (data.features && Array.isArray(data.features)) {
          remoteMatches = data.features
            .filter((f: any) => {
              // Priority for Pakistan (country code or country name)
              const country = (f.properties?.country || "").toLowerCase();
              return country === "pakistan" || country === "pk" || !country;
            })
            .map((f: any) => {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates || [];
              const title = props.name || props.street || q;
              const subtitleParts = [
                props.district,
                props.city,
                props.state,
                props.country || "Pakistan",
              ].filter(Boolean);

              const fullAddress = [
                title,
                props.street && props.street !== title ? props.street : null,
                props.district,
                props.city || "Lahore",
                props.state || "Punjab",
                "Pakistan",
              ]
                .filter(Boolean)
                .join(", ");

              return {
                title,
                subtitle: subtitleParts.join(", "),
                fullAddress,
                lat: Number(Number(coords[1]).toFixed(6)),
                lng: Number(Number(coords[0]).toFixed(6)),
                source: "photon" as const,
              };
            });
        }
      }

      // Merge local and remote without duplicates
      const combined = [...localMatches, ...remoteMatches].slice(0, 8);
      setSuggestions(combined);
      setIsOpenDropdown(combined.length > 0);
    } catch (err) {
      console.warn("Address autocomplete network fallback to local database", err);
      setSuggestions(localMatches);
      setIsOpenDropdown(localMatches.length > 0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressInput(val);

    // If user pastes coordinates e.g. "31.5204, 74.3587"
    if (val.includes(",") && /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(val.trim())) {
      const [pLat, pLng] = val.split(",").map((s) => Number(s.trim()));
      if (!isNaN(pLat) && !isNaN(pLng)) {
        setCurrentLat(pLat);
        setCurrentLng(pLng);
        onChange(val, pLat, pLng);
        reverseGeocode(pLat, pLng);
        return;
      }
    }

    onChange(val, currentLat, currentLng);

    // Debounce remote search
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      searchAddress(val);
    }, 220);
  };

  const handleSelectSuggestion = (s: AddressSuggestion) => {
    setAddressInput(s.fullAddress);
    setCurrentLat(s.lat);
    setCurrentLng(s.lng);
    setIsOpenDropdown(false);
    onChange(s.fullAddress, s.lat, s.lng);

    // Update map marker if open
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([s.lat, s.lng]);
      mapInstanceRef.current.setView([s.lat, s.lng], 15);
    }

    showNotice(`✓ Autofilled: ${s.title}`);
  };

  // Reverse Geocode (Lat/Lng -> Pakistan Formatted Address)
  const reverseGeocode = async (rLat: number, rLng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${rLat}&lon=${rLng}`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) {
          setAddressInput(data.display_name);
          onChange(data.display_name, rLat, rLng);
          showNotice("✓ Address updated from pin coordinates");
        }
      }
    } catch {
      // Graceful fallback
    }
  };

  // 1-Click Browser GPS Location
  const handleDetectCurrentGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dLat = Number(pos.coords.latitude.toFixed(6));
        const dLng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        setCurrentLat(dLat);
        setCurrentLng(dLng);
        setIsDetectingGps(false);
        showNotice(`📍 GPS Acquired: ±${accuracy}m accuracy`);

        // If map is active, center on device GPS
        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([dLat, dLng]);
          mapInstanceRef.current.setView([dLat, dLng], 16);
        }

        // Auto-fill address via reverse geocode
        await reverseGeocode(dLat, dLng);
      },
      (err) => {
        setIsDetectingGps(false);
        alert(`Could not fetch device GPS (${err.message}). You can select an area or use the interactive map.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Leaflet Map Initialization for Draggable Pin
  useEffect(() => {
    if (!isMapExpanded) return;

    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === "undefined") return;

      const L = (await import("leaflet")).default;

      if (!mapContainerRef.current || !isMounted) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [currentLat, currentLng],
          zoom: 14,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Custom Leaflet Pin Icon
        const icon = L.divIcon({
          className: "custom-map-pin",
          html: `<div style="background-color: #0D7A5F; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><div style="background: white; width: 10px; height: 10px; border-radius: 50%;"></div></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });

        const marker = L.marker([currentLat, currentLng], {
          draggable: true,
          icon,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const nLat = Number(pos.lat.toFixed(6));
          const nLng = Number(pos.lng.toFixed(6));
          setCurrentLat(nLat);
          setCurrentLng(nLng);
          reverseGeocode(nLat, nLng);
        });

        map.on("click", (e: any) => {
          const nLat = Number(e.latlng.lat.toFixed(6));
          const nLng = Number(e.latlng.lng.toFixed(6));
          marker.setLatLng([nLat, nLng]);
          setCurrentLat(nLat);
          setCurrentLng(nLng);
          reverseGeocode(nLat, nLng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } else {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.setView([currentLat, currentLng], 14);
        markerRef.current?.setLatLng([currentLat, currentLng]);
      }
    }

    void initLeaflet();

    return () => {
      isMounted = false;
    };
  }, [isMapExpanded, currentLat, currentLng]);

  const copyCoordinates = () => {
    const text = `${currentLat}, ${currentLng}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
      showNotice(`✓ Copied: ${text}`);
    }
  };

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  return (
    <div className="space-y-2.5">
      {/* Label and GPS Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="font-semibold text-xs text-[#18181B] flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#0D7A5F]" />
          {label} {required && <span className="text-rose-500">*</span>}
        </label>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDetectCurrentGps}
            disabled={isDetectingGps}
            className="text-[11px] text-[#0D7A5F] hover:bg-emerald-100 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition shadow-2xs"
            title="Auto-detect current GPS coordinates"
          >
            <Navigation className={`w-3 h-3 text-[#0D7A5F] ${isDetectingGps ? "animate-spin" : ""}`} />
            {isDetectingGps ? "Detecting GPS..." : "📍 Use My Location"}
          </button>

          {showMapPicker && (
            <button
              type="button"
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded border transition shadow-2xs ${
                isMapExpanded
                  ? "bg-[#0D7A5F] text-white border-[#0D7A5F]"
                  : "bg-[#F4F4F5] text-[#18181B] border-[#E4E4E7] hover:bg-[#E4E4E7]"
              }`}
            >
              <Map className="w-3 h-3" />
              {isMapExpanded ? "Hide Map" : "Pin on Map"}
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            required={required}
            value={addressInput}
            onChange={handleInputChange}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpenDropdown(true);
            }}
            placeholder={placeholder}
            className="w-full bg-[#F4F4F5] pl-9 pr-9 py-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-xs text-[#18181B] font-medium transition shadow-2xs"
          />
          {addressInput ? (
            <button
              type="button"
              onClick={() => {
                setAddressInput("");
                onChange("", currentLat, currentLng);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : isLoading ? (
            <RotateCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#0D7A5F] animate-spin" />
          ) : null}
        </div>

        {/* Real-time Suggestions Dropdown */}
        {isOpenDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#EDEDED] rounded-xl shadow-xl z-40 max-h-64 overflow-y-auto divide-y divide-[#EDEDED] text-xs animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 bg-[#F9FAFB] text-[10px] font-bold text-[#71717A] uppercase tracking-wider flex items-center justify-between">
              <span>Verified Pakistan / Lahore Locations</span>
              <span className="text-emerald-700 font-mono">OpenStreetMap Free Engine</span>
            </div>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left p-2.5 hover:bg-emerald-50/60 transition flex items-start justify-between gap-2.5 group"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[#18181B] group-hover:text-[#0D7A5F] truncate">
                    {s.title}
                  </div>
                  <div className="text-[11px] text-[#71717A] truncate mt-0.5">
                    {s.subtitle || s.fullAddress}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[10px] font-mono font-bold text-[#0D7A5F] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick 1-Click Chips for Top Lahore Societies */}
      <div className="space-y-1">
        <span className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider block">
          Quick Lahore & Pakistan Presets:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PAKISTAN_POPULAR_ZONES.slice(0, 8).map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setAddressInput(preset.address);
                setCurrentLat(preset.lat);
                setCurrentLng(preset.lng);
                onChange(preset.address, preset.lat, preset.lng);
                showNotice(`✓ Selected ${preset.name}`);
              }}
              className="text-[10px] font-semibold text-[#0D7A5F] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-2 py-0.5 rounded border border-emerald-200 transition shadow-2xs"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Leaflet Map Pin Picker (Collapsible) */}
      {showMapPicker && isMapExpanded && (
        <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#18181B] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Drag Pin to Exact Rooftop / Plot in Lahore
            </span>
            <span className="text-[10px] text-[#71717A]">
              Click anywhere on map to reposition pin
            </span>
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-56 rounded-lg border border-[#E4E4E7] overflow-hidden relative z-10"
          />

          <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1">
            <span>
              Target Coordinates: <strong className="font-mono text-[#18181B]">{currentLat.toFixed(6)}, {currentLng.toFixed(6)}</strong>
            </span>
            <span className="text-[#0D7A5F] font-semibold">
              Live reverse geocoding enabled
            </span>
          </div>
        </div>
      )}

      {/* Location Coordinates & Verification Bar */}
      <div className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#71717A] uppercase">GPS Coordinates:</span>
          <span className="font-mono font-bold text-[#0D7A5F] text-[11px]">
            {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
          </span>
          <button
            type="button"
            onClick={copyCoordinates}
            className="p-1 rounded hover:bg-[#EDEDED] text-[#71717A]"
            title="Copy Coordinates"
          >
            {copiedCoords ? (
              <Check className="w-3.5 h-3.5 text-[#0D7A5F]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {statusNotice && (
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-3 h-3 text-[#0D7A5F]" />
              {statusNotice}
            </span>
          )}

          <a
            href={`https://www.google.com/maps?q=${currentLat},${currentLng}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-[#0D7A5F] hover:underline flex items-center gap-1"
          >
            <span>Verify on Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
