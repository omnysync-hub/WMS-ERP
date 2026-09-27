const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/procurement/RfqSourcingTab.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Import SearchableSelect
if (!content.includes('import SearchableSelect from "@/components/ui/SearchableSelect";')) {
  content = content.replace(
    'import SideDrawer from "@/components/ui/SideDrawer";',
    'import SideDrawer from "@/components/ui/SideDrawer";\nimport SearchableSelect from "@/components/ui/SearchableSelect";'
  );
}

// 2. showQuoteModal -> SideDrawer
const quoteStart = content.indexOf('{/* Enter / Submit Vendor Quotation Modal */}');
if (quoteStart !== -1) {
  const quoteEnd = content.indexOf('</div>\n  );\n}', quoteStart);
  if (quoteEnd !== -1) {
    const oldQuoteBlock = content.substring(quoteStart, quoteEnd);
    
    // Replace payment terms select
    const oldTermsSelect = `<select
                    value={quotePaymentTerms}
                    onChange={(e) => setQuotePaymentTerms(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Advance">100% Advance</option>
                    <option value="Immediate">Immediate Cash</option>
                  </select>`;

    const newTermsSelect = `<SearchableSelect
                    value={quotePaymentTerms}
                    onChange={(val) => setQuotePaymentTerms(val)}
                    options={[
                      { value: "Net 30", label: "Net 30 Days" },
                      { value: "Net 45", label: "Net 45 Days" },
                      { value: "Net 15", label: "Net 15 Days" },
                      { value: "Advance", label: "100% Advance" },
                      { value: "Immediate", label: "Immediate Cash" },
                    ]}
                  />`;

    let transformedQuote = oldQuoteBlock;
    if (transformedQuote.includes(oldTermsSelect)) {
      transformedQuote = transformedQuote.replace(oldTermsSelect, newTermsSelect);
    }

    // Extract form body
    const bodyStart = transformedQuote.indexOf('<form onSubmit={handleSubmitQuote}');
    const bodyEnd = transformedQuote.lastIndexOf('</form>');
    const innerForm = transformedQuote.substring(bodyStart + '<form onSubmit={handleSubmitQuote} className="space-y-3.5">'.length, bodyEnd);
    const actionsIdx = innerForm.indexOf('<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EDEDED]">');
    const cleanedInner = actionsIdx !== -1 ? innerForm.substring(0, actionsIdx) : innerForm;

    const newQuoteDrawer = `{/* Enter / Submit Vendor Quotation SideDrawer */}
      <SideDrawer
        isOpen={Boolean(showQuoteModal && quotingVendor && selectedRfq)}
        onClose={() => setShowQuoteModal(false)}
        title={
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
            <span className="font-bold text-[#18181B] text-sm">
              Enter Quotation for {quotingVendor?.vendor?.name}
            </span>
          </div>
        }
        subtitle={selectedRfq ? \`RFQ: \${selectedRfq.rfqNumber} • \${selectedRfq.title}\` : ""}
        width="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowQuoteModal(false)}
              className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="submit-quote-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
            >
              {isSubmitting ? "Saving Quote..." : "Record Quotation"}
            </button>
          </div>
        }
      >
        {quotingVendor && selectedRfq && (
          <form id="submit-quote-form" onSubmit={handleSubmitQuote} className="space-y-3.5 pb-8 text-[#18181B]">
            ${cleanedInner}
          </form>
        )}
      </SideDrawer>
    </div>
  );
}`;

    content = content.substring(0, quoteStart) + newQuoteDrawer;
    console.log('Replaced showQuoteModal with SideDrawer in RfqSourcingTab');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done transforming RfqSourcingTab.tsx');
