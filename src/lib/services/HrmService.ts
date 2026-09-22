import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

export class HrmService {
  // ==========================================
  // 1. CORE HR: EMPLOYEES & ORG CHART
  // ==========================================

  static async listEmployees(filter?: {
    tab?: "all" | "technicians" | "office" | "on_leave";
    department?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filter?.tab === "technicians") {
      where.role = "technician";
    } else if (filter?.tab === "office") {
      where.role = { not: "technician" };
    } else if (filter?.tab === "on_leave") {
      where.status = "On Leave";
    }

    if (filter?.department) {
      where.department = filter.department;
    }

    if (filter?.search) {
      const q = filter.search.trim().toLowerCase();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { designation: { contains: q } },
        { department: { contains: q } },
      ];
    }

    return await prisma.employee.findMany({
      where,
      include: {
        reportingManager: {
          select: { id: true, name: true, designation: true, role: true },
        },
        leaveBalances: {
          include: { leaveType: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getEmployee(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        reportingManager: {
          select: { id: true, name: true, designation: true, role: true, phone: true, email: true },
        },
        directReports: {
          select: { id: true, name: true, designation: true, department: true, status: true },
        },
        leaveBalances: {
          include: { leaveType: true },
        },
        leaveRequests: {
          include: { leaveType: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        assetAssignments: {
          include: { asset: true },
          orderBy: { assignedAt: "desc" },
        },
        payslips: {
          include: { payrollRun: true },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        onboardingChecklists: {
          orderBy: { createdAt: "asc" },
        },
        offboardingChecklists: {
          orderBy: { createdAt: "asc" },
        },
        exitInterview: true,
        finalSettlements: {
          orderBy: { createdAt: "desc" },
        },
        grievanceTickets: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!employee) return null;
    const { mobilePinHash, ...safeEmployee } = employee;
    return safeEmployee;
  }

  static async createEmployee(data: {
    name: string;
    phone: string;
    email?: string;
    role: string;
    department: string;
    designation?: string;
    employmentType?: string;
    salary?: number;
    reportingManagerId?: string;
    probationEndDate?: Date | string;
  }) {
    const employee = await prisma.employee.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: data.role,
        department: data.department,
        designation: data.designation || data.role,
        employmentType: data.employmentType || "Full-time",
        salary: data.salary || 0,
        reportingManagerId: data.reportingManagerId || null,
        status: "Active",
        probationStatus: data.probationEndDate ? "On Probation" : "Confirmed",
        probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
      },
    });

    // Auto-seed default leave balances
    await this.initEmployeeLeaveBalances(employee.id);

    // Auto-seed onboarding checklist
    await this.seedOnboardingChecklist(employee.id);

    const { mobilePinHash, ...safeEmployee } = employee;
    return safeEmployee;
  }

  static async updateEmployee(id: string, data: any) {
    const updated = await prisma.employee.update({
      where: { id },
      data,
    });
    const { mobilePinHash, ...safeEmployee } = updated;
    return safeEmployee;
  }

  static async getOrgHierarchy() {
    const employees = await prisma.employee.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        designation: true,
        status: true,
        reportingManagerId: true,
      },
    });

    const empMap = new Map<string, any>();
    employees.forEach((emp: any) => empMap.set(emp.id, { ...emp, directReports: [] }));

    const roots: any[] = [];

    employees.forEach((emp: any) => {
      const node = empMap.get(emp.id);
      if (emp.reportingManagerId && empMap.has(emp.reportingManagerId)) {
        empMap.get(emp.reportingManagerId).directReports.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // ==========================================
  // 2. LEAVE MANAGEMENT
  // ==========================================

  static async initEmployeeLeaveBalances(employeeId: string) {
    let leaveTypes = await prisma.leaveType.findMany();
    if (leaveTypes.length === 0) {
      // Seed default types
      leaveTypes = await Promise.all([
        prisma.leaveType.create({ data: { name: "Annual Leave", accrualRule: "22 days/year (prorated)", maxDays: 22 } }),
        prisma.leaveType.create({ data: { name: "Sick Leave", accrualRule: "15 days/year (certified)", maxDays: 15 } }),
        prisma.leaveType.create({ data: { name: "Casual Leave", accrualRule: "7 days/year", maxDays: 7 } }),
        prisma.leaveType.create({ data: { name: "Emergency Leave", accrualRule: "5 days/year", maxDays: 5 } }),
      ]);
    }

    for (const lt of leaveTypes) {
      const existing = await prisma.leaveBalance.findFirst({
        where: { employeeId, leaveTypeId: lt.id },
      });
      if (!existing) {
        await prisma.leaveBalance.create({
          data: {
            employeeId,
            leaveTypeId: lt.id,
            accrued: lt.maxDays,
            taken: 0,
            balance: lt.maxDays,
          },
        });
      }
    }
  }

  static async listLeaveRequests(filter?: {
    employeeId?: string;
    status?: string;
    reportingManagerId?: string;
  }) {
    const where: any = {};
    if (filter?.employeeId) where.employeeId = filter.employeeId;
    if (filter?.status) where.status = filter.status;
    if (filter?.reportingManagerId) {
      where.employee = { reportingManagerId: filter.reportingManagerId };
    }

    return await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, designation: true, department: true, role: true },
        },
        leaveType: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async requestLeave(data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // Check balance
    let balanceRecord = await prisma.leaveBalance.findFirst({
      where: { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId },
    });

    if (!balanceRecord) {
      await this.initEmployeeLeaveBalances(data.employeeId);
      balanceRecord = await prisma.leaveBalance.findFirst({
        where: { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId },
      });
    }

    if (balanceRecord && balanceRecord.balance < daysCount) {
      throw new Error(`Insufficient leave balance. Available: ${balanceRecord.balance} days, Requested: ${daysCount} days.`);
    }

    return await prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        daysCount,
        reason: data.reason,
        status: "Pending",
      },
      include: { leaveType: true, employee: true },
    });
  }

  static async approveLeave(requestId: string, approverName: string) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { leaveType: true, employee: true },
    });

    if (!req) throw new Error("Leave request not found");
    if (req.status !== "Pending") throw new Error(`Request is already ${req.status}`);

    // Deduct from balance
    const balance = await prisma.leaveBalance.findFirst({
      where: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId },
    });

    if (balance) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          taken: balance.taken + req.daysCount,
          balance: Math.max(0, balance.balance - req.daysCount),
        },
      });
    }

    // Check if leave covers today
    const now = new Date();
    if (now >= req.startDate && now <= req.endDate) {
      await prisma.employee.update({
        where: { id: req.employeeId },
        data: { status: "On Leave" },
      });
    }

    return await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "Approved",
        approvedBy: approverName,
        approvedAt: new Date(),
      },
      include: { leaveType: true, employee: true },
    });
  }

  static async rejectLeave(requestId: string, approverName: string, reason?: string) {
    return await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "Rejected",
        approvedBy: approverName,
        approvedAt: new Date(),
        reason: reason ? `[Rejected: ${reason}]` : undefined,
      },
      include: { leaveType: true, employee: true },
    });
  }

  static async getCompanyHolidays() {
    let holidays = await prisma.companyHoliday.findMany({
      orderBy: { date: "asc" },
    });

    if (holidays.length === 0) {
      holidays = await Promise.all([
        prisma.companyHoliday.create({ data: { name: "New Year's Day", date: new Date("2026-01-01"), description: "Federal Holiday" } }),
        prisma.companyHoliday.create({ data: { name: "Eid Al-Fitr Holiday 1", date: new Date("2026-03-20"), description: "National Public Holiday" } }),
        prisma.companyHoliday.create({ data: { name: "Eid Al-Fitr Holiday 2", date: new Date("2026-03-21"), description: "National Public Holiday" } }),
        prisma.companyHoliday.create({ data: { name: "Arafat Day", date: new Date("2026-05-26"), description: "Islamic Holiday" } }),
        prisma.companyHoliday.create({ data: { name: "Eid Al-Adha Holiday", date: new Date("2026-05-27"), description: "National Public Holiday" } }),
        prisma.companyHoliday.create({ data: { name: "Islamic New Year", date: new Date("2026-06-16"), description: "Federal Holiday" } }),
        prisma.companyHoliday.create({ data: { name: "Commemoration Day", date: new Date("2026-11-30"), description: "Martyrs' Day" } }),
        prisma.companyHoliday.create({ data: { name: "National Day", date: new Date("2026-12-02"), description: "National Holiday" } }),
      ]);
    }

    return holidays;
  }

  // ==========================================
  // 3. ASSET MANAGEMENT
  // ==========================================

  static async listAssets(filter?: {
    status?: "All" | "Assigned" | "In Storage" | "Under Repair";
    category?: string;
    search?: string;
  }) {
    const where: any = {};
    if (filter?.status && filter.status !== "All") {
      where.status = filter.status;
    }
    if (filter?.category) {
      where.category = filter.category;
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      where.OR = [
        { tag: { contains: q } },
        { name: { contains: q } },
        { category: { contains: q } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        assignments: {
          include: {
            employee: {
              select: { id: true, name: true, designation: true, department: true },
            },
          },
          orderBy: { assignedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { tag: "asc" },
    });

    return assets;
  }

  static async createAsset(data: {
    tag: string;
    name: string;
    category: string;
    purchaseDate?: string;
  }) {
    return await prisma.asset.create({
      data: {
        tag: data.tag,
        name: data.name,
        category: data.category,
        status: "In Storage",
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
      },
    });
  }

  static async assignAsset(data: {
    assetId: string;
    employeeId: string;
    conditionNotes?: string;
    assignedBy: string;
  }) {
    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) throw new Error("Asset not found");

    // Close any previous open assignment
    await prisma.assetAssignment.updateMany({
      where: { assetId: data.assetId, returnedAt: null },
      data: { returnedAt: new Date() },
    });

    // Create new immutable assignment
    await prisma.assetAssignment.create({
      data: {
        assetId: data.assetId,
        employeeId: data.employeeId,
        conditionNotes: data.conditionNotes || "Issued in working condition",
        assignedBy: data.assignedBy,
      },
    });

    // Update asset status
    return await prisma.asset.update({
      where: { id: data.assetId },
      data: {
        status: "Assigned",
        currentEmployeeId: data.employeeId,
      },
      include: {
        assignments: {
          include: { employee: true },
          take: 1,
          orderBy: { assignedAt: "desc" },
        },
      },
    });
  }

  static async returnAsset(data: {
    assetId: string;
    conditionNotes?: string;
  }) {
    await prisma.assetAssignment.updateMany({
      where: { assetId: data.assetId, returnedAt: null },
      data: {
        returnedAt: new Date(),
        conditionNotes: data.conditionNotes ? `[Return condition: ${data.conditionNotes}]` : "Returned in good condition",
      },
    });

    return await prisma.asset.update({
      where: { id: data.assetId },
      data: {
        status: "In Storage",
        currentEmployeeId: null,
      },
    });
  }

  // ==========================================
  // 4. ONBOARDING & OFFBOARDING
  // ==========================================

  static async seedOnboardingChecklist(employeeId: string) {
    const items = [
      { item: "National ID / Passport / Visa Copies Collected", owner: "HR Operations" },
      { item: "Work Email & ERP User Account Provisioned", owner: "IT Support" },
      { item: "Company ID Badge & Access Card Issued", owner: "Facilities" },
      { item: "PPE & Standard Toolset Issued & Acknowledged", owner: "Warehouse Store" },
      { item: "Company Policy & Health & Safety Induction Completed", owner: "HR Director" },
    ];

    for (const it of items) {
      const existing = await prisma.onboardingChecklist.findFirst({
        where: { employeeId, item: it.item },
      });
      if (!existing) {
        await prisma.onboardingChecklist.create({
          data: {
            employeeId,
            item: it.item,
            owner: it.owner,
            isDone: false,
          },
        });
      }
    }
  }

  static async seedOffboardingChecklist(employeeId: string) {
    const items = [
      { item: "Return all assigned company tools & equipment to Store", owner: "Storekeeper Bilal Sheikh" },
      { item: "Return company vehicle & fuel card (if applicable)", owner: "Fleet Coordinator" },
      { item: "Revoke ERP, email, and facility access permissions", owner: "IT Administrator" },
      { item: "Conduct Exit Interview Form & Feedback Submission", owner: "HR Manager" },
      { item: "Calculate & Post Final Settlement via Accounts Engine", owner: "Accountant Fatima Noor" },
    ];

    for (const it of items) {
      const existing = await prisma.offboardingChecklist.findFirst({
        where: { employeeId, item: it.item },
      });
      if (!existing) {
        await prisma.offboardingChecklist.create({
          data: {
            employeeId,
            item: it.item,
            owner: it.owner,
            isDone: false,
          },
        });
      }
    }
  }

  static async toggleChecklistItem(type: "onboarding" | "offboarding", itemId: string, isDone: boolean) {
    if (type === "onboarding") {
      return await prisma.onboardingChecklist.update({
        where: { id: itemId },
        data: {
          isDone,
          completedAt: isDone ? new Date() : null,
        },
      });
    } else {
      return await prisma.offboardingChecklist.update({
        where: { id: itemId },
        data: {
          isDone,
          completedAt: isDone ? new Date() : null,
        },
      });
    }
  }

  static async recordExitInterview(data: {
    employeeId: string;
    reason: string;
    feedback: string;
    rehireEligible: boolean;
  }) {
    return await prisma.exitInterview.upsert({
      where: { employeeId: data.employeeId },
      update: {
        reason: data.reason,
        feedback: data.feedback,
        rehireEligible: data.rehireEligible,
        completedAt: new Date(),
      },
      create: {
        employeeId: data.employeeId,
        reason: data.reason,
        feedback: data.feedback,
        rehireEligible: data.rehireEligible,
      },
    });
  }

  static async calculateAndPostFinalSettlement(data: {
    employeeId: string;
    proRatedSalary: number;
    leaveEncashmentDays: number;
    dailyRate: number;
    advanceDeduction: number;
    expenseAdjustment?: number;
    disbursingAccountCode?: string; // 1000 or 1010
    settledBy: string;
  }) {
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) throw new Error("Employee not found");

    const leaveEncashmentAmount = data.leaveEncashmentDays * data.dailyRate;
    const grossAmount = data.proRatedSalary + leaveEncashmentAmount;
    const deductions = data.advanceDeduction;
    const netAmount = Math.max(0, grossAmount - deductions + (data.expenseAdjustment || 0));

    // Get accounts via central AccountMappingService
    const salaryExpenseAcc = await AccountMappingService.resolveAccount({
      transactionType: "payroll_salaries_expense",
    });
    const disbursingAcc = data.disbursingAccountCode && data.disbursingAccountCode !== "1000"
      ? await AccountsPostingService.getAccountByCode(data.disbursingAccountCode)
      : await AccountMappingService.resolveAccount({
          transactionType: "payroll_net_disbursing",
        });
    const advanceAcc = await AccountMappingService.resolveAccount({
      transactionType: "payroll_advance_deduction",
    });

    const lines: any[] = [];

    // Debit Gross Salary & Exit Settlement Cost
    lines.push({
      accountId: salaryExpenseAcc.id,
      debit: grossAmount,
      credit: 0,
    });

    // Credit Advance Recovery if any
    if (deductions > 0) {
      lines.push({
        accountId: advanceAcc.id,
        debit: 0,
        credit: deductions,
      });
    }

    // Credit Cash / Bank Disbursal
    if (netAmount > 0) {
      lines.push({
        accountId: disbursingAcc.id,
        debit: 0,
        credit: netAmount,
      });
    }

    // Post through Spine
    const journal = await AccountsPostingService.post({
      memo: `Final Exit Settlement — ${employee.name} (${employee.designation || employee.role})`,
      refType: "final_settlement",
      refId: employee.id,
      lines,
    });

    // Record settlement entity
    const settlement = await prisma.finalSettlement.create({
      data: {
        employeeId: employee.id,
        grossAmount,
        advanceDeduction: deductions,
        expenseAdjustment: data.expenseAdjustment || 0,
        leaveEncashment: leaveEncashmentAmount,
        netAmount,
        status: "Paid",
        journalEntryId: journal.id,
      },
    });

    // Set employee status to Inactive (soft deletion)
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        status: "Inactive",
        active: false,
      },
    });

    return settlement;
  }

  // ==========================================
  // 5. RECRUITMENT / ATS
  // ==========================================

  static async listRequisitions(filter?: { status?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    return await prisma.jobRequisition.findMany({
      where,
      include: {
        candidates: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createRequisition(data: {
    role: string;
    department: string;
    headcount: number;
    reason: string;
  }) {
    const count = await prisma.jobRequisition.count();
    const requisitionNumber = `REQ-2026-${String(count + 1).padStart(3, "0")}`;

    return await prisma.jobRequisition.create({
      data: {
        requisitionNumber,
        role: data.role,
        department: data.department,
        headcount: Number(data.headcount) || 1,
        reason: data.reason,
        status: "Draft",
      },
    });
  }

  static async approveRequisition(id: string, approverName: string) {
    return await prisma.jobRequisition.update({
      where: { id },
      data: {
        status: "Approved",
        approvedBy: approverName,
      },
    });
  }

  static async listCandidates(filter?: { stage?: string; requisitionId?: string }) {
    const where: any = {};
    if (filter?.stage) where.stage = filter.stage;
    if (filter?.requisitionId) where.requisitionId = filter.requisitionId;

    return await prisma.candidate.findMany({
      where,
      include: {
        requisition: true,
        interviews: { orderBy: { scheduledAt: "desc" } },
        offers: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createCandidate(data: {
    requisitionId?: string;
    name: string;
    email?: string;
    phone: string;
    stage?: string;
    resumeUrl?: string;
    notes?: string;
  }) {
    return await prisma.candidate.create({
      data: {
        requisitionId: data.requisitionId || null,
        name: data.name,
        email: data.email,
        phone: data.phone,
        stage: data.stage || "Applied",
        resumeUrl: data.resumeUrl,
        notes: data.notes,
      },
      include: { requisition: true },
    });
  }

  static async updateCandidateStage(candidateId: string, newStage: string) {
    return await prisma.candidate.update({
      where: { id: candidateId },
      data: { stage: newStage },
    });
  }

  static async scheduleInterview(data: {
    candidateId: string;
    scheduledAt: string | Date;
    interviewer: string;
    notes?: string;
  }) {
    return await prisma.candidateInterview.create({
      data: {
        candidateId: data.candidateId,
        scheduledAt: new Date(data.scheduledAt),
        interviewer: data.interviewer,
        notes: data.notes,
      },
    });
  }

  static async createOffer(data: {
    candidateId: string;
    role: string;
    salary: number;
    startDate: string | Date;
  }) {
    return await prisma.offer.create({
      data: {
        candidateId: data.candidateId,
        role: data.role,
        salary: Number(data.salary),
        startDate: new Date(data.startDate),
        status: "Sent",
      },
    });
  }

  static async acceptOffer(offerId: string) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        candidate: {
          include: { requisition: true },
        },
      },
    });

    if (!offer) throw new Error("Offer not found");

    // 1. Mark Offer Accepted & Candidate Hired
    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: { status: "Accepted" },
    });

    await prisma.candidate.update({
      where: { id: offer.candidateId },
      data: { stage: "Hired" },
    });

    // 2. Convert Candidate into new Employee Record
    const dept = offer.candidate.requisition?.department || "Operations";
    const roleSlug = offer.role.toLowerCase().includes("tech")
      ? "technician"
      : offer.role.toLowerCase().includes("dispatch")
      ? "dispatcher"
      : offer.role.toLowerCase().includes("account")
      ? "accountant"
      : "office_staff";

    const newEmployee = await this.createEmployee({
      name: offer.candidate.name,
      phone: offer.candidate.phone,
      email: offer.candidate.email || undefined,
      role: roleSlug,
      department: dept,
      designation: offer.role,
      employmentType: "Full-time",
      salary: offer.salary,
      probationEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3-month probation
    });

    return { offer: updatedOffer, newEmployee };
  }

  // ==========================================
  // 6. GRIEVANCE / HR HELPDESK
  // ==========================================

  static async listGrievanceTickets(filter?: {
    employeeId?: string;
    status?: string;
    category?: string;
  }) {
    const where: any = {};
    if (filter?.employeeId) where.employeeId = filter.employeeId;
    if (filter?.status) where.status = filter.status;
    if (filter?.category) where.category = filter.category;

    return await prisma.grievanceTicket.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, designation: true, department: true, role: true },
        },
        comments: { orderBy: { createdAt: "asc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getGrievanceTicket(id: string) {
    return await prisma.grievanceTicket.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, designation: true, department: true, role: true, phone: true, email: true },
        },
        comments: { orderBy: { createdAt: "asc" } },
        statusHistory: { orderBy: { changedAt: "asc" } },
      },
    });
  }

  static async raiseGrievanceTicket(data: {
    employeeId: string;
    category: string;
    description: string;
  }) {
    const count = await prisma.grievanceTicket.count();
    const ticketNumber = `GRV-2026-${String(count + 1).padStart(3, "0")}`;

    const ticket = await prisma.grievanceTicket.create({
      data: {
        ticketNumber,
        employeeId: data.employeeId,
        category: data.category,
        description: data.description,
        status: "Open",
      },
      include: { employee: true },
    });

    // Record initial status history
    await prisma.grievanceStatusHistory.create({
      data: {
        ticketId: ticket.id,
        fromStatus: "None",
        toStatus: "Open",
        changedBy: ticket.employee.name,
      },
    });

    return ticket;
  }

  static async addGrievanceComment(data: {
    ticketId: string;
    authorId: string;
    authorName: string;
    comment: string;
  }) {
    return await prisma.grievanceComment.create({
      data: {
        ticketId: data.ticketId,
        authorId: data.authorId,
        authorName: data.authorName,
        comment: data.comment,
      },
    });
  }

  static async updateGrievanceStatus(data: {
    ticketId: string;
    newStatus: string;
    changedBy: string;
  }) {
    const ticket = await prisma.grievanceTicket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) throw new Error("Ticket not found");

    const updated = await prisma.grievanceTicket.update({
      where: { id: data.ticketId },
      data: { status: data.newStatus },
    });

    await prisma.grievanceStatusHistory.create({
      data: {
        ticketId: data.ticketId,
        fromStatus: ticket.status,
        toStatus: data.newStatus,
        changedBy: data.changedBy,
      },
    });

    return updated;
  }

  // ==========================================
  // 7. HR ANALYTICS & REPORTING
  // ==========================================

  static async getHrAnalytics() {
    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      deptBreakdown,
      openRequisitions,
      pendingGrievances,
      allOffboarded,
      allLeaveThisMonth,
      probationEndingSoon,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { active: true, status: "Active" } }),
      prisma.employee.count({ where: { status: "On Leave" } }),
      prisma.employee.groupBy({
        by: ["department"],
        _count: { id: true },
      }),
      prisma.jobRequisition.count({ where: { status: { in: ["Approved", "Open"] } } }),
      prisma.grievanceTicket.count({ where: { status: { in: ["Open", "In Progress"] } } }),
      prisma.employee.count({ where: { status: { in: ["Terminated", "Inactive"] } } }),
      prisma.leaveRequest.aggregate({
        where: { status: "Approved" },
        _sum: { daysCount: true },
      }),
      prisma.employee.findMany({
        where: {
          probationStatus: "On Probation",
          probationEndDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Within 30 days
          },
        },
        select: {
          id: true,
          name: true,
          designation: true,
          department: true,
          probationEndDate: true,
        },
      }),
    ]);

    const turnoverRate = totalEmployees > 0
      ? Number(((allOffboarded / totalEmployees) * 100).toFixed(1))
      : 0;

    return {
      headcount: {
        total: totalEmployees,
        active: activeEmployees,
        onLeave: onLeaveEmployees,
        byDepartment: deptBreakdown.map((d: any) => ({
          department: d.department,
          count: d._count.id,
        })),
      },
      turnoverRate,
      openRequisitions,
      leaveTakenThisMonth: allLeaveThisMonth._sum.daysCount || 0,
      pendingGrievances,
      probationEndingSoon,
    };
  }
}
