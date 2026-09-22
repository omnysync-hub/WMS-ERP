import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

export class FiscalPeriodService {
  /**
   * Seed 12 monthly fiscal periods for a given fiscal year.
   * startMonth: 1 = January, 7 = July (standard in Pakistan).
   */
  static async seedFiscalYear(fiscalYear: number, startMonth: number = 7) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const periods = [];
    for (let p = 1; p <= 12; p++) {
      // Calculate month index (0-based)
      const currentMonthIndex = (startMonth - 1 + (p - 1)) % 12;
      // Year calculation: if startMonth is July (7) and period is 7 (January), year is fiscalYear
      const calYear = startMonth === 1 ? fiscalYear : (currentMonthIndex < startMonth - 1 ? fiscalYear : fiscalYear - 1);

      const startDate = new Date(Date.UTC(calYear, currentMonthIndex, 1, 0, 0, 0));
      // Last day of month
      const endDate = new Date(Date.UTC(calYear, currentMonthIndex + 1, 0, 23, 59, 59, 999));
      const name = `${monthNames[currentMonthIndex]} ${calYear} (FY${fiscalYear}-P${String(p).padStart(2, "0")})`;

      const existing = await prisma.fiscalPeriod.findFirst({
        where: {
          fiscalYear,
          periodNumber: p,
        },
      });

      if (!existing) {
        const created = await prisma.fiscalPeriod.create({
          data: {
            fiscalYear,
            periodNumber: p,
            name,
            startDate,
            endDate,
            status: "open",
          },
        });
        periods.push(created);
      } else {
        periods.push(existing);
      }
    }

    return periods;
  }

  /**
   * Look up the active fiscal period for a specific transaction date.
   */
  static async getPeriodForDate(date: Date) {
    return await prisma.fiscalPeriod.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  /**
   * Close a monthly fiscal period.
   * Prevents standard posting into this month.
   */
  static async closeMonth(periodId: string, closedBy: string) {
    const period = await prisma.fiscalPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) throw new Error("Fiscal period not found");
    if (period.status === "locked") throw new Error("Period is already permanently locked.");

    const updated = await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: "closed",
        closedBy,
        closedAt: new Date(),
      },
    });

    await prisma.financialAuditLog.create({
      data: {
        entity: "FiscalPeriod",
        entityId: period.id,
        action: "CLOSE_PERIOD",
        beforeValue: JSON.stringify({ status: period.status }),
        afterValue: JSON.stringify({ status: "closed", closedBy }),
        userName: closedBy,
        userRole: "accountant",
      },
    });

    return updated;
  }

  /**
   * Reopen a closed fiscal period (Requires Admin role).
   */
  static async reopenPeriod(periodId: string, reopenedBy: string) {
    const period = await prisma.fiscalPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) throw new Error("Fiscal period not found");
    if (period.status === "locked") throw new Error("Permanently locked periods cannot be reopened.");

    const updated = await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: "open",
        closedBy: null,
        closedAt: null,
      },
    });

    await prisma.financialAuditLog.create({
      data: {
        entity: "FiscalPeriod",
        entityId: period.id,
        action: "REOPEN_PERIOD",
        beforeValue: JSON.stringify({ status: period.status }),
        afterValue: JSON.stringify({ status: "open", reopenedBy }),
        userName: reopenedBy,
        userRole: "admin",
      },
    });

    return updated;
  }

  /**
   * Year-End Close Routine (SAP-FICO / GAAP Standard):
   * 1. Computes total balances for all Revenue (type: "revenue", "contra_revenue") and Expense ("expense") accounts.
   * 2. Generates a balanced closing JournalEntry that zeroes all revenue and expense accounts into 3200 Retained Earnings.
   * 3. Permanently sets status = "locked" for all 12 periods of that fiscal year.
   */
  static async closeYear(fiscalYear: number, closedBy: string) {
    const periods = await prisma.fiscalPeriod.findMany({
      where: { fiscalYear },
      orderBy: { periodNumber: "asc" },
    });

    if (periods.length === 0) {
      throw new Error(`No fiscal periods found for fiscal year ${fiscalYear}.`);
    }

    const startOfFY = periods[0].startDate;
    const endOfFY = periods[periods.length - 1].endDate;

    // Fetch all nominal accounts (Revenue & Expense) with their journal lines for this fiscal year
    const nominalAccounts = await prisma.account.findMany({
      where: {
        type: { in: ["revenue", "contra_revenue", "expense"] },
        isActive: true,
      },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              date: {
                gte: startOfFY,
                lte: endOfFY,
              },
              status: { in: ["posted", "reversal"] },
            },
          },
        },
      },
    });

    // Calculate closing balance for each nominal account
    const closingLines: Array<{ accountId: string; debit: number; credit: number }> = [];
    let netIncome = 0; // Total Revenue - Total Expenses

    for (const acc of nominalAccounts) {
      let balance = 0;
      for (const line of acc.journalLines) {
        if (acc.type === "revenue") {
          balance += line.credit - line.debit;
        } else if (acc.type === "contra_revenue" || acc.type === "expense") {
          balance += line.debit - line.credit;
        }
      }

      const roundedBal = Math.round(balance * 100) / 100;
      if (Math.abs(roundedBal) > 0.01) {
        if (acc.type === "revenue") {
          // Zero out revenue: Debit Revenue for balance, Credit Retained Earnings
          closingLines.push({ accountId: acc.id, debit: roundedBal, credit: 0 });
          netIncome += roundedBal;
        } else if (acc.type === "contra_revenue" || acc.type === "expense") {
          // Zero out expense: Credit Expense for balance, Debit Retained Earnings
          closingLines.push({ accountId: acc.id, debit: 0, credit: roundedBal });
          netIncome -= roundedBal;
        }
      }
    }

    // Offset net income into Retained Earnings via AccountMappingService
    const retainedEarningsAcc = await AccountMappingService.resolveAccount({ transactionType: "retained_earnings_equity" });
    const roundedNetIncome = Math.round(netIncome * 100) / 100;

    if (roundedNetIncome > 0) {
      // Net Profit: Credit Retained Earnings
      closingLines.push({ accountId: retainedEarningsAcc.id, debit: 0, credit: roundedNetIncome });
    } else if (roundedNetIncome < 0) {
      // Net Loss: Debit Retained Earnings
      closingLines.push({ accountId: retainedEarningsAcc.id, debit: Math.abs(roundedNetIncome), credit: 0 });
    }

    let closingVoucher = null;
    if (closingLines.length > 0) {
      closingVoucher = await AccountsPostingService.post({
        date: endOfFY,
        memo: `[YEAR-END CLOSE] FY${fiscalYear} Zeroing Revenue & Expenses into Retained Earnings`,
        refType: "year_end_close",
        refId: `FY${fiscalYear}`,
        postedBy: closedBy,
        bypassPeriodLock: true, // Year-end close posts right on boundary
        lines: closingLines,
      });
    }

    // Permanently lock all periods of this fiscal year
    await prisma.fiscalPeriod.updateMany({
      where: { fiscalYear },
      data: {
        status: "locked",
        closedBy,
        closedAt: new Date(),
      },
    });

    await prisma.financialAuditLog.create({
      data: {
        entity: "FiscalYear",
        entityId: `FY${fiscalYear}`,
        action: "CLOSE_YEAR",
        afterValue: JSON.stringify({
          fiscalYear,
          netIncome: roundedNetIncome,
          closingVoucherId: closingVoucher?.id,
          closedBy,
        }),
        userName: closedBy,
        userRole: "admin",
      },
    });

    return {
      success: true,
      fiscalYear,
      netIncome: roundedNetIncome,
      closingVoucher,
      lockedPeriodsCount: periods.length,
    };
  }

  static async listPeriods(fiscalYear: number) {
    return await prisma.fiscalPeriod.findMany({
      where: { fiscalYear },
      orderBy: { periodNumber: "asc" },
    });
  }

  static async lockPeriod(periodId: string, closedBy: string) {
    return await this.closeMonth(periodId, closedBy);
  }

  static async runYearEndClose(fiscalYear: number, closedBy: string) {
    return await this.closeYear(fiscalYear, closedBy);
  }
}
