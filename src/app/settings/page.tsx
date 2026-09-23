"use client";

import React from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { 
  Users, 
  ShieldCheck, 
  Settings2, 
  Layers, 
  CreditCard, 
  ChevronRight, 
  SlidersHorizontal,
  Lock,
  FileCheck,
  Building
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";

export default function SettingsHubPage() {
  const { activeUser, currentPersona, hasPermission } = useRole();

  const settingsCards = [
    {
      title: "User Accounts & Role Permissions",
      subtitle: "Granular Sub-Part Access Matrix",
      description:
        "Create and manage user accounts, toggle user access on/off completely, create custom roles, and fine-tune sub-part permissions for jobs, dispatch, inventory, accounts, and HRM.",
      href: "/settings/users-roles",
      icon: Users,
      badge: "Core Security",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
      enabled: hasPermission("settings.manage_users") || hasPermission("settings.manage_roles"),
      statText: "Full ERP Action Toggles",
    },
    {
      title: "Accounting & Chart of Accounts",
      subtitle: "Financial Defaults & Ledgers",
      description:
        "Configure automated journal posting rules, default ledger codes (Cash 1000, Bank 1010, Revenue 4000, COGS 5000), tax percentages, and financial reporting periods.",
      href: "/settings/accounting",
      icon: CreditCard,
      badge: "Finance & Audit",
      badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
      enabled: hasPermission("settings.accounting"),
      statText: "GAAP Ledger Engine",
    },
    {
      title: "Stock Units & Measurement (UoM)",
      subtitle: "Warehouse Conversion Matrix",
      description:
        "Manage global measurement units (Pcs, Rft, Meters, Liters, Kg, Rolls, Boxes) and conversion ratios for physical inventory issuance and procurement.",
      href: "/settings/stock-units",
      icon: Layers,
      badge: "Supply Chain",
      badgeColor: "bg-purple-50 text-purple-800 border-purple-200",
      enabled: hasPermission("inventory.stock_units"),
      statText: "Inventory Scaling",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        moduleName="Software & System Settings"
        currentView="Administration Hub"
      />

      {/* Active Session Identity Card */}
      <div className="bg-white border border-[#E4E4E7] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0D7A5F]/10 border border-[#0D7A5F]/20 flex items-center justify-center text-[#0D7A5F] font-bold text-base">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
              System Configuration & Security Hub
              <span className="text-[10px] font-mono font-normal text-[#71717A] bg-[#F4F4F5] border border-[#E4E4E7] px-2 py-0.5 rounded-full">
                v2.6 Enterprise
              </span>
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Active Session: <strong>{activeUser.name}</strong> ({currentPersona.designation}) • Role:{" "}
              <span className="font-mono font-semibold text-emerald-800">{activeUser.role}</span> • Account Status:{" "}
              <span className="font-bold text-emerald-600">Active</span>
            </p>
          </div>
        </div>

        <Link
          href="/settings/users-roles"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Manage Users & Roles</span>
        </Link>
      </div>

      {/* Configuration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs hover:shadow-md hover:border-[#0D7A5F]/50 transition flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-[#F4F4F5] group-hover:bg-[#0D7A5F]/10 group-hover:text-[#0D7A5F] text-[#52525B] flex items-center justify-center transition border border-[#EDEDED]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.badgeColor}`}
                  >
                    {card.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition flex items-center gap-1.5">
                    {card.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                    {card.subtitle}
                  </p>
                  <p className="text-xs text-[#71717A] mt-2 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#F4F4F5] flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-[#71717A] font-medium">
                  {card.statText}
                </span>
                <span className="font-bold text-[#0D7A5F] flex items-center gap-1 group-hover:translate-x-1 transition">
                  Configure
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Enterprise Security Architecture Notice */}
      <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl p-5 text-xs text-[#52525B] space-y-2">
        <div className="flex items-center gap-2 font-bold text-[#18181B]">
          <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
          <span>Role-Based Access Control (RBAC) & Principle of Least Privilege</span>
        </div>
        <p className="leading-relaxed">
          Workman Services implements granular sub-part permission gates. Administrators can toggle specific actions (such as viewing financials, reassigning technicians, adding services, or issuing warehouse inventory) independently for any system role or specific user account. Suspended user accounts are immediately denied all access across all endpoints and web views.
        </p>
      </div>
    </div>
  );
}
