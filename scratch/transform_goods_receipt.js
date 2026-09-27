const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/GoodsReceiptTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Import SearchableSelect
if (!content.includes('import SearchableSelect from "@/components/ui/SearchableSelect";')) {
  content = content.replace(
    'import SideDrawer from "@/components/ui/SideDrawer";',
    'import SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. qualityFilter
const oldQualityFilter = `          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Quality Statuses</option>
            <option value="Accepted">Accepted (QA Passed)</option>
            <option value="Rejected">Rejected</option>
            <option value="Hold">Hold / Quarantine</option>
          </select>`;

const newQualityFilter = `          <div className="w-48">
            <SearchableSelect
              value={qualityFilter}
              onChange={(val) => setQualityFilter(val)}
              options={[
                { value: "all", label: "All Quality Statuses" },
                { value: "Accepted", label: "Accepted (QA Passed)" },
                { value: "Rejected", label: "Rejected" },
                { value: "Hold", label: "Hold / Quarantine" },
              ]}
              placeholder="Quality..."
            />
          </div>`;

if (content.includes(oldQualityFilter)) {
  content = content.replace(oldQualityFilter, newQualityFilter);
  console.log('Replaced qualityFilter in GoodsReceiptTab');
}

// 3. showCreateModal -> SideDrawer
const grnModalStart = content.indexOf('{showCreateModal && (');
if (grnModalStart !== -1) {
  const grnModalEnd = content.indexOf('{/* Viewing GRN Details Modal */}', grnModalStart);
  if (grnModalEnd !== -1) {
    const grnBlock = content.substring(grnModalStart, grnModalEnd);
    
    // Replace selects inside grnBlock
    let transformedGrn = grnBlock;
    
    // Replace PO select
    const oldPoSelect = `<select
                    required
                    value={selectedPoId}
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Pick open PO (remaining qty) --</option>
                    {openPosForReceipt.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.poNumber} — {p.supplierName} · {(p.items||[]).filter((it:any)=> (it.quantity-(it.quantityReceived||0))>0).length} lines remaining)
                          {!isStorekeeper ? \` - Value: \${formatCurrency(p.totalAmount)}\` : ""}
                        </option>
                      ))}
                  </select>`;
    
    const newPoSelect = `<SearchableSelect
                    required
                    value={selectedPoId}
                    onChange={(val) => handlePoSelect(val)}
                    options={openPosForReceipt.map((p) => ({
                      value: p.id,
                      label: \`\${p.poNumber} — \${p.supplierName}\`,
                      subLabel: \`\${(p.items || []).filter((it: any) => (it.quantity - (it.quantityReceived || 0)) > 0).length} lines remaining\${!isStorekeeper ? \` · Val: \${formatCurrency(p.totalAmount)}\` : ""}\`,
                    }))}
                    placeholder="-- Pick open PO (remaining qty) --"
                  />`;

    if (transformedGrn.includes(oldPoSelect)) {
      transformedGrn = transformedGrn.replace(oldPoSelect, newPoSelect);
    }

    // Replace warehouseLocation select
    const oldLocationSelect = `<select
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Central Warehouse - Lahore">Central Warehouse - Lahore</option>
                    <option value="Karachi Distribution Depot">Karachi Distribution Depot</option>
                    <option value="Islamabad Regional Store">Islamabad Regional Store</option>
                    <option value="Field Tech Holding Bin">Field Tech Holding Bin</option>
                  </select>`;

    const newLocationSelect = `<SearchableSelect
                    value={warehouseLocation}
                    onChange={(val) => setWarehouseLocation(val)}
                    options={[
                      { value: "Central Warehouse - Lahore", label: "Central Warehouse - Lahore" },
                      { value: "Karachi Distribution Depot", label: "Karachi Distribution Depot" },
                      { value: "Islamabad Regional Store", label: "Islamabad Regional Store" },
                      { value: "Field Tech Holding Bin", label: "Field Tech Holding Bin" },
                    ]}
                  />`;

    if (transformedGrn.includes(oldLocationSelect)) {
      transformedGrn = transformedGrn.replace(oldLocationSelect, newLocationSelect);
    }

    // Replace QA status select
    const oldQaSelect = `<select
                              value={it.qualityStatus}
                              onChange={(e) =>
                                handleItemChange(idx, "qualityStatus", e.target.value)
                              }
                              className={cn(
                                "border text-xs rounded px-2 py-0.5 font-bold outline-none",
                                it.qualityStatus === "Accepted"
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                  : it.qualityStatus === "Hold"
                                  ? "bg-amber-50 border-amber-300 text-amber-700"
                                  : "bg-rose-50 border-rose-300 text-rose-700"
                              )}
                            >
                              <option value="Accepted">Accepted</option>
                              <option value="Rejected">Rejected</option>
                              <option value="Hold">Hold / Quarantine</option>
                            </select>`;

    const newQaSelect = `<SearchableSelect
                              value={it.qualityStatus}
                              onChange={(val) => handleItemChange(idx, "qualityStatus", val)}
                              options={[
                                { value: "Accepted", label: "Accepted" },
                                { value: "Rejected", label: "Rejected" },
                                { value: "Hold", label: "Hold / Quarantine" },
                              ]}
                              className="w-36 min-h-[30px] text-[11px]"
                            />`;

    if (transformedGrn.includes(oldQaSelect)) {
      transformedGrn = transformedGrn.replace(oldQaSelect, newQaSelect);
    }

    // Extract form body
    const bodyStart = transformedGrn.indexOf('<form onSubmit={handleCreateGrn}');
    const bodyEnd = transformedGrn.lastIndexOf('</form>');
    const innerForm = transformedGrn.substring(bodyStart + '<form onSubmit={handleCreateGrn} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">'.length, bodyEnd);

    // Remove buttons from bottom of form
    const actionsIdx = innerForm.indexOf('{/* Action Buttons */}');
    const cleanedInnerForm = actionsIdx !== -1 ? innerForm.substring(0, actionsIdx) : innerForm;

    const newGrnDrawer = `<SideDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Inward Goods Receipt Note (GRN)
            </span>
          </div>
        }
        subtitle="Physical Count, Quality Inspection & Automated GR/IR Clearing Posting"
        width="max-w-3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-[#71717A]">
              Items receiving: <strong className="text-[#18181B]">{receiptItems.filter((i) => (Number(i.receivingQty) || 0) > 0).length}</strong>
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-grn-form"
                disabled={isSubmitting || !selectedPoId}
                className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
              >
                {isSubmitting ? "Receiving & Posting..." : "Post Inward Goods Receipt (GRN)"}
              </button>
            </div>
          </div>
        }
      >
        <form id="create-grn-form" onSubmit={handleCreateGrn} className="space-y-4 pb-8 text-[#18181B]">
          ${cleanedInnerForm}
        </form>
      </SideDrawer>

      `;

    content = content.substring(0, grnModalStart) + newGrnDrawer + content.substring(grnModalEnd);
    console.log('Replaced showCreateModal with SideDrawer in GoodsReceiptTab');
  }
}

// 4. viewingGrn -> SideDrawer
const viewStart = content.indexOf('{/* Viewing GRN Details Modal */}');
if (viewStart !== -1) {
  const viewEnd = content.indexOf('</div>\n  );\n}', viewStart);
  if (viewEnd !== -1) {
    const viewBlock = content.substring(viewStart, viewEnd);
    const bodyStart = viewBlock.indexOf('<div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">');
    const closeBtnIdx = viewBlock.indexOf('<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">');
    
    if (bodyStart !== -1 && closeBtnIdx !== -1) {
      const innerViewBody = viewBlock.substring(bodyStart + '<div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">'.length, closeBtnIdx);

      const newViewDrawer = `{/* Viewing GRN Details SideDrawer */}
      <SideDrawer
        isOpen={!!viewingGrn}
        onClose={() => setViewingGrn(null)}
        title={
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              {viewingGrn?.grnNumber} • Goods Receipt Note
            </span>
          </div>
        }
        subtitle={viewingGrn ? \`Under PO \${viewingGrn.po?.poNumber || "PO"} (\${viewingGrn.po?.supplierName || "Supplier"})\` : ""}
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <button
              type="button"
              onClick={() => setViewingGrn(null)}
              className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Close
            </button>
          </div>
        }
      >
        {viewingGrn && (
          <div className="space-y-4 text-xs pt-1 text-[#18181B]">
            ${innerViewBody}
          </div>
        )}
      </SideDrawer>
    </div>
  );
}`;
      content = content.substring(0, viewStart) + newViewDrawer;
      console.log('Replaced viewingGrn with SideDrawer in GoodsReceiptTab');
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming GoodsReceiptTab.tsx');
