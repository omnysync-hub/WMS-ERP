import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

export class PayrollService {
  /**
   * Calculate a draft payroll run for a given month/period
   */
  static async createDraftRun(period: string, overwrite = false) {
    const existing = await prisma.payrollRun.findFirst({
      where: { period },
    });
    if (existing) {
      if (existing.status !== "Draft") {
        throw new Error(`Payroll run for period '${period}' already exists with status '${existing.status}'.`);
      }
      if (!overwrite) {
        throw new Error(`A draft payroll run for '${period}' already exists. You can review it or delete it to recalculate.`);
      }
      // Clean up previous draft run
      await prisma.payrollRun.delete({ where: { id: existing.id } });
    }

    const employees = await prisma.employee.findMany({
      // Only salaried staff get a payslip (ERP-login employees created without a salary are skipped).
      where: { active: true, salary: { gt: 0 } },
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
      let settledClaimIds: string[] = [];
      if (emp.role === "technician") {
        // Remember exactly which carried-forward claims this payslip settles, so a claim added
        // after the payslip is worked out is not marked paid at disbursement.
        const accrued = await prisma.jobExpenseClaim.findMany({
          where: { technicianId: emp.id, status: "pending", accruedAt: { not: null } },
          select: { id: true },
        });
        settledClaimIds = accrued.map((c) => c.id);
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

      // Statutory deductions (Accounts Linking #3): WHT on salary (Sec 149) and EOBI / PESSI.
      const taxDeduction = Math.max(0, Math.round((emp.monthlyIncomeTax || 0) * 100) / 100);
      const eobiDeduction = Math.max(0, Math.round((emp.eobiEmployeeShare || 0) * 100) / 100);
      const employerEobi = Math.max(0, Math.round((emp.eobiEmployerShare || 0) * 100) / 100);
      const net = Math.round((gross - advanceDeduction - taxDeduction - eobiDeduction + expenseAdj) * 100) / 100;
      if (net < 0) {
        throw new Error(`${emp.name}: deductions exceed the salary (net would be PKR ${net}). Fix the tax / EOBI settings of this employee.`);
      }

      totalGross += gross;
      totalDeductions += advanceDeduction + taxDeduction + eobiDeduction;
      totalNet += net;

      payslipData.push({
        employeeId: emp.id,
        grossSalary: gross,
        advanceDeduction,
        taxDeduction,
        eobiDeduction,
        employerEobi,
        expenseAdjustment: expenseAdj,
        netSalary: net,
        settledClaimIds: expenseAdj > 0 ? settledClaimIds : [],
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
      include: { payslips: { include: { employee: true } } },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "Draft") {
      throw new Error(`Only Draft runs can be approved. Current status: ${run.status}`);
    }

    // Step 1 (Payroll Run): the salary cost is booked and the net pay becomes a liability.
    const lines = await this.buildAccrualLines(run.payslips);
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollRun.updateMany({
        where: { id: payrollRunId, status: "Draft" },
        data: { status: "Approved", approvedBy: approverName, approvedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("Payroll run is no longer a Draft. Refresh and retry.");
      if (lines.length >= 2) {
        await AccountsPostingService.post({
          memo: `Payroll run ${run.period}: salaries accrued to Salaries Payable`,
          refType: "payroll_accrual",
          refId: run.id,
          postedBy: approverName,
          idempotencyKey: `payroll_accrual:${run.id}`,
          lines,
          tx,
        });
      }
      return tx.payrollRun.findUnique({ where: { id: payrollRunId } });
    }, { maxWait: 10000, timeout: 30000 });
  }

  /**
   * Step 1 voucher ("Accounts Linking" #3):
   *   Dr 52104 Technician Wages (technicians) / Dr 61101 Office Salaries (everyone else)   gross
   *   Dr 61102 EOBI Employer Share                                                         employer EOBI
   *   Dr 21103 Technician Payable                                                          expense claims paid via salary
   *     Cr 21106 Salaries Payable   net pay
   *     Cr 21204 WHT - Salaries     income tax deducted
   *     Cr 21205 EOBI / PESSI       employee + employer EOBI
   *     Cr 11202 Advances           advance recovered
   */
  private static async buildAccrualLines(
    payslips: Array<{
      employeeId: string;
      grossSalary: number;
      advanceDeduction: number;
      taxDeduction: number;
      eobiDeduction: number;
      employerEobi: number;
      expenseAdjustment: number;
      netSalary: number;
      employee?: { role?: string | null } | null;
    }>
  ) {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    type Slip = (typeof payslips)[number];
    const sum = (f: (s: Slip) => number, only?: (s: Slip) => boolean) =>
      r2(payslips.filter((s) => (only ? only(s) : true)).reduce((a, s) => a + (f(s) || 0), 0));
    const isTech = (s: Slip) => (s.employee?.role || "").toLowerCase() === "technician";

    const techGross = sum((s) => s.grossSalary, isTech);
    const officeGross = sum((s) => s.grossSalary, (s) => !isTech(s));
    const employerEobi = sum((s) => s.employerEobi);
    const net = sum((s) => s.netSalary);
    const wht = sum((s) => s.taxDeduction);
    const eobi = r2(sum((s) => s.eobiDeduction) + employerEobi);

    const role = (transactionType: string) => AccountMappingService.resolveAccount({ transactionType });
    const lines: { accountId: string; debit: number; credit: number; partyType?: string; partyId?: string }[] = [];
    if (techGross > 0) lines.push({ accountId: (await role("payroll_technician_wages_expense")).id, debit: techGross, credit: 0 });
    if (officeGross > 0) lines.push({ accountId: (await role("payroll_salaries_expense")).id, debit: officeGross, credit: 0 });
    if (employerEobi > 0) lines.push({ accountId: (await role("payroll_eobi_employer_expense")).id, debit: employerEobi, credit: 0 });
    if (payslips.some((s) => s.expenseAdjustment > 0)) {
      const techPayable = await role("tech_expense_settlement_payable");
      for (const s of payslips) {
        if (s.expenseAdjustment > 0) {
          lines.push({ accountId: techPayable.id, debit: r2(s.expenseAdjustment), credit: 0, partyType: "technician", partyId: s.employeeId });
        }
      }
    }
    if (net > 0) lines.push({ accountId: (await role("payroll_salaries_payable")).id, debit: 0, credit: net });
    if (wht > 0) lines.push({ accountId: (await role("payroll_wht_payable")).id, debit: 0, credit: wht });
    if (eobi > 0) lines.push({ accountId: (await role("payroll_eobi_payable")).id, debit: 0, credit: eobi });
    if (payslips.some((s) => s.advanceDeduction > 0)) {
      const advAcc = await role("payroll_advance_deduction");
      for (const s of payslips) {
        if (s.advanceDeduction > 0) {
          lines.push({ accountId: advAcc.id, debit: 0, credit: r2(s.advanceDeduction), partyType: "employee", partyId: s.employeeId });
        }
      }
    }
    return lines;
  }

  /**
   * Delete / discard a Draft payroll run
   */
  static async deleteDraftRun(payrollRunId: string) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "Draft") {
      throw new Error(`Only Draft runs can be discarded. Current status: ${run.status}`);
    }

    return await prisma.payrollRun.delete({
      where: { id: payrollRunId },
    });
  }

  /**
   * Disburse & Pay payroll run:
   * Posts to Accounts Posting Engine:
   * Debit Salary Expense, Debit Tech Payable (expenseAdj), Credit Cash/Bank, Credit Advance Recovery
   * Journal lines are balanced explicitly: debits == credits.
   */
  static async disburseRun(payrollRunId: string, opts?: { paidFromAccountCode?: string | null; paidBy?: string }) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "Approved") {
      throw new Error(`Payroll must be 'Approved' before disbursement. Current status: ${run.status}`);
    }

    // Step 2 (Payroll Payment): Dr 21106 Salaries Payable / Cr Bank or Cash.
    const salariesPayable = await AccountMappingService.resolveAccount({ transactionType: "payroll_salaries_payable" });
    const bankAccount = opts?.paidFromAccountCode
      ? await AccountsPostingService.getCashBankAccountByCode(String(opts.paidFromAccountCode))
      : await AccountMappingService.resolveAccount({ transactionType: "payroll_net_disbursing" });
    // Runs approved before the two-step flow have no accrual yet: post Step 1 first.
    const accrual = await prisma.journalEntry.findFirst({
      where: { refType: "payroll_accrual", refId: run.id, status: "posted" },
      select: { id: true },
    });
    const accrualLines = accrual ? null : await this.buildAccrualLines(run.payslips);

    return prisma.$transaction(async (tx) => {
      // Conditional claim prevents a double-click/retry from creating a second payroll journal.
      const claimed = await tx.payrollRun.updateMany({
        where: { id: payrollRunId, status: "Approved" },
        data: { status: "Disbursing" },
      });
      if (claimed.count === 0) {
        throw new Error("Payroll run is no longer Approved (it may already be disbursed). Refresh and retry.");
      }

      if (accrualLines && accrualLines.length >= 2) {
        await AccountsPostingService.post({
          memo: `Payroll run ${run.period}: salaries accrued to Salaries Payable`,
          refType: "payroll_accrual",
          refId: run.id,
          postedBy: opts?.paidBy || run.approvedBy || "System",
          idempotencyKey: `payroll_accrual:${run.id}`,
          lines: accrualLines,
          tx,
        });
      }
      if (run.totalNet > 0) {
        await AccountsPostingService.post({
          memo: `Payroll payment for period ${run.period} via ${bankAccount.name}`,
          refType: "payroll",
          refId: run.id,
          postedBy: opts?.paidBy || "System",
          idempotencyKey: `payroll_payment:${run.id}`,
          lines: [
            { accountId: salariesPayable.id, debit: run.totalNet, credit: 0 },
            { accountId: bankAccount.id, debit: 0, credit: run.totalNet },
          ],
          tx,
        });
      }

      await tx.payslip.updateMany({
        where: { payrollRunId },
        data: { status: "paid" },
      });

      // Settle expense_owed and recover only the advance amount deducted in this run.
      for (const slip of run.payslips) {
        const isTechnician = (slip.employee?.role || "").toLowerCase() === "technician";

        if (slip.expenseAdjustment > 0) {
          if (isTechnician) {
            await tx.technicianLedgerEntry.create({
              data: {
                technicianId: slip.employeeId,
                type: "expense_paid",
                amount: slip.expenseAdjustment,
                notes: `Settled via payroll run ${run.period} (${run.id})`,
              },
            });
          }
          // Carried-forward (accrued) claims are now settled through payroll.
          // Only the claims captured when this payslip was calculated.
          const ids = (slip as any).settledClaimIds as string[] | undefined;
          // (Payslips calculated before this tracking existed fall back to claims carried forward
          //  no later than the payslip's calculation time.)
          await tx.jobExpenseClaim.updateMany({
            where:
              ids && ids.length > 0
                ? { id: { in: ids }, technicianId: slip.employeeId, status: "pending" }
                : { technicianId: slip.employeeId, status: "pending", accruedAt: { not: null, lte: slip.createdAt } },
            data: { status: "paid", paidAt: new Date() },
          });
        }

        if (slip.advanceDeduction > 0) {
          let remainingToRecover = slip.advanceDeduction;
          const advances = await tx.employeeAdvance.findMany({
            where: { employeeId: slip.employeeId, status: "approved" },
            orderBy: { createdAt: "asc" },
          });

          for (const adv of advances) {
            if (remainingToRecover <= 0) break;

            if (remainingToRecover >= adv.amount) {
              await tx.employeeAdvance.update({
                where: { id: adv.id },
                data: {
                  status: "recovered",
                  notes: `[Fully recovered in ${run.period}] ${adv.notes || ""}`.trim(),
                },
              });
              remainingToRecover = Math.round((remainingToRecover - adv.amount) * 100) / 100;
            } else {
              const recoveredAmount = remainingToRecover;
              const remainderAmount = Math.round((adv.amount - recoveredAmount) * 100) / 100;

              await tx.employeeAdvance.update({
                where: { id: adv.id },
                data: {
                  amount: recoveredAmount,
                  status: "recovered",
                  notes: `[Partially recovered PKR ${recoveredAmount} in ${run.period}] ${adv.notes || ""}`.trim(),
                },
              });
              await tx.employeeAdvance.create({
                data: {
                  employeeId: adv.employeeId,
                  amount: remainderAmount,
                  status: "approved",
                  approvedBy: adv.approvedBy,
                  notes: `Remaining balance of advance (original: PKR ${adv.amount}, recovered: PKR ${recoveredAmount} in ${run.period})`,
                },
              });
              remainingToRecover = 0;
            }
          }

          if (isTechnician) {
            await tx.technicianLedgerEntry.create({
              data: {
                technicianId: slip.employeeId,
                type: "advance_recovered",
                amount: slip.advanceDeduction,
                notes: `Advance recovered via payroll deduction for period ${run.period}`,
              },
            });
          }
        }
      }

      return tx.payrollRun.update({
        where: { id: payrollRunId },
        data: { status: "Paid", paidAt: new Date(), paidFromAccountCode: bankAccount.code },
        include: { payslips: { include: { employee: true } } },
      });
    }, { maxWait: 10000, timeout: 30000 });
  }
}
