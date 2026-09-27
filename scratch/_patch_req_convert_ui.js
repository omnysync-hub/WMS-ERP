const fs = require("fs");
const path = "src/components/procurement/RequisitionsTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

const oldTable = `              {/* Items Price Allocation Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Assign Agreed PO Unit Prices ({poPricingItems.length} items)
                </span>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Source PR</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right w-44">Agreed Unit Rate (PKR) *</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                      {poPricingItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
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
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={it.unitCost}
                              onChange={(e) =>
                                handlePoItemPriceChange(idx, Number(e.target.value))
                              }
                              placeholder="Unit price"
                              className="w-36 text-right bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs font-mono font-bold text-[#18181B] focus:border-[#0D7A5F] outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency((it.quantity || 0) * (it.unitCost || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>`;

const newTable = `              {/* Items Price Allocation Table — select which lines to include */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#18181B] block">
                  Select line items & assign PO unit prices (
                  {poPricingItems.filter((x) => x.selected !== false).length}/{poPricingItems.length} included)
                </span>
                <p className="text-[10px] text-[#71717A]">
                  Uncheck lines to leave them on the PR for a later PO. Adjust qty if only part of the remaining demand should convert now.
                </p>
                <div className="border border-[#EDEDED] rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                      <tr>
                        <th className="py-2.5 px-2 w-10">Incl.</th>
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
                            <span className="ml-1 text-[10px] text-[#71717A]">{it.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required={included}
                              disabled={!included}
                              value={it.unitCost}
                              onChange={(e) =>
                                handlePoItemPriceChange(idx, Number(e.target.value))
                              }
                              placeholder="Unit price"
                              className="w-36 text-right bg-white border border-[#D4D4D8] rounded px-2.5 py-1 text-xs font-mono font-bold text-[#18181B] focus:border-[#0D7A5F] outline-none disabled:bg-slate-100"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {included ? formatCurrency((it.quantity || 0) * (it.unitCost || 0)) : "—"}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>`;

if (!s.includes("Select line items & assign PO unit prices")) {
  if (!s.includes(oldTable)) {
    console.error("old table not found");
    // try to find why
    console.log("has Items Price Allocation:", s.includes("Items Price Allocation Table"));
    process.exit(1);
  }
  s = s.replace(oldTable, newTable);
  console.log("convert modal table updated with checkboxes");
}

s = s.replace(
  "Includes {poPricingItems.length} line items from {prsToConvert.length} PRs",
  "Includes {poPricingItems.filter((x) => x.selected !== false).length} line items from {prsToConvert.length} PRs"
);

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("done");
