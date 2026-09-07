"use client";

// Real-Time Cross-Tab & Cross-Device Event Bus for Workman Services ERP

export type SyncEventType =
  | "JOB_ASSIGNED"
  | "JOB_ACCEPTED"
  | "JOB_PAUSED"
  | "JOB_COMPLETED"
  | "JOB_VERIFIED"
  | "INVENTORY_REQUESTED"
  | "INVENTORY_FULFILLED"
  | "DISCOUNT_REQUESTED"
  | "DISCOUNT_GRANTED"
  | "EXPENSE_LOGGED"
  | "EXPENSE_APPROVED"
  | "STOCK_RETURN_ACKNOWLEDGED"
  | "TECHNICIAN_SYNC"
  | "INVENTORY_SYNC"
  | "JOB_UPDATED"
  | "AUDIT_LOG_UPDATE";

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  timestamp: number;
  actor: string;
  message: string;
  jobId?: string;
  jobNumber?: string;
  technicianId?: string;
  technicianName?: string;
  payload?: any;
  isSilent?: boolean;
}

const CHANNEL_NAME = "workman_erp_realtime_bus";
const STORAGE_KEY = "workman_erp_last_event";

class RealtimeSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: SyncEvent) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        if ("BroadcastChannel" in window) {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (e) => {
            if (e.data) {
              this.notifyListeners(e.data);
            }
          };
        }
      } catch (err) {
        // Fallback to storage event
      }

      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            const event: SyncEvent = JSON.parse(e.newValue);
            this.notifyListeners(event);
          } catch (err) {
            // ignore
          }
        }
      });
    }
  }

  public publish(type: SyncEventType, data: Omit<SyncEvent, "id" | "type" | "timestamp">) {
    const isSilent =
      Boolean(data.isSilent) ||
      type === "AUDIT_LOG_UPDATE" ||
      type === "INVENTORY_SYNC" ||
      type === "TECHNICIAN_SYNC" ||
      data.actor === "System" ||
      Boolean(data.message?.startsWith("Sync event"));

    const event: SyncEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      timestamp: Date.now(),
      ...data,
      isSilent,
    };

    // Broadcast across tabs
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (err) {
        // ignore
      }
    }

    // Storage event triggers other windows
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    } catch (err) {
      // ignore
    }

    // Notify local window listeners
    this.notifyListeners(event);

    return event;
  }

  public subscribe(callback: (event: SyncEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: SyncEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in realtime sync listener", err);
      }
    });
  }
}

export const realtimeSync = new RealtimeSyncManager();

export function notifySync(type: SyncEventType, payload?: any) {
  return realtimeSync.publish(type, {
    actor: "",
    message: "",
    payload,
    isSilent: true,
  });
}
