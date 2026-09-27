const fs = require("fs");
const path = "src/lib/services/ProcurementService.ts";
let s = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const needle = `    const grnItemsData = [];
    let totalAcceptedValue = 0;

    for (const item of data.items) {`;

const repl = `    // Pre-validate all lines for over-receive before any mutations
    for (const item of data.items) {
      const poItem = po.items.find((pi) => pi.id === item.poItemId);
      if (!poItem) continue;
      const qtyRec = Number(item.quantityReceived) || 0;
      const alreadyReceived = Number(poItem.quantityReceived) || 0;
      const ordered = Number(poItem.quantity) || 0;
      const remaining = Math.max(0, ordered - alreadyReceived);
      if (qtyRec > remaining + 1e-9) {
        throw new Error(
          \`Cannot over-receive for PO line "\${poItem.description || poItem.itemCode || poItem.id}": received \${qtyRec} but only \${remaining} remaining of \${ordered} ordered\`
        );
      }
    }

    const grnItemsData = [];
    let totalAcceptedValue = 0;

    for (const item of data.items) {`;

if (!s.includes(needle)) throw new Error("prevalidate insert point missing");
if (!s.includes("Pre-validate all lines for over-receive")) {
  s = s.replace(needle, repl);
}
fs.writeFileSync(path, s.replace(/\n/g, "\r\n"));
console.log("pre-validate OK");
