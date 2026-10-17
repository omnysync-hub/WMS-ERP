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

/**
 * Play a subtle, non-intrusive Web Audio synthesis tone matching the toast mood
 */
export function playToastSound(tone: ToastTone = "info") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (tone === "success") {
      // Harmonic 2-tone pleasant rising chime (D5 -> A5)
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (tone === "error") {
      // 2-tone descending soft alert (440Hz -> 311Hz)
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(311.13, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (tone === "warning") {
      // Warm alert tone
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(622.25, now);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (tone === "notification") {
      // 3-note harmonic chime (C5 -> E5 -> G5)
      [
        { f: 523.25, s: 0.0, d: 0.12 },
        { f: 659.25, s: 0.09, d: 0.14 },
        { f: 783.99, s: 0.18, d: 0.28 },
      ].forEach(({ f, s, d }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f, now + s);
        g.gain.setValueAtTime(0.07, now + s);
        g.gain.exponentialRampToValueAtTime(0.001, now + s + d);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + s);
        o.stop(now + s + d);
      });
    } else {
      // Info: gentle soft ping
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {
    // Silent fail if browser audio is not permitted or suspended
  }
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
