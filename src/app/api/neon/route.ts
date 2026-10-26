import { NextRequest, NextResponse } from "next/server";
import { getNeonServiceStatus, callNeonFunction } from "@/lib/neon";
import { requirePermission, resolveJobsActor } from "@/lib/auth/erpActor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const actor = resolved.actor;
    if (!actor || (actor.role !== "admin" && actor.role !== "manager")) {
      const gate = requirePermission(req, "settings.manage_system");
      if (gate.error) return gate.error;
    }

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

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const actor = resolved.actor;
    if (!actor || (actor.role !== "admin" && actor.role !== "manager")) {
      const gate = requirePermission(req, "settings.manage_system");
      if (gate.error) return gate.error;
    }

    const body = await req.json().catch(() => ({}));
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
