const fs = require("fs");

function fix(file, replacements) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const [needle, repl, label] of replacements) {
    if (typeof needle === "string") {
      if (!s.includes(needle)) {
        console.log("MISS", file, label || needle.slice(0, 40));
        continue;
      }
      if (s.includes(repl.slice(0, 60)) && repl.length > 20) {
        // may already have
      }
      s = s.replace(needle, repl);
      console.log("OK", file, label || "");
    } else {
      s = s.replace(needle, repl);
      console.log("OK-re", file, label || "");
    }
  }
  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
}

fix("src/components/procurement/ProcurementApprovalsTab.tsx", [
  [
    `const handleApprovePo = async (id: string) => {
`,
    `const handleApprovePo = async (id: string) => {
    if (!canApprovePo) { alert("Missing permission: procurement.po.approve"); return; }
`,
    "approvePo",
  ],
  [
    `const handleApproveBill = async (invoiceId: string) => {
`,
    `const handleApproveBill = async (invoiceId: string) => {
    if (!canApproveInvoice) { alert("Missing permission: procurement.invoice.approve"); return; }
`,
    "approveBill",
  ],
  [
    `const handleConfirmRejection = async () => {
`,
    `const handleConfirmRejection = async () => {
    if (!canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }
`,
    "reject",
  ],
]);

fix("src/components/procurement/PurchaseOrdersTab.tsx", [
  [
    `const handleCreatePo = async (e: React.FormEvent) => {
`,
    `const handleCreatePo = async (e: React.FormEvent) => {
    if (!canCreatePo) { alert("Missing permission: procurement.po.create"); return; }
`,
    "createPo",
  ],
  [
    `const handleApprovePo = async (id: string, notes?: string) => {
`,
    `const handleApprovePo = async (id: string, notes?: string) => {
    if (!canApprovePo) { alert("Missing permission: procurement.po.approve"); return; }
`,
    "approvePo",
  ],
]);

fix("src/components/procurement/RfqSourcingTab.tsx", [
  [
    `const handleAwardWinner = async (rfqId: string, vendorId: string) => {
`,
    `const handleAwardWinner = async (rfqId: string, vendorId: string) => {
    if (!canAwardRfq) { alert("Missing permission: procurement.rfq.award"); return; }
`,
    "award",
  ],
]);

fix("src/components/procurement/ThreeWayMatchTab.tsx", [
  [
    `const handleCreateInvoice = async (e: React.FormEvent) => {
`,
    `const handleCreateInvoice = async (e: React.FormEvent) => {
    if (!canCreateInvoice) { alert("Missing permission: procurement.invoice.create"); return; }
`,
    "createInv",
  ],
  [
    `const handleApproveInvoice = async (invoiceId: string) => {
`,
    `const handleApproveInvoice = async (invoiceId: string) => {
    if (!canApproveInvoice) { alert("Missing permission: procurement.invoice.approve"); return; }
`,
    "approveInv",
  ],
]);

fix("src/components/procurement/RequisitionsTab.tsx", [
  [
    `const handleGeneratePoSubmit = async (e: React.FormEvent) => {
`,
    `const handleGeneratePoSubmit = async (e: React.FormEvent) => {
    if (!canCreatePo) { alert("Missing permission: procurement.po.create"); return; }
`,
    "genPo",
  ],
  [
    `if ((status === "approved" || status === "rejected") && !canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }`,
    `if (status === "submitted" && !canSubmitPr) { alert("Missing permission: procurement.pr.submit"); return; }
    if ((status === "approved" || status === "rejected") && !canApprovePr) { alert("Missing permission: procurement.pr.approve"); return; }`,
    "submit gate",
  ],
]);

// Ensure canCreatePo / canApprovePo vars exist where needed
let po = fs.readFileSync("src/components/procurement/PurchaseOrdersTab.tsx", "utf8");
if (!po.includes("const canCreatePo")) {
  po = po.replace(
    'const canSendPo = hasPermission("procurement.po.send");',
    'const canCreatePo = hasPermission("procurement.po.create");\n  const canApprovePo = hasPermission("procurement.po.approve");\n  const canSendPo = hasPermission("procurement.po.send");'
  );
  fs.writeFileSync("src/components/procurement/PurchaseOrdersTab.tsx", po);
  console.log("added canCreatePo/canApprovePo vars");
}

let req = fs.readFileSync("src/components/procurement/RequisitionsTab.tsx", "utf8");
if (!req.includes("const canCreatePo")) {
  req = req.replace(
    'const canApprovePr = hasPermission("procurement.pr.approve");',
    'const canApprovePr = hasPermission("procurement.pr.approve");\n  const canCreatePo = hasPermission("procurement.po.create");'
  );
  fs.writeFileSync("src/components/procurement/RequisitionsTab.tsx", req);
}
if (!req.includes("const canSubmitPr")) {
  req = fs.readFileSync("src/components/procurement/RequisitionsTab.tsx", "utf8");
  req = req.replace(
    'const canCreatePr = hasPermission("procurement.pr.create");',
    'const canCreatePr = hasPermission("procurement.pr.create");\n  const canSubmitPr = hasPermission("procurement.pr.submit");'
  );
  fs.writeFileSync("src/components/procurement/RequisitionsTab.tsx", req);
}

let inv = fs.readFileSync("src/components/procurement/ThreeWayMatchTab.tsx", "utf8");
if (!inv.includes("const canCreateInvoice")) {
  inv = inv.replace(
    /const \{([^}]+)\} = useRole\(\);/,
    (m, inner) => `const {${inner}} = useRole();\n  const canCreateInvoice = hasPermission("procurement.invoice.create");\n  const canApproveInvoice = hasPermission("procurement.invoice.approve");`
  );
  fs.writeFileSync("src/components/procurement/ThreeWayMatchTab.tsx", inv);
  console.log("added invoice perm vars");
}

let ap = fs.readFileSync("src/components/procurement/ProcurementApprovalsTab.tsx", "utf8");
if (!ap.includes("const canApprovePo")) {
  ap = ap.replace(
    'const canApprovePr = hasPermission("procurement.pr.approve");',
    'const canApprovePr = hasPermission("procurement.pr.approve");\n  const canApprovePo = hasPermission("procurement.po.approve");\n  const canApproveInvoice = hasPermission("procurement.invoice.approve");'
  );
  fs.writeFileSync("src/components/procurement/ProcurementApprovalsTab.tsx", ap);
}

console.log("fixes done");
