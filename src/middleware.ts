import { NextRequest, NextResponse } from "next/server";
import { ERP_SESSION_COOKIE, authenticateErpRequest, clearErpSessionCookie } from "@/lib/auth/webAuth";
import { stampActorHeaders, stripActorHeaders } from "@/lib/auth/actorHeaders";
import { signedOverridesFor } from "@/lib/auth/roleStore";
import { actorHasPermission } from "@/lib/auth/erpActor";

export const runtime = "nodejs";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/neon"];

function isPublic(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Only the credential exchange is public. Every other mobile endpoint must
  // pass through the signed Bearer-token/session validation below.
  if (pathname === "/api/mobile/auth" && request.method === "POST") return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(request) && pathname !== "/login") {
    // Never forward client-supplied internal actor headers, even on public routes.
    const headers = new Headers(request.headers);
    stripActorHeaders(headers);
    return NextResponse.next({ request: { headers } });
  }

  const authorization = request.headers.get("authorization") || "";
  if (pathname.startsWith("/api/") && authorization.startsWith("Bearer ")) {
    try {
      const { resolveCaller } = await import("@/lib/auth/mobileAuth");
      const caller = await resolveCaller(request);
      if (!caller) return NextResponse.json({ error: "Invalid or expired mobile session." }, { status: 401 });
      const headers = new Headers(request.headers);
      const mobileRole = String(caller.role || "technician").toLowerCase();
      stampActorHeaders(headers, {
        id: caller.id,
        role: mobileRole,
        name: caller.name || "Mobile user",
        // Role edits made in Settings > Users & Roles apply to mobile callers too.
        overrides: await signedOverridesFor(mobileRole, {}),
      });
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Could not verify the mobile session." }, { status: 503 });
    }
  }

  // Only clear the session cookie when this request actually carried one. A request sent without a
  // cookie (e.g. a background call the login page fired just before sign-in finished) must not
  // wipe the fresh cookie the login response has just set in the browser.
  const hadSessionCookie = Boolean(request.cookies.get(ERP_SESSION_COOKIE)?.value);

  let auth = null;
  try {
    auth = await authenticateErpRequest(request);
  } catch {
    auth = null;
  }

  if (!auth) {
    if (pathname === "/login") {
      const headers = new Headers(request.headers);
      stripActorHeaders(headers);
      return NextResponse.next({ request: { headers } });
    }
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Your session has ended. Please sign in again.", code: "UNAUTHENTICATED" }, { status: 401 });
      if (hadSessionCookie) clearErpSessionCookie(response, request);
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    if (hadSessionCookie) clearErpSessionCookie(response, request);
    return response;
  }

  const getRoleLandingPath = (role: string) => {
    const r = (role || "").toLowerCase();
    if (r === "admin") return "/dashboards";
    if (r === "hr") return "/hrm";
    if (r === "storekeeper") return "/inventory";
    return "/jobs";
  };

  if (pathname === "/login") {
    const landing = getRoleLandingPath(auth.user.role);
    return NextResponse.redirect(new URL(auth.user.mustChangePassword ? "/change-password" : landing, request.url));
  }

  if (pathname === "/") {
    const landing = getRoleLandingPath(auth.user.role);
    return NextResponse.redirect(new URL(landing, request.url));
  }

  const passwordChangeAllowed =
    pathname === "/change-password" ||
    pathname === "/api/auth/change-password" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/session";
  if (auth.user.mustChangePassword && !passwordChangeAllowed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Change your temporary password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  // Effective permissions = role (built-in defaults + saved role edits) + this user's overrides.
  // Read fresh on every request, so role/override changes apply without signing in again.
  const effectiveOverrides = await signedOverridesFor(auth.user.role, auth.user.permissionOverrides);
  const can = (key: string) => actorHasPermission({ role: auth.user.role, overrides: effectiveOverrides }, key);

  if (
    pathname.startsWith("/settings/users-roles") &&
    !(can("settings.manage_users") || can("settings.manage_roles"))
  ) {
    const deniedUrl = new URL(getRoleLandingPath(auth.user.role), request.url);
    deniedUrl.searchParams.set("access", "denied");
    return NextResponse.redirect(deniedUrl);
  }

  // Dashboards are strictly restricted to Admin role
  if ((pathname === "/dashboards" || pathname.startsWith("/dashboards/")) && auth.user.role !== "admin") {
    const deniedUrl = new URL(getRoleLandingPath(auth.user.role), request.url);
    deniedUrl.searchParams.set("access", "denied");
    return NextResponse.redirect(deniedUrl);
  }

  if (pathname.startsWith("/api/dashboards") && auth.user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Dashboards are restricted strictly to Administrators.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const headers = new Headers(request.headers);
  try {
    stampActorHeaders(headers, {
      id: auth.user.id,
      role: auth.user.role,
      name: auth.user.name,
      overrides: effectiveOverrides,
    });
  } catch (err) {
    // Missing MOBILE_AUTH_SECRET / ERP_HEADER_SECRET: fail loudly instead of a blank 500.
    console.error("[middleware] Cannot sign actor headers:", err);
    const message =
      "Server misconfiguration: set MOBILE_AUTH_SECRET (or ERP_HEADER_SECRET) in the server environment and restart.";
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: message, code: "SERVER_MISCONFIGURED" }, { status: 500 });
    }
    return new NextResponse(message, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // API routes are ALWAYS matched (even "/api/x/abc.png"), so handlers never run without
  // middleware stripping and re-signing the internal actor headers.
  matcher: [
    "/api/:path*",
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
