export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import { AuditService } from "@/lib/services/AuditService";

const DEFAULT_RETENTION_DAYS = 90;

import { requireOfficePermission } from "@/lib/auth/erpActor";

export async function POST(req: NextRequest) {
  try {
    let caller: { id: string; role: string; name: string; isAdminOrHr?: boolean } | null = null;
    const gate = await requireOfficePermission(req, [
      "dispatch.view_map",
      "dispatch.manage",
      "settings.manage_data",
      "hrm.manage_staff",
      "admin",
    ]);

    if (!gate.error) {
      caller = {
        id: gate.actor.id,
        role: gate.actor.role,
        name: gate.actor.name || "Administrator",
        isAdminOrHr: true,
      };
    } else {
      const mobileCaller = await resolveCaller(req);
      if (mobileCaller && mobileCaller.isAdminOrHr) {
        caller = {
          id: mobileCaller.id,
          role: mobileCaller.role,
          name: mobileCaller.name || "Administrator",
          isAdminOrHr: true,
        };
      } else {
        return gate.error;
      }
    }

    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed
    }

    const retentionDays = Number(body.retentionDays) || DEFAULT_RETENTION_DAYS;
    const dryRun = Boolean(body.dryRun);

    if (retentionDays < 7) {
      return NextResponse.json(
        { error: "retentionDays must be at least 7 days to prevent accidental data loss." },
        { status: 400 }
      );
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    // Count eligible records
    const [pingsToPurge, gapsToPurge] = await Promise.all([
      prisma.technicianLocationPing.count({
        where: { timestamp: { lt: cutoffDate } },
      }),
      prisma.offlineGapLog.count({
        where: { gapStartAt: { lt: cutoffDate } },
      }),
    ]);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        eligiblePings: pingsToPurge,
        eligibleOfflineGaps: gapsToPurge,
      });
    }

    // Execute purge
    const [deletedPings, deletedGaps] = await Promise.all([
      prisma.technicianLocationPing.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
      prisma.offlineGapLog.deleteMany({
        where: { gapStartAt: { lt: cutoffDate } },
      }),
    ]);

    // Audit log
    await AuditService.logActivity({
      actorName: caller.name || "System Admin",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "TELEMETRY_RETENTION_PURGE",
      target: `Cutoff: ${cutoffDate.toISOString()} (${retentionDays} days retention)`,
      metadata: {
        purgedPingsCount: deletedPings.count,
        purgedGapsCount: deletedGaps.count,
        cutoffDate: cutoffDate.toISOString(),
        executedBy: caller.id,
      },
    });

    return NextResponse.json({
      success: true,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      purgedPingsCount: deletedPings.count,
      purgedGapsCount: deletedGaps.count,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
