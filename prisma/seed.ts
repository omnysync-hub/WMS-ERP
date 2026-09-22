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
    { code: "2050", name: "GR/IR Clearing Account (Unbilled Receipts)", type: "liability", description: "Goods received but supplier invoice not yet verified" },
    { code: "2100", name: "Technician Payable", type: "liability", description: "Expense vouchers pending reimbursement to technicians" },
    { code: "2200", name: "Withholding Tax (WHT) Payable", type: "liability", description: "Withholding tax deducted at source from vendor disbursements" },
    { code: "3000", name: "Owner Capital / Equity", type: "equity", description: "Shareholder invested capital" },
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
  ];

  for (const acc of accounts) {
    const existing = await prisma.account.findUnique({ where: { code: acc.code } });
    if (!existing) {
      await prisma.account.create({ data: acc });
    }
  }

  // 1b. Seed Standard Vendors
  console.log("Ensuring Vendor Master Records...");
  const vendors = [
    {
      vendorCode: "VND-0001",
      name: "Pak HVAC Spares & Engineering Ltd",
      contactPerson: "Tariq Mehmood",
      phone: "+92-300-4455661",
      email: "tariq@pakhvac.pk",
      addressText: "Plot 14, Sector I-9/2 Industrial Area, Islamabad",
      ntnNumber: "4198234-1",
      strnNumber: "1700419823418",
      taxId: "PK-4198234",
      paymentTerms: "Net 30",
      paymentTermsDays: 30,
      currency: "PKR",
      bankName: "Meezan Bank Ltd",
      bankAccountTitle: "Pak HVAC Spares & Engineering",
      bankAccountNumber: "0102030405060708",
      category: "Spares & Raw Material",
      status: "Active",
      whtRate: 4.5,
      whtExempt: false,
    },
    {
      vendorCode: "VND-0002",
      name: "Indus Refrigerants & Chemical Gases",
      contactPerson: "Zubair Hashmi",
      phone: "+92-321-9988772",
      email: "sales@indusrefrig.pk",
      addressText: "Korangi Industrial Area, Karachi",
      ntnNumber: "3289110-5",
      strnNumber: "1200328911059",
      taxId: "PK-3289110",
      paymentTerms: "Net 45",
      paymentTermsDays: 45,
      currency: "PKR",
      bankName: "Habib Bank Limited (HBL)",
      bankAccountTitle: "Indus Refrigerants Corp",
      bankAccountNumber: "1122334455667788",
      category: "Raw Material",
      status: "Active",
      whtRate: 4.0,
      whtExempt: false,
    },
    {
      vendorCode: "VND-0003",
      name: "Siemens HVAC Controls & Automation Dist.",
      contactPerson: "Farooq Azam",
      phone: "+92-333-1122334",
      email: "farooq.azam@siemens-dist.pk",
      addressText: "Gulberg III, Lahore",
      ntnNumber: "5109823-7",
      strnNumber: "2200510982371",
      taxId: "PK-5109823",
      paymentTerms: "Advance",
      paymentTermsDays: 0,
      currency: "PKR",
      bankName: "Standard Chartered Bank",
      bankAccountTitle: "Siemens Dist Pakistan",
      bankAccountNumber: "9988776655443322",
      category: "Capital",
      status: "Active",
      whtRate: 8.0,
      whtExempt: false,
    },
    {
      vendorCode: "VND-0004",
      name: "Universal Logistics & Fleet Carriers",
      contactPerson: "Kamran Malik",
      phone: "+92-345-5566778",
      email: "dispatch@universallogistics.com.pk",
      addressText: "Truck Stand, Badami Bagh, Lahore",
      ntnNumber: "2984112-9",
      strnNumber: "0300298411294",
      taxId: "PK-2984112",
      paymentTerms: "Net 15",
      paymentTermsDays: 15,
      currency: "PKR",
      bankName: "Bank Alfalah Limited",
      bankAccountTitle: "Universal Freight Co",
      bankAccountNumber: "4433221100998877",
      category: "Service",
      status: "Active",
      whtRate: 3.0,
      whtExempt: false,
    },
    {
      vendorCode: "VND-0005",
      name: "Apex Thermal Ducting Contractors",
      contactPerson: "Naveed Raza",
      phone: "+92-312-3344556",
      email: "naveed@apexsub.pk",
      addressText: "Industrial Estate, Gujranwala",
      ntnNumber: "1892031-4",
      strnNumber: "1400189203142",
      taxId: "PK-1892031",
      paymentTerms: "Net 30",
      paymentTermsDays: 30,
      currency: "PKR",
      bankName: "MCB Bank Ltd",
      bankAccountTitle: "Apex Thermal Ducting",
      bankAccountNumber: "5566778899001122",
      category: "Service",
      status: "Blocked",
      whtRate: 5.0,
      whtExempt: false,
    },
  ];

  for (const v of vendors) {
    const existing = await prisma.vendor.findFirst({
      where: { OR: [{ name: v.name }, { vendorCode: v.vendorCode }] },
    });
    if (!existing) {
      await prisma.vendor.create({ data: v });
    } else {
      await prisma.vendor.update({
        where: { id: existing.id },
        data: {
          vendorCode: v.vendorCode,
          taxId: v.taxId,
          category: v.category,
          status: v.status,
          currency: v.currency,
          bankName: v.bankName,
          bankAccountTitle: v.bankAccountTitle,
          bankAccountNumber: v.bankAccountNumber,
          paymentTerms: v.paymentTerms,
        },
      });
    }
  }

  // 1c. Ensure Standard Products for Catalog
  console.log("Ensuring Standard Catalog Products...");
  const sampleProducts = [
    { sku: "REF-R410A", name: "R410A Refrigerant Gas Cylinder (11.3kg)", unit: "cylinder", costPrice: 18500, unitPrice: 24500, stockQuantity: 28, reorderLevel: 10 },
    { sku: "COMP-ROT-1.5T", name: "1.5 Ton Rotary Compressor (Inverter)", unit: "pcs", costPrice: 32000, unitPrice: 42000, stockQuantity: 12, reorderLevel: 5 },
    { sku: "COP-PIPE-1/2", name: "Copper Piping Tube 1/2 Inch (Roll 15m)", unit: "roll", costPrice: 7200, unitPrice: 9800, stockQuantity: 45, reorderLevel: 15 },
    { sku: "FAN-MTR-ODU", name: "Outdoor Fan Motor 45W Universal", unit: "pcs", costPrice: 4800, unitPrice: 6800, stockQuantity: 18, reorderLevel: 8 },
    { sku: "CAP-DUAL-50UF", name: "Dual Run Capacitor 50+5 uF 450V", unit: "pcs", costPrice: 850, unitPrice: 1450, stockQuantity: 75, reorderLevel: 25 },
    { sku: "EXP-VALVE-E5", name: "Electronic Expansion Valve E5 Model", unit: "pcs", costPrice: 5600, unitPrice: 7900, stockQuantity: 14, reorderLevel: 6 },
  ];

  for (const p of sampleProducts) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (!existing) {
      await prisma.product.create({ data: p });
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
