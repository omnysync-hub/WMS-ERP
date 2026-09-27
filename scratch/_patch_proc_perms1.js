const fs = require("fs");
const path = "src/lib/permissions.ts";
let s = fs.readFileSync(path, "utf8");

const newProcurementGroup = `  {
    id: "procurement",
    name: "Procurement & Sourcing",
    iconName: "ShoppingCart",
    description: "PR to RFQ to PO to GRN to 3-way match to payment with role-gated multi-party controls",
    permissions: [
      {
        key: "procurement.view_pr",
        label: "View Purchase Requisitions (legacy)",
        description: "Legacy view key — prefer fine-grained procurement.* keys",
        module: "procurement",
      },
      {
        key: "procurement.create_pr",
        label: "Raise PR (legacy)",
        description: "Legacy alias of procurement.pr.create",
        module: "procurement",
      },
      {
        key: "procurement.approve_po",
        label: "Approve PO (legacy)",
        description: "Legacy alias spanning po.approve / pr.approve",
        module: "procurement",
      },
      {
        key: "procurement.grn",
        label: "GRN (legacy)",
        description: "Legacy alias of grn.create + grn.quality",
        module: "procurement",
      },
      {
        key: "procurement.bills",
        label: "Supplier Bills (legacy)",
        description: "Legacy alias of invoice.create / match",
        module: "procurement",
      },
      {
        key: "procurement.payments",
        label: "Supplier Payments (legacy)",
        description: "Legacy alias of payment.record",
        module: "procurement",
      },
      {
        key: "procurement.pr.create",
        label: "Create Purchase Requisition",
        description: "Allow drafting new PRs for store / job / project needs",
        module: "procurement",
      },
      {
        key: "procurement.pr.submit",
        label: "Submit Purchase Requisition",
        description: "Allow submitting draft PRs into the approval queue",
        module: "procurement",
      },
      {
        key: "procurement.pr.approve",
        label: "Approve / Reject Purchase Requisition",
        description: "Allow managers to approve or reject submitted PRs",
        module: "procurement",
      },
      {
        key: "procurement.rfq.manage",
        label: "Manage RFQs and Quotes",
        description: "Allow creating RFQs and recording vendor quotations",
        module: "procurement",
      },
      {
        key: "procurement.rfq.award",
        label: "Award RFQ Winner",
        description: "Allow awarding an RFQ to a vendor (creates draft PO)",
        module: "procurement",
      },
      {
        key: "procurement.po.create",
        label: "Create Purchase Order",
        description: "Allow creating POs from PR conversion or direct entry",
        module: "procurement",
      },
      {
        key: "procurement.po.approve",
        label: "Approve Purchase Order",
        description: "Allow managers to approve draft POs before send",
        module: "procurement",
      },
      {
        key: "procurement.po.send",
        label: "Send PO to Vendor",
        description: "Allow purchasing to mark approved POs as sent",
        module: "procurement",
      },
      {
        key: "procurement.grn.create",
        label: "Create Goods Receipt (GRN)",
        description: "Allow storekeeper to record inward deliveries against PO",
        module: "procurement",
      },
      {
        key: "procurement.grn.quality",
        label: "GRN Quality Inspection",
        description: "Allow accepting/rejecting received quantities on GRN",
        module: "procurement",
      },
      {
        key: "procurement.invoice.create",
        label: "Create Supplier Invoice",
        description: "Allow recording vendor bills against PO/GRN",
        module: "procurement",
      },
      {
        key: "procurement.invoice.match",
        label: "Run 3-Way Match",
        description: "Allow matching supplier invoices to PO and GRN",
        module: "procurement",
      },
      {
        key: "procurement.invoice.approve",
        label: "Approve Supplier Invoice for Payment",
        description: "Allow approving matched/discrepancy invoices for AP disbursement",
        module: "procurement",
      },
      {
        key: "procurement.payment.record",
        label: "Record Supplier Payment",
        description: "Allow disbursing payment against approved-for-payment invoices only",
        module: "procurement",
      },
      {
        key: "procurement.vendor.manage",
        label: "Manage Vendor Master",
        description: "Allow creating and updating vendor records",
        module: "procurement",
      },
      {
        key: "procurement.costs.view",
        label: "View Procurement Costs and Pricing",
        description: "Allow viewing unit costs, PO totals, invoice amounts, and spend KPIs",
        module: "procurement",
      },
      {
        key: "procurement.reports.view",
        label: "View Procurement Reports",
        description: "Allow viewing procurement analytics and cycle-time reports",
        module: "procurement",
      },
    ],
  },`;

const start = s.indexOf('id: "procurement"');
if (start < 0) throw new Error("procurement group not found");
const groupStart = s.lastIndexOf("{", start);
const accountsIdx = s.indexOf('id: "accounts"', start);
if (accountsIdx < 0) throw new Error("accounts group not found");
const accountsGroupStart = s.lastIndexOf("{", accountsIdx);
s = s.slice(0, groupStart) + newProcurementGroup.trimEnd() + "\n  " + s.slice(accountsGroupStart);

const helpers = `

/** Legacy <-> fine-grained procurement permission aliases (bidirectional). */
export const PROCUREMENT_PERMISSION_ALIASES: Record<string, string[]> = {
  "procurement.pr.create": ["procurement.create_pr"],
  "procurement.create_pr": ["procurement.pr.create"],
  "procurement.pr.submit": ["procurement.create_pr", "procurement.pr.create"],
  "procurement.pr.approve": ["procurement.approve_po"],
  "procurement.po.approve": ["procurement.approve_po"],
  "procurement.approve_po": ["procurement.po.approve", "procurement.pr.approve"],
  "procurement.grn.create": ["procurement.grn"],
  "procurement.grn.quality": ["procurement.grn"],
  "procurement.grn": ["procurement.grn.create", "procurement.grn.quality"],
  "procurement.invoice.create": ["procurement.bills"],
  "procurement.invoice.match": ["procurement.bills"],
  "procurement.bills": ["procurement.invoice.create", "procurement.invoice.match"],
  "procurement.payment.record": ["procurement.payments"],
  "procurement.payments": ["procurement.payment.record"],
  "procurement.view_pr": ["procurement.pr.create", "procurement.reports.view"],
};

/** Resolve a permission key plus any legacy/fine-grained aliases. */
export function resolveProcurementPermissionKeys(permissionKey: string): string[] {
  const aliases = PROCUREMENT_PERMISSION_ALIASES[permissionKey] || [];
  return [permissionKey, ...aliases];
}

/** True when role map grants the key or any of its aliases. */
export function roleMapHasPermission(
  roleMap: Record<string, boolean> | undefined,
  permissionKey: string,
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  if (!roleMap) return false;
  for (const key of resolveProcurementPermissionKeys(permissionKey)) {
    if (roleMap[key] === true) return true;
  }
  return false;
}
`;

if (!s.includes("resolveProcurementPermissionKeys")) {
  s = s.trimEnd() + helpers + "\n";
}

fs.writeFileSync(path, s);
console.log("OK group+helpers", s.length);
