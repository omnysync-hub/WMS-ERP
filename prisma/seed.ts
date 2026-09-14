import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Foundational System Infrastructure...");

  // 1. Chart of Accounts (Level 4 Standard Chart of Accounts)
  console.log("Ensuring Standard Chart of Accounts (PKR)...");
  const accounts = [
    { code: "1000", name: "Cash & Bank Balances (Meezan / HBL)", type: "asset", description: "Operational liquid funds and bank accounts" },
    { code: "1010", name: "Operating Bank Account (Meezan Bank)", type: "asset", description: "Primary Islamic operating bank account" },
    { code: "1011", name: "Secondary Bank Account (HBL)", type: "asset", description: "Conventional commercial clearing account" },
    { code: "1020", name: "Petty Cash Float", type: "asset", description: "Office & field emergency petty cash float" },
    { code: "1100", name: "Accounts Receivable", type: "asset", description: "Customer invoices pending collection" },
    { code: "1150", name: "Employee & Tech Advances / Float", type: "asset", description: "Field cash advances given to technicians" },
    { code: "1200", name: "Inventory Asset", type: "asset", description: "HVAC spares, gas cylinders and parts in warehouse" },
    { code: "2000", name: "Accounts Payable", type: "liability", description: "Supplier and vendor invoices due" },
    { code: "2100", name: "Technician Payable", type: "liability", description: "Expense vouchers pending reimbursement to technicians" },
    { code: "3000", name: "Owner Capital / Equity", type: "equity", description: "Shareholder invested capital" },
    { code: "3900", name: "Opening Balance Equity", type: "equity", description: "Offset equity for go-live initial balance import" },
    { code: "4000", name: "HVAC Service & Installation Revenue", type: "revenue", description: "Revenue from HVAC jobs, repairs and AMC contracts" },
    { code: "4100", name: "Discounts Allowed", type: "contra_revenue", description: "Customer discounts authorized mid-job" },
    { code: "5000", name: "Cost of Goods Sold (COGS)", type: "expense", description: "Cost of HVAC parts and materials used on customer jobs" },
    { code: "6000", name: "Salaries & Wages Expense", type: "expense", description: "Monthly workforce payroll disbursements" },
    { code: "6100", name: "Technician Travel & Field Expenses", type: "expense", description: "Field reimbursements for fuel, transit, and emergency materials" },
    { code: "6200", name: "General Office & Facility Overheads", type: "expense", description: "Rent, utilities, office equipment and facilities" },
    { code: "6201", name: "Internet & Telecom Subscriptions", type: "expense", description: "Fiber internet, technician data bundles and SIMs" },
    { code: "6202", name: "Printer Ink & Office Stationery", type: "expense", description: "Office paperwork, dispatch printouts and stationery" },
  ];

  for (const acc of accounts) {
    const existing = await prisma.account.findUnique({ where: { code: acc.code } });
    if (!existing) {
      await prisma.account.create({ data: acc });
    }
  }

  // 2. Company Settings Singleton
  console.log("Ensuring Company Settings...");
  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        legalName: "Enterprise Services (Pvt) Ltd",
        tradeName: "Enterprise Services",
        addressText: "Main Boulevard, Gulberg III, Lahore, Pakistan",
        phone: "042-111-0000",
        email: "finance@company.com",
        ntnNumber: "9482710-3",
        strnNumber: "3277876123456",
        baseCurrency: "PKR",
        fiscalYearStartMonth: 7, // July
        approvalThreshold: 50000,
        isSetupCompleted: false,
      },
    });
  }

  // 3. Fiscal Periods for July - June Financial Year
  console.log("Ensuring 12 Fiscal Periods...");
  const currentYear = new Date().getFullYear();
  const existingPeriods = await prisma.fiscalPeriod.findMany({
    where: { fiscalYear: currentYear },
  });

  if (existingPeriods.length === 0) {
    const monthNames = [
      "July", "August", "September", "October", "November", "December",
      "January", "February", "March", "April", "May", "June",
    ];

    for (let i = 0; i < 12; i++) {
      const calMonth = (6 + i) % 12;
      const calYear = calMonth >= 6 ? currentYear : currentYear + 1;
      const startDate = new Date(Date.UTC(calYear, calMonth, 1));
      const endDate = new Date(Date.UTC(calYear, calMonth + 1, 0, 23, 59, 59, 999));

      await prisma.fiscalPeriod.create({
        data: {
          periodNumber: i + 1,
          name: `${monthNames[i]} ${calYear}`,
          fiscalYear: currentYear,
          startDate,
          endDate,
          status: "open",
        },
      });
    }
  }

  console.log("Foundational infrastructure seeded successfully with zero dummy operational records.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
