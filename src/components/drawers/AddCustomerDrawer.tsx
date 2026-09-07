"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  MapPin,
  User,
  Phone,
  Mail,
  Check,
  Navigation,
  ExternalLink,
  Map,
  Compass,
  AlertCircle,
} from "lucide-react";

interface AddCustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: (customer: any) => void;
  initialQuery?: string;
}

// Popular HVAC Service Zones in UAE with GPS coordinates
const LOCATION_PRESETS = [
  { name: "Downtown Dubai (Burj Area)", address: "Downtown Dubai, Financial Centre Rd, Dubai", lat: 25.1972, lng: 55.2744 },
  { name: "Dubai Marina (JBR Walk)", address: "Dubai Marina Promenade, Marina Gate, Dubai", lat: 25.0772, lng: 55.1384 },
  { name: "Sheikh Zayed Rd (Trade Centre)", address: "Sheikh Zayed Road, Trade Centre 1, Dubai", lat: 25.2138, lng: 55.2758 },
  { name: "Arabian Ranches (Phase 2)", address: "Arabian Ranches Phase 2, Villa Community, Dubai", lat: 25.0345, lng: 55.2632 },
  { name: "Business Bay (Bay Square)", address: "Bay Square Building 3, Business Bay, Dubai", lat: 25.1857, lng: 55.2816 },
  { name: "Sharjah Industrial Area 3", address: "Industrial Area 3, King Faisal St, Sharjah", lat: 25.3289, lng: 55.3921 },
];

export default function AddCustomerDrawer({
  isOpen,
  onClose,
  onCustomerCreated,
  initialQuery = "",
}: AddCustomerDrawerProps) {
  const [name, setName] = useState(initialQuery);
  const [phone, setPhone] = useState("");
  const [secPhone, setSecPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState<number>(25.2048);
  const [lng, setLng] = useState<number>(55.2708);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync initial query when drawer opens
  React.useEffect(() => {
    if (isOpen && initialQuery) {
      // If initialQuery looks like a phone number (digits/+), fill phone, else name
      const isDigits = /^[\d\s+\-()]{6,}$/.test(initialQuery.trim());
      if (isDigits) {
        setPhone(initialQuery.trim());
      } else {
        setName(initialQuery.trim());
      }
    }
  }, [isOpen, initialQuery]);

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        if (!addressText.trim()) {
          setAddressText(`GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        }
        setIsDetectingGps(false);
      },
      (err) => {
        console.warn("GPS error", err);
        setIsDetectingGps(false);
        alert("Could not fetch GPS coordinates. You can enter them manually or pick a preset.");
      },
      { timeout: 8000 }
    );
  };

  const handleSelectPreset = (preset: typeof LOCATION_PRESETS[0]) => {
    setAddressText(preset.address);
    setLat(preset.lat);
    setLng(preset.lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !addressText.trim()) {
      setErrorMsg("Customer name, primary phone, and Google Maps service address are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          secPhone: secPhone.trim() || null,
          email: email.trim() || null,
          addressText: addressText.trim(),
          lat,
          lng,
        }),
      });

      const customer = await res.json();
      if (!res.ok) throw new Error(customer.error || "Failed to create customer");

      onCustomerCreated?.(customer);
      setName("");
      setPhone("");
      setSecPhone("");
      setEmail("");
      setAddressText("");
      setLat(25.2048);
      setLng(55.2708);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      subtitle="Register customer details and link verified Google Maps coordinates"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A] hover:text-[#18181B]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "Saving..." : "Save Customer"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Customer Name */}
        <div>
          <label className="font-semibold text-[#18181B] block mb-1">
            Customer / Company Name *
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              required
              placeholder="e.g. Al-Noor Commercial Plaza / Tariq Mansoor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            />
          </div>
        </div>

        {/* 2. Phone Numbers: Primary & Secondary (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-[#18181B] block mb-1">
              Primary Phone Number *
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="tel"
                required
                placeholder="e.g. +971 50 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-[#71717A] block mb-1">
              Secondary Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
              <input
                type="tel"
                placeholder="e.g. +971 55 987 6543"
                value={secPhone}
                onChange={(e) => setSecPhone(e.target.value)}
                className="w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. Email (Optional) */}
        <div>
          <label className="font-semibold text-[#71717A] block mb-1">
            Email Address (Optional)
          </label>
          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
            <input
              type="email"
              placeholder="e.g. facilities@alnoor.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
            />
          </div>
        </div>

        {/* 4. Google Maps Linked Service Address */}
        <div className="pt-2 border-t border-[#EDEDED] space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-[#18181B] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Service Address (Google Maps Linked) *
            </label>
            <button
              type="button"
              onClick={handleUseCurrentGps}
              disabled={isDetectingGps}
              className="text-[11px] text-[#0D7A5F] hover:underline font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
            >
              <Navigation className="w-3 h-3 text-[#0D7A5F]" />
              {isDetectingGps ? "Detecting GPS..." : "Use Current GPS"}
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              required
              placeholder="Enter building name, street, villa number, or city area..."
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
            />
          </div>

          {/* Quick presets for common service areas */}
          <div>
            <span className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider block mb-1">
              Quick Area Suggestions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="text-[10px] font-medium text-[#0D7A5F] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-2 py-0.5 rounded border border-emerald-200 transition"
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Google Maps Location Coordinates & Verification Card */}
          <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#18181B] flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-[#0D7A5F]" />
                Stored GPS Coordinates:
              </span>
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#0D7A5F] font-bold hover:underline inline-flex items-center gap-1"
              >
                <span>Preview in Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-[#71717A] block font-mono">Latitude (Lat)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 25.2048)}
                  className="w-full bg-white px-2 py-1 rounded border border-[#EDEDED] font-mono text-[11px] text-[#18181B]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block font-mono">Longitude (Lng)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 55.2708)}
                  className="w-full bg-white px-2 py-1 rounded border border-[#EDEDED] font-mono text-[11px] text-[#18181B]"
                />
              </div>
            </div>

            <p className="text-[10px] text-[#71717A] leading-tight">
              Coordinates will be stored on the customer profile and linked to the technician live dispatch route.
            </p>
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
