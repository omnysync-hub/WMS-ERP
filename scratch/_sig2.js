const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");
const start = t.indexOf("const handleUpdateStatus = async");
console.log(JSON.stringify(t.slice(start, start+280)));
