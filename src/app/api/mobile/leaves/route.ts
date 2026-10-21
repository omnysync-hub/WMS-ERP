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
    console.error("Mobile leaves GET failed", err);
    return NextResponse.json({ error: "Could not load leaves. Try again." }, { status: 500 });
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

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Enter valid start and end dates." }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json({ error: "The end date cannot be before the start date." }, { status: 400 });
    }

    const allTypes = await prisma.leaveType.findMany({ select: { id: true, name: true } });
    if (allTypes.length === 0) {
      return NextResponse.json(
        {
          error: "Leave types are not set up in the ERP yet. Ask HR to add them (HR › Leave › Leave types, or Restore defaults), then try again.",
          code: "NO_LEAVE_TYPES",
        },
        { status: 400 }
      );
    }

    // Accept a real leave type id; ignore placeholders such as "unpaid" sent by older app builds.
    if (leaveTypeId && !allTypes.some((t) => t.id === leaveTypeId)) leaveTypeId = undefined;

    // Resolve by name/slug ("sick" -> "Sick Leave"): exact first word, then contains.
    if (!leaveTypeId && leaveType) {
      const wanted = String(leaveType).trim().toLowerCase();
      const match =
        allTypes.find((t) => t.name.toLowerCase().split(" ")[0] === wanted) ||
        allTypes.find((t) => t.name.toLowerCase().includes(wanted));
      if (!match) {
        return NextResponse.json(
          {
            error: `"${String(leaveType)}" leave is not set up in the ERP. Available: ${allTypes.map((t) => t.name).join(", ")}. Ask HR to add it or pick another type.`,
            code: "LEAVE_TYPE_NOT_FOUND",
          },
          { status: 400 }
        );
      }
      leaveTypeId = match.id;
    }

    if (!leaveTypeId) {
      return NextResponse.json({ error: "Choose a leave type.", code: "LEAVE_TYPE_REQUIRED" }, { status: 400 });
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
    // Business-rule messages from HrmService (e.g. insufficient balance) are safe to show;
    // database errors are logged and replaced with a plain sentence.
    const msg = String(err?.message || "");
    if (err?.code || /prisma|invalid `|foreign key|constraint/i.test(msg)) {
      console.error("Mobile leave request failed", err);
      return NextResponse.json({ error: "The leave request could not be saved. Try again or contact HR." }, { status: 400 });
    }
    return NextResponse.json({ error: msg || "The leave request could not be saved." }, { status: 400 });
  }
}
