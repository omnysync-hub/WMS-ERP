export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import {
  resolveCaller,
  comparePin,
  hashPin,
} from "@/lib/auth/mobileAuth";

/**
 * POST /api/mobile/auth/change-pin
 * Authenticated self-service endpoint for employees to update their mobile PIN.
 * Required during the forced first-login reset flow, and available for routine self-service changes.
 *
 * Security:
 * - Requires a valid mobile session token or authenticated employee credentials.
 * - Requires verification of current PIN to prevent unauthorized hijacking.
 * - Clears mustResetPinOnNextLogin upon successful change.
 * - Enforces minimum complexity (4-8 numeric digits).
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
        mobilePinHash: true,
        mustResetPinOnNextLogin: true,
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
    const { currentPin, newPin } = body;

    if (!newPin || typeof newPin !== "string") {
      return NextResponse.json(
        { error: "A new numeric PIN is required." },
        { status: 400 }
      );
    }

    const trimmedNewPin = newPin.trim();
    if (!/^\d{4,8}$/.test(trimmedNewPin)) {
      return NextResponse.json(
        { error: "PIN must consist of 4 to 8 digits (e.g. 6 digits)." },
        { status: 400 }
      );
    }

    // 4. Verify current PIN
    // If the employee already has a PIN hash, verify current PIN
    if (employee.mobilePinHash) {
      if (!currentPin || typeof currentPin !== "string") {
        return NextResponse.json(
          { error: "Current PIN is required to change your PIN." },
          { status: 400 }
        );
      }

      const isCurrentValid = await comparePin(currentPin.trim(), employee.mobilePinHash);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Incorrect current PIN." },
          { status: 401 }
        );
      }
    }

    // Prevent re-using the exact same PIN
    if (employee.mobilePinHash) {
      const isSame = await comparePin(trimmedNewPin, employee.mobilePinHash);
      if (isSame) {
        return NextResponse.json(
          { error: "New PIN must be different from your current PIN." },
          { status: 400 }
        );
      }
    }

    // 5. Hash and persist new PIN
    const newHash = await hashPin(trimmedNewPin);
    const now = new Date();

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        mobilePinHash: newHash,
        mobilePinSetAt: now,
        mustResetPinOnNextLogin: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 6. Audit Logging (never include plaintext PIN or hash)
    await AuditService.logActivity({
      actorName: employee.name,
      actorRole: employee.role,
      actorId: employee.id,
      category: "DATA_MUTATION",
      action: "MOBILE_LOGIN_PIN_CHANGED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        wasForcedReset: employee.mustResetPinOnNextLogin,
        changedAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Mobile PIN updated successfully.",
      mustResetPinOnNextLogin: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update mobile PIN." },
      { status: 500 }
    );
  }
}
