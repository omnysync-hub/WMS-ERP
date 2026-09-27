const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/RequisitionsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure SearchableSelect is imported
if (!content.includes('import SearchableSelect from "@/components/ui/SearchableSelect";')) {
  content = content.replace(
    'import SideDrawer from "@/components/ui/SideDrawer";',
    'import SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. Transform showCreateModal to SideDrawer
const createModalStart = content.indexOf('{showCreateModal && (');
if (createModalStart !== -1) {
  const formEnd = content.indexOf('</form>\n          </div>\n        </div>\n      )}', createModalStart);
  if (formEnd !== -1) {
    const originalBlock = content.substring(createModalStart, formEnd + '</form>\n          </div>\n        </div>\n      )}'.length);
    
    // We construct the new SideDrawer code
    const newBlock = `<SideDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">Raise Purchase Requisition (PR)</span>
          </div>
        }
        subtitle="Material demand specification for Site, Store, or Job Order (Pricing is assigned at PO stage)"
        width="max-w-3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-[#71717A]">
              Items specified: <strong className="text-[#18181B]">{items.length}</strong>
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
                form="create-pr-form"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
              >
                {isSubmitting ? "Submitting PR..." : "Save Purchase Requisition"}
              </button>
            </div>
          </div>
        }
      >
        <form id="create-pr-form" onSubmit={handleCreatePr} className="space-y-4 pb-8 text-[#18181B]">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {formError}
            </div>
          )}

          {/* 1. Requisition Target Selection (Site / Store / Job) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#3F3F46]">
              Requisition Target Destination (Site / Store / Job Selection) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("store")}
                className={\`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all \${
                  targetType === "store"
                    ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                    : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                }\`}
              >
                <Boxes className="w-4 h-4 mt-0.5 text-[#0D7A5F]" />
                <div>
                  <div className="text-xs font-semibold text-[#18181B]">Store / Warehouse</div>
                  <div className="text-[10px] text-[#71717A]">General inventory & restocking</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("job")}
                className={\`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all \${
                  targetType === "job"
                    ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                    : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                }\`}
              >
                <Briefcase className="w-4 h-4 mt-0.5 text-[#0D7A5F]" />
                <div>
                  <div className="text-xs font-semibold text-[#18181B]">Job Order</div>
                  <div className="text-[10px] text-[#71717A]">Direct maintenance / repair job</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("site")}
                className={\`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all \${
                  targetType === "site"
                    ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                    : "bg-white border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                }\`}
              >
                <MapPin className="w-4 h-4 mt-0.5 text-[#0D7A5F]" />
                <div>
                  <div className="text-xs font-semibold text-[#18181B]">Project / Client Site</div>
                  <div className="text-[10px] text-[#71717A]">Specific field installation site</div>
                </div>
              </button>
            </div>

            {/* Sub-selectors depending on targetType */}
            {targetType === "store" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                    Select Warehouse / Store *
                  </label>
                  <SearchableSelect
                    value={selectedStore}
                    onChange={(val) => setSelectedStore(val)}
                    options={[
                      { value: "Central Warehouse", label: "Central Warehouse (Workshop St, Gulberg)" },
                      { value: "Workshop Spares Store", label: "Workshop Spares Store" },
                      { value: "Regional Spares Depot", label: "Regional Spares Depot" },
                      { value: "Mobile Van Inventory", label: "Mobile Van Inventory" },
                      { value: "CUSTOM", label: "+ Enter Custom Store Name..." },
                    ]}
                    placeholder="Select Warehouse / Store"
                  />
                </div>
                {selectedStore === "CUSTOM" && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                      Custom Store Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customStore}
                      onChange={(e) => setCustomStore(e.target.value)}
                      placeholder="e.g. Faisalabad Spares Branch"
                      className="w-full bg-white border border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {targetType === "job" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                    Select Active Job *
                  </label>
                  <SearchableSelect
                    value={selectedJobNumber}
                    onChange={(val) => setSelectedJobNumber(val)}
                    options={[
                      ...jobs.map((j) => ({
                        value: j.jobNumber,
                        label: \`\${j.jobNumber} — \${j.customer?.name || "Job"}\`,
                        subLabel: j.jobType,
                      })),
                      { value: "CUSTOM", label: "+ Enter Custom Job Number..." },
                    ]}
                    placeholder="-- Choose Job --"
                  />
                </div>
                {selectedJobNumber === "CUSTOM" && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                      Manual Job Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={customJobNumber}
                      onChange={(e) => setCustomJobNumber(e.target.value)}
                      placeholder="e.g. JOB-2026-9999"
                      className="w-full bg-white border border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {targetType === "site" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                    Select Site Location
                  </label>
                  <SearchableSelect
                    value={selectedSite}
                    onChange={(val) => setSelectedSite(val)}
                    options={[
                      { value: "Packages Mall Site - Lahore", label: "Packages Mall Site - Lahore" },
                      { value: "Dolmen Mall Site - Karachi", label: "Dolmen Mall Site - Karachi" },
                      { value: "Emporium Commercial Plant", label: "Emporium Commercial Plant" },
                      { value: "CUSTOM", label: "+ Enter Custom Site..." },
                    ]}
                    placeholder="Select Site Location"
                  />
                </div>
                {selectedSite === "CUSTOM" && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#71717A] mb-1">
                      Custom Site Name / Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={customSite}
                      onChange={(e) => setCustomSite(e.target.value)}
                      placeholder="e.g. Centaurus Mall HVAC Chiller Room"
                      className="w-full bg-white border border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Personnel Details: Auto Requisitioner (User) + Manual Technician & Supervisor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div>
              <label className="block text-[10px] font-mono text-[#71717A] mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-[#0D7A5F]" />
                Requisitioner (Current User)
              </label>
              <input
                type="text"
                disabled
                value={autoRequisitionerName}
                className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] font-semibold cursor-not-allowed opacity-90"
              />
              <span className="text-[9px] text-[#0D7A5F] font-mono mt-0.5 block">
                Auto-recorded from active session
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#71717A] mb-1 flex items-center gap-1">
                <Wrench className="w-3 h-3 text-[#71717A]" />
                Technician (Manual Selection)
              </label>
              <SearchableSelect
                value={technicianName}
                onChange={(val) => setTechnicianName(val)}
                options={
                  employees.filter((e) => e.role === "technician" || !e.role).length > 0
                    ? employees
                        .filter((e) => e.role === "technician" || !e.role)
                        .map((emp) => ({
                          value: emp.name,
                          label: emp.name,
                          subLabel: emp.department || "Field Tech",
                        }))
                    : [
                        { value: "Muhammad Asif", label: "Muhammad Asif", subLabel: "Senior Chiller Tech" },
                        { value: "Rashid Ali", label: "Rashid Ali", subLabel: "VRF Specialist" },
                        { value: "Tariq Mehmood", label: "Tariq Mehmood", subLabel: "Installation Tech" },
                      ]
                }
                placeholder="-- Choose Technician --"
                clearable
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#71717A] mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#71717A]" />
                Supervisor (Manual Selection)
              </label>
              <SearchableSelect
                value={supervisorName}
                onChange={(val) => setSupervisorName(val)}
                options={
                  employees.filter((e) => e.role !== "technician").length > 0
                    ? employees
                        .filter((e) => e.role !== "technician")
                        .map((emp) => ({
                          value: emp.name,
                          label: emp.name,
                          subLabel: emp.role || "Supervisor",
                        }))
                    : [
                        { value: "Haris Qureshi", label: "Haris Qureshi", subLabel: "Operations Manager" },
                        { value: "Khurram Shahzad", label: "Khurram Shahzad", subLabel: "Site Supervisor" },
                      ]
                }
                placeholder="-- Choose Supervisor --"
                clearable
              />
            </div>
          </div>

          {/* 3. Dates, Priority & Departments */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Date Required *
              </label>
              <input
                type="date"
                required
                value={dateRequired}
                onChange={(e) => setDateRequired(e.target.value)}
                className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Priority
              </label>
              <SearchableSelect
                value={priority}
                onChange={(val) => setPriority(val as any)}
                options={[
                  { value: "Normal", label: "Normal" },
                  { value: "Urgent", label: "🚨 Urgent (Field Blocker)", badge: "High Priority" },
                ]}
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Department
              </label>
              <SearchableSelect
                value={department}
                onChange={(val) => setDepartment(val)}
                options={[
                  { value: "HVAC Operations", label: "HVAC Operations" },
                  { value: "Central Warehouse", label: "Central Warehouse" },
                  { value: "Project Engineering", label: "Project Engineering" },
                  { value: "Facilities & Fleet", label: "Facilities & Fleet" },
                ]}
              />
            </div>
          </div>

          {/* 4. Line Items Builder (NO PRICING) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
                  Requisition Material Items ({items.length})
                </span>
                <span className="text-[10px] text-[#71717A]">
                  Specification only — pricing will be assigned during PO issuance
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-[11px] text-[#0D7A5F] hover:text-[#0A624C] font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Item
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#F8FAFC] border border-[#EDEDED] rounded-xl space-y-2 relative"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Catalog Product Link */}
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                        Catalog Product (Optional)
                      </label>
                      <SearchableSelect
                        value={it.productId}
                        onChange={(val) => handleProductSelect(idx, val)}
                        options={[
                          { value: "", label: "-- Custom Non-Catalog Item --" },
                          ...products.map((p) => ({
                            value: p.id,
                            label: p.name,
                            subLabel: p.sku,
                            badge: p.unit,
                          })),
                        ]}
                        placeholder="Search product..."
                        clearable
                      />
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                        Item Description & Specs *
                      </label>
                      <input
                        type="text"
                        required
                        value={it.description}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                        placeholder="Specification / model / brand"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                        Qty *
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        required
                        value={it.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", Number(e.target.value))
                        }
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1.5 text-xs text-[#18181B] font-mono font-bold focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                      />
                    </div>

                    {/* Unit */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-[#71717A] mb-0.5">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={it.unit}
                        onChange={(e) =>
                          handleItemChange(idx, "unit", e.target.value)
                        }
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                        placeholder="pcs"
                      />
                    </div>
                  </div>

                  {items.length > 1 && (
                    <div className="flex items-center justify-end pt-1 border-t border-[#EDEDED]">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-600 hover:text-rose-700 text-[10px] flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3 h-3" /> Remove Item
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 5. Justifications & Operational Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Operational Justification / Reason
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                placeholder="State machine breakdown, replenishment requirement, or urgent ticket context..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Drawing / Specs / Attachment Reference
              </label>
              <textarea
                rows={2}
                value={attachments}
                onChange={(e) => setAttachments(e.target.value)}
                className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                placeholder="Reference technical drawings, equipment manual page, or contractor quote ref..."
              />
            </div>
          </div>
        </form>
      </SideDrawer>`;

    content = content.substring(0, createModalStart) + newBlock + content.substring(formEnd + '</form>\n          </div>\n        </div>\n      )}'.length);
    console.log('Successfully replaced create PR modal with SideDrawer');
  } else {
    console.error('Could not find formEnd for createModal');
  }
}

// 3. Transform showConvertModal to SideDrawer
const convertModalStart = content.indexOf('{showConvertModal && prsToConvert.length > 0 && (');
if (convertModalStart !== -1) {
  const convertEnd = content.indexOf('</form>\n          </div>\n        </div>\n      )}', convertModalStart);
  if (convertEnd !== -1) {
    const originalConvert = content.substring(convertModalStart, convertEnd + '</form>\n          </div>\n        </div>\n      )}'.length);

    const newConvertBlock = `<SideDrawer
        isOpen={showConvertModal && prsToConvert.length > 0}
        onClose={() => setShowConvertModal(false)}
        title={
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Generate Purchase Order from {prsToConvert.length} Requisition(s)
            </span>
          </div>
        }
        subtitle="Consolidated PO creation: Assign supplier and agree commercial unit prices for requested items."
        width="max-w-3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs">
              <span className="text-[#71717A]">Net Order Value: </span>
              <span className="font-bold font-mono text-emerald-800 text-sm">
                {formatCurrency(calculatedPoSubtotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="convert-po-form"
                disabled={isSubmitting || poPricingItems.length === 0}
                className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
              >
                {isSubmitting ? "Generating PO..." : \`Issue Purchase Order (\${formatCurrency(calculatedPoSubtotal)})\`}
              </button>
            </div>
          </div>
        }
      >
        <form id="convert-po-form" onSubmit={handleGeneratePoSubmit} className="space-y-4 pb-8 text-[#18181B]">
          {/* Linked PRs Badges */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-800 font-bold block">
              Consolidated Requisitions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {prsToConvert.map((pr) => (
                <span
                  key={pr.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white text-purple-700 border border-purple-300"
                >
                  {pr.prNumber}
                  <span className="text-[10px] text-[#71717A]">
                    ({pr.site || pr.department})
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Vendor & Delivery Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Select Supplier / Vendor *
              </label>
              <SearchableSelect
                value={convertVendorId}
                onChange={(val) => setConvertVendorId(val)}
                options={vendors
                  .filter((v) => v.status === "Active")
                  .map((v) => ({
                    value: v.id,
                    label: v.name,
                    subLabel: \`\${v.vendorCode || ""} · Terms: \${v.paymentTerms || "Net 30"}\`,
                  }))}
                placeholder="-- Choose Vendor --"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                PO Contract Type
              </label>
              <SearchableSelect
                value={convertPoType}
                onChange={(val) => setConvertPoType(val as any)}
                options={[
                  { value: "standard", label: "Standard PO" },
                  { value: "blanket", label: "Blanket / Framework PO" },
                  { value: "service", label: "Service PO" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Agreed Delivery Date
              </label>
              <input
                type="date"
                value={convertExpectedDate}
                onChange={(e) => setConvertExpectedDate(e.target.value)}
                className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                Delivery Location / Site Destination
              </label>
              <input
                type="text"
                value={convertDestination}
                onChange={(e) => setConvertDestination(e.target.value)}
                placeholder="Defaults to PR destinations if left blank"
                className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
              />
            </div>
          </div>

          {/* Pricing Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#18181B]">
                Price Assignment & Qty Confirmation ({poPricingItems.length} items)
              </span>
              <span className="text-[10px] text-[#71717A]">
                Uncheck items you do not wish to include in this specific PO
              </span>
            </div>

            <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8">Inc</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Source PR</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right w-44">Agreed Unit Rate (PKR) *</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                  {poPricingItems.map((it, idx) => {
                    const included = it.selected !== false;
                    return (
                    <tr key={idx} className={included ? "hover:bg-[#F8FAFC]" : "opacity-50 bg-slate-50"}>
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => togglePoPricingItem(idx)}
                          className="accent-[#0D7A5F]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#18181B]">{it.description}</div>
                        {it.itemCode && (
                          <span className="text-[10px] font-mono text-[#A1A1AA]">
                            SKU: {it.itemCode}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-purple-700 font-semibold">
                        {it.prNumber}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!included}
                          value={it.quantity}
                          onChange={(e) => handlePoItemQtyChange(idx, Number(e.target.value))}
                          className="w-20 text-right bg-white border border-[#D4D4D8] rounded px-2 py-1 text-xs font-mono font-bold disabled:bg-slate-100"
                        />
                        <span className="text-[10px] text-[#71717A] ml-1">{it.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required={included}
                          disabled={!included}
                          value={it.estimatedPrice}
                          onChange={(e) => handlePoItemPriceChange(idx, Number(e.target.value))}
                          placeholder="Rate in PKR"
                          className="w-36 text-right bg-white border border-[#0D7A5F] rounded px-2.5 py-1 text-xs font-mono font-bold focus:ring-1 focus:ring-[#0D7A5F] outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                        {formatCurrency((Number(it.estimatedPrice) || 0) * (Number(it.quantity) || 0))}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subtotal Display */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[#18181B] font-semibold block">
                Total Order Value (Net Payable):
              </span>
              <span className="text-[10px] text-[#71717A] font-mono">
                Includes {poPricingItems.filter((x) => x.selected !== false).length} line items from {prsToConvert.length} PRs
              </span>
            </div>
            <span className="text-lg font-black font-mono text-emerald-800">
              {formatCurrency(calculatedPoSubtotal)}
            </span>
          </div>
        </form>
      </SideDrawer>`;

    content = content.substring(0, convertModalStart) + newConvertBlock + content.substring(convertEnd + '</form>\n          </div>\n        </div>\n      )}'.length);
    console.log('Successfully replaced convert PR modal with SideDrawer');
  } else {
    console.error('Could not find convertEnd');
  }
}

// 4. Transform showRejectModal to SideDrawer
const rejectStart = content.indexOf('{showRejectModal && (');
if (rejectStart !== -1) {
  const rejectEnd = content.indexOf('</div>\n          </div>\n        </div>\n      )}', rejectStart);
  if (rejectEnd !== -1) {
    const newRejectBlock = `<SideDrawer
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-bold text-sm">Reject Purchase Requisition</span>
          </div>
        }
        subtitle="Provide formal reason for returning / rejecting this request"
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleUpdateStatus("rejected", rejectReason)}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow"
            >
              Confirm Rejection
            </button>
          </div>
        }
      >
        <div className="space-y-3 pt-2">
          <p className="text-[11px] text-[#71717A]">
            Provide formal reason for rejection (material already available, duplicate, budget limit):
          </p>
          <textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] focus:ring-1 focus:ring-rose-500 outline-none"
            placeholder="Material already available in central stock / Duplicate request..."
          />
        </div>
      </SideDrawer>`;

    content = content.substring(0, rejectStart) + newRejectBlock + content.substring(rejectEnd + '</div>\n          </div>\n        </div>\n      )}'.length);
    console.log('Successfully replaced reject modal with SideDrawer');
  } else {
    console.error('Could not find rejectEnd');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming RequisitionsTab.tsx');
