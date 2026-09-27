const fs = require("fs");

// ReassignTechDrawer event type
{
  const path = "src/components/drawers/ReassignTechDrawer.tsx";
  let s = fs.readFileSync(path, "utf8");
  s = s.replace(
    `realtimeSync.publish(
        body.action === "reassign" ? "JOB_REASSIGNED" : "JOB_ASSIGNED",`,
    `realtimeSync.publish(
        body.action === "reassign" ? "JOB_RESCHEDULED" : "JOB_ASSIGNED",`
  );
  // if JOB_RESCHEDULED not in SyncEventType, use JOB_ASSIGNED always
  const syncPath = "src/lib/realtimeSync.ts";
  const sync = fs.readFileSync(syncPath, "utf8");
  if (!sync.includes("JOB_RESCHEDULED") && !sync.includes("JOB_REASSIGNED")) {
    s = s.replace(
      `body.action === "reassign" ? "JOB_RESCHEDULED" : "JOB_ASSIGNED"`,
      `"JOB_ASSIGNED"`
    );
    console.log("fallback to JOB_ASSIGNED only");
  } else {
    console.log("using available sync event");
  }
  fs.writeFileSync(path, s);
}

// RequisitionsTab poPricingItems type - add selected
{
  const path = "src/components/procurement/RequisitionsTab.tsx";
  let s = fs.readFileSync(path, "utf8");
  const hadCRLF = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  // Find useState for poPricingItems
  const re = /const \[poPricingItems, setPoPricingItems\] = useState<\s*\{([^}]+)\}\s*\[\]>\(\[\]\)/;
  const m = s.match(re);
  if (m) {
    if (!m[1].includes("selected")) {
      s = s.replace(re, (full, inner) => {
        const neu = inner.trim().replace(/\s*$/, "") + "\n    selected?: boolean;\n  ";
        return `const [poPricingItems, setPoPricingItems] = useState<\n    {${neu}}[]\n  >([])`;
      });
      console.log("added selected? to poPricingItems type");
    }
  } else {
    console.log("poPricingItems type pattern not found, trying alt");
    // dump nearby
    const idx = s.indexOf("poPricingItems, setPoPricingItems");
    console.log(s.slice(idx, idx + 400));
  }
  if (hadCRLF) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
}

// JobsService Set iteration
{
  const path = "src/lib/services/JobsService.ts";
  let s = fs.readFileSync(path, "utf8");
  s = s.replace(
    "const ids = [...new Set((technicianIds || []).filter(Boolean))];",
    "const ids = Array.from(new Set((technicianIds || []).filter(Boolean)));"
  );
  fs.writeFileSync(path, s);
  console.log("Set iteration fixed");
}
