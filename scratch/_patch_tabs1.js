const fs = require("fs");
const path = require("path");
const root = "D:\\WORKMAN SERVICES\\src\\components\\procurement";

function patchFile(name, transforms) {
  const p = path.join(root, name);
  let t = fs.readFileSync(p, "utf8");
  const before = t;
  for (const [label, fn] of transforms) {
    const next = fn(t);
    if (next === t) console.warn("NO CHANGE:", name, "-", label);
    else console.log("OK:", name, "-", label);
    t = next;
  }
  if (t !== before) {
    fs.writeFileSync(p, t, "utf8");
    console.log("WROTE", name);
  }
}

// ---------- RequisitionsTab ----------
patchFile("RequisitionsTab.tsx", [
  ["import ui helpers", (t) => {
    if (t.includes("procurementUi")) return t;
    return t.replace(
      'import { cn, formatCurrency, formatDateTime } from "@/lib/utils";',
      'import { cn, formatCurrency, formatDateTime } from "@/lib/utils";\nimport SideDrawer from "@/components/ui/SideDrawer";\nimport {\n  ProcurementStatusBadge,\n  ProcurementEmptyState,\n  CTA_PRIMARY,\n  CTA_GHOST,\n} from "@/components/procurement/procurementUi";'
    );
  }],
  ["props queueFilter", (t) => {
    if (t.includes("queueFilter")) return t;
    return t
      .replace(
        /interface RequisitionsTabProps \{([\s\S]*?)\}/,
        (m) => m.replace(/\n\}/, "\n  queueFilter?: string | null;\n}")
      )
      .replace(
        /export default function RequisitionsTab\(\{([\s\S]*?)\}: RequisitionsTabProps\)/,
        (m) => {
          if (m.includes("queueFilter")) return m;
          return m.replace(
            "onNavigateToPo,",
            "onNavigateToPo,\n  queueFilter = null,"
          );
        }
      );
  }],
  ["sync queueFilter to statusFilter", (t) => {
    if (t.includes("queueFilter sync")) return t;
    return t.replace(
      'const [statusFilter, setStatusFilter] = useState("all");',
      'const [statusFilter, setStatusFilter] = useState(queueFilter || "all");\n\n  // queueFilter sync from role metric chips\n  React.useEffect(() => {\n    if (queueFilter) setStatusFilter(queueFilter);\n  }, [queueFilter]);'
    );
  }],
  ["sticky denser table", (t) => {
    return t
      .replace(
        'table className="w-full text-left border-collapse text-xs"',
        'table className="w-full text-left border-collapse text-sm"'
      )
      .replace(
        '<thead>\n              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-mono text-[11px] uppercase tracking-wider">',
        '<thead className="sticky top-0 z-10">\n              <tr className="border-b border-[#EDEDED] bg-[#F8FAFC] text-[#71717A] font-medium text-[11px] uppercase tracking-wider">'
      );
  }],
  ["empty state", (t) => {
    return t.replace(
      /\{filteredPrs\.length === 0 \? \(\s*<tr>\s*<td colSpan=\{9\} className="py-8 text-center text-\[#A1A1AA\]">\s*No purchase requisitions found\. Click &quot;Create Purchase Requisition&quot; to initiate a request\.\s*<\/td>\s*<\/tr>\s*\) : \(/,
      `{filteredPrs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <ProcurementEmptyState
                      title="No requisitions in this view"
                      description="Create a purchase requisition to request materials for a site, store, or job."
                      action={
                        canCreatePr ? (
                          <button
                            type="button"
                            onClick={() => {
                              setFormError("");
                              setShowCreateModal(true);
                            }}
                            className={CTA_PRIMARY}
                          >
                            Create PR
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (`
    );
  }],
  ["status badge calm", (t) => {
    // Replace the long status span className block with ProcurementStatusBadge
    const old = /<td className="py-3 px-3 text-center">\s*<span\s*className=\{cn\(\s*"inline-flex items-center px-2 py-0\.5 rounded-full text-\[10px\] font-bold border font-mono",\s*pr\.status === "draft"[\s\S]*?\)\}\s*>\s*\{pr\.status === "converted_to_po"\s*\? "Converted to PO"\s*: pr\.status\.replace\("_", " "\)\.toUpperCase\(\)\}\s*<\/span>\s*<\/td>/;
    const neu = `<td className="py-2 px-3 text-center">
                        <ProcurementStatusBadge
                          status={pr.status}
                          label={
                            pr.status === "converted_to_po"
                              ? "Converted to PO"
                              : undefined
                          }
                        />
                      </td>`;
    if (!old.test(t)) {
      // try looser
      return t;
    }
    return t.replace(old, neu);
  }],
  ["primary row action", (t) => {
    const old = /<td className="py-3 px-4 text-right">\s*<button\s*onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setSelectedPr\(pr\);\s*\}\}\s*className="p-1\.5 rounded text-\[#71717A\] hover:text-\[#18181B\] hover:bg-\[#F4F4F5\] transition"\s*>\s*<Eye className="w-4 h-4" \/>\s*<\/button>\s*<\/td>/;
    const neu = `<td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 justify-end">
                          {pr.status === "draft" && canSubmitPr && (
                            <button
                              type="button"
                              className={CTA_PRIMARY}
                              onClick={() => {
                                setSelectedPr(pr);
                                // submit via existing drawer/modal flow
                                setTimeout(() => {
                                  const btn = document.querySelector('[data-pr-action="submit"]') as HTMLButtonElement | null;
                                  btn?.click();
                                }, 50);
                              }}
                            >
                              Submit
                            </button>
                          )}
                          {pr.status === "submitted" && canApprovePr && (
                            <button
                              type="button"
                              className={CTA_PRIMARY}
                              onClick={() => {
                                setSelectedPr(pr);
                                setTimeout(() => {
                                  const btn = document.querySelector('[data-pr-action="approve"]') as HTMLButtonElement | null;
                                  btn?.click();
                                }, 50);
                              }}
                            >
                              Approve
                            </button>
                          )}
                          {pr.status === "approved" && canCreatePo && (
                            <button
                              type="button"
                              className={CTA_PRIMARY}
                              onClick={() => openPoGenerationModal([pr])}
                            >
                              Create PO
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedPr(pr)}
                            className={CTA_GHOST}
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>`;
    if (!old.test(t)) return t;
    return t.replace(old, neu);
  }],
  ["priority badge calm", (t) => {
    return t.replace(
      'pr.priority === "Urgent"\n                              ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"\n                              : "bg-zinc-100 text-zinc-600 border-zinc-200"',
      'pr.priority === "Urgent"\n                              ? "bg-amber-50 text-amber-800 border-amber-200"\n                              : "bg-slate-100 text-slate-600 border-slate-200"'
    );
  }],
]);

console.log("Requisitions done phase 1");