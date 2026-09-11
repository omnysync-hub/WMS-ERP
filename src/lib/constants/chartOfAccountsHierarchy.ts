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

export const STANDARD_COA_DEFINITIONS: CoaDefinition[] = [
  // =========================================================================
  // LEVEL 1: ASSETS (1000)
  // =========================================================================
  {
    code: "1000-GRP",
    name: "Assets",
    type: "asset",
    level: 1,
    isGroup: true,
    description: "Economic resources controlled by the business",
  },
  // LEVEL 2: CURRENT ASSETS
  {
    code: "1100",
    name: "Current Assets",
    type: "asset",
    level: 2,
    parentCode: "1000-GRP",
    isGroup: true,
    description: "Cash and resources converted to cash within one year",
  },
  // LEVEL 3: Cash & Cash Equivalents
  {
    code: "1110",
    name: "Cash & Cash Equivalents",
    type: "asset",
    level: 3,
    parentCode: "1100",
    isGroup: true,
    description: "Physical cash on hand and liquid bank deposits",
  },
  // LEVEL 4: Detail Accounts under Cash & Bank
  {
    code: "1000",
    name: "Cash on Hand / Main Drawer",
    type: "asset",
    level: 4,
    parentCode: "1110",
    isGroup: false,
    description: "Physical currency in cash drawer for walk-in and counter collections",
  },
  {
    code: "1010",
    name: "Operating Bank Account (Meezan Bank)",
    type: "asset",
    level: 4,
    parentCode: "1110",
    isGroup: false,
    description: "Primary corporate checking and disbursement account",
  },
  {
    code: "1011",
    name: "Secondary Bank Account (HBL)",
    type: "asset",
    level: 4,
    parentCode: "1110",
    isGroup: false,
    description: "Corporate collections and online transfer account",
  },
  {
    code: "1020",
    name: "Petty Cash Float",
    type: "asset",
    level: 4,
    parentCode: "1110",
    isGroup: false,
    description: "Field emergency petty cash and storekeeper float",
  },

  // LEVEL 3: Trade Receivables
  {
    code: "1120",
    name: "Trade Receivables (Debtors)",
    type: "asset",
    level: 3,
    parentCode: "1100",
    isGroup: true,
    description: "Amounts billed to customers for work orders and HVAC contracts",
  },
  // LEVEL 4: Detail Accounts under Receivables
  {
    code: "1100",
    name: "Accounts Receivable - Trade Clients",
    type: "asset",
    level: 4,
    parentCode: "1120",
    isGroup: false,
    description: "Customer invoice balances and credit receivables",
  },
  {
    code: "1101",
    name: "Care-Of Corporate Subcontract Receivables",
    type: "asset",
    level: 4,
    parentCode: "1120",
    isGroup: false,
    description: "Receivables from 3rd party FM and facility management companies",
  },

  // LEVEL 3: Inventories & Stock
  {
    code: "1130",
    name: "Inventories & Consumable Stock",
    type: "asset",
    level: 3,
    parentCode: "1100",
    isGroup: true,
    description: "HVAC equipment, spare parts, and refrigerant gases on hand",
  },
  // LEVEL 4: Detail Accounts under Inventory
  {
    code: "1200",
    name: "Inventory Asset - HVAC Equipment & Parts",
    type: "asset",
    level: 4,
    parentCode: "1130",
    isGroup: false,
    description: "Warehouse inventory stock valuation",
  },

  // LEVEL 3: Advances & Deposits
  {
    code: "1140",
    name: "Advances, Deposits & Prepayments",
    type: "asset",
    level: 3,
    parentCode: "1100",
    isGroup: true,
    description: "Staff advances and vendor security deposits",
  },
  // LEVEL 4: Detail Accounts under Advances
  {
    code: "1150",
    name: "Employee & Technician Advances",
    type: "asset",
    level: 4,
    parentCode: "1140",
    isGroup: false,
    description: "Disbursed job floats and travel advances to field technicians",
  },

  // LEVEL 2: NON-CURRENT / FIXED ASSETS
  {
    code: "1200-GRP",
    name: "Property, Plant & Equipment",
    type: "asset",
    level: 2,
    parentCode: "1000-GRP",
    isGroup: true,
    description: "Long term tangible assets used in service delivery",
  },
  // LEVEL 3: Machinery & Tools
  {
    code: "1210",
    name: "Service Equipment, Vehicles & Tools",
    type: "asset",
    level: 3,
    parentCode: "1200-GRP",
    isGroup: true,
    description: "Field service vans, vacuum pumps, manifolds, and recovery units",
  },
  // LEVEL 4:
  {
    code: "1211",
    name: "Service Fleet & Field Vehicles",
    type: "asset",
    level: 4,
    parentCode: "1210",
    isGroup: false,
    description: "Company owned service vans and transport motorcycles",
  },
  {
    code: "1212",
    name: "HVAC Specialized Diagnostic Tools",
    type: "asset",
    level: 4,
    parentCode: "1210",
    isGroup: false,
    description: "Digital manifold gauges, vacuum gauges, and thermal cameras",
  },

  // =========================================================================
  // LEVEL 1: LIABILITIES (2000)
  // =========================================================================
  {
    code: "2000-GRP",
    name: "Liabilities",
    type: "liability",
    level: 1,
    isGroup: true,
    description: "Debts, payables, and obligations owed by the enterprise",
  },
  // LEVEL 2: CURRENT LIABILITIES
  {
    code: "2100-GRP",
    name: "Current Liabilities",
    type: "liability",
    level: 2,
    parentCode: "2000-GRP",
    isGroup: true,
    description: "Short term obligations due within one financial year",
  },
  // LEVEL 3: Trade Payables
  {
    code: "2110",
    name: "Trade Payables (Creditors)",
    type: "liability",
    level: 3,
    parentCode: "2100-GRP",
    isGroup: true,
    description: "Outstanding balances owed to suppliers and parts vendors",
  },
  // LEVEL 4:
  {
    code: "2000",
    name: "Accounts Payable - Trade Vendors",
    type: "liability",
    level: 4,
    parentCode: "2110",
    isGroup: false,
    description: "Vendor payables for parts, refrigerant cylinders, and copper",
  },

  // LEVEL 3: Accrued & Staff Liabilities
  {
    code: "2120",
    name: "Technician & Staff Liabilities",
    type: "liability",
    level: 3,
    parentCode: "2100-GRP",
    isGroup: true,
    description: "Technician field expense claims and salary obligations",
  },
  // LEVEL 4:
  {
    code: "2100",
    name: "Technician Payable & Expense Claims",
    type: "liability",
    level: 4,
    parentCode: "2120",
    isGroup: false,
    description: "Pending field expense reimbursements and hisaab balance due to techs",
  },

  // =========================================================================
  // LEVEL 1: EQUITY (3000)
  // =========================================================================
  {
    code: "3000-GRP",
    name: "Equity & Capital",
    type: "equity",
    level: 1,
    isGroup: true,
    description: "Owners' residual interest in the assets after deducting liabilities",
  },
  // LEVEL 2: OWNERS CAPITAL
  {
    code: "3100",
    name: "Owners' Capital & Reserves",
    type: "equity",
    level: 2,
    parentCode: "3000-GRP",
    isGroup: true,
    description: "Capital invested by partners and accumulated profits",
  },
  // LEVEL 3: Contributed Capital
  {
    code: "3110",
    name: "Contributed Capital & Drawings",
    type: "equity",
    level: 3,
    parentCode: "3100",
    isGroup: true,
    description: "Partner investments and drawings",
  },
  // LEVEL 4:
  {
    code: "3000",
    name: "Owner Capital / Equity",
    type: "equity",
    level: 4,
    parentCode: "3110",
    isGroup: false,
    description: "Original capital investment into Workman Services",
  },
  {
    code: "3010",
    name: "Owner Drawings",
    type: "equity",
    level: 4,
    parentCode: "3110",
    isGroup: false,
    description: "Withdrawals of profits by business owners",
  },

  // =========================================================================
  // LEVEL 1: REVENUE & INCOME (4000)
  // =========================================================================
  {
    code: "4000-GRP",
    name: "Revenue & Operating Income",
    type: "revenue",
    level: 1,
    isGroup: true,
    description: "Income earned from HVAC contracts, repairs, installations, and retail",
  },
  // LEVEL 2: OPERATING REVENUE
  {
    code: "4100-GRP",
    name: "Operating Revenue",
    type: "revenue",
    level: 2,
    parentCode: "4000-GRP",
    isGroup: true,
    description: "Core HVAC trade sales and services",
  },
  // LEVEL 3: Service & Installation Revenue
  {
    code: "4110",
    name: "HVAC Services & Installation Billing",
    type: "revenue",
    level: 3,
    parentCode: "4100-GRP",
    isGroup: true,
    description: "Labor and installation fee revenue",
  },
  // LEVEL 4:
  {
    code: "4000",
    name: "HVAC Service & Installation Revenue",
    type: "revenue",
    level: 4,
    parentCode: "4110",
    isGroup: false,
    description: "Work order service completions and installation billings",
  },
  {
    code: "4001",
    name: "Emergency Repair & Breakdown Income",
    type: "revenue",
    level: 4,
    parentCode: "4110",
    isGroup: false,
    description: "Call-out and troubleshooting fee earnings",
  },
  {
    code: "4002",
    name: "POS Counter Sales & Retail Parts Revenue",
    type: "revenue",
    level: 4,
    parentCode: "4110",
    isGroup: false,
    description: "Over-the-counter spare part and gas cylinder sales",
  },

  // LEVEL 3: Discounts & Allowances
  {
    code: "4120",
    name: "Sales Discounts & Allowances",
    type: "contra_revenue",
    level: 3,
    parentCode: "4100-GRP",
    isGroup: true,
    description: "Customer concessions, approved reductions, and promotional discounts",
  },
  // LEVEL 4:
  {
    code: "4100",
    name: "Discounts Allowed",
    type: "contra_revenue",
    level: 4,
    parentCode: "4120",
    isGroup: false,
    description: "Customer invoice discounts granted and accountant approvals",
  },

  // =========================================================================
  // LEVEL 1: COST OF GOODS SOLD (5000)
  // =========================================================================
  {
    code: "5000-GRP",
    name: "Cost of Goods Sold (COGS)",
    type: "expense",
    level: 1,
    isGroup: true,
    description: "Direct costs of materials, equipment, and gas consumed on work orders",
  },
  // LEVEL 2: DIRECT MATERIALS & PARTS
  {
    code: "5100",
    name: "Direct Materials & Parts Consumed",
    type: "expense",
    level: 2,
    parentCode: "5000-GRP",
    isGroup: true,
    description: "Components issued by warehouse and consumed on field jobs",
  },
  // LEVEL 3: Material Costs
  {
    code: "5110",
    name: "HVAC Parts & Gas Consumption",
    type: "expense",
    level: 3,
    parentCode: "5100",
    isGroup: true,
    description: "Refrigerant, copper tubing, capacitors, and PCB boards",
  },
  // LEVEL 4:
  {
    code: "5000",
    name: "Cost of Goods Sold (COGS) - Materials",
    type: "expense",
    level: 4,
    parentCode: "5110",
    isGroup: false,
    description: "Direct inventory cost deducted upon job consumption or POS sale",
  },

  // =========================================================================
  // LEVEL 1: OPERATING EXPENSES (6000)
  // =========================================================================
  {
    code: "6000-GRP",
    name: "Operating Expenses (OPEX)",
    type: "expense",
    level: 1,
    isGroup: true,
    description: "General, administrative, fleet, and field expenditures",
  },
  // LEVEL 2: PAYROLL & HUMAN RESOURCES
  {
    code: "6100-GRP",
    name: "Salaries, Wages & Staff Benefits",
    type: "expense",
    level: 2,
    parentCode: "6000-GRP",
    isGroup: true,
    description: "Headcount costs and monthly compensation",
  },
  // LEVEL 3: Direct Payroll
  {
    code: "6110",
    name: "Operational Payroll",
    type: "expense",
    level: 3,
    parentCode: "6100-GRP",
    isGroup: true,
    description: "Technician basic salaries and office administrative staff wages",
  },
  // LEVEL 4:
  {
    code: "6000",
    name: "Salaries & Wages Expense",
    type: "expense",
    level: 4,
    parentCode: "6110",
    isGroup: false,
    description: "Monthly staff payroll postings",
  },

  // LEVEL 2: FIELD & FLEET EXPENSES
  {
    code: "6200-GRP",
    name: "Field Operations & Fleet Expenses",
    type: "expense",
    level: 2,
    parentCode: "6000-GRP",
    isGroup: true,
    description: "Fuel, vehicle maintenance, parking, and technician daily allowances",
  },
  // LEVEL 3: Field Transportation
  {
    code: "6210",
    name: "Technician Field Logistics",
    type: "expense",
    level: 3,
    parentCode: "6200-GRP",
    isGroup: true,
    description: "Site transit, generator fuel, and highway tolls",
  },
  // LEVEL 4:
  {
    code: "6100",
    name: "Technician Travel & Field Expenses",
    type: "expense",
    level: 4,
    parentCode: "6210",
    isGroup: false,
    description: "Field fuel claims, parking receipts, and site transport expenses",
  },

  // LEVEL 2: ADMINISTRATIVE & OFFICE EXPENSES
  {
    code: "6300-GRP",
    name: "Administrative & Facility Overheads",
    type: "expense",
    level: 2,
    parentCode: "6000-GRP",
    isGroup: true,
    description: "Office rent, internet, electricity, and software subscriptions",
  },
  // LEVEL 3: Office Utilities
  {
    code: "6310",
    name: "Utilities & Office Facility Costs",
    type: "expense",
    level: 3,
    parentCode: "6300-GRP",
    isGroup: true,
    description: "Monthly electricity, high-speed fiber, and facility rent",
  },
  // LEVEL 4 (Transactional Accounts):
  {
    code: "6200",
    name: "General Office & Facility Overheads",
    type: "expense",
    level: 4,
    parentCode: "6310",
    isGroup: false,
    description: "Head office rent, power bills, and general office expenses",
  },
  {
    code: "6201",
    name: "Internet & Telecom Subscriptions",
    type: "expense",
    level: 4,
    parentCode: "6310",
    isGroup: false,
    description: "High-speed broadband, cellular lines, and cloud software subscriptions",
  },
  {
    code: "6202",
    name: "Printer Ink & Office Stationery",
    type: "expense",
    level: 4,
    parentCode: "6310",
    isGroup: false,
    description: "Printer toner cartridges, paper reams, office stationery supplies",
  },
];

/**
 * Builds the 4-level Tree structure and rolls up balances from Level 4 to Levels 3, 2, and 1.
 */
export function buildChartOfAccountsTree(
  dbAccounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    balance: number;
    entriesCount?: number;
  }>
): CoaNode[] {
  // Map of ledger accounts from database keyed by code
  const dbMap = new Map<string, { id: string; balance: number; entriesCount: number; name: string }>();
  for (const acc of dbAccounts) {
    dbMap.set(acc.code, {
      id: acc.id,
      balance: acc.balance,
      entriesCount: acc.entriesCount || 0,
      name: acc.name,
    });
  }

  // Create node map initialized with definitions
  const nodeMap = new Map<string, CoaNode>();

  for (const def of STANDARD_COA_DEFINITIONS) {
    const dbMatch = dbMap.get(def.code);
    nodeMap.set(def.code, {
      ...def,
      id: dbMatch?.id,
      name: dbMatch?.name || def.name,
      balance: dbMatch ? dbMatch.balance : 0,
      entriesCount: dbMatch?.entriesCount || 0,
      children: [],
    });
  }

  // If there are any custom db accounts not in STANDARD_COA_DEFINITIONS, add them under appropriate Level 3
  for (const acc of dbAccounts) {
    if (!nodeMap.has(acc.code)) {
      // Find default parent based on code prefix or account type
      let parentCode = "1110";
      if (acc.type === "liability") parentCode = "2110";
      else if (acc.type === "equity") parentCode = "3110";
      else if (acc.type === "revenue") parentCode = "4110";
      else if (acc.type === "expense") parentCode = "6310";
      else if (acc.type === "contra_revenue") parentCode = "4120";

      nodeMap.set(acc.code, {
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        level: 4,
        parentCode,
        isGroup: false,
        id: acc.id,
        balance: acc.balance,
        entriesCount: acc.entriesCount || 0,
        children: [],
      });
    }
  }

  // Build hierarchy tree
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

  // Recursive balance rollup function
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

  for (const root of rootNodes) {
    rollupBalance(root);
  }

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
