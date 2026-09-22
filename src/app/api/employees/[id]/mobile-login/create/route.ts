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
 * POST /api/employees/[id]/mobile-login/create
 * Sets an employee's mobile app password (and optional username) directly from the ERP.
 *
 * Security:
 * - Strictly requires ADMIN_HR_ROLES via resolveCaller() (no self-service).
 * - Admin supplies password directly in request body.
 * - Password length & strength validated (min 6 chars).
 * - Password hashed and stored in mobilePasswordHash.
 * - Plaintext password is NOT returned in response body.
 * - Rejects if mobile login already active (admin must use reset-password instead).
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
        { error: "Forbidden: Only administrators and HR personnel can provision mobile app credentials." },
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
        { error: "Cannot provision mobile credentials for an inactive or terminated employee." },
        { status: 403 }
      );
    }

    // 4. Reject if already active
    if (employee.mobileLoginActive) {
      return NextResponse.json(
        { error: "Mobile login is already active for this employee. Use the reset-password endpoint to change credentials." },
        { status: 400 }
      );
    }

    // 5. Parse and validate input
    const body = await req.json();
    const passwordInput = body.password || body.pin;
    const usernameInput = body.username ? String(body.username).trim().toLowerCase() : null;

    const validation = validatePasswordStrength(passwordInput);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Password does not meet minimum strength requirements." },
        { status: 400 }
      );
    }

    // Check username uniqueness if provided
    if (usernameInput) {
      const existingUser = await prisma.employee.findFirst({
        where: {
          mobileUsername: usernameInput,
          id: { not: employeeId },
        },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: `Username "${usernameInput}" is already taken by another employee.` },
          { status: 409 }
        );
      }
    }

    // 6. Hash and store password
    const passwordHash = await hashPassword(passwordInput);
    const now = new Date();

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        mobileLoginActive: true,
        mobileUsername: usernameInput || undefined,
        mobilePasswordHash: passwordHash,
        mobilePasswordSetAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 7. Audit Logging (never log the password)
    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "MOBILE_LOGIN_CREATED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        callerId: caller.id,
        callerRole: caller.role,
        hasCustomUsername: !!usernameInput,
        provisionedAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Mobile login credentials created successfully. The employee can now log in immediately with this password.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create mobile login credentials." },
      { status: 500 }
    );
  }
}
