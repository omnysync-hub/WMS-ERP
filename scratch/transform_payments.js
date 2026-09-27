const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/PaymentsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Imports
if (!content.includes('import SideDrawer from "@/components/ui/SideDrawer";')) {
  content = content.replace(
    'import { formatCurrency, formatDateTime, cn } from "@/lib/utils";',
    'import { formatCurrency, formatDateTime, cn } from "@/lib/utils";\nimport SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. Filter
const oldFilter = `          <select
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
            className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            <option value="all">All Payment Statuses</option>
            <option value="unpaid">Awaiting Disbursement (Unpaid)</option>
            <option value="paid">Settled / Fully Paid</option>
          </select>`;

const newFilter = `          <div className="w-56">
            <SearchableSelect
              value={filterPaymentStatus}
              onChange={(val) => setFilterPaymentStatus(val)}
              options={[
                { value: "all", label: "All Payment Statuses" },
                { value: "unpaid", label: "Awaiting Disbursement (Unpaid)" },
                { value: "paid", label: "Settled / Fully Paid" },
              ]}
              placeholder="Status..."
            />
          </div>`;

if (content.includes(oldFilter)) {
  content = content.replace(oldFilter, newFilter);
  console.log('Replaced filterPaymentStatus in PaymentsTab');
}

// 3. showPayModal -> SideDrawer
const payStart = content.indexOf('{/* Disburse Payment Modal */}');
if (payStart !== -1) {
  const payEnd = content.indexOf('</div>\n  );\n}', payStart);
  if (payEnd !== -1) {
    const oldBlock = content.substring(payStart, payEnd);

    // Replace bankAccountId
    const oldBankSelect = `<select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="1010">1010 - Operating Bank Account (Meezan Bank)</option>
                    <option value="1011">1011 - Commercial Account (HBL)</option>
                    <option value="1000">1000 - Main Cash Drawer</option>
                  </select>`;

    const newBankSelect = `<SearchableSelect
                    value={bankAccountId}
                    onChange={(val) => setBankAccountId(val)}
                    options={[
                      { value: "1010", label: "1010 - Operating Bank Account (Meezan Bank)" },
                      { value: "1011", label: "1011 - Commercial Account (HBL)" },
                      { value: "1000", label: "1000 - Main Cash Drawer" },
                    ]}
                  />`;

    // Replace paymentMethod
    const oldMethodSelect = `<select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="bank_transfer">Online Bank Transfer / RTGS</option>
                    <option value="cheque">Crossed Corporate Cheque</option>
                    <option value="cash">Cash Voucher</option>
                  </select>`;

    const newMethodSelect = `<SearchableSelect
                    value={paymentMethod}
                    onChange={(val) => setPaymentMethod(val as any)}
                    options={[
                      { value: "bank_transfer", label: "Online Bank Transfer / RTGS" },
                      { value: "cheque", label: "Crossed Corporate Cheque" },
                      { value: "cash", label: "Cash Voucher" },
                    ]}
                  />`;

    let transformed = oldBlock;
    if (transformed.includes(oldBankSelect)) transformed = transformed.replace(oldBankSelect, newBankSelect);
    if (transformed.includes(oldMethodSelect)) transformed = transformed.replace(oldMethodSelect, newMethodSelect);

    const bodyStart = transformed.indexOf('<form onSubmit={handleRecordPayment}');
    const bodyEnd = transformed.lastIndexOf('</form>');
    const innerForm = transformed.substring(bodyStart + '<form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">'.length, bodyEnd);
    const actionsIdx = innerForm.indexOf('<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">');
    const cleanedInner = actionsIdx !== -1 ? innerForm.substring(0, actionsIdx) : innerForm;

    const newPayDrawer = `{/* Disburse Payment SideDrawer */}
      <SideDrawer
        isOpen={Boolean(showPayModal && selectedInvoice)}
        onClose={() => setShowPayModal(false)}
        title={
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Disburse Payment to {selectedInvoice?.vendor?.name}
            </span>
          </div>
        }
        subtitle={selectedInvoice ? \`Invoice \${selectedInvoice.invoiceNumber} • Gross: \${formatCurrency(selectedInvoice.totalAmount)}\` : ""}
        width="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowPayModal(false)}
              className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-zinc-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="disburse-payment-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
            >
              {isSubmitting ? "Disbursing..." : "Confirm & Post Payment"}
            </button>
          </div>
        }
      >
        {selectedInvoice && (
          <form id="disburse-payment-form" onSubmit={handleRecordPayment} className="space-y-4 pb-8 text-xs text-[#18181B]">
            ${cleanedInner}
          </form>
        )}
      </SideDrawer>
    </div>
  );
}`;

    content = content.substring(0, payStart) + newPayDrawer;
    console.log('Replaced showPayModal with SideDrawer in PaymentsTab');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming PaymentsTab.tsx');
