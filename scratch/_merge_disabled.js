const fs = require("fs");

function mergeDisabled(file) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

  // Pattern A: onClick=... disabled={!canX} title=... \n disabled={isSubmitting}
  s = s.replace(
    /onClick=\{(\(\) => [^}]+)\} disabled=\{!(\w+)\} title=\{!\2 \? "Missing permission" : undefined\}\n(\s*)disabled=\{isSubmitting\}/g,
    (m, onclick, perm, indent) =>
      `onClick={${onclick}}\n${indent}disabled={isSubmitting || !${perm}}\n${indent}title={!${perm} ? "Missing permission" : undefined}`
  );

  // Pattern B: duplicate disabled={!canAwardRfq} disabled={!canAwardRfq}\n disabled={isSubmitting}
  s = s.replace(
    /onClick=\{(\(\) => [^}]+)\} disabled=\{!(\w+)\}(?: disabled=\{!\2\})?\n(\s*)disabled=\{isSubmitting\}/g,
    (m, onclick, perm, indent) =>
      `onClick={${onclick}}\n${indent}disabled={isSubmitting || !${perm}}\n${indent}title={!${perm} ? "Missing permission" : undefined}`
  );

  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
  console.log("merged", file);
}

for (const f of [
  "src/components/procurement/ProcurementApprovalsTab.tsx",
  "src/components/procurement/PurchaseOrdersTab.tsx",
  "src/components/procurement/RfqSourcingTab.tsx",
  "src/components/procurement/ThreeWayMatchTab.tsx",
]) {
  mergeDisabled(f);
}
