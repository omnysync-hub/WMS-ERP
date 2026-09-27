const fs = require("fs");
const path = "prisma/schema.prisma";
let buf = fs.readFileSync(path);
// strip UTF-8 BOM
if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
  buf = buf.slice(3);
  fs.writeFileSync(path, buf);
  console.log("BOM stripped from schema.prisma");
} else {
  console.log("No BOM found, first bytes:", buf.slice(0, 8));
}
