const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx","utf8");
const lines=t.split(/\n/);
lines.slice(0,55).forEach((l,i)=>console.log(String(i+1).padStart(3)+":"+l));
console.log("--- has procurementUi", t.includes("procurementUi"));
console.log("--- has queueFilter", t.includes("queueFilter"));
console.log("--- has SideDrawer", t.includes("SideDrawer"));
console.log("--- has CTA_PRIMARY", t.includes("CTA_PRIMARY"));
console.log("--- has ProcurementEmptyState", t.includes("ProcurementEmptyState"));
console.log("--- has ProcurementStatusBadge", t.includes("ProcurementStatusBadge"));
const idx=t.indexOf("pr.status === ");
console.log("status idx", idx);
if(idx>0) console.log(t.slice(idx-120, idx+500));
const act=t.indexOf("CTA_PRIMARY");
console.log("action sample around", act);
if(act>0) console.log(t.slice(act-200, act+600));
// canCreatePr?
console.log("canCreatePr", t.includes("canCreatePr"));
console.log("canSubmitPr", t.includes("canSubmitPr"));
