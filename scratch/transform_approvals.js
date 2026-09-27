const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/ProcurementApprovalsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Import SideDrawer
if (!content.includes('import SideDrawer from "@/components/ui/SideDrawer";')) {
  content = content.replace(
    'import { formatCurrency, formatDateTime } from "@/lib/utils";',
    'import { formatCurrency, formatDateTime } from "@/lib/utils";\nimport SideDrawer from "@/components/ui/SideDrawer";'
  );
}

// 2. inspectItem -> SideDrawer
const inspectStart = content.indexOf('{/* ========================================================================= */\n      /* INSPECT DETAIL MODAL                                                      */\n      /* ========================================================================= */');
const rejectStart = content.indexOf('{/* REJECT MODAL */}');

if (inspectStart !== -1 && rejectStart !== -1) {
  const newInspectDrawer = `{/* ========================================================================= */}
      {/* INSPECT DETAIL SIDEDRAWER                                                 */}
      {/* ========================================================================= */}
      <SideDrawer
        isOpen={!!inspectItem}
        onClose={() => setInspectItem(null)}
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Approval Inspection Console ·{" "}
              {inspectItem
                ? inspectItem.type === "pr"
                  ? inspectItem.data.prNumber
                  : inspectItem.type === "po"
                  ? inspectItem.data.poNumber
                  : inspectItem.data.invoiceNumber
                : ""}
            </span>
          </div>
        }
        subtitle="Review specification lines and financial compliance before executive approval"
        width="max-w-2xl"
        footer={
          inspectItem ? (
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
              >
                Close
              </button>

              {inspectItem.type === "pr" && (
                <button
                  type="button"
                  onClick={() => handleApprovePr(inspectItem.data.id)}
                  disabled={isSubmitting || !canApprovePr}
                  title={!canApprovePr ? "Missing permission" : undefined}
                  className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold shadow-2xs"
                >
                  Confirm PR Approval
                </button>
              )}

              {inspectItem.type === "po" && (
                <button
                  type="button"
                  onClick={() => handleApprovePo(inspectItem.data.id)}
                  disabled={isSubmitting || !canApprovePo}
                  title={!canApprovePo ? "Missing permission" : undefined}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs"
                >
                  Confirm PO Approval
                </button>
              )}

              {inspectItem.type === "bill" && (
                <button
                  type="button"
                  onClick={() => handleApproveBill(inspectItem.data.id)}
                  disabled={isSubmitting || !canApproveInvoice}
                  title={!canApproveInvoice ? "Missing permission" : undefined}
                  className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold shadow-2xs"
                >
                  Confirm Bill Approval
                </button>
              )}
            </div>
          ) : null
        }
      >
        {inspectItem && (
          <div className="space-y-4 text-xs pt-1 text-[#18181B]">
            {/* Items List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#18181B] block">
                Line Items ({inspectItem.data.items?.length || 0})
              </span>
              <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      {inspectItem.type !== "pr" && (
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      )}
                      {inspectItem.type !== "pr" && (
                        <th className="py-2.5 px-3 text-right">Total</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEDED]">
                    {inspectItem.data.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-semibold">{it.description}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {it.quantity || it.billedQuantity} {it.unit || "unit"}
                        </td>
                        {inspectItem.type !== "pr" && (
                          <td className="py-2 px-3 text-right font-mono text-[#71717A]">
                            {formatCurrency(it.unitCost || it.billedUnitPrice || 0)}
                          </td>
                        )}
                        {inspectItem.type !== "pr" && (
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(
                              (it.quantity || it.billedQuantity || 0) *
                                (it.unitCost || it.billedUnitPrice || 0)
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SideDrawer>

      `;

  content = content.substring(0, inspectStart) + newInspectDrawer + content.substring(rejectStart);
  console.log('Replaced inspectItem with SideDrawer in ProcurementApprovalsTab');
}

// 3. rejectItem -> SideDrawer
const rejectModalStart = content.indexOf('{/* REJECT MODAL */}');
if (rejectModalStart !== -1) {
  const newRejectDrawer = `{/* REJECT SIDEDRAWER */}
      <SideDrawer
        isOpen={!!rejectItem}
        onClose={() => setRejectItem(null)}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-bold text-sm">
              Reject {rejectItem?.refNumber}
            </span>
          </div>
        }
        subtitle="Provide formal reason for returning / rejecting this request"
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setRejectItem(null)}
              className="px-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRejection}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow"
            >
              Confirm Rejection
            </button>
          </div>
        }
      >
        {rejectItem && (
          <div className="space-y-3 pt-1 text-[#18181B]">
            <p className="text-[11px] text-[#71717A]">
              State formal reason for returning / rejecting this request:
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-rose-500 outline-none"
              placeholder="State reason (budget limitation, stock already present, incorrect specifications)..."
            />
          </div>
        )}
      </SideDrawer>
    </div>
  );
}`;

  content = content.substring(0, rejectModalStart) + newRejectDrawer;
  console.log('Replaced rejectItem with SideDrawer in ProcurementApprovalsTab');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming ProcurementApprovalsTab.tsx');
