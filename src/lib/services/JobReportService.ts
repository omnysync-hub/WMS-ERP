import { prisma } from "@/lib/prisma";

export interface JobReportFilter {
  period?: "today" | "yesterday" | "this_week" | "this_month" | "custom";
  startDate?: string;
  endDate?: string;
  technicianId?: string;
  statusGroup?: "all" | "done" | "in_progress" | "left";
  jobType?: string;
}

export interface IssuedMaterialItem {
  id: string;
  item: string;
  sku?: string;
  unit?: string;
  qtyRequested: number;
  qtyIssued: number;
  qtyReturned: number;
  netConsumed: number;
  unitCost: number;
  totalCost: number;
  status: string;
  date?: string;
}

export interface JobTimestampMilestones {
  assignedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  pausedIntervals: Array<{ pausedAt: string; resumedAt: string | null; reason?: string }>;
  completedAt: string | null;
  finalizedAt: string | null;
  verifiedAt: string | null;
  totalActiveDurationMinutes: number;
  formattedDuration: string;
  lifecycleEvents: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedBy: string;
    changedAt: string;
    meta?: any;
  }>;
}

export interface DetailedJobReportItem {
  id: string;
  jobNumber: string;
  manualJobNumber?: string | null;
  jobType: string;
  status: string;
  statusGroup: "done" | "in_progress" | "left";
  qualityFlag?: string | null;
  createdAt: string;
  finalizedAt?: string | null;
  verifiedAt?: string | null;
  customer: {
    id: string;
    name: string;
    phone?: string;
    addressText?: string;
  };
  careOfParty?: {
    companyName: string;
    personName?: string;
  } | null;
  assignedTechnician?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
  remarks?: string | null;
  // Service lines
  items: Array<{
    id: string;
    description: string;
    quantityPlanned: number;
    quantityActual?: number | null;
    unitRate: number;
    total: number;
  }>;
  // Issued Materials & Returns
  issuedMaterials: IssuedMaterialItem[];
  materialsCostTotal: number;
  // Expenses & Cash
  expenses: Array<{
    id: string;
    amount: number;
    note: string;
    status: string;
    paidAt?: string | null;
    createdAt: string;
  }>;
  expensesTotal: number;
  expensesPaidTotal: number;
  expensesPendingTotal: number;
  hisaab: {
    amountExpected: number;
    amountCollected: number;
    balanceDue: number;
    isFull: boolean;
    settledAt?: string;
  } | null;
  // Financial Summary
  grossSubtotal: number;
  discountAmount: number;
  netBilled: number;
  estimatedProfitMargin: number;
  // Timestamps & Lifecycle Milestones
  timestamps: JobTimestampMilestones;
}

export interface TechnicianReportItem {
  technicianId: string;
  name: string;
  phone: string;
  designation?: string;
  totalAssigned: number;
  doneCount: number;
  inProgressCount: number;
  leftCount: number;
  completionRate: number;
  totalRevenueEarned: number;
  grossProfitGenerated: number;
  totalExpensesClaimed: number;
  totalExpensesPaid: number;
  totalExpensesPending: number;
  totalCashCollected: number;
  totalCashBalanceDue: number;
  materialsDrawnCount: number;
  materialsTotalCost: number;
  averageDurationMinutes: number;
  formattedAverageDuration: string;
  jobs: DetailedJobReportItem[];
  expenseClaims: Array<{
    id: string;
    jobId: string;
    jobNumber: string;
    amount: number;
    note: string;
    status: string;
    paidAt?: string | null;
    createdAt: string;
  }>;
  materialsDrawn: Array<{
    item: string;
    sku?: string;
    unit: string;
    qtyIssued: number;
    qtyReturned: number;
    netConsumed: number;
    totalCost: number;
    jobNumber: string;
    jobId: string;
    date: string;
  }>;
}

export class JobReportService {
  /**
   * Helper to compute start and end dates from period or custom strings
   */
  static parseDateRange(period?: string, startDateStr?: string, endDateStr?: string): { start: Date; end: Date; label: string } {
    const now = new Date();

    if (period === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { start, end, label: "Yesterday" };
    }

    if (period === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end, label: "This Week" };
    }

    if (period === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end, label: "This Month" };
    }

    if (period === "custom" && startDateStr) {
      const start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
      end.setHours(23, 59, 59, 999);
      return {
        start,
        end,
        label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      };
    }

    // Default to "today"
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end, label: "Today" };
  }

  /**
   * Extract comprehensive lifecycle milestones & active duration from JobStatusHistory
   */
  static extractJobTimestamps(job: any, historyList?: any[]): JobTimestampMilestones {
    const history = (historyList || job.statusHistory || []).slice().sort(
      (a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
    );

    let assignedAt: string | null = null;
    let acceptedAt: string | null = null;
    let startedAt: string | null = null;
    let completedAt: string | null = null;
    const pausedIntervals: Array<{ pausedAt: string; resumedAt: string | null; reason?: string }> = [];

    let currentPauseStart: string | null = null;
    let currentPauseReason: string | undefined = undefined;

    for (const h of history) {
      const to = h.toStatus;
      const time = new Date(h.changedAt).toISOString();

      if (to === "Assigned" && !assignedAt) {
        assignedAt = time;
      }
      if (to === "Accepted" && !acceptedAt) {
        acceptedAt = time;
      }
      if (to === "InProgress") {
        if (!startedAt) {
          startedAt = time;
        }
        if (currentPauseStart) {
          pausedIntervals.push({
            pausedAt: currentPauseStart,
            resumedAt: time,
            reason: currentPauseReason,
          });
          currentPauseStart = null;
          currentPauseReason = undefined;
        }
      }
      if (to === "Paused") {
        currentPauseStart = time;
        try {
          const meta = h.metaJson ? JSON.parse(h.metaJson) : null;
          currentPauseReason = meta?.reason || meta?.remarks || "Field pause";
        } catch {
          currentPauseReason = "Paused";
        }
      }
      if (["CompletedPendingVerification", "Finalized", "Verified"].includes(to)) {
        if (!completedAt) {
          completedAt = time;
        }
        if (currentPauseStart) {
          pausedIntervals.push({
            pausedAt: currentPauseStart,
            resumedAt: time,
            reason: currentPauseReason,
          });
          currentPauseStart = null;
        }
      }
    }

    if (currentPauseStart && job.status === "Paused") {
      pausedIntervals.push({
        pausedAt: currentPauseStart,
        resumedAt: null,
        reason: currentPauseReason,
      });
    }

    if (!assignedAt && job.assignedTechnicianId) {
      assignedAt = new Date(job.createdAt).toISOString();
    }
    if (!completedAt && (job.finalizedAt || job.verifiedAt)) {
      completedAt = new Date(job.finalizedAt || job.verifiedAt).toISOString();
    }

    // Compute active duration in minutes
    let totalActiveMinutes = 0;
    if (startedAt) {
      const startTime = new Date(startedAt).getTime();
      const endTime = completedAt ? new Date(completedAt).getTime() : Date.now();
      const totalElapsedMinutes = Math.max(0, Math.floor((endTime - startTime) / (1000 * 60)));

      let pausedMinutes = 0;
      for (const p of pausedIntervals) {
        const pStart = new Date(p.pausedAt).getTime();
        const pEnd = p.resumedAt ? new Date(p.resumedAt).getTime() : Date.now();
        pausedMinutes += Math.max(0, Math.floor((pEnd - pStart) / (1000 * 60)));
      }

      totalActiveMinutes = Math.max(0, totalElapsedMinutes - pausedMinutes);
    }

    const hours = Math.floor(totalActiveMinutes / 60);
    const mins = totalActiveMinutes % 60;
    const formattedDuration =
      totalActiveMinutes > 0
        ? hours > 0
          ? `${hours}h ${mins}m`
          : `${mins}m`
        : startedAt
        ? "Just started"
        : "Not started";

    const lifecycleEvents = history.map((h: any) => {
      let meta = null;
      try {
        meta = h.metaJson ? JSON.parse(h.metaJson) : null;
      } catch {
        // ignore
      }
      return {
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: h.changedBy,
        changedAt: new Date(h.changedAt).toISOString(),
        meta,
      };
    });

    return {
      assignedAt,
      acceptedAt,
      startedAt,
      pausedIntervals,
      completedAt,
      finalizedAt: job.finalizedAt ? new Date(job.finalizedAt).toISOString() : null,
      verifiedAt: job.verifiedAt ? new Date(job.verifiedAt).toISOString() : null,
      totalActiveDurationMinutes: totalActiveMinutes,
      formattedDuration,
      lifecycleEvents,
    };
  }

  /**
   * Generate comprehensive Job Report & Day Audit including rich technician breakdowns
   */
  static async generateReport(filter: JobReportFilter = {}) {
    const { start, end, label: rangeLabel } = this.parseDateRange(
      filter.period,
      filter.startDate,
      filter.endDate
    );

    const where: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (filter.technicianId && filter.technicianId !== "ALL") {
      where.assignedTechnicianId = filter.technicianId;
    }

    if (filter.jobType && filter.jobType !== "ALL") {
      where.jobType = filter.jobType;
    }

    const [jobs, allProducts, allTechnicians] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          customer: true,
          careOfParty: true,
          assignedTechnician: true,
          items: true,
          inventoryRequests: {
            orderBy: { createdAt: "desc" },
          },
          stockReturns: {
            orderBy: { createdAt: "desc" },
          },
          expenseClaims: {
            orderBy: { createdAt: "desc" },
          },
          hisaabSettlements: {
            orderBy: { settledAt: "desc" },
            take: 1,
          },
          statusHistory: {
            orderBy: { changedAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany().catch(() => []),
      prisma.employee.findMany({
        where: { role: "technician" },
      }).catch(() => []),
    ]);

    const productMap = new Map<string, any>();
    allProducts.forEach((p) => {
      productMap.set(p.id, p);
      productMap.set(p.name.toLowerCase(), p);
      productMap.set(p.sku.toLowerCase(), p);
    });

    const detailedJobs: DetailedJobReportItem[] = [];
    const materialAggregator = new Map<
      string,
      {
        itemName: string;
        sku?: string;
        unit?: string;
        totalRequested: number;
        totalIssued: number;
        totalReturned: number;
        netConsumed: number;
        estimatedCost: number;
        jobsList: Array<{
          jobId: string;
          jobNumber: string;
          customerName: string;
          techName: string;
          qtyIssued: number;
          qtyReturned: number;
          netConsumed: number;
        }>;
      }
    >();

    // Initialize map with all technicians
    const techPerformance = new Map<string, TechnicianReportItem>();
    for (const t of allTechnicians) {
      techPerformance.set(t.id, {
        technicianId: t.id,
        name: t.name,
        phone: t.phone,
        designation: t.designation || "HVAC Field Technician",
        totalAssigned: 0,
        doneCount: 0,
        inProgressCount: 0,
        leftCount: 0,
        completionRate: 0,
        totalRevenueEarned: 0,
        grossProfitGenerated: 0,
        totalExpensesClaimed: 0,
        totalExpensesPaid: 0,
        totalExpensesPending: 0,
        totalCashCollected: 0,
        totalCashBalanceDue: 0,
        materialsDrawnCount: 0,
        materialsTotalCost: 0,
        averageDurationMinutes: 0,
        formattedAverageDuration: "0m",
        jobs: [],
        expenseClaims: [],
        materialsDrawn: [],
      });
    }

    let totalRevenue = 0;
    let totalDiscounts = 0;
    let totalMaterialCost = 0;
    let totalExpenses = 0;
    let totalCashCollected = 0;
    let totalBalanceDue = 0;

    let doneCount = 0;
    let inProgressCount = 0;
    let leftCount = 0;
    let disputedCount = 0;

    for (const job of jobs) {
      // 1. Determine Status Group
      let statusGroup: "done" | "in_progress" | "left" = "left";
      if (["CompletedPendingVerification", "Finalized", "Verified"].includes(job.status)) {
        statusGroup = "done";
        doneCount++;
      } else if (["InProgress", "Paused"].includes(job.status)) {
        statusGroup = "in_progress";
        inProgressCount++;
      } else {
        statusGroup = "left";
        leftCount++;
      }

      if (job.qualityFlag === "disputed") {
        disputedCount++;
      }

      // 2. Financial calculation on service items
      let grossSubtotal = 0;
      const formattedItems = (job.items || []).map((it) => {
        const qty = it.quantityActual ?? it.quantityPlanned;
        const lineTotal = qty * it.unitRate;
        grossSubtotal += lineTotal;
        return {
          id: it.id,
          description: it.description,
          quantityPlanned: it.quantityPlanned,
          quantityActual: it.quantityActual,
          unitRate: it.unitRate,
          total: lineTotal,
        };
      });

      const discount = job.discountAmount || 0;
      const netBilled = Math.max(0, grossSubtotal - discount);
      totalRevenue += grossSubtotal;
      totalDiscounts += discount;

      // 3. Process Issued Materials & Stock Returns
      const issuedMaterials: IssuedMaterialItem[] = [];
      let jobMaterialCost = 0;

      for (const req of job.inventoryRequests || []) {
        const matchingProduct =
          productMap.get(req.item.toLowerCase()) ||
          allProducts.find((p) => req.item.toLowerCase().includes(p.name.toLowerCase()));

        const unitCost = matchingProduct?.costPrice || 0;
        const qtyIssued = req.status === "issued" ? req.qtyRequested : 0;

        const returnEntries = (job.stockReturns || []).filter(
          (sr) => sr.item.toLowerCase() === req.item.toLowerCase()
        );
        const qtyReturned = returnEntries.reduce((acc, r) => acc + r.qtyReturned, 0);
        const netConsumed = Math.max(0, qtyIssued - qtyReturned);
        const lineCost = netConsumed * unitCost;

        jobMaterialCost += lineCost;

        issuedMaterials.push({
          id: req.id,
          item: req.item,
          sku: matchingProduct?.sku,
          unit: matchingProduct?.unit || "units",
          qtyRequested: req.qtyRequested,
          qtyIssued,
          qtyReturned,
          netConsumed,
          unitCost,
          totalCost: lineCost,
          status: req.status,
          date: req.createdAt.toISOString(),
        });

        const key = req.item.toLowerCase().trim();
        const existing = materialAggregator.get(key);
        if (existing) {
          existing.totalRequested += req.qtyRequested;
          existing.totalIssued += qtyIssued;
          existing.totalReturned += qtyReturned;
          existing.netConsumed += netConsumed;
          existing.estimatedCost += lineCost;
          existing.jobsList.push({
            jobId: job.id,
            jobNumber: job.jobNumber,
            customerName: job.customer?.name || "Unknown",
            techName: job.assignedTechnician?.name || "Unassigned",
            qtyIssued,
            qtyReturned,
            netConsumed,
          });
        } else {
          materialAggregator.set(key, {
            itemName: matchingProduct?.name || req.item,
            sku: matchingProduct?.sku,
            unit: matchingProduct?.unit || "units",
            totalRequested: req.qtyRequested,
            totalIssued: qtyIssued,
            totalReturned: qtyReturned,
            netConsumed,
            estimatedCost: lineCost,
            jobsList: [
              {
                jobId: job.id,
                jobNumber: job.jobNumber,
                customerName: job.customer?.name || "Unknown",
                techName: job.assignedTechnician?.name || "Unassigned",
                qtyIssued,
                qtyReturned,
                netConsumed,
              },
            ],
          });
        }
      }

      totalMaterialCost += jobMaterialCost;

      // 4. Field Expenses
      const jobExpenses = (job.expenseClaims || []).map((exp) => ({
        id: exp.id,
        amount: exp.amount,
        note: exp.note,
        status: exp.status,
        paidAt: exp.paidAt ? exp.paidAt.toISOString() : null,
        createdAt: exp.createdAt.toISOString(),
      }));
      const jobExpensesTotal = jobExpenses.reduce((acc, e) => acc + e.amount, 0);
      const jobExpensesPaidTotal = jobExpenses
        .filter((e) => e.status === "paid")
        .reduce((acc, e) => acc + e.amount, 0);
      const jobExpensesPendingTotal = jobExpensesTotal - jobExpensesPaidTotal;
      totalExpenses += jobExpensesTotal;

      // 5. Hisaab / Cash Settlement
      const latestHisaab = job.hisaabSettlements?.[0] || null;
      let hisaabData = null;
      if (latestHisaab) {
        hisaabData = {
          amountExpected: latestHisaab.amountExpected,
          amountCollected: latestHisaab.amountCollected,
          balanceDue: latestHisaab.balanceDue,
          isFull: latestHisaab.isFull,
          settledAt: latestHisaab.settledAt.toISOString(),
        };
        totalCashCollected += latestHisaab.amountCollected;
        totalBalanceDue += latestHisaab.balanceDue;
      }

      // 6. Timestamps & Active Duration
      const timestamps = this.extractJobTimestamps(job, job.statusHistory);

      // 7. Estimated Profit Margin
      const totalDirectCost = jobMaterialCost + jobExpensesTotal;
      const profitMargin = netBilled - totalDirectCost;

      const detailedJobRecord: DetailedJobReportItem = {
        id: job.id,
        jobNumber: job.jobNumber,
        manualJobNumber: job.manualJobNumber,
        jobType: job.jobType,
        status: job.status,
        statusGroup,
        qualityFlag: job.qualityFlag,
        createdAt: job.createdAt.toISOString(),
        finalizedAt: job.finalizedAt?.toISOString() || null,
        verifiedAt: job.verifiedAt?.toISOString() || null,
        customer: {
          id: job.customer.id,
          name: job.customer.name,
          phone: job.customer.phone,
          addressText: job.customer.addressText,
        },
        careOfParty: job.careOfParty
          ? {
              companyName: job.careOfParty.companyName,
              personName: job.careOfParty.personName,
            }
          : null,
        assignedTechnician: job.assignedTechnician
          ? {
              id: job.assignedTechnician.id,
              name: job.assignedTechnician.name,
              phone: job.assignedTechnician.phone,
            }
          : null,
        remarks: job.remarks,
        items: formattedItems,
        issuedMaterials,
        materialsCostTotal: jobMaterialCost,
        expenses: jobExpenses,
        expensesTotal: jobExpensesTotal,
        expensesPaidTotal: jobExpensesPaidTotal,
        expensesPendingTotal: jobExpensesPendingTotal,
        hisaab: hisaabData,
        grossSubtotal,
        discountAmount: discount,
        netBilled,
        estimatedProfitMargin: profitMargin,
        timestamps,
      };

      detailedJobs.push(detailedJobRecord);

      // 8. Track Rich Technician Performance & Lifecycle
      if (job.assignedTechnician) {
        const techId = job.assignedTechnician.id;
        let tech = techPerformance.get(techId);
        if (!tech) {
          tech = {
            technicianId: techId,
            name: job.assignedTechnician.name,
            phone: job.assignedTechnician.phone,
            designation: "HVAC Field Technician",
            totalAssigned: 0,
            doneCount: 0,
            inProgressCount: 0,
            leftCount: 0,
            completionRate: 0,
            totalRevenueEarned: 0,
            grossProfitGenerated: 0,
            totalExpensesClaimed: 0,
            totalExpensesPaid: 0,
            totalExpensesPending: 0,
            totalCashCollected: 0,
            totalCashBalanceDue: 0,
            materialsDrawnCount: 0,
            materialsTotalCost: 0,
            averageDurationMinutes: 0,
            formattedAverageDuration: "0m",
            jobs: [],
            expenseClaims: [],
            materialsDrawn: [],
          };
        }

        tech.totalAssigned++;
        if (statusGroup === "done") {
          tech.doneCount++;
          // Revenue earned for company on completed jobs
          tech.totalRevenueEarned += netBilled;
          tech.grossProfitGenerated += profitMargin;
        } else if (statusGroup === "in_progress") {
          tech.inProgressCount++;
        } else {
          tech.leftCount++;
        }

        tech.totalExpensesClaimed += jobExpensesTotal;
        tech.totalExpensesPaid += jobExpensesPaidTotal;
        tech.totalExpensesPending += jobExpensesPendingTotal;

        if (latestHisaab) {
          tech.totalCashCollected += latestHisaab.amountCollected;
          tech.totalCashBalanceDue += latestHisaab.balanceDue;
        }

        tech.materialsDrawnCount += issuedMaterials.length;
        tech.materialsTotalCost += jobMaterialCost;

        // Push job reference
        tech.jobs.push(detailedJobRecord);

        // Record expense claims for this tech
        for (const exp of jobExpenses) {
          tech.expenseClaims.push({
            id: exp.id,
            jobId: job.id,
            jobNumber: job.jobNumber,
            amount: exp.amount,
            note: exp.note,
            status: exp.status,
            paidAt: exp.paidAt,
            createdAt: exp.createdAt,
          });
        }

        // Record materials drawn
        for (const mat of issuedMaterials) {
          tech.materialsDrawn.push({
            item: mat.item,
            sku: mat.sku,
            unit: mat.unit || "units",
            qtyIssued: mat.qtyIssued,
            qtyReturned: mat.qtyReturned,
            netConsumed: mat.netConsumed,
            totalCost: mat.totalCost,
            jobNumber: job.jobNumber,
            jobId: job.id,
            date: mat.date || job.createdAt.toISOString(),
          });
        }

        techPerformance.set(techId, tech);
      }
    }

    // Finalize technician averages and completion rates
    const technicianResults: TechnicianReportItem[] = Array.from(techPerformance.values()).map((t) => {
      const compRate = t.totalAssigned > 0 ? Math.round((t.doneCount / t.totalAssigned) * 100) : 0;
      const completedJobs = t.jobs.filter((j) => j.statusGroup === "done" && j.timestamps.totalActiveDurationMinutes > 0);
      const totalMinutes = completedJobs.reduce((acc, j) => acc + j.timestamps.totalActiveDurationMinutes, 0);
      const avgMinutes = completedJobs.length > 0 ? Math.round(totalMinutes / completedJobs.length) : 0;
      const avgHours = Math.floor(avgMinutes / 60);
      const avgRemMins = avgMinutes % 60;
      const formattedAvg =
        avgMinutes > 0 ? (avgHours > 0 ? `${avgHours}h ${avgRemMins}m` : `${avgRemMins}m`) : "—";

      return {
        ...t,
        completionRate: compRate,
        averageDurationMinutes: avgMinutes,
        formattedAverageDuration: formattedAvg,
      };
    }).sort((a, b) => b.totalAssigned - a.totalAssigned || b.doneCount - a.doneCount);

    let filteredJobsList = detailedJobs;
    if (filter.statusGroup && filter.statusGroup !== "all") {
      filteredJobsList = detailedJobs.filter((j) => j.statusGroup === filter.statusGroup);
    }

    const totalJobs = jobs.length;
    const completionRate = totalJobs > 0 ? Math.round((doneCount / totalJobs) * 100) : 0;
    const netBilledTotal = Math.max(0, totalRevenue - totalDiscounts);
    const grossMarginTotal = netBilledTotal - totalMaterialCost - totalExpenses;

    return {
      meta: {
        period: filter.period || "today",
        dateRangeLabel: rangeLabel,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        generatedAt: new Date().toISOString(),
      },
      summary: {
        totalJobs,
        doneCount,
        inProgressCount,
        leftCount,
        disputedCount,
        completionRate,
        totalRevenue,
        totalDiscounts,
        netBilled: netBilledTotal,
        totalMaterialCost,
        totalExpenses,
        grossMargin: grossMarginTotal,
        totalCashCollected,
        totalBalanceDue,
      },
      materialsBreakdown: Array.from(materialAggregator.values()).sort(
        (a, b) => b.totalIssued - a.totalIssued
      ),
      technicianBreakdown: technicianResults,
      jobsDetailed: filteredJobsList,
    };
  }
}
