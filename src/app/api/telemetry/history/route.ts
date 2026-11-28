export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import { pktTodayStart } from "@/lib/pktTime";

/**
 * Haversine formula to calculate great-circle distance between two GPS points in kilometers.
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

import { requireOfficePermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize caller: this endpoint serves ONLY the Surveillance page
    // (historical route replay / breadcrumbs) — its sole caller in the app.
    // The Live Dispatch map reads live positions from other endpoints and
    // never calls this route, so dispatch.view_map must NOT open it:
    // dispatch.surveillance (manager + admin by default) is the governing key.
    const gate = await requireOfficePermission(req, [
      "dispatch.surveillance",
      "admin",
    ]);

    if (gate.error) {
      const mobileCaller = await resolveCaller(req);
      if (!mobileCaller || !mobileCaller.isAdminOrHr) {
        return gate.error;
      }
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const scope = searchParams.get("scope") || "all"; // "all" | "on_job" | "on_shift"

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId query parameter is required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        email: true,
        department: true,
        designation: true,
        active: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    // Default time range: Start of today to now
    const now = new Date();
    const defaultStart = pktTodayStart(now); // PKT midnight

    const start = startDateParam ? new Date(startDateParam) : defaultStart;
    const end = endDateParam ? new Date(endDateParam) : now;

    // 2. Fetch Pings
    const pingWhere: any = {
      employeeId,
      timestamp: { gte: start, lte: end },
    };

    if (scope === "on_job") {
      pingWhere.activeJobId = { not: null };
    } else if (scope === "on_shift") {
      pingWhere.isShiftActive = true;
    }

    const [pings, gaps, consentRecord] = await Promise.all([
      prisma.technicianLocationPing.findMany({
        where: pingWhere,
        include: {
          activeJob: {
            select: {
              id: true,
              jobNumber: true,
              status: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { timestamp: "asc" },
      }),
      // Gaps that OVERLAP the selected interval (not only those starting inside
      // it): started before/at the end, and either still open or ending at/after
      // the start. Durations are clipped to the interval below before summing.
      prisma.offlineGapLog.findMany({
        where: {
          employeeId,
          gapStartAt: { lte: end },
          OR: [{ gapEndAt: null }, { gapEndAt: { gte: start } }],
        },
        orderBy: { gapStartAt: "asc" },
      }),
      prisma.technicianConsentRecord.findFirst({
        where: { employeeId, consentType: "LOCATION_SURVEILLANCE" },
        orderBy: { acknowledgedAt: "desc" },
      }),
    ]);

    // 3. Compute Trajectory Statistics
    let totalDistanceKm = 0;
    let maxSpeedKmH = 0;
    let speedSum = 0;
    let speedCount = 0;
    let movingCount = 0;

    for (let i = 0; i < pings.length; i++) {
      const p = pings[i];
      if (p.speed != null) {
        if (p.speed > maxSpeedKmH) maxSpeedKmH = p.speed;
        speedSum += p.speed;
        speedCount++;
      }
      if (p.isMoving) {
        movingCount++;
      }

      if (i > 0) {
        const prev = pings[i - 1];
        const dist = calculateDistanceKm(prev.lat, prev.lng, p.lat, p.lng);
        // Discard GPS drift jitter (< 5 meters)
        if (dist >= 0.005 && dist < 150) {
          totalDistanceKm += dist;
        }
      }
    }

    const avgSpeedKmH = speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0;
    // Clip each gap to the selected interval before summing, so a gap that
    // started before (or ends after) the range only counts its in-range part.
    // A still-open gap (no gapEndAt) is clipped at the interval end.
    const clippedGapMinutes = (g: any) => {
      const gapStart = new Date(g.gapStartAt).getTime();
      const gapEnd = g.gapEndAt ? new Date(g.gapEndAt).getTime() : end.getTime();
      const clippedMs = Math.min(gapEnd, end.getTime()) - Math.max(gapStart, start.getTime());
      return Math.max(0, clippedMs / 60000);
    };
    const totalOfflineMinutes = gaps.reduce((acc: number, g: any) => acc + clippedGapMinutes(g), 0);

    const firstPing = pings[0];
    const lastPing = pings[pings.length - 1];
    const batteryStart = firstPing?.batteryLevel ?? null;
    const batteryEnd = lastPing?.batteryLevel ?? null;

    return NextResponse.json({
      employee,
      timeRange: { start: start.toISOString(), end: end.toISOString() },
      scope,
      consentStatus: {
        hasConsent: Boolean(consentRecord?.isAcknowledged),
        acknowledgedAt: consentRecord?.acknowledgedAt || null,
        policyVersion: consentRecord?.policyVersion || null,
      },
      summary: {
        totalPings: pings.length,
        totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
        avgSpeedKmH,
        maxSpeedKmH: Math.round(maxSpeedKmH * 10) / 10,
        movingPings: movingCount,
        stationaryPings: pings.length - movingCount,
        batteryStart,
        batteryEnd,
        batteryDrain:
          batteryStart != null && batteryEnd != null
            ? Math.max(0, Math.round((batteryStart - batteryEnd) * 10) / 10)
            : null,
        offlineIncidents: gaps.length,
        totalOfflineMinutes: Math.round(totalOfflineMinutes * 10) / 10,
      },
      pings: pings.map((p: any) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        speed: p.speed,
        batteryLevel: p.batteryLevel,
        isMoving: p.isMoving,
        isShiftActive: p.isShiftActive,
        activeJob: p.activeJob
          ? {
              id: p.activeJob.id,
              jobNumber: p.activeJob.jobNumber,
              status: p.activeJob.status,
              customerName: p.activeJob.customer.name,
            }
          : null,
        source: p.source,
        timestamp: p.timestamp.toISOString(),
      })),
      offlineGaps: gaps.map((g: any) => ({
        id: g.id,
        gapStartAt: g.gapStartAt.toISOString(),
        gapEndAt: g.gapEndAt?.toISOString() || null,
        // Duration clipped to the selected interval (matches the summary total)
        durationMinutes: Math.round(clippedGapMinutes(g) * 10) / 10,
        lastKnownLat: g.lastKnownLat,
        lastKnownLng: g.lastKnownLng,
        resumeLat: g.resumeLat,
        resumeLng: g.resumeLng,
        lastBatteryLevel: g.lastBatteryLevel,
        reason: g.reason,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
