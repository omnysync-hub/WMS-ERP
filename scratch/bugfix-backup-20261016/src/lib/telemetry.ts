"use client";

import { ERP_PERSONAS, RoleType } from "@/contexts/RoleContext";

export interface LogActivityPayload {
  action: string;
  target: string;
  category?: "UI_CLICK" | "NAVIGATION" | "ROLE_SWITCH" | "DATA_MUTATION" | "SEARCH" | "MOBILE_APP";
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  metadata?: Record<string, any>;
}

// In-memory queue with batching for high performance
let clickQueue: LogActivityPayload[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

export async function flushTelemetryQueue() {
  if (clickQueue.length === 0) return;
  const toSend = [...clickQueue];
  clickQueue = [];

  for (const item of toSend) {
    try {
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_activity",
          activity: item,
        }),
      });
    } catch {
      // Silent catch to prevent UI disruption
    }
  }

  // Dispatch silent local event for Audit Hub if active, without broadcasting noisy cross-tab notifications
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("audit_telemetry_batch", { detail: { count: toSend.length } }));
  }
}

export function logActivity(payload: LogActivityPayload) {
  if (typeof window === "undefined") return;

  // Derive active persona from localStorage if not explicitly supplied
  if (!payload.actorName) {
    try {
      const savedRole =
        (localStorage.getItem("active_erp_role") as RoleType) ||
        (localStorage.getItem("workman_active_role") as RoleType) ||
        "admin";
      const persona = ERP_PERSONAS[savedRole] || ERP_PERSONAS.admin;
      payload.actorId = persona.id;
      payload.actorName = persona.name;
      payload.actorRole = persona.role.toUpperCase();
    } catch {
      payload.actorName = "System User";
      payload.actorRole = "ADMIN";
    }
  }

  clickQueue.push(payload);

  if (batchTimeout) clearTimeout(batchTimeout);
  // Send within 350ms of user activity
  batchTimeout = setTimeout(() => {
    flushTelemetryQueue();
  }, 350);
}

/**
 * Omni-Click Tracker setup for AppShell / Top-level client layout.
 * Automatically listens to click events across the entire UI and captures
 * element identity, button label, link target, or container context.
 */
export function setupGlobalClickTracker() {
  if (typeof window === "undefined") return () => {};

  const handleClick = (e: MouseEvent) => {
    try {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest clickable element
      const clickable = target.closest("button, a, input, select, textarea, [role='button'], [data-audit]") as HTMLElement | null;
      
      let elementDesc = "";
      let category: LogActivityPayload["category"] = "UI_CLICK";

      if (clickable) {
        const tagName = clickable.tagName.toLowerCase();
        const role = clickable.getAttribute("role");
        const ariaLabel = clickable.getAttribute("aria-label");
        const title = clickable.getAttribute("title");
        const dataAudit = clickable.getAttribute("data-audit");
        const textSnippet = clickable.textContent?.trim().slice(0, 50) || "";
        const id = clickable.id ? `#${clickable.id}` : "";

        if (dataAudit) {
          elementDesc = dataAudit;
        } else if (ariaLabel) {
          elementDesc = `[${ariaLabel}] (${tagName}${id})`;
        } else if (title) {
          elementDesc = `"${title}" (${tagName}${id})`;
        } else if (textSnippet) {
          elementDesc = `"${textSnippet}" (${tagName}${id})`;
        } else {
          elementDesc = `<${tagName}${id}>`;
        }

        if (tagName === "a") {
          const href = clickable.getAttribute("href");
          if (href && !href.startsWith("#")) {
            category = "NAVIGATION";
            elementDesc = `Navigate to ${href} via ${elementDesc}`;
          }
        }
      } else {
        // Fallback for general container click
        const textSnippet = target.textContent?.trim().slice(0, 30);
        if (textSnippet && textSnippet.length > 2) {
          elementDesc = `Clicked on "${textSnippet}" (${target.tagName.toLowerCase()})`;
        } else {
          elementDesc = `Clicked <${target.tagName.toLowerCase()}>`;
        }
      }

      logActivity({
        action: "CLICK",
        target: elementDesc,
        category,
        metadata: {
          path: window.location.pathname,
          x: e.clientX,
          y: e.clientY,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        },
      });
    } catch {
      // Safe fallback
    }
  };

  window.addEventListener("click", handleClick, { passive: true, capture: true });

  return () => {
    window.removeEventListener("click", handleClick, { capture: true });
  };
}
