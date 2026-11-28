"use client";

/**
 * ToastProvider — mounts the global ToastViewport once and exposes the
 * shared `notify` API through React context.
 *
 *   const notify = useNotify();
 *   notify.success("Saved.");
 *
 * The provider holds no toast state of its own: `notify` dispatches on the
 * app-wide toast bus (src/lib/toast.ts) and the viewport renders it, so
 * non-React code calling notify/toast directly reaches the same stack.
 */

import React, { createContext, useContext } from "react";
import ToastViewport from "@/components/ui/ToastViewport";
import { notify, type Notify } from "@/lib/notify";

const ToastContext = createContext<Notify>(notify);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useNotify(): Notify {
  return useContext(ToastContext);
}

/** Alias matching the naming used by most component libraries. */
export const useToast = useNotify;

export default ToastProvider;
