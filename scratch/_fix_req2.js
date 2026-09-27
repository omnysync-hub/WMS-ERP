const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");

// 1) Patch handleUpdateStatus to accept optional prOverride
t = t.replace(
  /const handleUpdateStatus = async \(\s*status: "submitted" \| "approved" \| "rejected", \/\/ P0-BTN-CREATE-PR\s*reason\?: string\s*\) => \{[\s\S]*?if \(!selectedPr\) return;/,
  (m) => {
    if (m.includes("prOverride")) return m;
    return m
      .replace(
        `status: "submitted" | "approved" | "rejected", // P0-BTN-CREATE-PR
    reason?: string
  ) => {`,
        `status: "submitted" | "approved" | "rejected", // P0-BTN-CREATE-PR
    reason?: string,
    prOverride?: any
  ) => {`
      )
      .replace("if (!selectedPr) return;", "const targetPr = prOverride || selectedPr;\n    if (!targetPr) return;");
  }
);

// Replace selectedPr.id with targetPr.id inside handleUpdateStatus only (careful)
// Find the function body
{
  const start = t.indexOf("const handleUpdateStatus = async");
  const end = t.indexOf("const handleGeneratePoSubmit", start);
  if (start > 0 && end > start) {
    let body = t.slice(start, end);
    body = body.replace(/id: selectedPr\.id/g, "id: targetPr.id");
    // keep setSelectedPr(null) etc.
    t = t.slice(0, start) + body + t.slice(end);
    console.log("handleUpdateStatus patched for prOverride");
  }
}

// 2) Fix row primary actions to call handler directly
t = t.replace(
  /\{pr\.status === "draft" && canSubmitPr && \(\s*<button[\s\S]*?>\s*Submit\s*<\/button>\s*\)\}/,
  `{pr.status === "draft" && canSubmitPr && (
                            <button
                              type="button"
                              className={CTA_PRIMARY}
                              disabled={isSubmitting}
                              onClick={() => handleUpdateStatus("submitted", undefined, pr)}
                            >
                              Submit
                            </button>
                          )}`
);

t = t.replace(
  /\{pr\.status === "submitted" && canApprovePr && \(\s*<button[\s\S]*?>\s*Approve\s*<\/button>\s*\)\}/,
  `{pr.status === "submitted" && canApprovePr && (
                            <button
                              type="button"
                              className={CTA_PRIMARY}
                              disabled={isSubmitting}
                              onClick={() => handleUpdateStatus("approved", undefined, pr)}
                            >
                              Approve
                            </button>
                          )}`
);

// 3) Convert PR details modal to SideDrawer
const modalStart = t.indexOf("{selectedPr && (");
const modalMarker = t.indexOf("PR DETAILS DRAWER");
console.log("modalStart", modalStart, "marker", modalMarker);

// Find the block from {selectedPr && ( through its matching close before reject modal
const rejectModal = t.indexOf("{showRejectModal &&");
if (modalMarker > 0 && rejectModal > modalMarker) {
  // Find start of {selectedPr && ( after the comment
  const blockStart = t.indexOf("{selectedPr && (", modalMarker);
  // Extract inner content between the modal shell - we'll rebuild with SideDrawer
  
  // Get footer actions from existing - search for draft && handleUpdateStatus submitted in detail
  const oldBlock = t.slice(blockStart, rejectModal);
  
  // Extract the body content (metadata grid through notes) - between p-6 space-y-4 and the footer buttons
  const bodyStart = oldBlock.indexOf('<div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">');
  const footerStart = oldBlock.indexOf('<div className="flex items-center justify-end gap-2 px-6 py-4');
  // maybe different footer pattern
  console.log("bodyStart", bodyStart, "footer flex", footerStart);
  console.log("draft button in old", oldBlock.indexOf('handleUpdateStatus("submitted")'));
  
  // Simpler: wrap existing modal content structure into SideDrawer by replacing outer chrome only
  const newDrawer = `{selectedPr && (
        <SideDrawer
          isOpen={!!selectedPr}
          onClose={() => setSelectedPr(null)}
          title={
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-800">
                {selectedPr.prNumber}
              </span>
              <ProcurementStatusBadge status={selectedPr.status} />
            </div>
          }
          subtitle={\`Raised by \${selectedPr.requestedBy} on \${formatDateTime(selectedPr.createdAt)}\`}
          width="max-w-xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setSelectedPr(null)}
                className="h-8 px-3 rounded-lg border border-[#EDEDED] text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              {selectedPr.status === "draft" && canSubmitPr && (
                <button
                  type="button"
                  data-pr-action="submit"
                  onClick={() => handleUpdateStatus("submitted")}
                  disabled={isSubmitting}
                  className={CTA_PRIMARY + " h-8"}
                >
                  Submit
                </button>
              )}
              {selectedPr.status === "submitted" && canApprovePr && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={isSubmitting}
                    className="h-8 px-3 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    data-pr-action="approve"
                    onClick={() => handleUpdateStatus("approved")}
                    disabled={isSubmitting}
                    className={CTA_PRIMARY + " h-8"}
                  >
                    Approve
                  </button>
                </>
              )}
              {selectedPr.status === "approved" && canCreatePo && (
                <button
                  type="button"
                  onClick={() => openPoGenerationModal([selectedPr])}
                  className={CTA_PRIMARY + " h-8"}
                >
                  Create PO
                </button>
              )}
            </>
          }
        >
`;

  // Find body inner HTML - from metadata grid to before footer buttons of modal
  // Look for pattern after header close
  const innerBodyMatch = oldBlock.match(/<div className="p-6 space-y-4 max-h-\[75vh\] overflow-y-auto">([\s\S]*?)<\/div>\s*<div className="flex items-center/);
  if (!innerBodyMatch) {
    // try alternate footer
    const alt = oldBlock.match(/<div className="p-6 space-y-4 max-h-\[75vh\] overflow-y-auto">([\s\S]*)/);
    console.log("alt body?", !!alt, "oldBlock len", oldBlock.length);
    // Find last flex justify-end in oldBlock that's the footer
    const lastFooter = oldBlock.lastIndexOf('className="px-6 py-4');
    console.log("last px-6 py-4", lastFooter);
    const lastFlex = oldBlock.lastIndexOf("flex items-center justify-end");
    console.log("last flex end", lastFlex, oldBlock.slice(lastFlex, lastFlex+200));
  } else {
    console.log("got inner body len", innerBodyMatch[1].length);
  }
}

fs.writeFileSync(p, t, "utf8");
console.log("phase A saved");
