const fs = require("fs");
const path = "src/components/procurement/GoodsReceiptTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

if (!s.includes("[presetPoForGrn?.id]")) {
  s = s.replace(
    `  const handleItemChange = (index: number, field: string, value: any) => {`,
    `  useEffect(() => {
    if (presetPoForGrn?.id) {
      setShowCreateModal(true);
      handlePoSelect(presetPoForGrn.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPoForGrn?.id]);

  const handleItemChange = (index: number, field: string, value: any) => {`
  );
  console.log("preset useEffect added");
}

// Improve option label to show remaining qty
s = s.replace(
  `{p.poNumber} — {p.supplierName} ({p.items?.length} items)}`,
  `{p.poNumber} — {p.supplierName} · remaining lines ready to receive}`
);
// encoding may differ
s = s.replace(
  /\{p\.poNumber\}[^<]*\{p\.items\?\.length\} items\)/,
  `{p.poNumber} — {p.supplierName} · {(p.items||[]).filter((it:any)=> (it.quantity-(it.quantityReceived||0))>0).length} lines remaining)`
);

// Label above select
s = s.replace(
  `-- Choose Purchase Order --`,
  `-- Pick open PO (remaining qty) --`
);

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("grn polish ok");
