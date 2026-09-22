export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * POST /api/employees/[id]/mobile-login/reactivate
 * Reactivates mobile app access without resetting the existing PIN credentials.
 *
 * Security:
 * - Strictly requires ADMIN_HR_ROLES via resolveCaller() (no self-service).
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
        { error: "Forbidden: Only administrators and HR personnel can reactivate mobile app credentials." },
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
        mobilePinHash: true,
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
        { error: "Cannot reactivate mobile access for an inactive or terminated employee." },
        { status: 403 }
      );
    }

    // 4. Update status (preserving PIN and reset requirements)
    const now = new Date();
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        mobileLoginActive: true,
      },
    });

    // 5. Audit Logging
    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "MOBILE_LOGIN_REACTIVATED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        callerId: caller.id,
        callerRole: caller.role,
        reactivatedAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Mobile app access reactivated successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reactivate mobile app access." },
      { status: 500 }
    );
  }
}
