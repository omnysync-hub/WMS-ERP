"use client";

/**
 * Browser-demo RBAC: attach ERP actor headers (x-actor-role / x-actor-name / x-user-id)
 * to every same-origin /api/* fetch so server-side gates (requireJobsPermission,
 * requireProcurementPermission) see the active persona without touching each call site.
 * Explicit headers set by a caller always win. Installed once by RoleProvider.
 */
export type ErpActorSnapshot = { role: string; name?: string; userId?: string };

let installed = false;
let getActor: () => ErpActorSnapshot | null = () => null;

function isSameOriginApi(url: string): boolean {
  if (url.startsWith("/api/")) return true;
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function installErpActorFetch(getter: () => ErpActorSnapshot | null) {
  getActor = getter;
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const actor = getActor();
      if (!actor?.role || !isSameOriginApi(url)) return originalFetch(input, init);

      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined)
      );
      if (!headers.has("x-actor-role") && !headers.has("x-user-role")) {
        headers.set("x-actor-role", actor.role);
      }
      if (actor.name && !headers.has("x-actor-name")) headers.set("x-actor-name", actor.name);
      if (actor.userId && !headers.has("x-user-id")) headers.set("x-user-id", actor.userId);

      if (input instanceof Request && !init) {
        return originalFetch(new Request(input, { headers }));
      }
      return originalFetch(input, { ...(init || {}), headers });
    } catch {
      return originalFetch(input, init);
    }
  };
}
