"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Bell,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastTone, ToastAction, ToastItem, ToastEventDetail, playToastSound } from "@/lib/toast";

interface ActiveToast extends ToastItem {
  progress: number;
  isPaused: boolean;
  timerStartedAt: number;
  remainingTime: number;
}

const toneStyles: Record<
  ToastTone,
  {
    container: string;
    iconBg: string;
    iconText: string;
    tagBg: string;
    progressBg: string;
    defaultTitle: string;
  }
> = {
  success: {
    container: "border-emerald-500/40 bg-[#0E1B15]/95 text-white shadow-emerald-950/40",
    iconBg: "bg-emerald-500/20 border-emerald-500/40",
    iconText: "text-emerald-400",
    tagBg: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
    progressBg: "bg-emerald-500",
    defaultTitle: "Success",
  },
  error: {
    container: "border-rose-500/40 bg-[#1F0E13]/95 text-white shadow-rose-950/40",
    iconBg: "bg-rose-500/20 border-rose-500/40",
    iconText: "text-rose-400",
    tagBg: "bg-rose-950/80 text-rose-300 border-rose-800/60",
    progressBg: "bg-rose-500",
    defaultTitle: "Action Failed",
  },
  warning: {
    container: "border-amber-500/40 bg-[#1F170C]/95 text-white shadow-amber-950/40",
    iconBg: "bg-amber-500/20 border-amber-500/40",
    iconText: "text-amber-400",
    tagBg: "bg-amber-950/80 text-amber-300 border-amber-800/60",
    progressBg: "bg-amber-500",
    defaultTitle: "Attention Required",
  },
  info: {
    container: "border-sky-500/40 bg-[#0E1624]/95 text-white shadow-sky-950/40",
    iconBg: "bg-sky-500/20 border-sky-500/40",
    iconText: "text-sky-400",
    tagBg: "bg-sky-950/80 text-sky-300 border-sky-800/60",
    progressBg: "bg-sky-500",
    defaultTitle: "Information",
  },
  notification: {
    container: "border-emerald-500/50 bg-[#141518]/95 text-white shadow-black/60",
    iconBg: "bg-emerald-500/20 border-emerald-500/50",
    iconText: "text-emerald-300",
    tagBg: "bg-emerald-950/90 text-emerald-300 border-emerald-700/80",
    progressBg: "bg-emerald-400",
    defaultTitle: "Notification",
  },
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  notification: Bell,
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const timeoutsRef = useRef<Map<string | number, ReturnType<typeof setTimeout>>>(new Map());
  const animationFramesRef = useRef<Map<string | number, number>>(new Map());
  const seenNoticeIdsRef = useRef<Set<string>>(new Set());

  // Dismiss a specific toast
  const dismiss = useCallback((id: string | number) => {
    // Clear timeouts
    const timer = timeoutsRef.current.get(id);
    if (timer) clearTimeout(timer);
    timeoutsRef.current.delete(id);

    // Clear RAF
    const raf = animationFramesRef.current.get(id);
    if (raf) cancelAnimationFrame(raf);
    animationFramesRef.current.delete(id);

    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // Dismiss all toasts
  const dismissAll = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
    animationFramesRef.current.forEach(cancelAnimationFrame);
    animationFramesRef.current.clear();
    setToasts([]);
  }, []);

  // Add / display toast
  const showToast = useCallback(
    ({
      id: rawId,
      message,
      title,
      tone = "info",
      duration = 4500,
      sound = true,
      action,
    }: ToastEventDetail) => {
      const cleanMessage = String(message ?? "").trim();
      if (!cleanMessage) return;

      const id = rawId ?? `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Play audio chime if enabled
      if (sound) {
        playToastSound(tone);
      }

      const newToast: ActiveToast = {
        id,
        message: cleanMessage,
        title: title || toneStyles[tone]?.defaultTitle || "Notice",
        tone,
        duration,
        sound,
        action,
        createdAt: Date.now(),
        progress: 100,
        isPaused: false,
        timerStartedAt: Date.now(),
        remainingTime: duration,
      };

      setToasts((current) => {
        // Prevent duplicate toasts with identical id or message within 1 second
        const filtered = current.filter((t) => t.id !== id);
        // Keep maximum of 5 concurrent toasts
        return [...filtered.slice(-4), newToast];
      });

      // Progress bar animation loop
      const startAt = Date.now();
      const updateProgress = () => {
        setToasts((current) => {
          return current.map((t) => {
            if (t.id !== id || t.isPaused) return t;
            const elapsed = Date.now() - t.timerStartedAt;
            const remaining = Math.max(0, t.remainingTime - elapsed);
            const progress = (remaining / t.duration) * 100;
            return { ...t, progress };
          });
        });

        if (Date.now() - startAt < duration) {
          const raf = requestAnimationFrame(updateProgress);
          animationFramesRef.current.set(id, raf);
        }
      };

      const raf = requestAnimationFrame(updateProgress);
      animationFramesRef.current.set(id, raf);

      // Auto dismiss timer
      const timeout = setTimeout(() => {
        dismiss(id);
      }, duration);
      timeoutsRef.current.set(id, timeout);
    },
    [dismiss]
  );

  // Pause on hover
  const handleMouseEnter = useCallback((id: string | number) => {
    // Clear auto-dismiss timer while hovering
    const timer = timeoutsRef.current.get(id);
    if (timer) clearTimeout(timer);

    setToasts((current) =>
      current.map((t) => {
        if (t.id !== id) return t;
        const elapsed = Date.now() - t.timerStartedAt;
        const remainingTime = Math.max(0, t.remainingTime - elapsed);
        return { ...t, isPaused: true, remainingTime };
      })
    );
  }, []);

  // Resume on hover leave
  const handleMouseLeave = useCallback(
    (id: string | number) => {
      setToasts((current) =>
        current.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            isPaused: false,
            timerStartedAt: Date.now(),
          };
        })
      );

      // Reset timer with remaining duration
      setToasts((current) => {
        const item = current.find((t) => t.id === id);
        if (item) {
          const remaining = Math.max(1000, item.remainingTime);
          const timeout = setTimeout(() => {
            dismiss(id);
          }, remaining);
          timeoutsRef.current.set(id, timeout);
        }
        return current;
      });
    },
    [dismiss]
  );

  // Global listeners for workman:toast, window.alert, admin_notification_update
  useEffect(() => {
    const originalAlert = window.alert;

    // 1. Intercept custom event "workman:toast"
    const onToastEvent = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (detail) {
        showToast(detail);
      }
    };

    // 2. Intercept dismiss event "workman:toast:dismiss"
    const onDismissEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string | number }>).detail;
      if (detail?.id) {
        dismiss(detail.id);
      } else {
        dismissAll();
      }
    };

    // 3. Intercept native window.alert and convert to styled rich toast
    window.alert = (message?: unknown) => {
      const text = String(message ?? "").trim();
      if (!text) return;

      const isSuccess =
        /success|done|completed|saved|created|added|updated|approved|authorized|posted|verified|settled|dispatched/i.test(
          text
        );
      const isError =
        /error|failed|failure|cannot|invalid|required|blocked|exceed|unbalanced|unauthorized|denied|missing|reject/i.test(
          text
        );
      const isWarning = /warning|warn|caution|attention|pending|confirm|review|notice/i.test(text);

      let tone: ToastTone = "info";
      let title = "Notice";

      if (isSuccess && !isError) {
        tone = "success";
        title = "Action Succeeded";
      } else if (isError) {
        tone = "error";
        title = "Action Alert";
      } else if (isWarning) {
        tone = "warning";
        title = "Attention";
      }

      showToast({ message: text, tone, title });
    };

    // 4. Intercept admin_notification_update to pop toast for real-time admin notices
    const onAdminNoticeUpdate = () => {
      try {
        const raw = localStorage.getItem("admin_notifications");
        if (!raw) return;
        const notices = JSON.parse(raw);
        if (Array.isArray(notices) && notices.length > 0) {
          const newest = notices[0];
          if (
            newest &&
            newest.id &&
            !seenNoticeIdsRef.current.has(newest.id) &&
            newest.title !== "System" &&
            !newest.title?.toLowerCase().includes("system")
          ) {
            seenNoticeIdsRef.current.add(newest.id);
            showToast({
              id: newest.id,
              title: newest.title || "New Notification",
              message: newest.message || "You have a new operational notice.",
              tone: "notification",
              duration: 6500,
              action: newest.href
                ? {
                    label: "View",
                    href: newest.href,
                  }
                : undefined,
            });
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("workman:toast", onToastEvent);
    window.addEventListener("workman:toast:dismiss", onDismissEvent);
    window.addEventListener("admin_notification_update", onAdminNoticeUpdate);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener("workman:toast", onToastEvent);
      window.removeEventListener("workman:toast:dismiss", onDismissEvent);
      window.removeEventListener("admin_notification_update", onAdminNoticeUpdate);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
      animationFramesRef.current.forEach(cancelAnimationFrame);
      animationFramesRef.current.clear();
    };
  }, [showToast, dismiss, dismissAll]);

  if (toasts.length === 0) return null;

  return (
    <aside
      className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[99999] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2.5 pointer-events-none"
      aria-label="Notifications and alerts"
      aria-live="polite"
    >
      {toasts.map((item) => {
        const style = toneStyles[item.tone] || toneStyles.info;
        const Icon = toneIcons[item.tone] || Info;

        return (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            onMouseEnter={() => handleMouseEnter(item.id)}
            onMouseLeave={() => handleMouseLeave(item.id)}
            className={cn(
              "pointer-events-auto relative flex flex-col overflow-hidden rounded-2xl border p-3.5 backdrop-blur-md shadow-2xl transition-all duration-300 animate-toast-in",
              style.container
            )}
          >
            {/* Top row: Icon, Title, Badge, Time, Dismiss button */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                  style.iconBg,
                  style.iconText
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    item.tone === "notification" && "animate-bounce"
                  )}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-xs font-bold tracking-tight text-white">
                    {item.title}
                  </h4>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border",
                      style.tagBg
                    )}
                  >
                    {item.tone === "notification" ? "LIVE" : item.tone}
                  </span>
                </div>

                <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-200 break-words">
                  {item.message}
                </p>

                {/* Optional Action Button */}
                {item.action && (
                  <div className="mt-2.5 flex items-center gap-2">
                    {item.action.href ? (
                      <Link
                        href={item.action.href}
                        onClick={() => dismiss(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 text-[11px] font-semibold transition border border-white/15"
                      >
                        <span>{item.action.label}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : item.action.onClick ? (
                      <button
                        type="button"
                        onClick={() => {
                          item.action?.onClick?.();
                          dismiss(item.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 text-[11px] font-semibold transition border border-white/15"
                      >
                        {item.action.label}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition shrink-0"
                aria-label="Dismiss toast"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
              <div
                className={cn("h-full transition-all duration-75 ease-linear", style.progressBg)}
                style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
              />
            </div>
          </div>
        );
      })}
    </aside>
  );
}
