"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type RoleType =
  | "admin"
  | "accountant"
  | "dispatcher"
  | "call_center"
  | "storekeeper"
  | "cashier"
  | "auditor"
  | "hr"
  | "technician";

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

interface RoleContextType {
  activeRole: RoleType;
  currentRole: RoleType;
  currentPersona: Persona;
  setRole: (role: RoleType) => void;
  availablePersonas: Persona[];
  isModulePrimary: (moduleName: string) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRoleState] = useState<RoleType>("admin");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("active_erp_role") as RoleType;
      if (saved && ERP_PERSONAS[saved]) {
        setActiveRoleState(saved);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const setRole = (role: RoleType) => {
    setActiveRoleState(role);
    try {
      localStorage.setItem("active_erp_role", role);
    } catch (e) {
      // ignore
    }
  };

  const currentPersona = ERP_PERSONAS[activeRole] || ERP_PERSONAS.admin;
  const availablePersonas = Object.values(ERP_PERSONAS);

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
