"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Bell,
  HelpCircle,
  Briefcase,
  User,
  Receipt,
  Package,
  ChevronDown,
  CheckCircle2,
  X,
  FileText,
  UserCheck,
  Smartphone,
  ExternalLink,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { useRole, RoleType } from "@/contexts/RoleContext";
import { realtimeSync } from "@/lib/realtimeSync";

interface TopbarProps {
  onOpenCustomerDrawer?: () => void;
  onOpenTechnicianDrawer?: () => void;
  onOpenExpenseDrawer?: () => void;
}

export default function Topbar({
  onOpenCustomerDrawer,
  onOpenTechnicianDrawer,
  onOpenExpenseDrawer,
}: TopbarProps) {
  const router = useRouter();

  // Universal Search ("Find or Ask") state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global "+" Quick-Create Menu state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Active ERP Role Context
  const { activeRole, currentPersona, setRole, availablePersonas } = useRole();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Notifications Popover state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [liveRealtimeToast, setLiveRealtimeToast] = useState<{ id: string; title: string; message: string } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([
    {
      id: "n1",
      title: "Technician Accepted Job",
      message: "Technician Ali Hassan accepted JOB-2026-0001. Status moved to In-Progress.",
      timestamp: "Just now",
      unread: true,
    },
    {
      id: "n2",
      title: "Storekeeper Return Required",
      message: "Technician returned 2x unconsumed AC units to warehouse. Awaiting Bilal Sheikh sign-off.",
      timestamp: "12m ago",
      unread: true,
    },
  ]);

  useEffect(() => {
    const loadNotices = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("admin_notifications") || "[]");
        // Sanitize and purge any internal System or sync event notifications
        const filtered = (Array.isArray(stored) ? stored : []).filter(
          (n: any) =>
            n &&
            n.title !== "System" &&
            !n.title?.toLowerCase().includes("system") &&
            !n.message?.includes("AUDIT_LOG_UPDATE") &&
            !n.message?.includes("Sync event")
        );
        if (filtered.length !== stored.length) {
          localStorage.setItem("admin_notifications", JSON.stringify(filtered));
        }

        // Purge any lingering internal audit sync in last event
        const lastEvt = localStorage.getItem("erp_last_event") || localStorage.getItem("workman_erp_last_event");
        if (lastEvt && (lastEvt.includes("AUDIT_LOG_UPDATE") || lastEvt.includes("Sync event") || lastEvt.includes('"actor":"System"'))) {
          localStorage.removeItem("erp_last_event");
          localStorage.removeItem("workman_erp_last_event");
        }

        if (filtered.length > 0) {
          setNotifications((prev) => {
            const ids = new Set(prev.map((n) => n.id));
            const newOnes = filtered.filter((n: any) => !ids.has(n.id));
            return [...newOnes, ...prev];
          });
        }
      } catch (e) {
        // ignore
      }
    };

    const loadPendingDiscounts = async () => {
      try {
        const res = await fetch("/api/accounts?view=discounts");
        const data = await res.json();
        if (data.discounts && data.discounts.length > 0) {
          const discountNotices = data.discounts.map((d: any) => ({
            id: `disc-${d.jobId}-${d.itemId || "job"}`,
            title: `Discount Request: ${d.jobNumber}`,
            message: `Tech ${d.technicianName} requested PKR ${d.requestedDiscount} discount on ${d.itemDescription} (${d.customerName}).`,
            timestamp: "Awaiting approval",
            unread: true,
            isDiscount: true,
            href: "/accounts",
          }));
          setNotifications((prev) => {
            const ids = new Set(prev.map((n) => n.id));
            const newOnes = discountNotices.filter((n: any) => !ids.has(n.id));
            return [...newOnes, ...prev];
          });
        }
      } catch (e) {}
    };

    loadNotices();
    loadPendingDiscounts();
    window.addEventListener("admin_notification_update", loadNotices);
    return () => window.removeEventListener("admin_notification_update", loadNotices);
  }, []);

  // Real-time Event Subscription across ERP
  useEffect(() => {
    const unsub = realtimeSync.subscribe((evt) => {
      // Do not notify, toast, or play audio for background telemetry, clicks, or internal sync pings
      if (
        evt.isSilent ||
        !evt.message ||
        !evt.actor ||
        evt.type === "AUDIT_LOG_UPDATE" ||
        evt.type === "INVENTORY_SYNC" ||
        evt.type === "TECHNICIAN_SYNC" ||
        evt.type === "JOB_UPDATED" ||
        evt.actor === "System" ||
        evt.actor?.toLowerCase() === "system" ||
        evt.message?.toLowerCase().includes("sync event") ||
        evt.message?.toLowerCase().includes("audit")
      ) {
        return;
      }

      // Subtle audio ping for real operational business events (e.g. Job Assigned, Expense Logged, Discount)
      if (typeof window !== "undefined") {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(523.25, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.09, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
      }

      const newNotice = {
        id: evt.id,
        title: evt.actor || evt.type.replace(/_/g, " "),
        message: evt.message,
        timestamp: "Just now",
        unread: true,
      };

      setNotifications((prev) => [newNotice, ...prev]);
      setLiveRealtimeToast({ id: evt.id, title: newNotice.title, message: evt.message });
      setTimeout(() => setLiveRealtimeToast(null), 5000);
    });

    return () => unsub();
  }, []);

  // Working Keyboard Shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsQuickCreateOpen(false);
        setIsUserMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Universal Search query execution
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [jobsRes, techRes] = await Promise.all([
          fetch(`/api/jobs?search=${encodeURIComponent(searchQuery)}`),
          fetch(`/api/technicians`),
        ]);
        const jobs = await jobsRes.json();
        const techData = await techRes.json();

        const results: any[] = [];
        if (Array.isArray(jobs)) {
          jobs.slice(0, 5).forEach((j: any) => {
            results.push({
              type: "Job",
              id: j.id,
              title: `${j.jobNumber} — ${j.customer?.name}`,
              subtitle: `${j.jobType} • Status: ${j.status}`,
              href: `/jobs/${j.id}`,
            });
          });
        }
        if (techData?.technicians) {
          const matchedTechs = techData.technicians.filter(
            (t: any) =>
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.phone.includes(searchQuery)
          );
          matchedTechs.forEach((t: any) => {
            results.push({
              type: "Technician",
              id: t.id,
              title: `${t.name} (${t.currentStatus})`,
              subtitle: `Phone: ${t.phone}`,
              href: `/dispatch`,
            });
          });
        }
        setSearchResults(results);
      } catch (e) {
        console.error("Universal search failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <>
      {/* Continuous Dark Top Bar matching Sidebar with no visible seam */}
      <header className="h-14 bg-[#18181B] px-5 flex items-center justify-between z-20 shrink-0 select-none">
        {/* Left: Universal Search ("Find or Ask") & Global "+" Quick-Create */}
        <div className="flex items-center gap-2.5 flex-1 max-w-xl">
          {/* Pill-Shaped Universal Search Field */}
          <div className="relative w-full max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] pointer-events-none" />
            <input
              type="text"
              readOnly
              onClick={() => setIsSearchOpen(true)}
              placeholder="Find or Ask... (Jobs, customers, techs, invoices)"
              aria-label="Universal search"
              className="w-full bg-[#27272A] hover:bg-[#2E2E32] pl-8 pr-12 py-1.5 rounded-full text-xs text-[#E4E4E7] placeholder-[#A1A1AA] border border-[#3F3F46]/70 focus:border-[#0D7A5F] cursor-pointer transition focus:outline-none"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-[#3F3F46] text-[#D4D4D8] px-1.5 py-0.5 rounded font-mono border border-[#52525B]">
              ⌘K
            </span>
          </div>

          {/* Global "+" Quick-Create Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsQuickCreateOpen(!isQuickCreateOpen)}
              aria-label="Quick create menu"
              aria-expanded={isQuickCreateOpen}
              className="w-7 h-7 rounded-full bg-[#0D7A5F] hover:bg-[#0A624C] text-white flex items-center justify-center transition shadow-xs focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {isQuickCreateOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsQuickCreateOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-52 py-1.5 animate-in fade-in zoom-in-95 text-xs text-[#18181B]">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                    Quick Actions
                  </div>
                  <Link
                    href="/jobs/new"
                    onClick={() => setIsQuickCreateOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F4F5] transition"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    New HVAC Job
                  </Link>
                  <Link
                    href="/pos"
                    onClick={() => setIsQuickCreateOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F4F5] transition"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                    New POS Counter Sale
                  </Link>
                  <button
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      onOpenCustomerDrawer?.();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-[#F4F4F5] transition"
                  >
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    New Customer (Drawer)
                  </button>
                  <Link
                    href="/inventory"
                    onClick={() => setIsQuickCreateOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F4F5] transition"
                  >
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    New Purchase Requisition
                  </Link>
                  <Link
                    href="/hrm"
                    onClick={() => setIsQuickCreateOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F4F5] transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                    Record Attendance Scan
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Notifications & Role Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Notifications Bell with Popover Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="Notifications"
              aria-label="Notifications center"
              aria-expanded={isNotificationsOpen}
              className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] rounded-lg transition relative focus-visible:outline-none"
            >
              <Bell className="w-4 h-4" />
              {notifications.some((n) => n.unread) && (
                <span className="w-2 h-2 rounded-full bg-[#0D7A5F] absolute top-1.5 right-1.5 ring-2 ring-[#18181B]" />
              )}
            </button>

            {isNotificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsNotificationsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-80 py-2 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                  <div className="px-3 pb-2 border-b border-[#EDEDED] flex items-center justify-between">
                    <span className="font-bold text-[#18181B] text-xs">Field Activity & Alerts</span>
                    <span className="text-[10px] text-[#0D7A5F] font-semibold bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                      {notifications.length} updates
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#EDEDED]">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.href) {
                            router.push(n.href);
                            setIsNotificationsOpen(false);
                          }
                        }}
                        className={`p-3 hover:bg-[#F9FAFB] transition space-y-0.5 ${
                          n.href ? "cursor-pointer" : ""
                        } ${n.isDiscount ? "bg-amber-50/60" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-[#18181B] text-xs flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                n.isDiscount ? "bg-amber-500 animate-pulse" : "bg-[#0D7A5F]"
                              }`}
                            />
                            {n.title}
                          </p>
                          <span className="text-[10px] text-[#71717A] font-mono">{n.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-[#52525B] pl-3 leading-relaxed">
                          {n.message}
                        </p>
                        {n.isDiscount && (
                          <span className="inline-block ml-3 mt-1 text-[10px] font-bold text-[#0D7A5F] hover:underline">
                            Review & Approve in Accounts →
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-[#27272A] mx-1" />

          {/* Logged-in User Profile & Full Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="User account and role selector"
              aria-expanded={isUserMenuOpen}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#27272A] transition text-left focus-visible:outline-none"
            >
              <div className={`w-7 h-7 rounded-full ${currentPersona.badgeColor} flex items-center justify-center text-xs font-bold shrink-0 shadow-xs`}>
                {currentPersona.avatar}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-[#E4E4E7] leading-none">
                  {currentPersona.name}
                </p>
                <p className="text-[10px] text-emerald-400 font-medium leading-none mt-1">
                  {currentPersona.designation}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA]" />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-72 py-2 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                  <div className="px-3 pb-2.5 border-b border-[#EDEDED]">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md ${currentPersona.badgeColor} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                        {currentPersona.avatar}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-[#18181B] truncate">{currentPersona.name}</p>
                        <p className="text-[10px] text-[#71717A] truncate">{currentPersona.email}</p>
                      </div>
                    </div>
                    <span className="inline-block mt-1.5 text-[10px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                      {currentPersona.department} • {currentPersona.designation}
                    </span>
                  </div>

                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A] mt-1 bg-[#F4F4F5]">
                    Simulate Usable ERP Roles
                  </div>

                  {availablePersonas
                    .filter((p) => p.role !== "technician")
                    .map((p) => {
                      const isCurrent = activeRole === p.role;
                      return (
                        <button
                          key={p.role}
                          onClick={() => {
                            setRole(p.role as RoleType);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-[#F4F4F5] flex items-center justify-between transition ${
                            isCurrent ? "bg-emerald-50/60 font-semibold" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${p.badgeColor}`}>
                              {p.avatar}
                            </div>
                            <div className="overflow-hidden">
                              <span className="block text-xs text-[#18181B] truncate">{p.name}</span>
                              <span className="block text-[10px] text-[#71717A] truncate">{p.designation}</span>
                            </div>
                          </div>
                          {isCurrent && (
                            <CheckCircle2 className="w-4 h-4 text-[#0D7A5F] shrink-0" />
                          )}
                        </button>
                      );
                    })}

                  <div className="border-t border-[#EDEDED] mt-1 pt-1.5 px-1.5 space-y-1">
                    <Link
                      href="/mobile"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full text-left px-2.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] font-bold flex items-center justify-between transition"
                    >
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        <span>Field Companion (New Tab)</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    </Link>

                    <Link
                      href="/audit"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full text-left px-2.5 py-2 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold flex items-center justify-between transition text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                        <span>Audit & Rollback Hub</span>
                      </span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded">
                        Live
                      </span>
                    </Link>

                    <p className="text-[10px] text-[#71717A] px-2.5 py-1">
                      Full mutation rollbacks & real-time omni-click telemetry audit logs.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Universal Search ("Find or Ask") Command Palette Modal */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Universal search"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#EDEDED] overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="p-3.5 border-b border-[#EDEDED] flex items-center gap-2.5">
              <Search className="w-4 h-4 text-[#71717A]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find jobs, customers, technicians, invoices, SKUs..."
                className="flex-1 bg-transparent text-xs text-[#18181B] focus:outline-none placeholder-[#71717A]"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[#71717A] hover:text-[#18181B]"
                  aria-label="Clear search input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[10px] text-[#71717A] bg-[#F4F4F5] px-1.5 py-0.5 rounded font-mono">
                ESC to close
              </span>
            </div>

            {/* Results list */}
            <div className="max-h-80 overflow-y-auto p-2">
              {isSearching ? (
                <div className="p-8 text-center text-xs text-[#71717A]">
                  Searching database...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-[#F4F4F5] transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              item.type === "Job"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-blue-50 text-blue-800"
                            }`}
                          >
                            {item.type}
                          </span>
                          <span className="text-xs font-semibold text-[#18181B] group-hover:text-[#0D7A5F] transition">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#71717A] mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                      <span className="text-xs text-[#71717A] font-mono group-hover:translate-x-0.5 transition">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="p-8 text-center text-xs text-[#71717A]">
                  No matching jobs, customers, or technicians found for "{searchQuery}".
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#71717A] space-y-2">
                  <p className="font-semibold text-[#18181B]">Universal HVAC Query</p>
                  <p>Type a work order number (e.g. WO-), customer name, or technician phone number.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Real-time Event Toast in Desktop ERP */}
      {liveRealtimeToast &&
        liveRealtimeToast.title !== "System" &&
        !liveRealtimeToast.title?.toLowerCase().includes("system") &&
        !liveRealtimeToast.message?.toLowerCase().includes("audit") &&
        !liveRealtimeToast.message?.toLowerCase().includes("sync event") && (
        <div className="fixed top-16 right-6 z-50 max-w-sm bg-[#18181B] text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 animate-in slide-in-from-top-3 duration-300 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-400 truncate">
                {liveRealtimeToast.title}
              </span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-800/60">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
              {liveRealtimeToast.message}
            </p>
          </div>
          <button
            onClick={() => setLiveRealtimeToast(null)}
            className="text-zinc-400 hover:text-white p-1 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
