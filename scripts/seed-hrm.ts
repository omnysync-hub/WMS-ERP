import { prisma } from "../src/lib/prisma";
import { HrmService } from "../src/lib/services/HrmService";

async function seedHrmData() {
  console.log("🌱 Seeding Workman Services Expanded HRM Data...");

  // 1. Ensure Holidays & Leave Types
  await HrmService.getCompanyHolidays();
  let employees: any[] = await prisma.employee.findMany();

  if (employees.length === 0) {
    console.log("No employees found to initialize. Creating initial staff...");
    const admin = await HrmService.createEmployee({
      name: "Haris Qureshi",
      phone: "+971 50 123 4567",
      email: "haris@workmanservices.ae",
      role: "admin",
      department: "Management",
      designation: "Managing Director",
      salary: 22000,
    });

    const accountant = await HrmService.createEmployee({
      name: "Fatima Noor",
      phone: "+971 50 234 5678",
      email: "fatima@workmanservices.ae",
      role: "accountant",
      department: "Accounts",
      designation: "Chief Financial Accountant",
      salary: 14000,
      reportingManagerId: admin.id,
    });

    const dispatcher = await HrmService.createEmployee({
      name: "Zainab Tariq",
      phone: "+971 50 345 6789",
      email: "zainab@workmanservices.ae",
      role: "dispatcher",
      department: "Operations",
      designation: "Lead Dispatcher & Fleet Controller",
      salary: 9500,
      reportingManagerId: admin.id,
    });

    const tech1 = await HrmService.createEmployee({
      name: "Ali Hassan",
      phone: "+971 50 456 7890",
      email: "ali.h@workmanservices.ae",
      role: "technician",
      department: "Operations",
      designation: "Senior HVAC Chiller Specialist",
      salary: 6500,
      reportingManagerId: dispatcher.id,
    });

    const tech2 = await HrmService.createEmployee({
      name: "Tariq Mahmood",
      phone: "+971 50 567 8901",
      email: "tariq.m@workmanservices.ae",
      role: "technician",
      department: "Operations",
      designation: "HVAC Duct & Installation Technician",
      salary: 5800,
      reportingManagerId: dispatcher.id,
    });

    const store = await HrmService.createEmployee({
      name: "Bilal Sheikh",
      phone: "+971 50 678 9012",
      email: "bilal@workmanservices.ae",
      role: "storekeeper",
      department: "Operations",
      designation: "Central Warehouse Storekeeper",
      salary: 6000,
      reportingManagerId: admin.id,
    });

    employees = [admin, accountant, dispatcher, tech1, tech2, store];
  } else {
    // Update designations and reporting chains if missing
    const admin = employees.find((e: any) => e.role === "admin") || employees[0];
    const dispatcher = employees.find((e: any) => e.role === "dispatcher");

    for (const emp of employees) {
      await HrmService.initEmployeeLeaveBalances(emp.id);
      await HrmService.seedOnboardingChecklist(emp.id);

      if (!emp.designation) {
        let des = "Operations Specialist";
        if (emp.role === "technician") des = "Senior HVAC Technician";
        if (emp.role === "accountant") des = "Chief Financial Accountant";
        if (emp.role === "dispatcher") des = "Lead Dispatcher & Fleet Controller";
        if (emp.role === "admin") des = "Managing Director";
        if (emp.role === "storekeeper") des = "Central Warehouse Storekeeper";

        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            designation: des,
            reportingManagerId: emp.id !== admin.id ? (emp.role === "technician" && dispatcher ? dispatcher.id : admin.id) : null,
          },
        });
      }
    }
  }

  // 2. Seed Assets
  const assetCount = await prisma.asset.count();
  if (assetCount === 0) {
    console.log("Seeding Company Assets...");
    const a1 = await HrmService.createAsset({
      tag: "AST-2026-001",
      name: "Field Laptop ThinkPad L14 Gen 4",
      category: "Laptops & Computing",
      purchaseDate: "2025-11-15",
    });

    const a2 = await HrmService.createAsset({
      tag: "AST-2026-002",
      name: "FieldPro Smart Diagnostic Tablet 10\"",
      category: "Field Computing",
      purchaseDate: "2026-01-10",
    });

    const a3 = await HrmService.createAsset({
      tag: "AST-2026-003",
      name: "Fieldpiece SM480V 4-Port Digital HVAC Manifold",
      category: "HVAC Testing Gauges",
      purchaseDate: "2025-08-20",
    });

    const a4 = await HrmService.createAsset({
      tag: "AST-2026-004",
      name: "Robinair RG6 Dual-Cylinder Refrigerant Recovery Unit",
      category: "Refrigeration Recovery Equipment",
      purchaseDate: "2025-09-05",
    });

    const a5 = await HrmService.createAsset({
      tag: "AST-2026-005",
      name: "Toyota HiAce Service Van (DX-52194)",
      category: "Company Vehicles",
      purchaseDate: "2024-03-12",
    });

    // Assign a couple to technicians and office staff
    const tech = employees.find((e: any) => e.role === "technician") || employees[0];
    const accountant = employees.find((e: any) => e.role === "accountant") || employees[1];

    await HrmService.assignAsset({
      assetId: a3.id,
      employeeId: tech.id,
      conditionNotes: "Calibrated digital gauges with temperature clamps issued",
      assignedBy: "Bilal Sheikh (Storekeeper)",
    });

    await HrmService.assignAsset({
      assetId: a1.id,
      employeeId: accountant.id,
      conditionNotes: "Configured with dual screens and ERP access",
      assignedBy: "Haris Qureshi (Director)",
    });
  }

  // 3. Seed Recruitment (Requisitions & Candidates)
  const reqCount = await prisma.jobRequisition.count();
  if (reqCount === 0) {
    console.log("Seeding Recruitment Requisitions & Candidates...");
    const r1 = await HrmService.createRequisition({
      role: "Commercial Chiller Lead Technician",
      department: "Operations",
      headcount: 2,
      reason: "Expansion of annual chiller maintenance contracts in Business Bay",
    });
    await HrmService.approveRequisition(r1.id, "Haris Qureshi (Director)");

    const r2 = await HrmService.createRequisition({
      role: "Junior HVAC Dispatcher & Coordinator",
      department: "Operations",
      headcount: 1,
      reason: "Peak summer customer call surge support",
    });

    // Candidates
    const c1 = await HrmService.createCandidate({
      requisitionId: r1.id,
      name: "Khurram Nawaz",
      phone: "+971 52 987 6543",
      email: "khurram.nawaz@example.com",
      stage: "Interview",
      notes: "7 years chiller overhaul experience at Trane Middle East. EPA Certified.",
    });

    await HrmService.scheduleInterview({
      candidateId: c1.id,
      scheduledAt: "2026-09-10T14:00:00Z",
      interviewer: "Zainab Tariq & Ali Hassan",
      notes: "Technical round: Chiller diagnostics and safety protocols.",
    });

    const c2 = await HrmService.createCandidate({
      requisitionId: r1.id,
      name: "Farhan Saeed",
      phone: "+971 55 876 5432",
      email: "farhan.s@example.com",
      stage: "Offer",
      notes: "Excellent technical interview. Offer letter prepared for $7,200/mo.",
    });

    await HrmService.createOffer({
      candidateId: c2.id,
      role: "Commercial Chiller Lead Technician",
      salary: 7200,
      startDate: "2026-10-01",
    });

    await HrmService.createCandidate({
      requisitionId: r2.id,
      name: "Sara Al-Hashimi",
      phone: "+971 50 765 4321",
      email: "sara.hashimi@example.com",
      stage: "Screening",
      notes: "Bilingual English/Arabic, 3 years fleet dispatch experience.",
    });
  }

  // 4. Seed Sample Leave Request
  const leaveCount = await prisma.leaveRequest.count();
  if (leaveCount === 0) {
    console.log("Seeding Sample Leave Requests...");
    const tech = employees.find((e: any) => e.role === "technician") || employees[0];
    const annualLeave = await prisma.leaveType.findFirst({ where: { name: "Annual Leave" } });

    if (annualLeave) {
      await HrmService.requestLeave({
        employeeId: tech.id,
        leaveTypeId: annualLeave.id,
        startDate: "2026-10-15",
        endDate: "2026-10-22",
        reason: "Annual family visit to home country",
      });
    }
  }

  // 5. Seed Sample Grievance Ticket
  const grvCount = await prisma.grievanceTicket.count();
  if (grvCount === 0) {
    console.log("Seeding Sample Grievance Ticket...");
    const tech = employees.find((e: any) => e.role === "technician") || employees[0];
    const ticket = await HrmService.raiseGrievanceTicket({
      employeeId: tech.id,
      category: "Equipment & Safety",
      description: "Air conditioning vacuum pump in Van 3 requires oil change and seal replacement before next commercial job.",
    });

    await HrmService.addGrievanceComment({
      ticketId: ticket.id,
      authorId: "bilal-sheikh",
      authorName: "Bilal Sheikh (Storekeeper)",
      comment: "Replacement vacuum oil and seal kit ordered. Will be ready tomorrow morning.",
    });
  }

  console.log("✅ HRM Seed completed successfully!");
}

seedHrmData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
