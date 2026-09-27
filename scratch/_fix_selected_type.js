const fs = require("fs");
const path = "src/components/procurement/RequisitionsTab.tsx";
let s = fs.readFileSync(path, "utf8");
const old = `  const [poPricingItems, setPoPricingItems] = useState<
    {
      prId: string;
      prNumber: string;
      prItemId: string;
      productId?: string;
      itemCode?: string;
      description: string;
      quantity: number;
      unit: string;
      unitCost: number;
    }[]
  >([]);`;
const neu = `  const [poPricingItems, setPoPricingItems] = useState<
    {
      prId: string;
      prNumber: string;
      prItemId: string;
      productId?: string;
      itemCode?: string;
      description: string;
      quantity: number;
      unit: string;
      unitCost: number;
      selected?: boolean;
    }[]
  >([]);`;
const norm = s.replace(/\r\n/g, "\n");
if (!norm.includes("selected?: boolean")) {
  if (!norm.includes(old.replace(/\r\n/g,"\n"))) {
    console.error("type block not found");
    const idx = norm.indexOf("poPricingItems, setPoPricingItems");
    console.log(JSON.stringify(norm.slice(idx, idx+350)));
    process.exit(1);
  }
  s = norm.replace(old.replace(/\r\n/g,"\n"), neu);
  if (s.includes("\r")) {} // keep lf
  fs.writeFileSync(path, s);
  console.log("type updated");
} else console.log("already has selected?");
