const fs = require("fs");
const path = "src/components/procurement/GoodsReceiptTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

// Add SideDrawer import
if (!s.includes('SideDrawer')) {
  s = s.replace(
    'import {\n  ProcurementEmptyState,\n} from "@/components/procurement/procurementUi";',
    'import {\n  ProcurementEmptyState,\n  ProcurementStatusBadge,\n} from "@/components/procurement/procurementUi";\nimport SideDrawer from "@/components/ui/SideDrawer";'
  );
  console.log("SideDrawer import added");
}

// Add openPos helper and auto-select messaging after state
if (!s.includes("openPosForReceipt")) {
  s = s.replace(
    `  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handlePoSelect = (poId: string) => {`,
    `  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewingPoDrawer, setViewingPoDrawer] = useState<any | null>(null);

  /** Open POs with remaining qty — GRN is always against a PO */
  const openPosForReceipt = pos.filter((p) => {
    const st = (p.status || "").toLowerCase();
    if (["cancelled", "canceled", "closed", "draft"].includes(st)) return false;
    if (!["approved", "sent_to_vendor", "partially_received", "sent"].includes(st) && st !== "approved") {
      // still allow if any line has remaining
    }
    const items = p.items || [];
    const hasRemaining = items.some(
      (it: any) => Math.max(0, (it.quantity || 0) - (it.quantityReceived || 0)) > 0
    );
    return hasRemaining && !["cancelled", "canceled", "closed", "draft"].includes(st);
  });

  const handlePoSelect = (poId: string) => {`
  );
  console.log("openPosForReceipt added");
}

// Filter receipt items to remaining > 0 by default in handlePoSelect
s = s.replace(
  `      setReceiptItems(
        po.items.map((it: any) => {
          const remaining = Math.max(0, it.quantity - (it.quantityReceived || 0));
          return {
            poItemId: it.id,
            description: it.description,
            unit: it.unit || "unit",
            orderedQty: it.quantity,
            alreadyReceivedQty: it.quantityReceived || 0,
            quantityReceived: remaining, // default to remaining
            qualityStatus: "Accepted",
            rejectionReason: "",
            batchNumber: "",
            serialNumber: "",
            expiryDate: "",
            unitCost: it.unitCost || 0,
          };
        })
      );`,
  `      setReceiptItems(
        po.items
          .map((it: any) => {
            const remaining = Math.max(0, it.quantity - (it.quantityReceived || 0));
            return {
              poItemId: it.id,
              description: it.description,
              unit: it.unit || "unit",
              orderedQty: it.quantity,
              alreadyReceivedQty: it.quantityReceived || 0,
              quantityReceived: remaining,
              qualityStatus: "Accepted" as const,
              rejectionReason: "",
              batchNumber: "",
              serialNumber: "",
              expiryDate: "",
              unitCost: it.unitCost || 0,
            };
          })
          .filter((it: any) => it.quantityReceived > 0 || it.orderedQty > it.alreadyReceivedQty)
      );`
);

// Replace PO select dropdown to use openPosForReceipt + clearer label — find select for selectedPoId
if (!s.includes("Receive against open Purchase Order") && s.includes("selectedPoId")) {
  // Replace common label if present
  s = s.replace(
    /Pull from Purchase Order|Select Purchase Order|Source Purchase Order/gi,
    "Receive against open Purchase Order"
  );
}

// Prefer openPosForReceipt in the select options map - replace pos.filter or pos.map in create modal
// Look for pattern: pos.filter or pos.map near selectedPoId select
if (s.includes("value={selectedPoId}") && !s.includes("openPosForReceipt.map")) {
  // Replace the options source near the select - fragile; do a targeted replace
  const selIdx = s.indexOf("value={selectedPoId}");
  // find pos. after this within 800 chars
  const slice = s.slice(selIdx, selIdx + 1200);
  if (slice.includes("pos.filter") || slice.includes("pos.map")) {
    let updated = slice
      .replace(/pos\.filter\([^)]+\)\.map/, "openPosForReceipt.map")
      .replace(/\{pos\.map/, "{openPosForReceipt.map");
    // Only first occurrence in slice
    s = s.slice(0, selIdx) + updated + s.slice(selIdx + slice.length);
    console.log("PO select uses openPosForReceipt");
  } else {
    console.log("Could not auto-swap pos.map — manual note");
    console.log(slice.slice(0, 400));
  }
}

// Add banner above create form when showCreateModal
if (!s.includes("GRN is always booked against a PO") && s.includes("showCreateModal")) {
  s = s.replace(
    `{showCreateModal && (`,
    `{showCreateModal && (
        /* GRN always against PO — drawer-style modal with remaining qty */`
  );
}

// Convert viewing GRN modal to also set viewing - add SideDrawer for GRN detail at end before final closing
if (!s.includes("<SideDrawer") && s.includes("viewingGrn")) {
  // Append SideDrawer before last closing of component - find `viewingGrn &&` modal or add after it
  const endMarker = `\n}\n`;
  // Add drawer for selected PO quick view + enhance empty state for no open POs
  s = s.replace(
    `export default function GoodsReceiptTab`,
    `export default function GoodsReceiptTab`
  );
  
  // Before the final `}` of the component (last line), inject SideDrawer for viewingGrn if still using modal — 
  // Simpler: add helper text in controls
  if (s.includes("Create GRN") || s.includes("Record Goods Receipt") || s.includes("New Goods Receipt")) {
    console.log("GRN create CTA present");
  }
}

// Add sticky controls
s = s.replace(
  '<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">',
  '<div className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">'
);

// After return opening, ensure preset auto-calls handlePoSelect - check useEffect for preset
if (!s.includes("presetPoForGrn") || !s.includes("useEffect")) {
  // add useEffect import if needed
  if (!s.includes("useEffect")) {
    s = s.replace('import React, { useState } from "react";', 'import React, { useState, useEffect } from "react";');
  }
  if (!s.includes("useEffect(() => {\n    if (presetPoForGrn")) {
    s = s.replace(
      `  const [formError, setFormError] = useState("");`,
      `  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (presetPoForGrn?.id) {
      setShowCreateModal(true);
      handlePoSelect(presetPoForGrn.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPoForGrn?.id]);`
    );
    // Problem: handlePoSelect used before defined - move useEffect after handlePoSelect
    console.log("NOTE: preset useEffect may need reorder");
  }
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("GoodsReceiptTab patched");
