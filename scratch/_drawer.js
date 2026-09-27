const fs=require("fs");
const p="D:\\WORKMAN SERVICES\\src\\components\\procurement\\RequisitionsTab.tsx";
let t=fs.readFileSync(p,"utf8");

const marker = t.indexOf("PR DETAILS DRAWER");
const rejectModal = t.indexOf("{showRejectModal &&");
const blockStart = t.indexOf("{selectedPr && (", marker);
const oldBlock = t.slice(blockStart, rejectModal);

// Extract body: from metadata grid comment through rejection reason (exclude action bar)
const bodyInnerStart = oldBlock.indexOf("              {/* Metadata Grid */}");
const actionBarStart = oldBlock.indexOf("              {/* Approval / Workflow Action Bar */}");
if (bodyInnerStart < 0 || actionBarStart < 0) {
  console.error("Could not find body sections", bodyInnerStart, actionBarStart);
  process.exit(1);
}
const bodyInner = oldBlock.slice(bodyInnerStart, actionBarStart).trimEnd();

const newBlock = `{selectedPr && (
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
          subtitle={\`Raised by \${selectedPr.requestedBy} · \${formatDateTime(selectedPr.createdAt)}\`}
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
                  onClick={() => handleUpdateStatus("submitted")}
                  disabled={isSubmitting}
                  className={CTA_PRIMARY + " h-8"}
                >
                  <Send className="w-3.5 h-3.5" /> Submit
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
                    onClick={() => handleUpdateStatus("approved")}
                    disabled={isSubmitting}
                    className={CTA_PRIMARY + " h-8"}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                </>
              )}
              {selectedPr.status === "approved" && (
                <>
                  {onNavigateToRfq && (
                    <button
                      type="button"
                      onClick={() => {
                        const pr = selectedPr;
                        setSelectedPr(null);
                        onNavigateToRfq(pr);
                      }}
                      className="h-8 px-3 rounded-lg border border-[#EDEDED] text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Source via RFQ
                    </button>
                  )}
                  {canCreatePo && (
                    <button
                      type="button"
                      onClick={() => openPoGenerationModal([selectedPr])}
                      disabled={isSubmitting}
                      className={CTA_PRIMARY + " h-8"}
                    >
                      Convert to PO
                    </button>
                  )}
                </>
              )}
            </>
          }
        >
${bodyInner}
        </SideDrawer>
      )}

      `;

t = t.slice(0, blockStart) + newBlock + t.slice(rejectModal);

// Calm remaining loud status badges in this file (detail already uses StatusBadge)
t = t.replace(
  /selectedPr\.status === "approved"\s*\?\s*"bg-emerald-50 text-emerald-700 border-emerald-200"\s*:\s*selectedPr\.status === "rejected"\s*\?\s*"bg-rose-50 text-rose-700 border-rose-200"\s*:\s*"bg-amber-50 text-amber-700 border-amber-200"/g,
  '"bg-slate-100 text-slate-600 border-slate-200"'
);

fs.writeFileSync(p, t, "utf8");
console.log("SideDrawer conversion done");
console.log("has SideDrawer open", t.includes("<SideDrawer"));
console.log("querySelector left?", t.includes("document.querySelector"));
console.log("prOverride", t.includes("prOverride"));
