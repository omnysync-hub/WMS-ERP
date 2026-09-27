const fs = require("fs");

function patch(file, transforms) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const [name, fn] of transforms) {
    const before = s;
    s = fn(s);
    console.log(file, name, s === before ? "SKIP/NOCHANGE" : "OK");
  }
  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
}

// Approvals tab — gate approve/reject buttons
patch("src/components/procurement/ProcurementApprovalsTab.tsx", [
  ["perms", (s) => {
    if (s.includes("canApprovePr")) return s;
    // after useRole line add flags
    return s.replace(
      /const \{[^}]*hasPermission[^}]*\} = useRole\(\);/,
      (m) => m + `
  const canApprovePr = hasPermission("procurement.pr.approve");
  const canApprovePo = hasPermission("procurement.po.approve");
  const canApproveInvoice = hasPermission("procurement.invoice.approve");`
    );
  }],
]);

// Read approvals for button patterns
let appr = fs.readFileSync("src/components/procurement/ProcurementApprovalsTab.tsx", "utf8").replace(/\r\n/g, "\n");
// Find Approve buttons - typically onClick handlers for approve_pr etc.
// Gate by wrapping conditional render near action buttons - look for common labels
const buttonGates = [
  { label: ">Approve PR<", perm: "canApprovePr" },
];

// Simpler approach: disable handlers at start of approve functions
if (!appr.includes("if (!canApprovePr)")) {
  appr = appr.replace(
    /const handleApprovePr[^=]*= async[^{]*\{/,
    (m) => m + `\n    if (!canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }`
  );
  appr = appr.replace(
    /const handleRejectPr[^=]*= async[^{]*\{/,
    (m) => m + `\n    if (!canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }`
  );
  appr = appr.replace(
    /const handleApprovePo[^=]*= async[^{]*\{/,
    (m) => m + `\n    if (!canApprovePo) { alert("Missing permission: procurement.po.approve"); return; }`
  );
  appr = appr.replace(
    /const handleApproveInvoice[^=]*= async[^{]*\{/,
    (m) => m + `\n    if (!canApproveInvoice) { alert("Missing permission: procurement.invoice.approve"); return; }`
  );
  // Also try alternate names
  appr = appr.replace(
    /async function approvePr[^{]*\{/,
    (m) => m + `\n    if (!canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }`
  );
}

// Ensure canApprove* vars exist
if (!appr.includes("canApprovePr")) {
  appr = appr.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();\n  const canApprovePr = hasPermission("procurement.pr.approve");\n  const canApprovePo = hasPermission("procurement.po.approve");\n  const canApproveInvoice = hasPermission("procurement.invoice.approve");`;
    }
  );
}
fs.writeFileSync("src/components/procurement/ProcurementApprovalsTab.tsx", appr.replace(/\n/g, "\r\n"));
console.log("approvals gates");

// RequisitionsTab — create/submit/approve/convert
let req = fs.readFileSync("src/components/procurement/RequisitionsTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!req.includes('hasPermission("procurement.pr.create")')) {
  req = req.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();
  const canCreatePr = hasPermission("procurement.pr.create");
  const canSubmitPr = hasPermission("procurement.pr.submit");
  const canApprovePr = hasPermission("procurement.pr.approve");
  const canCreatePo = hasPermission("procurement.po.create");
  const canManageRfq = hasPermission("procurement.rfq.manage");`;
    }
  );
}
// Gate "New Requisition" / Raise PR button - find common patterns
req = req.replace(
  /\{selectedApprovedPrs\.length > 0 && \(/,
  `{selectedApprovedPrs.length > 0 && canCreatePo && (`
);
// Hide create button - look for text containing Purchase Requisition or New PR
req = req.replace(
  /(onClick=\{\(\) => setShowCreateModal\(true\)\}[^>]*>)/,
  (m) => m // keep
);
// Wrap create modal opener buttons that say "New" or "Raise"
if (req.includes("canCreatePr") && !req.includes("/* P0-BTN-CREATE-PR */")) {
  // Add guard on handleCreatePr
  req = req.replace(
    /const handleCreatePr = async \(e: React\.FormEvent\) => \{/,
    `const handleCreatePr = async (e: React.FormEvent) => {\n    if (!canCreatePr) { alert("Missing permission: procurement.pr.create"); return; }`
  );
  req = req.replace(
    /status: "submitted" \| "approved" \| "rejected",/,
    `status: "submitted" | "approved" | "rejected", // P0-BTN-CREATE-PR`
  );
  // Gate status update
  req = req.replace(
    /(const handleUpdateStatus = async[^{]*\{)/,
    `$1\n    if (status === "submitted" && !canSubmitPr) { alert("Missing permission: procurement.pr.submit"); return; }\n    if ((status === "approved" || status === "rejected") && !canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }`
  );
  req = req.replace(
    /(const handleGeneratePoSubmit = async[^{]*\{)/,
    `$1\n    if (!canCreatePo) { alert("Missing permission: procurement.po.create"); return; }`
  );
}
fs.writeFileSync("src/components/procurement/RequisitionsTab.tsx", req.replace(/\n/g, "\r\n"));
console.log("requisitions gates");

// PurchaseOrdersTab
let po = fs.readFileSync("src/components/procurement/PurchaseOrdersTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!po.includes('hasPermission("procurement.po.create")')) {
  po = po.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();
  const canCreatePo = hasPermission("procurement.po.create");
  const canApprovePo = hasPermission("procurement.po.approve");
  const canSendPo = hasPermission("procurement.po.send");
  const canCreateGrn = hasPermission("procurement.grn.create");
  const canViewCosts = hasPermission("procurement.costs.view");`;
    }
  );
}
if (!po.includes("if (!canCreatePo)")) {
  po = po.replace(/const handleCreatePo = async[^{]*\{/, (m) => m + `\n    if (!canCreatePo) { alert("Missing permission: procurement.po.create"); return; }`);
  po = po.replace(/const handleApprovePo = async[^{]*\{/, (m) => m + `\n    if (!canApprovePo) { alert("Missing permission: procurement.po.approve"); return; }`);
  po = po.replace(/const handleSendPo = async[^{]*\{/, (m) => m + `\n    if (!canSendPo) { alert("Missing permission: procurement.po.send"); return; }`);
}
fs.writeFileSync("src/components/procurement/PurchaseOrdersTab.tsx", po.replace(/\n/g, "\r\n"));
console.log("PO gates");

// GRN
let grn = fs.readFileSync("src/components/procurement/GoodsReceiptTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!grn.includes('hasPermission("procurement.grn.create")')) {
  grn = grn.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();\n  const canCreateGrn = hasPermission("procurement.grn.create");`;
    }
  );
}
if (!grn.includes("if (!canCreateGrn)")) {
  grn = grn.replace(/const handleCreateGrn = async[^{]*\{/, (m) => m + `\n    if (!canCreateGrn) { alert("Missing permission: procurement.grn.create"); return; }`);
  grn = grn.replace(/const handleSubmit = async[^{]*\{/, (m) => m + `\n    if (!canCreateGrn) { alert("Missing permission: procurement.grn.create"); return; }`);
}
fs.writeFileSync("src/components/procurement/GoodsReceiptTab.tsx", grn.replace(/\n/g, "\r\n"));
console.log("GRN gates");

// RFQ
let rfq = fs.readFileSync("src/components/procurement/RfqSourcingTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!rfq.includes("useRole()")) {
  rfq = rfq.replace(
    /(export default function RfqSourcingTab[^{]*\{)/,
    `$1\n  const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();`
  );
}
if (!rfq.includes('hasPermission("procurement.rfq.manage")')) {
  rfq = rfq.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();\n  const canManageRfq = hasPermission("procurement.rfq.manage");\n  const canAwardRfq = hasPermission("procurement.rfq.award");`;
    }
  );
}
if (!rfq.includes("if (!canManageRfq)") && rfq.includes("canManageRfq")) {
  // gate first async handlers loosely
  rfq = rfq.replace(
    /(const handleCreateRfq = async[^{]*\{)/,
    `$1\n    if (!canManageRfq) { alert("Missing permission: procurement.rfq.manage"); return; }`
  );
  rfq = rfq.replace(
    /(const handleSubmitQuote = async[^{]*\{)/,
    `$1\n    if (!canManageRfq) { alert("Missing permission: procurement.rfq.manage"); return; }`
  );
  rfq = rfq.replace(
    /(const handleAward = async[^{]*\{)/,
    `$1\n    if (!canAwardRfq) { alert("Missing permission: procurement.rfq.award"); return; }`
  );
  rfq = rfq.replace(
    /(const handleAwardRfq = async[^{]*\{)/,
    `$1\n    if (!canAwardRfq) { alert("Missing permission: procurement.rfq.award"); return; }`
  );
}
fs.writeFileSync("src/components/procurement/RfqSourcingTab.tsx", rfq.replace(/\n/g, "\r\n"));
console.log("RFQ gates");

// ThreeWayMatch
let inv = fs.readFileSync("src/components/procurement/ThreeWayMatchTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!inv.includes('hasPermission("procurement.invoice.create")')) {
  inv = inv.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();\n  const canCreateInvoice = hasPermission("procurement.invoice.create");\n  const canApproveInvoice = hasPermission("procurement.invoice.approve");`;
    }
  );
}
if (!inv.includes("if (!canCreateInvoice)")) {
  inv = inv.replace(/const handleCreateInvoice = async[^{]*\{/, (m) => m + `\n    if (!canCreateInvoice) { alert("Missing permission: procurement.invoice.create"); return; }`);
  inv = inv.replace(/const handleApproveInvoice = async[^{]*\{/, (m) => m + `\n    if (!canApproveInvoice) { alert("Missing permission: procurement.invoice.approve"); return; }`);
  inv = inv.replace(/const handleApprove = async[^{]*\{/, (m) => m + `\n    if (!canApproveInvoice) { alert("Missing permission: procurement.invoice.approve"); return; }`);
}
fs.writeFileSync("src/components/procurement/ThreeWayMatchTab.tsx", inv.replace(/\n/g, "\r\n"));
console.log("invoice gates");

// Payments
let pay = fs.readFileSync("src/components/procurement/PaymentsTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!pay.includes('hasPermission("procurement.payment.record")')) {
  pay = pay.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();\n  const canRecordPayment = hasPermission("procurement.payment.record");`;
    }
  );
}
if (!pay.includes("if (!canRecordPayment)")) {
  pay = pay.replace(/const handleRecordPayment = async[^{]*\{/, (m) => m + `\n    if (!canRecordPayment) { alert("Missing permission: procurement.payment.record"); return; }`);
  pay = pay.replace(/const handleSubmit = async[^{]*\{/, (m) => m + `\n    if (!canRecordPayment) { alert("Missing permission: procurement.payment.record"); return; }`);
}
fs.writeFileSync("src/components/procurement/PaymentsTab.tsx", pay.replace(/\n/g, "\r\n"));
console.log("payment gates");

// Vendors
let ven = fs.readFileSync("src/components/procurement/VendorsTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!ven.includes("useRole()")) {
  ven = ven.replace(
    /(export default function VendorsTab[^{]*\{)/,
    `$1\n  const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();`
  );
}
if (!ven.includes('hasPermission("procurement.vendor.manage")')) {
  ven = ven.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => {
      let i = inner;
      if (!i.includes("hasPermission")) i += ", hasPermission";
      return `const {${i}} = useRole();\n  const canManageVendor = hasPermission("procurement.vendor.manage");`;
    }
  );
}
if (!ven.includes("if (!canManageVendor)") && ven.includes("canManageVendor")) {
  ven = ven.replace(/const handleSave = async[^{]*\{/, (m) => m + `\n    if (!canManageVendor) { alert("Missing permission: procurement.vendor.manage"); return; }`);
  ven = ven.replace(/const handleCreate = async[^{]*\{/, (m) => m + `\n    if (!canManageVendor) { alert("Missing permission: procurement.vendor.manage"); return; }`);
  ven = ven.replace(/const handleSubmit = async[^{]*\{/, (m) => m + `\n    if (!canManageVendor) { alert("Missing permission: procurement.vendor.manage"); return; }`);
}
fs.writeFileSync("src/components/procurement/VendorsTab.tsx", ven.replace(/\n/g, "\r\n"));
console.log("vendor gates");

console.log("ALL button gates done");
