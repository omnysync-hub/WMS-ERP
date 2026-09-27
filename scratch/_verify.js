const fs=require("fs");
const path=require("path");

// Verify page templates
const page=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\app\\procurement\\page.tsx","utf8");
console.log("page has ${ templates", (page.match(/\$\{/g)||[]).length);
console.log("page has escaped backticks?", page.includes("\\`"));
console.log("page title Procurement?", page.includes('title="Procurement"'));
console.log("no GL badge?", !page.includes("Double-Entry GL") || page.includes("title="));
console.log("GL in footer tooltip?", page.includes("GL postings apply"));
console.log("role chips?", page.includes("roleChips"));
console.log("admin overview?", page.includes('activeRole === "admin"'));

// Verify Requisitions compiles structurally - SideDrawer close
const req=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx","utf8");
console.log("SideDrawer opens", (req.match(/<SideDrawer/g)||[]).length);
console.log("SideDrawer closes", (req.match(/<\/SideDrawer>/g)||[]).length);
console.log("procurementUi import", req.includes("procurementUi"));
console.log("CTA_PRIMARY used", (req.match(/CTA_PRIMARY/g)||[]).length);

// Pipeline slim?
const pipe=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\ProcurementProcessPipeline.tsx","utf8");
console.log("no Lifecycle State Machine?", !pipe.includes("Lifecycle State Machine"));
console.log("slim nav?", pipe.includes('aria-label="Procurement lifecycle"'));

// Light polish RFQ empty + sticky
const rfqPath="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RfqSourcingTab.tsx";
let rfq=fs.readFileSync(rfqPath,"utf8");
if (!rfq.includes("sticky top-0") && rfq.includes("<thead>")) {
  rfq=rfq.replace(/<thead>\r?\n(\s*)<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/,
    '<thead className="sticky top-0 z-10">\n$1<tr className="border-b border-[#EDEDED] bg-[#F8FAFC]');
  rfq=rfq.replace(/table className="w-full text-left border-collapse text-xs"/g,
    'table className="w-full text-left border-collapse text-sm"');
  fs.writeFileSync(rfqPath, rfq);
  console.log("RFQ denser/sticky");
}

const vendPath="D:\\WORKMAN SERVICES\\src\\components\\procurement\\VendorsTab.tsx";
let vend=fs.readFileSync(vendPath,"utf8");
if (!vend.includes("sticky top-0") && vend.includes("<thead>")) {
  vend=vend.replace(/<thead>\r?\n(\s*)<tr className="border-b border-\[#EDEDED\] bg-\[#F8FAFC\]/,
    '<thead className="sticky top-0 z-10">\n$1<tr className="border-b border-[#EDEDED] bg-[#F8FAFC]');
  vend=vend.replace(/table className="w-full text-left border-collapse text-xs"/g,
    'table className="w-full text-left border-collapse text-sm"');
  fs.writeFileSync(vendPath, vend);
  console.log("Vendors denser/sticky");
}

// Remove unused CTA_GHOST imports if unused to keep clean - optional
for (const f of ["ThreeWayMatchTab.tsx","PaymentsTab.tsx","GoodsReceiptTab.tsx","ProcurementApprovalsTab.tsx","PurchaseOrdersTab.tsx"]) {
  let t=fs.readFileSync(path.join("D:\\WORKMAN SERVICES\\src\\components\\procurement", f),"utf8");
  const usesGhost=(t.match(/CTA_GHOST/g)||[]).length;
  const usesPrimary=(t.match(/CTA_PRIMARY/g)||[]).length;
  const usesBadge=(t.match(/ProcurementStatusBadge/g)||[]).length;
  const usesEmpty=(t.match(/ProcurementEmptyState/g)||[]).length;
  console.log(f, {usesGhost, usesPrimary, usesBadge, usesEmpty});
}
