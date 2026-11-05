export const ERP_ROLE_OPTIONS = [
  { key: "admin", label: "Administrator", description: "Full system control and user administration." },
  { key: "manager", label: "Manager", description: "Operational oversight, approvals, dashboards, and reports." },
  { key: "dispatcher", label: "Dispatcher", description: "Job scheduling, assignment, and field coordination." },
  { key: "storekeeper", label: "Store Keeper", description: "Stock issue, returns, warehouse, and goods receipt." },
  { key: "accountant", label: "Accountant", description: "Accounts, payments, invoices, expenses, and reporting." },
  { key: "call_center", label: "Call Center", description: "Customer intake, job creation, follow-up, and feedback." },
  { key: "purchasing", label: "Procurement", description: "Requisitions, sourcing, vendors, and purchase orders." },
  { key: "hr", label: "Human Resources", description: "Employees, attendance, payroll, and people operations." },
  { key: "cashier", label: "Cashier", description: "Counter collections, cash settlements, and POS." },
  { key: "auditor", label: "Auditor", description: "Read-only oversight, verification, and audit trails." },
] as const;

export const ERP_ROLE_KEYS = ERP_ROLE_OPTIONS.map((role) => role.key);

export function isKnownErpRole(value: unknown): value is (typeof ERP_ROLE_KEYS)[number] {
  return typeof value === "string" && ERP_ROLE_KEYS.includes(value as (typeof ERP_ROLE_KEYS)[number]);
}

export const DEVELOPMENT_DEMO_PASSWORD = "Workman@2026";

export const DEVELOPMENT_DEMO_USERS = [
  { name: "System Administrator", username: "admin", email: "admin@workmanservices.pk", role: "admin", designation: "System Administrator", department: "Executive Management", avatar: "SA", badgeColor: "bg-purple-600 text-white" },
  { name: "Operations Manager", username: "manager", email: "operations@workmanservices.pk", role: "manager", designation: "Operations Manager", department: "Operations", avatar: "OM", badgeColor: "bg-violet-600 text-white" },
  { name: "Lead Dispatcher", username: "dispatcher", email: "dispatch@workmanservices.pk", role: "dispatcher", designation: "Lead Dispatcher", department: "Field Operations & Fleet", avatar: "DS", badgeColor: "bg-blue-600 text-white" },
  { name: "Warehouse Storekeeper", username: "storekeeper", email: "warehouse@workmanservices.pk", role: "storekeeper", designation: "Warehouse & Inventory Head", department: "Central Warehouse & Logistics", avatar: "SK", badgeColor: "bg-amber-600 text-white" },
  { name: "Finance & Accounts", username: "accountant", email: "accounts@workmanservices.pk", role: "accountant", designation: "Chief Financial Accountant", department: "Finance & Accounts", avatar: "AC", badgeColor: "bg-emerald-600 text-white" },
  { name: "Call Center Intake", username: "callcenter", email: "support@workmanservices.pk", role: "call_center", designation: "Customer Care & Intake Lead", department: "Customer Care & Dispatch", avatar: "CC", badgeColor: "bg-teal-600 text-white" },
  { name: "Procurement Officer", username: "procurement", email: "procurement@workmanservices.pk", role: "purchasing", designation: "Procurement & Sourcing Lead", department: "Purchasing", avatar: "PO", badgeColor: "bg-orange-600 text-white" },
  { name: "Human Resources", username: "hr", email: "hr@workmanservices.pk", role: "hr", designation: "Human Resources Manager", department: "Human Resources", avatar: "HR", badgeColor: "bg-pink-600 text-white" },
  { name: "Counter Cashier", username: "cashier", email: "cashier@workmanservices.pk", role: "cashier", designation: "Counter Cashier & POS Controller", department: "Cash Desk & Settlements", avatar: "CS", badgeColor: "bg-cyan-600 text-white" },
  { name: "Internal Auditor", username: "auditor", email: "audit@workmanservices.pk", role: "auditor", designation: "Internal Compliance Auditor", department: "Governance & Internal Audit", avatar: "AU", badgeColor: "bg-slate-700 text-white" },
] as const;

export function demoLoginEnabled() {
  return process.env.ENABLE_DEMO_LOGIN === "true";
}

