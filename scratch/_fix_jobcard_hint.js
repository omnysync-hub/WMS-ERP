const fs = require("fs");
const p = "D:/WMS-APP 1/workman-mobile/components/job/JobCard.tsx";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("TechnicianReassigned")) {
  s = s.replace(
    'if (s === "Cancelled") return "Cancelled";',
    'if (s === "Cancelled") return "Cancelled";\n  if (s === "TechnicianReassigned") return "Reassigned - open successor";'
  );
  fs.writeFileSync(p, s);
  console.log("hint added");
} else console.log("hint exists");