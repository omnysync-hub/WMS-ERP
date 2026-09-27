const fs=require("fs");
const path=require("path");
const root="D:\\WORKMAN SERVICES\\src\\components\\procurement";

// PO: calm status badge + CTA styling on primary buttons
{
  let t=fs.readFileSync(path.join(root,"PurchaseOrdersTab.tsx"),"utf8");
  // Replace status span with ProcurementStatusBadge
  const start = t.indexOf('po.status === "draft"');
  if (start > 0 && !t.slice(start-300, start).includes("ProcurementStatusBadge")) {
    const tdOpen = t.lastIndexOf("<td", start);
    const tdClose = t.indexOf("</td>", start) + 5;
    const replacement = `<td className="py-2 px-3 text-center">
                        <ProcurementStatusBadge status={po.status} />
                      </td>`;
    t = t.slice(0, tdOpen) + replacement + t.slice(tdClose);
    console.log("PO status badge replaced");
  }
  // Soften primary action button classes that use purple/amber loudly — leave green CTAs
  // Change draft approve button to CTA_PRIMARY if it's not already green
  t = t.replace(
    /\{po\.status === "draft" && \([\s\S]*?<\/button>\s*\)\}/,
    (m) => {
      // ensure uses CTA_PRIMARY class feel
      return m
        .replace(/className="[^"]*"/, 'className={CTA_PRIMARY}')
        .replace(/>[\s\S]*?Approve[\s\S]*?</, ">Approve<");
    }
  );
  fs.writeFileSync(path.join(root,"PurchaseOrdersTab.tsx"), t);
  console.log("PO updated");
}

// Match: calm status + ensure Pay/Match primary
{
  let t=fs.readFileSync(path.join(root,"ThreeWayMatchTab.tsx"),"utf8");
  console.log("Match queueFilter destructure?", t.includes("queueFilter = null"));
  // verify props interface
  const iface = t.match(/interface ThreeWayMatchTabProps[\s\S]*?\}/);
  console.log(iface && iface[0]);
  const fn = t.match(/export default function ThreeWayMatchTab\([\s\S]*?\}: ThreeWayMatchTabProps\)/);
  console.log(fn && fn[0].slice(0,300));

  // status badge
  const ms = t.indexOf("inv.matchStatus === ");
  console.log("matchStatus at", ms);
  if (ms > 0 && !t.slice(ms-200, ms).includes("ProcurementStatusBadge")) {
    const tdOpen = t.lastIndexOf("<td", ms);
    const tdClose = t.indexOf("</td>", ms) + 5;
    // only if this looks like the table status cell
    const chunk = t.slice(tdOpen, tdClose);
    if (chunk.includes("rounded-full") || chunk.includes("matchStatus")) {
      t = t.slice(0, tdOpen) + `<td className="py-2 px-3 text-center">
                        <ProcurementStatusBadge status={inv.matchStatus} />
                      </td>` + t.slice(tdClose);
      console.log("Match status badge replaced");
    }
  }
  fs.writeFileSync(path.join(root,"ThreeWayMatchTab.tsx"), t);
}

// GRN: calm quality status
{
  let t=fs.readFileSync(path.join(root,"GoodsReceiptTab.tsx"),"utf8");
  // Find Eye action - add Receive primary on open POs toolbar already exists
  // Calm quality badges
  t = t.replace(
    'grn.qualityStatus === "Accepted"\n                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"\n                              : grn.qualityStatus === "Hold"',
    'grn.qualityStatus === "Accepted"\n                              ? "bg-slate-100 text-slate-600 border-slate-200"\n                              : grn.qualityStatus === "Hold"'
  );
  fs.writeFileSync(path.join(root,"GoodsReceiptTab.tsx"), t);
  console.log("GRN calmed");
}

// Approvals empty states
{
  let t=fs.readFileSync(path.join(root,"ProcurementApprovalsTab.tsx"),"utf8");
  // Soften any rainbow
  t = t.replace(/animate-pulse/g, "");
  fs.writeFileSync(path.join(root,"ProcurementApprovalsTab.tsx"), t);
}

// Payments empty + Pay CTA already?
{
  let t=fs.readFileSync(path.join(root,"PaymentsTab.tsx"),"utf8");
  console.log("Payments queueFilter?", t.includes("queueFilter"));
  const empty = t.indexOf("No ");
  // find empty row
  const m = t.match(/No [a-zA-Z ]+found[^<]*/);
  console.log("empty msg", m && m[0]);
  if (m && !t.includes("ProcurementEmptyState")) {
    // already imported but maybe unused - add empty state
  }
  if ((t.match(/ProcurementEmptyState/g)||[]).length === 1) {
    // only import - wrap empty
    t = t.replace(
      /<td colSpan=\{[^}]+\} className="[^"]*">\s*No [^<]+<\/td>/,
      `<td colSpan={6} className="p-0">
                    <ProcurementEmptyState
                      title="No payments due"
                      description="Approved invoices ready for payment will appear here."
                    />
                  </td>`
    );
    fs.writeFileSync(path.join(root,"PaymentsTab.tsx"), t);
    console.log("Payments empty updated");
  }
}

console.log("done polish batch");
