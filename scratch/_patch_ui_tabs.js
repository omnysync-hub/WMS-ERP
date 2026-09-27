const fs = require("fs");

// Pipeline: add allowedStages filter
let pipe = fs.readFileSync("src/components/procurement/ProcurementProcessPipeline.tsx", "utf8").replace(/\r\n/g, "\n");
if (!pipe.includes("allowedStages")) {
  pipe = pipe.replace(
    `interface ProcessPipelineProps {
  activeTab: ProcurementStage;
  onSelectTab: (tab: ProcurementStage) => void;
  metrics: {`,
    `interface ProcessPipelineProps {
  activeTab: ProcurementStage;
  onSelectTab: (tab: ProcurementStage) => void;
  allowedStages?: ProcurementStage[];
  metrics: {`
  );
  pipe = pipe.replace(
    `export default function ProcurementProcessPipeline({
  activeTab,
  onSelectTab,
  metrics,
}: ProcessPipelineProps) {
  const stages = [`,
    `export default function ProcurementProcessPipeline({
  activeTab,
  onSelectTab,
  allowedStages,
  metrics,
}: ProcessPipelineProps) {
  const stagesAll = [`
  );
  pipe = pipe.replace(
    `  ];

  return (
    <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 shadow-2xs overflow-x-auto">`,
    `  ];

  const stages = allowedStages && allowedStages.length > 0
    ? stagesAll.filter((st) => allowedStages.includes(st.id))
    : stagesAll;

  return (
    <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 shadow-2xs overflow-x-auto">`
  );
  fs.writeFileSync("src/components/procurement/ProcurementProcessPipeline.tsx", pipe.replace(/\n/g, "\r\n"));
  console.log("pipeline OK");
} else {
  console.log("pipeline already has allowedStages");
}

/** Patch a tab file: ensure useRole has hasPermission+activeUser, wrap fetch with headers */
function patchTabFetches(file, extra) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

  if (!s.includes('from "@/lib/procurementClient"')) {
    // add import after useRole import or at top client imports
    if (s.includes('from "@/contexts/RoleContext"')) {
      s = s.replace(
        'from "@/contexts/RoleContext";',
        'from "@/contexts/RoleContext";\nimport { procurementActorHeaders } from "@/lib/procurementClient";'
      );
    } else {
      s = s.replace(
        '"use client";\n',
        '"use client";\n\nimport { useRole } from "@/contexts/RoleContext";\nimport { procurementActorHeaders } from "@/lib/procurementClient";\n'
      );
    }
  }

  // Expand useRole destructure
  const patterns = [
    [/const \{ currentRole \} = useRole\(\);/g, 'const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();'],
    [/const \{ currentRole, [^}]+\} = useRole\(\);/g, null], // leave if already expanded-ish
  ];
  if (s.includes("const { currentRole } = useRole();")) {
    s = s.replace(
      "const { currentRole } = useRole();",
      "const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();"
    );
  } else if (s.includes("useRole()") && !s.includes("hasPermission")) {
    // RfqSourcingTab / VendorsTab may not use useRole yet
    if (!s.includes("useRole")) {
      // already imported above
    }
  }

  if (!s.includes("useRole()") && s.includes("procurementActorHeaders")) {
    // inject hook near top of component — find export default function
    s = s.replace(
      /(export default function \w+\([^)]*\) \{)/,
      `$1\n  const { currentRole, activeRole, hasPermission, currentPersona, activeUser } = useRole();`
    );
  }

  // Ensure hasPermission in destructure if useRole exists but missing hasPermission
  if (s.includes("useRole()") && !s.includes("hasPermission")) {
    s = s.replace(
      /const \{([^}]+)\} = useRole\(\);/,
      (m, inner) => {
        if (inner.includes("hasPermission")) return m;
        return `const {${inner}, hasPermission, currentPersona, activeUser, activeRole } = useRole();`;
      }
    );
  }

  // Wrap fetch("/api/procurement" that don't already have headers with actor headers
  // Replace: fetch("/api/procurement", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },
  s = s.replace(
    /fetch\(\s*"\/api\/procurement"\s*,\s*\{\s*method:\s*"POST"\s*,\s*headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\}\s*,/g,
    `fetch("/api/procurement", {\n        method: "POST",\n        headers: procurementActorHeaders(activeRole || currentRole, currentPersona?.name || activeUser?.name, activeUser?.id),\n`
  );

  // Also handle single-line variants
  s = s.replace(
    /fetch\("\/api\/procurement", \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json" \},/g,
    `fetch("/api/procurement", { method: "POST", headers: procurementActorHeaders(activeRole || currentRole, currentPersona?.name || activeUser?.name, activeUser?.id),`
  );

  if (extra) s = extra(s);

  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
  console.log("patched", file);
}

const files = [
  "src/components/procurement/RequisitionsTab.tsx",
  "src/components/procurement/RfqSourcingTab.tsx",
  "src/components/procurement/PurchaseOrdersTab.tsx",
  "src/components/procurement/GoodsReceiptTab.tsx",
  "src/components/procurement/ThreeWayMatchTab.tsx",
  "src/components/procurement/PaymentsTab.tsx",
  "src/components/procurement/VendorsTab.tsx",
  "src/components/procurement/ProcurementApprovalsTab.tsx",
];

for (const f of files) patchTabFetches(f);
