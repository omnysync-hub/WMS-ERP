import { prisma } from "../src/lib/prisma";

async function populateReportsDemo() {
  console.log("===============================================================");
  console.log("POPULATING WORKMAN SERVICES ERP WITH RICH REPORT DEMO DATA");
  console.log("===============================================================\n");

  const now = new Date();
  // Today: Sep 11, 2026
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  // 1. Ensure Technicians
  console.log("Step 1: Ensuring 5 field technicians...");
  const techData = [
    { name: "Ali Raza", phone: "+92 300 8451122", designation: "Lead HVAC Chiller Specialist" },
    { name: "Tariq Mehmood", phone: "+92 321 4455889", designation: "Senior Split & VRF Tech" },
    { name: "Hamza Khan", phone: "+92 333 7894561", designation: "Commercial Ducting & Ventilation Tech" },
    { name: "Usman Farooq", phone: "+92 312 9988776", designation: "Field Diagnostic Specialist" },
    { name: "Bilal Siddiqui", phone: "+92 345 6677889", designation: "Junior Refrigeration Tech" },
  ];

  const technicians: any[] = [];
  for (const t of techData) {
    let existing = await prisma.employee.findFirst({ where: { name: t.name } });
    if (!existing) {
      existing = await prisma.employee.create({
        data: {
          name: t.name,
          phone: t.phone,
          designation: t.designation,
          role: "technician",
          department: "Field Engineering & Service",
          status: "Active",
          salary: 65000,
          active: true,
        },
      });
    }
    technicians.push(existing);
  }

  // 2. Ensure Customers
  console.log("Step 2: Ensuring commercial & residential customers...");
  const custData = [
    { name: "Packages Mall Commercial Complex", phone: "+92 42 38303000", addressText: "Walton Road, Gulberg III, Lahore" },
    { name: "Emporium Mall Mega Center", phone: "+92 42 35750000", addressText: "Abdul Haque Rd, Johar Town, Lahore" },
    { name: "Gulberg Business Bay Towers", phone: "+92 42 35789000", addressText: "Main Boulevard, Gulberg II, Lahore" },
    { name: "DHA Phase 5 Luxury Villa 142", phone: "+92 300 1234567", addressText: "Street 8, Sector C, DHA Phase 5, Lahore" },
    { name: "Shaukat Khanum Diagnostic Center", phone: "+92 42 35905000", addressText: "7A Block R-3, Johar Town, Lahore" },
    { name: "Nishat Apparel & Textile HQ", phone: "+92 42 35777777", addressText: "21 Nisbet Road, Lahore" },
    { name: "Beaconhouse School System Campus", phone: "+92 42 35889900", addressText: "Canal Bank Road, Garden Town, Lahore" },
  ];

  const customers: any[] = [];
  for (const c of custData) {
    let existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (!existing) {
      existing = await prisma.customer.create({
        data: {
          name: c.name,
          phone: c.phone,
          addressText: c.addressText,
        },
      });
    }
    customers.push(existing);
  }

  // 3. Ensure Products / Warehouse Parts
  console.log("Step 3: Ensuring warehouse products & inventory...");
  const productData = [
    { sku: "COP-050", name: "Copper Piping 1/2 inch (Muller USA)", unit: "meters", unitPrice: 1850, costPrice: 1200, stockQuantity: 240 },
    { sku: "GAS-410", name: "R410A Refrigerant Gas (DuPont/Chemours 11.3kg)", unit: "cylinders", unitPrice: 24000, costPrice: 16500, stockQuantity: 35 },
    { sku: "CAP-45", name: "Capacitor 45uF 450V (Shizuki Japan)", unit: "pcs", unitPrice: 1250, costPrice: 750, stockQuantity: 120 },
    { sku: "CON-024", name: "Contactor 24V 2-Pole (Schneider Electric)", unit: "pcs", unitPrice: 3200, costPrice: 2100, stockQuantity: 80 },
    { sku: "FLT-2424", name: "Air Filter Media 24x24 MERV 11 Washable", unit: "pcs", unitPrice: 2800, costPrice: 1600, stockQuantity: 150 },
    { sku: "THM-DIG", name: "Digital Programmable Thermostat (Honeywell)", unit: "units", unitPrice: 8500, costPrice: 5200, stockQuantity: 45 },
    { sku: "DRN-PMP", name: "Mini Condensate Drain Pump (Sauermann)", unit: "units", unitPrice: 14500, costPrice: 9500, stockQuantity: 25 },
    { sku: "CMP-015", name: "Rotary Compressor 1.5 Ton (GMCC Toshiba)", unit: "units", unitPrice: 42000, costPrice: 29000, stockQuantity: 18 },
  ];

  for (const p of productData) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (!existing) {
      await prisma.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          unitPrice: p.unitPrice,
          costPrice: p.costPrice,
          stockQuantity: p.stockQuantity,
          reorderLevel: 10,
        },
      });
    }
  }

  // Helper to create a fully hydrated job with status history, materials, expenses, and hisaab
  let jobCounter = 100;
  async function createDetailedJob(params: {
    createdAt: Date;
    customerIdx: number;
    techIdx: number;
    jobType: string;
    remarks: string;
    status: string;
    qualityFlag?: string;
    items: Array<{ description: string; qty: number; rate: number }>;
    materials?: Array<{ item: string; qtyReq: number; qtyRet: number; status: string }>;
    expenses?: Array<{ note: string; amount: number; status: "paid" | "pending"; paidMinutesAfter?: number }>;
    hisaab?: { expected: number; collected: number; balance: number; isFull: boolean };
    timeline: {
      assignedMinutesAfter?: number;
      acceptedMinutesAfter?: number;
      startedMinutesAfter?: number;
      pauses?: Array<{ startMinutesAfter: number; endMinutesAfter: number; reason: string }>;
      completedMinutesAfter?: number;
    };
  }) {
    jobCounter++;
    const jobNumber = `JOB-2026-${String(jobCounter).padStart(4, "0")}`;
    const cust = customers[params.customerIdx % customers.length];
    const tech = technicians[params.techIdx % technicians.length];

    const finalizedAt =
      ["CompletedPendingVerification", "Finalized", "Verified"].includes(params.status) && params.timeline.completedMinutesAfter
        ? new Date(params.createdAt.getTime() + params.timeline.completedMinutesAfter * 60 * 1000)
        : null;

    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId: cust.id,
        jobType: params.jobType,
        remarks: params.remarks,
        status: params.status,
        qualityFlag: params.qualityFlag || null,
        assignedTechnicianId: tech.id,
        createdAt: params.createdAt,
        finalizedAt,
        verifiedAt: params.status === "Verified" ? finalizedAt : null,
        items: {
          create: params.items.map((it) => ({
            description: it.description,
            quantityPlanned: it.qty,
            quantityActual: it.qty,
            unitRate: it.rate,
          })),
        },
      },
    });

    // 1. Build Status History Chronology
    const historyEvents: Array<{ from: string; to: string; time: Date; meta?: any }> = [
      { from: "None", to: "Created", time: params.createdAt },
    ];

    if (params.timeline.assignedMinutesAfter !== undefined) {
      historyEvents.push({
        from: "Created",
        to: "Assigned",
        time: new Date(params.createdAt.getTime() + params.timeline.assignedMinutesAfter * 60 * 1000),
        meta: { technicianId: tech.id, technicianName: tech.name },
      });
    }

    if (params.timeline.acceptedMinutesAfter !== undefined) {
      historyEvents.push({
        from: "Assigned",
        to: "Accepted",
        time: new Date(params.createdAt.getTime() + params.timeline.acceptedMinutesAfter * 60 * 1000),
        meta: { channel: "mobile_app" },
      });
    }

    if (params.timeline.startedMinutesAfter !== undefined) {
      historyEvents.push({
        from: "Accepted",
        to: "InProgress",
        time: new Date(params.createdAt.getTime() + params.timeline.startedMinutesAfter * 60 * 1000),
        meta: { lat: 31.5204, lng: 74.3587, note: "Technician arrived on site and clocked in" },
      });
    }

    if (params.timeline.pauses && params.timeline.pauses.length > 0) {
      for (const p of params.timeline.pauses) {
        historyEvents.push({
          from: "InProgress",
          to: "Paused",
          time: new Date(params.createdAt.getTime() + p.startMinutesAfter * 60 * 1000),
          meta: { reason: p.reason },
        });

        if (p.endMinutesAfter) {
          historyEvents.push({
            from: "Paused",
            to: "InProgress",
            time: new Date(params.createdAt.getTime() + p.endMinutesAfter * 60 * 1000),
            meta: { reason: "Resumed on-site execution" },
          });
        }
      }
    }

    if (params.timeline.completedMinutesAfter !== undefined) {
      historyEvents.push({
        from: "InProgress",
        to: params.status,
        time: new Date(params.createdAt.getTime() + params.timeline.completedMinutesAfter * 60 * 1000),
        meta: { signOffBy: cust.name, qualityVerified: true },
      });
    }

    // Insert history
    for (const h of historyEvents) {
      await prisma.jobStatusHistory.create({
        data: {
          jobId: job.id,
          fromStatus: h.from,
          toStatus: h.to,
          changedBy: tech.name,
          changedAt: h.time,
          metaJson: h.meta ? JSON.stringify(h.meta) : null,
        },
      });
    }

    // 2. Inventory Requests & Returns
    if (params.materials && params.materials.length > 0) {
      for (const m of params.materials) {
        await prisma.inventoryRequest.create({
          data: {
            jobId: job.id,
            technicianId: tech.id,
            item: m.item,
            qtyRequested: m.qtyReq,
            status: m.status,
            createdAt: new Date(params.createdAt.getTime() + 15 * 60 * 1000),
          },
        });

        if (m.qtyRet > 0) {
          await prisma.stockReturn.create({
            data: {
              jobId: job.id,
              technicianId: tech.id,
              item: m.item,
              qtyReturned: m.qtyRet,
              acknowledgedBy: "Storekeeper Tariq",
              acknowledgedAt: finalizedAt || new Date(),
              createdAt: finalizedAt || new Date(),
            },
          });
        }
      }
    }

    // 3. Expenses
    if (params.expenses && params.expenses.length > 0) {
      for (const exp of params.expenses) {
        const paidAt =
          exp.status === "paid" && exp.paidMinutesAfter !== undefined
            ? new Date(params.createdAt.getTime() + exp.paidMinutesAfter * 60 * 1000)
            : null;

        await prisma.jobExpenseClaim.create({
          data: {
            jobId: job.id,
            technicianId: tech.id,
            amount: exp.amount,
            note: exp.note,
            status: exp.status,
            paidAt,
            createdAt: new Date(params.createdAt.getTime() + 30 * 60 * 1000),
          },
        });
      }
    }

    // 4. Hisaab
    if (params.hisaab) {
      await prisma.hisaabSettlement.create({
        data: {
          jobId: job.id,
          technicianId: tech.id,
          amountExpected: params.hisaab.expected,
          amountCollected: params.hisaab.collected,
          balanceDue: params.hisaab.balance,
          isFull: params.hisaab.isFull,
          settledBy: "Finance Officer Bilal",
          settledAt: finalizedAt || new Date(),
        },
      });
    }

    return job;
  }

  console.log("Step 4: Generating TODAY'S jobs (Done, In-Progress, Left, Paused, Disputed)...");

  // ==========================================
  // TODAY'S JOBS (Sep 11, 2026)
  // ==========================================

  // Job 1: TODAY DONE - Chiller Overhaul (Ali Raza)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 8, 0, 0),
    customerIdx: 0, // Packages Mall
    techIdx: 0, // Ali Raza
    jobType: "repair",
    remarks: "Chiller circuit 2 pressure test and R410A gas recharging complete",
    status: "Finalized",
    items: [
      { description: "Chiller Circuit 2 Nitrogen Pressure Leak Test & Braze Repair", qty: 1, rate: 25000 },
      { description: "R410A Refrigerant Full System Recharging", qty: 2, rate: 24000 },
    ],
    materials: [
      { item: "R410A Refrigerant Gas (DuPont/Chemours 11.3kg)", qtyReq: 2, qtyRet: 0, status: "issued" },
      { item: "Copper Piping 1/2 inch (Muller USA)", qtyReq: 10, qtyRet: 2, status: "issued" },
    ],
    expenses: [
      { note: "Fuel reimbursement for field diesel generator", amount: 2400, status: "paid", paidMinutesAfter: 240 },
    ],
    hisaab: { expected: 73000, collected: 73000, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 15, // 8:15 AM
      acceptedMinutesAfter: 25, // 8:25 AM
      startedMinutesAfter: 45, // 8:45 AM
      completedMinutesAfter: 210, // 11:30 AM (active duration: ~2h 45m)
    },
  });

  // Job 2: TODAY DONE - VRF Sensor & Contactor Replacement (Hamza Khan)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 8, 30, 0),
    customerIdx: 1, // Emporium Mall
    techIdx: 2, // Hamza Khan
    jobType: "maintenance",
    remarks: "Replacement of faulty 24V contactor and digital thermostat recalibration",
    status: "Verified",
    items: [
      { description: "VRF Outdoor Unit Diagnostic & Contactor Replacement", qty: 1, rate: 12000 },
      { description: "Digital Thermostat Wiring & Calibration", qty: 1, rate: 8500 },
    ],
    materials: [
      { item: "Contactor 24V 2-Pole (Schneider Electric)", qtyReq: 1, qtyRet: 0, status: "issued" },
      { item: "Digital Programmable Thermostat (Honeywell)", qtyReq: 1, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Taxi fare for rapid transit to Emporium", amount: 1100, status: "paid", paidMinutesAfter: 150 },
    ],
    hisaab: { expected: 20500, collected: 20500, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 10, // 8:40 AM
      acceptedMinutesAfter: 20, // 8:50 AM
      startedMinutesAfter: 40, // 9:10 AM
      completedMinutesAfter: 140, // 10:50 AM (active duration: ~1h 40m)
    },
  });

  // Job 3: TODAY DONE - Villa Split AC Capacitor & Chemical Wash (Usman Farooq)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 9, 0, 0),
    customerIdx: 3, // DHA Villa
    techIdx: 3, // Usman Farooq
    jobType: "repair",
    remarks: "Master bedroom split AC compressor not turning on. Replaced 45uF capacitor and foam washed coils.",
    status: "CompletedPendingVerification",
    items: [
      { description: "Outdoor Condenser Chemical Hydro-Wash", qty: 2, rate: 3500 },
      { description: "45uF Compressor Run Capacitor Replacement", qty: 1, rate: 3200 },
    ],
    materials: [
      { item: "Capacitor 45uF 450V (Shizuki Japan)", qtyReq: 1, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "High-pressure washer hose clamp emergency buy", amount: 650, status: "pending" },
    ],
    hisaab: { expected: 10200, collected: 10200, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 15, // 9:15 AM
      acceptedMinutesAfter: 25, // 9:25 AM
      startedMinutesAfter: 50, // 9:50 AM
      completedMinutesAfter: 150, // 11:30 AM (active duration: ~1h 40m)
    },
  });

  // Job 4: TODAY DONE - Air Filter Media Retrofit (Tariq Mehmood)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 9, 30, 0),
    customerIdx: 4, // Shaukat Khanum
    techIdx: 1, // Tariq Mehmood
    jobType: "maintenance",
    remarks: "Clinical lab air handling unit MERV 11 filter swap and static pressure testing",
    status: "Finalized",
    items: [
      { description: "AHU Filter Media Extraction & Sanitized Replacement", qty: 4, rate: 4500 },
      { description: "Blower Motor Belt Tensioning & Bearing Greasing", qty: 1, rate: 6000 },
    ],
    materials: [
      { item: "Air Filter Media 24x24 MERV 11 Washable", qtyReq: 4, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Sanitization PPE and gloves pack", amount: 800, status: "paid", paidMinutesAfter: 120 },
    ],
    hisaab: { expected: 24000, collected: 20000, balance: 4000, isFull: false },
    timeline: {
      assignedMinutesAfter: 10,
      acceptedMinutesAfter: 20,
      startedMinutesAfter: 45,
      completedMinutesAfter: 130, // active: ~1h 25m
    },
  });

  // Job 5: TODAY IN-PROGRESS - Shaukat Khanum AHU Overhaul (Active right now - Ali Raza)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 10, 0, 0),
    customerIdx: 2, // Gulberg Business Bay
    techIdx: 0, // Ali Raza
    jobType: "maintenance",
    remarks: "Tower B Central Cooling Coil descaling and drain pump installation",
    status: "InProgress",
    items: [
      { description: "Central Cooling Coil Chemical Flush & Descaling", qty: 1, rate: 28000 },
      { description: "Mini Condensate Drain Pump Retrofit", qty: 1, rate: 16500 },
    ],
    materials: [
      { item: "Mini Condensate Drain Pump (Sauermann)", qtyReq: 1, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Copper tube fittings & flare nuts emergency buy", amount: 1450, status: "pending" },
    ],
    timeline: {
      assignedMinutesAfter: 15, // 10:15 AM
      acceptedMinutesAfter: 25, // 10:25 AM
      startedMinutesAfter: 45, // 10:45 AM - active right now
    },
  });

  // Job 6: TODAY PAUSED - Waiting for Warehouse Compressor (Tariq Mehmood)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 10, 15, 0),
    customerIdx: 5, // Nishat HQ
    techIdx: 1, // Tariq Mehmood
    jobType: "repair",
    remarks: "Server room AC compressor seized. Tech on site, paused awaiting compressor dispatch from central store.",
    status: "Paused",
    items: [
      { description: "1.5 Ton Compressor Extraction & Replacement", qty: 1, rate: 48000 },
      { description: "Nitrogen Flushing & Dehydration Vacuuming", qty: 1, rate: 8000 },
    ],
    materials: [
      { item: "Rotary Compressor 1.5 Ton (GMCC Toshiba)", qtyReq: 1, qtyRet: 0, status: "issued" },
      { item: "Copper Piping 1/2 inch (Muller USA)", qtyReq: 8, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Forklift crane rental contribution", amount: 3500, status: "pending" },
    ],
    timeline: {
      assignedMinutesAfter: 10,
      acceptedMinutesAfter: 20,
      startedMinutesAfter: 40,
      pauses: [
        {
          startMinutesAfter: 90,
          endMinutesAfter: 0, // currently paused
          reason: "Waiting for 1.5-ton compressor delivery from central warehouse",
        },
      ],
    },
  });

  // Job 7: TODAY PAUSED - Facility Power Outage (Hamza Khan)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 10, 30, 0),
    customerIdx: 6, // Beaconhouse
    techIdx: 2, // Hamza Khan
    jobType: "repair",
    remarks: "Auditorium package unit vibration noise. Paused due to scheduled campus generator maintenance.",
    status: "Paused",
    items: [
      { description: "Package Unit Blower Impeller Dynamic Balancing", qty: 1, rate: 15000 },
    ],
    timeline: {
      assignedMinutesAfter: 15,
      acceptedMinutesAfter: 25,
      startedMinutesAfter: 50,
      pauses: [
        {
          startMinutesAfter: 80,
          endMinutesAfter: 0,
          reason: "Site electrical shutdown by facility manager until 2:00 PM",
        },
      ],
    },
  });

  // Job 8: TODAY LEFT / PENDING - Assigned, Tech in Transit (Bilal Siddiqui)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 11, 0, 0),
    customerIdx: 3, // DHA Villa
    techIdx: 4, // Bilal Siddiqui
    jobType: "inspection",
    remarks: "Pre-event full cooling inspection of 6 split units across guest wing",
    status: "Assigned",
    items: [
      { description: "Comprehensive HVAC Seasonal Diagnostic Audit", qty: 6, rate: 2500 },
    ],
    timeline: {
      assignedMinutesAfter: 10, // Assigned at 11:10 AM, not yet accepted/started
    },
  });

  // Job 9: TODAY LEFT / PENDING - Accepted, Awaiting Dispatch Departure (Usman Farooq)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 11, 15, 0),
    customerIdx: 1, // Emporium Mall
    techIdx: 3, // Usman Farooq
    jobType: "repair",
    remarks: "Food court exhaust hood motor tripping circuit breaker",
    status: "Accepted",
    items: [
      { description: "Commercial Exhaust Motor Thermal Overload Relay Replacement", qty: 1, rate: 18000 },
    ],
    timeline: {
      assignedMinutesAfter: 5,
      acceptedMinutesAfter: 15, // Accepted on mobile app, driving to site
    },
  });

  // Job 10: TODAY LEFT / UNASSIGNED (Created only)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 11, 30, 0),
    customerIdx: 0, // Packages Mall
    techIdx: 0,
    jobType: "maintenance",
    remarks: "Quarterly duct sanitization and UV lamp inspection request",
    status: "Created",
    items: [
      { description: "Quarterly Duct UV Germicidal Lamp Inspection", qty: 12, rate: 1500 },
    ],
    timeline: {},
  });

  // Job 11: TODAY DISPUTED / FLAGGED (Ali Raza)
  await createDetailedJob({
    createdAt: new Date(year, month, date, 7, 30, 0),
    customerIdx: 4, // Shaukat Khanum
    techIdx: 0, // Ali Raza
    jobType: "repair",
    remarks: "Post-service cooling variance noticed by pharmacy cold-storage manager. Recalled tech for re-calibration.",
    status: "CompletedPendingVerification",
    qualityFlag: "disputed",
    items: [
      { description: "Ultra-Low Temp Cold Room Temperature Sensor Diagnostic", qty: 1, rate: 22000 },
    ],
    materials: [
      { item: "Contactor 24V 2-Pole (Schneider Electric)", qtyReq: 1, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Rapid emergency transit fuel", amount: 1500, status: "paid", paidMinutesAfter: 100 },
    ],
    hisaab: { expected: 22000, collected: 15000, balance: 7000, isFull: false },
    timeline: {
      assignedMinutesAfter: 10,
      acceptedMinutesAfter: 20,
      startedMinutesAfter: 35,
      completedMinutesAfter: 140,
    },
  });

  // ==========================================
  // YESTERDAY'S JOBS (Sep 10, 2026)
  // ==========================================
  console.log("Step 5: Generating YESTERDAY'S completed jobs & historical data...");

  // Yesterday Job 1: Ali Raza - Nishat HQ
  await createDetailedJob({
    createdAt: new Date(year, month, date - 1, 9, 0, 0),
    customerIdx: 5,
    techIdx: 0,
    jobType: "maintenance",
    remarks: "Annual maintenance of central chillers and condenser fan belts",
    status: "Finalized",
    items: [
      { description: "Chiller Fan Belt Alignment & Bearing Lubrication", qty: 4, rate: 6500 },
      { description: "Condenser Coil High-Pressure Jet Cleaning", qty: 2, rate: 8500 },
    ],
    materials: [
      { item: "Air Filter Media 24x24 MERV 11 Washable", qtyReq: 6, qtyRet: 1, status: "issued" },
    ],
    expenses: [
      { note: "Fuel for site pressure washer", amount: 1800, status: "paid", paidMinutesAfter: 180 },
    ],
    hisaab: { expected: 43000, collected: 43000, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 15,
      acceptedMinutesAfter: 30,
      startedMinutesAfter: 60,
      completedMinutesAfter: 240, // 3 hours active
    },
  });

  // Yesterday Job 2: Hamza Khan - Gulberg Business Bay
  await createDetailedJob({
    createdAt: new Date(year, month, date - 1, 10, 30, 0),
    customerIdx: 2,
    techIdx: 2,
    jobType: "installation",
    remarks: "New split AC piping and installation for 4th floor executive suite",
    status: "Verified",
    items: [
      { description: "2-Ton Inverter Split AC Installation & Mounting", qty: 2, rate: 9500 },
      { description: "Heavy Duty Concealed Copper Piping Route", qty: 25, rate: 1850 },
    ],
    materials: [
      { item: "Copper Piping 1/2 inch (Muller USA)", qtyReq: 25, qtyRet: 3, status: "issued" },
      { item: "Mini Condensate Drain Pump (Sauermann)", qtyReq: 2, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Scaffolding ladder transport pickup", amount: 2200, status: "paid", paidMinutesAfter: 150 },
    ],
    hisaab: { expected: 65250, collected: 65250, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 15,
      acceptedMinutesAfter: 30,
      startedMinutesAfter: 60,
      completedMinutesAfter: 310, // ~4h 10m
    },
  });

  // Yesterday Job 3: Tariq Mehmood - Beaconhouse Campus
  await createDetailedJob({
    createdAt: new Date(year, month, date - 1, 12, 0, 0),
    customerIdx: 6,
    techIdx: 1,
    jobType: "repair",
    remarks: "Staff room AC water leakage into false ceiling. Replaced cracked drain pan and flushed line.",
    status: "Finalized",
    items: [
      { description: "Drain Pan Repair & Chemical Cleanout", qty: 1, rate: 7500 },
    ],
    expenses: [
      { note: "PVC cement and drain hose couplings", amount: 550, status: "paid", paidMinutesAfter: 90 },
    ],
    hisaab: { expected: 7500, collected: 7500, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 10,
      acceptedMinutesAfter: 20,
      startedMinutesAfter: 40,
      completedMinutesAfter: 110,
    },
  });

  // ==========================================
  // EARLIER THIS WEEK (Sep 8 - Sep 9, 2026)
  // ==========================================
  console.log("Step 6: Generating earlier week jobs for weekly and monthly reports...");

  // Week Job 1: Usman Farooq - Shaukat Khanum
  await createDetailedJob({
    createdAt: new Date(year, month, date - 3, 9, 0, 0),
    customerIdx: 4,
    techIdx: 3,
    jobType: "repair",
    remarks: "MRI chiller secondary cooling pump seal replacement",
    status: "Finalized",
    items: [
      { description: "Mechanical Pump Shaft Seal Replacement & Alignment", qty: 1, rate: 35000 },
    ],
    materials: [
      { item: "Contactor 24V 2-Pole (Schneider Electric)", qtyReq: 2, qtyRet: 0, status: "issued" },
    ],
    expenses: [
      { note: "Mechanical lathe workshop pressing fee", amount: 4500, status: "paid", paidMinutesAfter: 200 },
    ],
    hisaab: { expected: 35000, collected: 35000, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 15,
      acceptedMinutesAfter: 30,
      startedMinutesAfter: 60,
      completedMinutesAfter: 280,
    },
  });

  // Week Job 2: Bilal Siddiqui - DHA Villa
  await createDetailedJob({
    createdAt: new Date(year, month, date - 2, 11, 0, 0),
    customerIdx: 3,
    techIdx: 4,
    jobType: "maintenance",
    remarks: "Bi-monthly filter and coil maintenance for ground floor AC units",
    status: "Verified",
    items: [
      { description: "Split AC Chemical Cleaning & Gas Pressure Check", qty: 4, rate: 3500 },
    ],
    hisaab: { expected: 14000, collected: 14000, balance: 0, isFull: true },
    timeline: {
      assignedMinutesAfter: 10,
      acceptedMinutesAfter: 20,
      startedMinutesAfter: 45,
      completedMinutesAfter: 160,
    },
  });

  console.log("\n===============================================================");
  console.log("DEMO DATA POPULATION COMPLETED SUCCESSFULLY!");
  console.log("===============================================================");
}

populateReportsDemo()
  .catch((e) => {
    console.error("Error populating demo data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
