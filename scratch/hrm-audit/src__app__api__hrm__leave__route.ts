export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const typesOnly = searchParams.get("typesOnly") === "true";
    const holidaysOnly = searchParams.get("holidaysOnly") === "true";

    if (holidaysOnly) {
      const holidays = await HrmService.getCompanyHolidays();
      return NextResponse.json({ holidays });
    }

    if (typesOnly) {
      const leaveTypes = await prisma.leaveType.findMany();
      return NextResponse.json({ leaveTypes });
    }

    const [requests, leaveTypes, holidays] = await Promise.all([
      HrmService.listLeaveRequests({ employeeId, status }),
      prisma.leaveType.findMany(),
      HrmService.getCompanyHolidays(),
    ]);

    let balances: any[] = [];
    if (employeeId) {
      balances = await prisma.leaveBalance.findMany({
        where: { employeeId },
        include: { leaveType: true },
      });
    }

    return NextResponse.json({ requests, leaveTypes, holidays, balances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "request";

    if (action === "request") {
      const result = await HrmService.requestLeave({
        employeeId: body.employeeId,
        leaveTypeId: body.leaveTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
      });
      return NextResponse.json({ leaveRequest: result }, { status: 201 });
    } else if (action === "approve") {
      const result = await HrmService.approveLeave(
        body.requestId,
        body.approverName || "HR Manager"
      );
      return NextResponse.json({ leaveRequest: result });
    } else if (action === "reject") {
      const result = await HrmService.rejectLeave(
        body.requestId,
        body.approverName || "HR Manager",
        body.reason
      );
      return NextResponse.json({ leaveRequest: result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
