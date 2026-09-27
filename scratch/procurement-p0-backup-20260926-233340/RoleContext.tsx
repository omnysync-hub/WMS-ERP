"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type BuiltInRoleType =
  | "admin"
  | "accountant"
  | "dispatcher"
  | "call_center"
  | "storekeeper"
  | "cashier"
  | "auditor"
  | "hr"
  | "technician";

export type RoleType = BuiltInRoleType | (string & {});

export interface Persona {
  id: string;
  name: string;
  role: RoleType;
  designation: string;
  department: string;
  email: string;
  avatar: string;
  badgeColor: string;
  description: string;
  primaryModules: string[];
}

export const ERP_PERSONAS: Record<RoleType, Persona> = {
  admin: {
    id: "bcf9ec77-796f-47cc-948e-196057876ed2",
    name: "Haris Qureshi",
    role: "admin",
    designation: "Managing Director",
    department: "Executive Management",
    email: "haris@company.com",
    avatar: "HQ",
    badgeColor: "bg-purple-600 text-white",
    description: "Full administrative authority across all operational, financial, and personnel systems.",
    primaryModules: ["Dashboard", "Jobs", "Dispatch Map", "Technicians", "Accounts", "HRM", "Inventory", "Projects", "Feedback", "Reports", "Audit"],
  },
  call_center: {
    id: "d41893c1-7443-41bb-92e6-c16e13f412ab",
    name: "Ayesha Malik",
    role: "call_center",
    designation: "Call Center Lead & Job Controller",
    department: "Customer Care & Dispatch",
    email: "ayesha@company.com",
    avatar: "AM",
    badgeColor: "bg-teal-600 text-white",
    description: "Job intake, assigning technicians with active workload counters, issuing inventory/services to jobs, and feedback verification.",
    primaryModules: ["Jobs", "Dispatch Map", "Feedback Queue"],
  },
  accountant: {
    id: "b7753dcc-44d2-4a18-a428-503cb9c21568",
    name: "Fatima Noor",
    role: "accountant",
    designation: "Chief Financial Accountant",
    department: "Finance & Accounts",
    email: "fatima@company.com",
    avatar: "FN",
    badgeColor: "bg-emerald-600 text-white",
    description: "Full financial visibility: invoices, quotes, sales reports, post-creation job services, payment collections, and expense payouts.",
    primaryModules: ["Accounts", "Jobs", "Job Reports & Audit", "Procurement & Sourcing", "Reports"],
  },
  cashier: {
    id: "e9921bc4-1188-42df-a551-7f938b81cf04",
    name: "Kamran Akram",
    role: "cashier",
    designation: "Cashier & Counter Controller",
    department: "Cash Desk & Settlements",
    email: "kamran@company.com",
    avatar: "KA",
    badgeColor: "bg-cyan-600 text-white",
    description: "Job hissab settlements, counter cash collections, POS register cash, and general payment cash vouchers. (No ledgers or salary slips).",
    primaryModules: ["Jobs", "Point of Sale (POS)", "Accounts & Ledgers"],
  },
  auditor: {
    id: "a8109bf3-6311-48e0-bb12-4f329971bc99",
    name: "Tariq Mehmood",
    role: "auditor",
    designation: "Chief Internal Quality & Financial Auditor",
    department: "Governance & Internal Audit",
    email: "tariq@company.com",
    avatar: "TM",
    badgeColor: "bg-slate-700 text-white",
    description: "Omni-module supervisory audit: all jobs, financial entries, warehouse movements, feedback audits, and system rollback logs.",
    primaryModules: ["Audit & Rollbacks", "Jobs", "Job Reports & Audit", "Accounts & Ledgers", "Feedback Queue", "Warehouse & Stock"],
  },
  dispatcher: {
    id: "13f6666d-952d-421c-8f2a-e7f204c32d17",
    name: "Zeeshan Ahmed",
    role: "dispatcher",
    designation: "Lead Dispatcher & Fleet Controller",
    department: "Operations & Logistics",
    email: "zeeshan@company.com",
    avatar: "ZA",
    badgeColor: "bg-blue-600 text-white",
    description: "Work order scheduling, fleet live geofence dispatching, technician allocation, and route optimization.",
    primaryModules: ["Jobs", "Dispatch Map", "Technicians"],
  },
  storekeeper: {
    id: "99722077-b26f-4377-a38b-c106ad82c39b",
    name: "Bilal Sheikh",
    role: "storekeeper",
    designation: "Central Warehouse Storekeeper",
    department: "Warehouse & Inventory",
    email: "bilal@company.com",
    avatar: "BS",
    badgeColor: "bg-amber-600 text-white",
    description: "Inventory issue approvals, physical stock verification, technician returns/misplaced logging, GRN, and branch transfers. No purchasing costs.",
    primaryModules: ["Warehouse & Stock", "Jobs", "Procurement & Sourcing"],
  },
  hr: {
    id: "f03697b5-d011-41a0-98ad-8cdc84de5a06",
    name: "Sara Bilal",
    role: "hr",
    designation: "Operations & HR Lead",
    department: "Human Resources & Quality",
    email: "sara@company.com",
    avatar: "SB",
    badgeColor: "bg-pink-600 text-white",
    description: "Physical tool/vehicle asset management, employee onboarding, ATS pipeline, staff grievances, and post-job customer feedback.",
    primaryModules: ["HRM & Payroll", "Feedback Queue", "Dashboard"],
  },
  technician: {
    id: "6efdefa8-1956-4ca1-83cb-0d12ec8179f2",
    name: "Ali Raza",
    role: "technician",
    designation: "Senior HVAC Technician",
    department: "Field Services",
    email: "ali@company.com",
    avatar: "AR",
    badgeColor: "bg-[#0D7A5F] text-white",
    description: "Field mobile companion user: on-site job execution, material requests, job pausing, biometric attendance, and ESS.",
    primaryModules: ["Field Companion"],
  },
};

import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: RoleType;
  designation: string;
  department: string;
  status: "active" | "suspended";
  avatar: string;
  badgeColor: string;
  createdAt: string;
  permissionOverrides?: Record<string, boolean>;
}

export const DEFAULT_USERS: SystemUser[] = [
  {
    id: "usr-admin-01",
    name: "Haris Qureshi",
    email: "haris@company.com",
    username: "haris.admin",
    role: "admin",
    designation: "Managing Director",
    department: "Executive Management",
    status: "active",
    avatar: "HQ",
    badgeColor: "bg-purple-600 text-white",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr-cc-02",
    name: "Ayesha Malik",
    email: "ayesha@company.com",
    username: "ayesha.cc",
    role: "call_center",
    designation: "Call Center Lead & Job Controller",
    department: "Customer Care & Dispatch",
    status: "active",
    avatar: "AM",
    badgeColor: "bg-teal-600 text-white",
    createdAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "usr-acc-03",
    name: "Fatima Noor",
    email: "fatima@company.com",
    username: "fatima.acc",
    role: "accountant",
    designation: "Chief Financial Accountant",
    department: "Finance & Accounts",
    status: "active",
    avatar: "FN",
    badgeColor: "bg-emerald-600 text-white",
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "usr-sk-04",
    name: "Bilal Sheikh",
    email: "bilal@company.com",
    username: "bilal.store",
    role: "storekeeper",
    designation: "Warehouse & Inventory Head",
    department: "Central Warehouse & Logistics",
    status: "active",
    avatar: "BS",
    badgeColor: "bg-amber-600 text-white",
    createdAt: "2026-01-20T00:00:00.000Z",
  },
  {
    id: "usr-cash-05",
    name: "Kamran Akram",
    email: "kamran@company.com",
    username: "kamran.cashier",
    role: "cashier",
    designation: "Cashier & Counter Controller",
    department: "Finance & Retail Operations",
    status: "active",
    avatar: "KA",
    badgeColor: "bg-cyan-600 text-white",
    createdAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "usr-audit-06",
    name: "Zeeshan Tariq",
    email: "zeeshan@company.com",
    username: "zeeshan.auditor",
    role: "auditor",
    designation: "Internal Systems & QA Auditor",
    department: "Executive Quality Assurance",
    status: "active",
    avatar: "ZT",
    badgeColor: "bg-rose-600 text-white",
    createdAt: "2026-02-15T00:00:00.000Z",
  },
  {
    id: "usr-disp-07",
    name: "Tariq Mehmood",
    email: "tariq@company.com",
    username: "tariq.disp",
    role: "dispatcher",
    designation: "Operations Dispatch Manager",
    department: "Field Operations & Fleet",
    status: "active",
    avatar: "TM",
    badgeColor: "bg-blue-600 text-white",
    createdAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "usr-hr-08",
    name: "Sara Khan",
    email: "sara@company.com",
    username: "sara.hr",
    role: "hr",
    designation: "Head of People & Attendance",
    department: "Human Resources",
    status: "active",
    avatar: "SK",
    badgeColor: "bg-pink-600 text-white",
    createdAt: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "usr-tech-09",
    name: "Ali Raza",
    email: "ali@company.com",
    username: "ali.tech",
    role: "technician",
    designation: "Senior Lead HVAC Technician",
    department: "Field Services",
    status: "active",
    avatar: "AR",
    badgeColor: "bg-indigo-600 text-white",
    createdAt: "2026-01-08T00:00:00.000Z",
  },
];

interface RoleContextType {
  activeRole: RoleType;
  currentRole: RoleType;
  currentPersona: Persona;
  setRole: (role: RoleType) => void;
  availablePersonas: Persona[];
  isModulePrimary: (moduleName: string) => boolean;

  // Granular Permission Engine
  hasPermission: (permissionKey: string) => boolean;
  rolePermissions: Record<string, Record<string, boolean>>;
  updateRolePermissions: (roleKey: string, permissions: Record<string, boolean>) => void;
  toggleRolePermission: (roleKey: string, permKey: string) => void;
  createRole: (role: Persona, initialPermissions?: Record<string, boolean>) => void;
  deleteRole: (roleKey: string) => void;

  // System Users Management
  users: SystemUser[];
  activeUser: SystemUser;
  setActiveUserId: (userId: string) => void;
  createUser: (user: Omit<SystemUser, "id" | "createdAt">) => void;
  updateUser: (userId: string, data: Partial<SystemUser>) => void;
  toggleUserStatus: (userId: string) => void;
  deleteUser: (userId: string) => void;
  setUserPermissionOverride: (userId: string, permKey: string, value: boolean) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRoleState] = useState<RoleType>("admin");
  const [customRoles, setCustomRoles] = useState<Record<string, Persona>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_ROLE_PERMISSIONS);
  const [users, setUsers] = useState<SystemUser[]>(DEFAULT_USERS);
  const [activeUserId, setActiveUserIdState] = useState<string>("usr-admin-01");

  // Load from local storage
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem("active_erp_role") as RoleType;
      if (savedRole) {
        setActiveRoleState(savedRole);
      }

      const savedCustomRoles = localStorage.getItem("workman_custom_roles");
      if (savedCustomRoles) {
        setCustomRoles(JSON.parse(savedCustomRoles));
      }

      const savedPermissions = localStorage.getItem("workman_role_permissions");
      if (savedPermissions) {
        setRolePermissions(JSON.parse(savedPermissions));
      }

      const savedUsers = localStorage.getItem("workman_system_users");
      if (savedUsers) {
        setUsers(JSON.parse(savedUsers));
      }

      const savedActiveUser = localStorage.getItem("workman_active_user_id");
      if (savedActiveUser) {
        setActiveUserIdState(savedActiveUser);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const allPersonasMap: Record<string, Persona> = {
    ...ERP_PERSONAS,
    ...customRoles,
  };

  const availablePersonas = Object.values(allPersonasMap);
  const currentPersona = allPersonasMap[activeRole] || ERP_PERSONAS.admin;

  const activeUser =
    users.find((u) => u.id === activeUserId) ||
    users.find((u) => u.role === activeRole) ||
    users[0] ||
    DEFAULT_USERS[0];

  const setRole = (role: RoleType) => {
    setActiveRoleState(role);
    try {
      localStorage.setItem("active_erp_role", role);
      // Auto-sync active user when role changes if user matches role
      const matchedUser = users.find((u) => u.role === role);
      if (matchedUser) {
        setActiveUserIdState(matchedUser.id);
        localStorage.setItem("workman_active_user_id", matchedUser.id);
      }
    } catch (e) {
      // ignore
    }
  };

  const setActiveUserId = (userId: string) => {
    setActiveUserIdState(userId);
    const u = users.find((x) => x.id === userId);
    if (u) {
      setActiveRoleState(u.role);
      try {
        localStorage.setItem("workman_active_user_id", userId);
        localStorage.setItem("active_erp_role", u.role);
      } catch (e) {
        // ignore
      }
    }
  };

  // Granular Permission Engine Check
  const hasPermission = (permissionKey: string): boolean => {
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
  };

  const updateRolePermissions = (roleKey: string, newPerms: Record<string, boolean>) => {
    const updated = {
      ...rolePermissions,
      [roleKey]: {
        ...(rolePermissions[roleKey] || {}),
        ...newPerms,
      },
    };
    setRolePermissions(updated);
    try {
      localStorage.setItem("workman_role_permissions", JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const toggleRolePermission = (roleKey: string, permKey: string) => {
    const currentVal = rolePermissions[roleKey]?.[permKey] ?? (roleKey === "admin");
    updateRolePermissions(roleKey, { [permKey]: !currentVal });
  };

  const createRole = (role: Persona, initialPermissions?: Record<string, boolean>) => {
    const updatedCustom = {
      ...customRoles,
      [role.role]: role,
    };
    setCustomRoles(updatedCustom);
    try {
      localStorage.setItem("workman_custom_roles", JSON.stringify(updatedCustom));
    } catch (e) {
      // ignore
    }

    if (initialPermissions) {
      updateRolePermissions(role.role, initialPermissions);
    }
  };

  const deleteRole = (roleKey: string) => {
    if (ERP_PERSONAS[roleKey as RoleType]) {
      alert("Built-in system roles cannot be deleted");
      return;
    }
    const updatedCustom = { ...customRoles };
    delete updatedCustom[roleKey];
    setCustomRoles(updatedCustom);
    try {
      localStorage.setItem("workman_custom_roles", JSON.stringify(updatedCustom));
    } catch (e) {
      // ignore
    }
  };

  // User Management
  const createUser = (userData: Omit<SystemUser, "id" | "createdAt">) => {
    const newUser: SystemUser = {
      ...userData,
      id: `usr-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem("workman_system_users", JSON.stringify(updatedUsers));
    } catch (e) {
      // ignore
    }
  };

  const updateUser = (userId: string, data: Partial<SystemUser>) => {
    const updated = users.map((u) => (u.id === userId ? { ...u, ...data } : u));
    setUsers(updated);
    try {
      localStorage.setItem("workman_system_users", JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const toggleUserStatus = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (user.role === "admin" && user.status === "active") {
      const activeAdmins = users.filter((u) => u.role === "admin" && u.status === "active");
      if (activeAdmins.length <= 1) {
        alert("Cannot suspend the sole active Administrator account");
        return;
      }
    }
    const nextStatus = user.status === "active" ? "suspended" : "active";
    updateUser(userId, { status: nextStatus });
  };

  const deleteUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (user.role === "admin") {
      alert("Administrator accounts cannot be deleted directly");
      return;
    }
    const updated = users.filter((u) => u.id !== userId);
    setUsers(updated);
    try {
      localStorage.setItem("workman_system_users", JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const setUserPermissionOverride = (userId: string, permKey: string, value: boolean) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const overrides = { ...(user.permissionOverrides || {}), [permKey]: value };
    updateUser(userId, { permissionOverrides: overrides });
  };

  const isModulePrimary = (moduleName: string) => {
    if (activeRole === "admin") return true;
    return currentPersona.primaryModules.some(
      (m) => m.toLowerCase() === moduleName.toLowerCase()
    );
  };

  return (
    <RoleContext.Provider
      value={{
        activeRole,
        currentRole: activeRole,
        currentPersona,
        setRole,
        availablePersonas,
        isModulePrimary,
        hasPermission,
        rolePermissions,
        updateRolePermissions,
        toggleRolePermission,
        createRole,
        deleteRole,
        users,
        activeUser,
        setActiveUserId,
        createUser,
        updateUser,
        toggleUserStatus,
        deleteUser,
        setUserPermissionOverride,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

