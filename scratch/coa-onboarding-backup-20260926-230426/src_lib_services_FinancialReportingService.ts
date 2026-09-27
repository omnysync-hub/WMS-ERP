import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { buildChartOfAccountsTree } from "@/lib/constants/chartOfAccountsHierarchy";

export class FinancialReportingService {
  /**
   * Generate Full 4-Level Trial Balance as of a specific date.
   * Pulls all posted journal lines, groups by account, and rolls up from Level 4 to Level 1.
   */
  static async getTrialBalance(asOfDate: Date = new Date()) {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              date: { lte: asOfDate },
              status: { in: ["posted", "reversal"] },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    let totalDebits = 0;
    let totalCredits = 0;

    const accountsWithBalance = accounts.map((acc) => {
      let balance = 0;
      let accountDebitSum = 0;
      let accountCreditSum = 0;

      for (const line of acc.journalLines) {
        accountDebitSum += line.debit;
        accountCreditSum += line.credit;

        if (["asset", "expense", "contra_revenue"].includes(acc.type)) {
          balance += line.debit - line.credit;
        } else {
          balance += line.credit - line.debit;
        }
      }

      totalDebits += accountDebitSum;
      totalCredits += accountCreditSum;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debitTotal: Math.round(accountDebitSum * 100) / 100,
        creditTotal: Math.round(accountCreditSum * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        entriesCount: acc.journalLines.length,
      };
    });

    const tree = buildChartOfAccountsTree(accountsWithBalance);

    const roundedTotalDebits = Math.round(totalDebits * 100) / 100;
    const roundedTotalCredits = Math.round(totalCredits * 100) / 100;
    const variance = Math.round((roundedTotalDebits - roundedTotalCredits) * 100) / 100;

    return {
      asOfDate,
      totalDebits: roundedTotalDebits,
      totalCredits: roundedTotalCredits,
      totalDebit: roundedTotalDebits,
      totalCredit: roundedTotalCredits,
      variance,
      isInBalance: Math.abs(variance) <= 0.01,
      isBalanced: Math.abs(variance) <= 0.01,
      accounts: accountsWithBalance,
      tree,
    };
  }

  /**
   * Generate Standard Balance Sheet (Statement of Financial Position).
   * Assets = Liabilities + Equity (Assets - Liabilities = Equity).
   */
  static async getBalanceSheet(asOfDate: Date = new Date()) {
    const tb = await this.getTrialBalance(asOfDate);

    // Group accounts by Type
    const assetAccounts = tb.accounts.filter((a) => a.type === "asset");
    const liabilityAccounts = tb.accounts.filter((a) => a.type === "liability");
    const equityAccounts = tb.accounts.filter((a) => a.type === "equity");
    const revenueAccounts = tb.accounts.filter((a) => a.type === "revenue" || a.type === "contra_revenue");
    const expenseAccounts = tb.accounts.filter((a) => a.type === "expense");

    const totalAssets = Math.round(assetAccounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
    const totalLiabilities = Math.round(liabilityAccounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
    const baseEquity = Math.round(equityAccounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;

    // Current Year Net Income (Revenue - Expenses) that hasn't been closed into Retained Earnings yet
    const currentRevenue = revenueAccounts.reduce((sum, a) => sum + (a.type === "contra_revenue" ? -a.balance : a.balance), 0);
    const currentExpenses = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
    const currentPeriodNetIncome = Math.round((currentRevenue - currentExpenses) * 100) / 100;

    const totalEquity = Math.round((baseEquity + currentPeriodNetIncome) * 100) / 100;
    const totalLiabilitiesAndEquity = Math.round((totalLiabilities + totalEquity) * 100) / 100;
    const accountingEquationDifference = Math.round((totalAssets - totalLiabilitiesAndEquity) * 100) / 100;

    const currentAssetsList = assetAccounts.filter((a) => !a.code.startsWith("15"));
    const fixedAssetsList = assetAccounts.filter((a) => a.code.startsWith("15"));
    const currentAssetsTotal = Math.round(currentAssetsList.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    const fixedAssetsTotal = Math.round(fixedAssetsList.reduce((s, a) => s + a.balance, 0) * 100) / 100;

    return {
      asOfDate,
      assets: {
        total: totalAssets,
        totalAssets,
        accounts: assetAccounts,
        currentAssets: {
          total: currentAssetsTotal,
          accounts: currentAssetsList,
        },
        fixedAssets: {
          total: fixedAssetsTotal,
          accounts: fixedAssetsList,
        },
      },
      liabilities: {
        total: totalLiabilities,
        accounts: liabilityAccounts,
        currentLiabilities: {
          total: totalLiabilities,
          accounts: liabilityAccounts,
        },
      },
      equity: {
        total: totalEquity,
        baseEquity,
        currentPeriodNetIncome,
        accounts: equityAccounts,
      },
      totalLiabilitiesAndEquity,
      accountingEquationDifference,
      discrepancy: accountingEquationDifference,
      isBalanced: Math.abs(accountingEquationDifference) <= 0.05,
    };
  }

  /**
   * Generate Income Statement (Profit and Loss Statement).
   * Net Profit = Revenue - COGS - Operating Expenses.
   */
  static async getIncomeStatement(fromDate: Date, toDate: Date = new Date()) {
    const journalLines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
        account: {
          type: { in: ["revenue", "contra_revenue", "expense"] },
          isActive: true,
        },
      },
      include: {
        account: true,
      },
    });

    const accountMap = new Map<string, { code: string; name: string; type: string; balance: number }>();

    for (const line of journalLines) {
      const acc = line.account;
      if (!accountMap.has(acc.code)) {
        accountMap.set(acc.code, { code: acc.code, name: acc.name, type: acc.type, balance: 0 });
      }

      const item = accountMap.get(acc.code)!;
      if (acc.type === "revenue") {
        item.balance += line.credit - line.debit;
      } else if (acc.type === "contra_revenue" || acc.type === "expense") {
        item.balance += line.debit - line.credit;
      }
    }

    const accountsList = Array.from(accountMap.values());

    const revenueAccounts = accountsList.filter((a) => a.type === "revenue" || a.type === "contra_revenue");
    const cogsAccounts = accountsList.filter((a) => a.code.startsWith("5"));
    const opexAccounts = accountsList.filter((a) => a.type === "expense" && !a.code.startsWith("5"));

    const totalGrossRevenue = Math.round(
      revenueAccounts.reduce((sum, a) => sum + (a.type === "contra_revenue" ? -a.balance : a.balance), 0) * 100
    ) / 100;

    const totalCogs = Math.round(cogsAccounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
    const grossProfit = Math.round((totalGrossRevenue - totalCogs) * 100) / 100;

    const totalOpex = Math.round(opexAccounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
    const netOperatingProfit = Math.round((grossProfit - totalOpex) * 100) / 100;

    return {
      fromDate,
      toDate,
      startDate: fromDate,
      endDate: toDate,
      revenue: {
        total: totalGrossRevenue,
        accounts: revenueAccounts,
      },
      costOfGoodsSold: {
        total: totalCogs,
        accounts: cogsAccounts,
      },
      cogs: {
        total: totalCogs,
        accounts: cogsAccounts,
      },
      grossProfit,
      grossMargin: totalGrossRevenue > 0 ? Math.round((grossProfit / totalGrossRevenue) * 1000) / 10 : 0,
      operatingExpenses: {
        total: totalOpex,
        accounts: opexAccounts,
      },
      netOperatingProfit,
      netIncome: netOperatingProfit,
      isProfitable: netOperatingProfit >= 0,
      netMarginPercent: totalGrossRevenue > 0 ? Math.round((netOperatingProfit / totalGrossRevenue) * 1000) / 10 : 0,
      netProfitMargin: totalGrossRevenue > 0 ? Math.round((netOperatingProfit / totalGrossRevenue) * 1000) / 10 : 0,
    };
  }

  /**
   * Generate Cash Flow Statement (Indirect Method).
   * Net Income + Non-Cash Depreciation +/- Changes in Working Capital (AR, AP, Inventory).
   */
  static async getCashFlowStatement(fromDate: Date, toDate: Date = new Date()) {
    const incomeStmt = await this.getIncomeStatement(fromDate, toDate);
    const netIncome = incomeStmt.netOperatingProfit;

    // 1. Depreciation (Non-Cash Expense)
    const deprLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "6350" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const depreciationAdjustment = Math.round(deprLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100) / 100;

    // 2. Working Capital Changes
    // Change in AR (1100): Increase in AR reduces cash, decrease in AR increases cash
    const arLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "1100" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const changeInAr = Math.round(arLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100) / 100;

    // Change in Inventory (1200): Increase in Inventory reduces cash
    const invLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "1200" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const changeInInventory = Math.round(invLines.reduce((sum, l) => sum + (l.debit - l.credit), 0) * 100) / 100;

    // Change in AP (2000): Increase in AP increases cash (delayed payment)
    const apLines = await prisma.journalLine.findMany({
      where: {
        account: { code: "2000" },
        journalEntry: {
          date: { gte: fromDate, lte: toDate },
          status: { in: ["posted", "reversal"] },
        },
      },
    });
    const changeInAp = Math.round(apLines.reduce((sum, l) => sum + (l.credit - l.debit), 0) * 100) / 100;

    // Net Cash from Operating Activities
    const netWorkingCapital = Math.round((changeInAp - changeInAr - changeInInventory) * 100) / 100;
    const netCashFromOperations = Math.round(
      (netIncome + depreciationAdjustment + netWorkingCapital) * 100
    ) / 100;

    // Cash balances
    const cashAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { code: "1000" },
          { code: { startsWith: "101" } },
          { code: "1020" },
        ],
      },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              date: { lte: toDate },
              status: { in: ["posted", "reversal"] },
            },
          },
        },
      },
    });

    const endingCash = Math.round(
      cashAccounts.reduce(
        (sum, a) => sum + a.journalLines.reduce((s, l) => s + (l.debit - l.credit), 0),
        0
      ) * 100
    ) / 100;

    const beginningCash = Math.round((endingCash - netCashFromOperations) * 100) / 100;

    return {
      fromDate,
      toDate,
      startDate: fromDate,
      endDate: toDate,
      operatingActivities: {
        total: netCashFromOperations,
        netIncome,
        depreciation: depreciationAdjustment,
        workingCapitalChanges: netWorkingCapital,
        nonCashAdjustments: {
          depreciation: depreciationAdjustment,
        },
        workingCapitalBreakdown: {
          changeInAccountsReceivable: -changeInAr,
          changeInInventory: -changeInInventory,
          changeInAccountsPayable: changeInAp,
        },
        netCashFromOperations,
      },
      investingActivities: {
        total: 0,
        capitalExpenditures: 0,
      },
      financingActivities: {
        total: 0,
        equityChanges: 0,
      },
      netCashChange: netCashFromOperations,
      beginningCash,
      endingCash,
    };
  }
}
