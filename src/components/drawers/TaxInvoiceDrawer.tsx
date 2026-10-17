"use client";

import React, { useEffect, useMemo, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  Receipt,
  Check,
  AlertCircle,
  Printer,
  Eye,
  Plus,
  Trash2,
  RotateCcw,
  BookOpen,
  DollarSign,
  Search,
} from "lucide-react";
import { formatCurrency, numberToWords } from "@/lib/utils";
import TaxInvoiceDocument from "@/components/documents/TaxInvoiceDocument";
import { printDocument } from "@/lib/printUtils";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import {
  INVOICE_ITEM_CATALOG,
  INVOICE_CATALOG_OPTIONS,
} from "@/lib/constants/invoiceItemCatalog";

interface InvoiceLineItem {
  id: string;
  catalogId: string;
  description: string;
  quantity: number | string;
  unitRate: number | string;
}

interface TaxInvoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  actor: string;
  netPayable: number;
  onSuccess?: (invoiceNumber: string) => void;
}

function createEmptyLine(): InvoiceLineItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    catalogId: "",
    description: "",
    quantity: 1,
    unitRate: 0,
  };
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
  const [lines, setLines] = useState<InvoiceLineItem[]>([createEmptyLine()]);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPrintView, setShowPrintView] = useState(false);

  // Initialize lines from existing job items or empty line when opened
  useEffect(() => {
    if (!isOpen || !job) return;
    setErrorMsg("");
    setShowPrintView(false);

    const defaultNumber =
      job?.invoice?.invoiceNumber || `INV-${job?.jobNumber || ""}`;
    setCustomInvoiceNumber(defaultNumber);
    setDiscountAmount(job?.discountAmount || 0);

    if (Array.isArray(job.items) && job.items.length > 0) {
      const initialLines: InvoiceLineItem[] = job.items.map(
        (it: any, idx: number) => ({
          id: it.id || `line-${idx}-${Date.now()}`,
          catalogId: "",
          description: it.description || "",
          quantity:
            it.quantityActual !== null && it.quantityActual !== undefined
              ? it.quantityActual
              : it.quantityPlanned || 1,
          unitRate: it.unitRate || 0,
        })
      );
      setLines(initialLines);
    } else {
      setLines([createEmptyLine()]);
    }
  }, [isOpen, job]);

  // Catalog options for SearchableSelect
  const catalogSelectOptions: SelectOption[] = useMemo(() => {
    return INVOICE_CATALOG_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      subLabel: opt.subLabel,
      badge: opt.badge,
      badgeTone: "zinc",
    }));
  }, []);

  const handleSelectCatalogItem = (rowId: string, catalogId: string) => {
    const item = INVOICE_ITEM_CATALOG.find((c) => c.id === catalogId);
    if (!item) return;

    setLines((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          catalogId: item.id,
          description: item.description,
          unitRate: item.defaultPrice && item.defaultPrice > 0 ? item.defaultPrice : row.unitRate,
        };
      })
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      setLines([createEmptyLine()]);
      return;
    }
    setLines((prev) => prev.filter((r) => r.id !== id));
  };

  const updateLine = (id: string, patch: Partial<InvoiceLineItem>) => {
    setLines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const resetToJobItems = () => {
    if (Array.isArray(job?.items) && job.items.length > 0) {
      setLines(
        job.items.map((it: any, idx: number) => ({
          id: it.id || `line-${idx}-${Date.now()}`,
          catalogId: "",
          description: it.description || "",
          quantity:
            it.quantityActual !== null && it.quantityActual !== undefined
              ? it.quantityActual
              : it.quantityPlanned || 1,
          unitRate: it.unitRate || 0,
        }))
      );
    } else {
      setLines([createEmptyLine()]);
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return lines.reduce((sum, row) => {
      const q = Math.max(0, Number(row.quantity) || 0);
      const r = Math.max(0, Number(row.unitRate) || 0);
      return sum + q * r;
    }, 0);
  }, [lines]);

  const numericDiscount = Math.max(0, Number(discountAmount) || 0);
  const calculatedNet = Math.max(0, subtotal - numericDiscount);

  const sanitizedItemsForSave = useMemo(() => {
    return lines
      .filter((l) => l.description.trim().length > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Math.max(0.01, Number(l.quantity) || 1),
        unitRate: Math.max(0, Number(l.unitRate) || 0),
      }));
  }, [lines]);

  const handleSubmit = async (autoPrint = false) => {
    if (!customInvoiceNumber.trim()) {
      setErrorMsg("Please enter an official invoice number.");
      return;
    }

    if (sanitizedItemsForSave.length === 0) {
      setErrorMsg("Please add at least one line item to the invoice.");
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
          items: sanitizedItemsForSave,
          discountAmount: numericDiscount,
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
      width={showPrintView ? "max-w-4xl" : "max-w-4xl"}
      title={
        <span className="inline-flex items-center gap-2">
          <Receipt className="w-4 h-4 text-purple-700" />
          {showPrintView
            ? "Official Tax Invoice · Printable Document"
            : "Tax Invoice & Manual Accounting Line Items"}
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · ${
        job?.customer?.name || "Client Billing"
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
                ← Back to Invoice Editor
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
                  onClick={() =>
                    printDocument(
                      "#printable-tax-invoice",
                      customInvoiceNumber || "Tax_Invoice"
                    )
                  }
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0B6851] text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintView(true)}
                  disabled={sanitizedItemsForSave.length === 0}
                  className="px-3 py-1.5 border border-purple-200 text-purple-800 hover:bg-purple-50 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                  Preview Document
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-purple-800" />
                  {isSubmitting ? "Saving..." : "Save Invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Save & Print PDF
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
          customItems={sanitizedItemsForSave}
          customDiscount={numericDiscount}
          onClose={() => setShowPrintView(false)}
        />
      ) : (
        <div className="space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Invoice Header Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                Customer Name
              </label>
              <div className="font-bold text-zinc-900 truncate">
                {job?.customer?.name || "Customer"}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {job?.customer?.phone || "No phone recorded"}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                Tax Invoice Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. INV-2026-0842"
                value={customInvoiceNumber}
                onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold text-xs text-purple-950 focus:ring-1 focus:ring-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                Net Billable Total
              </label>
              <div className="font-mono font-black text-base text-purple-900">
                {formatCurrency(calculatedNet)}
              </div>
              <div className="text-[10px] text-zinc-500">
                {lines.length} billable line item(s)
              </div>
            </div>
          </div>

          {/* Line Items Editor Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-zinc-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-purple-700" />
                  Accounting Invoice Line Items ({lines.length})
                </h4>
                <p className="text-[10px] text-zinc-500">
                  Select service items from the 245+ item catalog dropdown or enter custom billing descriptions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetToJobItems}
                  className="px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 transition inline-flex items-center gap-1 shadow-2xs"
                  title="Reload items initially registered by field technician"
                >
                  <RotateCcw className="w-3 h-3 text-zinc-500" />
                  Reset to Job Scope
                </button>
                <button
                  type="button"
                  onClick={addLine}
                  className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-700" />
                  + Add Line
                </button>
              </div>
            </div>

            {/* Line items table / stack */}
            <div className="space-y-3">
              {lines.map((row, index) => {
                const q = Math.max(0, Number(row.quantity) || 0);
                const r = Math.max(0, Number(row.unitRate) || 0);
                const lineTotal = q * r;

                return (
                  <div
                    key={row.id}
                    className="p-3 bg-white border border-zinc-200 rounded-xl hover:border-purple-300 transition-colors shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span className="font-bold text-zinc-700">Line #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeLine(row.id)}
                        className="text-zinc-400 hover:text-rose-600 p-0.5 rounded transition"
                        title="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Catalog Searchable Select */}
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-600 mb-1 block">
                        Select from 245+ Service Catalog:
                      </label>
                      <SearchableSelect
                        options={catalogSelectOptions}
                        value={row.catalogId}
                        onChange={(val) => handleSelectCatalogItem(row.id, val)}
                        placeholder="Search service by category (e.g. Split, Gas, Geyser, Fridge, Pipe, Ducting)..."
                        searchPlaceholder="Type service keyword..."
                        clearable
                        className="w-full text-xs"
                      />
                    </div>

                    {/* Description text input */}
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-600 mb-1 block">
                        Invoice Description / Particulars:
                      </label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateLine(row.id, { description: e.target.value })}
                        placeholder="Enter service details or edit selected catalog item..."
                        className="w-full bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs text-zinc-900 focus:bg-white focus:ring-1 focus:ring-purple-600 focus:outline-none font-medium"
                      />
                    </div>

                    {/* Qty, Unit Rate & Total */}
                    <div className="grid grid-cols-3 gap-2.5 items-end pt-1">
                      <div>
                        <label className="text-[10px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={row.quantity}
                          onChange={(e) => updateLine(row.id, { quantity: e.target.value })}
                          className="w-full bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold text-xs text-zinc-900 focus:bg-white focus:ring-1 focus:ring-purple-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase font-bold text-zinc-500 block mb-1">
                          Unit Rate (PKR)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.unitRate}
                          onChange={(e) => updateLine(row.id, { unitRate: e.target.value })}
                          className="w-full bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-300 font-mono font-bold text-xs text-zinc-900 focus:bg-white focus:ring-1 focus:ring-purple-600 focus:outline-none"
                        />
                      </div>

                      <div className="text-right pb-1">
                        <span className="text-[9px] font-mono uppercase text-zinc-400 block">
                          Line Total
                        </span>
                        <span className="font-mono font-bold text-xs text-zinc-900">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addLine}
              className="w-full py-2 border-2 border-dashed border-zinc-200 hover:border-purple-300 hover:bg-purple-50/50 rounded-xl text-xs font-semibold text-zinc-600 hover:text-purple-800 transition inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Another Line Item
            </button>
          </div>

          {/* Summary & Financial Balance Box */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-zinc-600">
              <span>Gross Line Items Subtotal:</span>
              <span className="font-mono font-bold text-zinc-900">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-600">
              <label htmlFor="inv-discount" className="cursor-pointer">
                Discount / Goodwill (PKR):
              </label>
              <div className="w-32">
                <input
                  id="inv-discount"
                  type="number"
                  min="0"
                  step="any"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-right bg-white px-2 py-1 rounded-md border border-zinc-300 font-mono font-bold text-xs text-rose-700 focus:ring-1 focus:ring-purple-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-sm font-bold text-zinc-900">
              <span>Net Invoiced Amount (Receivable):</span>
              <span className="font-mono text-base font-black text-purple-900">
                {formatCurrency(calculatedNet)}
              </span>
            </div>

            <div className="text-[10px] text-zinc-500 italic pt-1 border-t border-zinc-200/80">
              Amount in Words: {numberToWords(calculatedNet)}
            </div>
          </div>
        </div>
      )}
    </SideDrawer>
  );
}

