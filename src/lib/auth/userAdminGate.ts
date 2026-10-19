import { NextRequest, NextResponse } from "next/server";
import { authenticateErpRequest } from "@/lib/auth/webAuth";
import { effectivePermissionMap, signedOverridesFor } from "@/lib/auth/roleStore";
import { AuditService } from "@/lib/services/AuditService";

export type UserAdminContext = {
  auth: NonNullable<Awaited<ReturnType<typeof authenticateErpRequest>>>;
  isAdmin: boolean;
  /** The caller's own effective permissions (role + overrides). */
  actorMap: Record<string, boolean>;
};

/**
 * Gate for user / role administration. Admin always passes; others need one of `keys`.
 * Uses the live DB session (not cached headers) so a revoked permission stops working at once.
 */
export async function requireUserAdmin(
  request: NextRequest,
  keys: string[]
): Promise<{ ctx: UserAdminContext; error?: undefined } | { ctx?: undefined; error: NextResponse }> {
  const auth = await authenticateErpRequest(request);
  if (!auth) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const role = (auth.user.role || "").toLowerCase();
  const overrides = await signedOverridesFor(role, auth.user.permissionOverrides);
  const actorMap = effectivePermissionMap({ role, overrides });
  const isAdmin = role === "admin";
  if (!isAdmin && !keys.some((k) => actorMap[k])) {
    return {
      error: NextResponse.json(
        { error: `You need the '${keys.join("' or '")}' permission for this.`, code: "PERMISSION_DENIED" },
        { status: 403 }
      ),
    };
  }
  return { ctx: { auth, isAdmin, actorMap } };
}

export async function logAdminChange(ctx: UserAdminContext, action: string, target: string, metadata?: unknown) {
  await AuditService.logActivity({
    actorId: ctx.auth.user.id,
    actorName: ctx.auth.user.name || ctx.auth.user.username,
    actorRole: ctx.auth.user.role,
    category: "DATA_MUTATION",
    action,
    target,
    metadata,
  });
}
