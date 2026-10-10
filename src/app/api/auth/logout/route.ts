import { NextRequest, NextResponse } from "next/server";
import { clearErpSessionCookie, revokeCurrentErpSession } from "@/lib/auth/webAuth";

export async function POST(request: NextRequest) {
  await revokeCurrentErpSession(request).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  clearErpSessionCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
