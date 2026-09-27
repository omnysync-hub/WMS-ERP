const fs=require("fs");
const t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\components\\procurement\\PurchaseOrdersTab.tsx","utf8");
const thead=t.indexOf("<thead");
console.log(t.slice(thead, thead+1200));
// find handleApprovePo usage in JSX
let i=0, hits=[];
while((i=t.indexOf("handleApprovePo", i))>=0){hits.push(i);i++;}
console.log("approve usages", hits);
hits.forEach(h=>console.log("---", t.slice(h-100,h+150)));
