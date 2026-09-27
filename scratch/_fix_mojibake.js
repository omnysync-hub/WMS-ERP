const fs = require("fs");
const path = "src/lib/services/ProcurementService.ts";
let s = fs.readFileSync(path, "utf8");
s = s.replace(/GRN GL posting failed .{1,3} operation rolled back:/g, "GRN GL posting failed - operation rolled back:");
// also fix any other mojibake dashes in our new strings
s = s.replace(/Invoice approval aborted: GL posting failed/g, "Invoice approval aborted: GL posting failed");
fs.writeFileSync(path, s);
console.log("fixed mojibake");
