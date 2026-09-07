import { prisma } from "@/lib/prisma";

export interface PostLineItem {
  accountId: string;
  debit: number;
  credit: number;
}

export interface PostEntryParams {
  date?: Date;
  memo: string;
  refType: string;
  refId?: string | null;
  lines: PostLineItem[];
}

export class AccountsPostingService {
  /**
   * The spine of the financial system.
   * Enforces balanced double-entry accounting: sum(debit) == sum(credit).
   * Throws an error if unbalanced or invalid.
   */
  static async post(params: PostEntryParams) {
    const { date = new Date(), memo, refType, refId, lines } = params;

    if (!lines || lines.length === 0) {
      throw new Error("Posting rejected: A journal entry must have at least two line items.");
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error("Posting rejected: Debit and Credit amounts cannot be negative.");
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error("Posting rejected: A line item cannot have both debit and credit amounts.");
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    // Round to 2 decimal places to avoid floating point issues
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(roundedDebit - roundedCredit) > 0.01) {
      throw new Error(
        `Posting rejected: Journal entry is unbalanced. Total Debit: ${roundedDebit}, Total Credit: ${roundedCredit}`
      );
    }

    // Validate account existence
    for (const line of lines) {
      const account = await prisma.account.findUnique({
        where: { id: line.accountId },
      });
      if (!account) {
        throw new Error(`Posting rejected: Account ID '${line.accountId}' does not exist.`);
      }
    }

    // Atomically write journal entry and lines
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          date,
          memo,
          refType,
          refId,
          lines: {
            create: lines.map((l) => ({
              accountId: l.accountId,
              debit: Math.round(l.debit * 100) / 100,
              credit: Math.round(l.credit * 100) / 100,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });

      return entry;
    });
  }

  /**
   * Helper to look up system standard accounts by code
   */
  static async getAccountByCode(code: string) {
    const account = await prisma.account.findUnique({
      where: { code },
    });
    if (!account) {
      // Auto-provision standard account if missing
      const defaults: Record<string, { name: string; type: string; description: string }> = {
        "1000": { name: "Cash on Hand / Drawer", type: "asset", description: "Cash drawer balance" },
        "1010": { name: "Operating Bank Account", type: "asset", description: "Primary bank checking account" },
        "1020": { name: "Petty Cash Float", type: "asset", description: "Emergency cash float" },
        "1100": { name: "Accounts Receivable", type: "asset", description: "Customer invoice receivables" },
        "1150": { name: "Employee & Tech Advances", type: "asset", description: "Staff cash advances" },
        "1200": { name: "Inventory Asset", type: "asset", description: "HVAC equipment and parts" },
        "2000": { name: "Accounts Payable", type: "liability", description: "Vendor and supplier payables" },
        "2100": { name: "Technician Payable", type: "liability", description: "Field reimbursements pending" },
        "3000": { name: "Owner Capital / Equity", type: "equity", description: "Owner equity" },
        "4000": { name: "HVAC Service & Installation Revenue", type: "revenue", description: "Service revenue" },
        "4100": { name: "Discounts Allowed", type: "contra_revenue", description: "Customer discounts" },
        "5000": { name: "Cost of Goods Sold (COGS)", type: "expense", description: "Direct materials and parts" },
        "6000": { name: "Salaries & Wages Expense", type: "expense", description: "Payroll expenses" },
        "6100": { name: "Technician Travel & Field Expenses", type: "expense", description: "Travel, fuel, parking" },
        "6200": { name: "Office & Utility Expenses", type: "expense", description: "Rent, electricity, internet, supplies" },
      };

      if (defaults[code]) {
        return await prisma.account.create({
          data: {
            code,
            name: defaults[code].name,
            type: defaults[code].type,
            description: defaults[code].description,
          },
        });
      }

      throw new Error(`System account with code '${code}' not found in Chart of Accounts.`);
    }
    return account;
  }
}
