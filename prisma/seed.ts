import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Workman Services Pakistan HVAC & Facilities ERP database...");

  // Clean existing data
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.jobStatusHistory.deleteMany();
  await prisma.jobItem.deleteMany();
  await prisma.inventoryRequest.deleteMany();
  await prisma.stockReturn.deleteMany();
  await prisma.jobExpenseClaim.deleteMany();
  await prisma.hisaabSettlement.deleteMany();
  await prisma.feedbackCall.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.technicianLedgerEntry.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequisitionItem.deleteMany();
  await prisma.purchaseRequisition.deleteMany();
  await prisma.posSaleItem.deleteMany();
  await prisma.posSale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.projectTask.deleteMany();
  await prisma.bOQItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.job.deleteMany();
  await prisma.careOfParty.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.employeeAdvance.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.geofenceZone.deleteMany();
  await prisma.employee.deleteMany();

  // 1. Chart of Accounts
  console.log("Creating Chart of Accounts (PKR)...");
  const accounts = [
    { code: "1000", name: "Cash & Bank Balances (Meezan / HBL)", type: "asset", description: "Operational liquid funds and bank accounts" },
    { code: "1100", name: "Accounts Receivable", type: "asset", description: "Customer invoices pending collection" },
    { code: "1150", name: "Employee & Tech Advances / Float", type: "asset", description: "Field cash advances given to technicians" },
    { code: "1200", name: "Inventory Asset", type: "asset", description: "HVAC spares, gas cylinders and parts in warehouse" },
    { code: "2000", name: "Accounts Payable", type: "liability", description: "Supplier and vendor invoices due" },
    { code: "2100", name: "Technician Payable", type: "liability", description: "Expense vouchers pending reimbursement to technicians" },
    { code: "3000", name: "Owner Capital / Equity", type: "equity", description: "Shareholder invested capital" },
    { code: "4000", name: "HVAC Service & Installation Revenue", type: "revenue", description: "Revenue from HVAC jobs, repairs and AMC contracts" },
    { code: "4100", name: "Discounts Allowed", type: "contra_revenue", description: "Customer discounts authorized mid-job" },
    { code: "5000", name: "Cost of Goods Sold (COGS)", type: "expense", description: "Cost of HVAC parts and materials used on customer jobs" },
    { code: "6000", name: "Salaries & Wages Expense", type: "expense", description: "Monthly workforce payroll disbursements" },
    { code: "6100", name: "Technician Travel & Field Expenses", type: "expense", description: "Field reimbursements for fuel, transit, and emergency materials" },
  ];

  for (const acc of accounts) {
    await prisma.account.create({ data: acc });
  }

  // 2. Geofence Zones in Pakistan
  console.log("Creating Pakistan Geofence Zones...");
  const hqZone = await prisma.geofenceZone.create({
    data: {
      name: "Workman Central Depot & Warehouse (Gulberg III, Lahore)",
      lat: 31.5204,
      lng: 74.3587,
      radiusMeters: 300,
    },
  });

  const dhaZone = await prisma.geofenceZone.create({
    data: {
      name: "DHA Operations Hub (Sector Y, Phase 3 DHA, Lahore)",
      lat: 31.4722,
      lng: 74.3814,
      radiusMeters: 250,
    },
  });

  // 3. Employees with realistic Pakistani designations and salaries
  console.log("Creating Employees...");
  const ali = await prisma.employee.create({
    data: {
      name: "Ali Raza",
      phone: "+92 300 4561234",
      email: "ali.tech@workmanservices.pk",
      role: "technician",
      department: "Field Operations",
      salary: 68000,
      faceEnrolled: true,
      lat: 31.5209,
      lng: 74.3591,
      lastPingAt: new Date(),
    },
  });

  const tariq = await prisma.employee.create({
    data: {
      name: "Tariq Mehmood",
      phone: "+92 321 7894561",
      email: "tariq.tech@workmanservices.pk",
      role: "technician",
      department: "Field Operations",
      salary: 75000,
      faceEnrolled: true,
      lat: 31.5582,
      lng: 74.332,
      lastPingAt: new Date(),
    },
  });

  const hamza = await prisma.employee.create({
    data: {
      name: "Hamza Khan",
      phone: "+92 333 1237890",
      email: "hamza.tech@workmanservices.pk",
      role: "technician",
      department: "Field Operations",
      salary: 58000,
      faceEnrolled: true,
      lat: 31.4592,
      lng: 74.4514,
      lastPingAt: new Date(),
    },
  });

  const zeeshan = await prisma.employee.create({
    data: {
      name: "Zeeshan Ahmed",
      phone: "+92 345 9876543",
      email: "zeeshan.dispatch@workmanservices.pk",
      role: "dispatcher",
      department: "Operations & Dispatch",
      salary: 72000,
      faceEnrolled: true,
    },
  });

  const fatima = await prisma.employee.create({
    data: {
      name: "Fatima Noor",
      phone: "+92 302 5554321",
      email: "fatima.accounts@workmanservices.pk",
      role: "accountant",
      department: "Finance & Accounts",
      salary: 110000,
      faceEnrolled: true,
    },
  });

  const bilal = await prisma.employee.create({
    data: {
      name: "Bilal Sheikh",
      phone: "+92 312 4443322",
      email: "bilal.store@workmanservices.pk",
      role: "storekeeper",
      department: "Warehouse & Inventory",
      salary: 60000,
      faceEnrolled: true,
    },
  });

  const sara = await prisma.employee.create({
    data: {
      name: "Sara Bilal",
      phone: "+92 334 6667788",
      email: "sara.callcenter@workmanservices.pk",
      role: "call_center",
      department: "Customer Experience & Outbound Audit",
      salary: 52000,
      faceEnrolled: true,
    },
  });

  const haris = await prisma.employee.create({
    data: {
      name: "Haris Qureshi",
      phone: "+92 300 8889900",
      email: "haris.admin@workmanservices.pk",
      role: "admin",
      department: "Executive Management",
      salary: 180000,
      faceEnrolled: true,
    },
  });

  // 4. Products & Stock (in PKR)
  console.log("Creating HVAC Inventory in PKR...");
  const productsData = [
    { sku: "PCB-INV-HAIER", name: "Haier/Gree 1.5-Ton Inverter PCB Main Board", unit: "unit", unitPrice: 14500, costPrice: 8500, stockQuantity: 24, reorderLevel: 5 },
    { sku: "GAS-R410A", name: "R410A Refrigerant Gas Cylinder (11.3kg Honeywell/Galco)", unit: "cylinder", unitPrice: 26000, costPrice: 18500, stockQuantity: 32, reorderLevel: 8 },
    { sku: "GAS-R32", name: "R32 Eco Inverter Refrigerant Cylinder (3kg)", unit: "cylinder", unitPrice: 11500, costPrice: 7500, stockQuantity: 28, reorderLevel: 6 },
    { sku: "THERM-DIGI", name: "Smart Digital Touch Thermostat (AC/Heat Pump)", unit: "unit", unitPrice: 8500, costPrice: 4500, stockQuantity: 42, reorderLevel: 8 },
    { sku: "COP-TUBE-12", name: "1/2 inch Copper Pipe Roll (15 meters Mueller Grade)", unit: "roll", unitPrice: 17500, costPrice: 12000, stockQuantity: 26, reorderLevel: 6 },
    { sku: "CAP-50-5UF", name: "Heavy-Duty Dual Run Capacitor 50+5 uF 450VAC", unit: "pack", unitPrice: 1800, costPrice: 850, stockQuantity: 65, reorderLevel: 15 },
    { sku: "DRAIN-PUMP", name: "Mini Condensate Drain Pump 220V", unit: "unit", unitPrice: 7200, costPrice: 4200, stockQuantity: 20, reorderLevel: 5 },
    { sku: "BAT-DRY-150", name: "Phoenix / Daewoo 150Ah Deep Cycle UPS Dry Battery", unit: "unit", unitPrice: 46000, costPrice: 38000, stockQuantity: 12, reorderLevel: 4 },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const prod = await prisma.product.create({ data: p });
    createdProducts.push(prod);
    // Initial stock ledger entry
    await prisma.stockLedger.create({
      data: {
        productId: prod.id,
        qty: prod.stockQuantity,
        direction: "in",
        refType: "opening_stock",
        notes: "Initial inventory setup for Pakistan operations",
      },
    });
  }

  // 5. Pakistani Customers & Commercial Accounts
  console.log("Creating Customers & Care-of Parties in Pakistan...");
  const c1 = await prisma.customer.create({
    data: {
      name: "Packages Mall Commercial Complex",
      phone: "+92 42 35884400",
      email: "facilities@packagesmall.com",
      addressText: "Walton Road, Gulberg III Extension, Lahore",
      lat: 31.4812,
      lng: 74.3546,
    },
  });

  const c2 = await prisma.customer.create({
    data: {
      name: "Pearl Continental Hotel",
      phone: "+92 42 111 505 505",
      email: "engineering@pclahore.com",
      addressText: "Shahrah-e-Quaid-e-Azam, Mall Road, Lahore",
      lat: 31.558,
      lng: 74.3317,
    },
  });

  const c3 = await prisma.customer.create({
    data: {
      name: "Defence Raya Golf Club Villa #42",
      phone: "+92 300 8451122",
      email: "khalid.mansoor@gmail.com",
      addressText: "Phase 6 DHA, Sector M Villa 42, Lahore",
      lat: 31.4589,
      lng: 74.451,
    },
  });

  const careOf1 = await prisma.careOfParty.create({
    data: {
      companyName: "Descon Facility Management Services",
      personName: "Engr. Khurram Shahzad",
      phone: "+92 42 35927000",
    },
  });

  // 6. Sample Jobs across lifecycle states in PKR
  console.log("Creating Jobs & Histories in PKR...");

  // Job 1: Completed & Verified (Packages Mall)
  const job1 = await prisma.job.create({
    data: {
      jobNumber: "JOB-2026-0001",
      customerId: c1.id,
      jobType: "installation",
      remarks: "Full VRV System Servicing & Compressor Replacement on Floor 2",
      status: "Verified",
      assignedTechnicianId: ali.id,
      verifiedAt: new Date(Date.now() - 3600000 * 4),
      finalizedAt: new Date(Date.now() - 3600000 * 6),
      verifiedChecklist: JSON.stringify({ workConfirmed: true, paymentReconciled: true, inventoryReturned: true }),
      qualityFlag: "clean",
      items: {
        create: [
          { description: "2-Ton Inverter Compressor Replacement", quantityPlanned: 1, quantityActual: 1, unitRate: 45000 },
          { description: "R410A Refrigerant Vacuum & Gas Recharge", quantityPlanned: 2, quantityActual: 2, unitRate: 14000 },
          { description: "Labor & Technical Commissioning", quantityPlanned: 4, quantityActual: 4, unitRate: 4500 },
        ],
      },
    },
  });

  await prisma.jobStatusHistory.createMany({
    data: [
      { jobId: job1.id, fromStatus: "None", toStatus: "Created", changedBy: "Zeeshan Ahmed", changedAt: new Date(Date.now() - 86400000) },
      { jobId: job1.id, fromStatus: "Created", toStatus: "Assigned", changedBy: "Zeeshan Ahmed", changedAt: new Date(Date.now() - 80000000) },
      { jobId: job1.id, fromStatus: "Assigned", toStatus: "Accepted", changedBy: "Ali Raza", changedAt: new Date(Date.now() - 75000000) },
      { jobId: job1.id, fromStatus: "Accepted", toStatus: "InProgress", changedBy: "Ali Raza", changedAt: new Date(Date.now() - 70000000) },
      { jobId: job1.id, fromStatus: "InProgress", toStatus: "CompletedPendingVerification", changedBy: "Ali Raza", changedAt: new Date(Date.now() - 20000000) },
      { jobId: job1.id, fromStatus: "CompletedPendingVerification", toStatus: "Finalized", changedBy: "Fatima Noor", changedAt: new Date(Date.now() - 15000000) },
      { jobId: job1.id, fromStatus: "Finalized", toStatus: "Verified", changedBy: "Haris Qureshi", changedAt: new Date(Date.now() - 14400000) },
    ],
  });

  await prisma.hisaabSettlement.create({
    data: {
      jobId: job1.id,
      technicianId: ali.id,
      amountExpected: 91000,
      amountCollected: 91000,
      isFull: true,
      balanceDue: 0,
      settledBy: "Fatima Noor",
      settledAt: new Date(Date.now() - 15000000),
    },
  });

  // Job 2: InProgress (Active right now at PC Hotel with Tariq Mehmood)
  const job2 = await prisma.job.create({
    data: {
      jobNumber: "JOB-2026-0002",
      customerId: c2.id,
      careOfPartyId: careOf1.id,
      manualJobNumber: "DSC-8812",
      jobType: "repair",
      remarks: "Chiller Air Handling Unit (AHU) Leakage and Thermostat Failure",
      status: "InProgress",
      assignedTechnicianId: tariq.id,
      items: {
        create: [
          { description: "Smart Digital Touch Thermostat Replacement", quantityPlanned: 2, quantityActual: null, unitRate: 8500 },
          { description: "1/2 inch Copper Pipe Section Repair", quantityPlanned: 1, quantityActual: null, unitRate: 7500 },
          { description: "Emergency HVAC Diagnostic & Leak Test Fee", quantityPlanned: 1, quantityActual: null, unitRate: 5000 },
        ],
      },
    },
  });

  await prisma.jobStatusHistory.createMany({
    data: [
      { jobId: job2.id, fromStatus: "None", toStatus: "Created", changedBy: "Zeeshan Ahmed", changedAt: new Date(Date.now() - 3600000 * 5) },
      { jobId: job2.id, fromStatus: "Created", toStatus: "Assigned", changedBy: "Zeeshan Ahmed", changedAt: new Date(Date.now() - 3600000 * 4) },
      { jobId: job2.id, fromStatus: "Assigned", toStatus: "Accepted", changedBy: "Tariq Mehmood", changedAt: new Date(Date.now() - 3600000 * 3) },
      { jobId: job2.id, fromStatus: "Accepted", toStatus: "InProgress", changedBy: "Tariq Mehmood", changedAt: new Date(Date.now() - 3600000 * 2) },
    ],
  });

  // Field expense logged by Tariq in PKR
  await prisma.jobExpenseClaim.create({
    data: {
      jobId: job2.id,
      technicianId: tariq.id,
      amount: 2800,
      note: "Urgent Teflon seals & flare nuts purchased from Brandreth Road hardware market",
      status: "pending",
    },
  });

  // Job 3: CompletedPendingVerification (Defence Raya Villa with Hamza)
  const job3 = await prisma.job.create({
    data: {
      jobNumber: "JOB-2026-0003",
      customerId: c3.id,
      jobType: "maintenance",
      remarks: "Annual Villa AC Duct Sanitization & Chemical Coil Service",
      status: "CompletedPendingVerification",
      assignedTechnicianId: hamza.id,
      items: {
        create: [
          { description: "Commercial Chemical Coil Wash", quantityPlanned: 4, quantityActual: 4, unitRate: 4500 },
          { description: "Deep Duct Cleaning & Sanitizing Service", quantityPlanned: 1, quantityActual: 1, unitRate: 16000 },
        ],
      },
    },
  });

  await prisma.jobStatusHistory.createMany({
    data: [
      { jobId: job3.id, fromStatus: "None", toStatus: "Created", changedBy: "Zeeshan Ahmed", changedAt: new Date(Date.now() - 3600000 * 8) },
      { jobId: job3.id, fromStatus: "Created", toStatus: "Assigned", changedBy: "Zeeshan Ahmed", changedAt: new Date(Date.now() - 3600000 * 7) },
      { jobId: job3.id, fromStatus: "Assigned", toStatus: "Accepted", changedBy: "Hamza Khan", changedAt: new Date(Date.now() - 3600000 * 6) },
      { jobId: job3.id, fromStatus: "Accepted", toStatus: "InProgress", changedBy: "Hamza Khan", changedAt: new Date(Date.now() - 3600000 * 4) },
      { jobId: job3.id, fromStatus: "InProgress", toStatus: "CompletedPendingVerification", changedBy: "Hamza Khan", changedAt: new Date(Date.now() - 3600000 * 1) },
    ],
  });

  // 7. Technician Ledger Entries (Single Netted Balance in PKR)
  console.log("Setting up Technician Ledgers in PKR...");
  await prisma.technicianLedgerEntry.createMany({
    data: [
      { technicianId: ali.id, type: "advance", amount: 25000, notes: "Weekly field cash advance / fuel float" },
      { technicianId: ali.id, type: "expense_owed", amount: 4500, notes: "Emergency flare nut fittings & transit toll reimbursement pending" },
      { technicianId: tariq.id, type: "advance", amount: 35000, notes: "Parts float advance for commercial PC Hotel chiller job" },
      { technicianId: tariq.id, type: "expense_owed", amount: 2800, notes: "Hardware store purchase on Job 2" },
      { technicianId: hamza.id, type: "advance", amount: 15000, notes: "Monthly motorcycle fuel advance" },
    ],
  });

  // 8. Attendance Logs in Lahore
  console.log("Logging Sample Attendance...");
  await prisma.attendanceLog.createMany({
    data: [
      {
        employeeId: ali.id,
        faceMatchScore: 97.4,
        lat: 31.5205,
        lng: 74.3588,
        geofenceZoneId: hqZone.id,
        result: "pass",
        notes: "Morning shift check-in: Verified via Face Biometrics (Gulberg HQ)",
      },
      {
        employeeId: tariq.id,
        faceMatchScore: 94.2,
        lat: 31.5206,
        lng: 74.3589,
        geofenceZoneId: hqZone.id,
        result: "pass",
        notes: "Morning shift check-in: Verified via Face Biometrics (Gulberg HQ)",
      },
      {
        employeeId: hamza.id,
        faceMatchScore: 78.5,
        lat: 31.42,
        lng: 74.25,
        geofenceZoneId: null,
        result: "fail",
        notes: "Face match score too low (78.5% < 90%) and outside geofence (nearest zone is 12.4km away)",
      },
    ],
  });

  // 9. Purchasing PR / PO / GRN in PKR
  console.log("Creating Sample Purchasing PR / PO in PKR...");
  const pr = await prisma.purchaseRequisition.create({
    data: {
      prNumber: "PR-2026-0012",
      requestedBy: "Bilal Sheikh",
      status: "approved",
      notes: "Stock replenishment for R410A Gas cylinders and Inverter PCBs before summer season peak",
      items: {
        create: [
          { productId: createdProducts[0].id, quantity: 10 },
          { productId: createdProducts[1].id, quantity: 15 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: "PO-2026-0008",
      prId: pr.id,
      supplierName: "Pak HVAC Supplies Trading Co. (Brandreth Road, Lahore)",
      supplierEmail: "sales@pakhvac.com.pk",
      status: "issued",
      totalAmount: 362500,
      items: {
        create: [
          { productId: createdProducts[0].id, quantity: 10, unitCost: 8500 },
          { productId: createdProducts[1].id, quantity: 15, unitCost: 18500 },
        ],
      },
    },
  });

  // 10. Commercial Projects & BOQ in PKR
  console.log("Creating BOQ Project in PKR...");
  await prisma.project.create({
    data: {
      projectNumber: "PRJ-2026-001",
      name: "Pearl Continental Hotel Chiller Retrofit & Air Balancing",
      customerId: c2.id,
      status: "active",
      totalBudget: 4800000,
      startDate: new Date("2026-08-15"),
      endDate: new Date("2026-10-30"),
      boqItems: {
        create: [
          { itemCode: "BOQ-01", description: "Rooftop Cooling Tower Air Balancing & Motor Rewinding", unit: "system", plannedQty: 2, unitRate: 850000 },
          { itemCode: "BOQ-02", description: "FCU Coil Chemical Decontamination across 80 Guest Rooms", unit: "unit", plannedQty: 80, unitRate: 15000 },
          { itemCode: "BOQ-03", description: "Variable Speed Drive (VFD) Inverter Calibration", unit: "panel", plannedQty: 4, unitRate: 120000 },
        ],
      },
    },
  });

  console.log("Workman Services Pakistan ERP Seed Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
