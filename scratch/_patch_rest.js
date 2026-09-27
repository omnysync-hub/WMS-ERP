const fs = require("fs");
const path = require("path");
const root = "D:\\WORKMAN SERVICES\\src\\components\\procurement";

function read(name) { return fs.readFileSync(path.join(root, name), "utf8"); }
function write(name, t) { fs.writeFileSync(path.join(root, name), t, "utf8"); console.log("WROTE", name); }

const UI_IMPORT = `import {
  ProcurementStatusBadge,
  ProcurementEmptyState,
  CTA_PRIMARY,
  CTA_GHOST,
} from "@/components/procurement/procurementUi";
`;

// ==================== PurchaseOrdersTab ====================
{
  let t = read("PurchaseOrdersTab.tsx");
  if (!t.includes("procurementUi")) {
    t = t.replace(
      /import \{[^}]+\} from "@\/lib\/utils";/,
      (m) => m + "\n" + UI_IMPORT
    );
  }

  // props
  if (!t.includes("queueFilter")) {
    t = t.replace(
      /interface PurchaseOrdersTabProps \{([\s\S]*?)\}/,
      (m) => m.replace(/\n\}/, "\n  queueFilter?: string | null;\n}")
    );
    t = t.replace(
      /export default function PurchaseOrdersTab\(\{([\s\S]*?)\}: PurchaseOrdersTabProps\)/,
      (m) => m.replace("onOpenGrnModal,", "onOpenGrnModal,\n  queueFilter = null,")
    );
  }

  if (!t.includes("useEffect")) {
    t = t.replace('import React, { useState', 'import React, { useState, useEffect');
  }
  if (!t.includes("queueFilter sync")) {
    t = t.replace(
      'const [statusFilter, setStatusFilter] = useState("all");',
      'const [statusFilter, setStatusFilter] = useState(queueFilter || "all");\n\n  // queueFilter sync\n  useEffect(() => {\n    if (queueFilter) setStatusFilter(queueFilter);\n  }, [queueFilter]);'
    );
  }

  t = t.replace(/table className="w-full text-left border-collapse text-xs"/g, 'table className="w-full text-left border-collapse text-sm"');
  t = t.replace(/<thead>\s*<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/g, '<thead className="sticky top-0 z-10">\n              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC]');

  // empty state
  t = t.replace(
    /No purchase orders found\.[^<]*/,
    (m) => m // keep for now, wrap below
  );
  if (!t.includes("ProcurementEmptyState") || (t.match(/ProcurementEmptyState/g)||[]).length < 2) {
    t = t.replace(
      /<td colSpan=\{[^}]+\} className="py-8 text-center text-\[#A1A1AA\]">\s*No purchase orders found\.[^<]*<\/td>/,
      `<td colSpan={8} className="p-0">
                    <ProcurementEmptyState
                      title="No purchase orders"
                      description="Convert an approved PR or create a PO to start a vendor order."
                    />
                  </td>`
    );
  }

  // Soften status badges - replace common emerald/rose/amber patterns for po.status spans with ProcurementStatusBadge where possible
  // Find Eye-only action column and add primary actions
  // Look for canApprove / canSend permissions
  const hasApprove = t.includes("procurement.po.approve");
  const hasSend = t.includes("procurement.po.send");
  console.log("PO perms refs", { hasApprove, hasSend });

  // Find permission consts
  const permLines = [...t.matchAll(/const can\w+ = hasPermission\([^)]+\);/g)].map(x=>x[0]);
  console.log(permLines);

  write("PurchaseOrdersTab.tsx", t);
}

// ==================== ThreeWayMatchTab ====================
{
  let t = read("ThreeWayMatchTab.tsx");
  if (!t.includes("procurementUi")) {
    t = t.replace(
      /import \{[^}]+\} from "@\/lib\/utils";/,
      (m) => m + "\n" + UI_IMPORT
    );
  }
  if (!t.includes("queueFilter")) {
    t = t.replace(
      /interface ThreeWayMatchTabProps \{([\s\S]*?)\}/,
      (m) => m.replace(/\n\}/, "\n  queueFilter?: string | null;\n}")
    );
    t = t.replace(
      /export default function ThreeWayMatchTab\(\{([\s\S]*?)\}: ThreeWayMatchTabProps\)/,
      (m) => m.includes("queueFilter") ? m : m.replace(
        "onNavigateToPayment,",
        "onNavigateToPayment,\n  queueFilter = null,"
      ).replace(
        /(\}: ThreeWayMatchTabProps\))/,
        (mm, a) => {
          // if onNavigateToPayment is last optional without trailing
          return mm;
        }
      )
    );
    // ensure destructure has queueFilter
    if (!t.includes("queueFilter = null")) {
      t = t.replace(
        "onNavigateToPayment,\n}: ThreeWayMatchTabProps)",
        "onNavigateToPayment,\n  queueFilter = null,\n}: ThreeWayMatchTabProps)"
      );
      t = t.replace(
        "onNavigateToPayment\n}: ThreeWayMatchTabProps)",
        "onNavigateToPayment,\n  queueFilter = null,\n}: ThreeWayMatchTabProps)"
      );
    }
  }
  if (!t.includes("useEffect")) {
    t = t.replace('import React, { useState', 'import React, { useState, useEffect');
    t = t.replace('import React, { useEffect, useState', 'import React, { useEffect, useState');
  }
  // check current react import
  const ri = t.match(/import React.*/)[0];
  console.log("Match react import", ri);
  if (!ri.includes("useEffect")) {
    t = t.replace(ri, ri.replace("useState", "useState, useEffect").replace("useEffect, useEffect", "useEffect"));
  }
  if (!t.includes("queueFilter sync")) {
    t = t.replace(
      'const [statusFilter, setStatusFilter] = useState("all");',
      'const [statusFilter, setStatusFilter] = useState(queueFilter || "all");\n\n  // queueFilter sync\n  useEffect(() => {\n    if (queueFilter) setStatusFilter(queueFilter);\n  }, [queueFilter]);'
    );
  }
  t = t.replace(/table className="w-full text-left border-collapse text-xs"/g, 'table className="w-full text-left border-collapse text-sm"');
  t = t.replace(/<thead>\s*<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/g, '<thead className="sticky top-0 z-10">\n              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC]');

  if (!t.includes('title="No supplier invoices"') && !t.includes("No invoices to match")) {
    t = t.replace(
      /<td colSpan=\{[^}]+\} className="py-8 text-center text-\[#A1A1AA\]">\s*No supplier invoices found\.[^<]*<\/td>/,
      `<td colSpan={7} className="p-0">
                    <ProcurementEmptyState
                      title="No invoices to match"
                      description="Record a supplier invoice against a GRN to start 3-way match."
                    />
                  </td>`
    );
  }
  write("ThreeWayMatchTab.tsx", t);
}

// ==================== PaymentsTab ====================
{
  let t = read("PaymentsTab.tsx");
  if (!t.includes("procurementUi")) {
    t = t.replace(
      /import \{[^}]+\} from "@\/lib\/utils";/,
      (m) => m + "\n" + UI_IMPORT
    );
  }
  if (!t.includes("queueFilter")) {
    t = t.replace(
      /interface PaymentsTabProps \{([\s\S]*?)\}/,
      (m) => m.replace(/\n\}/, "\n  queueFilter?: string | null;\n}")
    );
    t = t.replace(
      "presetInvoiceForPay,\n}: PaymentsTabProps)",
      "presetInvoiceForPay,\n  queueFilter = null,\n}: PaymentsTabProps)"
    );
    t = t.replace(
      "presetInvoiceForPay\n}: PaymentsTabProps)",
      "presetInvoiceForPay,\n  queueFilter = null,\n}: PaymentsTabProps)"
    );
  }
  const ri = t.match(/import React.*/)[0];
  if (!ri.includes("useEffect")) {
    t = t.replace(ri, ri.includes("useState") ? ri.replace("{ useState", "{ useState, useEffect") : ri);
  }
  if (!t.includes("queueFilter sync") && t.includes("filterPaymentStatus")) {
    t = t.replace(
      'const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");',
      'const [filterPaymentStatus, setFilterPaymentStatus] = useState(queueFilter || "all");\n\n  // queueFilter sync\n  useEffect(() => {\n    if (queueFilter) setFilterPaymentStatus(queueFilter);\n  }, [queueFilter]);'
    );
  }
  t = t.replace(/table className="w-full text-left border-collapse text-xs"/g, 'table className="w-full text-left border-collapse text-sm"');
  t = t.replace(/<thead>\s*<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/g, '<thead className="sticky top-0 z-10">\n              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC]');
  write("PaymentsTab.tsx", t);
}

// ==================== GoodsReceiptTab ====================
{
  let t = read("GoodsReceiptTab.tsx");
  if (!t.includes("procurementUi")) {
    t = t.replace(
      /import \{[^}]+\} from "@\/lib\/utils";/,
      (m) => m + "\n" + UI_IMPORT
    );
  }
  t = t.replace(/table className="w-full text-left border-collapse text-xs"/g, 'table className="w-full text-left border-collapse text-sm"');
  t = t.replace(/<thead>\s*<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/g, '<thead className="sticky top-0 z-10">\n              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC]');
  if (!t.includes("ProcurementEmptyState") || (t.match(/ProcurementEmptyState/g)||[]).length < 2) {
    t = t.replace(
      /<td colSpan=\{[^}]+\} className="py-8 text-center text-\[#A1A1AA\]">\s*No Goods Receipt Notes found\.[^<]*<\/td>/,
      `<td colSpan={7} className="p-0">
                    <ProcurementEmptyState
                      title="No goods receipts yet"
                      description="Receive materials against an issued purchase order."
                    />
                  </td>`
    );
  }
  write("GoodsReceiptTab.tsx", t);
}

// ==================== ApprovalsTab ====================
{
  let t = read("ProcurementApprovalsTab.tsx");
  if (!t.includes("procurementUi")) {
    t = t.replace(
      /import \{[^}]+\} from "@\/lib\/utils";/,
      (m) => m + "\n" + UI_IMPORT
    );
  }
  // Quiet empty states if any
  t = t.replace(/table className="w-full text-left border-collapse text-xs"/g, 'table className="w-full text-left border-collapse text-sm"');
  write("ProcurementApprovalsTab.tsx", t);
}

console.log("batch patch done");
