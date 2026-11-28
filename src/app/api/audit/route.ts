export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import { requirePermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const gate = requirePermission(req, "audit.view_logs");
    if (gate.error) return gate.error;
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "all";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const actor = searchParams.get("actor");
    const entityType = searchParams.get("entityType");
    // Optional exact-purpose filter used by lightweight pollers (e.g. the
    // Topbar blocked-device alert): narrows activities to one action family
    // server-side instead of shipping the generic search result. Absent =
    // behaviour exactly as before.
    const action = searchParams.get("action");

    // Fetch Activities
    const activityWhere: any = {};
    if (category && category !== "ALL") activityWhere.category = category;
    if (actor && actor !== "ALL") activityWhere.actorName = { contains: actor };
    if (action) activityWhere.action = { contains: action };
    if (search) {
      activityWhere.OR = [
        { action: { contains: search } },
        { actorName: { contains: search } },
        { target: { contains: search } },
      ];
    }

    // Fetch Rollbacks
    const rollbackWhere: any = {};
    if (entityType && entityType !== "ALL") rollbackWhere.entityType = entityType;
    if (actor && actor !== "ALL") rollbackWhere.actorName = { contains: actor };
    if (search) {
      rollbackWhere.OR = [
        { action: { contains: search } },
        { entityNumber: { contains: search } },
        { actorName: { contains: search } },
      ];
    }

    // All six reads are independent: run them in one parallel batch instead
    // of six sequential round-trips (same filters, same order, same limits).
    const [
      activities,
      rollbacks,
      totalActivities,
      totalRollbacks,
      availableForRollback,
      executedRollbacks,
    ] = await Promise.all([
      prisma.activityLog.findMany({
        where: activityWhere,
        orderBy: { timestamp: "desc" },
        take: 100,
      }),
      prisma.rollbackLog.findMany({
        where: rollbackWhere,
        orderBy: { timestamp: "desc" },
        take: 100,
      }),
      prisma.activityLog.count(),
      prisma.rollbackLog.count(),
      prisma.rollbackLog.count({
        where: { status: "ACTIVE", canRollback: true },
      }),
      prisma.rollbackLog.count({
        where: { status: "ROLLED_BACK" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      activities,
      rollbacks,
      stats: {
        totalActivities,
        totalRollbacks,
        availableForRollback,
        executedRollbacks,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    // Destructive audit actions carry their OWN permissions (admin-only by default).
    // audit.view_logs is a read grant held by accountant/manager/auditor and must
    // never authorize executing a rollback or wiping the activity log.
    const requiredKey =
      action === "rollback"
        ? "audit.rollback"
        : action === "clear_activities"
          ? "audit.clear"
          : "audit.view_logs";
    const gate = requirePermission(req, requiredKey);
    if (gate.error) return gate.error;

    switch (action) {
      case "log_activity": {
        const activityPayload = (payload as any).activity || payload;
        const log = await AuditService.logActivity({
          actorName: gate.actor.name,
          actorRole: gate.actor.role,
          actorId: gate.actor.id,
          category: activityPayload.category || "UI_CLICK",
          action: activityPayload.actionText || activityPayload.action || "User interaction",
          target: activityPayload.target || "System Interface",
          metadata: activityPayload.metadata,
          ipAddress: activityPayload.ipAddress || req.headers.get("x-forwarded-for") || "127.0.0.1 (Local Session)",
        });
        return NextResponse.json({ success: true, log }, { status: 201 });
      }

      case "rollback": {
        const rollbackLogId = payload.rollbackLogId || payload.rollbackId;
        const reason = payload.reason;
        if (!rollbackLogId) {
          return NextResponse.json({ error: "Missing rollbackLogId" }, { status: 400 });
        }
        const result = await AuditService.executeRollback(
          rollbackLogId,
          gate.actor.name,
          reason || "User triggered instant state rollback"
        );
        return NextResponse.json({ success: true, rollback: result });
      }

      case "clear_activities": {
        await prisma.activityLog.deleteMany();
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

