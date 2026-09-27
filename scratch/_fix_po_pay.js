const fs=require("fs");
const path=require("path");
const root="D:\\WORKMAN SERVICES\\src\\components\\procurement";

// ---- Safe PO patch ----
{
  let t=fs.readFileSync(path.join(root,"PurchaseOrdersTab.tsx"),"utf8");
  const UI_IMPORT = `import {
  ProcurementStatusBadge,
  ProcurementEmptyState,
  CTA_PRIMARY,
  CTA_GHOST,
} from "@/components/procurement/procurementUi";
`;
  if (!t.includes("procurementUi")) {
    t = t.replace(
      /import \{[^}]+\} from "@\/lib\/utils";/,
      (m) => m + "\n" + UI_IMPORT
    );
  }

  if (!t.includes("queueFilter?:")) {
    t = t.replace(
      /interface PurchaseOrdersTabProps \{([\s\S]*?)\}/,
      (m) => m.replace(/\r?\n\}/, "\n  queueFilter?: string | null;\n}")
    );
  }
  if (!t.includes("queueFilter = null")) {
    t = t.replace(
      "onOpenGrnModal,\r\n}: PurchaseOrdersTabProps)",
      "onOpenGrnModal,\r\n  queueFilter = null,\r\n}: PurchaseOrdersTabProps)"
    );
    t = t.replace(
      "onOpenGrnModal,\n}: PurchaseOrdersTabProps)",
      "onOpenGrnModal,\n  queueFilter = null,\n}: PurchaseOrdersTabProps)"
    );
  }

  const ri = t.match(/import React[^;]+;/);
  if (ri && !ri[0].includes("useEffect")) {
    t = t.replace(ri[0], ri[0].replace("useState", "useState, useEffect"));
  }

  if (!t.includes("queueFilter sync")) {
    t = t.replace(
      'const [statusFilter, setStatusFilter] = useState("all");',
      'const [statusFilter, setStatusFilter] = useState(queueFilter || "all");\r\n\r\n  // queueFilter sync\r\n  useEffect(() => {\r\n    if (queueFilter) setStatusFilter(queueFilter);\r\n  }, [queueFilter]);'
    );
  }

  t = t.replace(/table className="w-full text-left border-collapse text-xs"/g, 'table className="w-full text-left border-collapse text-sm"');
  if (!t.includes('thead className="sticky top-0 z-10"')) {
    t = t.replace(
      /<thead>\r?\n(\s*)<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/,
      '<thead className="sticky top-0 z-10">\n$1<tr className="border-b border-[#EDEDED] bg-[#F8FAFC]'
    );
  }

  // empty state - careful
  if (!t.includes('title="No purchase orders"')) {
    t = t.replace(
      /<td colSpan=\{8\} className="py-8 text-center text-\[#A1A1AA\]">\r?\n\s*No purchase orders found\.[^<]*<\/td>/,
      `<td colSpan={8} className="p-0">
                    <ProcurementEmptyState
                      title="No purchase orders"
                      description="Convert an approved PR or create a PO to start a vendor order."
                    />
                  </td>`
    );
  }

  // Status badge only — do not touch action buttons
  const marker = 'po.status === "draft"';
  const start = t.indexOf(marker);
  // Find the one in the table body (after Actions header)
  const actionsTh = t.indexOf(">Actions</th>");
  const tableStatus = t.indexOf(marker, actionsTh);
  if (tableStatus > 0 && !t.slice(tableStatus - 250, tableStatus).includes("ProcurementStatusBadge")) {
    const tdOpen = t.lastIndexOf("<td", tableStatus);
    const tdClose = t.indexOf("</td>", tableStatus) + 5;
    t = t.slice(0, tdOpen) + `<td className="py-2 px-3 text-center">
                        <ProcurementStatusBadge status={po.status} />
                      </td>` + t.slice(tdClose);
    console.log("PO status badge OK");
  }

  fs.writeFileSync(path.join(root,"PurchaseOrdersTab.tsx"), t);
  console.log("PO patched safely", t.includes("queueFilter = null"));
}

// ---- Fix PaymentsTab ----
{
  let t=fs.readFileSync(path.join(root,"PaymentsTab.tsx"),"utf8");
  console.log("--- Payments destructure ---");
  const fn = t.match(/export default function PaymentsTab\([\s\S]*?\}: PaymentsTabProps\)/);
  console.log(fn && fn[0]);
  const iface = t.match(/interface PaymentsTabProps[\s\S]*?\}/);
  console.log(iface && iface[0]);

  if (!t.includes("queueFilter = null")) {
    // try various patterns
    if (t.includes("presetInvoiceForPay,\r\n}: PaymentsTabProps)")) {
      t = t.replace(
        "presetInvoiceForPay,\r\n}: PaymentsTabProps)",
        "presetInvoiceForPay,\r\n  queueFilter = null,\r\n}: PaymentsTabProps)"
      );
    } else if (t.includes("presetInvoiceForPay\r\n}: PaymentsTabProps)")) {
      t = t.replace(
        "presetInvoiceForPay\r\n}: PaymentsTabProps)",
        "presetInvoiceForPay,\r\n  queueFilter = null,\r\n}: PaymentsTabProps)"
      );
    } else if (t.includes("presetInvoiceForPay,\n}: PaymentsTabProps)")) {
      t = t.replace(
        "presetInvoiceForPay,\n}: PaymentsTabProps)",
        "presetInvoiceForPay,\n  queueFilter = null,\n}: PaymentsTabProps)"
      );
    } else {
      // insert before }: PaymentsTabProps)
      t = t.replace(
        /\}: PaymentsTabProps\)/,
        "  queueFilter = null,\n}: PaymentsTabProps)"
      );
    }
  }

  // ensure interface has queueFilter
  if (!t.includes("queueFilter?:")) {
    t = t.replace(
      /interface PaymentsTabProps \{([\s\S]*?)\}/,
      (m) => m.replace(/\r?\n\}/, "\n  queueFilter?: string | null;\n}")
    );
  }

  // useEffect import
  const ri = t.match(/import React[^;]+;/);
  if (ri && !ri[0].includes("useEffect")) {
    t = t.replace(ri[0], ri[0].replace("{ useState", "{ useState, useEffect").replace("{useState", "{ useState, useEffect"));
  }

  fs.writeFileSync(path.join(root,"PaymentsTab.tsx"), t);
  console.log("Payments fixed", t.includes("queueFilter = null"));
  const fn2 = t.match(/export default function PaymentsTab\([\s\S]*?\}: PaymentsTabProps\)/);
  console.log(fn2 && fn2[0]);
}
