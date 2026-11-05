"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import { installErpActorFetch, type ErpActorSnapshot } from "@/lib/erpActorFetch";
import { SHARED_SETTING_PERMISSIONS, syncSharedSettingsFromServer } from "@/lib/sharedSettings";
import { ShieldCheck, Lock } from "lucide-react";

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
    name: "System Administrator",
    role: "admin",
    designation: "Managing Director",
    department: "Executive Management",
    email: "admin@workmanservices.pk",
    avatar: "SA",
    badgeColor: "bg-purple-600 text-white",
    description: "Full administrative authority across all operational, financial, and personnel systems.",
    primaryModules: ["Dashboard", "Jobs", "Dispatch Map", "Technicians", "Accounts", "HRM", "Inventory", "Projects", "Feedback", "Reports", "Audit"],
  },
  purchasing: {
    id: "a1b2c3d4-purch-0001-aaaa-bbbbccccdddd",
    name: "Procurement Officer",
    role: "purchasing",
    designation: "Procurement & Sourcing Lead",
    department: "Purchasing",
    email: "procurement@workmanservices.pk",
    avatar: "PO",
    badgeColor: "bg-orange-600 text-white",
    description: "RFQ management, vendor master, PO drafting and send. No PR/PO/invoice approvals or payments.",
    primaryModules: ["Procurement & Sourcing", "Warehouse & Stock"],
  },
  manager: {
    id: "b2c3d4e5-mgr-0002-bbbb-ccccddddeeee",
    name: "Operations Manager",
    role: "manager",
    designation: "Operations Manager",
    department: "Operations",
    email: "operations@workmanservices.pk",
    avatar: "OM",
    badgeColor: "bg-violet-600 text-white",
    description: "Approves PRs, POs, and discrepancy invoices. Reports and cost visibility; limited create rights.",
    primaryModules: ["Procurement & Sourcing", "Jobs", "Accounts"],
  },
  call_center: {
    id: "d41893c1-7443-41bb-92e6-c16e13f412ab",
    name: "Call Center Agent",
    role: "call_center",
    designation: "Call Center Lead & Job Controller",
    department: "Customer Care & Dispatch",
    email: "support@workmanservices.pk",
    avatar: "CC",
    badgeColor: "bg-teal-600 text-white",
    description: "Job intake, assigning technicians with active workload counters, issuing inventory/services to jobs, and feedback verification.",
    primaryModules: ["Jobs", "Dispatch Map", "Feedback Queue"],
  },
  accountant: {
    id: "b7753dcc-44d2-4a18-a428-503cb9c21568",
    name: "Finance & Accounts",
    role: "accountant",
    designation: "Chief Financial Accountant",
    department: "Finance & Accounts",
    email: "accounts@workmanservices.pk",
    avatar: "AC",
    badgeColor: "bg-emerald-600 text-white",
    description: "Full financial visibility: invoices, quotes, sales reports, post-creation job services, payment collections, and expense payouts.",
    primaryModules: ["Accounts", "Jobs", "Job Reports & Audit", "Procurement & Sourcing", "Reports"],
  },
  cashier: {
    id: "e9921bc4-1188-42df-a551-7f938b81cf04",
    name: "Counter Cashier",
    role: "cashier",
    designation: "Cashier & Counter Controller",
    department: "Cash Desk & Settlements",
    email: "cashier@workmanservices.pk",
    avatar: "CS",
    badgeColor: "bg-cyan-600 text-white",
    description: "Job hissab settlements, counter cash collections, POS register cash, and general payment cash vouchers. (No ledgers or salary slips).",
    primaryModules: ["Jobs", "Point of Sale (POS)", "Accounts & Ledgers"],
  },
  auditor: {
    id: "a8109bf3-6311-48e0-bb12-4f329971bc99",
    name: "Compliance Auditor",
    role: "auditor",
    designation: "Chief Internal Quality & Financial Auditor",
    department: "Governance & Internal Audit",
    email: "audit@workmanservices.pk",
    avatar: "AU",
    badgeColor: "bg-slate-700 text-white",
    description: "Omni-module supervisory audit: all jobs, financial entries, warehouse movements, feedback audits, and system rollback logs.",
    primaryModules: ["Auditor Verification", "Audit & Rollbacks", "Jobs", "Job Reports & Audit", "Accounts & Ledgers", "Feedback Queue", "Warehouse & Stock"],
  },
  dispatcher: {
    id: "13f6666d-952d-421c-8f2a-e7f204c32d17",
    name: "Lead Dispatcher",
    role: "dispatcher",
    designation: "Lead Dispatcher & Fleet Controller",
    department: "Operations & Logistics",
    email: "dispatch@workmanservices.pk",
    avatar: "DS",
    badgeColor: "bg-blue-600 text-white",
    description: "Work order scheduling, fleet live geofence dispatching, technician allocation, and route optimization.",
    primaryModules: ["Jobs", "Dispatch Map", "Technicians"],
  },
  storekeeper: {
    id: "99722077-b26f-4377-a38b-c106ad82c39b",
    name: "Warehouse Storekeeper",
    role: "storekeeper",
    designation: "Central Warehouse Storekeeper",
    department: "Warehouse & Inventory",
    email: "warehouse@workmanservices.pk",
    avatar: "SK",
    badgeColor: "bg-amber-600 text-white",
    description: "Inventory issue approvals, physical stock verification, technician returns/misplaced logging, GRN, and branch transfers. No purchasing costs.",
    primaryModules: ["Warehouse & Stock", "Jobs", "Procurement & Sourcing"],
  },
  hr: {
    id: "f03697b5-d011-41a0-98ad-8cdc84de5a06",
    name: "Human Resources",
    role: "hr",
    designation: "Operations & HR Lead",
    department: "Human Resources & Quality",
    email: "hr@workmanservices.pk",
    avatar: "HR",
    badgeColor: "bg-pink-600 text-white",
    description: "Employee onboarding, ATS pipeline, staff grievances, attendance, leaves, and HRM workforce administration.",
    primaryModules: ["HRM & Payroll"],
  },
  technician: {
    id: "6efdefa8-1956-4ca1-83cb-0d12ec8179f2",
    name: "Field Technician",
    role: "technician",
    designation: "Senior HVAC Technician",
    department: "Field Services",
    email: "tech@workmanservices.pk",
    avatar: "FT",
    badgeColor: "bg-[#0D7A5F] text-white",
    description: "Field mobile app user: on-site job execution, material requests, job execution, biometric attendance, and ESS.",
    primaryModules: ["Field Operations"],
  },
};

import { DEFAULT_ROLE_PERMISSIONS, roleMapHasPermission } from "@/lib/permissions";

/** Role as returned by /api/roles (server is the source of truth). */
export interface RoleDefinitionView {
  key: string;
  label: string;
  description: string;
  isSystem: boolean;
  isLocked: boolean;
  badgeColor: string;
  permissions: Record<string, boolean>;
  customized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  userCount?: number;
}

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
  phone?: string;
  /** Linked HR employee (Settings › User Accounts ↔ HR). */
  linkedEmployee?: { id: string; name: string; designation: string | null; department: string; status: string; active: boolean } | null;
  reportingManager?: { id: string; name: string; designation: string | null } | null;
}

export const DEFAULT_USERS: SystemUser[] = [
  {
    id: "usr-admin-01",
    name: "System Administrator",
    email: "admin@workmanservices.pk",
    username: "admin",
    role: "admin",
    designation: "Managing Director",
    department: "Executive Management",
    status: "active",
    avatar: "SA",
    badgeColor: "bg-purple-600 text-white",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr-cc-02",
    name: "Call Center Intake",
    email: "support@workmanservices.pk",
    username: "callcenter",
    role: "call_center",
    designation: "Call Center Lead & Job Controller",
    department: "Customer Care & Dispatch",
    status: "active",
    avatar: "CC",
    badgeColor: "bg-teal-600 text-white",
    createdAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "usr-acc-03",
    name: "Finance & Accounts",
    email: "accounts@workmanservices.pk",
    username: "accountant",
    role: "accountant",
    designation: "Chief Financial Accountant",
    department: "Finance & Accounts",
    status: "active",
    avatar: "AC",
    badgeColor: "bg-emerald-600 text-white",
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "usr-sk-04",
    name: "Warehouse Storekeeper",
    email: "warehouse@workmanservices.pk",
    username: "storekeeper",
    role: "storekeeper",
    designation: "Warehouse & Inventory Head",
    department: "Central Warehouse & Logistics",
    status: "active",
    avatar: "SK",
    badgeColor: "bg-amber-600 text-white",
    createdAt: "2026-01-20T00:00:00.000Z",
  },
  {
    id: "usr-cash-05",
    name: "Counter Cashier",
    email: "cashier@workmanservices.pk",
    username: "cashier",
    role: "cashier",
    designation: "Cashier & Counter Controller",
    department: "Finance & Retail Operations",
    status: "active",
    avatar: "CS",
    badgeColor: "bg-cyan-600 text-white",
    createdAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "usr-audit-06",
    name: "Compliance Auditor",
    email: "audit@workmanservices.pk",
    username: "auditor",
    role: "auditor",
    designation: "Internal Systems & QA Auditor",
    department: "Executive Quality Assurance",
    status: "active",
    avatar: "AU",
    badgeColor: "bg-slate-700 text-white",
    createdAt: "2026-02-15T00:00:00.000Z",
  },
  {
    id: "usr-disp-07",
    name: "Lead Dispatcher",
    email: "dispatch@workmanservices.pk",
    username: "dispatcher",
    role: "dispatcher",
    designation: "Operations Dispatch Manager",
    department: "Field Operations & Fleet",
    status: "active",
    avatar: "DS",
    badgeColor: "bg-blue-600 text-white",
    createdAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "usr-hr-08",
    name: "Human Resources",
    email: "hr@workmanservices.pk",
    username: "hr",
    role: "hr",
    designation: "Head of People & Attendance",
    department: "Human Resources",
    status: "active",
    avatar: "HR",
    badgeColor: "bg-pink-600 text-white",
    createdAt: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "usr-tech-09",
    name: "Field Technician",
    email: "tech@workmanservices.pk",
    username: "tech",
    role: "technician",
    designation: "Senior Lead HVAC Technician",
    department: "Field Services",
    status: "active",
    avatar: "FT",
    badgeColor: "bg-indigo-600 text-white",
    createdAt: "2026-01-08T00:00:00.000Z",
  },
  {
    id: "usr-purch-10",
    name: "Procurement Officer",
    email: "procurement@workmanservices.pk",
    username: "procurement",
    role: "purchasing",
    designation: "Procurement & Sourcing Lead",
    department: "Purchasing",
    status: "active",
    avatar: "PO",
    badgeColor: "bg-orange-600 text-white",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "usr-mgr-11",
    name: "Operations Manager",
    email: "operations@workmanservices.pk",
    username: "manager",
    role: "manager",
    designation: "Operations Manager",
    department: "Operations",
    status: "active",
    avatar: "OM",
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
  roleDefinitions: RoleDefinitionView[];
  updateRolePermissions: (roleKey: string, permissions: Record<string, boolean>) => Promise<void>;
  toggleRolePermission: (roleKey: string, permKey: string) => Promise<void>;
  createRole: (role: Persona, initialPermissions?: Record<string, boolean>) => Promise<void>;
  deleteRole: (roleKey: string) => Promise<void>;
  resetRolePermissions: (roleKey: string) => Promise<void>;
  refreshRoles: () => Promise<void>;

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
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinitionView[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, boolean> | null>(null);
  const [users, setUsers] = useState<SystemUser[]>(DEFAULT_USERS);
  const [activeUserId, setActiveUserIdState] = useState<string>("usr-admin-01");
  const [sessionReady, setSessionReady] = useState(false);

  const loadAdminData = async (perms: Record<string, boolean> | null, role: string) => {
    const canAdmin = role === "admin" || Boolean(perms?.["settings.manage_users"] || perms?.["settings.manage_roles"]);
    if (!canAdmin) return;
    const [usersResponse, rolesResponse] = await Promise.all([
      fetch("/api/users", { cache: "no-store" }),
      fetch("/api/roles", { cache: "no-store" }),
    ]);
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      if (Array.isArray(usersData.users)) setUsers(usersData.users);
    }
    if (rolesResponse.ok) {
      const rolesData = await rolesResponse.json();
      if (Array.isArray(rolesData.roles)) setRoleDefinitions(rolesData.roles);
    }
  };

  const refreshSession = async (initial = false) => {
    // Only a real "not signed in" answer (401) sends the user to /login. A network error, 502/503
    // during a deploy, or any other hiccup keeps the current screen and simply retries later.
    let sessionResponse: Response | null = null;
    for (let attempt = 0; attempt < (initial ? 6 : 1); attempt++) {
      try {
        sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      } catch {
        sessionResponse = null;
      }
      if (sessionResponse && (sessionResponse.ok || sessionResponse.status === 401)) break;
      if (initial) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
    if (!sessionResponse) throw new Error("Session check unavailable (network).");
    if (sessionResponse.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!sessionResponse.ok) throw new Error(`Session check unavailable (${sessionResponse.status}).`);
    const sessionData = await sessionResponse.json();
    const sessionUser = sessionData.user as SystemUser;
    if (!sessionUser) return;
    const perms = (sessionData.effectivePermissions || null) as Record<string, boolean> | null;
    setActiveRoleState(sessionUser.role);
    setActiveUserIdState(sessionUser.id);
    setEffectivePermissions(perms);
    setUsers((current) => {
      const others = current.filter((u) => u.id !== sessionUser.id && !DEFAULT_USERS.some((d) => d.id === u.id));
      return [sessionUser, ...others];
    });
    if (initial) {
      await loadAdminData(perms, sessionUser.role);
      // Shared settings lists come from the server so every user/device sees the same values.
      const can = (key: string) =>
        sessionUser.role === "admin" || (SHARED_SETTING_PERMISSIONS[key] || []).some((k) => Boolean(perms?.[k]));
      await syncSharedSettingsFromServer(can).catch(() => undefined);
    }
  };

  // Load the signed-in user, their server-computed permissions, and (for administrators) users + roles.
  // Role and permission definitions live on the server; nothing is kept in browser storage.
  useEffect(() => {
    let cancelled = false;
    try {
      localStorage.removeItem("workman_custom_roles");
      localStorage.removeItem("workman_role_permissions");
    } catch {
      // ignore
    }
    (async () => {
      try {
        await refreshSession(true);
        if (!cancelled) setSessionReady(true);
      } catch {
        // Server unreachable even after retries: reload later instead of signing the user out.
        if (!cancelled) window.setTimeout(() => window.location.reload(), 5000);
      }
    })();
    // Pick up permission changes made by an administrator without needing to sign in again.
    const onFocus = () => {
      refreshSession(false).catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customRoles: Record<string, Persona> = {};
  for (const def of roleDefinitions) {
    if (def.isSystem) continue;
    customRoles[def.key] = {
      id: `role-${def.key}`,
      name: def.label,
      role: def.key,
      designation: def.label,
      department: "",
      email: "",
      avatar: def.key.slice(0, 2).toUpperCase(),
      badgeColor: def.badgeColor,
      description: def.description || `Custom role ${def.label}`,
      primaryModules: [],
    };
  }
  const rolePermissions: Record<string, Record<string, boolean>> = { ...DEFAULT_ROLE_PERMISSIONS };
  for (const def of roleDefinitions) rolePermissions[def.key] = def.permissions;

  const allPersonasMap: Record<string, Persona> = {
    ...ERP_PERSONAS,
    ...customRoles,
  };

  const availablePersonas = Object.values(allPersonasMap);

  const activeUser =
    users.find((u) => u.id === activeUserId) ||
    users.find((u) => u.role === activeRole) ||
    users[0] ||
    DEFAULT_USERS[0];

  const currentPersona: Persona = useMemo(() => {
    const base = allPersonasMap[activeRole] || ERP_PERSONAS.admin;
    if (activeUser) {
      const displayName = (activeUser.name && activeUser.name.trim()) || activeUser.linkedEmployee?.name || activeUser.username || base.name;
      const initials = activeUser.avatar && activeUser.avatar !== "ERP"
        ? activeUser.avatar
        : displayName
        ? displayName.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
        : activeUser.username
        ? activeUser.username.slice(0, 2).toUpperCase()
        : base.avatar;
      return {
        ...base,
        id: activeUser.id || base.id,
        name: displayName,
        email: activeUser.email || base.email,
        designation: activeUser.designation || activeUser.linkedEmployee?.designation || base.designation,
        department: activeUser.department || activeUser.linkedEmployee?.department || base.department,
        avatar: initials,
        badgeColor: activeUser.badgeColor || base.badgeColor,
      };
    }
    return base;
  }, [allPersonasMap, activeRole, activeUser]);

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

  // Granular Permission Engine Check (UI only; the server enforces the same map on every API call)
  const hasPermission = (permissionKey: string): boolean => {
    if (activeUser?.status === "suspended") return false;
    if (activeRole === "admin") return true;
    if (effectivePermissions) return roleMapHasPermission(effectivePermissions, permissionKey);
    // Fallback before the session has loaded: built-in defaults + user overrides
    const overrides = activeUser?.permissionOverrides || {};
    if (overrides[permissionKey] !== undefined) return overrides[permissionKey];
    return roleMapHasPermission(rolePermissions[activeRole], permissionKey);
  };

  const applyRole = (role: RoleDefinitionView) => {
    setRoleDefinitions((current) => {
      const exists = current.some((r) => r.key === role.key);
      const userCount = current.find((r) => r.key === role.key)?.userCount;
      return exists
        ? current.map((r) => (r.key === role.key ? { ...role, userCount } : r))
        : [...current, { ...role, userCount: 0 }];
    });
  };

  const refreshRoles = async () => {
    const response = await fetch("/api/roles", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.roles)) setRoleDefinitions(data.roles);
  };

  const roleRequest = async (url: string, init: RequestInit, fallback: string) => {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || fallback);
    return data;
  };

  const updateRolePermissions = async (roleKey: string, newPerms: Record<string, boolean>) => {
    const data = await roleRequest(
      `/api/roles/${encodeURIComponent(roleKey)}`,
      { method: "PATCH", body: JSON.stringify({ permissions: newPerms }) },
      "Could not save role permissions."
    );
    if (data.role) applyRole(data.role);
    if (roleKey === activeRole) await refreshSession(false);
  };

  const toggleRolePermission = async (roleKey: string, permKey: string) => {
    const currentVal = rolePermissions[roleKey]?.[permKey] ?? roleKey === "admin";
    await updateRolePermissions(roleKey, { [permKey]: !currentVal });
  };

  const resetRolePermissions = async (roleKey: string) => {
    const data = await roleRequest(
      `/api/roles/${encodeURIComponent(roleKey)}`,
      { method: "PATCH", body: JSON.stringify({ reset: true }) },
      "Could not reset this role."
    );
    if (data.role) applyRole(data.role);
    if (roleKey === activeRole) await refreshSession(false);
  };

  const createRole = async (role: Persona, initialPermissions?: Record<string, boolean>) => {
    const data = await roleRequest(
      "/api/roles",
      {
        method: "POST",
        body: JSON.stringify({
          key: role.role,
          label: role.name,
          description: role.description,
          badgeColor: role.badgeColor,
          permissions: initialPermissions || {},
        }),
      },
      "Could not create the role."
    );
    if (data.role) applyRole(data.role);
  };

  const deleteRole = async (roleKey: string) => {
    await roleRequest(`/api/roles/${encodeURIComponent(roleKey)}`, { method: "DELETE" }, "Could not delete the role.");
    setRoleDefinitions((current) => current.filter((r) => r.key !== roleKey));
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
        roleDefinitions,
        updateRolePermissions,
        toggleRolePermission,
        createRole,
        deleteRole,
        resetRolePermissions,
        refreshRoles,
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
        <div className="relative min-h-screen bg-[#060B09] text-white flex flex-col items-center justify-center p-6 overflow-hidden select-none">
          {/* Ambient luminous aura */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-teal-400/15 rounded-full blur-[70px] pointer-events-none" />

          {/* Embedded keyframe for smooth indeterminate progress beam */}
          <style>{`
            @keyframes wmsShimmer {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(250%); }
            }
          `}</style>

          {/* Center Content Card */}
          <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center">
            {/* Orbital Badge Container */}
            <div className="relative mb-6">
              {/* Outer decorative dashed halo */}
              <div className="absolute -inset-3 rounded-3xl border border-dashed border-emerald-400/25 animate-[spin_16s_linear_infinite]" />
              {/* Spinning gradient ring */}
              <div className="absolute -inset-1 rounded-2xl border-2 border-emerald-400/40 border-t-emerald-300 border-r-transparent animate-spin" />
              
              {/* Core Emblem */}
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-[#0D7A5F] to-teal-900 p-0.5 shadow-2xl shadow-emerald-950/80 flex items-center justify-center">
                <div className="w-full h-full bg-[#081210] rounded-[14px] flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5 mb-6">
              <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-emerald-400 font-mono block">
                Workman Services • WMS ERP
              </span>
              <h2 className="text-base font-semibold tracking-tight text-white">
                Opening Secure Workspace
              </h2>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Verifying identity credentials, decrypting session profile, and synchronizing workspace permissions...
              </p>
            </div>

            {/* High-Tech Shimmer Progress Bar */}
            <div className="w-60 h-1.5 bg-white/10 rounded-full overflow-hidden mb-5 relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent w-3/5 rounded-full"
                style={{ animation: "wmsShimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
              />
            </div>

            {/* Session Security Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] text-zinc-300">256-Bit TLS • Zero-Trust Session Verification</span>
            </div>
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

