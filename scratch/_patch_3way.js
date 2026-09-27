const fs = require("fs");
const path = "src/components/procurement/ThreeWayMatchTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

if (!s.includes('SideDrawer')) {
  s = s.replace(
    'import {\n  ProcurementStatusBadge,\n  ProcurementEmptyState,\n} from "@/components/procurement/procurementUi";',
    'import {\n  ProcurementStatusBadge,\n  ProcurementEmptyState,\n} from "@/components/procurement/procurementUi";\nimport SideDrawer from "@/components/ui/SideDrawer";'
  );
  console.log("SideDrawer import");
}

// Helper for match label near component start after hooks - inject function before return of main UI
if (!s.includes("function matchStatusTone")) {
  // add near imports area as local helper before component - actually inside file after imports
  s = s.replace(
    'export default function ThreeWayMatchTab({',
    `function matchStatusLabel(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "matched") return { label: "Matched ✓", hint: "PO · GRN · Invoice quantities & prices align" };
  if (s === "discrepancy") return { label: "Discrepancy", hint: "Variance detected — review before approval" };
  if (s === "approved_for_payment") return { label: "Approved for payment", hint: "Cleared 3-way match" };
  if (s === "paid") return { label: "Paid", hint: "Settled" };
  return { label: "Pending match", hint: "Awaiting PO/GRN reconciliation" };
}

export default function ThreeWayMatchTab({`
  );
  console.log("matchStatusLabel added");
}

// When activeInvoice is set, also render SideDrawer - find where activeInvoice modal ends or starts
if (!s.includes("Invoice detail") && s.includes("activeInvoice")) {
  // Convert click to open drawer - find setActiveInvoice usage in list
  // Append SideDrawer before the final closing of the outermost return's last modal
  // Insert before last `</div>\n  );\n}` of component - find `activeInvoice &&` block
  
  const drawer = `
      {/* Invoice detail SideDrawer */}
      <SideDrawer
        isOpen={Boolean(activeInvoice)}
        onClose={() => setActiveInvoice(null)}
        title={activeInvoice ? \`Invoice \${activeInvoice.invoiceNumber}\` : "Invoice"}
        subtitle={
          activeInvoice
            ? \`\${activeInvoice.vendor?.name || "Vendor"} · \${matchStatusLabel(activeInvoice.matchStatus).label}\`
            : undefined
        }
        width="max-w-xl"
        footer={
          activeInvoice ? (
            <>
              <button
                type="button"
                onClick={() => setActiveInvoice(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A]"
              >
                Close
              </button>
              {activeInvoice.matchStatus === "approved_for_payment" && onNavigateToPayment && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToPayment(activeInvoice);
                    setActiveInvoice(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] text-white text-xs font-bold"
                >
                  Record payment
                </button>
              )}
            </>
          ) : null
        }
      >
        {activeInvoice && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl border border-[#EDEDED] bg-[#F8FAFC] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#18181B]">3-way match status</span>
                <ProcurementStatusBadge status={activeInvoice.matchStatus || "pending_match"} />
              </div>
              <p className="text-[11px] text-[#71717A]">
                {matchStatusLabel(activeInvoice.matchStatus).hint}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-white border border-[#EDEDED]">
                  <div className="text-[10px] text-[#71717A] uppercase font-mono">Price variance</div>
                  <div className="font-mono font-bold text-[#18181B]">
                    {formatCurrency(activeInvoice.priceVariance || 0)}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[#EDEDED]">
                  <div className="text-[10px] text-[#71717A] uppercase font-mono">Qty variance</div>
                  <div className="font-mono font-bold text-[#18181B]">
                    {activeInvoice.quantityVariance || 0}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-mono text-[#71717A]">Links</div>
              <div className="text-[#18181B]">
                PO: <span className="font-mono font-semibold">{activeInvoice.po?.poNumber || activeInvoice.poId || "—"}</span>
              </div>
              <div className="text-[#18181B]">
                GRN: <span className="font-mono font-semibold">{activeInvoice.grn?.grnNumber || "—"}</span>
              </div>
              <div className="text-[#18181B]">
                Total: <span className="font-mono font-bold text-emerald-700">{formatCurrency(activeInvoice.totalAmount || 0)}</span>
              </div>
            </div>
            {(activeInvoice.items || []).length > 0 && (
              <div className="border border-[#EDEDED] rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-2">Description</th>
                      <th className="py-2 px-2 text-right">Billed qty</th>
                      <th className="py-2 px-2 text-right">Price</th>
                      <th className="py-2 px-2 text-right">Var</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEDED]">
                    {activeInvoice.items.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-1.5 px-2">{it.description}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{it.billedQuantity}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(it.billedUnitPrice)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(it.variance || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeInvoice.matchNotes && (
              <p className="text-[11px] text-[#71717A] italic">Notes: {activeInvoice.matchNotes}</p>
            )}
          </div>
        )}
      </SideDrawer>
`;
  // Insert before final return close - find last occurrence of showCreateModal false area end
  // Insert just before the last `</div>\n  );` of the component
  const lastReturnClose = s.lastIndexOf("  );\n}");
  if (lastReturnClose > 0) {
    // find the closing </div> before );
    const insertAt = s.lastIndexOf("</div>", lastReturnClose);
    if (insertAt > 0) {
      s = s.slice(0, insertAt) + drawer + "\n    " + s.slice(insertAt);
      console.log("SideDrawer for invoice injected");
    }
  }
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("ThreeWayMatch patched");
