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

    // 1. Update employee GPS location & timestamp
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

    // 2. Check for any urgent pending requests for this technician
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
      pendingUrgentCount: urgentRequests.length,
      urgentRequests,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
