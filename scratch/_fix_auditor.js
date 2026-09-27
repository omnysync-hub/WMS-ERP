const fs = require("fs");
const path = "src/lib/permissions.ts";
let s = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const oldAuditor = `  auditor: {
    // Full Audit visibility across everything
    ...ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    // Can view all, but cannot create financial changes
    "jobs.create_job": false,
    "jobs.cancel_job": false,
    "settings.manage_users": false,
    "settings.manage_roles": false,
  },`;

const newAuditor = `  auditor: {
    // Full Audit visibility across everything
    ...ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    // Can view all, but cannot create financial changes / procurement mutates
    "jobs.create_job": false,
    "jobs.cancel_job": false,
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
    "procurement.view_pr": true,
    "settings.manage_users": false,
    "settings.manage_roles": false,
  },`;

if (!s.includes(oldAuditor)) {
  // try softer match
  if (s.includes('"procurement.pr.create": false') && s.includes("auditor: {") && s.match(/auditor: \{[\s\S]*?procurement\.pr\.create/)) {
    console.log("auditor already has procurement overrides");
  } else {
    throw new Error("auditor block not found exactly");
  }
} else {
  s = s.replace(oldAuditor, newAuditor);
  fs.writeFileSync(path, s.replace(/\n/g, "\r\n"));
  console.log("auditor fixed");
}
