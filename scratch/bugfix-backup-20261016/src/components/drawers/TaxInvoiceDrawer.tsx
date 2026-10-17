"use client";

import React, { useEffect, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Receipt, Check, AlertCircle, Printer, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import TaxInvoiceDocument from "@/components/documents/TaxInvoiceDocument";
import { printDocument } from "@/lib/printUtils";

interface TaxInvoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  actor: string;
  netPayable: number;
  onSuccess?: (invoiceNumber: string) => void;
}

export default function TaxInvoiceDrawer({
  isOpen,
  onClose,
  job,
  actor,
  netPayable,
  onSuccess,
}: TaxInvoiceDrawerProps) {
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPrintView, setShowPrintView] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg("");
    setShowPrintView(false);
    const defaultNumber =
      job?.invoice?.invoiceNumber || `INV-${job?.jobNumber || ""}`;
    setCustomInvoiceNumber(defaultNumber);
  }, [isOpen, job]);

  const handleSubmit = async (autoPrint = false) => {
    if (!customInvoiceNumber.trim()) {
      setErrorMsg("Please enter an invoice number.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_custom_invoice",
          invoiceNumber: customInvoiceNumber.trim(),
          actor: actor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate tax invoice");
      }

      const data = await res.json();
      const generatedNum = data.invoiceNumber || customInvoiceNumber.trim();
      onSuccess?.(generatedNum);

      if (autoPrint) {
        setShowPrintView(true);
        setTimeout(() => {
          printDocument("#printable-tax-invoice", generatedNum);
        }, 300);
      } else {
        setShowPrintView(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width={showPrintView ? "max-w-4xl" : "max-w-md"}
      title={
        <span className="inline-flex items-center gap-2">
          <Receipt className="w-4 h-4 text-purple-700" />
          {showPrintView
            ? "Official Tax Invoice · Printable View"
            : "Generate Official Tax Invoice"}
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · ${
        showPrintView ? customInvoiceNumber : "Official Billing"
      }`}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {showPrintView ? (
            <>
              <button
                type="button"
                onClick={() => setShowPrintView(false)}
                className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
              >
                Back to Details
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => printDocument("#printable-tax-invoice", customInvoiceNumber || "Tax_Invoice")}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0B6851] text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? "Saving..." : "Save Invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Generate & Print PDF
                </button>
              </div>
            </>
          )}
        </div>
      }
    >
      {showPrintView ? (
        <TaxInvoiceDocument
          job={job}
          invoiceNumber={customInvoiceNumber}
          onClose={() => setShowPrintView(false)}
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(false);
          }}
          className="space-y-4 text-xs"
        >
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#71717A] text-[11px]">Customer:</span>
              <span className="font-bold text-[#18181B]">{job?.customer?.name || "Customer"}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-purple-200/60">
              <span className="text-[#71717A] text-[11px]">Net Invoiced Amount:</span>
              <span className="font-mono font-bold text-purple-900 text-base">
                {formatCurrency(netPayable)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-[#18181B]">
                Official Tax Invoice Number *
              </label>
              <button
                type="button"
                onClick={() => setShowPrintView(true)}
                className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> Preview Document
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. INV-JOB-2026-0842"
              value={customInvoiceNumber}
              onChange={(e) => setCustomInvoiceNumber(e.target.value)}
              className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-purple-50 rounded-lg text-[11px] text-purple-950 space-y-1.5 border border-purple-200 leading-relaxed">
            <p className="font-semibold text-purple-900">Tax & Accounts Integration:</p>
            <p>• Invoice will be registered in Accounts receivables and General Ledger.</p>
            <p>• Generates an official, FBR/PRA compliant commercial letterhead invoice.</p>
            <p>• Authorized by {actor}.</p>
          </div>
        </form>
      )}
    </SideDrawer>
  );
}
