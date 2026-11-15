export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import {
  normalizeAppId,
  APP_ACCESS_FIELDS,
  APP_LABELS,
  appAccessSummary,
} from "@/lib/auth/appAccess";

/**
 * POST /api/employees/[id]/mobile-login/app-access
 * Enables or disables ONE of the three mobile apps for an employee
 * (per-app provisioning, managed from HR > Employees > Mobile Access).
 *
 * Body: { app: "main" | "bikes" | "hvac", enabled: boolean }
 *
 * Security:
 * - Strictly requires ADMIN_HR_ROLES via resolveCaller() (no self-service).
 * - Disabling the app that owns the employee's live session ends that session.
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
        { error: "Forbidden: Only administrators and HR personnel can change app access." },
        { status: 403 }
      );
    }

    // 3. Validate body
    const body = await req.json().catch(() => ({}));
    const app = normalizeAppId((body as any)?.app ?? (body as any)?.appId);
    const enabled = (body as any)?.enabled;
    if (!app || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Body must be { app: 'main' | 'bikes' | 'hvac', enabled: boolean }." },
        { status: 400 }
      );
    }

    // 4. Employee lookup
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        active: true,
        mobileLoginActive: true,
        mobileSessionId: true,
        mobileSessionApp: true,
        appAccessMain: true,
        appAccessBikes: true,
        appAccessHvac: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    // 5. Apply the flag; ending the live session if it belongs to a now-disabled app
    const field = APP_ACCESS_FIELDS[app];
    const killsSession = !enabled && employee.mobileSessionApp === app && !!employee.mobileSessionId;
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        [field]: enabled,
        ...(killsSession
          ? { mobileSessionId: null, mobileSessionApp: null, mobileSessionStartedAt: null }
          : {}),
      },
      select: { appAccessMain: true, appAccessBikes: true, appAccessHvac: true },
    });

    // 6. Audit Logging
    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: enabled ? "MOBILE_APP_ACCESS_ENABLED" : "MOBILE_APP_ACCESS_DISABLED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        callerId: caller.id,
        callerRole: caller.role,
        app,
        appLabel: APP_LABELS[app],
        enabled,
        sessionTerminated: killsSession,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${APP_LABELS[app]} access ${enabled ? "enabled" : "disabled"} for ${employee.name}.`,
      appAccess: appAccessSummary(updated),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update app access." },
      { status: 500 }
    );
  }
}
