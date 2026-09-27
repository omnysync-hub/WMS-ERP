const fs = require("fs");

// --- page.tsx: pass prs to PurchaseOrdersTab ---
{
  const path = "src/app/procurement/page.tsx";
  let s = fs.readFileSync(path, "utf8");
  const hadCRLF = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  const old = `<PurchaseOrdersTab
                pos={pos}
                vendors={vendors}
                products={products}
                onRefresh={loadAllData}
                onOpenGrnModal={handleOpenGrnModal}
                queueFilter={queueFilter}
              />`;
  const neu = `<PurchaseOrdersTab
                pos={pos}
                vendors={vendors}
                products={products}
                prs={prs}
                onRefresh={loadAllData}
                onOpenGrnModal={handleOpenGrnModal}
                queueFilter={queueFilter}
              />`;
  if (!s.includes("prs={prs}")) {
    if (!s.includes(old)) { console.error("PO tab JSX not found"); process.exit(1); }
    s = s.replace(old, neu);
    console.log("page.tsx passes prs");
  }
  // Quieter secondary tab badges - find metric chips rendering if any loud badges
  // Soften pipeline secondary counts if present as bg-emerald loud chips — leave pipeline as-is; soften page chip tones used for secondary
  if (hadCRLF) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
}

// --- PurchaseOrdersTab: add prs + from-PR create path ---
{
  const path = "src/components/procurement/PurchaseOrdersTab.tsx";
  let s = fs.readFileSync(path, "utf8");
  const hadCRLF = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  s = s.replace(
    `interface PurchaseOrdersTabProps {
  pos: any[];
  vendors: any[];
  products: any[];
  onRefresh: () => void;
  onOpenGrnModal?: (po: any) => void;
  queueFilter?: string | null;
}

export default function PurchaseOrdersTab({
  pos,
  vendors,
  products,
  onRefresh,
  onOpenGrnModal,
  queueFilter = null,
}: PurchaseOrdersTabProps) {`,
    `interface PurchaseOrdersTabProps {
  pos: any[];
  vendors: any[];
  products: any[];
  prs?: any[];
  onRefresh: () => void;
  onOpenGrnModal?: (po: any) => void;
  queueFilter?: string | null;
}

export default function PurchaseOrdersTab({
  pos,
  vendors,
  products,
  prs = [],
  onRefresh,
  onOpenGrnModal,
  queueFilter = null,
}: PurchaseOrdersTabProps) {`
  );

  // Add source mode state after showCreateModal
  if (!s.includes("poSourceMode")) {
    s = s.replace(
      `  const [showCreateModal, setShowCreateModal] = useState(false);
  const [poType, setPoType] = useState<"standard" | "blanket" | "service">("standard");`,
      `  const [showCreateModal, setShowCreateModal] = useState(false);
  const [poSourceMode, setPoSourceMode] = useState<"blank" | "from_pr">("blank");
  const [selectedPrIdsForPo, setSelectedPrIdsForPo] = useState<string[]>([]);
  const [selectedPrItemKeysForPo, setSelectedPrItemKeysForPo] = useState<string[]>([]);
  const [poType, setPoType] = useState<"standard" | "blanket" | "service">("standard");`
    );
    console.log("PO source mode state added");
  }

  // Helpers before handleCreatePo
  if (!s.includes("syncItemsFromSelectedPrs")) {
    const anchor = `  const handleCreatePo = async (e: React.FormEvent) => {`;
    const helpers = `
  const eligiblePrsForPo = (prs || []).filter(
    (p) => p.status === "approved" || p.status === "partially_converted"
  );

  const syncItemsFromSelectedPrs = (prIds: string[], itemKeys: string[]) => {
    const next: typeof items = [];
    for (const prId of prIds) {
      const pr = eligiblePrsForPo.find((p) => p.id === prId);
      if (!pr) continue;
      for (const it of pr.items || []) {
        const key = \`\${prId}::\${it.id}\`;
        if (itemKeys.length && !itemKeys.includes(key)) continue;
        const remaining = Math.max(0, it.quantity - (it.convertedQuantity || 0));
        if (remaining <= 0) continue;
        next.push({
          productId: it.productId || "",
          itemCode: it.itemCode || it.product?.sku || "",
          description: it.description || it.product?.name || "",
          quantity: remaining,
          unitCost: it.estimatedPrice || it.product?.costPrice || 0,
          unit: it.unit || "unit",
          discountPercent: 0,
          taxPercent: 0,
          deliverySchedule: "Immediate Single Lot",
          prItemId: it.id,
        } as any);
      }
    }
    setItems(
      next.length
        ? next
        : [
            {
              productId: "",
              itemCode: "",
              description: "",
              quantity: 10,
              unitCost: 0,
              unit: "pcs",
              discountPercent: 0,
              taxPercent: 0,
              deliverySchedule: "Immediate Single Lot",
            },
          ]
    );
  };

  const togglePrForPo = (prId: string) => {
    const pr = eligiblePrsForPo.find((p) => p.id === prId);
    setSelectedPrIdsForPo((prev) => {
      const next = prev.includes(prId) ? prev.filter((id) => id !== prId) : [...prev, prId];
      setSelectedPrItemKeysForPo((keys) => {
        let nextKeys = keys.filter((k) => !k.startsWith(prId + "::"));
        if (!prev.includes(prId) && pr?.items) {
          nextKeys = [
            ...nextKeys,
            ...pr.items
              .filter((it: any) => Math.max(0, it.quantity - (it.convertedQuantity || 0)) > 0)
              .map((it: any) => \`\${prId}::\${it.id}\`),
          ];
        }
        syncItemsFromSelectedPrs(next, nextKeys);
        return nextKeys;
      });
      return next;
    });
  };

  const togglePrItemForPo = (prId: string, itemId: string) => {
    const key = \`\${prId}::\${itemId}\`;
    setSelectedPrItemKeysForPo((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      setSelectedPrIdsForPo((prIds) => {
        let nextPrIds = prIds;
        if (next.some((k) => k.startsWith(prId + "::")) && !prIds.includes(prId)) {
          nextPrIds = [...prIds, prId];
        }
        if (!next.some((k) => k.startsWith(prId + "::"))) {
          nextPrIds = prIds.filter((id) => id !== prId);
        }
        syncItemsFromSelectedPrs(nextPrIds, next);
        return nextPrIds;
      });
      return next;
    });
  };

  const handleCreatePo = async (e: React.FormEvent) => {`;
    if (!s.includes(anchor)) { console.error("handleCreatePo not found"); process.exit(1); }
    s = s.replace(anchor, helpers);
    console.log("PO from-PR helpers added");
  }

  // Change create handler to use convert_pr_to_po when from_pr
  const oldCreateBody = `        body: JSON.stringify({
          action: "create_po",
          poType,
          vendorId,
          supplierName: selectedVendor?.name,
          supplierEmail: selectedVendor?.email || "orders@vendor.pk",
          expectedDeliveryDate,
          paymentTerms,
          shippingAddress,
          termsAndConditions,
          items,
        }),`;

  const newCreateBody = `        body: JSON.stringify(
          poSourceMode === "from_pr" && selectedPrIdsForPo.length > 0
            ? {
                action: "convert_pr_to_po",
                prIds: selectedPrIdsForPo,
                vendorId,
                poType,
                expectedDeliveryDate,
                items: items.map((it: any) => ({
                  productId: it.productId || undefined,
                  itemCode: it.itemCode,
                  description: it.description,
                  quantity: it.quantity,
                  unit: it.unit,
                  unitCost: Number(it.unitCost) || 0,
                  discountPercent: it.discountPercent,
                  taxPercent: it.taxPercent,
                  deliverySchedule: it.deliverySchedule,
                  prItemId: it.prItemId,
                })),
              }
            : {
                action: "create_po",
                poType,
                vendorId,
                supplierName: selectedVendor?.name,
                supplierEmail: selectedVendor?.email || "orders@vendor.pk",
                expectedDeliveryDate,
                paymentTerms,
                shippingAddress,
                termsAndConditions,
                items,
              }
        ),`;

  if (!s.includes('action: "convert_pr_to_po"')) {
    if (!s.includes(oldCreateBody)) { console.error("create body not found"); process.exit(1); }
    s = s.replace(oldCreateBody, newCreateBody);
    console.log("create PO body supports from_pr");
  }

  // Inject source mode UI into create modal - after formError block or at start of form
  if (!s.includes("PO source") && s.includes("Issue Purchase Order (PO)")) {
    const marker = `            <form onSubmit={handleCreatePo} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">`;
    // find form - might differ
  }

  // Locate create form
  const formIdx = s.indexOf("handleCreatePo");
  // Find the modal form for create - search for setShowCreateModal(false) near Issue Purchase
  const issueIdx = s.indexOf("Issue Purchase Order (PO)");
  if (issueIdx > 0 && !s.includes("Create from Purchase Requisition(s)")) {
    // Find form after issue title
    const formStart = s.indexOf("<form onSubmit={handleCreatePo}", issueIdx);
    if (formStart < 0) {
      console.log("create form not found after Issue title — searching alt");
    } else {
      // Insert after opening form tag and any formError
      const insertAt = s.indexOf(">", formStart) + 1;
      const sourceUi = `
              <div className="space-y-2">
                <label className="block text-[11px] font-mono text-[#71717A]">PO source</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPoSourceMode("blank");
                      setSelectedPrIdsForPo([]);
                      setSelectedPrItemKeysForPo([]);
                    }}
                    className={\`px-3 py-1.5 rounded-lg text-xs border \${
                      poSourceMode === "blank"
                        ? "bg-[#0D7A5F] text-white border-[#0D7A5F]"
                        : "bg-white text-[#18181B] border-[#D4D4D8]"
                    }\`}
                  >
                    Blank / catalog lines
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoSourceMode("from_pr")}
                    className={\`px-3 py-1.5 rounded-lg text-xs border \${
                      poSourceMode === "from_pr"
                        ? "bg-[#0D7A5F] text-white border-[#0D7A5F]"
                        : "bg-white text-[#18181B] border-[#D4D4D8]"
                    }\`}
                  >
                    From Purchase Requisition(s)
                  </button>
                </div>
                {poSourceMode === "from_pr" && (
                  <div className="border border-[#EDEDED] rounded-xl max-h-48 overflow-y-auto divide-y divide-[#EDEDED] bg-[#F8FAFC]">
                    {eligiblePrsForPo.length === 0 ? (
                      <p className="p-3 text-[11px] text-[#A1A1AA] text-center">
                        No approved PRs with remaining quantity.
                      </p>
                    ) : (
                      eligiblePrsForPo.map((p) => {
                        const checked = selectedPrIdsForPo.includes(p.id);
                        return (
                          <div key={p.id} className="p-2.5 bg-white">
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePrForPo(p.id)}
                                className="accent-[#0D7A5F]"
                              />
                              <span className="font-semibold">{p.prNumber}</span>
                              <span className="text-[10px] text-[#71717A]">
                                {p.department} · remaining lines available
                              </span>
                            </label>
                            {checked && (
                              <div className="mt-1.5 ml-6 space-y-1">
                                {(p.items || []).map((it: any) => {
                                  const rem = Math.max(0, it.quantity - (it.convertedQuantity || 0));
                                  if (rem <= 0) return null;
                                  const key = \`\${p.id}::\${it.id}\`;
                                  return (
                                    <label key={it.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedPrItemKeysForPo.includes(key)}
                                        onChange={() => togglePrItemForPo(p.id, it.id)}
                                        className="accent-[#0D7A5F]"
                                      />
                                      <span className="flex-1">{it.description || it.product?.name}</span>
                                      <span className="font-mono text-[#71717A]">
                                        {rem} {it.unit}
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
                )}
              </div>
`;
      s = s.slice(0, insertAt) + sourceUi + s.slice(insertAt);
      console.log("PO source UI injected");
    }
  }

  if (hadCRLF) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
  console.log("PurchaseOrdersTab patched");
}
