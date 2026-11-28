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
  Menu,
  LogOut,
  Volume2,
  VolumeX,
  CheckCheck,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { realtimeSync } from "@/lib/realtimeSync";
import { formatJobType } from "@/lib/utils";
import { formatPktDateTime } from "@/lib/pktTime";
import toast from "@/lib/toast";
import { notify } from "@/lib/notify";
import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
  playSuccessCue,
} from "@/lib/soundAlerts";

interface TopbarProps {
  onOpenNavigation?: () => void;
  onOpenCustomerDrawer?: () => void;
  onOpenTechnicianDrawer?: () => void;
  onOpenExpenseDrawer?: () => void;
}

export default function Topbar({
  onOpenNavigation,
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
  const { activeRole, currentPersona, activeUser } = useRole();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Notifications Popover state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Master sound-alerts switch (persisted as `wms_sound_alerts`, default ON).
  // Muting silences toast cues, urgent chimes and spoken announcements —
  // visual toasts and the bell are unaffected.
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    setSoundOn(isSoundEnabled());
    return subscribeSoundEnabled(setSoundOn);
  }, []);
  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) playSuccessCue(); // the click is a user gesture, so this can play
  };

  // Popup discipline for the bell feed: the first successful poll baselines
  // silently (existing unread items get ONE quiet summary toast, never a
  // storm); later polls pop a soft toast per genuinely new unread item.
  // "New" is keyed on id + content signature (an aggregate notice whose
  // count grows past what was seen counts as new again), persisted in
  // localStorage so a reload never re-pops what this browser already showed.
  const bellBaselinedRef = useRef(false);
  const bellSeenRef = useRef<Set<string> | null>(null);
  const BELL_SEEN_KEY = "wms_seen_bell_popups";
  const MAX_BELL_SEEN = 500;
  const MAX_BELL_POPUPS = 3;

  const persistBellSeen = () => {
    try {
      window.localStorage.setItem(
        BELL_SEEN_KEY,
        JSON.stringify(Array.from(bellSeenRef.current ?? []).slice(-MAX_BELL_SEEN))
      );
    } catch {
      // Storage unavailable — in-memory dedupe still applies for this session.
    }
  };

  // Mark-as-read: optimistic local flip, then the server records it (it only
  // ever marks items in the caller's own permission-scoped feed).
  const markNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    if (id.startsWith("notice-") || id.startsWith("device-login-")) {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", id }),
        });
      } catch {
        // Best-effort — the next poll re-syncs the server's read state.
      }
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch {
      // Best-effort — the next poll re-syncs the server's read state.
    }
  };

  useEffect(() => {
    if (bellSeenRef.current === null) {
      try {
        const raw = window.localStorage.getItem(BELL_SEEN_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        bellSeenRef.current = new Set(
          Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []
        );
      } catch {
        bellSeenRef.current = new Set();
      }
    }
    const seen = bellSeenRef.current;

    // The whole bell feed — office notices AND blocked-device alerts — comes
    // from GET /api/notifications, which scopes every item server-side by the
    // caller's permissions (device alerts ride along only for audit.view_logs
    // holders) and returns each item's per-user read state. Refreshed on a
    // 60s poll; each refresh replaces the previous server-sourced entries
    // (ids prefixed "notice-" / "device-login-") so nothing goes stale or
    // duplicates, while same-browser realtime events are preserved.
    const isServerItem = (id: unknown) =>
      typeof id === "string" && (id.startsWith("notice-") || id.startsWith("device-login-"));

    const loadServerNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        const notices = (Array.isArray(data.notifications) ? data.notifications : []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          timestamp: n.createdAt ? formatPktDateTime(n.createdAt) : "Active now",
          unread: !n.read,
          signature: typeof n.signature === "string" ? n.signature : "",
          href: n.link,
          isDiscount: n.id === "notice-discounts",
        }));

        // Popup toasts for NEW unread items (soft notification cue via the
        // toast bus — the loud siren/voice stays with RealtimeRequestWatcher).
        const unreadItems = notices.filter((n: any) => n.unread);
        const keyOf = (n: any) => `${n.id}@${n.signature}`;
        if (!bellBaselinedRef.current) {
          bellBaselinedRef.current = true;
          unreadItems.forEach((n: any) => seen.add(keyOf(n)));
          persistBellSeen();
          const unreadCount =
            typeof data.unreadCount === "number" ? data.unreadCount : unreadItems.length;
          if (unreadCount > 0) {
            notify.notification(
              "Field Activity & Alerts",
              `${unreadCount} unread update(s) waiting in the bell.`,
              { sound: false, duration: 6000 }
            );
          }
        } else {
          const fresh = unreadItems.filter((n: any) => !seen.has(keyOf(n)));
          unreadItems.forEach((n: any) => seen.add(keyOf(n)));
          persistBellSeen();
          const shown = fresh.slice(0, MAX_BELL_POPUPS);
          for (const item of shown) {
            notify.notification(item.title, item.message, {
              duration: 6500,
              action: item.href ? { label: "View", href: item.href } : undefined,
            });
          }
          if (fresh.length > shown.length) {
            notify.notification(
              "More updates",
              `${fresh.length - shown.length} more new update(s) in Field Activity & Alerts.`,
              { duration: 6000 }
            );
          }
        }

        setNotifications((prev) => [
          ...notices,
          ...prev.filter((n) => !isServerItem(n.id)),
        ]);
      } catch {
        // Best-effort: a failed fetch leaves the last known notices in place.
      }
    };

    loadServerNotifications();
    const noticesTimer = window.setInterval(loadServerNotifications, 60_000);
    return () => {
      window.clearInterval(noticesTimer);
    };
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
      toast.notification(newNotice.title, evt.message, {
        id: evt.id,
        duration: 6500,
        action: evt.jobId
          ? {
              label: "View Job",
              href: `/jobs/${evt.jobId}`,
            }
          : undefined,
      });
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
              subtitle: `${formatJobType(j.jobType)} • Status: ${j.status}`,
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
      <header className="h-14 bg-[#18181B] px-2.5 sm:px-5 flex items-center justify-between z-20 shrink-0 select-none">
        {/* Left: Universal Search ("Find or Ask") & Global "+" Quick-Create */}
        <div className="flex items-center gap-2.5 flex-1 max-w-xl">
          <button
            type="button"
            onClick={onOpenNavigation}
            className="lg:hidden grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#D4D4D8] transition hover:bg-[#27272A] hover:text-white"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          {/* Pill-Shaped Universal Search Field */}
          <div className="relative w-full max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] pointer-events-none" />
            <input
              type="text"
              readOnly
              onClick={() => setIsSearchOpen(true)}
              placeholder="Find jobs, customers, techs..."
              aria-label="Universal search"
              className="w-full bg-[#27272A] hover:bg-[#2E2E32] pl-9.5 pr-12 py-1.5 rounded-full text-xs text-[#E4E4E7] placeholder-[#A1A1AA] border border-[#3F3F46]/70 focus:border-[#0D7A5F] cursor-pointer transition focus:outline-none"
            />
            <span className="hidden sm:inline absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-[#3F3F46] text-[#D4D4D8] px-1.5 py-0.5 rounded font-mono border border-[#52525B]">
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
          {/* Sound Alerts Master Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundOn ? "Sound alerts ON — click to mute" : "Sound alerts OFF — click to unmute"}
            aria-label={soundOn ? "Mute sound alerts" : "Unmute sound alerts"}
            aria-pressed={soundOn}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] rounded-lg transition focus-visible:outline-none"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

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
                  <div className="px-3 pb-2 border-b border-[#EDEDED] flex items-center justify-between gap-2">
                    <span className="font-bold text-[#18181B] text-xs">Field Activity & Alerts</span>
                    <span className="flex items-center gap-1.5">
                      {notifications.some((n) => n.unread) && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-[10px] font-semibold text-[#0D7A5F] hover:bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                      <span className="text-[10px] text-[#0D7A5F] font-semibold bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                        {notifications.filter((n) => n.unread).length > 0
                          ? `${notifications.filter((n) => n.unread).length} unread`
                          : `${notifications.length} updates`}
                      </span>
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#EDEDED]">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.unread) void markNotificationRead(n.id);
                          if (n.href) {
                            router.push(n.href);
                            setIsNotificationsOpen(false);
                          }
                        }}
                        className={`p-3 hover:bg-[#F9FAFB] transition space-y-0.5 ${
                          n.href ? "cursor-pointer" : ""
                        } ${n.isDiscount ? "bg-amber-50/60" : ""} ${
                          n.unread ? "bg-emerald-50/40" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-xs flex items-center gap-1.5 ${
                              n.unread
                                ? "font-bold text-[#18181B]"
                                : "font-semibold text-[#71717A]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                !n.unread
                                  ? "bg-[#D4D4D8]"
                                  : n.isDiscount
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-[#0D7A5F]"
                              }`}
                            />
                            {n.title}
                          </p>
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#71717A] font-mono">{n.timestamp}</span>
                            {n.unread && (
                              <button
                                type="button"
                                title="Mark as read"
                                aria-label={`Mark "${n.title}" as read`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void markNotificationRead(n.id);
                                }}
                                className="text-[10px] font-semibold text-[#0D7A5F] hover:underline"
                              >
                                Mark read
                              </button>
                            )}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] pl-3 leading-relaxed ${
                            n.unread ? "text-[#52525B]" : "text-[#A1A1AA]"
                          }`}
                        >
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

          {/* Logged-in user profile */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="User account menu"
              aria-expanded={isUserMenuOpen}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#27272A] transition text-left focus-visible:outline-none"
            >
              <div className={`w-7 h-7 rounded-full ${currentPersona.badgeColor} flex items-center justify-center text-xs font-bold shrink-0 shadow-xs`}>
                  {activeUser.avatar || activeUser.username?.slice(0, 2).toUpperCase() || currentPersona.avatar}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-[#E4E4E7] leading-none">
                  {activeUser.name || activeUser.username || currentPersona.name}
                </p>
                <p className="text-[10px] text-emerald-400 font-medium leading-none mt-1">
                  {activeUser.designation || currentPersona.designation}
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
                        {activeUser.avatar || activeUser.username?.slice(0, 2).toUpperCase() || currentPersona.avatar}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-[#18181B] truncate">{activeUser.name || activeUser.username || currentPersona.name}</p>
                        <p className="text-[10px] text-[#71717A] truncate">{activeUser.email}</p>
                      </div>
                    </div>
                    <span className="inline-block mt-1.5 text-[10px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                      {activeUser.department} • {activeRole.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="border-t border-[#EDEDED] mt-1 pt-1.5 px-1.5 space-y-1">
                    <Link
                      href="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#F4F4F5] text-[#18181B] font-semibold flex items-center justify-between transition text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#0D7A5F]" />
                        <span>My Profile & Assets</span>
                      </span>
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
                      Full mutation rollbacks & transaction audit logs.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                        window.location.assign("/login");
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold flex items-center gap-2 transition text-xs"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
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
    </>
  );
}
