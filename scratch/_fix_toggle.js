const fs = require("fs");
const path = "src/components/procurement/RequisitionsTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

const messy = `  const togglePoPricingItem = (index: number) => {
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
  };`;

const clean = `  const togglePoPricingItem = (index: number) => {
    const updated = [...poPricingItems];
    const cur = updated[index].selected !== false;
    updated[index] = { ...updated[index], selected: !cur };
    setPoPricingItems(updated);
  };`;

if (s.includes(messy)) {
  s = s.replace(messy, clean);
  console.log("cleaned togglePoPricingItem");
} else if (s.includes("togglePoPricingItem")) {
  console.log("toggle exists, messy block not exact — ok if already clean");
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
