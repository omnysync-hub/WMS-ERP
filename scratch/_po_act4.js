const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\PurchaseOrdersTab.tsx","utf8");
const th=t.indexOf(">Actions</th>");
// find first Actions cell after tbody map - search for text-right after status badge
const statusBadgeEnd = t.indexOf("po.status.replace", th);
console.log("status replace", statusBadgeEnd);
console.log(t.slice(statusBadgeEnd, statusBadgeEnd+1200));
