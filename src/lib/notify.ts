/**
 * notify — the one-line toast API for mutation feedback across the ERP.
 *
 *   import { notify } from "@/lib/notify";
 *   notify.success("Job created.");
 *   notify.error(serverMessage);
 *   notify.warning("Stock is below the reorder level.");
 *   notify.info("Report is being prepared.");
 *
 * It delegates to the shared toast bus (src/lib/toast.ts), which renders in
 * the global ToastViewport and plays the matching sound cue through the
 * sound engine (src/lib/soundAlerts.ts) — honouring the master mute.
 * React components may equivalently use the useNotify() hook from
 * src/contexts/ToastContext.tsx; both reach the same viewport.
 */

import toast, { type ToastOptions } from "./toast";

export const notify = {
  success(message: string, options?: ToastOptions): string | number {
    return toast.success(message, options);
  },
  error(message: string, options?: ToastOptions): string | number {
    return toast.error(message, options);
  },
  warning(message: string, options?: ToastOptions): string | number {
    return toast.warning(message, options);
  },
  info(message: string, options?: ToastOptions): string | number {
    return toast.info(message, options);
  },
  notification(title: string, message: string, options?: ToastOptions): string | number {
    return toast.notification(title, message, options);
  },
  dismiss(id?: string | number): void {
    toast.dismiss(id);
  },
};

export type Notify = typeof notify;

export default notify;
