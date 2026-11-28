"use client";

import React, { useEffect, useRef, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  FieldErrorText,
  FormField,
  INVALID_FIELD_CLS,
  focusFirstInvalidField,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Receipt, Check, Upload, X } from "lucide-react";

/** Mirrors RECEIPT_DATA_URL_MAX_LENGTH in src/lib/receiptUrl.ts (server-enforced). */
const RECEIPT_DATA_URL_MAX_LENGTH = 2_700_000;
const RECEIPT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface QuickExpenseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  technicianId: string;
  onExpenseLogged?: () => void;
}

export default function QuickExpenseDrawer({
  isOpen,
  onClose,
  jobId,
  technicianId,
  onExpenseLogged,
}: QuickExpenseDrawerProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touch = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const showError = (key: string, error: string | null) =>
    Boolean(error) && (Boolean(touched[key]) || submitAttempted);

  // Inline field errors — the same checks handleSubmit always made.
  const categoryError = !category ? "Select an expense category." : null;
  const amountError = !amount
    ? "Expense amount is required."
    : Number(amount) <= 0
      ? "Expense amount must be greater than zero."
      : null;
  const noteError = !note.trim() ? "Expense description is required." : null;

  const handleReceiptFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!RECEIPT_IMAGE_TYPES.includes(file.type)) {
      setReceiptError("Receipt photo must be a JPEG, PNG or WebP image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setReceiptError("Could not read the selected receipt image.");
        return;
      }
      if (dataUrl.length > RECEIPT_DATA_URL_MAX_LENGTH) {
        setReceiptError("Receipt photo is too large. Please choose a smaller image.");
        return;
      }
      setReceiptError("");
      setReceiptDataUrl(dataUrl);
      setReceiptName(file.name);
    };
    reader.onerror = () => setReceiptError("Could not read the selected receipt image.");
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => {
    setReceiptDataUrl(null);
    setReceiptName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!isOpen) return;
    void fetch("/api/accounting-config")
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Could not load expense categories")))
      .then((data) => {
        const active = (data.expenseCategories || []).filter((item: any) => item.active);
        setExpenseCategories(active);
        setCategory((current) => current || active[0]?.code || "");
      })
      .catch(() => setExpenseCategories([]));
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (categoryError || amountError || noteError) {
      focusFirstInvalidField(formRef.current);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${jobId}/expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId,
          amount: Number(amount),
          note,
          category,
          receiptUrl: receiptDataUrl || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onExpenseLogged?.();
      setAmount("");
      setNote("");
      setCategory(expenseCategories[0]?.code || "");
      setSubmitAttempted(false);
      setTouched({});
      clearReceipt();
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
      title="Log Technician Field Expense"
      subtitle="Record emergency parts, fuel, or parking reimbursement"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A] hover:text-[#1A1D1F]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "Logging..." : "Log Expense"}
          </button>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg font-medium"
          >
            {errorMsg}
          </div>
        )}

        <FormField
          label="Expense Category"
          required
          labelClassName="font-semibold text-[#1A1D1F] block mb-1"
          error={categoryError}
          showError={showError("category", categoryError)}
          hint={!expenseCategories.length ? <p className="mt-1 text-[11px] text-amber-700">Configure expense categories in Accounting Onboarding before recording expenses.</p> : undefined}
        >
          {({ invalid }) => (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onBlur={() => touch("category")}
              className={cn(
                "w-full bg-[#F4F4F5] px-3 py-2 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none",
                invalid && INVALID_FIELD_CLS
              )}
            >
              <option value="">Select category…</option>
              {expenseCategories.map((item) => <option key={item.id || item.code} value={item.code}>{item.name}</option>)}
            </select>
          )}
        </FormField>

        <FormField
          label="Expense Amount"
          required
          labelClassName="font-semibold text-[#1A1D1F] block mb-1"
          error={amountError}
          showError={showError("amount", amountError)}
        >
          {({ invalid }) => (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] font-mono">PKR</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 25.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => touch("amount")}
                className={cn(
                  "w-full bg-[#F4F4F5] pl-12 pr-3 py-2 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-mono",
                  invalid && INVALID_FIELD_CLS
                )}
              />
            </div>
          )}
        </FormField>

        <FormField
          label="Expense Description / Notes"
          required
          labelClassName="font-semibold text-[#1A1D1F] block mb-1"
          error={noteError}
          showError={showError("note", noteError)}
        >
          {({ invalid }) => (
            <textarea
              rows={3}
              placeholder="e.g. Purchased emergency Teflon seals & duct tape from hardware store"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => touch("note")}
              className={cn(
                "w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#E4E4E7] focus:bg-white focus:border-[#0D7A5F] focus:outline-none resize-none",
                invalid && INVALID_FIELD_CLS
              )}
            />
          )}
        </FormField>

        {/* Receipt Photo Upload (data-URL, validated server-side by validateReceiptUrl) */}
        <div>
          <label className="font-semibold text-[#1A1D1F] block mb-1">
            Attach Receipt Photo (Optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleReceiptFile(e.target.files?.[0])}
          />
          {receiptDataUrl ? (
            <div className="border border-[#E4E4E7] rounded-xl p-3 flex items-center gap-3 bg-[#FAFAFA]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptDataUrl}
                alt="Receipt preview"
                className="w-14 h-14 object-cover rounded-lg border border-[#E4E4E7]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1A1D1F] truncate">{receiptName || "Receipt photo"}</p>
                <p className="text-[11px] text-[#71717A]">Attached — it will be saved with this expense.</p>
              </div>
              <button
                type="button"
                onClick={clearReceipt}
                aria-label="Remove receipt photo"
                className="p-1.5 rounded-lg text-[#71717A] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleReceiptFile(e.dataTransfer.files?.[0]);
              }}
              className="border-2 border-dashed border-[#E4E4E7] rounded-xl p-4 text-center hover:bg-[#F4F4F5] cursor-pointer transition"
            >
              <Upload className="w-5 h-5 text-[#71717A] mx-auto mb-1" />
              <p className="text-xs text-[#71717A]">
                Click to select receipt image or drag here
              </p>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">JPEG, PNG or WebP</p>
            </div>
          )}
          {receiptError && <FieldErrorText>{receiptError}</FieldErrorText>}
        </div>
      </form>
    </SideDrawer>
  );
}
