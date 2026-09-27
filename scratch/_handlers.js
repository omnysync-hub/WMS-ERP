const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");

// Find handleUpdateStatus / updatePrStatus function name
const m = t.match(/const (handle\w+|update\w+)\s*=\s*async\s*\([^)]*status/);
console.log("handler match", m && m[0]);
const fnNames = [...t.matchAll(/const (\w+)\s*=\s*async/g)].map(x=>x[1]);
console.log("async fns", fnNames);

// Show submit/approve in detail panel
const detailIdx = t.indexOf("PR DETAILS DRAWER");
console.log(t.slice(detailIdx, detailIdx+2500).slice(0,2000));
