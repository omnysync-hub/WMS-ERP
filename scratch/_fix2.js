const fs=require("fs");
const path=require("path");
const root="D:\\WORKMAN SERVICES\\src\\components\\procurement";

// Fix Match status badge in table
{
  let t=fs.readFileSync(path.join(root,"ThreeWayMatchTab.tsx"),"utf8");
  // Find table status cell - look for approved_for_payment display
  const idx = t.indexOf('inv.matchStatus === "approved_for_payment"');
  console.log("approved_for_payment display at", idx);
  if (idx > 0) {
    console.log(t.slice(idx-200, idx+500));
    if (!t.slice(idx-250, idx).includes("ProcurementStatusBadge")) {
      const tdOpen = t.lastIndexOf("<td", idx);
      const tdClose = t.indexOf("</td>", idx) + 5;
      t = t.slice(0, tdOpen) + `<td className="py-2 px-3 text-center">
                        <ProcurementStatusBadge status={inv.matchStatus} />
                      </td>` + t.slice(tdClose);
      fs.writeFileSync(path.join(root,"ThreeWayMatchTab.tsx"), t);
      console.log("Match badge fixed");
    }
  }
}

// Verify Requisitions handleUpdateStatus body uses targetPr
{
  let t=fs.readFileSync(path.join(root,"RequisitionsTab.tsx"),"utf8");
  const start = t.indexOf("const handleUpdateStatus = async");
  const end = t.indexOf("const handleGeneratePoSubmit", start);
  const body = t.slice(start, end);
  console.log("\n--- handleUpdateStatus ---");
  console.log(body.slice(0, 900));
  console.log("targetPr refs", (body.match(/targetPr/g)||[]).length);
  console.log("selectedPr.id left?", body.includes("selectedPr.id"));
}

// Clean page.tsx unused imports
{
  let t=fs.readFileSync("D:\\WORKMAN SERVICES\\src\\app\\procurement\\page.tsx","utf8");
  // Remove unused CheckCircle2 if present
  t = t.replace(/\s*CheckCircle2,\n/, "\n");
  // Remove unused isActive in chips if it causes lint - it's a const inside map that might be unused
  t = t.replace(/\s*const isActive =\s*activeTab === chip\.tab &&\s*\(chip\.filter \? queueFilter === chip\.filter : !queueFilter \|\| queueFilter === chip\.filter\);\n/, "\n");
  fs.writeFileSync("D:\\WORKMAN SERVICES\\src\\app\\procurement\\page.tsx", t);
  console.log("page cleaned");
}

// Fix procurementUi BOM if any
{
  let t=fs.readFileSync(path.join(root,"procurementUi.tsx"),"utf8");
  if (t.charCodeAt(0) === 0xFEFF) {
    t = t.slice(1);
    fs.writeFileSync(path.join(root,"procurementUi.tsx"), t);
    console.log("stripped BOM from procurementUi");
  }
}
