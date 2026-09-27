const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx","utf8");
const createPo = t.indexOf("Create PO");
console.log(t.slice(createPo-800, createPo+400));
console.log("\n\n===== STATUS BADGE USAGE =====\n");
const sb = t.indexOf("ProcurementStatusBadge");
console.log(t.slice(sb, sb+300));
// find second usage
const sb2 = t.indexOf("ProcurementStatusBadge", sb+1);
console.log("second", sb2, t.slice(sb2, sb2+250));
// Look for old status styling remaining
console.log("\nold emerald status?", t.includes("bg-emerald-50 text-emerald-700 border-emerald-200"));
console.log("rounded-full text-[10px] font-bold border font-mono", t.includes('rounded-full text-[10px] font-bold border font-mono'));
