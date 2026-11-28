"use client";

/**
 * RealtimeRequestWatcher — server-side arrival alerts for decision queues.
 *
 * The same-browser realtimeSync bus only hears events published from this
 * browser, so a discount or stock request filed from a phone never reaches
 * an already-open desktop tab. This watcher closes that gap by polling the
 * real queues every ~25s (and immediately when the tab becomes visible):
 *
 *   - Discount requests: GET /api/accounts?view=discounts (the Accounts
 *     Discount Approvals feed; per-item ids + requester detail). That view
 *     is gated on accounts.general_ledger, so when it is not readable the
 *     watcher falls back to the count on GET /api/notifications'
 *     `notice-discounts` entry (which the server itself scopes to
 *     jobs.approve_discount holders) and announces count increases.
 *   - Stock requests: GET /api/inventory?view=requests — the exact feed the
 *     inventory page's Storekeeper Queue renders; pending = status
 *     "pending" (case-insensitive, matching the queue's own handling).
 *
 * Only users holding the approval permissions are alerted:
 *   discounts → jobs.approve_discount
 *   stock     → inventory.storekeeper_queue OR jobs.issue_stock
 * (mirrors the Storekeeper Queue gate in src/app/inventory/page.tsx).
 *
 * New arrivals (ids never seen before; persisted in localStorage
 * `wms_seen_alert_ids`, capped at 500) trigger the LOUD alert cue, a spoken
 * announcement, and a persistent toast linking to the queue. The first
 * successful poll per source only establishes the baseline — the existing
 * backlog is summarised in ONE quiet toast, never spoken. Muting (Topbar
 * speaker toggle) suppresses sound + speech; the toast always shows.
 */

import { useEffect, useRef } from "react";
import { useRole } from "@/contexts/RoleContext";
import { notify } from "@/lib/notify";
import { playAlertCue, speakAlert } from "@/lib/soundAlerts";

const SEEN_KEY = "wms_seen_alert_ids";
const MAX_SEEN = 500;
const POLL_MS = 25_000;
/** Alert toasts stay until dismissed (10 minutes is the viewport's cap behaviour). */
const ALERT_TOAST_MS = 10 * 60_000;
const MAX_INDIVIDUAL_TOASTS = 3;

const DISCOUNT_QUEUE_LINK = "/accounts?tab=discounts";
const STOCK_QUEUE_LINK = "/inventory";

function loadSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveSeen(ids: string[]): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-MAX_SEEN)));
  } catch {
    // Storage unavailable — in-memory dedupe still applies for this session.
  }
}

function money(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `PKR ${n.toLocaleString("en-PK")}`;
}

interface PendingItem {
  seenId: string;
  toastTitle: string;
  toastMessage: string;
  spokenDetail: string | null;
}

export default function RealtimeRequestWatcher() {
  const { hasPermission } = useRole();

  const canDiscountsRef = useRef(false);
  const canStockRef = useRef(false);
  canDiscountsRef.current = hasPermission("jobs.approve_discount");
  canStockRef.current =
    hasPermission("inventory.storekeeper_queue") || hasPermission("jobs.issue_stock");

  const seenRef = useRef<Set<string> | null>(null);
  const baselinedRef = useRef({ discounts: false, stock: false });
  const lastDiscountCountRef = useRef<number | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(loadSeen());
    }
    const seen = seenRef.current;

    const remember = (ids: string[]) => {
      let changed = false;
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          changed = true;
        }
      }
      if (changed) saveSeen(Array.from(seen));
    };

    const announce = (
      kind: "discount" | "stock",
      fresh: PendingItem[],
      singleSpoken: string,
      multiSpoken: (count: number) => string,
      actionLabel: string,
      link: string
    ) => {
      if (fresh.length === 0) return;
      // One loud cue + one spoken announcement per poll cycle per queue.
      playAlertCue();
      speakAlert(fresh.length === 1 ? singleSpoken : multiSpoken(fresh.length));
      const shown = fresh.slice(0, MAX_INDIVIDUAL_TOASTS);
      for (const item of shown) {
        notify.notification(item.toastTitle, item.toastMessage, {
          duration: ALERT_TOAST_MS,
          sound: false, // the alert cue above is this toast's sound
          action: { label: actionLabel, href: link },
        });
      }
      if (fresh.length > shown.length) {
        notify.notification(
          kind === "discount" ? "More Discount Requests" : "More Stock Requests",
          `${fresh.length - shown.length} more new request(s) arrived in the same batch.`,
          {
            duration: ALERT_TOAST_MS,
            sound: false,
            action: { label: actionLabel, href: link },
          }
        );
      }
    };

    const pollDiscountsByCount = async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const notice = (Array.isArray(data?.notifications) ? data.notifications : []).find(
        (n: any) => n?.id === "notice-discounts"
      );
      const match = notice ? String(notice.message || "").match(/^(\d+)/) : null;
      const count = match ? parseInt(match[1], 10) : 0;

      if (lastDiscountCountRef.current === null) {
        lastDiscountCountRef.current = count;
        baselinedRef.current.discounts = true;
        if (count > 0) {
          notify.notification(
            "Discount Requests Waiting",
            `${count} discount request(s) already awaiting your approval.`,
            {
              sound: false,
              duration: 9000,
              action: { label: "Review Discounts", href: DISCOUNT_QUEUE_LINK },
            }
          );
        }
        return;
      }

      const delta = count - lastDiscountCountRef.current;
      lastDiscountCountRef.current = count;
      if (delta > 0) {
        announce(
          "discount",
          Array.from({ length: delta }, (_, i) => ({
            seenId: `discount-count-${Date.now()}-${i}`,
            toastTitle: "Discount Request Received",
            toastMessage: "A new discount request is awaiting your approval.",
            spokenDetail: null,
          })),
          "Attention. New discount request awaiting your approval.",
          (n) => `Attention. ${n} new discount requests awaiting your approval.`,
          "Review Discounts",
          DISCOUNT_QUEUE_LINK
        );
      }
    };

    const pollDiscounts = async () => {
      let items: any[] | null = null;
      try {
        const res = await fetch("/api/accounts?view=discounts");
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data?.discounts)) items = data.discounts;
        }
      } catch {
        items = null;
      }

      if (items === null) {
        // Per-item feed not readable for this role — use the server-scoped count.
        await pollDiscountsByCount();
        return;
      }

      const pending: PendingItem[] = items.map((d: any) => {
        const seenId = `discount:${d.requestId ?? `${d.jobId ?? "?"}:${d.itemId ?? "job"}`}`;
        const amount = money(d.requestedDiscount);
        const parts = [
          d.technicianName ? `${d.technicianName} requested` : "A discount was requested",
          amount ? `a discount of ${amount}` : "a discount",
          d.jobNumber ? `on job ${d.jobNumber}` : null,
          d.customerName ? `(${d.customerName})` : null,
        ].filter(Boolean);
        return {
          seenId,
          toastTitle: "Discount Request Received",
          toastMessage: `${parts.join(" ")}.`,
          spokenDetail:
            d.technicianName && d.jobNumber
              ? `Requested by ${d.technicianName} on job ${d.jobNumber}.`
              : d.jobNumber
                ? `For job ${d.jobNumber}.`
                : null,
        };
      });

      if (!baselinedRef.current.discounts) {
        baselinedRef.current.discounts = true;
        lastDiscountCountRef.current = pending.length;
        remember(pending.map((p) => p.seenId));
        if (pending.length > 0) {
          notify.notification(
            "Discount Requests Waiting",
            `${pending.length} discount request(s) already awaiting your approval.`,
            {
              sound: false,
              duration: 9000,
              action: { label: "Review Discounts", href: DISCOUNT_QUEUE_LINK },
            }
          );
        }
        return;
      }

      const fresh = pending.filter((p) => !seen.has(p.seenId));
      remember(pending.map((p) => p.seenId));
      lastDiscountCountRef.current = pending.length;
      if (fresh.length > 0) {
        announce(
          "discount",
          fresh,
          `Attention. New discount request awaiting your approval.${fresh[0].spokenDetail ? ` ${fresh[0].spokenDetail}` : ""}`,
          (n) => `Attention. ${n} new discount requests awaiting your approval.`,
          "Review Discounts",
          DISCOUNT_QUEUE_LINK
        );
      }
    };

    const pollStock = async () => {
      const res = await fetch("/api/inventory?view=requests");
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!Array.isArray(data)) return;

      const pending: PendingItem[] = data
        .filter((r: any) => String(r?.status || "").toLowerCase() === "pending")
        .map((r: any) => {
          const jobNumber = r.job?.jobNumber ? String(r.job.jobNumber) : null;
          const customerName = r.job?.customer?.name ? String(r.job.customer.name) : null;
          const itemText = r.item ? String(r.item) : "Materials";
          const qty = Number(r.qtyRequested);
          const qtyText = Number.isFinite(qty) && qty > 0 ? ` × ${qty}` : "";
          return {
            seenId: `stock:${r.id}`,
            toastTitle: "Stock Request Received",
            toastMessage: `${itemText}${qtyText} requested${jobNumber ? ` for job ${jobNumber}` : ""}${customerName ? ` (${customerName})` : ""}.`,
            spokenDetail: jobNumber ? `For job ${jobNumber}: ${itemText}.` : `Item: ${itemText}.`,
          };
        });

      if (!baselinedRef.current.stock) {
        baselinedRef.current.stock = true;
        remember(pending.map((p) => p.seenId));
        if (pending.length > 0) {
          notify.notification(
            "Stock Requests Waiting",
            `${pending.length} stock request(s) already in the store queue.`,
            {
              sound: false,
              duration: 9000,
              action: { label: "Open Store Queue", href: STOCK_QUEUE_LINK },
            }
          );
        }
        return;
      }

      const fresh = pending.filter((p) => !seen.has(p.seenId));
      remember(pending.map((p) => p.seenId));
      if (fresh.length > 0) {
        announce(
          "stock",
          fresh,
          `Attention. New stock request in the store queue.${fresh[0].spokenDetail ? ` ${fresh[0].spokenDetail}` : ""}`,
          (n) => `Attention. ${n} new stock requests in the store queue.`,
          "Open Store Queue",
          STOCK_QUEUE_LINK
        );
      }
    };

    const poll = async () => {
      if (pollingRef.current) return;
      if (!canDiscountsRef.current && !canStockRef.current) return;
      pollingRef.current = true;
      try {
        if (canDiscountsRef.current) await pollDiscounts();
        if (canStockRef.current) await pollStock();
      } catch {
        // Best-effort watcher — a failed poll retries on the next cycle.
      } finally {
        pollingRef.current = false;
      }
    };

    poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
