export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * Mobile Leave Management API
 * Provides a dedicated endpoint for the mobile app to fetch leave balances,
 * company holidays, leave request history, and submit new leave requests.
 */

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId query parameter is required." },
        { status: 400 }
      );
    }

    if (caller.id !== employeeId && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view leave balances for another employee." },
        { status: 403 }
      );
    }

    const [requests, leaveTypes, holidays, balances] = await Promise.all([
      HrmService.listLeaveRequests({ employeeId }),
      prisma.leaveType.findMany(),
      HrmService.getCompanyHolidays(),
      prisma.leaveBalance.findMany({
        where: { employeeId },
        include: { leaveType: true },
      }),
    ]);

    // Format balances into an easy-to-consume dictionary for the mobile UI
    const balancesSummary: Record<string, any> = {};
    for (const b of balances) {
      const key = b.leaveType.name.toLowerCase().split(" ")[0]; // "annual", "casual", "sick"
      balancesSummary[key] = {
        leaveTypeId: b.leaveTypeId,
        name: b.leaveType.name,
        allocated: b.accrued,
        used: b.taken,
        remaining: b.balance,
      };
    }

    return NextResponse.json({
      balances: balancesSummary,
      rawBalances: balances,
      leaveTypes,
      holidays,
      requests,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { employeeId, startDate, endDate, reason } = body;
    let { leaveTypeId, leaveType } = body;

    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "employeeId, startDate, and endDate are required." },
        { status: 400 }
      );
    }

    if (caller.id !== employeeId && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to submit a leave request for another employee." },
        { status: 403 }
      );
    }

    // Resolve leaveTypeId if name/slug was passed
    if (!leaveTypeId && leaveType) {
      const match = await prisma.leaveType.findFirst({
        where: {
          name: { contains: leaveType, mode: "insensitive" },
        },
      });
      if (match) leaveTypeId = match.id;
    }

    if (!leaveTypeId) {
      // Default to first leave type or Casual leave
      const fallback = await prisma.leaveType.findFirst();
      leaveTypeId = fallback?.id;
    }

    if (!leaveTypeId) {
      return NextResponse.json(
        { error: "No valid leave type configured in ERP." },
        { status: 400 }
      );
    }

    const result = await HrmService.requestLeave({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason: reason || "Personal leave",
    });

    return NextResponse.json({ success: true, leaveRequest: result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
