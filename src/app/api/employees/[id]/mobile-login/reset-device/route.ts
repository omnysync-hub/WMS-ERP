export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * POST /api/employees/[id]/mobile-login/reset-device
 * Unbinds the currently registered physical device identity (mobileDeviceId, mobileDeviceLabel, mobileSessionId).
 * Allows the technician to log into the mobile app on a new or wiped phone.
 *
 * Security:
 * - Strictly requires ADMIN_HR_ROLES via resolveCaller() (no self-service).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const employeeId = params.id;

    // 1. Authenticate caller
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    // 2. Authorization check: Admin/HR roles only
    if (!caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators and HR personnel can reset device bindings." },
        { status: 403 }
      );
    }

    // 3. Employee lookup
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        active: true,
        mobileDeviceId: true,
        mobileDeviceLabel: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    // 4. Reset device binding and unlock
    const now = new Date();
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        mobileDeviceId: null,
        mobileDeviceLabel: null,
        mobileSessionId: null,
        mobileSessionStartedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 5. Audit Logging
    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "MOBILE_DEVICE_UNBOUND",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        callerId: caller.id,
        callerRole: caller.role,
        previousDeviceId: employee.mobileDeviceId,
        previousDeviceLabel: employee.mobileDeviceLabel,
        unboundAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Device binding released successfully. The technician can now sign in on their phone.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to release device binding." },
      { status: 500 }
    );
  }
}
