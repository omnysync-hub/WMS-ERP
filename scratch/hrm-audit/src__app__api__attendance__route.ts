export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/services/AttendanceService";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * Attendance Verification & Audit API
 * Handles:
 * - GET: Fetch logs, flagged-for-review items, active geofence zones, and active employee roster
 * - POST: Submits biometric/geofenced punch with server-side validation & velocity jump detection
 * - PATCH: Administrator action to review, approve, or dismiss flagged attendance logs
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const flaggedOnly = searchParams.get("flagged") === "true";
    const limit = Number(searchParams.get("limit") || "50");

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (flaggedOnly) where.flaggedForReview = true;

    const [logs, flaggedCount, zones, employees] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              designation: true,
            },
          },
          geofenceZone: true,
        },
        orderBy: { timestamp: "desc" },
        take: limit,
      }),
      prisma.attendanceLog.count({
        where: { flaggedForReview: true },
      }),
      prisma.geofenceZone.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.employee.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          role: true,
          department: true,
          designation: true,
          faceEnrolled: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      logs,
      flaggedCount,
      zones,
      employees,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        {
          status: "rejected",
          code: "UNAUTHORIZED",
          message: "Authentication required. Missing or invalid authorization credentials.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      employeeId,
      geofenceZoneId,
      lat,
      lng,
      timestamp,
      faceMatchScore,
      livenessScore,
      deviceId,
      notes,
    } = body;

    if (!employeeId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        {
          status: "rejected",
          code: "MISSING_REQUIRED_FIELDS",
          message: "employeeId, lat, and lng are required fields.",
        },
        { status: 400 }
      );
    }

    if (caller.id !== employeeId && !caller.isAdminOrHr) {
      return NextResponse.json(
        {
          status: "rejected",
          code: "FORBIDDEN",
          message: "You are not authorized to submit attendance records for another employee.",
        },
        { status: 403 }
      );
    }

    const result = await AttendanceService.validateAndRecordAttendance({
      employeeId,
      geofenceZoneId,
      lat: Number(lat),
      lng: Number(lng),
      timestamp,
      faceMatchScore: faceMatchScore !== undefined ? Number(faceMatchScore) : undefined,
      livenessScore: livenessScore !== undefined && livenessScore !== null ? Number(livenessScore) : undefined,
      deviceId,
      notes,
    });

    if (result.status === "rejected") {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "rejected",
        code: "SERVER_ERROR",
        message: err.message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { logId, resolvedBy = "HR Administrator", notes, action = "approve" } = body;

    if (!logId) {
      return NextResponse.json(
        { error: "logId is required to resolve attendance flag." },
        { status: 400 }
      );
    }

    const updated = await AttendanceService.resolveFlaggedLog({
      logId,
      resolvedBy,
      notes,
      action: action === "dismiss" ? "dismiss" : "approve",
    });

    return NextResponse.json({
      success: true,
      message: `Attendance flag ${action === "approve" ? "approved" : "dismissed"} successfully.`,
      log: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
