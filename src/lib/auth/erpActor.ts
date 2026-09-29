/**
 * ERP actor resolution for browser-demo RBAC (no real ERP session yet).
 *
 * Approach (matches mobileAuth header conventions):
 * - Prefer Authorization Bearer mobile token via resolveCaller when present.
 * - Else trust demo headers: x-actor-role / x-user-role, x-actor-name, x-user-id / x-employee-id.
 * - Permission matrix comes from DEFAULT_ROLE_PERMISSIONS (+ legacy key aliases).
 * - UI must send the same headers on every /api/procurement call; server still enforces.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_ROLE_PERMISSIONS,
  resolveProcurementPermissionKeys,
} from "@/lib/permissions";

export interface ErpActor {
  id: string;
  role: string;
  name: string;
}

export function resolveErpActorFromRequest(req: NextRequest): ErpActor {
  const role = (
    req.headers.get("x-actor-role") ||
    req.headers.get("x-user-role") ||
    ""
  )
    .trim()
    .toLowerCase();

  const name =
    req.headers.get("x-actor-name") ||
    req.headers.get("x-user-name") ||
    "ERP User";

  const id =
    req.headers.get("x-user-id") ||
    req.headers.get("x-employee-id") ||
    `demo-${role || "anonymous"}`;

  return { id, role: role || "anonymous", name };
}

export function roleHasPermission(role: string, permissionKey: string): boolean {
  const r = (role || "").toLowerCase();
  if (r === "admin") return true;

  const roleMap = DEFAULT_ROLE_PERMISSIONS[r] || {};
  const keys = resolveProcurementPermissionKeys(permissionKey);

  for (const key of keys) {
    if (roleMap[key] === true) return true;
  }

  // Explicit false on any resolved key means denied when none were true
  for (const key of keys) {
    if (roleMap[key] === false) return false;
  }

  return false;
}

/**
 * Gate a procurement API action. Returns NextResponse 403 on deny, or null when allowed.
 */
export function requireProcurementPermission(
  req: NextRequest,
  permissionKey: string
): { actor: ErpActor; error?: undefined } | { actor: ErpActor; error: NextResponse } {
  const actor = resolveErpActorFromRequest(req);

  if (!actor.role || actor.role === "anonymous") {
    return {
      actor,
      error: NextResponse.json(
        {
          error:
            "Forbidden: missing actor role. Send x-actor-role (and optionally x-actor-name / x-user-id) on procurement API calls.",
        },
        { status: 403 }
      ),
    };
  }

  if (!roleHasPermission(actor.role, permissionKey)) {
    return {
      actor,
      error: NextResponse.json(
        {
          error: `Forbidden: role '${actor.role}' lacks permission '${permissionKey}'`,
          permission: permissionKey,
          role: actor.role,
          code: "PERMISSION_DENIED",
        },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

/** Any of the listed permissions grants access. */
export function requireAnyProcurementPermission(
  req: NextRequest,
  permissionKeys: string[]
): { actor: ErpActor; error?: undefined } | { actor: ErpActor; error: NextResponse } {
  const actor = resolveErpActorFromRequest(req);
  if (!actor.role || actor.role === "anonymous") {
    return {
      actor,
      error: NextResponse.json(
        {
          error:
            "Forbidden: missing actor role. Send x-actor-role on procurement API calls.",
        },
        { status: 403 }
      ),
    };
  }

  const allowed = permissionKeys.some((k) => roleHasPermission(actor.role, k));
  if (!allowed) {
    return {
      actor,
      error: NextResponse.json(
        {
          error: `Forbidden: role '${actor.role}' lacks any of [${permissionKeys.join(", ")}]`,
          permissions: permissionKeys,
          role: actor.role,
          code: "PERMISSION_DENIED",
        },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

/**
 * Generic ERP permission gate (jobs, audit, etc.). Same actor headers as procurement.
 */
export function requirePermission(
  req: NextRequest,
  permissionKey: string
): { actor: ErpActor; error?: undefined } | { actor: ErpActor; error: NextResponse } {
  const actor = resolveErpActorFromRequest(req);

  if (!actor.role || actor.role === "anonymous") {
    return {
      actor,
      error: NextResponse.json(
        {
          error:
            "Forbidden: missing actor role. Send x-actor-role (and optionally x-actor-name / x-user-id) on API calls.",
        },
        { status: 403 }
      ),
    };
  }

  if (!roleHasPermission(actor.role, permissionKey)) {
    return {
      actor,
      error: NextResponse.json(
        {
          error: `Forbidden: role '${actor.role}' lacks permission '${permissionKey}'`,
          permission: permissionKey,
          role: actor.role,
          code: "PERMISSION_DENIED",
        },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

type GateResult =
  | { actor: ErpActor; error?: undefined }
  | { actor: ErpActor; error: NextResponse };

/**
 * Resolve the calling actor for jobs APIs.
 * - Mobile app: `Authorization: Bearer wms_mobile_...` is verified (HMAC) and the employee's
 *   DB role is authoritative (headers cannot escalate a mobile session).
 * - ERP web (demo RBAC): falls back to x-actor-role / x-actor-name / x-user-id headers.
 * Returns `{ error }` (401) when a Bearer token is present but invalid/expired/deactivated.
 */
export async function resolveJobsActor(
  req: NextRequest
): Promise<{ actor: ErpActor; viaMobileToken: boolean; error?: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    try {
      // Lazy import keeps erpActor free of prisma for pure-header callers
      const { resolveCaller } = await import("@/lib/auth/mobileAuth");
      const caller = await resolveCaller(req);
      if (!caller) {
        return {
          actor: resolveErpActorFromRequest(req),
          viaMobileToken: true,
          error: NextResponse.json(
            { error: "Unauthorized: invalid, expired or deactivated mobile session. Sign in again." },
            { status: 401 }
          ),
        };
      }
      return {
        actor: {
          id: caller.id,
          role: (caller.role || "anonymous").toLowerCase(),
          name: caller.name || req.headers.get("x-actor-name") || "Mobile User",
        },
        viaMobileToken: true,
      };
    } catch (e: any) {
      return {
        actor: resolveErpActorFromRequest(req),
        viaMobileToken: true,
        error: NextResponse.json(
          // 503 (not 401): a transient DB/verify failure must not force-logout the mobile app
          { error: `Could not verify mobile session right now (${e?.message || "unknown error"}). Try again.` },
          { status: 503 }
        ),
      };
    }
  }
  return { actor: resolveErpActorFromRequest(req), viaMobileToken: false };
}

/**
 * Jobs permission gate (jobs.*, care-of, feedback, hisaab).
 * Same header contract as procurement, plus verified mobile Bearer tokens.
 * Async: callers MUST `await` it.
 */
export async function requireJobsPermission(
  req: NextRequest,
  permissionKey: string | string[]
): Promise<GateResult> {
  const resolved = await resolveJobsActor(req);
  const actor = resolved.actor;
  if (resolved.error) return { actor, error: resolved.error };

  if (!actor.role || actor.role === "anonymous") {
    return {
      actor,
      error: NextResponse.json(
        {
          error:
            "Forbidden: missing actor role. Send x-actor-role (and optionally x-actor-name / x-user-id) or a mobile Bearer token.",
          code: "PERMISSION_DENIED",
        },
        { status: 403 }
      ),
    };
  }

  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  if (!keys.some((k) => roleHasPermission(actor.role, k))) {
    return {
      actor,
      error: NextResponse.json(
        {
          error: `Forbidden: role '${actor.role}' lacks permission '${keys.join("' or '")}'`,
          permission: keys.length === 1 ? keys[0] : keys,
          role: actor.role,
          code: "PERMISSION_DENIED",
        },
        { status: 403 }
      ),
    };
  }

  return { actor };
}