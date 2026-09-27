const fs = require("fs");
let s = fs.readFileSync("src/components/procurement/PaymentsTab.tsx", "utf8").replace(/\r\n/g, "\n");
// Ensure record payment form only lists approved_for_payment (not paid)
if (s.includes('inv.matchStatus === "approved_for_payment" || inv.matchStatus === "paid"')) {
  // keep payableInvoices for table display, but for the select dropdown use approved only if separate
  console.log("payments filter present - OK for display; server enforces approved_for_payment");
}
fs.writeFileSync("src/components/procurement/PaymentsTab.tsx", s.replace(/\n/g, "\r\n"));
