"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  MapPin,
  Users,
  CreditCard,
  UserCheck,
  Package,
  FolderKanban,
  Headphones,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Settings,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Smartphone,
  Flame,
  MoreHorizontal,
  RotateCcw,
  ExternalLink,
  ShoppingBag,
  ShoppingCart,
  Layers,
  Calendar,
  Camera,
  UserPlus,
  Sparkles,
  TrendingDown,
  Wallet,
  BookOpen,
  Sliders,
  Scale,
  Building,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

interface SidebarProps {
  onOpenMobileSim?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  onOpenMobileSim,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { activeRole, isModulePrimary, hasPermission } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isDashboardsActive = pathname === "/" || pathname.startsWith("/dashboards");
  const isJobsActive = pathname.startsWith("/jobs") || pathname.startsWith("/dispatch");
  const isAccountsActive = pathname.startsWith("/accounts");
  const isHrmActive = pathname.startsWith("/hrm");
  const isSettingsActive = pathname.startsWith("/settings");

  // Single open menu state for strict accordion behavior (opening one collapses others)
  const [openMenu, setOpenMenu] = useState<string | null>(() => {
    if (isSettingsActive) return "settings";
    if (isAccountsActive) return "accounts";
    if (isHrmActive) return "hrm";
    if (isJobsActive) return "jobs";
    if (isDashboardsActive) return "dashboards";
    return null;
  });

  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const updateSearch = () => {
      if (typeof window !== "undefined") {
        setSearchQuery(window.location.search);
      }
    };
    updateSearch();
    window.addEventListener("popstate", updateSearch);
    return () => window.removeEventListener("popstate", updateSearch);
  }, [pathname]);

  // Sync open menu when pathname changes
  useEffect(() => {
    if (isSettingsActive) {
      setOpenMenu("settings");
    } else if (isAccountsActive) {
      setOpenMenu("accounts");
    } else if (isHrmActive) {
      setOpenMenu("hrm");
    } else if (isJobsActive) {
      setOpenMenu("jobs");
    } else if (isDashboardsActive) {
      setOpenMenu("dashboards");
    }
  }, [pathname, isJobsActive, isDashboardsActive, isHrmActive, isAccountsActive, isSettingsActive]);

  const toggleMenu = (menuId: string) => {
    setOpenMenu((prev) => (prev === menuId ? null : menuId));
  };

  const isDashboardsOpen = openMenu === "dashboards";
  const isJobsOpen = openMenu === "jobs";
  const isAccountsOpen = openMenu === "accounts";
  const isHrmOpen = openMenu === "hrm";
  const isSettingsOpen = openMenu === "settings";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) {
        setInternalCollapsed(saved === "true");
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch (e) {
        // ignore
      }
    }
  };

  const dashboardSubItems = [
    { label: "Executive Overview", tab: "overview", icon: TrendingUp },
    { label: "Technicians & Ops", tab: "technicians", icon: Users },
    { label: "Accountants & Finance", tab: "finance", icon: CreditCard },
    { label: "Purchasing & Stock", tab: "inventory", icon: Package },
    { label: "HRM & Workforce", tab: "hrm", icon: UserCheck },
    { label: "Customer Care & QA", tab: "feedback", icon: Headphones },
  ];

  // Dedicated Jobs Accordion Sub-Items
  const allJobSubItems = [
    {
      label: "Jobs Directory",
      href: "/jobs",
      icon: Briefcase,
      roles: ["admin", "accountant", "dispatcher", "call_center", "storekeeper", "cashier", "auditor"],
      perm: "jobs.view_directory",
    },
    {
      label: "Job Reports & Audit",
      href: "/jobs/reports",
      icon: BarChart3,
      roles: ["admin", "accountant", "auditor"],
      perm: "jobs.reports",
    },
    {
      label: "Live Dispatch Map",
      href: "/dispatch",
      icon: MapPin,
      roles: ["admin", "dispatcher", "call_center", "auditor"],
      perm: "dispatch.view_map",
    },
  ];

  const jobSubItems = allJobSubItems.filter((item) => {
    // Strictly block daily audit & reports for storekeeper
    if (item.href.includes("reports") && isStorekeeper) return false;
    const hasRole = item.roles.includes(activeRole);
    if (!hasRole && !item.perm) return false;
    if (item.perm) {
      return hasRole || hasPermission(item.perm);
    }
    return hasRole;
  });

  // Dedicated HRM Accordion Sub-Items
  const hrmSubItems = [
    { label: "HR Dashboard", tab: "analytics", icon: BarChart3 },
    { label: "Employees", tab: "employees", icon: Users },
    { label: "Leave Management", tab: "leave", icon: Calendar },
    { label: "Assets Register", tab: "assets", icon: Package },
    { label: "Recruitment (ATS)", tab: "recruitment", icon: UserPlus },
    { label: "Attendance & Face", tab: "attendance", icon: Camera },
    { label: "Payroll Runs", tab: "payroll", icon: CreditCard },
    { label: "Advances", tab: "advances", icon: TrendingDown },
    { label: "Self-Service (ESS)", tab: "ess", icon: Sparkles },
  ];

  const hasHrmAccess = ["admin", "hr", "auditor"].includes(activeRole) || hasPermission("hrm.view_employees");

  const allOperationsItems = [
    { label: "Point of Sale (POS)", href: "/pos", icon: ShoppingBag, roles: ["admin", "cashier", "accountant", "call_center", "auditor"], perm: "accounts.pos" },
    { label: "Procurement & Sourcing", href: "/procurement", icon: ShoppingCart, roles: ["admin", "accountant", "storekeeper", "auditor"], perm: "procurement.view_pr" },
    { label: "Warehouse & Stock", href: "/inventory", icon: Package, roles: ["admin", "storekeeper", "accountant", "auditor"], perm: "inventory.view_stock" },
    { label: "Feedback Queue", href: "/feedback", icon: Headphones, roles: ["admin", "call_center", "hr", "auditor"] },
    { label: "Audit & Rollbacks", href: "/audit", icon: RotateCcw, roles: ["admin", "auditor"], perm: "audit.view_logs" },
  ];

  const operationsItems = allOperationsItems.filter((item) => {
    // Check role inclusion or granular permission
    const hasRole = item.roles.includes(activeRole);
    if (!hasRole && !item.perm) return false;
    if (item.perm) {
      return hasRole || hasPermission(item.perm);
    }
    return hasRole;
  });

  const preAccountsOperations = operationsItems.filter((item) =>
    ["/pos"].includes(item.href)
  );

  const inventoryOperations = operationsItems.filter((item) =>
    ["/procurement", "/inventory"].includes(item.href)
  );

  // Dedicated Accounts & Ledgers Accordion Sub-Items
  const accountingSubItems = [
    { label: "Party Ledgers (AR & AP)", tab: "ledgers", icon: Users },
    { label: "Expenses & Outflows", tab: "expenses", icon: TrendingDown },
    { label: "POS Sales Register", tab: "pos", icon: ShoppingBag },
    { label: "Cash & Bank Book", tab: "cashbook", icon: Wallet },
    { label: "Chart of Accounts (COA)", tab: "chart", icon: BookOpen },
    { label: "Account Mapping", tab: "mapping", icon: Sliders },
    { label: "General Journal", tab: "journal", icon: Scale },
    { label: "Financial Statements", tab: "reports", icon: FileText },
    { label: "Bank Reconciliation", tab: "bankrec", icon: Building },
    { label: "Fixed Assets & Depr", tab: "fixedassets", icon: Layers },
    { label: "Sub-Ledger Drift & Aging", tab: "subledgers", icon: ArrowLeftRight },
  ];

  const hasAccountsAccess =
    ["admin", "accountant", "cashier", "auditor"].includes(activeRole) ||
    hasPermission("accounts.general_ledger");

  // Dedicated Settings Accordion Sub-Items
  const allSettingsSubItems = [
    {
      label: "Accounting Settings",
      href: "/settings/accounting",
      icon: CreditCard,
      roles: ["admin", "accountant"],
      perm: "settings.accounting",
    },
    {
      label: "Stock Units Settings",
      href: "/settings/stock-units",
      icon: Layers,
      roles: ["admin", "storekeeper", "accountant"],
      perm: "inventory.stock_units",
    },
    {
      label: "Users & Role Settings",
      href: "/settings/users-roles",
      icon: ShieldCheck,
      roles: ["admin", "auditor"],
      perm: "settings.manage_users",
    },
  ];

  const settingsSubItems = allSettingsSubItems.filter((item) => {
    const hasRole = item.roles.includes(activeRole);
    if (!hasRole && !item.perm) return false;
    if (item.perm) {
      return hasRole || hasPermission(item.perm);
    }
    return hasRole;
  });

  const hasSettingsAccess = settingsSubItems.length > 0;

  const postHrmOperations = operationsItems.filter((item) =>
    ["/feedback", "/audit"].includes(item.href)
  );

  return (
    <aside
      aria-label="Primary Navigation"
      className={cn(
        "bg-[#18181B] text-[#E4E4E7] h-full flex flex-col justify-between select-none shrink-0 transition-all duration-300",
        isCollapsed ? "w-18" : "w-60"
      )}
    >
      {/* Brand Header & Active Role Indicator */}
      <div>
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#27272A]/40">
          <Link
            href="/dashboards"
            className="flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-[#0D7A5F] rounded-lg p-1"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0D7A5F] text-white flex items-center justify-center shrink-0 shadow-md">
              <Flame className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <span className="font-bold text-sm tracking-tight text-white block leading-none">
                  HVAC ERP
                </span>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-mono mt-0.5 leading-none">
                  OPERATIONS v2
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="p-2 space-y-1 mt-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* ================================================================= */}
          {/* 1. DEDICATED DASHBOARDS SECTION                                    */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => {
                if (isCollapsed) {
                  window.location.href = "/dashboards";
                } else {
                  toggleMenu("dashboards");
                }
              }}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer group select-none",
                isDashboardsActive
                  ? "bg-[#27272A] text-white"
                  : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
              )}
            >
              <div className="flex items-center gap-3">
                <BarChart3
                  className={cn(
                    "w-4 h-4 shrink-0 transition",
                    isDashboardsActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                  )}
                />
                {!isCollapsed && <span>Dashboards Hub</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200",
                    isDashboardsOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              )}
            </div>

            {/* Sub-Dashboards List */}
            {isDashboardsOpen && !isCollapsed && (
              <div className="pl-4 pr-1 pt-1 pb-1 space-y-0.5 border-l border-zinc-700/60 ml-5 mt-1 animate-in fade-in duration-150">
                {dashboardSubItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive =
                    pathname === "/dashboards" &&
                    (searchQuery.includes(`tab=${sub.tab}`) || (!searchQuery.includes("tab=") && sub.tab === "overview"));
                  return (
                    <Link
                      key={sub.tab}
                      href={`/dashboards?tab=${sub.tab}`}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition group",
                        isSubActive
                          ? "bg-[#27272A] text-emerald-400 font-bold"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                      )}
                    >
                      <SubIcon
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 transition",
                          isSubActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-emerald-400"
                        )}
                      />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* 2. OPERATIONS & CORE MODULES SECTION                              */}
          {/* ================================================================= */}
          {!isCollapsed && (
            <div className="px-3 pt-3 pb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                Operations & Systems
              </span>
            </div>
          )}

          {/* Dedicated Expandable Jobs Hub */}
          {jobSubItems.length > 0 && (
            <div>
              <div
                onClick={() => {
                  if (isCollapsed) {
                    window.location.href = "/jobs";
                  } else {
                    toggleMenu("jobs");
                  }
                }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer group select-none",
                  isJobsActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <Briefcase
                    className={cn(
                      "w-4 h-4 shrink-0 transition",
                      isJobsActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                    )}
                  />
                  {!isCollapsed && <span>Jobs</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200",
                      isJobsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                )}
              </div>

              {/* Jobs Sub-Items List */}
              {isJobsOpen && !isCollapsed && (
                <div className="pl-4 pr-1 pt-1 pb-1 space-y-0.5 border-l border-zinc-700/60 ml-5 mt-1 animate-in fade-in duration-150">
                  {jobSubItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive =
                      sub.href === "/jobs/reports"
                        ? (pathname === "/jobs/reports" || (pathname === "/jobs" && searchQuery.includes("view=reports")))
                        : sub.href === "/jobs"
                        ? (pathname === "/jobs" && !searchQuery.includes("view=reports"))
                        : (pathname === sub.href || pathname.startsWith(`${sub.href}/`));

                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition group",
                          isSubActive
                            ? "bg-[#27272A] text-emerald-400 font-bold"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        )}
                      >
                        <SubIcon
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 transition",
                            isSubActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-emerald-400"
                          )}
                        />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {preAccountsOperations.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isPrimary = isModulePrimary(item.label);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? `${item.label}${isPrimary && activeRole !== "admin" ? " (Role Primary)" : ""}` : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group focus-visible:ring-2 focus-visible:ring-[#0D7A5F] relative",
                  isActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition",
                    isActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                  )}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    {isPrimary && activeRole !== "admin" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Primary Module for Active Role" />
                    )}
                  </div>
                )}
              </Link>
            );
          })}

          {/* Dedicated Expandable Accounts & Ledgers Accordion */}
          {hasAccountsAccess && (
            <div>
              <div
                onClick={() => {
                  if (isCollapsed) {
                    window.location.href = "/accounts";
                  } else {
                    toggleMenu("accounts");
                  }
                }}
                title={isCollapsed ? "Accounts & Ledgers" : undefined}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer group select-none",
                  isAccountsActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <CreditCard
                    className={cn(
                      "w-4 h-4 shrink-0 transition",
                      isAccountsActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                    )}
                  />
                  {!isCollapsed && (
                    <div className="flex items-center gap-2">
                      <span>Accounts & Ledgers</span>
                      {isModulePrimary("Accounts & Ledgers") && activeRole !== "admin" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Primary Module for Active Role" />
                      )}
                    </div>
                  )}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200",
                      isAccountsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                )}
              </div>

              {/* Accounts Sub-Items List */}
              {isAccountsOpen && !isCollapsed && (
                <div className="pl-4 pr-1 pt-1 pb-1 space-y-0.5 border-l border-zinc-700/60 ml-5 mt-1 animate-in fade-in duration-150">
                  {accountingSubItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive =
                      pathname === "/accounts" &&
                      (searchQuery.includes(`tab=${sub.tab}`) || (!searchQuery.includes("tab=") && sub.tab === "ledgers"));

                    return (
                      <Link
                        key={sub.tab}
                        href={`/accounts?tab=${sub.tab}`}
                        onClick={() => {
                          setSearchQuery(`?tab=${sub.tab}`);
                          if (typeof window !== "undefined") {
                            if (pathname === "/accounts") {
                              const url = new URL(window.location.href);
                              url.searchParams.set("tab", sub.tab);
                              window.history.pushState(null, "", url.toString());
                              window.dispatchEvent(new Event("popstate"));
                            }
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition group",
                          isSubActive
                            ? "bg-[#27272A] text-emerald-400 font-bold"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        )}
                      >
                        <SubIcon
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 transition",
                            isSubActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-emerald-400"
                          )}
                        />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {inventoryOperations.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isPrimary = isModulePrimary(item.label);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? `${item.label}${isPrimary && activeRole !== "admin" ? " (Role Primary)" : ""}` : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group focus-visible:ring-2 focus-visible:ring-[#0D7A5F] relative",
                  isActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition",
                    isActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                  )}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    {isPrimary && activeRole !== "admin" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Primary Module for Active Role" />
                    )}
                  </div>
                )}
              </Link>
            );
          })}

          {/* Dedicated Expandable HRM & Workforce Accordion */}
          {hasHrmAccess && (
            <div>
              <div
                onClick={() => {
                  if (isCollapsed) {
                    window.location.href = "/hrm";
                  } else {
                    toggleMenu("hrm");
                  }
                }}
                title={isCollapsed ? "HRM & Workforce" : undefined}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer group select-none",
                  isHrmActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <UserCheck
                    className={cn(
                      "w-4 h-4 shrink-0 transition",
                      isHrmActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                    )}
                  />
                  {!isCollapsed && <span>HRM</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200",
                      isHrmOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                )}
              </div>

              {/* HRM Sub-Items List */}
              {isHrmOpen && !isCollapsed && (
                <div className="pl-4 pr-1 pt-1 pb-1 space-y-0.5 border-l border-zinc-700/60 ml-5 mt-1 animate-in fade-in duration-150">
                  {hrmSubItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive =
                      pathname === "/hrm" &&
                      (searchQuery.includes(`tab=${sub.tab}`) || (!searchQuery.includes("tab=") && sub.tab === "analytics"));

                    return (
                      <Link
                        key={sub.tab}
                        href={`/hrm?tab=${sub.tab}`}
                        onClick={() => setSearchQuery(`?tab=${sub.tab}`)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition group",
                          isSubActive
                            ? "bg-[#27272A] text-emerald-400 font-bold"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        )}
                      >
                        <SubIcon
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 transition",
                            isSubActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-emerald-400"
                          )}
                        />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {postHrmOperations.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isPrimary = isModulePrimary(item.label);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? `${item.label}${isPrimary && activeRole !== "admin" ? " (Role Primary)" : ""}` : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group focus-visible:ring-2 focus-visible:ring-[#0D7A5F] relative",
                  isActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition",
                    isActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                  )}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    {isPrimary && activeRole !== "admin" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Primary Module for Active Role" />
                    )}
                  </div>
                )}
              </Link>
            );
          })}

          {/* Dedicated Expandable Settings Accordion */}
          {hasSettingsAccess && (
            <div>
              <div
                onClick={() => {
                  if (isCollapsed) {
                    window.location.href = "/settings";
                  } else {
                    toggleMenu("settings");
                  }
                }}
                title={isCollapsed ? "Settings" : undefined}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer group select-none",
                  isSettingsActive
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#27272A]/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <Settings
                    className={cn(
                      "w-4 h-4 shrink-0 transition",
                      isSettingsActive ? "text-[#0D7A5F]" : "text-[#A1A1AA] group-hover:text-white"
                    )}
                  />
                  {!isCollapsed && <span>Settings</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200",
                      isSettingsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                )}
              </div>

              {/* Settings Sub-Items List */}
              {isSettingsOpen && !isCollapsed && (
                <div className="pl-4 pr-1 pt-1 pb-1 space-y-0.5 border-l border-zinc-700/60 ml-5 mt-1 animate-in fade-in duration-150">
                  {settingsSubItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive =
                      pathname === sub.href || pathname.startsWith(`${sub.href}/`);

                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition group",
                          isSubActive
                            ? "bg-[#27272A] text-emerald-400 font-bold"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        )}
                      >
                        <SubIcon
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 transition",
                            isSubActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-emerald-400"
                          )}
                        />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Companion App + Collapse Toggle */}
      <div className="p-2 space-y-1 border-t border-[#27272A]/40">
        {/* Mobile Companion Trigger (OPENS IN A NEW TAB) */}
        <Link
          href="/mobile"
          target="_blank"
          rel="noopener noreferrer"
          title={isCollapsed ? "Mobile Field App Simulator (Opens in New Tab)" : undefined}
          aria-label="Mobile Field App Simulator"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white hover:bg-[#27272A]/40 transition group focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
        >
          <Smartphone className="w-4 h-4 shrink-0 text-emerald-400 group-hover:scale-105 transition" />
          {!isCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span>Field Companion</span>
              <ExternalLink className="w-3 h-3 text-[#71717A] group-hover:text-white" />
            </div>
          )}
        </Link>

        {/* Sidebar Collapse/Expand Toggle */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#27272A]/40 transition"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
