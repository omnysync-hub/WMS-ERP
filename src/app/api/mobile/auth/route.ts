export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/auth/mobileAuth";

/**
 * Mobile Authentication & Profile Hydration API
 * Handles login, session verification, and initial mobile state hydration for both
 * Field Technicians and Office/General Staff.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email, employeeId, pin } = body;

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

    if (!employee.active) {
      return NextResponse.json(
        { error: "Account has been suspended or deactivated. Contact HR." },
        { status: 403 }
      );
    }

    // Issue cryptographically signed mobile session token (HMAC-SHA256)
    const token = signMobileToken(employee.id);

    return NextResponse.json({
      success: true,
      token,
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
