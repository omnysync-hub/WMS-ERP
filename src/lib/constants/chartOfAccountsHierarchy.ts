export interface CoaDefinition {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "contra_revenue";
  level: 1 | 2 | 3 | 4;
  parentCode?: string;
  isGroup: boolean;
  description?: string;
}

export interface CoaNode extends CoaDefinition {
  id?: string;
  balance: number;
  entriesCount?: number;
  children?: CoaNode[];
}

/**
 * The ONLY chart of accounts: the client's "Workman ERP - Updated Chart of Accounts".
 * Level 1-3 rows are groups (code ends in -GRP); level 4 rows are the posting accounts.
 * Generated from one data table - keep this file and the database in step.
 */
export const STANDARD_COA_DEFINITIONS: CoaDefinition[] = [
  { code: "1000-GRP", name: "Assets", type: "asset", level: 1, isGroup: true },
  { code: "1100-GRP", name: "Current Assets", type: "asset", level: 2, parentCode: "1000-GRP", isGroup: true },
  { code: "1110-GRP", name: "Cash & Bank", type: "asset", level: 3, parentCode: "1100-GRP", isGroup: true },
  { code: "1120-GRP", name: "Receivables & Advances", type: "asset", level: 3, parentCode: "1100-GRP", isGroup: true },
  { code: "1130-GRP", name: "Inventory", type: "asset", level: 3, parentCode: "1100-GRP", isGroup: true },
  { code: "1500-GRP", name: "Fixed Assets", type: "asset", level: 2, parentCode: "1000-GRP", isGroup: true },
  { code: "1510-GRP", name: "Equipment, Vehicles & Tools", type: "asset", level: 3, parentCode: "1500-GRP", isGroup: true },
  { code: "2000-GRP", name: "Liabilities", type: "liability", level: 1, isGroup: true },
  { code: "2100-GRP", name: "Current Liabilities", type: "liability", level: 2, parentCode: "2000-GRP", isGroup: true },
  { code: "2110-GRP", name: "Payables & Tax Liabilities", type: "liability", level: 3, parentCode: "2100-GRP", isGroup: true },
  { code: "3000-GRP", name: "Equity", type: "equity", level: 1, isGroup: true },
  { code: "3100-GRP", name: "Owner's Equity", type: "equity", level: 2, parentCode: "3000-GRP", isGroup: true },
  { code: "3110-GRP", name: "Capital, Drawings & Earnings", type: "equity", level: 3, parentCode: "3100-GRP", isGroup: true },
  { code: "4000-GRP", name: "Revenue", type: "revenue", level: 1, isGroup: true },
  { code: "4100-GRP", name: "Operating Revenue", type: "revenue", level: 2, parentCode: "4000-GRP", isGroup: true },
  { code: "4110-GRP", name: "Service & Sales Revenue", type: "revenue", level: 3, parentCode: "4100-GRP", isGroup: true },
  { code: "4200-GRP", name: "Other Income & Adjustments", type: "revenue", level: 2, parentCode: "4000-GRP", isGroup: true },
  { code: "4210-GRP", name: "Discounts & Other Income", type: "revenue", level: 3, parentCode: "4200-GRP", isGroup: true },
  { code: "5000-GRP", name: "Cost of Goods Sold (COGS)", type: "expense", level: 1, isGroup: true },
  { code: "5100-GRP", name: "Materials & Goods", type: "expense", level: 2, parentCode: "5000-GRP", isGroup: true },
  { code: "5110-GRP", name: "Materials & Goods Cost", type: "expense", level: 3, parentCode: "5100-GRP", isGroup: true },
  { code: "5200-GRP", name: "Direct Job Costs", type: "expense", level: 2, parentCode: "5000-GRP", isGroup: true },
  { code: "5210-GRP", name: "Job Costs", type: "expense", level: 3, parentCode: "5200-GRP", isGroup: true },
  { code: "6000-GRP", name: "Operating Expenses", type: "expense", level: 1, isGroup: true },
  { code: "6100-GRP", name: "Payroll", type: "expense", level: 2, parentCode: "6000-GRP", isGroup: true },
  { code: "6110-GRP", name: "Salaries & Wages", type: "expense", level: 3, parentCode: "6100-GRP", isGroup: true },
  { code: "6200-GRP", name: "Administrative", type: "expense", level: 2, parentCode: "6000-GRP", isGroup: true },
  { code: "6210-GRP", name: "Administrative Expenses", type: "expense", level: 3, parentCode: "6200-GRP", isGroup: true },
  { code: "6300-GRP", name: "Utilities", type: "expense", level: 2, parentCode: "6000-GRP", isGroup: true },
  { code: "6310-GRP", name: "Utility Expenses", type: "expense", level: 3, parentCode: "6300-GRP", isGroup: true },
  { code: "6400-GRP", name: "Other", type: "expense", level: 2, parentCode: "6000-GRP", isGroup: true },
  { code: "6410-GRP", name: "Other Operating Expenses", type: "expense", level: 3, parentCode: "6400-GRP", isGroup: true },
  { code: "1000", name: "Cash on Hand / Main Drawer", type: "asset", level: 4, parentCode: "1110-GRP", isGroup: false, description: "Physical cash in the shop drawer: counter sales, customer cash receipts and cash payouts" },
  { code: "1005", name: "Petty Cash – Expenses", type: "asset", level: 4, parentCode: "1110-GRP", isGroup: false, description: "Small cash float used to pay daily expenses such as fuel, meals and small purchases" },
  { code: "1010", name: "Operating Bank Account", type: "asset", level: 4, parentCode: "1110-GRP", isGroup: false, description: "Main bank account: transfers, cheques, card sales and vendor payments" },
  { code: "1100", name: "Accounts Receivable – Trade Clients", type: "asset", level: 4, parentCode: "1120-GRP", isGroup: false, description: "Amounts customers and care-of companies owe us for invoices (a ledger is kept per party)" },
  { code: "1150", name: "Employee & Technician Advances", type: "asset", level: 4, parentCode: "1120-GRP", isGroup: false, description: "Cash advances given to employees and technicians, recovered later from salary or claims" },
  { code: "1160", name: "Advance Income Tax", type: "asset", level: 4, parentCode: "1120-GRP", isGroup: false, description: "Income tax withheld by customers from their payments to us; adjustable against our income tax" },
  { code: "1170", name: "Input Sales Tax Recoverable", type: "asset", level: 4, parentCode: "1120-GRP", isGroup: false, description: "Sales tax paid on supplier bills that can be claimed back against output sales tax" },
  { code: "1200", name: "Inventory – Materials & Spares", type: "asset", level: 4, parentCode: "1130-GRP", isGroup: false, description: "Stock of materials and spare parts held in the store (used on jobs and sold at the counter)" },
  { code: "1210", name: "Inventory – Goods for Direct Sale", type: "asset", level: 4, parentCode: "1130-GRP", isGroup: false, description: "Goods held for direct sale to customers" },
  { code: "1500", name: "Office Equipment & Fixed Assets", type: "asset", level: 4, parentCode: "1510-GRP", isGroup: false, description: "Cost of office equipment, furniture and other fixed assets" },
  { code: "1510", name: "Vehicles & Tools", type: "asset", level: 4, parentCode: "1510-GRP", isGroup: false, description: "Cost of company vehicles, tools and service equipment" },
  { code: "1590", name: "Accumulated Depreciation", type: "asset", level: 4, parentCode: "1510-GRP", isGroup: false, description: "Contra-asset: depreciation charged to date on fixed assets (credit balance)" },
  { code: "2000", name: "Accounts Payable – Trade Vendors", type: "liability", level: 4, parentCode: "2110-GRP", isGroup: false, description: "Amounts we owe suppliers for goods and services" },
  { code: "2050", name: "GR/IR Clearing", type: "liability", level: 4, parentCode: "2110-GRP", isGroup: false, description: "Goods received but supplier bill not yet booked" },
  { code: "2100", name: "Technician Payable & Expense Claims", type: "liability", level: 4, parentCode: "2110-GRP", isGroup: false, description: "Expense claims and balances owed to technicians" },
  { code: "2110", name: "Technician Commission Payable", type: "liability", level: 4, parentCode: "2110-GRP", isGroup: false, description: "Commission earned by technicians and not yet paid" },
  { code: "2200", name: "Withholding Tax Payable", type: "liability", level: 4, parentCode: "2110-GRP", isGroup: false, description: "Income tax withheld and payable to the tax authority" },
  { code: "2210", name: "Sales Tax Payable", type: "liability", level: 4, parentCode: "2110-GRP", isGroup: false, description: "Sales tax collected from customers and payable to the tax authority" },
  { code: "3000", name: "Owner Capital / Equity", type: "equity", level: 4, parentCode: "3110-GRP", isGroup: false, description: "Capital put in by the owners" },
  { code: "3100", name: "Owner Drawings", type: "equity", level: 4, parentCode: "3110-GRP", isGroup: false, description: "Money the owners take out of the business" },
  { code: "3200", name: "Retained Earnings", type: "equity", level: 4, parentCode: "3110-GRP", isGroup: false, description: "Profit carried forward from closed years" },
  { code: "3900", name: "Opening Balance Equity", type: "equity", level: 4, parentCode: "3110-GRP", isGroup: false, description: "Balancing account for go-live opening balances" },
  { code: "4000", name: "Service Revenue – Installation", type: "revenue", level: 4, parentCode: "4110-GRP", isGroup: false, description: "Income from installation and commissioning jobs" },
  { code: "4001", name: "Service Revenue – Repair & Maintenance", type: "revenue", level: 4, parentCode: "4110-GRP", isGroup: false, description: "Income from repair, service, gas recharge and maintenance jobs" },
  { code: "4010", name: "Goods Revenue – Parts & Products Sold to Customers", type: "revenue", level: 4, parentCode: "4110-GRP", isGroup: false, description: "Parts and products sold to customers on invoices, including goods bought from the market for the customer" },
  { code: "4002", name: "POS Counter Sales Revenue", type: "revenue", level: 4, parentCode: "4110-GRP", isGroup: false, description: "Over-the-counter (POS) sales" },
  { code: "4100", name: "Discounts Allowed", type: "contra_revenue", level: 4, parentCode: "4210-GRP", isGroup: false, description: "Contra-revenue: discounts given to customers" },
  { code: "4900", name: "Other Income", type: "revenue", level: 4, parentCode: "4210-GRP", isGroup: false, description: "Any other income not related to jobs or sales" },
  { code: "5000", name: "COGS – Materials Used on Jobs", type: "expense", level: 4, parentCode: "5110-GRP", isGroup: false, description: "Cost of store materials issued to jobs" },
  { code: "5010", name: "COGS – Goods Bought from Market for Customer", type: "expense", level: 4, parentCode: "5110-GRP", isGroup: false, description: "Cost of goods bought from the market for a customer's job" },
  { code: "5030", name: "COGS – POS Goods Sold", type: "expense", level: 4, parentCode: "5110-GRP", isGroup: false, description: "Cost of goods sold over the counter" },
  { code: "5040", name: "Stock Adjustments & Workshop Consumption", type: "expense", level: 4, parentCode: "5110-GRP", isGroup: false, description: "Stock count write-offs / write-ups and parts used in the workshop (not on a customer job)" },
  { code: "5050", name: "Purchase Price Variance & Supplier Discounts", type: "expense", level: 4, parentCode: "5110-GRP", isGroup: false, description: "Difference between PO price and supplier bill; supplier discounts reduce it" },
  { code: "5100", name: "Job Fuel & Conveyance", type: "expense", level: 4, parentCode: "5210-GRP", isGroup: false, description: "Fuel and conveyance spent on jobs" },
  { code: "5110", name: "Job Food & Meals", type: "expense", level: 4, parentCode: "5210-GRP", isGroup: false, description: "Food and meals for the team on jobs" },
  { code: "5120", name: "Technician Commission Expense", type: "expense", level: 4, parentCode: "5210-GRP", isGroup: false, description: "Commission earned by technicians on jobs" },
  { code: "5130", name: "Other Direct Job Costs", type: "expense", level: 4, parentCode: "5210-GRP", isGroup: false, description: "Any other direct cost of a job" },
  { code: "6000", name: "Salaries & Wages", type: "expense", level: 4, parentCode: "6110-GRP", isGroup: false, description: "Fixed salaries and wages only" },
  { code: "6100", name: "Staff Travel & Conveyance (Non-Job)", type: "expense", level: 4, parentCode: "6210-GRP", isGroup: false, description: "Staff travel and conveyance that is not for a job" },
  { code: "6200", name: "General Office Overheads", type: "expense", level: 4, parentCode: "6210-GRP", isGroup: false, description: "General office running costs" },
  { code: "6210", name: "Office Supplies & Stationery", type: "expense", level: 4, parentCode: "6210-GRP", isGroup: false, description: "Stationery, printing and office supplies" },
  { code: "6220", name: "Executive Meals & Entertainment", type: "expense", level: 4, parentCode: "6210-GRP", isGroup: false, description: "Management meals, guests and entertainment" },
  { code: "6230", name: "Repairs & Maintenance", type: "expense", level: 4, parentCode: "6210-GRP", isGroup: false, description: "Repairs and maintenance of office and premises" },
  { code: "6240", name: "Vehicle Running Costs (Company Vehicles)", type: "expense", level: 4, parentCode: "6210-GRP", isGroup: false, description: "Fuel, service and repairs of company vehicles" },
  { code: "6310", name: "Electricity", type: "expense", level: 4, parentCode: "6310-GRP", isGroup: false, description: "Electricity bills" },
  { code: "6320", name: "Water", type: "expense", level: 4, parentCode: "6310-GRP", isGroup: false, description: "Water bills" },
  { code: "6330", name: "Internet", type: "expense", level: 4, parentCode: "6310-GRP", isGroup: false, description: "Internet and broadband bills" },
  { code: "6340", name: "Telephone & Mobile", type: "expense", level: 4, parentCode: "6310-GRP", isGroup: false, description: "Phone and mobile bills" },
  { code: "6350", name: "Depreciation Expense", type: "expense", level: 4, parentCode: "6410-GRP", isGroup: false, description: "Depreciation charged on fixed assets" },
  { code: "6400", name: "Rent", type: "expense", level: 4, parentCode: "6410-GRP", isGroup: false, description: "Rent of office, shop and warehouse" },
  { code: "6500", name: "Bank Charges", type: "expense", level: 4, parentCode: "6410-GRP", isGroup: false, description: "Bank fees and charges" },
  { code: "6600", name: "Marketing & Advertising", type: "expense", level: 4, parentCode: "6410-GRP", isGroup: false, description: "Marketing and advertising spend" },
  { code: "6900", name: "Miscellaneous Expenses", type: "expense", level: 4, parentCode: "6410-GRP", isGroup: false, description: "Anything that does not fit another expense account" },
];

/** Where an account that is not in the standard list lands when it has no parent of its own. */
const DEFAULT_GROUP_BY_TYPE: Record<string, string> = {
  asset: "1110-GRP",
  liability: "2110-GRP",
  equity: "3110-GRP",
  revenue: "4110-GRP",
  contra_revenue: "4210-GRP",
  expense: "6210-GRP",
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
    const parentCode = level === 1 ? undefined : ownParent || DEFAULT_GROUP_BY_TYPE[acc.type] || "6210-GRP";
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

  function rollupBalance(node: CoaNode): number {
    if (!node.children || node.children.length === 0) {
      return node.balance || 0;
    }
    let sum = 0;
    for (const child of node.children) {
      sum += rollupBalance(child);
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
