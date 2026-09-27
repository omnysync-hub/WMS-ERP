const fs = require("fs");
const path = "src/components/procurement/RfqSourcingTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

// Replace single selectedPrId state with multi + item keys
const oldState = `  const [selectedPrId, setSelectedPrId] = useState<string>(initialPrForRfq?.id || "");
  const [invitedVendorIds, setInvitedVendorIds] = useState<string[]>([]);
  const [rfqItems, setRfqItems] = useState<
    {
      productId?: string;
      itemCode?: string;
      description: string;
      quantity: number;
      unit: string;
      targetPrice?: number;
    }[]
  >(
    initialPrForRfq?.items
      ? initialPrForRfq.items.map((it: any) => ({
          productId: it.productId || undefined,
          itemCode: it.itemCode || it.product?.sku,
          description: it.description || it.product?.name,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.estimatedPrice,
        }))
      : [
          {
            description: "1.5 Ton Inverter Rotary Compressors",
            quantity: 10,
            unit: "pcs",
            targetPrice: 32000,
          },
        ]
  );`;

const newState = `  const [selectedPrIds, setSelectedPrIds] = useState<string[]>(
    initialPrForRfq?.id ? [initialPrForRfq.id] : []
  );
  /** Keys: \`\${prId}::\${itemId}\` for line-level selection across PRs */
  const [selectedPrItemKeys, setSelectedPrItemKeys] = useState<string[]>(() => {
    if (!initialPrForRfq?.items?.length) return [];
    return initialPrForRfq.items.map((it: any) => \`\${initialPrForRfq.id}::\${it.id}\`);
  });
  const [invitedVendorIds, setInvitedVendorIds] = useState<string[]>([]);
  const [rfqItems, setRfqItems] = useState<
    {
      productId?: string;
      itemCode?: string;
      description: string;
      quantity: number;
      unit: string;
      targetPrice?: number;
      prItemId?: string;
      prId?: string;
      prNumber?: string;
    }[]
  >(
    initialPrForRfq?.items
      ? initialPrForRfq.items.map((it: any) => ({
          productId: it.productId || undefined,
          itemCode: it.itemCode || it.product?.sku,
          description: it.description || it.product?.name,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.estimatedPrice,
          prItemId: it.id,
          prId: initialPrForRfq.id,
          prNumber: initialPrForRfq.prNumber,
        }))
      : [
          {
            description: "1.5 Ton Inverter Rotary Compressors",
            quantity: 10,
            unit: "pcs",
            targetPrice: 32000,
          },
        ]
  );`;

if (!s.includes("selectedPrItemKeys")) {
  if (!s.includes(oldState)) {
    console.error("RFQ state block not found");
    process.exit(1);
  }
  s = s.replace(oldState, newState);
  console.log("RFQ state updated");
}

const oldHandler = `  // When a PR is selected in Create RFQ
  const handlePrSelect = (prId: string) => {
    setSelectedPrId(prId);
    const pr = prs.find((p) => p.id === prId);
    if (pr && pr.items?.length > 0) {
      setTitle(\`Competitive Sourcing for \${pr.prNumber} (\${pr.department})\`);
      setRfqItems(
        pr.items.map((it: any) => ({
          productId: it.productId || undefined,
          itemCode: it.itemCode || it.product?.sku,
          description: it.description || it.product?.name,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.estimatedPrice,
        }))
      );
    }
  };`;

const newHandler = `  const eligiblePrs = prs.filter(
    (p) => p.status === "approved" || p.status === "submitted" || p.status === "partially_converted"
  );

  const rebuildRfqItemsFromSelection = (prIds: string[], itemKeys: string[]) => {
    const items: typeof rfqItems = [];
    for (const prId of prIds) {
      const pr = prs.find((p) => p.id === prId);
      if (!pr) continue;
      for (const it of pr.items || []) {
        const key = \`\${prId}::\${it.id}\`;
        if (itemKeys.length > 0 && !itemKeys.includes(key)) continue;
        items.push({
          productId: it.productId || undefined,
          itemCode: it.itemCode || it.product?.sku,
          description: it.description || it.product?.name,
          quantity: it.quantity,
          unit: it.unit,
          targetPrice: it.estimatedPrice,
          prItemId: it.id,
          prId: pr.id,
          prNumber: pr.prNumber,
        });
      }
    }
    setRfqItems(
      items.length > 0
        ? items
        : [
            {
              description: "1.5 Ton Inverter Rotary Compressors",
              quantity: 10,
              unit: "pcs",
              targetPrice: 32000,
            },
          ]
    );
    if (prIds.length === 1) {
      const pr = prs.find((p) => p.id === prIds[0]);
      if (pr) setTitle(\`Competitive Sourcing for \${pr.prNumber} (\${pr.department || "Ops"})\`);
    } else if (prIds.length > 1) {
      setTitle(\`Competitive Sourcing for \${prIds.length} Purchase Requisitions\`);
    }
  };

  const togglePrForRfq = (prId: string) => {
    const pr = prs.find((p) => p.id === prId);
    setSelectedPrIds((prev) => {
      const next = prev.includes(prId) ? prev.filter((id) => id !== prId) : [...prev, prId];
      setSelectedPrItemKeys((keys) => {
        let nextKeys = keys.filter((k) => !k.startsWith(prId + "::"));
        if (!prev.includes(prId) && pr?.items?.length) {
          nextKeys = [...nextKeys, ...pr.items.map((it: any) => \`\${prId}::\${it.id}\`)];
        }
        rebuildRfqItemsFromSelection(next, nextKeys);
        return nextKeys;
      });
      return next;
    });
  };

  const togglePrItemForRfq = (prId: string, itemId: string) => {
    const key = \`\${prId}::\${itemId}\`;
    setSelectedPrItemKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      // Ensure parent PR is selected when any item is checked
      setSelectedPrIds((prIds) => {
        let nextPrIds = prIds;
        if (next.some((k) => k.startsWith(prId + "::")) && !prIds.includes(prId)) {
          nextPrIds = [...prIds, prId];
        }
        if (!next.some((k) => k.startsWith(prId + "::")) && prIds.includes(prId)) {
          nextPrIds = prIds.filter((id) => id !== prId);
        }
        rebuildRfqItemsFromSelection(nextPrIds, next);
        return nextPrIds;
      });
      return next;
    });
  };`;

if (!s.includes("rebuildRfqItemsFromSelection")) {
  if (!s.includes(oldHandler)) {
    console.error("handlePrSelect not found");
    process.exit(1);
  }
  s = s.replace(oldHandler, newHandler);
  console.log("RFQ handlers updated");
}

// Update create payload
s = s.replace(
  "prIds: selectedPrId ? [selectedPrId] : [],",
  "prIds: selectedPrIds,"
);

// Replace PR select UI block
const oldUi = `              {/* Source PR Selection */}
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Pull Items from Approved Purchase Requisition (Optional)
                </label>
                <select
                  value={selectedPrId}
                  onChange={(e) => handlePrSelect(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                >
                  <option value="">-- Standalone Bidding Package --</option>
                  {prs
                    .filter((p) => p.status === "approved" || p.status === "submitted")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prNumber} — {p.department} ({p.items?.length} items) - Est: {formatCurrency(
                          p.items.reduce((s: number, i: any) => s + i.quantity * i.estimatedPrice, 0)
                        )}
                      </option>
                    ))}
                </select>
              </div>`;

// The em dash might be special chars - try flexible replace via regex
if (!s.includes("Pull Items from Approved Purchase Requisition")) {
  console.error("PR select UI label not found");
} else if (!s.includes("Select multiple PRs")) {
  const start = s.indexOf("              {/* Source PR Selection */}");
  const end = s.indexOf("              <div className=\"grid grid-cols-1 sm:grid-cols-3 gap-3\">", start);
  if (start < 0 || end < 0) {
    console.error("Could not locate PR selection UI bounds", start, end);
    process.exit(1);
  }
  const newUi = `              {/* Source PR Selection — multi PR + line items */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono text-[#71717A]">
                  Pull from Purchase Requisitions (select multiple PRs or individual line items)
                </label>
                <div className="border border-[#EDEDED] rounded-xl max-h-56 overflow-y-auto divide-y divide-[#EDEDED] bg-[#F8FAFC]">
                  {eligiblePrs.length === 0 ? (
                    <p className="text-[11px] text-[#A1A1AA] p-3 text-center">No approved/submitted PRs available.</p>
                  ) : (
                    eligiblePrs.map((p) => {
                      const prChecked = selectedPrIds.includes(p.id);
                      return (
                        <div key={p.id} className="p-2.5 bg-white">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prChecked}
                              onChange={() => togglePrForRfq(p.id)}
                              className="accent-[#0D7A5F]"
                            />
                            <span className="font-semibold text-[#18181B] text-xs">{p.prNumber}</span>
                            <span className="text-[10px] text-[#71717A]">
                              {p.department} · {p.items?.length || 0} items · Est{" "}
                              {formatCurrency(
                                (p.items || []).reduce(
                                  (sum: number, i: any) => sum + i.quantity * (i.estimatedPrice || 0),
                                  0
                                )
                              )}
                            </span>
                          </label>
                          {prChecked && (
                            <div className="mt-2 ml-6 space-y-1">
                              {(p.items || []).map((it: any) => {
                                const key = \`\${p.id}::\${it.id}\`;
                                const checked = selectedPrItemKeys.includes(key);
                                return (
                                  <label
                                    key={it.id}
                                    className="flex items-center gap-2 text-[11px] cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePrItemForRfq(p.id, it.id)}
                                      className="accent-[#0D7A5F]"
                                    />
                                    <span className="text-[#18181B] flex-1">
                                      {it.description || it.product?.name || "Item"}
                                    </span>
                                    <span className="font-mono text-[#71717A]">
                                      {it.quantity} {it.unit}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-[10px] text-[#A1A1AA]">
                  Leave unchecked for a standalone bidding package, or mix lines across PRs.
                </p>
              </div>

`;
  s = s.slice(0, start) + newUi + s.slice(end);
  console.log("RFQ PR multi-select UI replaced");
}

// Sticky header on list controls - find controls bar
if (!s.includes("sticky top-0 z-20") && s.includes("Controls Bar") === false) {
  // add sticky to first controls flex container after return
}
s = s.replace(
  '<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">',
  '<div className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">'
);

// Line items table show PR source
if (s.includes("{it.description}") && !s.includes("it.prNumber")) {
  s = s.replace(
    `<td className="py-2 px-3 font-medium text-[#18181B]">
                            {it.description}
                          </td>`,
    `<td className="py-2 px-3 font-medium text-[#18181B]">
                            {it.description}
                            {it.prNumber && (
                              <span className="block text-[10px] font-mono text-[#A1A1AA] mt-0.5">
                                from {it.prNumber}
                              </span>
                            )}
                          </td>`
  );
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("RfqSourcingTab patched");
