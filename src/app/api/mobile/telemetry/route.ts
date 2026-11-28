export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import { pktParts, pktStartOfDay, pktEndOfDay } from "@/lib/pktTime";
import { assessIncomingFix } from "@/lib/locationIntegrity";

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { employeeId, lat, lng, batteryLevel, isMoving, speed } = body;

    // Accuracy radius (m) of this fix: null when the client reported none.
    // (Legacy builds sent `accuracy ?? 0`; 0 is treated as "unknown" by the
    // integrity rules, never as a perfect fix.) The mocked flag and the
    // device-side fix timestamp feed the position-integrity assessment.
    const rawAccuracy = (body as any).accuracy;
    const parsedAccuracy =
      rawAccuracy === undefined || rawAccuracy === null ? null : Number(rawAccuracy);
    const accuracyM =
      parsedAccuracy != null && Number.isFinite(parsedAccuracy) ? parsedAccuracy : null;
    const mocked = (body as any).mocked === true;
    const rawDeviceTs = (body as any).timestamp;
    const deviceTsMs =
      typeof rawDeviceTs === "string" || typeof rawDeviceTs === "number"
        ? new Date(rawDeviceTs).getTime()
        : NaN;
    const deviceTimestampMs = Number.isFinite(deviceTsMs) ? deviceTsMs : null;

    if (!employeeId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "employeeId, lat, and lng are required." },
        { status: 400 }
      );
    }

    if (caller.id !== employeeId && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to update telemetry for another employee." },
        { status: 403 }
      );
    }

    const now = new Date();

    // 1. Fetch current employee state to detect offline gaps & shift context
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        lastPingAt: true,
        lastPingAccuracy: true,
        lastGoodFixAt: true,
        active: true,
      },
    });

    if (!currentEmployee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    // 2. Check active shift and active job context
    // "On shift" reuses the attendance system's own definition of an open
    // session (AttendanceService.validateAndRecordAttendance classifies
    // today's punches exactly this way): a PKT-day AttendanceLog whose notes
    // carry the [CHECK_IN] prefix, with no [CHECK_OUT] log yet today.
    const { year, month, day } = pktParts(now);
    const dayStart = pktStartOfDay(year, month, day);
    const dayEnd = pktEndOfDay(year, month, day);

    const [todaysLogs, activeJob] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          employeeId,
          timestamp: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { timestamp: "asc" },
        select: { notes: true },
      }),
      prisma.job.findFirst({
        where: {
          assignedTechnicianId: employeeId,
          status: { in: ["InProgress", "Accepted"] },
        },
        select: { id: true, jobNumber: true, status: true },
      }),
    ]);

    const hasCheckIn = todaysLogs.some((l) => l.notes?.startsWith("[CHECK_IN]"));
    const hasCheckOut = todaysLogs.some((l) => l.notes?.startsWith("[CHECK_OUT]"));
    const isShiftActive = hasCheckIn && !hasCheckOut;
    const activeJobId = activeJob?.id || null;

    // 2b. On-shift-only tracking gate (owner rule, 2026-11-28): off shift,
    // the ping is acknowledged with the normal 200 response shape — so old
    // app builds neither break nor retry-storm — but NOTHING is stored: no
    // TechnicianLocationPing row, no Employee lat/lng/lastPingAt update, no
    // offline-gap log. The position freezes at its clock-out state, which is
    // what dispatch/surveillance and /api/technicians are meant to show.
    if (!isShiftActive) {
      const urgentRequests = await prisma.mobileAppRequest.findMany({
        where: {
          recipientId: employeeId,
          actionStatus: "pending",
          priority: { in: ["urgent", "high"] },
        },
        take: 5,
      });

      return NextResponse.json({
        success: true,
        technician: {
          id: currentEmployee.id,
          name: currentEmployee.name,
          lat: currentEmployee.lat,
          lng: currentEmployee.lng,
          lastPingAt: currentEmployee.lastPingAt,
        },
        pingId: null,
        isShiftActive: false,
        activeJobId,
        pendingUrgentCount: urgentRequests.length,
        urgentRequests,
        serverTime: now.toISOString(),
      });
    }

    // 2c. Position integrity: decide whether THIS fix may move the stored
    // position (see src/lib/locationIntegrity.ts for the rules + thresholds).
    // Mocked fixes never move the pin; stale fixes never move it backwards
    // in time; a sloppy fix (>100 m radius) never overwrites a recent,
    // better pinpoint. The ping row is still recorded either way — history
    // keeps the evidence, flagged by its accuracy / mocked flag.
    const decision = assessIncomingFix(
      { accuracyM, mocked, deviceTimestampMs, receivedAtMs: now.getTime() },
      {
        lat: currentEmployee.lat,
        lng: currentEmployee.lng,
        goodFixAtMs: currentEmployee.lastGoodFixAt
          ? new Date(currentEmployee.lastGoodFixAt).getTime()
          : null,
        accuracyM: currentEmployee.lastPingAccuracy ?? null,
      }
    );

    // 3. Offline Gap Detection (>= 10 minutes silence while active).
    // Skipped for mocked fixes: a fake "resume" point must not close a gap.
    if (!mocked && currentEmployee.lastPingAt) {
      const elapsedMinutes =
        (now.getTime() - new Date(currentEmployee.lastPingAt).getTime()) / (1000 * 60);
      if (elapsedMinutes >= 10 && currentEmployee.lat != null && currentEmployee.lng != null) {
        await prisma.offlineGapLog.create({
          data: {
            employeeId,
            gapStartAt: currentEmployee.lastPingAt,
            gapEndAt: now,
            durationMinutes: Math.round(elapsedMinutes * 10) / 10,
            lastKnownLat: currentEmployee.lat,
            lastKnownLng: currentEmployee.lng,
            resumeLat: Number(lat),
            resumeLng: Number(lng),
            lastBatteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
            reason: "HEARTBEAT_TIMEOUT",
          },
        });
      }
    }

    // 4. Record append-only historical location ping (throttled when stationary to conserve DB connections)
    const latDiff = Math.abs((currentEmployee.lat ?? 0) - Number(lat));
    const lngDiff = Math.abs((currentEmployee.lng ?? 0) - Number(lng));
    const isStationary = latDiff < 0.0001 && lngDiff < 0.0001;
    const isRecent = currentEmployee.lastPingAt && (now.getTime() - new Date(currentEmployee.lastPingAt).getTime()) < 60000;

    let locationPing: any = null;
    if (!isStationary || !isRecent) {
      locationPing = await prisma.technicianLocationPing.create({
        data: {
          employeeId,
          lat: Number(lat),
          lng: Number(lng),
          accuracy: accuracyM,
          mocked,
          speed: speed !== undefined ? Number(speed) : null,
          batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
          isMoving: Boolean(isMoving),
          isShiftActive,
          activeJobId,
          source: body.source || "mobile_gps",
          timestamp: now,
        },
      });
    }

    // 5. Update employee contact/position state.
    // - Mocked fix: NO Employee field changes at all — the stored position,
    //   its accuracy and the last-contact time all stay at the last honest
    //   fix. Only the ping row (mocked=true) records the attempt.
    // - Any other fix refreshes lastPingAt (the device is in contact), but
    //   lat/lng + lastPingAccuracy + lastGoodFixAt move ONLY when the
    //   integrity decision allows this fix to become the position.
    let employee: {
      id: string;
      name: string;
      lat: number | null;
      lng: number | null;
      lastPingAt: Date | null;
    } = {
      id: currentEmployee.id,
      name: currentEmployee.name,
      lat: currentEmployee.lat,
      lng: currentEmployee.lng,
      lastPingAt: currentEmployee.lastPingAt,
    };
    if (!mocked) {
      const updateData: Record<string, unknown> = { lastPingAt: now };
      if (decision.updatePosition) {
        updateData.lat = Number(lat);
        updateData.lng = Number(lng);
        updateData.lastPingAccuracy = accuracyM;
        updateData.lastGoodFixAt = now;
      }
      employee = await prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
        select: {
          id: true,
          name: true,
          lat: true,
          lng: true,
          lastPingAt: true,
        },
      });
    }

    // 6. Check for any urgent pending requests for this technician
    const urgentRequests = await prisma.mobileAppRequest.findMany({
      where: {
        recipientId: employeeId,
        actionStatus: "pending",
        priority: { in: ["urgent", "high"] },
      },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      technician: employee,
      // locationPing is null when the ping was throttled (stationary +
      // recent) — reading .id off it used to 500 the whole ingest even
      // though the employee position had already been updated.
      pingId: locationPing?.id ?? null,
      isShiftActive,
      activeJobId,
      // Position-integrity outcome for this ping (additive; older app
      // builds ignore these fields).
      positionUpdated: decision.updatePosition,
      positionReason: decision.reason,
      mockedRejected: mocked,
      pendingUrgentCount: urgentRequests.length,
      urgentRequests,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
