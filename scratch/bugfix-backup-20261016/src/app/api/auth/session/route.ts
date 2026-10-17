import { NextRequest, NextResponse } from "next/server";
import { authenticateErpRequest, clearErpSessionCookie } from "@/lib/auth/webAuth";

export async function GET(request: NextRequest) {
  const auth = await authenticateErpRequest(request);
  if (!auth) {
    const response = NextResponse.json({ error: "Not signed in." }, { status: 401 });
    clearErpSessionCookie(response);
    return response;
  }
  const response = NextResponse.json({ user: auth.user, expiresAt: auth.session.expiresAt });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
