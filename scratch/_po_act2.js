const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\PurchaseOrdersTab.tsx","utf8");
// Find Action header
const ah=t.indexOf(">Action</th>");
console.log("Action th", ah);
console.log(t.slice(ah, ah+2500).slice(0,2000));
console.log("\n--- handleApprovePo ---");
const ha=t.indexOf("const handleApprovePo");
console.log(t.slice(ha, ha+500));
console.log("\n--- handleSendPo ---");
const hs=t.indexOf("const handleSendPo");
console.log(t.slice(hs, hs+400));
