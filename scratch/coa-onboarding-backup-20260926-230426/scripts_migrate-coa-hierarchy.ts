import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateCoaHierarchy() {
  console.log("==================================================");
  console.log("STARTING COA HIERARCHY & ACCOUNT MAPPING MIGRATION");
  console.log("==================================================\n");

  const companyId = "DEFAULT";

  // 1. Ensure all 26 leaf accounts exist (including 1500, 1590, 3200, 6350)
  console.log("Step 1: Ensuring all standard Level 4 accounts exist...");
  const standardAccounts = [
    { code: "1000", name: "Cash & Bank Balances (Meezan / HBL)", type: "asset", description: "Operational liquid funds and bank accounts" },
    { code: "1010", name: "Operating Bank Account (Meezan Bank)", type: "asset", description: "Primary Islamic operating bank account" },
    { code: "1011", name: "Secondary Bank Account (HBL)", type: "asset", description: "Conventional commercial clearing account" },
    { code: "1020", name: "Petty Cash Float", type: "asset", description: "Office & field emergency petty cash float" },
    { code: "1100", name: "Accounts Receivable", type: "asset", description: "Customer invoices pending collection" },
    { code: "1150", name: "Employee & Tech Advances / Float", type: "asset", description: "Field cash advances given to technicians" },
    { code: "1200", name: "Inventory Asset", type: "asset", description: "HVAC spares, gas cylinders and parts in warehouse" },
    { code: "1500", name: "Fixed Assets - Plant, Tools & Equipment", type: "asset", description: "Machinery, HVAC tools and vehicles" },
    { code: "1590", name: "Accumulated Depreciation - Equipment", type: "asset", description: "Contra-asset accumulated depreciation" },
    { code: "2000", name: "Accounts Payable", type: "liability", description: "Supplier and vendor invoices due" },
    { code: "2050", name: "GR/IR Clearing Account (Unbilled Receipts)", type: "liability", description: "Goods received but supplier invoice not yet verified" },
    { code: "2100", name: "Technician Payable", type: "liability", description: "Expense vouchers pending reimbursement to technicians" },
    { code: "2200", name: "Withholding Tax (WHT) Payable", type: "liability", description: "Withholding tax deducted at source from vendor disbursements" },
    { code: "3000", name: "Owner Capital / Equity", type: "equity", description: "Shareholder invested capital" },
    { code: "3200", name: "Retained Earnings", type: "equity", description: "Accumulated prior periods net earnings" },
    { code: "3900", name: "Opening Balance Equity", type: "equity", description: "Offset equity for go-live initial balance import" },
    { code: "4000", name: "HVAC Service & Installation Revenue", type: "revenue", description: "Revenue from HVAC jobs, repairs and AMC contracts" },
    { code: "4100", name: "Discounts Allowed", type: "contra_revenue", description: "Customer discounts authorized mid-job" },
    { code: "5000", name: "Cost of Goods Sold (COGS)", type: "expense", description: "Cost of HVAC parts and materials used on customer jobs" },
    { code: "5050", name: "Purchase Price Variance (PPV)", type: "expense", description: "Variance between purchase order agreed price and actual invoiced price" },
    { code: "6000", name: "Salaries & Wages Expense", type: "expense", description: "Monthly workforce payroll disbursements" },
    { code: "6100", name: "Technician Travel & Field Expenses", type: "expense", description: "Field reimbursements for fuel, transit, and emergency materials" },
    { code: "6200", name: "General Office & Facility Overheads", type: "expense", description: "Rent, utilities, office equipment and facilities" },
    { code: "6201", name: "Internet & Telecom Subscriptions", type: "expense", description: "Fiber internet, technician data bundles and SIMs" },
    { code: "6202", name: "Printer Ink & Office Stationery", type: "expense", description: "Office paperwork, dispatch printouts and stationery" },
    { code: "6350", name: "Depreciation Expense - Equipment", type: "expense", description: "Monthly fixed asset straight-line depreciation" },
  ];

  for (const acc of standardAccounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: {
        isSystem: true,
        level: 4,
        companyId,
      },
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        description: acc.description,
        isSystem: true,
        level: 4,
        companyId,
        currency: "PKR",
      },
    });
  }

  // 2. Define Level 1 Category Nodes
  console.log("Step 2: Creating Level 1 Category Nodes...");
  const level1Nodes = [
    { code: "1000-GRP", name: "Assets", type: "asset", description: "Economic resources controlled by the business" },
    { code: "2000-GRP", name: "Liabilities", type: "liability", description: "Debts, payables, and obligations owed by the enterprise" },
    { code: "3000-GRP", name: "Equity", type: "equity", description: "Owner and shareholder capital, reserves, and retained earnings" },
    { code: "4000-GRP", name: "Revenue", type: "revenue", description: "Operating and non-operating revenue inflows" },
    { code: "5000-GRP", name: "Cost of Goods Sold", type: "expense", description: "Direct labor, parts, and materials consumed" },
    { code: "6000-GRP", name: "Operating Expenses", type: "expense", description: "Operational, administrative, facility, and sales overheads" },
  ];

  const level1Map = new Map<string, string>();
  for (const n of level1Nodes) {
    const record = await prisma.account.upsert({
      where: { code: n.code },
      update: { name: n.name, type: n.type, description: n.description, level: 1, isSystem: true, companyId },
      create: { code: n.code, name: n.name, type: n.type, description: n.description, level: 1, isSystem: true, companyId, currency: "PKR" },
    });
    level1Map.set(n.code, record.id);
  }

  // 3. Define Level 2 Sub-Category Nodes
  console.log("Step 3: Creating Level 2 Sub-Category Nodes...");
  const level2Nodes = [
    { code: "1100-GRP", name: "Current Assets", type: "asset", parentCode: "1000-GRP", description: "Cash and resources liquid within one fiscal year" },
    { code: "1200-GRP", name: "Non-Current Assets / PP&E", type: "asset", parentCode: "1000-GRP", description: "Long term tangible plant, machinery, tools, and vehicles" },
    { code: "2100-GRP", name: "Current Liabilities", type: "liability", parentCode: "2000-GRP", description: "Short term obligations due within one financial year" },
    { code: "3100-GRP", name: "Equity & Reserves", type: "equity", parentCode: "3000-GRP", description: "Shareholder capital, opening balance equity, and retained earnings" },
    { code: "4100-GRP", name: "Operating & Service Revenue", type: "revenue", parentCode: "4000-GRP", description: "Revenues from HVAC installations, services, and sales" },
    { code: "5100-GRP", name: "Direct Cost of Sales", type: "expense", parentCode: "5000-GRP", description: "Direct materials, spare parts, and purchase price variances" },
    { code: "6100-GRP", name: "Operational & Administrative Expenses", type: "expense", parentCode: "6000-GRP", description: "Salaries, field travel, office facilities, and depreciation" },
  ];

  const level2Map = new Map<string, string>();
  for (const n of level2Nodes) {
    const parentId = level1Map.get(n.parentCode);
    const record = await prisma.account.upsert({
      where: { code: n.code },
      update: { name: n.name, type: n.type, description: n.description, level: 2, parentId, isSystem: true, companyId },
      create: { code: n.code, name: n.name, type: n.type, description: n.description, level: 2, parentId, isSystem: true, companyId, currency: "PKR" },
    });
    level2Map.set(n.code, record.id);
  }

  // 4. Define Level 3 Control Account Nodes
  console.log("Step 4: Creating Level 3 Control Account Nodes...");
  const level3Nodes = [
    { code: "1110", name: "Cash & Cash Equivalents", type: "asset", parentCode: "1100-GRP", description: "Liquid cash on hand and operating bank accounts" },
    { code: "1120", name: "Trade Receivables Control", type: "asset", parentCode: "1100-GRP", description: "Customer accounts receivable balances" },
    { code: "1130", name: "Inventories & Consumables", type: "asset", parentCode: "1100-GRP", description: "Merchandise stock and technician warehouse materials" },
    { code: "1140", name: "Advances, Deposits & Prepayments", type: "asset", parentCode: "1100-GRP", description: "Employee advances, security deposits, and prepaid items" },
    { code: "1210", name: "Property, Plant & Equipment Control", type: "asset", parentCode: "1200-GRP", description: "Tangible capital assets and accumulated depreciation" },
    { code: "2110", name: "Trade Payables & Clearing Control", type: "liability", parentCode: "2100-GRP", description: "Vendor payables and GR/IR clearing balances" },
    { code: "2120", name: "Staff & Technician Liabilities", type: "liability", parentCode: "2100-GRP", description: "Pending technician vouchers and payroll liabilities" },
    { code: "2130", name: "Statutory & Tax Withholdings", type: "liability", parentCode: "2100-GRP", description: "Withholding tax obligations (FBR/PRA)" },
    { code: "3110", name: "Capital & Retained Earnings Control", type: "equity", parentCode: "3100-GRP", description: "Owner equity, initial balance imports, and retained earnings" },
    { code: "4110", name: "Service & Contract Revenue Control", type: "revenue", parentCode: "4100-GRP", description: "Revenues from HVAC contracts and field jobs" },
    { code: "4120", name: "Revenue Deductions & Discounts", type: "contra_revenue", parentCode: "4100-GRP", description: "Customer concessions and price discounts" },
    { code: "5110", name: "Direct Materials & Parts Consumption", type: "expense", parentCode: "5100-GRP", description: "COGS for parts, refrigerant, and copper" },
    { code: "5120", name: "Procurement Price Variances", type: "expense", parentCode: "5100-GRP", description: "Purchase price variances (PPV)" },
    { code: "6110-CTRL", name: "Payroll & Compensation Control", type: "expense", parentCode: "6100-GRP", description: "Salaries and technician wages" },
    { code: "6120-CTRL", name: "Field Operations & Transit Control", type: "expense", parentCode: "6100-GRP", description: "Technician travel, fuel, and field allowances" },
    { code: "6130-CTRL", name: "General Office & Admin Overheads", type: "expense", parentCode: "6100-GRP", description: "Rent, utilities, internet, and stationery" },
    { code: "6140-CTRL", name: "Depreciation & Amortization Control", type: "expense", parentCode: "6100-GRP", description: "Straight-line depreciation of capital assets" },
  ];

  const level3Map = new Map<string, string>();
  for (const n of level3Nodes) {
    const parentId = level2Map.get(n.parentCode);
    const record = await prisma.account.upsert({
      where: { code: n.code },
      update: { name: n.name, type: n.type, description: n.description, level: 3, parentId, isSystem: true, companyId },
      create: { code: n.code, name: n.name, type: n.type, description: n.description, level: 3, parentId, isSystem: true, companyId, currency: "PKR" },
    });
    level3Map.set(n.code, record.id);
  }

  // 5. Reparent Level 4 Leaf Accounts
  console.log("Step 5: Linking Level 4 Leaf Accounts to Level 3 parents...");
  const leafParentAssignments: Record<string, string> = {
    "1000": "1110",
    "1010": "1110",
    "1011": "1110",
    "1020": "1110",
    "1100": "1120",
    "1200": "1130",
    "1150": "1140",
    "1500": "1210",
    "1590": "1210",
    "2000": "2110",
    "2050": "2110",
    "2100": "2120",
    "2200": "2130",
    "3000": "3110",
    "3200": "3110",
    "3900": "3110",
    "4000": "4110",
    "4100": "4120",
    "5000": "5110",
    "5050": "5120",
    "6000": "6110-CTRL",
    "6100": "6120-CTRL",
    "6200": "6130-CTRL",
    "6201": "6130-CTRL",
    "6202": "6130-CTRL",
    "6350": "6140-CTRL",
  };

  for (const [leafCode, parentCtrlCode] of Object.entries(leafParentAssignments)) {
    const parentId = level3Map.get(parentCtrlCode);
    if (parentId) {
      await prisma.account.update({
        where: { code: leafCode },
        data: { parentId, level: 4, isSystem: true },
      });
    }
  }

  // 6. Seed Baseline AccountMapping (Zero breaking changes on Day 1)
  console.log("Step 6: Seeding baseline AccountMapping for all transaction types...");
  const baselineMappings: Array<{ transactionType: string; accountCode: string; categoryScope?: string | null }> = [
    // Job Revenue & Invoicing
    { transactionType: "job_revenue_receivable", accountCode: "1100" },
    { transactionType: "job_revenue_sales", accountCode: "4000" },
    { transactionType: "job_revenue_discount", accountCode: "4100" },
    { transactionType: "customer_payment_receiving", accountCode: "1000" },
    { transactionType: "customer_payment_receivable", accountCode: "1100" },
    // Job Expense Reimbursement
    { transactionType: "expense_reimbursement_expense", accountCode: "6100" },
    { transactionType: "expense_reimbursement_disbursing", accountCode: "1000" },
    // Inventory & COGS
    { transactionType: "inventory_cogs_expense", accountCode: "5000" },
    { transactionType: "inventory_cogs_asset", accountCode: "1200" },
    { transactionType: "inventory_return_asset", accountCode: "1200" },
    { transactionType: "inventory_return_cogs", accountCode: "5000" },
    { transactionType: "stock_in_asset", accountCode: "1200" },
    { transactionType: "stock_in_disbursing", accountCode: "1000" },
    { transactionType: "opening_stock_asset", accountCode: "1200" },
    { transactionType: "opening_stock_equity", accountCode: "3000" },
    // Procurement & Vendor AP
    { transactionType: "grn_receipt_asset", accountCode: "1200" },
    { transactionType: "grn_receipt_clearing", accountCode: "2050" },
    { transactionType: "grn_receipt_payable", accountCode: "2000" },
    { transactionType: "vendor_bill_clearing", accountCode: "2050" },
    { transactionType: "vendor_bill_payable", accountCode: "2000" },
    { transactionType: "vendor_bill_ppv", accountCode: "5050" },
    { transactionType: "vendor_payment_payable", accountCode: "2000" },
    { transactionType: "vendor_payment_disbursing", accountCode: "1010" },
    { transactionType: "vendor_payment_wht", accountCode: "2200" },
    // Payroll & HRM
    { transactionType: "payroll_salaries_expense", accountCode: "6000" },
    { transactionType: "payroll_net_disbursing", accountCode: "1000" },
    { transactionType: "payroll_advance_deduction", accountCode: "1150" },
    { transactionType: "advance_granted_receivable", accountCode: "1150" },
    { transactionType: "advance_granted_disbursing", accountCode: "1000" },
    // POS Checkout
    { transactionType: "pos_sale_cash", accountCode: "1000" },
    { transactionType: "pos_sale_bank", accountCode: "1010" },
    { transactionType: "pos_sale_receivable", accountCode: "1100" },
    { transactionType: "pos_sale_revenue", accountCode: "4000" },
    // Cashbook
    { transactionType: "cashbook_contra_revenue", accountCode: "4000" },
    { transactionType: "cashbook_contra_expense", accountCode: "6200" },
    // Hisaab & Field Operations
    { transactionType: "settlement_collection_vault", accountCode: "1000" },
    { transactionType: "settlement_collection_receivable", accountCode: "1100" },
    { transactionType: "tech_expense_settlement_expense", accountCode: "6100" },
    { transactionType: "tech_expense_settlement_vault", accountCode: "1000" },
    { transactionType: "tech_expense_settlement_payable", accountCode: "2100" },
    // Fixed Assets & Period Close
    { transactionType: "depreciation_expense", accountCode: "6350" },
    { transactionType: "accumulated_depreciation", accountCode: "1590" },
    { transactionType: "retained_earnings_equity", accountCode: "3200" },
    { transactionType: "opening_balance_equity", accountCode: "3900" },
  ];

  for (const m of baselineMappings) {
    const acc = await prisma.account.findUnique({ where: { code: m.accountCode } });
    if (!acc) {
      console.warn(`⚠️ Warning: Account with code ${m.accountCode} not found for mapping ${m.transactionType}`);
      continue;
    }

    const existing = await prisma.accountMapping.findFirst({
      where: {
        companyId,
        transactionType: m.transactionType,
        categoryScope: m.categoryScope || null,
      },
    });

    if (existing) {
      await prisma.accountMapping.update({
        where: { id: existing.id },
        data: {
          accountId: acc.id,
          updatedBy: "System Migration",
        },
      });
    } else {
      await prisma.accountMapping.create({
        data: {
          companyId,
          transactionType: m.transactionType,
          categoryScope: m.categoryScope || null,
          accountId: acc.id,
          updatedBy: "System Migration",
        },
      });
    }
  }

  console.log("\n✅ COA Hierarchy & AccountMapping successfully seeded!");
}

migrateCoaHierarchy()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
