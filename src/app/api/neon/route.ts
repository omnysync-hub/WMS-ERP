import { NextResponse } from "next/server";
import { getNeonServiceStatus, callNeonFunction } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getNeonServiceStatus();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "call_hello";

    if (action === "call_hello") {
      const result = await callNeonFunction("hello");
      return NextResponse.json({
        success: true,
        action,
        result,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
