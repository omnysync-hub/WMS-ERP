export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signMobileToken,
  comparePin,
  MOBILE_LOGIN_LOCKOUT_THRESHOLD,
  MOBILE_LOGIN_LOCKOUT_MINUTES,
} from "@/lib/auth/mobileAuth";

/**
 * Mobile Authentication & Profile Hydration API
 * Handles login, session verification, and initial mobile state hydration for both
 * Field Technicians and Office/General Staff.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email, employeeId, pin } = body;

    // 1. PIN is mandatory for mobile authentication
    if (!pin || typeof pin !== "string" || pin.trim().length === 0) {
      return NextResponse.json(
        { error: "PIN is required for mobile authentication." },
        { status: 400 }
      );
    }

    let employee = null;

    if (employeeId) {
      employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });
    } else if (phone) {
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
      employee = await prisma.employee.findFirst({
        where: {
          phone: {
            contains: cleanPhone.slice(-7), // Matches last 7 digits to tolerate country code variations
          },
          active: true,
        },
      });
    } else if (email) {
      employee = await prisma.employee.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          active: true,
        },
      });
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found or account is deactivated. Please check credentials." },
        { status: 401 }
      );
    }

    // 2. Account general active check
    if (!employee.active) {
      return NextResponse.json(
        { error: "Account has been suspended or deactivated. Contact HR." },
        { status: 403 }
      );
    }

    // 3. Mobile access provisioned and active check
    if (!employee.mobileLoginActive) {
      return NextResponse.json(
        { error: "Mobile app access is deactivated or not provisioned for this account. Contact HR." },
        { status: 403 }
      );
    }

    // 4. Brute-force lockout check
    const now = new Date();
    if (employee.lockedUntil && new Date(employee.lockedUntil) > now) {
      const remainingSeconds = Math.ceil(
        (new Date(employee.lockedUntil).getTime() - now.getTime()) / 1000
      );
      const remainingMinutes = Math.ceil(remainingSeconds / 60);

      return NextResponse.json(
        {
          error: `Account is temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minute(s).`,
          isLocked: true,
          lockedUntil: employee.lockedUntil,
          remainingSeconds,
          remainingMinutes,
        },
        {
          status: 423, // 423 Locked
          headers: { "Retry-After": remainingSeconds.toString() },
        }
      );
    }

    // 5. PIN Hash presence check
    if (!employee.mobilePinHash) {
      return NextResponse.json(
        { error: "Mobile PIN has not been provisioned. Please contact HR to set up your mobile login." },
        { status: 401 }
      );
    }

    // 6. Cryptographic PIN verification
    const isPinValid = await comparePin(pin.trim(), employee.mobilePinHash);

    if (!isPinValid) {
      const nextFailedAttempts = (employee.failedLoginAttempts || 0) + 1;

      if (nextFailedAttempts >= MOBILE_LOGIN_LOCKOUT_THRESHOLD) {
        const lockoutUntil = new Date(Date.now() + MOBILE_LOGIN_LOCKOUT_MINUTES * 60 * 1000);
        await prisma.employee.update({
          where: { id: employee.id },
          data: {
            failedLoginAttempts: nextFailedAttempts,
            lockedUntil: lockoutUntil,
          },
        });

        return NextResponse.json(
          {
            error: `Incorrect PIN. Maximum failed attempts (${MOBILE_LOGIN_LOCKOUT_THRESHOLD}) reached. Account is locked for ${MOBILE_LOGIN_LOCKOUT_MINUTES} minutes.`,
            isLocked: true,
            lockedUntil: lockoutUntil,
            remainingAttempts: 0,
          },
          { status: 401 }
        );
      }

      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          failedLoginAttempts: nextFailedAttempts,
        },
      });

      const remainingAttempts = MOBILE_LOGIN_LOCKOUT_THRESHOLD - nextFailedAttempts;
      return NextResponse.json(
        {
          error: `Incorrect PIN. Please try again. ${remainingAttempts} attempt(s) remaining.`,
          remainingAttempts,
        },
        { status: 401 }
      );
    }

    // 7. Successful login: Reset failed attempts & lockout
    if (employee.failedLoginAttempts > 0 || employee.lockedUntil) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    // Issue cryptographically signed mobile session token (HMAC-SHA256)
    const token = signMobileToken(employee.id);

    return NextResponse.json({
      success: true,
      token,
      mustResetPinOnNextLogin: employee.mustResetPinOnNextLogin,
      employee: {
        id: employee.id,
        name: employee.name,
        phone: employee.phone,
        email: employee.email,
        role: employee.role, // "technician" | "dispatcher" | "accountant" | "admin" | "storekeeper" | "call_center" | "hr"
        department: employee.department,
        designation: employee.designation,
        employmentType: employee.employmentType,
        faceEnrolled: employee.faceEnrolled,
        status: employee.status,
        reportingManagerId: employee.reportingManagerId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId query parameter is required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        reportingManager: {
          select: { id: true, name: true, phone: true, designation: true },
        },
        leaveBalances: {
          include: { leaveType: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    let technicianData = null;

    if (employee.role === "technician") {
      const [activeJobsCount, unreadRequestsCount, pendingAdvances] = await Promise.all([
        prisma.job.count({
          where: {
            assignedTechnicianId: employee.id,
            status: { in: ["Assigned", "Accepted", "InProgress", "Paused"] },
          },
        }),
        prisma.mobileAppRequest.count({
          where: {
            recipientId: employee.id,
            deliveryStatus: { in: ["queued", "sent", "delivered"] },
          },
        }),
        prisma.employeeAdvance.findMany({
          where: { employeeId: employee.id, status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      technicianData = {
        activeJobsCount,
        unreadRequestsCount,
        pendingAdvances,
      };
    }

    const recentAttendance = await prisma.attendanceLog.findMany({
      where: { employeeId: employee.id },
      orderBy: { timestamp: "desc" },
      take: 7,
    });

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        phone: employee.phone,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        designation: employee.designation,
        employmentType: employee.employmentType,
        faceEnrolled: employee.faceEnrolled,
        status: employee.status,
        joinDate: employee.joinDate,
        reportingManager: employee.reportingManager,
      },
      leaveBalances: employee.leaveBalances,
      recentAttendance,
      technicianData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
