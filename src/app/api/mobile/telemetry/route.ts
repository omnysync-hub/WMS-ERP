export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

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
    const { employeeId, lat, lng, accuracy, batteryLevel, isMoving, speed } = body;

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
        active: true,
      },
    });

    if (!currentEmployee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    // 2. Check active shift and active job context
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [todayAttendance, activeJob] = await Promise.all([
      prisma.attendanceLog.findFirst({
        where: {
          employeeId,
          timestamp: { gte: todayStart },
          result: "pass",
        },
        select: { id: true },
      }),
      prisma.job.findFirst({
        where: {
          assignedTechnicianId: employeeId,
          status: { in: ["InProgress", "Accepted"] },
        },
        select: { id: true, jobNumber: true, status: true },
      }),
    ]);

    const isShiftActive = Boolean(todayAttendance || activeJob);
    const activeJobId = activeJob?.id || null;

    // 3. Offline Gap Detection (>= 10 minutes silence while active)
    if (currentEmployee.lastPingAt) {
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

    // 4. Record append-only historical location ping
    const locationPing = await prisma.technicianLocationPing.create({
      data: {
        employeeId,
        lat: Number(lat),
        lng: Number(lng),
        accuracy: accuracy !== undefined ? Number(accuracy) : null,
        speed: speed !== undefined ? Number(speed) : null,
        batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
        isMoving: Boolean(isMoving),
        isShiftActive,
        activeJobId,
        source: body.source || "mobile_gps",
        timestamp: now,
      },
    });

    // 5. Update employee latest GPS location & timestamp
    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        lat: Number(lat),
        lng: Number(lng),
        lastPingAt: now,
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        lastPingAt: true,
      },
    });

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
      pingId: locationPing.id,
      isShiftActive,
      activeJobId,
      pendingUrgentCount: urgentRequests.length,
      urgentRequests,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
