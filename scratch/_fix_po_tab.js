const fs = require("fs");
let s = fs.readFileSync("src/app/procurement/page.tsx", "utf8");
s = s.replace(
  'pos: ["procurement.po.create", "procurement.po.approve", "procurement.po.send", "procurement.grn.create", "procurement.costs.view"],',
  'pos: ["procurement.po.create", "procurement.po.approve", "procurement.po.send", "procurement.costs.view"],'
);
// Also tighten GET view=pos in route - already gated by any-of including grn.create; update route VIEW_PERMISSION
fs.writeFileSync("src/app/procurement/page.tsx", s);

let route = fs.readFileSync("src/app/api/procurement/route.ts", "utf8");
route = route.replace(
  'pos: ["procurement.po.create", "procurement.po.approve", "procurement.po.send", "procurement.grn.create", "procurement.view_pr"],',
  'pos: ["procurement.po.create", "procurement.po.approve", "procurement.po.send", "procurement.costs.view", "procurement.view_pr"],'
);
// Storekeeper has view_pr so would still see pos via API if they call view=pos - costs masked via costs.view=false. Tab hidden in UI is enough.
fs.writeFileSync("src/app/api/procurement/route.ts", route);
console.log("storekeeper PO tab tightened");
