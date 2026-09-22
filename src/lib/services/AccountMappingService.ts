import { prisma } from "../prisma";
import { Account, Prisma, PrismaClient } from "@prisma/client";

export class AccountMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountMappingError";
  }
}

export interface AccountResolutionParams {
  transactionType: string;
  companyId?: string;
  categoryScope?: string | null;
  prismaClient?: PrismaClient | Prisma.TransactionClient;
}

export interface TransactionTypeDefinition {
  transactionType: string;
  name: string;
  domain: "Sales & Invoicing" | "Inventory & COGS" | "Procurement & AP" | "Payroll & HRM" | "POS & Field Ops" | "Fixed Assets & Close";
  description: string;
  defaultDebitOrCredit: "debit" | "credit";
  allowedAccountTypes: string[];
}

export const TRANSACTION_TYPE_DEFINITIONS: TransactionTypeDefinition[] = [
  // Sales & Invoicing
  {
    transactionType: "job_revenue_receivable",
    name: "Job Invoicing — Customer Accounts Receivable",
    domain: "Sales & Invoicing",
    description: "Debited when a job or project invoice is raised to the customer",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "job_revenue_sales",
    name: "Job Invoicing — Service Revenue",
    domain: "Sales & Invoicing",
    description: "Credited for gross billable service, labor, and materials on job invoices",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["revenue"],
  },
  {
    transactionType: "job_revenue_discount",
    name: "Job Invoicing — Discounts Allowed",
    domain: "Sales & Invoicing",
    description: "Debited when job discounts or concessions are authorized",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["contra_revenue", "expense"],
  },
  {
    transactionType: "customer_payment_receiving",
    name: "Customer Receipts — Receiving Bank / Cash",
    domain: "Sales & Invoicing",
    description: "Debited when customer settles an invoice via bank transfer or cash",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "customer_payment_receivable",
    name: "Customer Receipts — Accounts Receivable Offset",
    domain: "Sales & Invoicing",
    description: "Credited when customer invoice receivable balance is settled",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },

  // Inventory & COGS
  {
    transactionType: "inventory_cogs_expense",
    name: "Job Inventory Issue — COGS Expense",
    domain: "Inventory & COGS",
    description: "Debited when parts or equipment are consumed on a customer job",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "inventory_cogs_asset",
    name: "Job Inventory Issue — Stock Asset Outflow",
    domain: "Inventory & COGS",
    description: "Credited when parts are issued out of warehouse stock",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "inventory_return_asset",
    name: "Job Inventory Return — Stock Asset Reinstated",
    domain: "Inventory & COGS",
    description: "Debited when unused parts from a paused/cancelled job are returned to stock",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "inventory_return_cogs",
    name: "Job Inventory Return — COGS Reversal",
    domain: "Inventory & COGS",
    description: "Credited to reverse previously booked COGS on returned stock",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "stock_in_asset",
    name: "Direct Stock Purchase — Inventory Asset",
    domain: "Inventory & COGS",
    description: "Debited on direct spot purchases of inventory",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "stock_in_disbursing",
    name: "Direct Stock Purchase — Disbursing Cash / Bank",
    domain: "Inventory & COGS",
    description: "Credited on cash purchases of inventory parts",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "opening_stock_asset",
    name: "Opening Stock Setup — Inventory Asset",
    domain: "Inventory & COGS",
    description: "Debited during initial product inventory setup",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "opening_stock_equity",
    name: "Opening Stock Setup — Owner Capital Offset",
    domain: "Inventory & COGS",
    description: "Credited as equity balancing entry for initial stock value",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["equity"],
  },

  // Procurement & AP
  {
    transactionType: "grn_receipt_asset",
    name: "Goods Receipt Note — Inventory Asset",
    domain: "Procurement & AP",
    description: "Debited upon receiving verified items into warehouse from PO",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "grn_receipt_clearing",
    name: "Goods Receipt Note — GR/IR Clearing",
    domain: "Procurement & AP",
    description: "Credited upon receipt awaiting matching vendor invoice",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["liability"],
  },
  {
    transactionType: "grn_receipt_payable",
    name: "Direct Inventory Receipt — Accounts Payable",
    domain: "Procurement & AP",
    description: "Direct AP credit if bypassing 3-way match clearing",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["liability"],
  },
  {
    transactionType: "vendor_bill_clearing",
    name: "Vendor Bill Match — GR/IR Clearing Clearance",
    domain: "Procurement & AP",
    description: "Debited to clear the unbilled receipts clearing account",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["liability"],
  },
  {
    transactionType: "vendor_bill_payable",
    name: "Vendor Bill Match — Accounts Payable",
    domain: "Procurement & AP",
    description: "Credited to establish legal vendor liability on invoice approval",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["liability"],
  },
  {
    transactionType: "vendor_bill_ppv",
    name: "Vendor Bill Match — Purchase Price Variance",
    domain: "Procurement & AP",
    description: "Debited or credited for variance between PO price and supplier bill",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "vendor_payment_payable",
    name: "Vendor Payment — Accounts Payable Liquidation",
    domain: "Procurement & AP",
    description: "Debited when paying approved vendor bill",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["liability"],
  },
  {
    transactionType: "vendor_payment_disbursing",
    name: "Vendor Payment — Disbursing Bank Account",
    domain: "Procurement & AP",
    description: "Credited for outgoing funds from company bank account",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "vendor_payment_wht",
    name: "Vendor Payment — Withholding Tax (WHT) Deducted",
    domain: "Procurement & AP",
    description: "Credited for statutory tax withheld at source under ITO Sec 153",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["liability"],
  },

  // Payroll & HRM
  {
    transactionType: "payroll_salaries_expense",
    name: "Monthly Payroll — Gross Salaries Expense",
    domain: "Payroll & HRM",
    description: "Debited for gross salaries and technician wage commitments",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "payroll_net_disbursing",
    name: "Monthly Payroll — Net Pay Disbursing Bank / Cash",
    domain: "Payroll & HRM",
    description: "Credited for net salary payments disbursed to employees",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "payroll_advance_deduction",
    name: "Monthly Payroll — Employee Advance Recovery",
    domain: "Payroll & HRM",
    description: "Credited to recover outstanding salary floats and staff advances",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "advance_granted_receivable",
    name: "Staff Advance Issuance — Advance Float Receivable",
    domain: "Payroll & HRM",
    description: "Debited when issuing an advance to an employee or technician",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "advance_granted_disbursing",
    name: "Staff Advance Issuance — Disbursing Vault / Cash",
    domain: "Payroll & HRM",
    description: "Credited when cash or bank disbursement is made for an advance",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },

  // POS & Field Ops
  {
    transactionType: "pos_sale_cash",
    name: "POS Counter Checkout — Cash Drawer",
    domain: "POS & Field Ops",
    description: "Debited on cash payment at sales counter",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "pos_sale_bank",
    name: "POS Counter Checkout — Bank / Card Machine",
    domain: "POS & Field Ops",
    description: "Debited on credit/debit card swipe at sales counter",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "pos_sale_receivable",
    name: "POS Counter Checkout — Customer Credit",
    domain: "POS & Field Ops",
    description: "Debited when walk-in client buys on credit terms",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "pos_sale_revenue",
    name: "POS Counter Checkout — Sales Revenue",
    domain: "POS & Field Ops",
    description: "Credited for over-the-counter spare parts and service sales",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["revenue"],
  },
  {
    transactionType: "expense_reimbursement_expense",
    name: "Field Expense Reimbursement — Travel & Field Expense",
    domain: "POS & Field Ops",
    description: "Debited when reimbursing field technician expenses",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "expense_reimbursement_disbursing",
    name: "Field Expense Reimbursement — Disbursing Drawer / Float",
    domain: "POS & Field Ops",
    description: "Credited when paying technician expense claims in cash",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "settlement_collection_vault",
    name: "Technician Daily Hisaab — Cash Received to Vault",
    domain: "POS & Field Ops",
    description: "Debited when field cash collections are surrendered by technician",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "settlement_collection_receivable",
    name: "Technician Daily Hisaab — AR Cleared",
    domain: "POS & Field Ops",
    description: "Credited to reduce customer balance from field cash collection",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "tech_expense_settlement_expense",
    name: "Technician Daily Hisaab — Field Expenses Recognized",
    domain: "POS & Field Ops",
    description: "Debited for approved job fuel, emergency parts, or transit",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "tech_expense_settlement_vault",
    name: "Technician Daily Hisaab — Paid Out of Daily Collection",
    domain: "POS & Field Ops",
    description: "Credited when field technician reimburses expense from collected cash",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "tech_expense_settlement_payable",
    name: "Technician Daily Hisaab — Accrued Technician Payable",
    domain: "POS & Field Ops",
    description: "Credited when company owes technician balance for unpaid expenses",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["liability"],
  },
  {
    transactionType: "cashbook_contra_revenue",
    name: "Cashbook Receipt — Default Contra Revenue",
    domain: "POS & Field Ops",
    description: "Default revenue account for unclassified cashbook receipts",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["revenue"],
  },
  {
    transactionType: "cashbook_contra_expense",
    name: "Cashbook Payment — Default Contra Expense",
    domain: "POS & Field Ops",
    description: "Default overhead account for unclassified cashbook vouchers",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },

  // Fixed Assets & Period Close
  {
    transactionType: "depreciation_expense",
    name: "Asset Depreciation — Monthly Depreciation Expense",
    domain: "Fixed Assets & Close",
    description: "Debited on monthly straight-line depreciation amortization",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["expense"],
  },
  {
    transactionType: "accumulated_depreciation",
    name: "Asset Depreciation — Accumulated Depreciation Allowance",
    domain: "Fixed Assets & Close",
    description: "Credited to accumulate contra-asset depreciation reserve",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "retained_earnings_equity",
    name: "Fiscal Period Close — Retained Earnings",
    domain: "Fixed Assets & Close",
    description: "Offset account receiving net profit or loss at year-end close",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["equity"],
  },
  {
    transactionType: "opening_balance_equity",
    name: "Setup Opening Balances — Balancing Offset Equity",
    domain: "Fixed Assets & Close",
    description: "Balances pre-existing trial balance imports during go-live",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["equity"],
  },
];

export class AccountMappingService {
  /**
   * Resolves the concrete Account for a given transaction type.
   * Accepts either an AccountResolutionParams object or a transactionType string.
   * Throws an explicit AccountMappingError if unmapped or inactive.
   * Never silently defaults or auto-creates accounts.
   */
  static async resolveAccount(
    paramsOrType: string | AccountResolutionParams,
    defaultCompanyId: string = "DEFAULT"
  ): Promise<Account> {
    const params: AccountResolutionParams =
      typeof paramsOrType === "string"
        ? { transactionType: paramsOrType, companyId: defaultCompanyId }
        : paramsOrType;

    const {
      transactionType,
      companyId = "DEFAULT",
      categoryScope = null,
      prismaClient = prisma,
    } = params;

    const db = (prismaClient as PrismaClient) || prisma;

    // 1. First check if a category-scoped mapping exists
    let mapping = null;
    if (categoryScope) {
      mapping = await db.accountMapping.findFirst({
        where: {
          companyId,
          transactionType,
          categoryScope,
        },
        include: { account: true },
      });
    }

    // 2. Fall back to the default unscoped mapping
    if (!mapping) {
      mapping = await db.accountMapping.findFirst({
        where: {
          companyId,
          transactionType,
          categoryScope: null,
        },
        include: { account: true },
      });
    }

    // 3. Strict Validation: Fail explicitly if unmapped
    if (!mapping || !mapping.account) {
      const scopeMsg = categoryScope ? ` with category scope "${categoryScope}"` : "";
      throw new AccountMappingError(
        `[AccountMappingError] Unmapped transaction type "${transactionType}"${scopeMsg} for company "${companyId}". Posting blocked.`
      );
    }

    // 4. Strict Validation: Fail if mapped account is inactive
    if (!mapping.account.isActive) {
      throw new AccountMappingError(
        `[AccountMappingError] Account "${mapping.account.code} — ${mapping.account.name}" mapped to transaction type "${transactionType}" is deactivated.`
      );
    }

    return mapping.account;
  }

  /**
   * Helper to retrieve only the account code for callers that operate with accountCode strings.
   * Accepts either an AccountResolutionParams object or a transactionType string.
   */
  static async resolveAccountCode(
    paramsOrType: string | AccountResolutionParams,
    defaultCompanyId: string = "DEFAULT"
  ): Promise<string> {
    const account = await this.resolveAccount(paramsOrType, defaultCompanyId);
    return account.code;
  }

  /**
   * Retrieves all current mappings for a company, merged with master definitions.
   */
  static async getAllMappings(companyId: string = "DEFAULT") {
    const activeMappings = await prisma.accountMapping.findMany({
      where: { companyId },
      include: {
        account: true,
      },
    });

    const mappingMap = new Map<string, typeof activeMappings[0]>();
    for (const m of activeMappings) {
      const key = `${m.transactionType}::${m.categoryScope || ""}`;
      mappingMap.set(key, m);
    }

    return TRANSACTION_TYPE_DEFINITIONS.map((def) => {
      const key = `${def.transactionType}::`;
      const current = mappingMap.get(key);
      return {
        ...def,
        mappingId: current?.id || null,
        accountId: current?.accountId || null,
        accountCode: current?.account?.code || null,
        accountName: current?.account?.name || null,
        accountType: current?.account?.type || null,
        isConfigured: !!current?.accountId,
        updatedAt: current?.updatedAt || null,
        updatedBy: current?.updatedBy || null,
      };
    });
  }

  /**
   * Updates or creates a mapping for a given transaction type.
   */
  static async setMapping(
    companyId: string = "DEFAULT",
    transactionType: string,
    accountId: string,
    categoryScope: string | null = null,
    updatedBy: string = "Admin"
  ) {
    const targetAccount = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!targetAccount) {
      throw new AccountMappingError(`Account with ID "${accountId}" does not exist.`);
    }

    if (!targetAccount.isActive) {
      throw new AccountMappingError(`Cannot map to deactivated account "${targetAccount.code}".`);
    }

    const existing = await prisma.accountMapping.findFirst({
      where: {
        companyId,
        transactionType,
        categoryScope,
      },
    });

    if (existing) {
      return await prisma.accountMapping.update({
        where: { id: existing.id },
        data: {
          accountId,
          updatedBy,
        },
        include: { account: true },
      });
    } else {
      return await prisma.accountMapping.create({
        data: {
          companyId,
          transactionType,
          categoryScope,
          accountId,
          updatedBy,
        },
        include: { account: true },
      });
    }
  }

  /**
   * Returns mapping completeness summary (e.g. 24/24 configured, 100%).
   */
  static async getCompleteness(companyId: string = "DEFAULT") {
    const mappings = await this.getAllMappings(companyId);
    const total = mappings.length;
    const configured = mappings.filter((m) => m.isConfigured).length;
    const percentage = total > 0 ? Math.round((configured / total) * 100) : 0;
    const missing = mappings.filter((m) => !m.isConfigured).map((m) => m.transactionType);

    return {
      total,
      configured,
      percentage,
      isComplete: configured === total,
      missing,
    };
  }
}
