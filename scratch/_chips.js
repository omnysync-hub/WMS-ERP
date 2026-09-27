const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\app\\procurement\\page.tsx";
let t=fs.readFileSync(p,"utf8");

// Fix storekeeper My PRs chip - no narrow filter
t = t.replace(
  '{ key: "my-prs", label: "My PRs", value: myPrs.length, tab: "prs", filter: "draft", hint: "Draft & open" },',
  '{ key: "my-prs", label: "My PRs", value: myPrs.length, tab: "prs", hint: "Draft & open" },'
);

// Fix purchasing draft/sent - no single status filter
t = t.replace(
  '{ key: "pos", label: "Draft / Sent POs", value: draftSentPos.length, tab: "pos", filter: "draft" },',
  '{ key: "pos", label: "Draft / Sent POs", value: draftSentPos.length, tab: "pos" },'
);

// Remove unused imports from page if present
for (const unused of ["AlertTriangle", "CheckCircle2"]) {
  const re = new RegExp("\\s*"+unused+",\\r?\\n", "g");
  if (t.includes(unused) && (t.match(new RegExp(unused, "g"))||[]).length === 1) {
    t = t.replace(re, "\n");
    console.log("removed unused", unused);
  }
}

fs.writeFileSync(p, t);
console.log("chips fixed");
