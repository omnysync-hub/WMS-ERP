const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/PurchaseOrdersTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Import SearchableSelect
if (!content.includes('import SearchableSelect from "@/components/ui/SearchableSelect";')) {
  content = content.replace(
    'import SideDrawer from "@/components/ui/SideDrawer";',
    'import SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. Top filters
const oldFilters = `          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All PO Types</option>
            <option value="standard">Standard PO</option>
            <option value="blanket">Blanket / Framework PO</option>
            <option value="service">Service PO</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="sent_to_vendor">Sent to Vendor</option>
            <option value="partially_received">Partially Received</option>
            <option value="fully_received">Fully Received</option>
            <option value="closed">Closed / Completed</option>
          </select>`;

const newFilters = `          <div className="w-44">
            <SearchableSelect
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[
                { value: "all", label: "All PO Types" },
                { value: "standard", label: "Standard PO" },
                { value: "blanket", label: "Blanket / Framework PO" },
                { value: "service", label: "Service PO" },
              ]}
              placeholder="PO Type..."
            />
          </div>

          <div className="w-48">
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "draft", label: "Draft" },
                { value: "approved", label: "Approved" },
                { value: "sent_to_vendor", label: "Sent to Vendor" },
                { value: "partially_received", label: "Partially Received" },
                { value: "fully_received", label: "Fully Received" },
                { value: "closed", label: "Closed / Completed" },
              ]}
              placeholder="Status..."
            />
          </div>`;

if (content.includes(oldFilters)) {
  content = content.replace(oldFilters, newFilters);
  console.log('Replaced top filters in PurchaseOrdersTab');
} else {
  console.error('Could not find oldFilters');
}

// 3. Inside showCreateModal: vendorId and poType selects
const oldVendorSelect = `                  <select
                    required
                    value={vendorId}
                    onChange={(e) => {
                      setVendorId(e.target.value);
                      const v = vendors.find((vend) => vend.id === e.target.value);
                      if (v) setPaymentTerms(v.paymentTerms || "Net 30");
                    }}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors
                      .filter((v) => v.status === "Active")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.vendorCode}) - Terms: {v.paymentTerms} (WHT: {v.whtRate}%)
                        </option>
                      ))}
                  </select>`;

const newVendorSelect = `                  <SearchableSelect
                    required
                    value={vendorId}
                    onChange={(val) => {
                      setVendorId(val);
                      const v = vendors.find((vend) => vend.id === val);
                      if (v) setPaymentTerms(v.paymentTerms || "Net 30");
                    }}
                    options={vendors
                      .filter((v) => v.status === "Active")
                      .map((v) => ({
                        value: v.id,
                        label: v.name,
                        subLabel: \`\${v.vendorCode || ""} · Terms: \${v.paymentTerms || "Net 30"} · WHT: \${v.whtRate || 0}%\`,
                      }))}
                    placeholder="-- Choose Vendor --"
                  />`;

if (content.includes(oldVendorSelect)) {
  content = content.replace(oldVendorSelect, newVendorSelect);
  console.log('Replaced vendorId select in PurchaseOrdersTab');
} else {
  console.error('Could not find oldVendorSelect');
}

const oldPoTypeSelect = `                  <select
                    value={poType}
                    onChange={(e) => setPoType(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="standard">Standard PO</option>
                    <option value="blanket">Blanket / Framework PO (Annual)</option>
                    <option value="service">Service PO (Labor/Maintenance)</option>
                  </select>`;

const newPoTypeSelect = `                  <SearchableSelect
                    value={poType}
                    onChange={(val) => setPoType(val as any)}
                    options={[
                      { value: "standard", label: "Standard PO" },
                      { value: "blanket", label: "Blanket / Framework PO (Annual)" },
                      { value: "service", label: "Service PO (Labor/Maintenance)" },
                    ]}
                  />`;

if (content.includes(oldPoTypeSelect)) {
  content = content.replace(oldPoTypeSelect, newPoTypeSelect);
  console.log('Replaced poType select in PurchaseOrdersTab');
} else {
  console.error('Could not find oldPoTypeSelect');
}

// 4. Line item product select
const oldProductSelect = `                          <select
                            value={it.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                          >
                            <option value="">-- Custom Non-Catalog Item --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - Cost: {p.costPrice}
                              </option>
                            ))}
                          </select>`;

const newProductSelect = `                          <SearchableSelect
                            value={it.productId}
                            onChange={(val) => handleProductSelect(idx, val)}
                            options={[
                              { value: "", label: "-- Custom Non-Catalog Item --" },
                              ...products.map((p) => ({
                                value: p.id,
                                label: p.name,
                                subLabel: p.sku,
                                badge: p.costPrice != null ? \`Cost: \${p.costPrice}\` : undefined,
                              })),
                            ]}
                            placeholder="Select product..."
                            clearable
                          />`;

if (content.includes(oldProductSelect)) {
  content = content.replace(oldProductSelect, newProductSelect);
  console.log('Replaced product select in PurchaseOrdersTab');
} else {
  console.error('Could not find oldProductSelect');
}

// 5. Replace printablePo with SideDrawer
const printStart = content.indexOf('{/* FORMAL PRINTABLE PURCHASE ORDER MODAL */}');
if (printStart !== -1) {
  const printEnd = content.indexOf('{/* Dedicated PO Approval Modal */}', printStart);
  if (printEnd !== -1) {
    const printBlock = content.substring(printStart, printEnd);
    // Find body of printablePo
    const bodyStart = printBlock.indexOf('<div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto bg-white font-sans text-xs">');
    const bodyEnd = printBlock.lastIndexOf('</div>\n          </div>\n        </div>\n      )}');
    
    if (bodyStart !== -1 && bodyEnd !== -1) {
      const innerDocument = printBlock.substring(bodyStart, bodyEnd);
      const newPrintableDrawer = `{/* FORMAL PRINTABLE PURCHASE ORDER DRAWER */}
      <SideDrawer
        isOpen={!!printablePo}
        onClose={() => setPrintablePo(null)}
        title={
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Formal Purchase Order Document • {printablePo?.poNumber}
            </span>
          </div>
        }
        subtitle="Official commercial letterhead & order verification"
        width="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setPrintablePo(null)}
              className="px-4 py-2 border border-[#D4D4D8] rounded-lg text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 bg-[#0D7A5F] hover:bg-[#0B6851] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          </div>
        }
      >
        {printablePo && (
          ${innerDocument}
        )}
      </SideDrawer>

      `;
      content = content.substring(0, printStart) + newPrintableDrawer + content.substring(printEnd);
      console.log('Replaced printablePo with SideDrawer');
    }
  }
}

// 6. Replace poToApprove with SideDrawer
const approveStart = content.indexOf('{/* Dedicated PO Approval Modal */}');
if (approveStart !== -1) {
  const approveEnd = content.indexOf('</div>\n  );\n}', approveStart);
  if (approveEnd !== -1) {
    const approveBlock = content.substring(approveStart, approveEnd);
    // find body
    const bodyStart = approveBlock.indexOf('<div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">');
    const actionStart = approveBlock.indexOf('<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">');
    
    if (bodyStart !== -1 && actionStart !== -1) {
      const innerBody = approveBlock.substring(bodyStart + '<div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">'.length, actionStart);
      
      const newApproveDrawer = `{/* Dedicated PO Approval SideDrawer */}
      <SideDrawer
        isOpen={!!poToApprove}
        onClose={() => setPoToApprove(null)}
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-[#18181B] text-sm">
              Executive PO Authorization · {poToApprove?.poNumber}
            </span>
          </div>
        }
        subtitle={poToApprove ? \`Supplier: \${poToApprove.supplierName} • Order Value: \${formatCurrency(poToApprove.totalAmount)}\` : ""}
        width="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setPoToApprove(null)}
              className="px-3.5 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => poToApprove && handleApprovePo(poToApprove.id, approvalNotes)}
              disabled={isSubmitting || !canApprovePo}
              title={!canApprovePo ? "Missing permission" : undefined}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Authorize & Sign PO
            </button>
          </div>
        }
      >
        {poToApprove && (
          <div className="space-y-4 text-xs pt-1 text-[#18181B]">
            ${innerBody}
          </div>
        )}
      </SideDrawer>
    </div>
  );
}`;
      content = content.substring(0, approveStart) + newApproveDrawer;
      console.log('Replaced poToApprove with SideDrawer');
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming PurchaseOrdersTab.tsx');
