const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");

// Find action column / Eye in table body
const eyes = [];
let i=0; while ((i=t.indexOf("<Eye", i))>=0) { eyes.push(i); i++; }
console.log("Eye positions", eyes);

// Show around first Eye in table (likely row action)
if (eyes[0]) console.log("--- first eye ---\n", t.slice(eyes[0]-350, eyes[0]+200));

// Status in table
const st = t.indexOf("Status</th>");
console.log("Status th", st);
// find next status cell pattern
const afterThead = t.indexOf("</thead>", st);
const statusCell = t.indexOf("pr.status", afterThead);
console.log("first pr.status after thead", statusCell);
console.log(t.slice(statusCell-100, statusCell+450));

// Primary action?
console.log("has Submit button in row?", t.includes(">Submit</button>"));
console.log("has Approve in row?", t.includes(">Approve</button>"));
console.log("has Create PO", t.includes("Create PO"));
