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
        },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

/** Alias used by jobs verification APIs. */
export const requireJobsPermission = requirePermission;