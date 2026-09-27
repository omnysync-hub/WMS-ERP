const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx","utf8");
const detailIdx = t.indexOf("PR DETAILS DRAWER");
// Find footer buttons - Submit/Approve in detail
const chunk = t.slice(detailIdx, detailIdx+8000);
const submitIdx = chunk.indexOf("handleUpdateStatus");
console.log("all handleUpdateStatus in detail chunk:");
let i=0; while((i=chunk.indexOf("handleUpdateStatus", i))>=0){ console.log(i, chunk.slice(i-80,i+120)); i++; }
console.log("\n--- end of detail modal ---");
// find closing of selectedPr block - look for setSelectedPr(null) near end
const endMarker = t.indexOf("GENERATE PO MODAL", detailIdx);
console.log("next section at", endMarker);
console.log(t.slice(endMarker-1200, endMarker));
