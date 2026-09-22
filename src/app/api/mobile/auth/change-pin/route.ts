export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import {
  resolveCaller,
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from "@/lib/auth/mobileAuth";

/**
 * POST /api/mobile/auth/change-pin
 * Authenticated self-service endpoint for employees to update their mobile password/PIN.
 *
 * Security:
 * - Requires a valid mobile session token or authenticated employee credentials.
 * - Requires verification of current password to prevent unauthorized changes.
 * - Enforces minimum length >= 6.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing, expired, or deactivated session token." },
        { status: 401 }
      );
    }

    // 2. Fetch full employee record with security credentials
    const employee = await prisma.employee.findUnique({
      where: { id: caller.id },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        mobileLoginActive: true,
        mobilePasswordHash: true,
      },
    });

    if (!employee || !employee.active) {
      return NextResponse.json(
        { error: "Account is deactivated or not found." },
        { status: 403 }
      );
    }

    if (!employee.mobileLoginActive) {
      return NextResponse.json(
        { error: "Mobile app access is deactivated for this account." },
        { status: 403 }
      );
    }

    // 3. Parse and validate body
    const body = await req.json();
    const currentInput = body.currentPassword || body.currentPin;
    const newInput = body.newPassword || body.newPin;

    const validation = validatePasswordStrength(newInput);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "New password does not meet requirements." },
        { status: 400 }
      );
    }

    // 4. Verify current password
    if (employee.mobilePasswordHash) {
      if (!currentInput || typeof currentInput !== "string") {
        return NextResponse.json(
          { error: "Current password is required to change your password." },
          { status: 400 }
        );
      }

      const isCurrentValid = await comparePassword(currentInput.trim(), employee.mobilePasswordHash);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 401 }
        );
      }

      // Prevent re-using the exact same password
      const isSame = await comparePassword(String(newInput).trim(), employee.mobilePasswordHash);
      if (isSame) {
        return NextResponse.json(
          { error: "New password must be different from your current password." },
          { status: 400 }
        );
      }
    }

    // 5. Hash and persist new password
    const newHash = await hashPassword(newInput);
    const now = new Date();

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        mobilePasswordHash: newHash,
        mobilePasswordSetAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 6. Audit Logging (never include plaintext password or hash)
    await AuditService.logActivity({
      actorName: employee.name,
      actorRole: employee.role,
      actorId: employee.id,
      category: "DATA_MUTATION",
      action: "MOBILE_LOGIN_PASSWORD_CHANGED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        changedAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Mobile password updated successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update mobile password." },
      { status: 500 }
    );
  }
}
