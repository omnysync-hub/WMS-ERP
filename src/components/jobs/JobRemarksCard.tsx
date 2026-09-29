"use client";

import React from "react";
import {
  Wrench,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Package,
  Camera,
  Layers,
  FileText,
  Tag,
} from "lucide-react";

import { useRole } from "@/contexts/RoleContext";

interface JobRemarksCardProps {
  remarks?: string | null;
  className?: string;
  showCustomerPayment?: boolean;
  showUnusedStockReason?: boolean;
}

interface ParsedRemarks {
  equipment?: {
    type: string;
    brand?: string;
    model?: string;
  };
  primaryDiagnosis?: string;
  fieldExecution?: string;
  customerPayment?: string;
  unusedStockReason?: string;
  proofPhotos?: string;
  otherLines: string[];
}

export function parseJobRemarks(rawRemarks?: string | null): ParsedRemarks {
  if (!rawRemarks || !rawRemarks.trim()) {
    return { otherLines: [] };
  }

  // 1. Sanitize string, fix mojibake â€¢ -> •
  const clean = rawRemarks
    .replace(/\u00e2\u20ac\u00a2|â€¢/g, " • ")
    .replace(/\s+/g, " ")
    .trim();

  let remainder = clean;
  let equipment: ParsedRemarks["equipment"] = undefined;

  // 2. Extract [Equipment: ... | Brand: ... | Model: ...]
  const equipMatch = remainder.match(
    /^\[Equipment:\s*([^|\]]+?)(?:\s*\|\s*Brand:\s*([^|\]]+?))?(?:\s*\|\s*Model:\s*([^|\]]+?))?\]\s*(.*)$/i
  );

  if (equipMatch) {
    equipment = {
      type: equipMatch[1]?.trim() || "HVAC Unit",
      brand: equipMatch[2]?.trim(),
      model: equipMatch[3]?.trim(),
    };
    remainder = equipMatch[4]?.trim() || "";
  }

  // 3. Break remainder by standard delimiters: | or • or newlines
  const rawSegments = remainder
    .split(/\s*(?:\||•|\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  let fieldExecution: string | undefined;
  let customerPayment: string | undefined;
  let unusedStockReason: string | undefined;
  let proofPhotos: string | undefined;
  const primaryParts: string[] = [];
  const otherLines: string[] = [];

  for (const seg of rawSegments) {
    const lower = seg.toLowerCase();
    if (lower.startsWith("field work execution:")) {
      fieldExecution = seg.replace(/^field work execution:\s*/i, "").trim();
    } else if (lower.startsWith("customer payment:")) {
      customerPayment = seg.replace(/^customer payment:\s*/i, "").trim();
    } else if (lower.startsWith("unused stock reason:")) {
      unusedStockReason = seg.replace(/^unused stock reason:\s*/i, "").trim();
    } else if (lower.startsWith("proof photos:")) {
      proofPhotos = seg.replace(/^proof photos:\s*/i, "").trim();
    } else if (!fieldExecution && !customerPayment && !unusedStockReason && !proofPhotos) {
      primaryParts.push(seg);
    } else {
      otherLines.push(seg);
    }
  }

  const primaryDiagnosis = primaryParts.join(" · ").trim() || undefined;

  return {
    equipment,
    primaryDiagnosis,
    fieldExecution,
    customerPayment,
    unusedStockReason,
    proofPhotos,
    otherLines,
  };
}

export default function JobRemarksCard({
  remarks,
  className = "",
  showCustomerPayment,
  showUnusedStockReason,
}: JobRemarksCardProps) {
  const { activeRole, currentRole, hasPermission } = useRole();
  const effectiveRole = (activeRole || currentRole || "").toLowerCase();
  const isRestrictedRole = ["dispatcher", "call_center"].includes(effectiveRole);

  const canSeePayment =
    showCustomerPayment !== undefined
      ? showCustomerPayment
      : hasPermission("jobs.view_financials") && !isRestrictedRole;

  const canSeeUnusedStock =
    showUnusedStockReason !== undefined
      ? showUnusedStockReason
      : !isRestrictedRole;

  if (!remarks || !remarks.trim()) {
    return null;
  }

  const parsed = parseJobRemarks(remarks);
  const showPaymentCard = Boolean(parsed.customerPayment && canSeePayment);
  const showUnusedStockCard = Boolean(parsed.unusedStockReason && canSeeUnusedStock);
  const showPhotosCard = Boolean(parsed.proofPhotos);

  const hasStructuredData =
    Boolean(parsed.equipment) ||
    Boolean(parsed.primaryDiagnosis) ||
    Boolean(parsed.fieldExecution) ||
    showPaymentCard ||
    showUnusedStockCard ||
    showPhotosCard ||
    parsed.otherLines.length > 0;

  // If remarks only consisted of hidden financial/warehouse segments and nothing else is visible, return null
  if (!hasStructuredData && (parsed.customerPayment || parsed.unusedStockReason)) {
    return null;
  }

  return (
    <div
      className={`bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F]">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            Problem Diagnosis & Work Notes
          </h3>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Equipment Specifications Bar */}
        {parsed.equipment && (
          <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#71717A] uppercase tracking-wider mb-2">
              <Layers className="w-3.5 h-3.5 text-[#0D7A5F]" />
              Target Equipment & Asset Profile
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-[#E4E4E7]">
                <span className="text-[10px] uppercase font-bold text-[#71717A] block">
                  Equipment Category
                </span>
                <span className="text-xs font-bold text-[#18181B] mt-0.5 block">
                  {parsed.equipment.type}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#E4E4E7]">
                <span className="text-[10px] uppercase font-bold text-[#71717A] block">
                  Brand / Manufacturer
                </span>
                <span className="text-xs font-bold text-[#18181B] mt-0.5 block">
                  {parsed.equipment.brand || "Standard"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#E4E4E7]">
                <span className="text-[10px] uppercase font-bold text-[#71717A] block">
                  Model / Series
                </span>
                <span className="text-xs font-bold text-[#18181B] mt-0.5 block">
                  {parsed.equipment.model || "Unspecified"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Primary Diagnosis / Reported Issue */}
        {parsed.primaryDiagnosis && (
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Primary Problem Diagnosis & Client Complaint
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#18181B] leading-relaxed">
              {parsed.primaryDiagnosis}
            </p>
          </div>
        )}

        {/* Field Work Execution */}
        {parsed.fieldExecution && (
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Field Work Execution & Technical Resolution
            </div>
            <p className="text-sm font-medium text-[#18181B] leading-relaxed">
              {parsed.fieldExecution}
            </p>
          </div>
        )}

        {/* Operational & Settlement Badges / Cards */}
        {(showPaymentCard || showUnusedStockCard || showPhotosCard) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {showPaymentCard && (
              <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg p-3 flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-emerald-50 text-[#0D7A5F] border border-emerald-200 shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A] block">
                    Customer Payment
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 mt-0.5 block">
                    {parsed.customerPayment}
                  </span>
                </div>
              </div>
            )}

            {showUnusedStockCard && (
              <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg p-3 flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A] block">
                    Unused Stock Reason
                  </span>
                  <span className="text-xs font-medium text-[#18181B] mt-0.5 block">
                    {parsed.unusedStockReason}
                  </span>
                </div>
              </div>
            )}

            {showPhotosCard && (
              <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg p-3 flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#71717A] block">
                    Field Proof Photos
                  </span>
                  <span className="text-xs font-bold text-[#18181B] mt-0.5 block">
                    {parsed.proofPhotos} {Number(parsed.proofPhotos) === 1 ? "photo" : "photos"} logged
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Any Other Notes / Lines */}
        {parsed.otherLines.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
              Additional Technical Notes
            </span>
            <div className="space-y-1.5">
              {parsed.otherLines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg text-xs font-medium text-[#27272A] flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D7A5F] mt-1.5 shrink-0" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback if no specific segments detected */}
        {!hasStructuredData && (
          <div className="p-3.5 bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg text-sm font-medium text-[#18181B] leading-relaxed">
            {remarks}
          </div>
        )}
      </div>
    </div>
  );
}
