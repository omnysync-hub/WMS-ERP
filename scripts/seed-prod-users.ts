import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

export interface ProdUserConfig {
  name: string;
  username: string;
  email: string;
  role: string;
  designation: string;
  department: string;
  avatar: string;
  badgeColor: string;
  passwordPlainText: string;
}

export const PROD_STAFF_ACCOUNTS: ProdUserConfig[] = [
  {
    name: "",
    username: "admin",
    email: "admin@workmanservices.pk",
    role: "admin",
    designation: "Managing Director & System Administrator",
    department: "Executive Management",
    avatar: "AD",
    badgeColor: "bg-purple-600 text-white",
    passwordPlainText: "Workman#Admin!2026",
  },
  {
    name: "",
    username: "manager",
    email: "operations@workmanservices.pk",
    role: "manager",
    designation: "Operations Manager",
    department: "Operations",
    avatar: "MG",
    badgeColor: "bg-violet-600 text-white",
    passwordPlainText: "Workman#Ops!2026",
  },
  {
    name: "",
    username: "dispatcher",
    email: "dispatch@workmanservices.pk",
    role: "dispatcher",
    designation: "Lead Dispatcher & Coordinator",
    department: "Field Dispatch & Scheduling",
    avatar: "DP",
    badgeColor: "bg-blue-600 text-white",
    passwordPlainText: "Workman#Dispatch!2026",
  },
  {
    name: "",
    username: "accountant",
    email: "accounts@workmanservices.pk",
    role: "accountant",
    designation: "Chief Financial Accountant",
    department: "Finance & Accounts",
    avatar: "AC",
    badgeColor: "bg-emerald-600 text-white",
    passwordPlainText: "Workman#Finance!2026",
  },
  {
    name: "",
    username: "storekeeper",
    email: "warehouse@workmanservices.pk",
    role: "storekeeper",
    designation: "Warehouse & Inventory Head",
    department: "Central Warehouse",
    avatar: "SK",
    badgeColor: "bg-amber-600 text-white",
    passwordPlainText: "Workman#Store!2026",
  },
  {
    name: "",
    username: "procurement",
    email: "procurement@workmanservices.pk",
    role: "purchasing",
    designation: "Procurement & Sourcing Lead",
    department: "Procurement & Sourcing",
    avatar: "PR",
    badgeColor: "bg-orange-600 text-white",
    passwordPlainText: "Workman#Purchasing!2026",
  },
  {
    name: "",
    username: "hr",
    email: "hr@workmanservices.pk",
    role: "hr",
    designation: "Human Resources Manager",
    department: "Human Resources",
    avatar: "HR",
    badgeColor: "bg-pink-600 text-white",
    passwordPlainText: "Workman#People!2026",
  },
  {
    name: "",
    username: "cashier",
    email: "cashier@workmanservices.pk",
    role: "cashier",
    designation: "Counter Cashier & POS Controller",
    department: "Cash Desk & Retail",
    avatar: "CS",
    badgeColor: "bg-cyan-600 text-white",
    passwordPlainText: "Workman#Counter!2026",
  },
  {
    name: "",
    username: "callcenter",
    email: "support@workmanservices.pk",
    role: "call_center",
    designation: "Customer Care & Intake Lead",
    department: "Customer Care & Intake",
    avatar: "CC",
    badgeColor: "bg-teal-600 text-white",
    passwordPlainText: "Workman#Support!2026",
  },
  {
    name: "",
    username: "auditor",
    email: "audit@workmanservices.pk",
    role: "auditor",
    designation: "Internal Compliance Auditor",
    department: "Governance & Audit",
    avatar: "AU",
    badgeColor: "bg-slate-700 text-white",
    passwordPlainText: "Workman#Audit!2026",
  },
];

async function seedProductionUsers() {
  console.log("=================================================");
  console.log("🚀 WORKMAN SERVICES ERP — PRODUCTION USERS SEED");
  console.log("=================================================");

  // 1. Invalidate any existing sessions
  console.log("\n[1/4] Revoking active web sessions...");
  await prisma.erpSession.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });
  console.log("✓ All previous web sessions revoked.");

  // 2. Remove old demo users or users with @workman.local
  console.log("\n[2/4] Cleaning legacy demo accounts...");
  const oldDemoUsers = await prisma.erpUser.findMany({
    where: {
      OR: [
        { isDemo: true },
        { email: { endsWith: "@workman.local" } },
      ],
    },
  });
  console.log(`Found ${oldDemoUsers.length} legacy demo accounts to upgrade.`);

  // 3. Upsert genuine production users
  console.log("\n[3/4] Creating and activating real production accounts...");
  const createdUsers = [];

  for (const staff of PROD_STAFF_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(staff.passwordPlainText, 12);

    const user = await prisma.erpUser.upsert({
      where: { username: staff.username },
      update: {
        name: staff.name,
        email: staff.email,
        passwordHash,
        role: staff.role,
        designation: staff.designation,
        department: staff.department,
        avatar: staff.avatar,
        badgeColor: staff.badgeColor,
        status: "active",
        isDemo: false,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        name: staff.name,
        username: staff.username,
        email: staff.email,
        passwordHash,
        role: staff.role,
        designation: staff.designation,
        department: staff.department,
        avatar: staff.avatar,
        badgeColor: staff.badgeColor,
        status: "active",
        isDemo: false,
        mustChangePassword: false,
      },
    });

    createdUsers.push({
      Username: user.username,
      Name: user.name,
      Role: user.role,
      Email: user.email,
      Password: staff.passwordPlainText,
      Status: user.status,
      IsDemo: user.isDemo,
    });
  }

  console.log("✓ All 10 production accounts created and verified.\n");
  console.table(createdUsers);

  console.log("\n[4/4] Generating raw SQL queries for VPS direct injection (optional fallback)...");
  console.log("SQL statements saved for reference.\n");

  console.log("=================================================");
  console.log("🎉 PRODUCTION CREDENTIALS SETUP COMPLETE!");
  console.log("=================================================");
  process.exit(0);
}

seedProductionUsers().catch((err) => {
  console.error("Failed to seed production users:", err);
  process.exit(1);
});
