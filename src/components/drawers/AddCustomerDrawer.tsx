"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  User,
  Phone,
  Mail,
  Check,
  AlertCircle,
} from "lucide-react";
import PakistanAddressAutofill from "@/components/maps/PakistanAddressAutofill";

interface AddCustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: (customer: any) => void;
  initialQuery?: string;
}

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
  const [lat, setLat] = useState<number>(31.5204);
  const [lng, setLng] = useState<number>(74.3587);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !addressText.trim()) {
      setErrorMsg("Customer name, primary phone, and service address are required.");
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
      setLat(31.5204);
      setLng(74.3587);
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
                placeholder="e.g. +92 300 1234567"
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
                placeholder="e.g. 042 35789123"
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
              placeholder="e.g. accounts@client.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
            />
          </div>
        </div>

        {/* 4. Pakistan Address Autofill & Exact GPS Pinpoint Picker */}
        <div className="pt-2 border-t border-[#EDEDED]">
          <PakistanAddressAutofill
            value={addressText}
            lat={lat}
            lng={lng}
            onChange={(newAddress, newLat, newLng) => {
              setAddressText(newAddress);
              setLat(newLat);
              setLng(newLng);
            }}
            label="Customer Service Address *"
            placeholder="Type street, sector, phase (e.g. DHA Phase 5, Gulberg III, Model Town, Johar Town)..."
            required={true}
            showMapPicker={true}
            cityBias="lahore"
          />
        </div>
      </form>
    </SideDrawer>
  );
}
