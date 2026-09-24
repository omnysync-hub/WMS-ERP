"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  Users,
  Pencil,
  Check,
  X,
  Power,
  Locate,
  Search,
  ExternalLink,
  Copy,
  CheckCheck,
  Building,
  Briefcase,
  Sparkles,
  Filter,
  AlertCircle,
  Info,
  RefreshCw,
  Navigation,
  Globe,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Compass,
} from "lucide-react";

type EmployeeLite = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  designation?: string;
  faceEnrolled?: boolean;
  active?: boolean;
};

type ZoneRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
  address?: string | null;
  notes?: string | null;
  assignments?: { employee: EmployeeLite }[];
  _count?: { assignments: number };
};

type ErpJobOption = {
  id: string;
  jobNumber: string;
  customer?: {
    name: string;
    addressText: string;
    lat?: number | null;
    lng?: number | null;
  };
  assignedTechnician?: {
    id: string;
    name: string;
  };
  jobType?: string;
  remarks?: string;
};

type Props = {
  employees: EmployeeLite[];
  onZonesChanged?: (zones: ZoneRow[]) => void;
};

const emptyForm = {
  name: "",
  lat: "25.2048",
  lng: "55.2708",
  radiusMeters: "150",
  address: "",
  notes: "",
};

// Common Enterprise Facility Presets
const FACILITY_PRESETS = [
  {
    name: "Headquarters & Corporate Office",
    lat: "24.8607",
    lng: "67.0011",
    radiusMeters: "100",
    address: "Main Business District, Head Office",
    notes: "Executive & Administrative Biometric Geofence",
  },
  {
    name: "Central Parts & Equipment Warehouse",
    lat: "24.8450",
    lng: "67.0200",
    radiusMeters: "250",
    address: "Industrial Logistics Zone, Central Yard",
    notes: "Storekeepers & Field Supply Inbound Gate",
  },
  {
    name: "Fabrication & MEP Workshop",
    lat: "24.8700",
    lng: "67.0500",
    radiusMeters: "200",
    address: "MEP Fabrication Plant & Assembly Hub",
    notes: "Technician Dispatch & Tool Requisition Yard",
  },
  {
    name: "Regional Project Staging Depot",
    lat: "24.8900",
    lng: "67.1100",
    radiusMeters: "300",
    address: "Suburban Commercial Depot",
    notes: "Site Vans & Mobile Crew Meeting Point",
  },
];

const RADIUS_PRESETS = [
  { label: "50m", value: "50", desc: "Compact Office / Suite" },
  { label: "100m", value: "100", desc: "Standard Branch" },
  { label: "200m", value: "200", desc: "Warehouse / Yard" },
  { label: "500m", value: "500", desc: "Large Industrial Plant" },
];

export default function GeofenceSitesPanel({ employees, onZonesChanged }: Props) {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState<"manual" | "search" | "erp">("manual");

  // GPS Current Location Detection State
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // OpenStreetMap Location Search & Autofill State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeResults, setPlaceResults] = useState<any[]>([]);

  // ERP Jobs for Location Autofill
  const [erpJobs, setErpJobs] = useState<ErpJobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Staff Assignment Modal State
  const [assignZoneId, setAssignZoneId] = useState<string | null>(null);
  const [pickedStaff, setPickedStaff] = useState<string[]>([]);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<"ALL" | "TECH" | "ENGINEER" | "OFFICE">("ALL");

  // Clipboard Copied State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fieldTechs = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.active !== false &&
          (!e.role ||
            /tech|field|technician|engineer|helper|operator/i.test(e.role) ||
            true)
      ),
    [employees]
  );

  const filteredStaff = useMemo(() => {
    let list = fieldTechs;
    if (staffRoleFilter === "TECH") {
      list = list.filter((e) => /tech|technician|helper/i.test(e.role || ""));
    } else if (staffRoleFilter === "ENGINEER") {
      list = list.filter((e) => /engineer|supervisor|lead/i.test(e.role || ""));
    } else if (staffRoleFilter === "OFFICE") {
      list = list.filter((e) => !/tech|engineer|helper/i.test(e.role || ""));
    }

    const q = staffQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.role || "").toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
    );
  }, [fieldTechs, staffRoleFilter, staffQuery]);

  async function loadZones() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/geofence-zones?activeOnly=false&includeStaff=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sites");
      const list = (data.zones || []) as ZoneRow[];
      setZones(list);
      onZonesChanged?.(list);
    } catch (e: any) {
      setError(e.message || "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  async function loadErpJobs() {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setErpJobs(data);
        }
      }
    } catch (e) {
      console.warn("Failed to load ERP jobs for location autofill", e);
    } finally {
      setLoadingJobs(false);
    }
  }

  useEffect(() => {
    void loadZones();
    void loadErpJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard navigation: ESC to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (assignZoneId) setAssignZoneId(null);
        if (showForm) setShowForm(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [assignZoneId, showForm]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setGpsAccuracy(null);
    setSearchQuery("");
    setPlaceResults([]);
    setFormTab("manual");
    setShowForm(true);
  }

  function openEdit(z: ZoneRow) {
    setEditingId(z.id);
    setForm({
      name: z.name,
      lat: String(z.lat),
      lng: String(z.lng),
      radiusMeters: String(z.radiusMeters),
      address: z.address || "",
      notes: z.notes || "",
    });
    setGpsAccuracy(null);
    setFormTab("manual");
    setShowForm(true);
  }

  function openAssign(z: ZoneRow) {
    setAssignZoneId(z.id);
    setPickedStaff((z.assignments || []).map((a) => a.employee.id));
    setStaffQuery("");
    setStaffRoleFilter("ALL");
  }

  // Feature 1: Current GPS Location Autodetect & Reverse Geocode
  async function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingGps(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude.toFixed(6);
        const longitude = pos.coords.longitude.toFixed(6);
        const accuracy = Math.round(pos.coords.accuracy);

        setForm((prev) => ({
          ...prev,
          lat: latitude,
          lng: longitude,
          name: prev.name.trim() ? prev.name : "Current Work Site",
        }));
        setGpsAccuracy(accuracy);
        setIsDetectingGps(false);
        showToast(`📍 Acquired GPS: ${latitude}, ${longitude} (±${accuracy}m accuracy)`);

        // Reverse geocode to auto-fill address if not already filled
        try {
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: "application/json" } }
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            if (revData && revData.display_name) {
              setForm((prev) => ({
                ...prev,
                address: revData.display_name,
                name: prev.name === "Current Work Site" && revData.name ? revData.name : prev.name,
              }));
              showToast("Address autofilled from GPS coordinates!");
            }
          }
        } catch {
          // Graceful fallback if reverse geocoding is unavailable
        }
      },
      (err) => {
        setIsDetectingGps(false);
        setError(`Location Error: ${err.message}. Please allow browser location access.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  // Feature 2: Place & Address Search via Geocoding
  async function handleSearchPlaces() {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearchingPlaces(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error("Search service temporarily unavailable");
      const data = await res.json();
      setPlaceResults(data || []);
      if (!data || data.length === 0) {
        showToast("No locations found for this query. Try a different place or city.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to search location");
    } finally {
      setIsSearchingPlaces(false);
    }
  }

  function handleSelectPlace(place: any) {
    const lat = Number(place.lat).toFixed(6);
    const lng = Number(place.lon).toFixed(6);
    const shortName = place.name || place.display_name.split(",")[0];

    setForm((prev) => ({
      ...prev,
      name: shortName,
      lat: String(lat),
      lng: String(lng),
      address: place.display_name,
    }));
    setFormTab("manual");
    showToast(`Autofilled location: ${shortName}`);
  }

  // Feature 3: Smart Coordinate Paste (Auto-splits "lat, lng" if pasted)
  function handleSmartCoordinateInput(val: string) {
    if (val.includes(",") || val.includes(" ")) {
      const parts = val.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        setForm((prev) => ({
          ...prev,
          lat: Number(parts[0]).toFixed(6),
          lng: Number(parts[1]).toFixed(6),
        }));
        showToast("Detected and parsed combined coordinates!");
        return;
      }
    }
    setForm((prev) => ({ ...prev, lat: val }));
  }

  // Feature 4: Apply ERP Job Location
  function handleSelectErpJob(job: ErpJobOption) {
    const cust = job.customer;
    const name = `Job ${job.jobNumber} — ${cust?.name || "Client Site"}`;
    const address = cust?.addressText || "";
    const lat = cust?.lat ? String(cust.lat) : form.lat;
    const lng = cust?.lng ? String(cust.lng) : form.lng;

    setForm((prev) => ({
      ...prev,
      name,
      address,
      lat,
      lng,
      notes: `Autofilled from Job ${job.jobNumber}. Type: ${job.jobType || "Service"}.`,
    }));
    setFormTab("manual");
    showToast(`Autofilled from Job ${job.jobNumber}`);
  }

  // Feature 5: Apply Enterprise Facility Preset
  function handleSelectPreset(preset: typeof FACILITY_PRESETS[0]) {
    setForm((prev) => ({
      ...prev,
      name: preset.name,
      lat: preset.lat,
      lng: preset.lng,
      radiusMeters: preset.radiusMeters,
      address: preset.address,
      notes: preset.notes,
    }));
    setFormTab("manual");
    showToast(`Applied preset: ${preset.name}`);
  }

  // Save Zone (Create or Update)
  async function saveZone(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        radiusMeters: Math.max(20, Number(form.radiusMeters) || 150),
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: true,
      };
      const res = await fetch(
        editingId ? `/api/geofence-zones/${editingId}` : "/api/geofence-zones",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setShowForm(false);
      showToast(editingId ? "Site updated successfully." : "New site registered successfully.");
      await loadZones();
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(z: ZoneRow) {
    setSaving(true);
    try {
      const res = await fetch(`/api/geofence-zones/${z.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !z.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      showToast(`Site "${z.name}" is now ${!z.isActive ? "ACTIVE" : "INACTIVE"}.`);
      await loadZones();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteZone(z: ZoneRow) {
    if (!confirm(`Delete site "${z.name}"? Staff assignments for this site will be removed.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/geofence-zones/${z.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      showToast(`Site "${z.name}" deleted.`);
      await loadZones();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveStaff() {
    if (!assignZoneId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/geofence-zones/${assignZoneId}/staff`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: pickedStaff }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assign failed");
      setAssignZoneId(null);
      showToast(`Staff roster updated (${pickedStaff.length} employees assigned).`);
      await loadZones();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleStaff(id: string) {
    setPickedStaff((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSelectAllFilteredStaff() {
    const ids = filteredStaff.map((e) => e.id);
    setPickedStaff((prev) => Array.from(new Set([...prev, ...ids])));
    showToast(`Added ${ids.length} staff members to selection.`);
  }

  function handleAssignAllTechnicians() {
    const techIds = employees
      .filter((e) => /tech|technician|field|helper/i.test(e.role || ""))
      .map((e) => e.id);
    setPickedStaff((prev) => Array.from(new Set([...prev, ...techIds])));
    showToast(`Assigned all ${techIds.length} field technicians.`);
  }

  function handleClearAllStaff() {
    setPickedStaff([]);
    showToast("Cleared all staff selections.");
  }

  function copyCoordinates(z: ZoneRow) {
    const text = `${z.lat}, ${z.lng}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(z.id);
      showToast(`Copied coordinates: ${text}`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  const assignZone = zones.find((z) => z.id === assignZoneId);

  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0D7A5F] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="p-4 border-b border-[#E4E4E7] flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-emerald-900 via-[#0D7A5F] to-teal-800 text-white">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Attendance Sites & Geofence Hub
            </h3>
            <span className="text-[10px] bg-emerald-800/80 border border-emerald-600/50 font-mono font-bold px-2 py-0.5 rounded-full text-emerald-100">
              {zones.length} Sites ({zones.filter((z) => z.isActive).length} Active)
            </span>
          </div>
          <p className="text-[11px] text-emerald-100 mt-1 max-w-2xl leading-relaxed">
            Multi-site geofencing with GPS auto-detection, ERP Job autofill, and custom staff
            assignments. Mobile punches validate coordinates against each person&apos;s assigned sites.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-[#0D7A5F] text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Attendance Site
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SITE WITH ACCESSIBILITY & AUTOFILL FEATURES              */}
      {/* ========================================================================= */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-[#E4E4E7] space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="font-bold text-sm text-[#18181B] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#0D7A5F]" />
                  {editingId ? "Edit Attendance Site" : "New Attendance Site"}
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Configure location boundaries, GPS coordinates, and address for automatic verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg text-[#71717A] hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Accessibility & Autofill Tabs */}
            <div className="flex items-center gap-2 p-1 bg-[#F4F4F5] rounded-xl border border-[#EDEDED]">
              <button
                type="button"
                onClick={() => setFormTab("manual")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition ${
                  formTab === "manual"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-[#0D7A5F]" />
                Site Details & Coordinates
              </button>
              <button
                type="button"
                onClick={() => setFormTab("search")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition ${
                  formTab === "search"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Search className="w-3.5 h-3.5 text-blue-600" />
                Search & Autofill Place
              </button>
              <button
                type="button"
                onClick={() => setFormTab("erp")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition ${
                  formTab === "erp"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                Import from ERP / Presets
              </button>
            </div>

            {/* TAB 1: SEARCH PLACE & AUTOFILL */}
            {formTab === "search" && (
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    Global Address & Landmark Search
                  </span>
                  <span className="text-[10px] text-blue-700">OpenStreetMap Geocoding</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchPlaces();
                      }
                    }}
                    placeholder="e.g. Gulberg III Lahore, DHA Phase 6 Karachi, Business Bay Dubai, I-9 Islamabad..."
                    className="flex-1 h-9 px-3 text-xs bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSearchPlaces}
                    disabled={isSearchingPlaces || !searchQuery.trim()}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition flex items-center gap-1.5"
                  >
                    <Search className={`w-3.5 h-3.5 ${isSearchingPlaces ? "animate-spin" : ""}`} />
                    {isSearchingPlaces ? "Searching..." : "Search"}
                  </button>
                </div>

                {placeResults.length > 0 && (
                  <div className="border border-[#E4E4E7] bg-white rounded-xl divide-y divide-[#E4E4E7] max-h-48 overflow-y-auto">
                    {placeResults.map((place, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPlace(place)}
                        className="w-full text-left p-2.5 hover:bg-blue-50/60 transition flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#18181B]">
                            {place.name || place.display_name.split(",")[0]}
                          </div>
                          <div className="text-[11px] text-[#71717A] line-clamp-1">
                            {place.display_name}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-blue-600 shrink-0 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {Number(place.lat).toFixed(4)}, {Number(place.lon).toFixed(4)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: IMPORT FROM ERP JOBS & FACILITY PRESETS */}
            {formTab === "erp" && (
              <div className="space-y-4">
                {/* ERP Job Sites */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-amber-600" />
                      Active Customer Jobs / Project Sites
                    </span>
                    <span className="text-[10px] text-amber-800">
                      {erpJobs.length} Active ERP Jobs
                    </span>
                  </div>
                  {erpJobs.length === 0 ? (
                    <p className="text-xs text-[#71717A]">
                      {loadingJobs ? "Loading active jobs..." : "No active jobs found in the ERP database."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pt-1">
                      {erpJobs.slice(0, 8).map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => handleSelectErpJob(job)}
                          className="p-2.5 text-left bg-white border border-[#E4E4E7] hover:border-amber-400 rounded-lg hover:bg-amber-50/50 transition text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#18181B] font-mono">
                              {job.jobNumber}
                            </span>
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-semibold">
                              {job.jobType || "Service"}
                            </span>
                          </div>
                          <div className="font-medium text-[#3F3F46] truncate">
                            {job.customer?.name || "Client Site"}
                          </div>
                          <div className="text-[10px] text-[#71717A] truncate">
                            {job.customer?.addressText || "Address on file"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Standard MEP Facility Presets */}
                <div className="p-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] space-y-2">
                  <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-[#0D7A5F]" />
                    Standard Enterprise Facility Presets
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FACILITY_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className="p-2.5 text-left bg-white border border-[#E4E4E7] hover:border-[#0D7A5F] rounded-lg hover:bg-emerald-50/40 transition text-xs space-y-1"
                      >
                        <div className="font-semibold text-[#18181B]">{p.name}</div>
                        <div className="text-[10px] text-[#71717A]">{p.notes}</div>
                        <div className="text-[10px] font-mono text-[#0D7A5F] font-bold">
                          Radius: {p.radiusMeters}m
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FORM BODY */}
            <form onSubmit={saveZone} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Site Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Main Distribution Yard — Gulberg III"
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#0D7A5F]"
                  />
                </div>

                {/* GPS Coordinates Header with "Use Current GPS Location" Button */}
                <div className="md:col-span-2 flex items-center justify-between pt-1">
                  <label className="font-semibold text-[#18181B] flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    Geofence Center Coordinates (WGS-84) <span className="text-rose-500">*</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {gpsAccuracy !== null && (
                      <span className="text-[10px] font-mono bg-emerald-50 text-[#065F46] border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#0D7A5F]" />
                        ±{gpsAccuracy}m Accuracy
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      disabled={isDetectingGps}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] border border-emerald-300 font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <Locate className={`w-3.5 h-3.5 ${isDetectingGps ? "animate-spin" : ""}`} />
                      {isDetectingGps ? "Detecting GPS..." : "📍 Use Current GPS Location"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#71717A] block mb-1">Latitude</label>
                  <input
                    required
                    type="text"
                    value={form.lat}
                    onChange={(e) => handleSmartCoordinateInput(e.target.value)}
                    placeholder="24.860700 (or paste lat, lng)"
                    className="w-full h-9 px-3 font-mono bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#0D7A5F]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#71717A] block mb-1">Longitude</label>
                  <input
                    required
                    type="text"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    placeholder="67.001100"
                    className="w-full h-9 px-3 font-mono bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#0D7A5F]"
                  />
                </div>

                {/* Radius Presets and Input */}
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#18181B] block">
                      Geofence Radius (Meters) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {RADIUS_PRESETS.map((rp) => (
                        <button
                          key={rp.value}
                          type="button"
                          onClick={() => setForm({ ...form, radiusMeters: rp.value })}
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border transition ${
                            form.radiusMeters === rp.value
                              ? "bg-[#0D7A5F] text-white border-[#0D7A5F]"
                              : "bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7] hover:bg-[#E4E4E7]"
                          }`}
                        >
                          {rp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      required
                      type="number"
                      min={20}
                      max={10000}
                      value={form.radiusMeters}
                      onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
                      className="w-full h-9 px-3 font-mono bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#0D7A5F]"
                    />
                    {form.lat && form.lng && (
                      <a
                        href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg font-semibold inline-flex items-center gap-1.5 shrink-0 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        Preview Map
                      </a>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Physical Address (Autofilled / Optional)
                  </label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street address, building name, landmark, or industrial block..."
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#0D7A5F]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Operational Notes (Optional)
                  </label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Shift hours, security gate entrance, access requirements..."
                    className="w-full h-9 px-3 bg-white border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#0D7A5F]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E4E4E7]">
                <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  Mobile punches inside this radius will automatically record as verified.
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-[#E4E4E7] font-semibold text-[#71717A] hover:bg-[#F4F4F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold disabled:opacity-60 transition shadow-xs"
                  >
                    {saving ? "Saving..." : editingId ? "Update Site" : "Create Site"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SITES DATA TABLE WITH ACCESSIBILITY ACTIONS                                */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left" aria-label="Attendance sites table">
          <thead className="bg-[#F4F4F5] text-[#71717A] border-b border-[#E4E4E7]">
            <tr>
              <th className="p-3.5">Site Name & Address</th>
              <th className="p-3.5">GPS Coordinates</th>
              <th className="p-3.5">Radius</th>
              <th className="p-3.5">Assigned Staff</th>
              <th className="p-3.5">Geofence Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E4E7]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#71717A]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#0D7A5F] mx-auto mb-2" />
                  Loading attendance sites...
                </td>
              </tr>
            ) : zones.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-[#71717A] space-y-2">
                  <MapPin className="w-8 h-8 text-[#D4D4D8] mx-auto" />
                  <div className="font-semibold text-[#18181B]">No attendance sites configured yet</div>
                  <p className="text-xs max-w-sm mx-auto text-[#71717A]">
                    Click &ldquo;Add Attendance Site&rdquo; to register your office, warehouse, or customer project
                    locations with GPS geofencing.
                  </p>
                </td>
              </tr>
            ) : (
              zones.map((z) => {
                const staffCount = z._count?.assignments ?? z.assignments?.length ?? 0;
                const isCopied = copiedId === z.id;

                return (
                  <tr key={z.id} className="hover:bg-[#FAFAFA] transition">
                    <td className="p-3.5">
                      <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#0D7A5F] shrink-0" />
                        {z.name}
                      </div>
                      {z.address && (
                        <div className="text-[11px] text-[#71717A] mt-0.5 line-clamp-1 max-w-xs">
                          {z.address}
                        </div>
                      )}
                      {z.notes && (
                        <div className="text-[10px] text-[#A1A1AA] italic mt-0.5 line-clamp-1">
                          {z.notes}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-[#18181B]">
                          {Number(z.lat).toFixed(5)}, {Number(z.lng).toFixed(5)}
                        </span>
                        <button
                          type="button"
                          title="Copy Coordinates"
                          onClick={() => copyCoordinates(z)}
                          className="p-1 rounded hover:bg-[#EDEDED] text-[#71717A]"
                        >
                          {isCopied ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#0D7A5F]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`https://www.google.com/maps?q=${z.lat},${z.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          title="View on Google Maps"
                          className="p-1 rounded hover:bg-[#EDEDED] text-[#0D7A5F]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-md text-[#18181B]">
                        {z.radiusMeters}m
                      </span>
                    </td>

                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => openAssign(z)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F4F5] hover:bg-emerald-50 hover:text-[#0D7A5F] border border-[#E4E4E7] font-semibold transition"
                      >
                        <Users className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>{staffCount} Assigned</span>
                      </button>
                      {z.assignments && z.assignments.length > 0 && (
                        <div className="mt-1 text-[10px] text-[#71717A] line-clamp-1 max-w-[220px]">
                          {z.assignments.map((a) => a.employee.name).join(", ")}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => void toggleActive(z)}
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 transition ${
                          z.isActive
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${z.isActive ? "bg-emerald-600" : "bg-zinc-400"}`} />
                        {z.isActive ? "ACTIVE" : "DEACTIVATED"}
                      </button>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          title="Assign Staff"
                          onClick={() => openAssign(z)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#0D7A5F] transition"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit Site Details"
                          onClick={() => openEdit(z)}
                          className="p-1.5 rounded-lg hover:bg-[#F4F4F5] text-[#71717A] transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title={z.isActive ? "Deactivate Site" : "Activate Site"}
                          onClick={() => void toggleActive(z)}
                          className={`p-1.5 rounded-lg hover:bg-[#F4F4F5] transition ${
                            z.isActive ? "text-emerald-700" : "text-zinc-400"
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete Site"
                          onClick={() => void deleteZone(z)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN STAFF PER SITE WITH BATCH FILTERS & SEARCH                   */}
      {/* ========================================================================= */}
      {assignZone && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-[#E4E4E7] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="font-bold text-sm text-[#18181B] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0D7A5F]" />
                  Assign Staff to Site — {assignZone.name}
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Mobile punches for selected staff will be geofenced to this location ({assignZone.radiusMeters}m radius).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignZoneId(null)}
                className="p-1 rounded-lg text-[#71717A] hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllFilteredStaff}
                  className="px-2.5 py-1 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-lg transition"
                >
                  Select All Filtered
                </button>
                <button
                  type="button"
                  onClick={handleAssignAllTechnicians}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] border border-emerald-200 font-bold rounded-lg transition"
                >
                  Assign All Technicians
                </button>
                <button
                  type="button"
                  onClick={handleClearAllStaff}
                  className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  Clear Selection
                </button>
              </div>

              <span className="font-mono text-[11px] font-bold text-[#0D7A5F] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {pickedStaff.length} / {employees.length} Selected
              </span>
            </div>

            {/* Role Filter & Search Bar */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs">
                {(["ALL", "TECH", "ENGINEER", "OFFICE"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setStaffRoleFilter(r)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition text-[11px] ${
                      staffRoleFilter === r
                        ? "bg-[#18181B] text-white"
                        : "bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    {r === "ALL"
                      ? "All Staff"
                      : r === "TECH"
                      ? "Technicians"
                      : r === "ENGINEER"
                      ? "Engineers / Leads"
                      : "Office Staff"}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Search staff by name, designation, department..."
                  className="w-full h-9 pl-8 pr-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg focus:bg-white focus:outline-none focus:border-[#0D7A5F]"
                />
              </div>
            </div>

            {/* Staff List */}
            <div className="max-h-72 overflow-y-auto border border-[#E4E4E7] rounded-xl divide-y divide-[#E4E4E7]">
              {filteredStaff.length === 0 ? (
                <div className="p-6 text-xs text-[#71717A] text-center">
                  No staff members match the selected filter.
                </div>
              ) : (
                filteredStaff.map((e) => {
                  const on = pickedStaff.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleStaff(e.id)}
                      className={`w-full flex items-center justify-between p-3 text-left text-xs hover:bg-[#FAFAFA] transition ${
                        on ? "bg-emerald-50/70" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition ${
                            on
                              ? "bg-[#0D7A5F] border-[#0D7A5F] text-white shadow-2xs"
                              : "border-[#D4D4D8] bg-white"
                          }`}
                        >
                          {on && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-[#18181B] block truncate">
                            {e.name}
                          </span>
                          <span className="text-[10px] text-[#71717A]">
                            {e.role || "Staff"}
                            {e.department ? ` · ${e.department}` : ""}
                            {e.designation ? ` · ${e.designation}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {e.faceEnrolled ? (
                          <span className="text-[10px] font-mono text-[#065F46] bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                            Face ID Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-[#71717A] bg-zinc-100 px-2 py-0.5 rounded-full">
                            Face Pending
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E4E4E7]">
              <span className="text-[11px] text-[#71717A]">
                <strong>{pickedStaff.length}</strong> staff selected for <strong>{assignZone.name}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignZoneId(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E4E4E7] text-xs font-semibold text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveStaff()}
                  className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold disabled:opacity-60 transition shadow-xs"
                >
                  {saving ? "Saving..." : "Save Assignments"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
