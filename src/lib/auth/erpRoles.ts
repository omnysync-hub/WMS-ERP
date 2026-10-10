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
  { name: "Haris Qureshi", username: "admin", email: "admin@workman.local", role: "admin", designation: "System Administrator", department: "Management", avatar: "HQ", badgeColor: "bg-purple-600 text-white" },
  { name: "Imran Siddiqui", username: "manager", email: "manager@workman.local", role: "manager", designation: "Operations Manager", department: "Operations", avatar: "IS", badgeColor: "bg-violet-600 text-white" },
  { name: "Zeeshan Ahmed", username: "dispatcher", email: "dispatcher@workman.local", role: "dispatcher", designation: "Lead Dispatcher", department: "Dispatch", avatar: "ZA", badgeColor: "bg-blue-600 text-white" },
  { name: "Bilal Sheikh", username: "storekeeper", email: "storekeeper@workman.local", role: "storekeeper", designation: "Store Keeper", department: "Warehouse", avatar: "BS", badgeColor: "bg-amber-600 text-white" },
  { name: "Fatima Noor", username: "accountant", email: "accountant@workman.local", role: "accountant", designation: "Accountant", department: "Finance & Accounts", avatar: "FN", badgeColor: "bg-emerald-600 text-white" },
  { name: "Ayesha Malik", username: "callcenter", email: "callcenter@workman.local", role: "call_center", designation: "Call Center Lead", department: "Customer Care", avatar: "AM", badgeColor: "bg-teal-600 text-white" },
  { name: "Nadia Hussain", username: "procurement", email: "procurement@workman.local", role: "purchasing", designation: "Procurement Lead", department: "Procurement", avatar: "NH", badgeColor: "bg-orange-600 text-white" },
  { name: "Sara Bilal", username: "hr", email: "hr@workman.local", role: "hr", designation: "HR Manager", department: "Human Resources", avatar: "SB", badgeColor: "bg-pink-600 text-white" },
  { name: "Kamran Akram", username: "cashier", email: "cashier@workman.local", role: "cashier", designation: "Cashier", department: "Cash Desk", avatar: "KA", badgeColor: "bg-cyan-600 text-white" },
  { name: "Tariq Mehmood", username: "auditor", email: "auditor@workman.local", role: "auditor", designation: "Internal Auditor", department: "Governance & Audit", avatar: "TM", badgeColor: "bg-slate-700 text-white" },
] as const;

export function demoLoginEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_LOGIN === "true";
}
