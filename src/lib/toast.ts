/**
 * Universal Enterprise Toast Notification System for Workman Services ERP
 *
 * Provides typed, accessible, and reactive toasts across all application layers:
 * - toast.success("Message", { title?: string, duration?: number, ... })
 * - toast.error("Message", { title?: string, ... })
 * - toast.warning("Message", { title?: string, ... })
 * - toast.info("Message", { title?: string, ... })
 * - toast.notification("Title", "Message", { ... })
 * - toast.promise(asyncFn(), { loading, success, error })
 *
 * Fully works inside React components, async services, background event handlers,
 * and vanilla JS hooks without React context dependencies via a custom event bus.
 */

export type ToastTone = "success" | "error" | "warning" | "info" | "notification";

export interface ToastAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface ToastOptions {
  id?: string | number;
  title?: string;
  duration?: number;
  sound?: boolean;
  action?: ToastAction;
}

export interface ToastItem {
  id: string | number;
  message: string;
  title?: string;
  tone: ToastTone;
  duration: number;
  sound?: boolean;
  action?: ToastAction;
  createdAt: number;
}

export interface ToastEventDetail {
  id?: string | number;
  message: string;
  title?: string;
  tone?: ToastTone;
  duration?: number;
  sound?: boolean;
  action?: ToastAction;
}

import { playToastCue } from "./soundAlerts";

/**
 * Play the Web Audio cue matching the toast tone. Delegates to the shared
 * sound engine (src/lib/soundAlerts.ts), which owns the single AudioContext,
 * the first-gesture unlock, and the master mute (`wms_sound_alerts`).
 */
export function playToastSound(tone: ToastTone = "info") {
  playToastCue(tone);
}

/**
 * Dispatch toast event to the global listener
 */
function dispatchToast(tone: ToastTone, message: string, options?: ToastOptions): string | number {
  const id = options?.id ?? `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const defaultDuration =
    tone === "error" ? 6000 : tone === "warning" ? 5500 : tone === "notification" ? 6500 : 4500;

  if (typeof window !== "undefined") {
    const detail: ToastEventDetail = {
      id,
      message,
      title: options?.title,
      tone,
      duration: options?.duration ?? defaultDuration,
      sound: options?.sound ?? true,
      action: options?.action,
    };

    window.dispatchEvent(new CustomEvent("workman:toast", { detail }));
  }

  return id;
}

export const toast = {
  /**
   * Action completed successfully
   */
  success(message: string, options?: ToastOptions) {
    return dispatchToast("success", message, {
      title: options?.title || "Success",
      ...options,
    });
  },

  /**
   * Action failed or unexpected error occurred
   */
  error(message: string, options?: ToastOptions) {
    return dispatchToast("error", message, {
      title: options?.title || "Error",
      ...options,
    });
  },

  /**
   * Important notice, validation warning or caution
   */
  warning(message: string, options?: ToastOptions) {
    return dispatchToast("warning", message, {
      title: options?.title || "Warning",
      ...options,
    });
  },

  /**
   * Informational status update
   */
  info(message: string, options?: ToastOptions) {
    return dispatchToast("info", message, {
      title: options?.title || "Information",
      ...options,
    });
  },

  /**
   * System notification, live event, or real-time alert
   */
  notification(title: string, message: string, options?: ToastOptions) {
    return dispatchToast("notification", message, {
      title,
      ...options,
    });
  },

  /**
   * Dismiss an active toast by ID, or all if omitted
   */
  dismiss(id?: string | number) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("workman:toast:dismiss", { detail: { id } }));
    }
  },

  /**
   * Helper to handle async promises with loading, success, and error feedback
   */
  async promise<T>(
    promise: Promise<T>,
    messages: {
      loading?: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    },
    options?: ToastOptions
  ): Promise<T> {
    let loadingToastId: string | number | undefined;
    if (messages.loading) {
      loadingToastId = toast.info(messages.loading, {
        ...options,
        duration: 30000,
        title: "Processing...",
      });
    }

    try {
      const data = await promise;
      if (loadingToastId) toast.dismiss(loadingToastId);
      const successMsg =
        typeof messages.success === "function" ? messages.success(data) : messages.success;
      toast.success(successMsg, options);
      return data;
    } catch (err: any) {
      if (loadingToastId) toast.dismiss(loadingToastId);
      const errorMsg =
        typeof messages.error === "function"
          ? messages.error(err)
          : err?.message || messages.error;
      toast.error(errorMsg, options);
      throw err;
    }
  },
};

// Global assignment for window.toast
if (typeof window !== "undefined") {
  (window as any).toast = toast;
}

export default toast;
