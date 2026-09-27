const fs=require("fs");
const path=require("path");
const root="D:\\WORKMAN SERVICES\\src\\components\\procurement";

// ---- PO primary actions ----
{
  let t=fs.readFileSync(path.join(root,"PurchaseOrdersTab.tsx"),"utf8");
  // Find Eye in table row actions
  const eyes=[]; let i=0; while((i=t.indexOf("<Eye",i))>=0){eyes.push(i);i++;}
  console.log("PO Eye count", eyes.length);
  if (eyes[0]) console.log(t.slice(eyes[0]-400, eyes[0]+180));

  // Find status badge styling for PO
  const st = t.indexOf("po.status === ");
  console.log("po.status sample", t.slice(st-80, st+350));

  // Find approve/send handlers
  const handlers=[...t.matchAll(/const (handle\w+)\s*=/g)].map(x=>x[1]);
  console.log("handlers", handlers);
}
