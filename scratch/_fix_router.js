const fs = require("fs");
const p = "D:/WMS-APP 1/workman-mobile/app/jobs/[id].tsx";
let s = fs.readFileSync(p, "utf8");
const a = 'router.push("/jobs/" + successor.id)';
const b = "router.push({ pathname: \"/jobs/[id]\", params: { id: successor.id } })";
if (!s.includes(a)) {
  // maybe already different quoting
  const idx = s.indexOf("successor.id");
  console.log("snippet", JSON.stringify(s.slice(idx - 40, idx + 40)));
} else {
  s = s.replace(a, b);
  fs.writeFileSync(p, s);
  console.log("replaced");
}