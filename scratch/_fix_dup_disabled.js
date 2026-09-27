const fs = require("fs");

function fixDupDisabled(file) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  // Pattern: onClick={...} disabled={!canX} title={...} ... disabled={something}
  // Or disabled exists before our injection

  // Remove our injected disabled+title when another disabled= exists on same opening tag
  // Strategy: for each button/opening tag that contains two disabled=, merge

  // Simpler: remove ` disabled={!can...} title={!can... ? "Missing permission" : undefined}` 
  // when the same tag already has disabled=
  s = s.replace(/<([a-zA-Z]+)([^>]*?)>/g, (full, tag, attrs) => {
    const disabledMatches = attrs.match(/disabled=\{[^}]+\}/g) || [];
    if (disabledMatches.length <= 1) return full;

    // Keep first disabled, drop subsequent disabled and our title injection if present
    let seen = false;
    let newAttrs = attrs.replace(/\s*disabled=\{[^}]+\}/g, (d) => {
      if (!seen) {
        seen = true;
        return d;
      }
      return "";
    });
    // Also if we have title={!can... Missing permission} and another title, drop ours
    const titleMatches = newAttrs.match(/\s*title=\{[^}]*Missing permission[^}]*\}/g) || [];
    if ((newAttrs.match(/\s*title=\{/g) || []).length > 1) {
      newAttrs = newAttrs.replace(/\s*title=\{![^}]*Missing permission[^}]*\}/g, "");
    }
    return `<${tag}${newAttrs}>`;
  });

  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
  console.log("fixed", file);
}

for (const f of [
  "src/components/procurement/ProcurementApprovalsTab.tsx",
  "src/components/procurement/PurchaseOrdersTab.tsx",
  "src/components/procurement/RfqSourcingTab.tsx",
  "src/components/procurement/ThreeWayMatchTab.tsx",
]) {
  fixDupDisabled(f);
}
