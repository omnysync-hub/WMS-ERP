export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { prisma } from "@/lib/prisma";
import { resolveJobsActor, roleHasPermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let employeeId = searchParams.get("employeeId") || undefined;
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

    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const canManage = roleHasPermission(resolved.actor.role, "hrm.manage_employees");
    if (!canManage) {
      if (employeeId && employeeId !== resolved.actor.id) {
        return NextResponse.json({ error: "You can only view your own leave records." }, { status: 403 });
      }
      employeeId = resolved.actor.id;
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
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const canManage = roleHasPermission(resolved.actor.role, "hrm.manage_employees");
    const body = await req.json();
    const action = body.action || "request";

    if (action === "request") {
      const result = await HrmService.requestLeave({
        employeeId: canManage && typeof body.employeeId === "string" ? body.employeeId : resolved.actor.id,
        leaveTypeId: body.leaveTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
      });
      return NextResponse.json({ leaveRequest: result }, { status: 201 });
    } else if (action === "approve") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can approve leave." }, { status: 403 });
      const result = await HrmService.approveLeave(
        body.requestId,
        resolved.actor.name
      );
      return NextResponse.json({ leaveRequest: result });
    } else if (action === "reject") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can reject leave." }, { status: 403 });
      const result = await HrmService.rejectLeave(
        body.requestId,
        resolved.actor.name,
        body.reason
      );
      return NextResponse.json({ leaveRequest: result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
