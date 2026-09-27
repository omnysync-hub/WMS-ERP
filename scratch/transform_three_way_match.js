const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/ThreeWayMatchTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Import SearchableSelect
if (!content.includes('import SearchableSelect from "@/components/ui/SearchableSelect";')) {
  content = content.replace(
    'import SideDrawer from "@/components/ui/SideDrawer";',
    'import SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. statusFilter
const oldStatusFilter = `          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Match Statuses</option>
            <option value="matched">Matched (100% Validated)</option>
            <option value="discrepancy">Discrepancy (Variance Alert)</option>
            <option value="pending_match">Pending Match</option>
            <option value="approved_for_payment">Approved for Payment</option>
            <option value="paid">Settled / Paid</option>
          </select>`;

const newStatusFilter = `          <div className="w-56">
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: "all", label: "All Match Statuses" },
                { value: "matched", label: "Matched (100% Validated)" },
                { value: "discrepancy", label: "Discrepancy (Variance Alert)" },
                { value: "pending_match", label: "Pending Match" },
                { value: "approved_for_payment", label: "Approved for Payment" },
                { value: "paid", label: "Settled / Paid" },
              ]}
              placeholder="Status..."
            />
          </div>`;

if (content.includes(oldStatusFilter)) {
  content = content.replace(oldStatusFilter, newStatusFilter);
  console.log('Replaced statusFilter in ThreeWayMatchTab');
}

// 3. showCreateModal -> SideDrawer
const modalStart = content.indexOf('{showCreateModal && (');
if (modalStart !== -1) {
  const modalEnd = content.indexOf('{/* INSPECT 3-WAY MATCH MODAL */}', modalStart);
  if (modalEnd !== -1) {
    const block = content.substring(modalStart, modalEnd);

    // Replace PO select
    const oldPoSelect = `<select
                    required
                    value={selectedPoId}
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose PO --</option>
                    {pos
                      .filter((p) => p.status !== "draft")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.poNumber} — {p.supplierName} ({p.items?.length} items) - Val: {formatCurrency(p.totalAmount)}
                        </option>
                      ))}
                  </select>`;

    const newPoSelect = `<SearchableSelect
                    required
                    value={selectedPoId}
                    onChange={(val) => handlePoSelect(val)}
                    options={pos
                      .filter((p) => p.status !== "draft")
                      .map((p) => ({
                        value: p.id,
                        label: \`\${p.poNumber} — \${p.supplierName}\`,
                        subLabel: \`\${p.items?.length || 0} items · Val: \${formatCurrency(p.totalAmount)}\`,
                      }))}
                    placeholder="-- Choose PO --"
                  />`;

    let transformed = block;
    if (transformed.includes(oldPoSelect)) {
      transformed = transformed.replace(oldPoSelect, newPoSelect);
    }

    // Extract form body
    const bodyStart = transformed.indexOf('<form onSubmit={handleCreateInvoice}');
    const bodyEnd = transformed.lastIndexOf('</form>');
    const innerForm = transformed.substring(bodyStart + '<form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">'.length, bodyEnd);
    
    // Remove action buttons from inside form
    const actionsIdx = innerForm.indexOf('<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">');
    const cleanedInnerForm = actionsIdx !== -1 ? innerForm.substring(0, actionsIdx) : innerForm;

    const newDrawer = `<SideDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Enter Supplier Invoice & Run 3-Way Match
            </span>
          </div>
        }
        subtitle="Critical Financial Control: Compares PO Rate vs GRN Physical Count vs Billed Amount"
        width="max-w-3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs">
              <span className="text-[#71717A]">Gross Payable: </span>
              <span className="font-bold font-mono text-emerald-700 text-sm">
                {formatCurrency(calculatedSubtotal + (Number(taxAmount) || 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-invoice-form"
                disabled={isSubmitting || billedItems.length === 0}
                className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
              >
                {isSubmitting ? "Running 3-Way Match..." : "Verify & Save Invoice"}
              </button>
            </div>
          </div>
        }
      >
        <form id="create-invoice-form" onSubmit={handleCreateInvoice} className="space-y-4 pb-8 text-[#18181B]">
          ${cleanedInnerForm}
        </form>
      </SideDrawer>

      `;

    content = content.substring(0, modalStart) + newDrawer + content.substring(modalEnd);
    console.log('Replaced showCreateModal with SideDrawer in ThreeWayMatchTab');
  }
}

// 4. Remove duplicate center modal for activeInvoice (keep only the sleek SideDrawer below it)
const inspectModalStart = content.indexOf('{/* INSPECT 3-WAY MATCH MODAL */}');
const sideDrawerStart = content.indexOf('{/* Invoice detail SideDrawer */}');

if (inspectModalStart !== -1 && sideDrawerStart !== -1) {
  content = content.substring(0, inspectModalStart) + content.substring(sideDrawerStart);
  console.log('Removed duplicate center modal for activeInvoice');
}

// 5. Enhance the Invoice detail SideDrawer with the full 3-way audit info & approve button
const drawerTarget = `      {/* Invoice detail SideDrawer */}
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
      >`;

const enhancedDrawer = `      {/* Invoice detail SideDrawer */}
      <SideDrawer
        isOpen={Boolean(activeInvoice)}
        onClose={() => setActiveInvoice(null)}
        title={
          activeInvoice ? (
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#0D7A5F]" />
              <span className="font-bold text-sm text-[#18181B]">
                3-Way Match Audit • {activeInvoice.invoiceNumber}
              </span>
            </div>
          ) : (
            "Invoice Audit"
          )
        }
        subtitle={
          activeInvoice
            ? \`Vendor: \${activeInvoice.vendor?.name || "Vendor"} • PO: \${activeInvoice.po?.poNumber || "Direct"}\`
            : undefined
        }
        width="max-w-2xl"
        footer={
          activeInvoice ? (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setActiveInvoice(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                {(activeInvoice.matchStatus === "matched" || activeInvoice.matchStatus === "discrepancy") && (
                  <button
                    type="button"
                    onClick={() => handleApproveInvoice(activeInvoice.id)}
                    disabled={isSubmitting || !canApproveInvoice}
                    title={!canApproveInvoice ? "Missing permission" : undefined}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white font-bold text-xs rounded-lg shadow-2xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve for Payment
                  </button>
                )}
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
              </div>
            </div>
          ) : null
        }
      >`;

if (content.includes(drawerTarget)) {
  content = content.replace(drawerTarget, enhancedDrawer);
  console.log('Enhanced Invoice SideDrawer header & footer');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming ThreeWayMatchTab.tsx');
