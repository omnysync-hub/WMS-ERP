import { NextRequest, NextResponse } from "next/server";
import { authenticateErpRequest, clearErpSessionCookie } from "@/lib/auth/webAuth";
import { effectivePermissionMap, getRoleDefinition, signedOverridesFor } from "@/lib/auth/roleStore";

export async function GET(request: NextRequest) {
  const auth = await authenticateErpRequest(request);
  if (!auth) {
    const response = NextResponse.json({ error: "Not signed in." }, { status: 401 });
    clearErpSessionCookie(response);
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
