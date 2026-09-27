const fs = require("fs");
const files = [
  "src/lib/auth/erpActor.ts",
  "src/lib/procurementClient.ts",
  "src/lib/permissions.ts",
  "src/contexts/RoleContext.tsx",
  "src/app/api/procurement/route.ts",
  "src/app/procurement/page.tsx",
  "src/lib/services/ProcurementService.ts",
  "src/components/layout/Sidebar.tsx",
  "src/components/procurement/ProcurementProcessPipeline.tsx",
  "src/components/procurement/ProcurementApprovalsTab.tsx",
  "src/components/procurement/RequisitionsTab.tsx",
  "src/components/procurement/RfqSourcingTab.tsx",
  "src/components/procurement/PurchaseOrdersTab.tsx",
  "src/components/procurement/GoodsReceiptTab.tsx",
  "src/components/procurement/ThreeWayMatchTab.tsx",
  "src/components/procurement/PaymentsTab.tsx",
  "src/components/procurement/VendorsTab.tsx",
];
for (const f of files) {
  let buf = fs.readFileSync(f);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(f, buf.slice(3));
    console.log("stripped BOM", f);
  }
}

// Remove unused import in route if resolveErpActorFromRequest unused
let route = fs.readFileSync("src/app/api/procurement/route.ts", "utf8");
if (!route.includes("resolveErpActorFromRequest(") && route.includes("resolveErpActorFromRequest,")) {
  route = route.replace("resolveErpActorFromRequest,\n  roleHasPermission,", "roleHasPermission,");
  fs.writeFileSync("src/app/api/procurement/route.ts", route);
  console.log("removed unused import");
}
console.log("bom pass done");
