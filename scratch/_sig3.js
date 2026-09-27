const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");
t = t.replace(
  'reason?: string\r\n  ) => {\r\n    if (status === "submitted" && !canSubmitPr)',
  'reason?: string,\r\n    prOverride?: any\r\n  ) => {\r\n    if (status === "submitted" && !canSubmitPr)'
);
if (!t.includes("prOverride?: any")) {
  t = t.replace(
    'reason?: string\n  ) => {\n    if (status === "submitted" && !canSubmitPr)',
    'reason?: string,\n    prOverride?: any\n  ) => {\n    if (status === "submitted" && !canSubmitPr)'
  );
}
fs.writeFileSync(p, t);
console.log("fixed", t.includes("prOverride?: any"));
const start = t.indexOf("const handleUpdateStatus = async");
console.log(t.slice(start, start+220));
