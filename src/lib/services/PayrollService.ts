import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

export class PayrollService {
  /**
   * Calculate a draft payroll run for a given month/period
   */
  static async createDraftRun(period: string) {
    const existing = await prisma.payrollRun.findFirst({
      where: { period },
    });
    if (existing) {
      throw new Error(`Payroll run for period '${period}' already exists with status '${existing.status}'.`);
    }

    const employees = await prisma.employee.findMany({
      where: { active: true },
      include: { advances: { where: { status: "approved" } } },
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    const payslipData = [];

    for (const emp of employees) {
      const gross = emp.salary;
      // Calculate pending advance deduction (up to 40% of salary or full advance)
      const pendingAdvanceTotal = emp.advances.reduce((acc, curr) => acc + curr.amount, 0);
      const advanceDeduction = Math.min(pendingAdvanceTotal, gross * 0.4);

      // Net outstanding expense_owed after expense_paid clearances (LOGICS sections 4/6)
      let expenseAdj = 0;
      if (emp.role === "technician") {
        const expenseEntries = await prisma.technicianLedgerEntry.findMany({
          where: {
            technicianId: emp.id,
            type: { in: ["expense_owed", "expense_paid"] },
          },
        });
        let owed = 0;
        let paid = 0;
        for (const entry of expenseEntries) {
          if (entry.type === "expense_owed") owed += entry.amount;
          else paid += entry.amount;
        }
        expenseAdj = Math.max(0, Math.round((owed - paid) * 100) / 100);
      }

      const net = Math.round((gross - advanceDeduction + expenseAdj) * 100) / 100;

      totalGross += gross;
      totalDeductions += advanceDeduction;
      totalNet += net;

      payslipData.push({
        employeeId: emp.id,
        grossSalary: gross,
        advanceDeduction,
        expenseAdjustment: expenseAdj,
        netSalary: net,
        status: "generated",
      });
    }

    const run = await prisma.payrollRun.create({
      data: {
        period,
        status: "Draft",
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        payslips: {
          create: payslipData,
        },
      },
      include: { payslips: { include: { employee: true } } },
    });

    return run;
  }

  /**
   * Approve payroll run
   */
  static async approveRun(payrollRunId: string, approverName: string) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "Draft") {
      throw new Error(`Only Draft runs can be approved. Current status: ${run.status}`);
    }

    return await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: "Approved",
        approvedBy: approverName,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Disburse & Pay payroll run:
   * Posts to Accounts Posting Engine:
   * Debit Salary Expense, Debit Tech Payable (expenseAdj), Credit Cash/Bank, Credit Advance Recovery
   * Journal lines are balanced explicitly: debits == credits.
   */
  static async disburseRun(payrollRunId: string) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: true },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "Approved") {
      throw new Error(`Payroll must be 'Approved' before disbursement. Current status: ${run.status}`);
    }

    const totalExpenseAdj = Math.round(
      run.payslips.reduce((sum, s) => sum + (s.expenseAdjustment || 0), 0) * 100
    ) / 100;

    // Accounts via AccountMappingService:
    const salaryExpenseAccount = await AccountMappingService.resolveAccount({
      transactionType: "payroll_salaries_expense",
    });
    const bankAccount = await AccountMappingService.resolveAccount({
      transactionType: "payroll_net_disbursing",
    });
    const advanceAccount = await AccountMappingService.resolveAccount({
      transactionType: "payroll_advance_deduction",
    });

    // Balanced journal:
    //   Dr Salary Expense     totalGross
    //   Dr Tech Payable       totalExpenseAdj   (settle expense_owed liability into net pay)
    //   Cr Bank / Cash        totalNet
    //   Cr Advance Recovery   totalDeductions
    // Debits = totalGross + totalExpenseAdj
    // Credits = totalNet + totalDeductions = (totalGross - totalDeductions + totalExpenseAdj) + totalDeductions
    const lines: { accountId: string; debit: number; credit: number }[] = [
      { accountId: salaryExpenseAccount.id, debit: run.totalGross, credit: 0 },
    ];

    if (totalExpenseAdj > 0) {
      const techPayableAccount = await AccountMappingService.resolveAccount({
        transactionType: "tech_expense_settlement_payable",
      });
      lines.push({ accountId: techPayableAccount.id, debit: totalExpenseAdj, credit: 0 });
    }

    lines.push({ accountId: bankAccount.id, debit: 0, credit: run.totalNet });

    if (run.totalDeductions > 0) {
      lines.push({ accountId: advanceAccount.id, debit: 0, credit: run.totalDeductions });
    }

    await AccountsPostingService.post({
      memo: `Payroll disbursement for period ${run.period}`,
      refType: "payroll",
      refId: run.id,
      lines,
    });

    // Mark payslips as paid
    await prisma.payslip.updateMany({
      where: { payrollRunId },
      data: { status: "paid" },
    });

    // Settle expense_owed included in this run (expense_paid clears them per LOGICS section 4)
    // and recover advances only for the amount actually deducted this run (partial-safe).
    for (const slip of run.payslips) {
      if (slip.expenseAdjustment > 0) {
        await prisma.technicianLedgerEntry.create({
          data: {
            technicianId: slip.employeeId,
            type: "expense_paid",
            amount: slip.expenseAdjustment,
            notes: `Settled via payroll run ${run.period} (${run.id})`,
          },
        });
      }

      if (slip.advanceDeduction > 0) {
        let remainingToRecover = slip.advanceDeduction;
        const advances = await prisma.employeeAdvance.findMany({
          where: { employeeId: slip.employeeId, status: "approved" },
          orderBy: { createdAt: "asc" },
        });

        for (const adv of advances) {
          if (remainingToRecover <= 0) break;

          if (remainingToRecover >= adv.amount) {
            // Full recovery of this advance row
            await prisma.employeeAdvance.update({
              where: { id: adv.id },
              data: { status: "recovered" },
            });
            remainingToRecover = Math.round((remainingToRecover - adv.amount) * 100) / 100;
          } else {
            // Partial recovery: mark deducted portion recovered, leave remainder approved
            // (same split pattern as JobsService.clearExpense)
            const recoveredAmount = remainingToRecover;
            const remainderAmount = Math.round((adv.amount - recoveredAmount) * 100) / 100;

            await prisma.employeeAdvance.update({
              where: { id: adv.id },
              data: {
                amount: recoveredAmount,
                status: "recovered",
              },
            });

            await prisma.employeeAdvance.create({
              data: {
                employeeId: adv.employeeId,
                amount: remainderAmount,
                status: "approved",
                approvedBy: adv.approvedBy,
              },
            });

            remainingToRecover = 0;
          }
        }
      }
    }

    return await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "Paid" },
      include: { payslips: { include: { employee: true } } },
    });
  }
}
