import { NextRequest, NextResponse } from "next/server";
import { ERP_SESSION_COOKIE, authenticateErpRequest, clearErpSessionCookie } from "@/lib/auth/webAuth";
import { effectivePermissionMap, getRoleDefinition, signedOverridesFor } from "@/lib/auth/roleStore";

export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await authenticateErpRequest(request);
  } catch {
    // Could not check (DB restarting): not the same as signed out — keep the cookie.
    return NextResponse.json({ error: "Session check unavailable. Retry.", code: "SESSION_CHECK_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!auth) {
    const response = NextResponse.json({ error: "Not signed in.", code: "UNAUTHENTICATED" }, { status: 401 });
    if (request.cookies.get(ERP_SESSION_COOKIE)?.value) clearErpSessionCookie(response, request);
    return response;
  }
  // The browser uses this server-computed map for showing/hiding UI; the server enforces the same map.
  const overrides = await signedOverridesFor(auth.user.role, auth.user.permissionOverrides);
  const effectivePermissions = effectivePermissionMap({ role: auth.user.role, overrides });
  const role = await getRoleDefinition(auth.user.role);
  const response = NextResponse.json({
    user: auth.user,
    expiresAt: auth.session.expiresAt,
    effectivePermissions,
    role: role ? { key: role.key, label: role.label, description: role.description, isSystem: role.isSystem } : null,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
