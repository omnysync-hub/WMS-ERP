import { NextRequest, NextResponse } from "next/server";
import {
  createErpSession,
  requestIp,
  setErpSessionCookie,
  verifyErpLogin,
} from "@/lib/auth/webAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const login = String(body.login || "").trim();
    const password = String(body.password || "");
    if (!login || !password) {
      return NextResponse.json({ error: "Enter your username/email and password." }, { status: 400 });
    }
    if (login.length > 160 || password.length > 256) {
      return NextResponse.json({ error: "The login details are not valid." }, { status: 400 });
    }

    const result = await verifyErpLogin(login, password);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const session = await createErpSession(result.user.id, {
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent") || undefined,
      deviceLabel: String(body.deviceLabel || "Web browser"),
    });
    const response = NextResponse.json({ user: result.user });
    setErpSessionCookie(response, session.token);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("ERP login failed", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
