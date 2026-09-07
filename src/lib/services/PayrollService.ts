import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";

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
      // Calculate pending advance deduction (up to 50% of salary or full advance)
      const pendingAdvanceTotal = emp.advances.reduce((acc, curr) => acc + curr.amount, 0);
      const advanceDeduction = Math.min(pendingAdvanceTotal, gross * 0.4);

      // Check technician expense owed (if technician)
      let expenseAdj = 0;
      if (emp.role === "technician") {
        const expenseEntries = await prisma.technicianLedgerEntry.findMany({
          where: {
            technicianId: emp.id,
            type: "expense_owed",
          },
        });
        expenseAdj = expenseEntries.reduce((acc, curr) => acc + curr.amount, 0);
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
   * Debit Salary Expense, Credit Cash/Bank, Credit Advance Recovery
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

    // Accounts:
    const salaryExpenseAccount = await AccountsPostingService.getAccountByCode("6000"); // Salaries & Wages Expense
    const bankAccount = await AccountsPostingService.getAccountByCode("1000"); // Cash and Bank
    const advanceAccount = await AccountsPostingService.getAccountByCode("1150"); // Employee Advances (Asset)

    const lines = [
      { accountId: salaryExpenseAccount.id, debit: run.totalGross, credit: 0 },
      { accountId: bankAccount.id, debit: 0, credit: run.totalNet },
    ];

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

    // Mark advances as recovered
    for (const slip of run.payslips) {
      if (slip.advanceDeduction > 0) {
        await prisma.employeeAdvance.updateMany({
          where: { employeeId: slip.employeeId, status: "approved" },
          data: { status: "recovered" },
        });
      }
    }

    return await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "Paid" },
      include: { payslips: { include: { employee: true } } },
    });
  }
}
