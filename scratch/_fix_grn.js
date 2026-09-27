const fs = require("fs");
const path = "src/components/procurement/GoodsReceiptTab.tsx";
let s = fs.readFileSync(path, "utf8");
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

// Fix pos filter in select to openPosForReceipt
s = s.replace(
  `{pos
                      .filter((p) =>`,
  `{openPosForReceipt
                      .filter((p) =>`
);
// If already filtered list, maybe just map
s = s.replace(
  `{openPosForReceipt
                      .filter((p) =>
                        ["approved", "sent_to_vendor", "partially_received"].includes(p.status)
                      )
                      .map((p) => (`,
  `{openPosForReceipt.map((p) => (`
);

// Broader: find the select options block
const m = s.match(/\{openPosForReceipt[\s\S]{0,400}?\.map\(\(p\) =>/);
if (m) console.log("options block:", m[0].slice(0, 200));
else {
  const m2 = s.match(/value=\{selectedPoId\}[\s\S]{0,600}/);
  console.log("select area:", m2 ? m2[0].slice(0, 500) : "none");
}

// Remove broken useEffect if it references handlePoSelect before definition
const badUe = `  useEffect(() => {
    if (presetPoForGrn?.id) {
      setShowCreateModal(true);
      handlePoSelect(presetPoForGrn.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPoForGrn?.id]);
`;
if (s.includes(badUe)) {
  s = s.replace(badUe, "");
  console.log("removed premature useEffect");
}

// Insert useEffect AFTER handlePoSelect function ends (after setReceiptItems else branch)
if (!s.includes("presetPoForGrn?.id")) {
  const marker = `  const handleItemChange = (index: number, field: string, value: any) => {`;
  const ue = `  useEffect(() => {
    if (presetPoForGrn?.id) {
      setShowCreateModal(true);
      // defer so handlePoSelect is stable
      handlePoSelect(presetPoForGrn.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPoForGrn?.id]);

  const handleItemChange = (index: number, field: string, value: any) => {`;
  if (s.includes(marker)) {
    s = s.replace(marker, ue);
    console.log("useEffect placed after handlePoSelect");
  }
}

// Force options to openPosForReceipt.map — replace remaining pos.filter in create modal
const optRe = /\{pos\s*\n\s*\.filter\(\(p\) =>\s*\n\s*\[[^\]]+\]\.includes\(p\.status\)\s*\n\s*\)\s*\n\s*\.map\(\(p\) => \(/;
if (optRe.test(s)) {
  s = s.replace(optRe, "{openPosForReceipt.map((p) => (");
  console.log("replaced pos.filter options with openPosForReceipt.map");
} else {
  // try looser
  const idx = s.indexOf("value={selectedPoId}");
  if (idx > 0) {
    const chunk = s.slice(idx, idx + 900);
    const fixed = chunk.replace(/\{pos\s*\n\s*\.filter\([\s\S]*?\.map\(\(p\) => \(/, "{openPosForReceipt.map((p) => (");
    if (fixed !== chunk) {
      s = s.slice(0, idx) + fixed + s.slice(idx + chunk.length);
      console.log("loosely replaced options source");
    } else {
      console.log("FAILED to replace options; chunk:\n", chunk);
    }
  }
}

// Add helper banner in create modal near PO select
if (!s.includes("Only open POs with remaining quantity")) {
  s = s.replace(
    "Receive against open Purchase Order",
    "Receive against open Purchase Order — only open POs with remaining quantity"
  );
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("GRN fix done");
