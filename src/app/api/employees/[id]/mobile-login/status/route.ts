export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * GET /api/employees/[id]/mobile-login/status
 * Retrieves the mobile login credentials status for an employee.
 * Strictly omits mobilePinHash.
 *
 * Security:
 * - Requires authentication.
 * - Caller must be an Admin/HR role or the target employee themselves.
 */
export async function GET(
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

    // 2. Authorization check: Admin/HR or target employee
    const isSelf = caller.id === employeeId;
    if (!isSelf && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this employee's mobile login status." },
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
        mustResetPinOnNextLogin: true,
        mobilePinSetAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    const isLocked = !!(employee.lockedUntil && new Date(employee.lockedUntil) > new Date());
    const remainingLockoutSeconds = isLocked
      ? Math.max(0, Math.ceil((new Date(employee.lockedUntil!).getTime() - Date.now()) / 1000))
      : 0;

    return NextResponse.json({
      employeeId: employee.id,
      name: employee.name,
      employeeActive: employee.active,
      mobileLoginActive: employee.mobileLoginActive,
      mustResetPinOnNextLogin: employee.mustResetPinOnNextLogin,
      mobilePinSetAt: employee.mobilePinSetAt,
      failedLoginAttempts: employee.failedLoginAttempts,
      lockedUntil: employee.lockedUntil,
      isLocked,
      remainingLockoutSeconds,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retrieve mobile login status." },
      { status: 500 }
    );
  }
}
