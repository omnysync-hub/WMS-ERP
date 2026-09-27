const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx","utf8");
const marker = t.indexOf("PR DETAILS DRAWER");
const rejectModal = t.indexOf("{showRejectModal &&");
const blockStart = t.indexOf("{selectedPr && (", marker);
const oldBlock = t.slice(blockStart, rejectModal);
console.log("oldBlock length", oldBlock.length);
// print structure - find all className with flex justify
const lines = oldBlock.split("\n");
lines.forEach((l,i)=>{
  if (/flex|footer|handleUpdateStatus|Reject|Approve|Submit|Close|max-h|p-6/.test(l)) {
    console.log(String(i).padStart(4)+":"+l);
  }
});
console.log("\n--- last 80 lines ---");
console.log(lines.slice(-80).join("\n"));
