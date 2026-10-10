"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { installErpActorFetch, type ErpActorSnapshot } from "@/lib/erpActorFetch";

export type BuiltInRoleType =
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
  | "manager";

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
  purchasing: {
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
    primaryModules: ["Auditor Verification", "Audit & Rollbacks", "Jobs", "Job Reports & Audit", "Accounts & Ledgers", "Feedback Queue", "Warehouse & Stock"],
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
    description: "Field mobile app user: on-site job execution, material requests, job execution, biometric attendance, and ESS.",
    primaryModules: ["Field Operations"],
  },
};

import { DEFAULT_ROLE_PERMISSIONS, roleMapHasPermission } from "@/lib/permissions";

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
  isDemo?: boolean;
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
  {
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
  createUser: (user: Omit<SystemUser, "id" | "createdAt"> & { password: string }) => Promise<void>;
  updateUser: (userId: string, data: Partial<SystemUser> & { password?: string }) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  setUserPermissionOverride: (userId: string, permKey: string, value: boolean) => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRoleState] = useState<RoleType>("admin");
  const [customRoles, setCustomRoles] = useState<Record<string, Persona>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_ROLE_PERMISSIONS);
  const [users, setUsers] = useState<SystemUser[]>(DEFAULT_USERS);
  const [activeUserId, setActiveUserIdState] = useState<string>("usr-admin-01");
  const [sessionReady, setSessionReady] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const savedCustomRoles = localStorage.getItem("workman_custom_roles");
      if (savedCustomRoles) {
        setCustomRoles(JSON.parse(savedCustomRoles));
      }

      const savedPermissions = localStorage.getItem("workman_role_permissions");
      if (savedPermissions) {
        // Merge with defaults so newly added procurement.* keys are not stuck false/undefined
        const parsed = JSON.parse(savedPermissions) as Record<string, Record<string, boolean>>;
        const merged: Record<string, Record<string, boolean>> = { ...DEFAULT_ROLE_PERMISSIONS };
        for (const [roleKey, perms] of Object.entries(parsed)) {
          merged[roleKey] = { ...(DEFAULT_ROLE_PERMISSIONS[roleKey] || {}), ...perms };
          // Prefer default for brand-new keys that were absent in the saved blob
          const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey] || {};
          for (const [pk, pv] of Object.entries(defaults)) {
            if (perms[pk] === undefined) {
              merged[roleKey][pk] = pv;
            }
          }
        }
        // Ensure new roles (purchasing/manager) exist even if absent from saved blob
        for (const roleKey of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
          if (!merged[roleKey]) merged[roleKey] = DEFAULT_ROLE_PERMISSIONS[roleKey];
        }
        // Strictly ensure financial & invoice permissions remain false for operational dispatcher & CSR roles
        if (merged.dispatcher) {
          merged.dispatcher["jobs.view_financials"] = false;
          merged.dispatcher["jobs.add_service"] = false;
          merged.dispatcher["jobs.generate_invoice"] = false;
        }
        if (merged.call_center) {
          merged.call_center["jobs.view_financials"] = false;
          merged.call_center["jobs.add_service"] = false;
          merged.call_center["jobs.generate_invoice"] = false;
        }
        if (merged.accountant) {
          merged.accountant["jobs.stock_return"] = false;
        }
        setRolePermissions(merged);
      }

    } catch (e) {
      // ignore
    }

    let cancelled = false;
    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        if (!sessionResponse.ok) {
          window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        const sessionData = await sessionResponse.json();
        const sessionUser = sessionData.user as SystemUser;
        if (cancelled || !sessionUser) return;
        setActiveRoleState(sessionUser.role);
        setActiveUserIdState(sessionUser.id);
        setUsers([sessionUser]);

        if (sessionUser.role === "admin") {
          const usersResponse = await fetch("/api/users", { cache: "no-store" });
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (!cancelled && Array.isArray(usersData.users)) setUsers(usersData.users);
          }
        }
        if (!cancelled) setSessionReady(true);
      } catch {
        if (!cancelled) window.location.assign("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // Keep API calls in sync with the active persona (server enforces jobs.* / procurement.* gates)
  const actorRef = useRef<ErpActorSnapshot | null>(null);
  actorRef.current = {
    role: String(activeRole || "anonymous").toLowerCase(),
    name: activeUser?.name || currentPersona?.name,
    userId: activeUser?.id,
  };
  if (typeof window !== "undefined") {
    installErpActorFetch(() => actorRef.current);
  }

  const setRole = (role: RoleType) => {
    // A signed-in user's role is server-controlled. Keep this method for legacy callers,
    // but never allow the former browser-side role impersonation behavior.
    if (role === activeRole) setActiveRoleState(role);
  };

  const setActiveUserId = (userId: string) => {
    if (userId === activeUserId) setActiveUserIdState(userId);
  };

  // Granular Permission Engine Check
  const hasPermission = (permissionKey: string): boolean => {
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
  const createUser = async (userData: Omit<SystemUser, "id" | "createdAt"> & { password: string }) => {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not create the user.");
    setUsers((current) => [...current, data.user].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const updateUser = async (userId: string, patch: Partial<SystemUser> & { password?: string }) => {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not update the user.");
    setUsers((current) => current.map((user) => (user.id === userId ? data.user : user)));
  };

  const toggleUserStatus = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const nextStatus = user.status === "active" ? "suspended" : "active";
    await updateUser(userId, { status: nextStatus });
  };

  const deleteUser = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not delete the user.");
    setUsers((current) => current.filter((item) => item.id !== userId));
  };

  const setUserPermissionOverride = async (userId: string, permKey: string, value: boolean) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const overrides = { ...(user.permissionOverrides || {}), [permKey]: value };
    await updateUser(userId, { permissionOverrides: overrides });
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
      {sessionReady ? (
        children
      ) : (
        <div className="min-h-screen bg-[#0b1714] text-white flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 rounded-2xl border-2 border-emerald-400 border-t-transparent animate-spin" />
            <p className="mt-4 text-sm font-semibold">Opening your secure workspace…</p>
            <p className="mt-1 text-xs text-slate-400">Checking your account and access</p>
          </div>
        </div>
      )}
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

