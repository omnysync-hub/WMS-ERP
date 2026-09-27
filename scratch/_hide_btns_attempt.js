const fs = require("fs");

// Remove unused ClipboardList from page if present
let page = fs.readFileSync("src/app/procurement/page.tsx", "utf8");
page = page.replace(/\s*ClipboardList,\s*\n/, "\n");
fs.writeFileSync("src/app/procurement/page.tsx", page);

function hideButtonByText(file, textsAndConds) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const [snippet, cond] of textsAndConds) {
    // Find button blocks containing the snippet - fragile; instead wrap nearby onClick buttons
  }
  return s;
}

// Approvals: wrap Approve buttons with canApprove*
let ap = fs.readFileSync("src/components/procurement/ProcurementApprovalsTab.tsx", "utf8").replace(/\r\n/g, "\n");
// Common pattern: buttons calling handleApprovePr( — prefix with conditional
ap = ap.replace(
  /\{!canApprovePr && false\}/g,
  ""
);
// Disable approve buttons via disabled prop injection on onClick={...handleApprovePr
ap = ap.replace(
  /onClick=\{\(\) => handleApprovePr\(([^)]+)\)\}/g,
  `onClick={() => handleApprovePr($1)} disabled={!canApprovePr} className={cn(undefined)}`
);
// That's messy. Better: wrap JSX. Find "Approve" button texts.
if (!ap.includes("/* P0-HIDE-APPROVE-PR */")) {
  ap = ap.replace(
    /(\{[^}]*prs\.filter[\s\S]*?\n)/,
    (m) => m
  );
}
// Simpler visual gate: add disabled={!canX} next to onClick for approve handlers
const clickDisablePairs = [
  [/onClick=\{\(\) => handleApprovePr\(([^)]*)\)\}/g, "canApprovePr"],
  [/onClick=\{\(\) => handleApprovePo\(([^)]*)\)\}/g, "canApprovePo"],
  [/onClick=\{\(\) => handleApproveBill\(([^)]*)\)\}/g, "canApproveInvoice"],
];
for (const [re, perm] of clickDisablePairs) {
  ap = ap.replace(re, (match, id) => {
    if (match.includes("disabled=")) return match;
    return `onClick={() => handleApprovePrPLACEHOLDER}`.replace(
      "handleApprovePrPLACEHOLDER",
      match.includes("handleApprovePr")
        ? `handleApprovePr(${id})}`
        : match.includes("handleApprovePo")
          ? `handleApprovePo(${id})}`
          : `handleApproveBill(${id})}`
    ).replace(
      /onClick=\{[^}]+\}/,
      (m) => `${m} disabled={!${perm}} style={{ opacity: !${perm} ? 0.4 : 1 }}`
    );
  });
}
// The above is too broken. Restore from backup for approvals UI and use cleaner approach.
