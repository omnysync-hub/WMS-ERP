import { NextRequest, NextResponse } from "next/server";

/**
 * Receives browser-side render errors from app/error.tsx so they show up in the server log (pm2 logs).
 * Only signed-in users reach this (middleware), the body is size-capped and nothing is stored.
 */
const MAX_BODY = 8_000;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : v == null ? undefined : String(v).slice(0, n));

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.text()).slice(0, MAX_BODY);
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
    const actor = request.headers.get("x-actor-role") || "";
    console.error(
      "[client-error]",
      JSON.stringify({
        at: new Date().toISOString(),
        role: clip(actor, 40),
        url: clip(data.url, 300),
        name: clip(data.name, 120),
        message: clip(data.message, 1000),
        digest: clip(data.digest, 80),
        chunkError: Boolean(data.chunkError),
        autoReload: Boolean(data.autoReload),
        stack: clip(data.stack, 2500),
        ua: clip(request.headers.get("user-agent"), 200),
      })
    );
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 });
}
