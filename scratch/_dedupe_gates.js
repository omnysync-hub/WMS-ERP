const fs = require("fs");

// Deduplicate consecutive identical if (!can...) lines
for (const file of [
  "src/components/procurement/ThreeWayMatchTab.tsx",
  "src/components/procurement/ProcurementApprovalsTab.tsx",
  "src/components/procurement/PurchaseOrdersTab.tsx",
  "src/components/procurement/RequisitionsTab.tsx",
  "src/components/procurement/RfqSourcingTab.tsx",
  "src/components/procurement/GoodsReceiptTab.tsx",
  "src/components/procurement/PaymentsTab.tsx",
  "src/components/procurement/VendorsTab.tsx",
]) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  // Remove duplicate consecutive identical lines
  const lines = s.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && lines[i] === lines[i - 1] && lines[i].includes("if (!can")) continue;
    out.push(lines[i]);
  }
  s = out.join("\n");
  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
}

// Fix RFQ award button - find onClick with handleAwardWinner
let rfq = fs.readFileSync("src/components/procurement/RfqSourcingTab.tsx", "utf8").replace(/\r\n/g, "\n");
if (!rfq.includes("disabled={!canAwardRfq}")) {
  rfq = rfq.replace(
    /onClick=\{\(\) =>\s*\n?\s*handleAwardWinner\(([^)]+)\)\s*\n?\s*\}/g,
    `onClick={() => handleAwardWinner($1)} disabled={!canAwardRfq}`
  );
  // also single-line
  rfq = rfq.replace(
    /handleAwardWinner\(rfq\.id, rv\.vendorId\)/,
    `handleAwardWinner(rfq.id, rv.vendorId)`
  );
  // Find the button around Award and add disabled to the button tag
  rfq = rfq.replace(
    /(onClick=\{\(\) =>\s*handleAwardWinner\(rfq\.id, rv\.vendorId\)\s*\})/,
    `$1 disabled={!canAwardRfq}`
  );
}
// Create modal opener
if (!rfq.includes("disabled={!canManageRfq}")) {
  rfq = rfq.replace(
    /onClick=\{\(\) => setShowCreateModal\(true\)\}/g,
    `onClick={() => setShowCreateModal(true)} disabled={!canManageRfq}`
  );
}
fs.writeFileSync("src/components/procurement/RfqSourcingTab.tsx", rfq.replace(/\n/g, "\r\n"));

// Requisitions create button
let req = fs.readFileSync("src/components/procurement/RequisitionsTab.tsx", "utf8").replace(/\r\n/g, "\n");
req = req.replace(
  /onClick=\{\(\) => setShowCreateModal\(true\)\}/g,
  `onClick={() => setShowCreateModal(true)} disabled={!canCreatePr}`
);
fs.writeFileSync("src/components/procurement/RequisitionsTab.tsx", req.replace(/\n/g, "\r\n"));

console.log("cleanup done");
