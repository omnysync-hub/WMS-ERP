"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
};

type ToastEventDetail = {
  message: string;
  tone?: ToastTone;
  duration?: number;
};

const toneStyles: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-zinc-200 bg-white text-zinc-950",
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ message, tone = "info", duration = 5000 }: ToastEventDetail) => {
      const cleanMessage = String(message ?? "").trim();
      if (!cleanMessage) return;

      const id = ++nextId.current;
      setToasts((current) => [
        ...current.slice(-3),
        { id, message: cleanMessage, tone, duration },
      ]);

      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss]
  );

  useEffect(() => {
    const originalAlert = window.alert;
    const activeTimers = timers.current;
    const onToast = (event: Event) => {
      show((event as CustomEvent<ToastEventDetail>).detail);
    };

    window.alert = (message?: unknown) => {
      const text = String(message ?? "");
      const looksLikeError = /error|failed|cannot|invalid|required|blocked|exceed|unbalanced/i.test(text);
      show({ message: text, tone: looksLikeError ? "error" : "info" });
    };
    window.addEventListener("workman:toast", onToast);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener("workman:toast", onToast);
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, [show]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = toneIcons[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3.5 shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-200",
              toneStyles[toast.tone]
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
