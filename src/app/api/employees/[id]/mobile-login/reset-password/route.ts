export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import {
  resolveCaller,
  ADMIN_HR_ROLES,
  validatePasswordStrength,
  hashPassword,
} from "@/lib/auth/mobileAuth";

/**
 * POST /api/employees/[id]/mobile-login/reset-password
 * Directly resets an employee's mobile app password.
 * Clears failedLoginAttempts and lockedUntil so the employee can immediately log in.
 *
 * Security:
 * - Strictly requires ADMIN_HR_ROLES via resolveCaller() (no self-service).
 * - Admin provides new password directly in the request body.
 * - Password length & strength validated (min 6 chars).
 * - Plaintext password is NOT returned in response body.
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
        { error: "Forbidden: Only administrators and HR personnel can reset mobile credentials." },
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
        { error: "Cannot reset mobile password for an inactive or terminated employee." },
        { status: 403 }
      );
    }

    // 4. Parse and validate input
    const body = await req.json();
    const passwordInput = body.password || body.pin;

    const validation = validatePasswordStrength(passwordInput);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Password does not meet minimum strength requirements." },
        { status: 400 }
      );
    }

    // 5. Hash and update password
    const passwordHash = await hashPassword(passwordInput);
    const now = new Date();

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        mobilePasswordHash: passwordHash,
        mobilePasswordSetAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 6. Audit Logging (never log the password)
    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "MOBILE_LOGIN_PASSWORD_RESET",
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
      message: "Mobile password reset successfully. The employee can now log in immediately with this password.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reset mobile password." },
      { status: 500 }
    );
  }
}
