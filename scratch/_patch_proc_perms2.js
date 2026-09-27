const fs = require("fs");
const path = "src/lib/permissions.ts";
let s = fs.readFileSync(path, "utf8");

const procBlock = (obj) => {
  const lines = ["    // Procurement"];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`    "${k}": ${v},`);
  }
  return lines.join("\n");
};

const matrices = {
  accountant: {
    "procurement.view_pr": true,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": true,
    "procurement.payments": true,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": false,
    "procurement.po.send": false,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": true,
    "procurement.invoice.match": true,
    "procurement.invoice.approve": false,
    "procurement.payment.record": true,
    "procurement.vendor.manage": false,
    "procurement.costs.view": true,
    "procurement.reports.view": true,
  },
  storekeeper: {
    "procurement.view_pr": true,
    "procurement.create_pr": true,
    "procurement.approve_po": false,
    "procurement.grn": true,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": true,
    "procurement.pr.submit": true,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": false,
    "procurement.po.send": false,
    "procurement.grn.create": true,
    "procurement.grn.quality": true,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": false,
    "procurement.payment.record": false,
    "procurement.vendor.manage": false,
    "procurement.costs.view": false,
    "procurement.reports.view": false,
  },
  call_center: {
    "procurement.view_pr": false,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": false,
    "procurement.po.send": false,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": false,
    "procurement.payment.record": false,
    "procurement.vendor.manage": false,
    "procurement.costs.view": false,
    "procurement.reports.view": false,
  },
  cashier: {
    "procurement.view_pr": false,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": false,
    "procurement.po.send": false,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": false,
    "procurement.payment.record": false,
    "procurement.vendor.manage": false,
    "procurement.costs.view": false,
    "procurement.reports.view": false,
  },
  dispatcher: {
    "procurement.view_pr": false,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": false,
    "procurement.po.send": false,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": false,
    "procurement.payment.record": false,
    "procurement.vendor.manage": false,
    "procurement.costs.view": false,
    "procurement.reports.view": false,
  },
};

function replaceRoleProcurement(src, roleName, matrix) {
  // Find role block start
  const roleMarker = `  ${roleName}: {`;
  const idx = src.indexOf(roleMarker);
  if (idx < 0) throw new Error("role not found: " + roleName);
  const blockStart = idx;
  // Find matching closing }; for this role — naive brace count
  let i = src.indexOf("{", idx);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("end not found for " + roleName);
  let block = src.slice(blockStart, end + 1);
  // Remove existing procurement lines
  block = block.replace(/\n\s*\/\/ Procurement[\s\S]*?(?=\n\s*\/\/ |\n\s*\},)/, "\n");
  block = block.replace(/\n\s*"procurement\.[^"]+":\s*(true|false),/g, "");
  // Insert new matrix before Accounts section or before closing
  const accountsComment = block.indexOf("// Accounts");
  const insertAt = accountsComment >= 0 ? accountsComment : block.lastIndexOf("\n");
  const before = block.slice(0, insertAt);
  const after = block.slice(insertAt);
  block = before + "\n" + procBlock(matrix) + "\n" + after;
  return src.slice(0, blockStart) + block + src.slice(end + 1);
}

for (const [role, matrix] of Object.entries(matrices)) {
  s = replaceRoleProcurement(s, role, matrix);
}

// Update auditor mutates off for all new procurement mutate keys
const auditorMarker = "  auditor: {";
const aIdx = s.indexOf(auditorMarker);
if (aIdx < 0) throw new Error("auditor not found");
let i = s.indexOf("{", aIdx);
let depth = 0;
let end = -1;
for (; i < s.length; i++) {
  if (s[i] === "{") depth++;
  else if (s[i] === "}") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
let aBlock = s.slice(aIdx, end + 1);
// Ensure auditor has view keys true and mutates false
const auditorOverrides = `
    // Procurement: full view/reports/costs, no mutates
    "procurement.view_pr": true,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": false,
    "procurement.po.send": false,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": false,
    "procurement.payment.record": false,
    "procurement.vendor.manage": false,
    "procurement.costs.view": true,
    "procurement.reports.view": true,
`;
aBlock = aBlock.replace(/\n\s*"procurement\.[^"]+":\s*(true|false),/g, "");
aBlock = aBlock.replace(
  /(\.\.\.ALL_PERMISSION_KEYS\.reduce[\s\S]*?\}, \{\}\),)/,
  `$1${auditorOverrides}`
);
s = s.slice(0, aIdx) + aBlock + s.slice(end + 1);

// Insert purchasing + manager roles before auditor (or after storekeeper)
const purchasingRole = `
  purchasing: {
    "jobs.view_directory": true,
    "jobs.view_financials": false,
    "inventory.view_stock": true,
    "inventory.view_costs": true,
    // Procurement — RFQ/PO/vendor; no PR approve, payment, or GRN mutate
    "procurement.view_pr": true,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": false,
    "procurement.rfq.manage": true,
    "procurement.rfq.award": true,
    "procurement.po.create": true,
    "procurement.po.approve": false,
    "procurement.po.send": true,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": false,
    "procurement.payment.record": false,
    "procurement.vendor.manage": true,
    "procurement.costs.view": true,
    "procurement.reports.view": true,
    "accounts.general_ledger": false,
    "audit.view_logs": false,
  },

  manager: {
    "jobs.view_directory": true,
    "jobs.view_financials": true,
    "jobs.reports": true,
    "inventory.view_stock": true,
    "inventory.view_costs": true,
    // Procurement — approvals + reports; limited create
    "procurement.view_pr": true,
    "procurement.create_pr": false,
    "procurement.approve_po": true,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    "procurement.pr.create": false,
    "procurement.pr.submit": false,
    "procurement.pr.approve": true,
    "procurement.rfq.manage": false,
    "procurement.rfq.award": false,
    "procurement.po.create": false,
    "procurement.po.approve": true,
    "procurement.po.send": false,
    "procurement.grn.create": false,
    "procurement.grn.quality": false,
    "procurement.invoice.create": false,
    "procurement.invoice.match": false,
    "procurement.invoice.approve": true,
    "procurement.payment.record": false,
    "procurement.vendor.manage": false,
    "procurement.costs.view": true,
    "procurement.reports.view": true,
    "accounts.general_ledger": true,
    "accounts.financial_reports": true,
    "audit.view_logs": true,
  },
`;

if (!s.includes("  purchasing: {")) {
  s = s.replace("  auditor: {", purchasingRole + "\n  auditor: {");
}

fs.writeFileSync(path, s);
console.log("OK role matrices", s.length);
