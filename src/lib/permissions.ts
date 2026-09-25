export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  module: string;
}

export interface PermissionModuleGroup {
  id: string;
  name: string;
  iconName: string;
  description: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionModuleGroup[] = [
  {
    id: "jobs",
    name: "Jobs & Work Orders",
    iconName: "Briefcase",
    description: "Job intake, directory, technician assignment, materials, returns, and billing sub-parts",
    permissions: [
      {
        key: "jobs.view_directory",
        label: "View Jobs Directory",
        description: "Allow viewing and searching the jobs directory list",
        module: "jobs",
      },
      {
        key: "jobs.view_financials",
        label: "View Financial Rates & Values",
        description: "Allow viewing billable rates, invoices, profits, and job collection figures (strictly masked for storekeeper when off)",
        module: "jobs",
      },
      {
        key: "jobs.create_job",
        label: "Create New Job Work Order",
        description: "Allow creating new service tickets and taking customer job intakes",
        module: "jobs",
      },
      {
        key: "jobs.edit_job",
        label: "Edit Job & Appliance Details",
        description: "Allow editing customer contact, address, unit brand, model number, and Care-Of party",
        module: "jobs",
      },
      {
        key: "jobs.reassign_tech",
        label: "Assign / Reassign Technician",
        description: "Allow assigning or changing assigned field technicians on active jobs",
        module: "jobs",
      },
      {
        key: "jobs.add_service",
        label: "Add Billable Services Post-Creation",
        description: "Allow accountants and dispatchers to add billable services or items with custom rates",
        module: "jobs",
      },
      {
        key: "jobs.issue_stock",
        label: "Issue Warehouse Inventory to Job",
        description: "Allow storekeeper to issue physical parts from warehouse directly to job",
        module: "jobs",
      },
      {
        key: "jobs.stock_return",
        label: "Record Stock Return from Field",
        description: "Allow recording and accepting unused warehouse materials returned by technicians",
        module: "jobs",
      },
      {
        key: "jobs.misplaced_item",
        label: "Report Misplaced / Lost Material",
        description: "Allow recording lost or misplaced on-site items by technician without false restock",
        module: "jobs",
      },
      {
        key: "jobs.generate_invoice",
        label: "Generate Tax Invoice (INV-JOB)",
        description: "Allow generating formal customer tax invoices with custom numbering",
        module: "jobs",
      },
      {
        key: "jobs.collect_payment",
        label: "Collect Payment & Hissab",
        description: "Allow recording cash collections, card receipts, and reconciliation against job",
        module: "jobs",
      },
      {
        key: "jobs.cancel_job",
        label: "Cancel / Void Job Work Order",
        description: "Allow voiding or cancelling work orders and releasing assigned resources",
        module: "jobs",
      },
      {
        key: "jobs.reports",
        label: "Access Job & Care-Of Reports",
        description: "Allow viewing detailed analytics, completion metrics, and Care-Of party aggregations",
        module: "jobs",
      },
    ],
  },
  {
    id: "dispatch",
    name: "Live Dispatch & Surveillance",
    iconName: "MapPin",
    description: "Real-time fleet dispatch, interactive maps, and technician GPS tracking",
    permissions: [
      {
        key: "dispatch.view_map",
        label: "View Live Dispatch Map",
        description: "Allow viewing the interactive city map with technician and job locations",
        module: "dispatch",
      },
      {
        key: "dispatch.assign_job",
        label: "Interactive Scheduling & Routing",
        description: "Allow routing jobs, dragging appointments, and auto-dispatching technicians",
        module: "dispatch",
      },
      {
        key: "dispatch.surveillance",
        label: "GPS Surveillance & Breadcrumbs",
        description: "Allow viewing live location pings, route replay, speed, and geofence tracking",
        module: "dispatch",
      },
    ],
  },
  {
    id: "inventory",
    name: "Warehouse & Multi-Branch Stock",
    iconName: "Package",
    description: "Warehouse stock levels, purchasing costs, storekeeper queue, branch transfers, and tool-crib",
    permissions: [
      {
        key: "inventory.view_stock",
        label: "View Stock Quantities",
        description: "Allow viewing on-hand warehouse inventory and field-allocated quantities",
        module: "inventory",
      },
      {
        key: "inventory.view_costs",
        label: "View Purchasing Costs & Valuations",
        description: "Allow viewing purchase costs, valuation averages, and total stock asset values (strictly masked when off)",
        module: "inventory",
      },
      {
        key: "inventory.restock",
        label: "Restock & Declare Opening Stock",
        description: "Allow creating new inventory items, restock inwards, and opening balance postings",
        module: "inventory",
      },
      {
        key: "inventory.storekeeper_queue",
        label: "Storekeeper Queue & Fulfillment",
        description: "Allow fulfilling technician material requests and inspecting physical returns",
        module: "inventory",
      },
      {
        key: "inventory.branch_transfers",
        label: "Inter-Branch Stock Transfers",
        description: "Allow dispatching and receiving stock transfers between regional branches with challans",
        module: "inventory",
      },
      {
        key: "inventory.adjustments",
        label: "Record Discrepancy Adjustments",
        description: "Allow logging periodic physical audit variances, damaged parts, and gas leakage write-offs",
        module: "inventory",
      },
      {
        key: "inventory.workshop_consumption",
        label: "Internal Workshop Consumption",
        description: "Allow logging in-house parts consumption for test benches and appliance refurbishing",
        module: "inventory",
      },
      {
        key: "inventory.tool_crib",
        label: "Heavy Equipment & Tool-Crib",
        description: "Allow checking out and returning vacuum pumps, recovery units, and manifolds to technicians",
        module: "inventory",
      },
      {
        key: "inventory.stock_units",
        label: "Manage Stock Units (UOM)",
        description: "Allow configuring measurement units (pcs, cyl, kg, mtr) and decimal precision",
        module: "inventory",
      },
    ],
  },
  {
    id: "procurement",
    name: "Procurement & Sourcing",
    iconName: "ShoppingCart",
    description: "Purchase requisitions (PR), PO approvals, goods receipt notes (GRN), and vendor bills",
    permissions: [
      {
        key: "procurement.view_pr",
        label: "View Purchase Requisitions (PR)",
        description: "Allow viewing requisitions raised by stores, job sites, and projects",
        module: "procurement",
      },
      {
        key: "procurement.create_pr",
        label: "Raise Purchase Requisition (PR)",
        description: "Allow creating new procurement requisitions for store replenishment or jobs",
        module: "procurement",
      },
      {
        key: "procurement.approve_po",
        label: "Approve & Issue Purchase Orders (PO)",
        description: "Allow management to approve POs, send to vendors, and manage framework contracts",
        module: "procurement",
      },
      {
        key: "procurement.grn",
        label: "Receive Inward Goods (GRN)",
        description: "Allow storekeeper to record physical delivery count, batches, and quality checks",
        module: "procurement",
      },
      {
        key: "procurement.bills",
        label: "Process Supplier Bills & 3-Way Match",
        description: "Allow accounts to match supplier invoices against PO and GRN with price variance analysis",
        module: "procurement",
      },
      {
        key: "procurement.payments",
        label: "Disburse Supplier Payments",
        description: "Allow disbursing bank transfers, cheques, and cash vouchers with WHT deductions",
        module: "procurement",
      },
    ],
  },
  {
    id: "accounts",
    name: "Accounts & Financials",
    iconName: "CreditCard",
    description: "General ledger, Chart of Accounts, cashier POS terminal, and financial reporting",
    permissions: [
      {
        key: "accounts.general_ledger",
        label: "View General Ledger & Journals",
        description: "Allow viewing double-entry accounting journals and balance sheet postings",
        module: "accounts",
      },
      {
        key: "accounts.chart_of_accounts",
        label: "Manage Chart of Accounts (COA)",
        description: "Allow viewing and configuring 4-level account hierarchies and system mappings",
        module: "accounts",
      },
      {
        key: "accounts.pos",
        label: "Counter POS Terminal Access",
        description: "Allow processing over-the-counter spare parts cash sales and immediate invoicing",
        module: "accounts",
      },
      {
        key: "accounts.cashier_register",
        label: "Cashier Register Sessions & Hissab",
        description: "Allow cashier opening cash float, daily drawer close, and hissab verification",
        module: "accounts",
      },
      {
        key: "accounts.financial_reports",
        label: "Access Financial Statements & P&L",
        description: "Allow viewing Trial Balance, Income Statement (P&L), and Balance Sheet",
        module: "accounts",
      },
    ],
  },
  {
    id: "hrm",
    name: "HRM & Workforce Management",
    iconName: "UserCheck",
    description: "Employee records, face biometric attendance, payroll runs, and asset assignments",
    permissions: [
      {
        key: "hrm.view_employees",
        label: "View Employee Directory",
        description: "Allow viewing employee listings, designations, phone numbers, and departments",
        module: "hrm",
      },
      {
        key: "hrm.manage_employees",
        label: "Create & Edit Employees",
        description: "Allow onboarding new staff, modifying contracts, salaries, and reporting managers",
        module: "hrm",
      },
      {
        key: "hrm.attendance",
        label: "Biometric Attendance & Geofence Logs",
        description: "Allow reviewing daily check-in logs, face recognition scores, and geofence flags",
        module: "hrm",
      },
      {
        key: "hrm.payroll",
        label: "Payroll Runs & Salary Slips",
        description: "Allow running monthly payroll, generating payslips, and processing net disbursements",
        module: "hrm",
      },
      {
        key: "hrm.advances",
        label: "Employee Advances & Settlements",
        description: "Allow issuing salary advances and calculating final settlement encashments",
        module: "hrm",
      },
    ],
  },
  {
    id: "settings",
    name: "Settings, Users & Role Control",
    iconName: "ShieldCheck",
    description: "User management, role creation, granular toggle controls, and audit trails",
    permissions: [
      {
        key: "settings.manage_users",
        label: "Create & Manage System Users",
        description: "Allow creating new users, editing details, and toggling account access on/off",
        module: "settings",
      },
      {
        key: "settings.manage_roles",
        label: "Create Roles & Configure Permissions",
        description: "Allow creating custom roles and toggling every sub-part permission on/off",
        module: "settings",
      },
      {
        key: "settings.accounting",
        label: "Configure Accounting Engine",
        description: "Allow managing automatic transaction debit/credit rules and ledger mappings",
        module: "settings",
      },
      {
        key: "audit.view_logs",
        label: "View Audit Trail & Rollback History",
        description: "Allow inspecting comprehensive action logs, user audit history, and undoing changes",
        module: "settings",
      },
    ],
  },
];

// Helper: All permission keys flat array
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

// Built-in Default Permission Maps for Core Personas
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),

  accountant: {
    // Jobs
    "jobs.view_directory": true,
    "jobs.view_financials": true,
    "jobs.create_job": true,
    "jobs.edit_job": true,
    "jobs.reassign_tech": false,
    "jobs.add_service": true,
    "jobs.issue_stock": false,
    "jobs.stock_return": true,
    "jobs.misplaced_item": true,
    "jobs.generate_invoice": true,
    "jobs.collect_payment": true,
    "jobs.cancel_job": false,
    "jobs.reports": true,
    // Dispatch
    "dispatch.view_map": false,
    "dispatch.assign_job": false,
    "dispatch.surveillance": false,
    // Inventory
    "inventory.view_stock": true,
    "inventory.view_costs": true,
    "inventory.restock": true,
    "inventory.opening_stock": true,
    "inventory.storekeeper_queue": false,
    "inventory.branch_transfers": true,
    "inventory.adjustments": true,
    "inventory.workshop_consumption": true,
    "inventory.tool_crib": false,
    "inventory.stock_units": true,
    // Procurement
    "procurement.view_pr": true,
    "procurement.create_pr": true,
    "procurement.approve_po": true,
    "procurement.grn": true,
    "procurement.bills": true,
    "procurement.payments": true,
    // Accounts
    "accounts.general_ledger": true,
    "accounts.chart_of_accounts": true,
    "accounts.pos": true,
    "accounts.cashier_register": true,
    "accounts.financial_reports": true,
    // HRM
    "hrm.view_employees": true,
    "hrm.manage_employees": false,
    "hrm.attendance": false,
    "hrm.payroll": true,
    "hrm.advances": true,
    // Settings
    "settings.manage_users": false,
    "settings.manage_roles": false,
    "settings.accounting": true,
    "audit.view_logs": true,
  },

  storekeeper: {
    // Jobs (STRICT PRICE MASKING)
    "jobs.view_directory": true,
    "jobs.view_financials": false, // STRICTLY MASKED
    "jobs.create_job": false,
    "jobs.edit_job": false,
    "jobs.reassign_tech": false,
    "jobs.add_service": false,
    "jobs.issue_stock": true,
    "jobs.stock_return": false, // Storekeeper on jobs can ONLY issue stock, no other option
    "jobs.misplaced_item": false,
    "jobs.generate_invoice": false,
    "jobs.collect_payment": false,
    "jobs.cancel_job": false,
    "jobs.reports": false,
    // Dispatch
    "dispatch.view_map": false,
    "dispatch.assign_job": false,
    "dispatch.surveillance": false,
    // Inventory
    "inventory.view_stock": true,
    "inventory.view_costs": false, // STRICTLY MASKED
    "inventory.restock": true,
    "inventory.opening_stock": true,
    "inventory.storekeeper_queue": true,
    "inventory.branch_transfers": true,
    "inventory.adjustments": true,
    "inventory.workshop_consumption": true,
    "inventory.tool_crib": true,
    "inventory.stock_units": true,
    // Procurement
    "procurement.view_pr": true,
    "procurement.create_pr": true,
    "procurement.approve_po": false,
    "procurement.grn": true,
    "procurement.bills": false,
    "procurement.payments": false,
    // Accounts
    "accounts.general_ledger": false,
    "accounts.chart_of_accounts": false,
    "accounts.pos": false,
    "accounts.cashier_register": false,
    "accounts.financial_reports": false,
    // HRM
    "hrm.view_employees": false,
    "hrm.manage_employees": false,
    "hrm.attendance": false,
    "hrm.payroll": false,
    "hrm.advances": false,
    // Settings
    "settings.manage_users": false,
    "settings.manage_roles": false,
    "settings.accounting": false,
    "audit.view_logs": false,
  },

  call_center: {
    // Jobs
    "jobs.view_directory": true,
    "jobs.view_financials": true,
    "jobs.create_job": true,
    "jobs.edit_job": true,
    "jobs.reassign_tech": true,
    "jobs.add_service": true,
    "jobs.issue_stock": false,
    "jobs.stock_return": false,
    "jobs.misplaced_item": false,
    "jobs.generate_invoice": true,
    "jobs.collect_payment": false,
    "jobs.cancel_job": false,
    "jobs.reports": true,
    // Dispatch
    "dispatch.view_map": true,
    "dispatch.assign_job": true,
    "dispatch.surveillance": false,
    // Inventory
    "inventory.view_stock": true,
    "inventory.view_costs": false,
    "inventory.restock": false,
    "inventory.opening_stock": false,
    "inventory.storekeeper_queue": false,
    "inventory.branch_transfers": false,
    "inventory.adjustments": false,
    "inventory.workshop_consumption": false,
    "inventory.tool_crib": false,
    "inventory.stock_units": false,
    // Procurement
    "procurement.view_pr": false,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    // Accounts
    "accounts.general_ledger": false,
    "accounts.chart_of_accounts": false,
    "accounts.pos": true,
    "accounts.cashier_register": false,
    "accounts.financial_reports": false,
    // HRM
    "hrm.view_employees": false,
    "hrm.manage_employees": false,
    "hrm.attendance": false,
    "hrm.payroll": false,
    "hrm.advances": false,
    // Settings
    "settings.manage_users": false,
    "settings.manage_roles": false,
    "settings.accounting": false,
    "audit.view_logs": false,
  },

  cashier: {
    // Jobs
    "jobs.view_directory": true,
    "jobs.view_financials": true,
    "jobs.create_job": false,
    "jobs.edit_job": false,
    "jobs.reassign_tech": false,
    "jobs.add_service": false,
    "jobs.issue_stock": false,
    "jobs.stock_return": false,
    "jobs.misplaced_item": false,
    "jobs.generate_invoice": true,
    "jobs.collect_payment": true,
    "jobs.cancel_job": false,
    "jobs.reports": true,
    // Dispatch
    "dispatch.view_map": false,
    "dispatch.assign_job": false,
    "dispatch.surveillance": false,
    // Inventory
    "inventory.view_stock": true,
    "inventory.view_costs": false,
    "inventory.restock": false,
    "inventory.opening_stock": false,
    "inventory.storekeeper_queue": false,
    "inventory.branch_transfers": false,
    "inventory.adjustments": false,
    "inventory.workshop_consumption": false,
    "inventory.tool_crib": false,
    "inventory.stock_units": false,
    // Procurement
    "procurement.view_pr": false,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    // Accounts
    "accounts.general_ledger": false,
    "accounts.chart_of_accounts": false,
    "accounts.pos": true,
    "accounts.cashier_register": true,
    "accounts.financial_reports": false,
    // HRM
    "hrm.view_employees": false,
    "hrm.manage_employees": false,
    "hrm.attendance": false,
    "hrm.payroll": false,
    "hrm.advances": false,
    // Settings
    "settings.manage_users": false,
    "settings.manage_roles": false,
    "settings.accounting": false,
    "audit.view_logs": false,
  },

  dispatcher: {
    // Jobs
    "jobs.view_directory": true,
    "jobs.view_financials": true,
    "jobs.create_job": true,
    "jobs.edit_job": true,
    "jobs.reassign_tech": true,
    "jobs.add_service": true,
    "jobs.issue_stock": false,
    "jobs.stock_return": false,
    "jobs.misplaced_item": false,
    "jobs.generate_invoice": true,
    "jobs.collect_payment": false,
    "jobs.cancel_job": false,
    "jobs.reports": true,
    // Dispatch
    "dispatch.view_map": true,
    "dispatch.assign_job": true,
    "dispatch.surveillance": true,
    // Inventory
    "inventory.view_stock": true,
    "inventory.view_costs": false,
    "inventory.restock": false,
    "inventory.opening_stock": false,
    "inventory.storekeeper_queue": false,
    "inventory.branch_transfers": false,
    "inventory.adjustments": false,
    "inventory.workshop_consumption": false,
    "inventory.tool_crib": false,
    "inventory.stock_units": false,
    // Procurement
    "procurement.view_pr": false,
    "procurement.create_pr": false,
    "procurement.approve_po": false,
    "procurement.grn": false,
    "procurement.bills": false,
    "procurement.payments": false,
    // Accounts
    "accounts.general_ledger": false,
    "accounts.chart_of_accounts": false,
    "accounts.pos": false,
    "accounts.cashier_register": false,
    "accounts.financial_reports": false,
    // HRM
    "hrm.view_employees": true,
    "hrm.manage_employees": false,
    "hrm.attendance": true,
    "hrm.payroll": false,
    "hrm.advances": false,
    // Settings
    "settings.manage_users": false,
    "settings.manage_roles": false,
    "settings.accounting": false,
    "audit.view_logs": false,
  },

  auditor: {
    // Full Audit visibility across everything
    ...ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    // Can view all, but cannot create financial changes
    "jobs.create_job": false,
    "jobs.cancel_job": false,
    "procurement.create_pr": false,
    "procurement.payments": false,
    "settings.manage_users": false,
    "settings.manage_roles": false,
  },

  hr: {
    "hrm.view_employees": true,
    "hrm.manage_employees": true,
    "hrm.attendance": true,
    "hrm.payroll": true,
    "hrm.advances": true,
    "jobs.view_directory": false,
    "jobs.view_financials": false,
    "dispatch.view_map": false,
    "inventory.view_stock": false,
    "accounts.general_ledger": false,
    "audit.view_logs": false,
  },

  technician: {
    "jobs.view_directory": true,
    "jobs.view_financials": false,
    "jobs.issue_stock": false,
    "jobs.stock_return": true,
    "jobs.misplaced_item": true,
    "dispatch.view_map": false,
    "inventory.view_stock": false,
    "inventory.view_costs": false,
  },
};
