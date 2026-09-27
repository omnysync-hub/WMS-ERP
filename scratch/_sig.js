const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");

// Fix signature to include prOverride
t = t.replace(
  `const handleUpdateStatus = async (
    status: "submitted" | "approved" | "rejected", // P0-BTN-CREATE-PR
    reason?: string
  ) => {`,
  `const handleUpdateStatus = async (
    status: "submitted" | "approved" | "rejected", // P0-BTN-CREATE-PR
    reason?: string,
    prOverride?: any
  ) => {`
);

// Also fix row action calls - they pass (status, undefined, pr) 
// Verify:
console.log("Submit call:", t.includes('handleUpdateStatus("submitted", undefined, pr)'));
console.log("Approve call:", t.includes('handleUpdateStatus("approved", undefined, pr)'));

fs.writeFileSync(p, t);
console.log("signature fixed", t.includes("prOverride?: any"));
