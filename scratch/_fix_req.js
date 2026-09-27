const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");

// Add imports
if (!t.includes("procurementUi")) {
  t = t.replace(
    'import { formatCurrency, formatDateTime, cn } from "@/lib/utils";',
    `import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  ProcurementStatusBadge,
  ProcurementEmptyState,
  CTA_PRIMARY,
  CTA_GHOST,
} from "@/components/procurement/procurementUi";`
  );
  console.log("imports added");
}

// Fix React.useEffect - need React already imported (yes)
if (!t.includes("from \"react\"") || !t.includes("useEffect")) {
  t = t.replace(
    'import React, { useState } from "react";',
    'import React, { useState, useEffect } from "react";'
  );
  t = t.replace("React.useEffect", "useEffect");
  console.log("useEffect import fixed");
} else if (t.includes("React.useEffect")) {
  t = t.replace(
    'import React, { useState } from "react";',
    'import React, { useState, useEffect } from "react";'
  );
  t = t.replace(/React\.useEffect/g, "useEffect");
  console.log("useEffect normalized");
}

// Replace status badge block more carefully
const statusStart = t.indexOf("pr.status === \"draft\"");
console.log("draft status at", statusStart);
// Find the td containing status
const statusTd = t.indexOf('<td className="py-3 px-3 text-center">', statusStart > 0 ? statusStart - 200 : 0);
// Actually search for the status cell after Requested Items
let marker = t.indexOf("{pr.status === \"converted_to_po\"");
console.log("converted marker", marker);
if (marker > 0 && !t.slice(marker-400, marker).includes("ProcurementStatusBadge")) {
  // find enclosing span start going backward
  const tdOpen = t.lastIndexOf("<td", marker);
  const tdClose = t.indexOf("</td>", marker) + 5;
  console.log("replacing status td", tdOpen, tdClose);
  const replacement = `<td className="py-2 px-3 text-center">
                        <ProcurementStatusBadge
                          status={pr.status}
                          label={
                            pr.status === "converted_to_po"
                              ? "Converted to PO"
                              : undefined
                          }
                        />
                      </td>`;
  t = t.slice(0, tdOpen) + replacement + t.slice(tdClose);
  console.log("status badge replaced");
}

// Primary actions - check if already there
if (!t.includes("Create PO") || !t.includes("canSubmitPr &&")) {
  const eyeBlock = t.indexOf('<Eye className="w-4 h-4" />');
  console.log("eye at", eyeBlock, "has primary?", t.includes("openPoGenerationModal([pr])"));
}

// Priority badge
t = t.replace(
  'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
  'bg-amber-50 text-amber-800 border-amber-200'
);
t = t.replace(
  'bg-zinc-100 text-zinc-600 border-zinc-200',
  'bg-slate-100 text-slate-600 border-slate-200'
);

// Convert detail modal to SideDrawer - find selectedPr modal
const drawerComment = t.indexOf("PR DETAILS DRAWER");
console.log("drawer comment", drawerComment);

fs.writeFileSync(p, t, "utf8");
console.log("saved, has procurementUi", t.includes("procurementUi"), "has StatusBadge usage", (t.match(/ProcurementStatusBadge/g)||[]).length);
