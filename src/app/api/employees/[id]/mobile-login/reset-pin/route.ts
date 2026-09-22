export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import {
  resolveCaller,
  ADMIN_HR_ROLES,
  generateTempPin,
  hashPin,
} from "@/lib/auth/mobileAuth";

/**
 * POST /api/employees/[id]/mobile-login/reset-pin
 * Resets an employee's mobile PIN, generating a new temporary PIN.
 * Sets mustResetPinOnNextLogin = true, clears failed login attempts and lockout.
 *
 * Security:
 * - Strictly requires ADMIN_HR_ROLES via resolveCaller() (no self-service).
 * - Plaintext temp PIN returned ONCE in the response body only.
 * - Never logged or stored in plaintext.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
        { error: "Forbidden: Only administrators and HR personnel can reset mobile PIN credentials." },
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
        mobileLoginActive: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    if (!employee.active) {
      return NextResponse.json(
        { error: "Cannot reset mobile PIN for an inactive or terminated employee." },
        { status: 403 }
      );
    }

    // 4. Generate and hash temporary PIN
    const tempPin = generateTempPin();
    const pinHash = await hashPin(tempPin);
    const now = new Date();

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        mobilePinHash: pinHash,
        mobilePinSetAt: now,
        mustResetPinOnNextLogin: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 5. Audit Logging (never include plaintext PIN or hash)
    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "MOBILE_LOGIN_PIN_RESET",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        callerId: caller.id,
        callerRole: caller.role,
        resetAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      tempPin,
      message: "Mobile PIN reset successfully. Please copy the temporary PIN immediately; it will not be displayed again.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reset mobile PIN." },
      { status: 500 }
    );
  }
}
