"use client";

import React, { useRef, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  User,
  Phone,
  Mail,
  Check,
  AlertCircle,
} from "lucide-react";
import PakistanAddressAutofill from "@/components/maps/PakistanAddressAutofill";
import {
  FieldErrorText,
  FormField,
  INVALID_FIELD_CLS,
  focusFirstInvalidField,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import toast from "@/lib/toast";

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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const touch = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const showError = (key: string, error: string | null) =>
    Boolean(error) && (Boolean(touched[key]) || submitAttempted);

  // Inline field errors — the same checks handleSubmit always made, now
  // shown under each field instead of one banner message.
  const nameError = !name.trim() ? "Customer name is required." : null;
  const phoneError = !phone.trim()
    ? "Primary phone number is required."
    : phone.replace(/\D/g, "").length !== 11
      ? "Customer primary phone number must be exactly 11 digits (e.g., 03001234567)."
      : null;
  const secPhoneError =
    secPhone.trim() && secPhone.replace(/\D/g, "").length !== 11
      ? "Secondary phone number must be exactly 11 digits (e.g., 03211234567)."
      : null;
  const addressError = !addressText.trim() ? "Service address is required." : null;

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
    setSubmitAttempted(true);
    if (nameError || phoneError || secPhoneError || addressError) {
      focusFirstInvalidField(formRef.current);
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

      toast.success(`Customer "${customer.name || name}" registered successfully.`, {
        title: "Customer Registered",
      });
      onCustomerCreated?.(customer);
      setName("");
      setPhone("");
      setSecPhone("");
      setEmail("");
      setAddressText("");
      setLat(31.5204);
      setLng(74.3587);
      setSubmitAttempted(false);
      setTouched({});
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message || "Failed to create customer", { title: "Error Creating Customer" });
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
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
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
        <FormField
          label="Customer / Company Name"
          required
          labelClassName="font-semibold text-[#18181B] block mb-1"
          error={nameError}
          showError={showError("name", nameError)}
        >
          {({ invalid }) => (
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                placeholder="e.g. Al-Noor Commercial Plaza / Tariq Mansoor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => touch("name")}
                className={cn(
                  "w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-medium",
                  invalid && INVALID_FIELD_CLS
                )}
              />
            </div>
          )}
        </FormField>

        {/* 2. Phone Numbers: Primary & Secondary (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Primary Phone Number"
            required
            labelClassName="font-semibold text-[#18181B] block mb-1"
            error={phoneError}
            showError={showError("phone", phoneError)}
          >
            {({ invalid }) => (
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="tel"
                  placeholder="e.g. +92 300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => touch("phone")}
                  className={cn(
                    "w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-mono",
                    invalid && INVALID_FIELD_CLS
                  )}
                />
              </div>
            )}
          </FormField>

          <FormField
            label="Secondary Phone (Optional)"
            labelClassName="font-semibold text-[#71717A] block mb-1"
            error={secPhoneError}
            showError={showError("secPhone", secPhoneError)}
          >
            {({ invalid }) => (
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
                <input
                  type="tel"
                  placeholder="e.g. 042 35789123"
                  value={secPhone}
                  onChange={(e) => setSecPhone(e.target.value)}
                  onBlur={() => touch("secPhone")}
                  className={cn(
                    "w-full bg-[#F4F4F5] pl-9 pr-3 py-2 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B] font-mono",
                    invalid && INVALID_FIELD_CLS
                  )}
                />
              </div>
            )}
          </FormField>
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
        <div
          className="pt-2 border-t border-[#EDEDED]"
          data-field-invalid={showError("address", addressError) ? "true" : undefined}
        >
          <PakistanAddressAutofill
            value={addressText}
            lat={lat}
            lng={lng}
            onChange={(newAddress, newLat, newLng) => {
              setAddressText(newAddress);
              setLat(newLat);
              setLng(newLng);
              touch("address");
            }}
            label="Customer Service Address *"
            placeholder="Type street, sector, phase (e.g. DHA Phase 5, Gulberg III, Model Town, Johar Town)..."
            required={true}
            showMapPicker={true}
            cityBias="lahore"
          />
          {showError("address", addressError) && (
            <FieldErrorText>{addressError}</FieldErrorText>
          )}
        </div>
      </form>
    </SideDrawer>
  );
}
