import { PrismaClient } from "@prisma/client";
import { STANDARD_COA_DEFINITIONS } from "../src/lib/constants/chartOfAccountsHierarchy";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Foundational System Infrastructure...");

  // 1. Chart of Accounts (Level 4 Standard Chart of Accounts)
  console.log("Ensuring Standard Chart of Accounts (PKR)...");
  // The ONLY chart of accounts is the client's "Updated Chart of Accounts" (groups first, then posting accounts).
  const ordered = [...STANDARD_COA_DEFINITIONS].sort((a, b) => a.level - b.level);
  for (const def of ordered) {
    const existing = await prisma.account.findUnique({ where: { code: def.code } });
    if (existing) continue;
    const parent = def.parentCode ? await prisma.account.findUnique({ where: { code: def.parentCode } }) : null;
    await prisma.account.create({
      data: {
        code: def.code,
        name: def.name,
        type: def.type,
        description: def.description || null,
        level: def.level,
        parentId: parent?.id || null,
        isSystem: true,
        isActive: true,
      },
    });
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
        legalName: "",
        tradeName: null,
        addressText: "",
        phone: "",
        email: "",
        ntnNumber: null,
        strnNumber: null,
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
