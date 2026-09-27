const fs = require("fs");

// --- RoleContext ---
let rc = fs.readFileSync("src/contexts/RoleContext.tsx", "utf8");

// Expand BuiltInRoleType
rc = rc.replace(
  /export type BuiltInRoleType =\s*\| "admin"\s*\| "accountant"\s*\| "dispatcher"\s*\| "call_center"\s*\| "storekeeper"\s*\| "cashier"\s*\| "auditor"\s*\| "hr"\s*\| "technician";/,
  `export type BuiltInRoleType =
  | "admin"
  | "accountant"
  | "dispatcher"
  | "call_center"
  | "storekeeper"
  | "cashier"
  | "auditor"
  | "hr"
  | "technician"
  | "purchasing"
  | "manager";`
);

if (!rc.includes('purchasing: {')) {
  const insertPersonas = `  purchasing: {
    id: "a1b2c3d4-purch-0001-aaaa-bbbbccccdddd",
    name: "Nadia Hussain",
    role: "purchasing",
    designation: "Procurement & Sourcing Lead",
    department: "Purchasing",
    email: "nadia@company.com",
    avatar: "NH",
    badgeColor: "bg-orange-600 text-white",
    description: "RFQ management, vendor master, PO drafting and send. No PR/PO/invoice approvals or payments.",
    primaryModules: ["Procurement & Sourcing", "Warehouse & Stock"],
  },
  manager: {
    id: "b2c3d4e5-mgr-0002-bbbb-ccccddddeeee",
    name: "Imran Siddiqui",
    role: "manager",
    designation: "Operations Manager",
    department: "Operations",
    email: "imran@company.com",
    avatar: "IS",
    badgeColor: "bg-violet-600 text-white",
    description: "Approves PRs, POs, and discrepancy invoices. Reports and cost visibility; limited create rights.",
    primaryModules: ["Procurement & Sourcing", "Jobs", "Accounts", "Dashboard"],
  },
`;
  rc = rc.replace("  call_center: {", insertPersonas + "  call_center: {");
}

if (!rc.includes('usr-purch-10')) {
  const insertUsers = `  {
    id: "usr-purch-10",
    name: "Nadia Hussain",
    email: "nadia@company.com",
    username: "nadia.purch",
    role: "purchasing",
    designation: "Procurement & Sourcing Lead",
    department: "Purchasing",
    status: "active",
    avatar: "NH",
    badgeColor: "bg-orange-600 text-white",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "usr-mgr-11",
    name: "Imran Siddiqui",
    email: "imran@company.com",
    username: "imran.mgr",
    role: "manager",
    designation: "Operations Manager",
    department: "Operations",
    status: "active",
    avatar: "IS",
    badgeColor: "bg-violet-600 text-white",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
`;
  rc = rc.replace(
    '    createdAt: "2026-01-08T00:00:00.000Z",\n  },\n];',
    '    createdAt: "2026-01-08T00:00:00.000Z",\n  },\n' + insertUsers + "];"
  );
}

// Import roleMapHasPermission and update hasPermission
if (!rc.includes("roleMapHasPermission")) {
  rc = rc.replace(
    'import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";',
    'import { DEFAULT_ROLE_PERMISSIONS, roleMapHasPermission } from "@/lib/permissions";'
  );
}

// Replace hasPermission body to use alias-aware check
const oldHas = `  const hasPermission = (permissionKey: string): boolean => {
    // 1. If active user is suspended, block all permissions
    if (activeUser?.status === "suspended") {
      return false;
    }

    // 2. Check user-specific override if defined
    if (activeUser?.permissionOverrides && activeUser.permissionOverrides[permissionKey] !== undefined) {
      return activeUser.permissionOverrides[permissionKey];
    }

    // 3. Check role-level permission map
    const roleMap = rolePermissions[activeRole];
    if (roleMap && roleMap[permissionKey] !== undefined) {
      return roleMap[permissionKey];
    }

    // 4. Default for admin is true; others default to false
    if (activeRole === "admin") {
      return true;
    }

    return false;
  };`;

const newHas = `  const hasPermission = (permissionKey: string): boolean => {
    // 1. If active user is suspended, block all permissions
    if (activeUser?.status === "suspended") {
      return false;
    }

    // 2. Check user-specific override if defined (exact key or aliases)
    if (activeUser?.permissionOverrides) {
      const overrides = activeUser.permissionOverrides;
      if (overrides[permissionKey] !== undefined) {
        return overrides[permissionKey];
      }
    }

    // 3. Role-level map with legacy <-> fine-grained procurement aliases
    const roleMap = rolePermissions[activeRole];
    if (roleMapHasPermission(roleMap, permissionKey, activeRole === "admin")) {
      return true;
    }

    // 4. Default for admin is true; others default to false
    if (activeRole === "admin") {
      return true;
    }

    return false;
  };`;

if (rc.includes(oldHas)) {
  rc = rc.replace(oldHas, newHas);
} else {
  console.warn("WARN: hasPermission block not exact-matched; applying softer replace");
  // softer: leave as-is if already patched
  if (!rc.includes("roleMapHasPermission(roleMap")) {
    throw new Error("Could not patch hasPermission");
  }
}

fs.writeFileSync("src/contexts/RoleContext.tsx", rc);
console.log("RoleContext OK", rc.length);

// --- Sidebar ---
let side = fs.readFileSync("src/components/layout/Sidebar.tsx", "utf8");
side = side.replace(
  '{ label: "Procurement & Sourcing", href: "/procurement", icon: ShoppingCart, roles: ["admin", "accountant", "storekeeper", "auditor"], perm: "procurement.view_pr" }',
  '{ label: "Procurement & Sourcing", href: "/procurement", icon: ShoppingCart, roles: ["admin", "accountant", "storekeeper", "auditor", "purchasing", "manager"], perm: "procurement.view_pr" }'
);
fs.writeFileSync("src/components/layout/Sidebar.tsx", side);
console.log("Sidebar OK");
