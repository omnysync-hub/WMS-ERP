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
  FileText,
  Smartphone,
  Flame,
  MoreHorizontal,
  RotateCcw,
  ExternalLink,
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
  const { activeRole, currentPersona, isModulePrimary } = useRole();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [isDashboardsOpen, setIsDashboardsOpen] = useState(true);

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

  const operationsItems = [
    { label: "Jobs Directory", href: "/jobs", icon: Briefcase },
    { label: "Live Dispatch Map", href: "/dispatch", icon: MapPin },
    { label: "Accounts & Ledgers", href: "/accounts", icon: CreditCard },
    { label: "HRM & Payroll", href: "/hrm", icon: UserCheck },
    { label: "Purchasing & Stock", href: "/inventory", icon: Package },
    { label: "Feedback Queue", href: "/feedback", icon: Headphones },
    { label: "Audit & Rollbacks", href: "/audit", icon: RotateCcw },
  ];

  const isDashboardsActive = pathname === "/" || pathname.startsWith("/dashboards");

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
                  WORKMAN
                </span>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-mono mt-0.5 leading-none">
                  HVAC ERP v2
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Current Active Persona Mini Badge */}
        <div className={cn("px-3 pt-2.5 pb-1", isCollapsed ? "flex justify-center" : "")}>
          {isCollapsed ? (
            <div
              title={`${currentPersona.name} • ${currentPersona.designation}`}
              className={cn("w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px]", currentPersona.badgeColor)}
            >
              {currentPersona.avatar}
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-[#27272A]/70 border border-[#3F3F46]/40 flex items-center gap-2.5">
              <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0", currentPersona.badgeColor)}>
                {currentPersona.avatar}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-[11px] font-bold text-white truncate leading-tight">
                  {currentPersona.name}
                </p>
                <p className="text-[9px] text-emerald-400 font-medium truncate leading-tight mt-0.5">
                  {currentPersona.designation}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="p-2 space-y-1 mt-1 overflow-y-auto max-h-[calc(100vh-210px)]">
          {/* ================================================================= */}
          {/* 1. DEDICATED DASHBOARDS SECTION                                    */}
          {/* ================================================================= */}
          <div>
            <div
              onClick={() => {
                if (isCollapsed) {
                  window.location.href = "/dashboards";
                } else {
                  setIsDashboardsOpen(!isDashboardsOpen);
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
                  return (
                    <Link
                      key={sub.tab}
                      href={`/dashboards?tab=${sub.tab}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition group"
                    >
                      <SubIcon className="w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-emerald-400 transition" />
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

          {operationsItems.map((item) => {
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
