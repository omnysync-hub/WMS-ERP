const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/VendorsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Imports
if (!content.includes('import SideDrawer from "@/components/ui/SideDrawer";')) {
  content = content.replace(
    'import { formatCurrency, formatDateTime, cn } from "@/lib/utils";',
    'import { formatCurrency, formatDateTime, cn } from "@/lib/utils";\nimport SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. Filters
const oldFilters = `          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Blocked">Blocked</option>
            <option value="Blacklisted">Blacklisted</option>
          </select>`;

const newFilters = `          <div className="w-48">
            <SearchableSelect
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={[
                { value: "all", label: "All Categories" },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
              placeholder="Category..."
            />
          </div>

          <div className="w-40">
            <SearchableSelect
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "Active", label: "Active" },
                { value: "Blocked", label: "Blocked" },
                { value: "Blacklisted", label: "Blacklisted" },
              ]}
              placeholder="Status..."
            />
          </div>`;

if (content.includes(oldFilters)) {
  content = content.replace(oldFilters, newFilters);
  console.log('Replaced filters in VendorsTab');
}

// 3. showModal -> SideDrawer
const modalStart = content.indexOf('{/* Add / Edit Vendor Modal */}');
if (modalStart !== -1) {
  const modalEnd = content.indexOf('</div>\n  );\n}', modalStart);
  if (modalEnd !== -1) {
    const oldModalBlock = content.substring(modalStart, modalEnd);

    // Replace selects inside
    const oldCatSelect = `<select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>`;

    const newCatSelect = `<SearchableSelect
                    value={category}
                    onChange={(val) => setCategory(val)}
                    options={categories.map((c) => ({ value: c, label: c }))}
                  />`;

    const oldStatusSelect = `<select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Blacklisted">Blacklisted</option>
                  </select>`;

    const newStatusSelect = `<SearchableSelect
                    value={status}
                    onChange={(val) => setStatus(val)}
                    options={[
                      { value: "Active", label: "Active" },
                      { value: "Blocked", label: "Blocked" },
                      { value: "Blacklisted", label: "Blacklisted" },
                    ]}
                  />`;

    const oldTermsSelect = `<select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Immediate">Immediate / Cash</option>
                    <option value="Advance">100% Advance</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>`;

    const newTermsSelect = `<SearchableSelect
                    value={paymentTerms}
                    onChange={(val) => setPaymentTerms(val)}
                    options={[
                      { value: "Immediate", label: "Immediate / Cash" },
                      { value: "Advance", label: "100% Advance" },
                      { value: "Net 15", label: "Net 15 Days" },
                      { value: "Net 30", label: "Net 30 Days" },
                      { value: "Net 45", label: "Net 45 Days" },
                      { value: "Net 60", label: "Net 60 Days" },
                    ]}
                  />`;

    let transformed = oldModalBlock;
    if (transformed.includes(oldCatSelect)) transformed = transformed.replace(oldCatSelect, newCatSelect);
    if (transformed.includes(oldStatusSelect)) transformed = transformed.replace(oldStatusSelect, newStatusSelect);
    if (transformed.includes(oldTermsSelect)) transformed = transformed.replace(oldTermsSelect, newTermsSelect);

    const bodyStart = transformed.indexOf('<form onSubmit={handleSubmit}');
    const bodyEnd = transformed.lastIndexOf('</form>');
    const innerForm = transformed.substring(bodyStart + '<form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">'.length, bodyEnd);
    const actionsIdx = innerForm.indexOf('{/* Action Buttons */}');
    const cleanedInner = actionsIdx !== -1 ? innerForm.substring(0, actionsIdx) : innerForm;

    const newVendorDrawer = `{/* Add / Edit Vendor SideDrawer */}
      <SideDrawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              {editingVendor ? "Edit Vendor Master" : "Register New Vendor Master"}
            </span>
          </div>
        }
        subtitle="FBR Tax Credentials, Bank Accounts & Commercial Credit Terms"
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="vendor-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : editingVendor
                ? "Update Vendor"
                : "Save Vendor Master"}
            </button>
          </div>
        }
      >
        <form id="vendor-form" onSubmit={handleSubmit} className="space-y-4 pb-8 text-[#18181B]">
          ${cleanedInner}
        </form>
      </SideDrawer>
    </div>
  );
}`;

    content = content.substring(0, modalStart) + newVendorDrawer;
    console.log('Replaced showModal with SideDrawer in VendorsTab');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming VendorsTab.tsx');
