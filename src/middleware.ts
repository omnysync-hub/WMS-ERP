import { NextRequest, NextResponse } from "next/server";
import { authenticateErpRequest, clearErpSessionCookie } from "@/lib/auth/webAuth";

export const runtime = "nodejs";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/mobile"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname) && pathname !== "/login") return NextResponse.next();

  const authorization = request.headers.get("authorization") || "";
  if (pathname.startsWith("/api/") && authorization.startsWith("Bearer ")) {
    try {
      const { resolveCaller } = await import("@/lib/auth/mobileAuth");
      const caller = await resolveCaller(request);
      if (!caller) return NextResponse.json({ error: "Invalid or expired mobile session." }, { status: 401 });
      const headers = new Headers(request.headers);
      headers.set("x-workman-authenticated", "1");
      headers.set("x-actor-role", String(caller.role || "technician").toLowerCase());
      headers.set("x-actor-name", caller.name || "Mobile user");
      headers.set("x-user-id", caller.id);
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Could not verify the mobile session." }, { status: 503 });
    }
  }

  let auth = null;
  try {
    auth = await authenticateErpRequest(request);
  } catch {
    auth = null;
  }

  if (!auth) {
    if (pathname === "/login") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Your session has ended. Please sign in again.", code: "UNAUTHENTICATED" }, { status: 401 });
      clearErpSessionCookie(response);
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    clearErpSessionCookie(response);
    return response;
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(auth.user.mustChangePassword ? "/change-password" : "/dashboards", request.url));
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

  if (pathname.startsWith("/settings/users-roles") && auth.user.role !== "admin") {
    const deniedUrl = new URL("/dashboards", request.url);
    deniedUrl.searchParams.set("access", "denied");
    return NextResponse.redirect(deniedUrl);
  }

  const headers = new Headers(request.headers);
  headers.set("x-workman-authenticated", "1");
  headers.set("x-actor-role", auth.user.role);
  headers.set("x-actor-name", auth.user.name);
  headers.set("x-user-id", auth.user.id);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
