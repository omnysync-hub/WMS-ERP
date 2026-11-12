export type CoaAccountType =
  | "asset"
  | "contra_asset"
  | "liability"
  | "equity"
  | "revenue"
  | "contra_revenue"
  | "expense"
  | "contra_expense";

export interface CoaDefinition {
  code: string;
  name: string;
  type: CoaAccountType;
  level: 1 | 2 | 3 | 4;
  parentCode?: string;
  isGroup: boolean;
  description?: string;
  /** Code this account carried before the 5-digit recode (used by scripts/recode-coa-5digit.ts). */
  legacyCode?: string;
}

export interface CoaNode extends CoaDefinition {
  id?: string;
  balance: number;
  entriesCount?: number;
  children?: CoaNode[];
}

/**
 * The ONLY chart of accounts ("Workman Services ERP – Accounts Linking", corrected COA).
 * Code rule, so no group code can ever collide with a posting ledger:
 *   Level 1 groups : 2-digit ending in 0   (10 Assets, 20 Liabilities ... 60 Operating Expenses)
 *   Level 2 groups : 2-digit               (11 Current Assets, 15 Fixed Assets ...)
 *   Level 3 groups : 4-digit ending in 0   (1110 Cash & Bank, 1120 Receivables ...)
 *   Level 4 ledgers: 5-digit               (11101 Cash on Hand, 11201 Accounts Receivable ...)
 * `legacyCode` is the code the row had before the recode.
 */
export const STANDARD_COA_DEFINITIONS: CoaDefinition[] = [
  // ---------------- Groups (levels 1-3) ----------------
  { code: "10", name: "Assets", type: "asset", level: 1, isGroup: true, legacyCode: "1000-GRP" },
  { code: "11", name: "Current Assets", type: "asset", level: 2, parentCode: "10", isGroup: true, legacyCode: "1100-GRP" },
  { code: "1110", name: "Cash & Bank", type: "asset", level: 3, parentCode: "11", isGroup: true, legacyCode: "1110-GRP" },
  { code: "1120", name: "Receivables", type: "asset", level: 3, parentCode: "11", isGroup: true, legacyCode: "1120-GRP" },
  { code: "1130", name: "Inventory", type: "asset", level: 3, parentCode: "11", isGroup: true, legacyCode: "1130-GRP" },
  { code: "15", name: "Fixed Assets", type: "asset", level: 2, parentCode: "10", isGroup: true, legacyCode: "1500-GRP" },
  { code: "1510", name: "Fixed Assets", type: "asset", level: 3, parentCode: "15", isGroup: true, legacyCode: "1510-GRP" },
  { code: "20", name: "Liabilities", type: "liability", level: 1, isGroup: true, legacyCode: "2000-GRP" },
  { code: "21", name: "Current Liabilities", type: "liability", level: 2, parentCode: "20", isGroup: true, legacyCode: "2100-GRP" },
  { code: "2110", name: "Payables", type: "liability", level: 3, parentCode: "21", isGroup: true, legacyCode: "2110-GRP" },
  { code: "2120", name: "Tax Liabilities", type: "liability", level: 3, parentCode: "21", isGroup: true },
  { code: "22", name: "Long-term Liabilities", type: "liability", level: 2, parentCode: "20", isGroup: true },
  { code: "2210", name: "Long-term", type: "liability", level: 3, parentCode: "22", isGroup: true },
  { code: "30", name: "Equity", type: "equity", level: 1, isGroup: true, legacyCode: "3000-GRP" },
  { code: "31", name: "Owner's Equity", type: "equity", level: 2, parentCode: "30", isGroup: true, legacyCode: "3100-GRP" },
  { code: "3110", name: "Capital", type: "equity", level: 3, parentCode: "31", isGroup: true, legacyCode: "3110-GRP" },
  { code: "40", name: "Revenue", type: "revenue", level: 1, isGroup: true, legacyCode: "4000-GRP" },
  { code: "41", name: "Operating Revenue", type: "revenue", level: 2, parentCode: "40", isGroup: true, legacyCode: "4100-GRP" },
  { code: "4110", name: "Service & Sales", type: "revenue", level: 3, parentCode: "41", isGroup: true, legacyCode: "4110-GRP" },
  { code: "4120", name: "Contra-Revenue", type: "revenue", level: 3, parentCode: "41", isGroup: true },
  { code: "42", name: "Other Income", type: "revenue", level: 2, parentCode: "40", isGroup: true, legacyCode: "4200-GRP" },
  { code: "4210", name: "Other Income", type: "revenue", level: 3, parentCode: "42", isGroup: true, legacyCode: "4210-GRP" },
  { code: "50", name: "Cost of Sales", type: "expense", level: 1, isGroup: true, legacyCode: "5000-GRP" },
  { code: "51", name: "Materials & Goods", type: "expense", level: 2, parentCode: "50", isGroup: true, legacyCode: "5100-GRP" },
  { code: "5110", name: "Materials Cost", type: "expense", level: 3, parentCode: "51", isGroup: true, legacyCode: "5110-GRP" },
  { code: "52", name: "Direct Job Costs", type: "expense", level: 2, parentCode: "50", isGroup: true, legacyCode: "5200-GRP" },
  { code: "5210", name: "Job Costs", type: "expense", level: 3, parentCode: "52", isGroup: true, legacyCode: "5210-GRP" },
  { code: "60", name: "Operating Expenses", type: "expense", level: 1, isGroup: true, legacyCode: "6000-GRP" },
  { code: "61", name: "Payroll", type: "expense", level: 2, parentCode: "60", isGroup: true, legacyCode: "6100-GRP" },
  { code: "6110", name: "Payroll", type: "expense", level: 3, parentCode: "61", isGroup: true, legacyCode: "6110-GRP" },
  { code: "62", name: "Administrative", type: "expense", level: 2, parentCode: "60", isGroup: true, legacyCode: "6200-GRP" },
  { code: "6210", name: "Admin", type: "expense", level: 3, parentCode: "62", isGroup: true, legacyCode: "6210-GRP" },
  { code: "63", name: "Utilities", type: "expense", level: 2, parentCode: "60", isGroup: true, legacyCode: "6300-GRP" },
  { code: "6310", name: "Utilities", type: "expense", level: 3, parentCode: "63", isGroup: true, legacyCode: "6310-GRP" },
  { code: "64", name: "Other Expenses", type: "expense", level: 2, parentCode: "60", isGroup: true, legacyCode: "6400-GRP" },
  { code: "6410", name: "Other", type: "expense", level: 3, parentCode: "64", isGroup: true, legacyCode: "6410-GRP" },

  // ---------------- Posting ledgers (level 4) ----------------
  // Cash & Bank
  { code: "11101", name: "Cash on Hand / Main Drawer", type: "asset", level: 4, parentCode: "1110", isGroup: false, legacyCode: "1000", description: "Office vault / main drawer: counter sales, customer cash receipts and technician cash surrendered at Daily Hisaab" },
  { code: "11102", name: "Petty Cash – Expenses", type: "asset", level: 4, parentCode: "1110", isGroup: false, legacyCode: "1005", description: "Small cash float used to pay daily office expenses" },
  { code: "11103", name: "Operating Bank Account (Meezan etc.)", type: "asset", level: 4, parentCode: "1110", isGroup: false, legacyCode: "1010", description: "Main bank account: transfers, cheques, card sales, vendor and salary payments" },
  { code: "11104", name: "Mobile Wallet (JazzCash / Easypaisa)", type: "asset", level: 4, parentCode: "1110", isGroup: false, description: "Customer receipts and payments through JazzCash / Easypaisa" },
  { code: "11105", name: "Cash with Technicians (Field Collection)", type: "asset", level: 4, parentCode: "1110", isGroup: false, description: "Clearing account: cash collected by technicians in the field and not yet surrendered to the vault (closes at zero after Daily Hisaab)" },
  // Receivables
  { code: "11201", name: "Accounts Receivable – Trade Clients", type: "asset", level: 4, parentCode: "1120", isGroup: false, legacyCode: "1100", description: "Amounts customers and care-of companies owe us for invoices (a ledger is kept per party)" },
  { code: "11202", name: "Employee & Technician Advances", type: "asset", level: 4, parentCode: "1120", isGroup: false, legacyCode: "1150", description: "Cash advances given to employees and technicians, recovered from salary or claims" },
  { code: "11203", name: "Advance Income Tax (WHT deducted by customers)", type: "asset", level: 4, parentCode: "1120", isGroup: false, legacyCode: "1160", description: "Income tax withheld by customers from their payments to us; adjustable against our income tax" },
  { code: "11204", name: "Input Sales Tax Recoverable", type: "asset", level: 4, parentCode: "1120", isGroup: false, legacyCode: "1170", description: "Sales tax paid on supplier bills that can be claimed back against output sales tax" },
  { code: "11205", name: "Prepaid Expenses & Security Deposits", type: "asset", level: 4, parentCode: "1120", isGroup: false, description: "Advance rent, deposits and other prepayments" },
  // Inventory
  { code: "11301", name: "Inventory – Materials & Spares", type: "asset", level: 4, parentCode: "1130", isGroup: false, legacyCode: "1200", description: "Stock of materials and spare parts held in the store (used on jobs)" },
  { code: "11302", name: "Inventory – Goods for Direct Sale", type: "asset", level: 4, parentCode: "1130", isGroup: false, legacyCode: "1210", description: "Goods held for direct sale to customers" },
  { code: "11303", name: "Inventory – Stock in Transit", type: "asset", level: 4, parentCode: "1130", isGroup: false, legacyCode: "1220", description: "Stock sent to another branch that is still on the way" },
  // Fixed assets
  { code: "15101", name: "Office Equipment & Furniture", type: "asset", level: 4, parentCode: "1510", isGroup: false, legacyCode: "1500", description: "Cost of office equipment, furniture and other fixed assets" },
  { code: "15102", name: "Vehicles & Tools", type: "asset", level: 4, parentCode: "1510", isGroup: false, legacyCode: "1510", description: "Cost of company vehicles, tools and service equipment" },
  { code: "15190", name: "Accumulated Depreciation", type: "contra_asset", level: 4, parentCode: "1510", isGroup: false, legacyCode: "1590", description: "Contra-asset: depreciation charged to date (credit balance, shown as a minus under fixed assets)" },
  // Payables
  { code: "21101", name: "Accounts Payable – Trade Vendors", type: "liability", level: 4, parentCode: "2110", isGroup: false, legacyCode: "2000", description: "Amounts we owe suppliers for goods and services" },
  { code: "21102", name: "GR/IR Clearing", type: "liability", level: 4, parentCode: "2110", isGroup: false, legacyCode: "2050", description: "Goods received but supplier bill not yet booked" },
  { code: "21103", name: "Technician Payable & Expense Claims", type: "liability", level: 4, parentCode: "2110", isGroup: false, legacyCode: "2100", description: "Expense claims and balances owed to technicians" },
  { code: "21104", name: "Technician Commission Payable", type: "liability", level: 4, parentCode: "2110", isGroup: false, legacyCode: "2110", description: "Commission earned by technicians and not yet paid" },
  { code: "21105", name: "Customer Advances (Unearned Revenue)", type: "liability", level: 4, parentCode: "2110", isGroup: false, description: "Money received from customers before an invoice exists; adjusted against AR when the invoice is raised" },
  { code: "21106", name: "Salaries Payable", type: "liability", level: 4, parentCode: "2110", isGroup: false, description: "Net salary owed to staff after a payroll run and not yet paid" },
  { code: "21107", name: "Accrued Expenses (Rent, Bills)", type: "liability", level: 4, parentCode: "2110", isGroup: false, description: "Expenses incurred but not yet paid" },
  // Tax liabilities
  { code: "21201", name: "Output Sales Tax Payable – FBR (goods)", type: "liability", level: 4, parentCode: "2120", isGroup: false, legacyCode: "2210", description: "GST charged on goods sold, payable to FBR" },
  { code: "21202", name: "Sales Tax on Services Payable – PRA/SRB", type: "liability", level: 4, parentCode: "2120", isGroup: false, description: "Provincial sales tax on services, payable to PRA / SRB / KPRA" },
  { code: "21203", name: "WHT Payable – Suppliers (Sec 153)", type: "liability", level: 4, parentCode: "2120", isGroup: false, legacyCode: "2200", description: "Income tax withheld from supplier payments, payable to FBR" },
  { code: "21204", name: "WHT Payable – Salaries (Sec 149)", type: "liability", level: 4, parentCode: "2120", isGroup: false, description: "Income tax withheld from salaries, payable to FBR" },
  { code: "21205", name: "EOBI / PESSI Payable", type: "liability", level: 4, parentCode: "2120", isGroup: false, description: "EOBI / PESSI contributions deducted or due, payable to the institutions" },
  // Long-term
  { code: "22101", name: "Loans & Director Loan", type: "liability", level: 4, parentCode: "2210", isGroup: false, description: "Bank loans and loans from directors" },
  // Equity
  { code: "31101", name: "Owner Capital", type: "equity", level: 4, parentCode: "3110", isGroup: false, legacyCode: "3000", description: "Capital put in by the owners" },
  { code: "31102", name: "Owner Drawings", type: "equity", level: 4, parentCode: "3110", isGroup: false, legacyCode: "3100", description: "Money the owners take out of the business (debit balance)" },
  { code: "31103", name: "Retained Earnings", type: "equity", level: 4, parentCode: "3110", isGroup: false, legacyCode: "3200", description: "Profit carried forward from closed years" },
  { code: "31104", name: "Opening Balance Equity", type: "equity", level: 4, parentCode: "3110", isGroup: false, legacyCode: "3900", description: "Balancing account for go-live opening balances" },
  // Revenue
  { code: "41101", name: "Service Revenue – Installation", type: "revenue", level: 4, parentCode: "4110", isGroup: false, legacyCode: "4000", description: "Income from installation and commissioning jobs" },
  { code: "41102", name: "Service Revenue – Repair & Maintenance", type: "revenue", level: 4, parentCode: "4110", isGroup: false, legacyCode: "4001", description: "Income from repair, service, gas recharge and maintenance jobs" },
  { code: "41103", name: "Goods Revenue – Parts & Products", type: "revenue", level: 4, parentCode: "4110", isGroup: false, legacyCode: "4010", description: "Parts and products sold to customers on job invoices" },
  { code: "41104", name: "POS Counter Sales Revenue", type: "revenue", level: 4, parentCode: "4110", isGroup: false, legacyCode: "4002", description: "Over-the-counter (POS) sales" },
  { code: "41201", name: "Sales Returns & Credit Notes", type: "contra_revenue", level: 4, parentCode: "4120", isGroup: false, description: "Contra-revenue: goods returned by customers / credit notes issued" },
  { code: "41202", name: "Discounts Allowed", type: "contra_revenue", level: 4, parentCode: "4120", isGroup: false, legacyCode: "4100", description: "Contra-revenue: discounts given to customers" },
  { code: "42101", name: "Other Income", type: "revenue", level: 4, parentCode: "4210", isGroup: false, legacyCode: "4900", description: "Any other income not related to jobs or sales" },
  { code: "42102", name: "Discount Received from Suppliers", type: "revenue", level: 4, parentCode: "4210", isGroup: false, description: "Discounts given to us by suppliers on their bills" },
  // Cost of sales — materials
  { code: "51101", name: "COGS – Materials Used on Jobs", type: "expense", level: 4, parentCode: "5110", isGroup: false, legacyCode: "5000", description: "Cost of store materials issued to jobs" },
  { code: "51102", name: "COGS – Market Purchase for Customer", type: "expense", level: 4, parentCode: "5110", isGroup: false, legacyCode: "5010", description: "Cost of goods bought from the market for a customer's job" },
  { code: "51103", name: "COGS – POS Goods Sold", type: "expense", level: 4, parentCode: "5110", isGroup: false, legacyCode: "5030", description: "Cost of goods sold over the counter" },
  { code: "51104", name: "Stock Adjustments & Workshop Consumption", type: "expense", level: 4, parentCode: "5110", isGroup: false, legacyCode: "5040", description: "Stock count write-offs / write-ups and parts used in the workshop" },
  { code: "51105", name: "Purchase Price Variance", type: "expense", level: 4, parentCode: "5110", isGroup: false, legacyCode: "5050", description: "Difference between PO price and supplier bill" },
  { code: "51106", name: "Purchase Returns", type: "contra_expense", level: 4, parentCode: "5110", isGroup: false, description: "Contra-expense: goods returned to suppliers (debit notes)" },
  // Cost of sales — job costs
  { code: "52101", name: "Job Fuel & Conveyance", type: "expense", level: 4, parentCode: "5210", isGroup: false, legacyCode: "5100", description: "Fuel and conveyance spent on jobs" },
  { code: "52102", name: "Job Food & Meals", type: "expense", level: 4, parentCode: "5210", isGroup: false, legacyCode: "5110", description: "Food and meals for the team on jobs" },
  { code: "52103", name: "Technician Commission Expense", type: "expense", level: 4, parentCode: "5210", isGroup: false, legacyCode: "5120", description: "Commission earned by technicians on jobs" },
  { code: "52104", name: "Technician / Field Staff Wages", type: "expense", level: 4, parentCode: "5210", isGroup: false, description: "Salaries of technicians and field staff (cost of sales)" },
  { code: "52105", name: "Other Direct Job Costs", type: "expense", level: 4, parentCode: "5210", isGroup: false, legacyCode: "5130", description: "Any other direct cost of a job" },
  // Payroll
  { code: "61101", name: "Salaries & Wages – Office/Admin", type: "expense", level: 4, parentCode: "6110", isGroup: false, legacyCode: "6000", description: "Salaries of office and admin staff" },
  { code: "61102", name: "EOBI / PESSI – Employer Share", type: "expense", level: 4, parentCode: "6110", isGroup: false, description: "Employer contribution to EOBI / PESSI" },
  // Admin
  { code: "62101", name: "Staff Travel & Conveyance (Non-Job)", type: "expense", level: 4, parentCode: "6210", isGroup: false, legacyCode: "6100", description: "Staff travel and conveyance that is not for a job" },
  { code: "62102", name: "General Office Overheads", type: "expense", level: 4, parentCode: "6210", isGroup: false, legacyCode: "6200", description: "General office running costs" },
  { code: "62103", name: "Office Supplies & Stationery", type: "expense", level: 4, parentCode: "6210", isGroup: false, legacyCode: "6210", description: "Stationery, printing and office supplies" },
  { code: "62104", name: "Meals & Entertainment", type: "expense", level: 4, parentCode: "6210", isGroup: false, legacyCode: "6220", description: "Management meals, guests and entertainment" },
  { code: "62105", name: "Repairs & Maintenance", type: "expense", level: 4, parentCode: "6210", isGroup: false, legacyCode: "6230", description: "Repairs and maintenance of office and premises" },
  { code: "62106", name: "Vehicle Running Costs", type: "expense", level: 4, parentCode: "6210", isGroup: false, legacyCode: "6240", description: "Fuel, service and repairs of company vehicles" },
  { code: "62107", name: "Non-Claimable Sales Tax", type: "expense", level: 4, parentCode: "6210", isGroup: false, description: "Sales tax on supplier bills that cannot be claimed as input tax" },
  // Utilities
  { code: "63101", name: "Electricity", type: "expense", level: 4, parentCode: "6310", isGroup: false, legacyCode: "6310", description: "Electricity bills" },
  { code: "63102", name: "Water", type: "expense", level: 4, parentCode: "6310", isGroup: false, legacyCode: "6320", description: "Water bills" },
  { code: "63103", name: "Internet", type: "expense", level: 4, parentCode: "6310", isGroup: false, legacyCode: "6330", description: "Internet and broadband bills" },
  { code: "63104", name: "Telephone & Mobile", type: "expense", level: 4, parentCode: "6310", isGroup: false, legacyCode: "6340", description: "Phone and mobile bills" },
  // Other
  { code: "64101", name: "Depreciation Expense", type: "expense", level: 4, parentCode: "6410", isGroup: false, legacyCode: "6350", description: "Depreciation charged on fixed assets" },
  { code: "64102", name: "Rent", type: "expense", level: 4, parentCode: "6410", isGroup: false, legacyCode: "6400", description: "Rent of office, shop and warehouse" },
  { code: "64103", name: "Bank Charges", type: "expense", level: 4, parentCode: "6410", isGroup: false, legacyCode: "6500", description: "Bank fees and charges" },
  { code: "64104", name: "Marketing & Advertising", type: "expense", level: 4, parentCode: "6410", isGroup: false, legacyCode: "6600", description: "Marketing and advertising spend" },
  { code: "64105", name: "Income Tax Expense", type: "expense", level: 4, parentCode: "6410", isGroup: false, description: "Company income tax charge" },
  { code: "64109", name: "Miscellaneous Expenses", type: "expense", level: 4, parentCode: "6410", isGroup: false, legacyCode: "6900", description: "Anything that does not fit another expense account" },
];

/** Old code -> new code for every account and group that was recoded. */
export const LEGACY_ACCOUNT_CODE_MAP: Record<string, string> = Object.fromEntries(
  STANDARD_COA_DEFINITIONS.filter((d) => d.legacyCode).map((d) => [d.legacyCode!, d.code])
);

/** New code for a code that may still be in the old 4-digit / -GRP format (unknown codes pass through). */
export function currentAccountCode(code: string | null | undefined): string {
  const c = String(code || "").trim();
  return LEGACY_ACCOUNT_CODE_MAP[c] || c;
}

/** Top-level group codes (expanded by default in the COA trees). */
export const COA_ROOT_GROUP_CODES = ["10", "20", "30", "40", "50", "60"] as const;

/** Where an account that is not in the standard list lands when it has no parent of its own. */
const DEFAULT_GROUP_BY_TYPE: Record<string, string> = {
  asset: "1110",
  contra_asset: "1510",
  liability: "2110",
  equity: "3110",
  revenue: "4110",
  contra_revenue: "4120",
  expense: "6210",
  contra_expense: "5110",
};

/**
 * Builds the 4-level tree and rolls balances up from level 4 to levels 3, 2 and 1.
 * Accounts saved in the database win over the built-in names; custom accounts and custom
 * groups use their own level and parent.
 */
export function buildChartOfAccountsTree(
  dbAccounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    balance: number;
    entriesCount?: number;
    level?: number;
    parentId?: string | null;
  }>
): CoaNode[] {
  const dbMap = new Map<string, (typeof dbAccounts)[number]>();
  const codeById = new Map<string, string>();
  for (const acc of dbAccounts) {
    dbMap.set(acc.code, acc);
    codeById.set(acc.id, acc.code);
  }

  const nodeMap = new Map<string, CoaNode>();
  for (const def of STANDARD_COA_DEFINITIONS) {
    const dbMatch = dbMap.get(def.code);
    nodeMap.set(def.code, {
      ...def,
      id: dbMatch?.id,
      name: dbMatch?.name || def.name,
      balance: dbMatch && !def.isGroup ? dbMatch.balance : 0,
      entriesCount: dbMatch?.entriesCount || 0,
      children: [],
    });
  }

  for (const acc of dbAccounts) {
    if (nodeMap.has(acc.code)) continue;
    const level = ([1, 2, 3, 4].includes(Number(acc.level)) ? Number(acc.level) : 4) as 1 | 2 | 3 | 4;
    const ownParent = acc.parentId ? codeById.get(acc.parentId) : undefined;
    const parentCode = level === 1 ? undefined : ownParent || DEFAULT_GROUP_BY_TYPE[acc.type] || "6210";
    nodeMap.set(acc.code, {
      code: acc.code,
      name: acc.name,
      type: acc.type as CoaDefinition["type"],
      level,
      parentCode,
      isGroup: level < 4,
      id: acc.id,
      balance: level < 4 ? 0 : acc.balance,
      entriesCount: acc.entriesCount || 0,
      children: [],
    });
  }

  const rootNodes: CoaNode[] = [];
  for (const node of Array.from(nodeMap.values())) {
    if (node.level === 1 || !node.parentCode) {
      rootNodes.push(node);
    } else {
      const parent = nodeMap.get(node.parentCode);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  // Contra accounts carry their natural (credit / debit) balance; when they roll into their
  // parent group they reduce it (accumulated depreciation reduces fixed assets, etc.).
  const signInParent = (node: CoaNode, parent: CoaNode) =>
    (node.type === "contra_asset" && parent.type === "asset") ||
    (node.type === "contra_revenue" && parent.type === "revenue") ||
    (node.type === "contra_expense" && parent.type === "expense")
      ? -1
      : 1;

  function rollupBalance(node: CoaNode): number {
    if (!node.children || node.children.length === 0) {
      return node.balance || 0;
    }
    let sum = 0;
    for (const child of node.children) {
      sum += rollupBalance(child) * signInParent(child, node);
    }
    node.balance = Math.round(sum * 100) / 100;
    node.entriesCount = node.children.reduce((tot, c) => tot + (c.entriesCount || 0), 0);
    return node.balance;
  }
  for (const root of rootNodes) rollupBalance(root);

  return rootNodes;
}

/**
 * Flattens tree into tabular order with indent level and path
 */
export function flattenChartOfAccounts(nodes: CoaNode[]): CoaNode[] {
  const result: CoaNode[] = [];

  function traverse(list: CoaNode[]) {
    for (const item of list) {
      result.push(item);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return result;
}
