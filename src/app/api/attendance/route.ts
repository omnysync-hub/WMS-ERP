export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/services/AttendanceService";
import { comparePassword, resolveCaller } from "@/lib/auth/mobileAuth";
import { requirePermission } from "@/lib/auth/erpActor";

const BACKUP_VERIFY_MAX_ATTEMPTS = 5;
const BACKUP_VERIFY_LOCK_MS = 15 * 60 * 1000;

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
    let employeeId = searchParams.get("employeeId") || undefined;
    const flaggedOnly = searchParams.get("flagged") === "true";
    const requestedLimit = Number(searchParams.get("limit") || "50");
    const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.trunc(requestedLimit))) : 50;

    const auth = req.headers.get("authorization") || "";
    const isMobile = auth.startsWith("Bearer ");
    const caller = isMobile ? await resolveCaller(req) : null;
    if (isMobile && !caller) {
      return NextResponse.json({ error: "Valid session required." }, { status: 401 });
    }
    if (!isMobile) {
      const gate = requirePermission(req, "hrm.attendance");
      if (gate.error) return gate.error;
    }
    if (isMobile && caller && !caller.isAdminOrHr) {
      if (employeeId && employeeId !== caller.id) {
        return NextResponse.json({ error: "You can only view your own attendance." }, { status: 403 });
      }
      employeeId = caller.id;
    }

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
        where: { flaggedForReview: true, ...(employeeId ? { employeeId } : {}) },
      }),
      prisma.geofenceZone.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.employee.findMany({
        where: { active: true, ...(isMobile && caller && !caller.isAdminOrHr ? { id: caller.id } : {}) },
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
      backupPassword,
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

    let backupVerified = false;
    if (backupPassword !== undefined) {
      if (caller.id !== employeeId) {
        return NextResponse.json(
          {
            status: "rejected",
            code: "BACKUP_VERIFY_FORBIDDEN",
            message: "Backup verification can only be used for your own check-in.",
          },
          { status: 403 }
        );
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          mobilePasswordHash: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
      });
      const now = new Date();
      if (employee?.lockedUntil && employee.lockedUntil > now) {
        return NextResponse.json(
          {
            status: "rejected",
            code: "BACKUP_VERIFY_LOCKED",
            message: "Too many incorrect attempts. Wait 15 minutes, then try again.",
          },
          { status: 429 }
        );
      }
      if (!employee?.mobilePasswordHash || typeof backupPassword !== "string") {
        return NextResponse.json(
          {
            status: "rejected",
            code: "BACKUP_VERIFY_UNAVAILABLE",
            message: "Backup verification is unavailable. Ask your administrator for help.",
          },
          { status: 400 }
        );
      }

      backupVerified = await comparePassword(backupPassword, employee.mobilePasswordHash);
      if (!backupVerified) {
        const attempts = (employee.failedLoginAttempts || 0) + 1;
        const shouldLock = attempts >= BACKUP_VERIFY_MAX_ATTEMPTS;
        await prisma.employee.update({
          where: { id: employeeId },
          data: {
            failedLoginAttempts: shouldLock ? 0 : attempts,
            lockedUntil: shouldLock ? new Date(now.getTime() + BACKUP_VERIFY_LOCK_MS) : null,
          },
        });
        return NextResponse.json(
          {
            status: "rejected",
            code: shouldLock ? "BACKUP_VERIFY_LOCKED" : "BACKUP_VERIFY_FAILED",
            message: shouldLock
              ? "Too many incorrect attempts. Wait 15 minutes, then try again."
              : "That work password is incorrect.",
          },
          { status: shouldLock ? 429 : 401 }
        );
      }

      await prisma.employee.update({
        where: { id: employeeId },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
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
      backupVerified,
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
    const gate = requirePermission(req, "hrm.attendance");
    if (gate.error) return gate.error;
    const body = await req.json();
    const { logId, notes, action = "approve" } = body;

    if (!logId) {
      return NextResponse.json(
        { error: "logId is required to resolve attendance flag." },
        { status: 400 }
      );
    }

    const updated = await AttendanceService.resolveFlaggedLog({
      logId,
      resolvedBy: gate.actor.name,
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
