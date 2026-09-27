const fs = require("fs");

function addDisabled(file, handlerName, permVar) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const re = new RegExp(`onClick=\\{\\(\\) => ${handlerName}\\(([^)]*)\\)\\}`, "g");
  let count = 0;
  s = s.replace(re, (match, args) => {
    count++;
    if (match.includes("disabled=")) return match;
    return `onClick={() => ${handlerName}(${args})} disabled={!${permVar}} title={!${permVar} ? "Missing permission" : undefined}`;
  });
  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
  console.log(file, handlerName, count);
}

addDisabled("src/components/procurement/ProcurementApprovalsTab.tsx", "handleApprovePr", "canApprovePr");
addDisabled("src/components/procurement/ProcurementApprovalsTab.tsx", "handleApprovePo", "canApprovePo");
addDisabled("src/components/procurement/ProcurementApprovalsTab.tsx", "handleApproveBill", "canApproveInvoice");
addDisabled("src/components/procurement/PurchaseOrdersTab.tsx", "handleApprovePo", "canApprovePo");
addDisabled("src/components/procurement/PurchaseOrdersTab.tsx", "handleSendPo", "canSendPo");
addDisabled("src/components/procurement/ThreeWayMatchTab.tsx", "handleApproveInvoice", "canApproveInvoice");
addDisabled("src/components/procurement/RfqSourcingTab.tsx", "handleAwardWinner", "canAwardRfq");

function wrapCreateButton(file, openPattern, permVar) {
  let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const re = new RegExp(`onClick=\\{\\(\\) => ${openPattern}\\}`, "g");
  let c = 0;
  s = s.replace(re, (m) => {
    c++;
    if (m.includes("disabled")) return m;
    return `${m} disabled={!${permVar}}`;
  });
  fs.writeFileSync(file, s.replace(/\n/g, "\r\n"));
  console.log("createBtn", file, openPattern, c);
}

wrapCreateButton("src/components/procurement/RequisitionsTab.tsx", "setShowCreate\\(true\\)", "canCreatePr");
wrapCreateButton("src/components/procurement/RequisitionsTab.tsx", "setIsCreateOpen\\(true\\)", "canCreatePr");
wrapCreateButton("src/components/procurement/PurchaseOrdersTab.tsx", "setShowCreate\\(true\\)", "canCreatePo");
wrapCreateButton("src/components/procurement/PurchaseOrdersTab.tsx", "setIsCreateOpen\\(true\\)", "canCreatePo");
wrapCreateButton("src/components/procurement/GoodsReceiptTab.tsx", "setShowCreate\\(true\\)", "canCreateGrn");
wrapCreateButton("src/components/procurement/PaymentsTab.tsx", "setShowPay\\(true\\)", "canRecordPayment");
wrapCreateButton("src/components/procurement/VendorsTab.tsx", "setShowModal\\(true\\)", "canManageVendor");
wrapCreateButton("src/components/procurement/VendorsTab.tsx", "setIsFormOpen\\(true\\)", "canManageVendor");
wrapCreateButton("src/components/procurement/RfqSourcingTab.tsx", "setShowCreate\\(true\\)", "canManageRfq");
wrapCreateButton("src/components/procurement/ThreeWayMatchTab.tsx", "setShowCreate\\(true\\)", "canCreateInvoice");

// strip unused import from page
let page = fs.readFileSync("src/app/procurement/page.tsx", "utf8");
page = page.replace(/\r?\n\s*ClipboardList,/, "");
fs.writeFileSync("src/app/procurement/page.tsx", page);

console.log("done");
