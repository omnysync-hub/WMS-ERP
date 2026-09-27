const fs=require("fs");
const path=require("path");
const root="D:\\WORKMAN SERVICES\\src\\components\\procurement";

function trimUnusedUiImports(file) {
  let t=fs.readFileSync(path.join(root,file),"utf8");
  if (!t.includes("from \"@/components/procurement/procurementUi\"")) return;
  const used = {
    ProcurementStatusBadge: (t.match(/ProcurementStatusBadge/g)||[]).length > 1,
    ProcurementEmptyState: (t.match(/ProcurementEmptyState/g)||[]).length > 1,
    CTA_PRIMARY: (t.match(/CTA_PRIMARY/g)||[]).length > 1,
    CTA_GHOST: (t.match(/CTA_GHOST/g)||[]).length > 1,
  };
  // rebuild import
  const names = Object.entries(used).filter(([,v])=>v).map(([k])=>k);
  if (names.length === 0) {
    t = t.replace(/\r?\nimport \{\r?\n(?:  \w+,\r?\n)+\} from "@\/components\/procurement\/procurementUi";/, "");
    console.log(file, "removed entire ui import");
  } else {
    const block = `import {\n  ${names.join(",\n  ")},\n} from "@/components/procurement/procurementUi";`;
    t = t.replace(/import \{\r?\n(?:  \w+,\r?\n)+\} from "@\/components\/procurement\/procurementUi";/, block);
    console.log(file, "kept", names);
  }
  fs.writeFileSync(path.join(root,file), t);
}

for (const f of [
  "ThreeWayMatchTab.tsx",
  "PaymentsTab.tsx",
  "GoodsReceiptTab.tsx",
  "ProcurementApprovalsTab.tsx",
  "PurchaseOrdersTab.tsx",
  "RequisitionsTab.tsx",
]) trimUnusedUiImports(f);

// Fix Match empty if needed
{
  let t=fs.readFileSync(path.join(root,"ThreeWayMatchTab.tsx"),"utf8");
  if ((t.match(/ProcurementEmptyState/g)||[]).length < 2) {
    const m = t.match(/No supplier invoices found[^<]*/);
    console.log("match empty raw", m && m[0]);
    if (m) {
      t = t.replace(
        /<td colSpan=\{[^}]+\} className="[^"]*">\s*No supplier invoices found\.[^<]*<\/td>/,
        `<td colSpan={7} className="p-0">
                    <ProcurementEmptyState
                      title="No invoices to match"
                      description="Record a supplier invoice against a GRN to start 3-way match."
                    />
                  </td>`
      );
      // ensure import has EmptyState
      if (!t.includes("ProcurementEmptyState")) {
        t = t.replace(
          'from "@/components/procurement/procurementUi";',
          'ProcurementEmptyState,\n} from "@/components/procurement/procurementUi";'
        );
        // might need more careful - skip if broken
      } else if (!(t.match(/ProcurementEmptyState/g)||[]).length) {
        // add to import list
      }
      // Re-add to import if only StatusBadge
      if (t.includes("ProcurementStatusBadge") && !t.includes("ProcurementEmptyState,")) {
        t = t.replace(
          "ProcurementStatusBadge,",
          "ProcurementStatusBadge,\n  ProcurementEmptyState,"
        );
        t = t.replace(
          "ProcurementStatusBadge\n}",
          "ProcurementStatusBadge,\n  ProcurementEmptyState,\n}"
        );
      }
      fs.writeFileSync(path.join(root,"ThreeWayMatchTab.tsx"), t);
      console.log("match empty fixed", (t.match(/ProcurementEmptyState/g)||[]).length);
    }
  }
}

// Approvals: add a simple empty state message polish - already has content
