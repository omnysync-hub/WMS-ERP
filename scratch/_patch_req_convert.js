const fs = require("fs");
const path = "src/components/procurement/RequisitionsTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

// Add selected flag to poPricingItems aggregation
const oldAgg = `          aggregatedItems.push({
            prId: pr.id,
            prNumber: pr.prNumber,
            prItemId: it.id,
            productId: it.productId || undefined,
            itemCode: it.itemCode || it.product?.sku || undefined,
            description: it.description || it.product?.name || "Material Item",
            quantity: remainingQty,
            unit: it.unit || "unit",
            unitCost: it.product?.costPrice || 0,
          });`;

const newAgg = `          aggregatedItems.push({
            prId: pr.id,
            prNumber: pr.prNumber,
            prItemId: it.id,
            productId: it.productId || undefined,
            itemCode: it.itemCode || it.product?.sku || undefined,
            description: it.description || it.product?.name || "Material Item",
            quantity: remainingQty,
            unit: it.unit || "unit",
            unitCost: it.product?.costPrice || 0,
            selected: true,
          });`;

if (!s.includes("selected: true")) {
  if (!s.includes(oldAgg)) {
    console.error("agg block not found");
    process.exit(1);
  }
  s = s.replace(oldAgg, newAgg);
  console.log("poPricingItems selected flag added");
}

// Update submit to only send selected items
const oldItemsMap = `          items: poPricingItems.map((pi) => ({
            productId: pi.productId,
            itemCode: pi.itemCode,
            description: pi.description,
            quantity: pi.quantity,
            unit: pi.unit,
            unitCost: Number(pi.unitCost) || 0,
            prItemId: pi.prItemId,
          })),`;

const newItemsMap = `          items: poPricingItems
            .filter((pi) => pi.selected !== false)
            .map((pi) => ({
            productId: pi.productId,
            itemCode: pi.itemCode,
            description: pi.description,
            quantity: pi.quantity,
            unit: pi.unit,
            unitCost: Number(pi.unitCost) || 0,
            prItemId: pi.prItemId,
          })),`;

if (!s.includes("filter((pi) => pi.selected !== false)")) {
  if (!s.includes(oldItemsMap)) {
    console.error("items map not found");
    process.exit(1);
  }
  s = s.replace(oldItemsMap, newItemsMap);
  console.log("convert submit filters selected items");
}

// Update subtotal calc
s = s.replace(
  `const calculatedPoSubtotal = poPricingItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
    0
  );`,
  `const calculatedPoSubtotal = poPricingItems
    .filter((it) => it.selected !== false)
    .reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
    0
  );`
);

// Add toggle helper after handlePoItemPriceChange
if (!s.includes("togglePoPricingItem")) {
  const anchor = `  const handlePoItemPriceChange = (index: number, cost: number) => {
    const updated = [...poPricingItems];
    updated[index].unitCost = cost;
    setPoPricingItems(updated);
  };`;
  const withToggle = `  const handlePoItemPriceChange = (index: number, cost: number) => {
    const updated = [...poPricingItems];
    updated[index].unitCost = cost;
    setPoPricingItems(updated);
  };

  const togglePoPricingItem = (index: number) => {
    const updated = [...poPricingItems];
    updated[index] = { ...updated[index], selected: updated[index].selected === false };
    // selected === false means unchecked; default/undefined/true means checked
    if (updated[index].selected === false) {
      /* already false */
    } else {
      updated[index].selected = true;
    }
    // Fix: flip properly
    const cur = poPricingItems[index].selected !== false;
    updated[index] = { ...poPricingItems[index], selected: !cur };
    setPoPricingItems(updated);
  };

  const handlePoItemQtyChange = (index: number, qty: number) => {
    const updated = [...poPricingItems];
    updated[index] = { ...updated[index], quantity: Math.max(0, qty) };
    setPoPricingItems(updated);
  };`;
  if (!s.includes(anchor)) {
    console.error("price change handler not found");
    process.exit(1);
  }
  s = s.replace(anchor, withToggle);
  console.log("toggle helpers added");
}

// Patch convert modal table to include checkbox - find the pricing table header
if (!s.includes("Include line") && s.includes("poPricingItems.map")) {
  // Find convert modal items section - look for Unit Cost header near poPricingItems
  const marker = "Unit Cost";
  // Add a note near convert modal - search for setPoPricingItems usage in JSX
}

// Inject checkbox column into convert modal - find tbody mapping poPricingItems
const tbodyRe = /\{poPricingItems\.map\(\(pi,\s*idx\)\s*=>\s*\([\s\S]*?<\/tr>\s*\)\)\}/;
const m = s.match(tbodyRe);
if (m && !s.includes("togglePoPricingItem(idx)")) {
  // Simpler: prepend checkbox cell after each <tr key in map - use string replace on a unique snippet
  console.log("Found poPricingItems map, length", m[0].length);
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("RequisitionsTab partial patch done");
