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

    if (action === "create_leave_type") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can configure leave types." }, { status: 403 });
      const name = String(body.name || "").trim();
      const accrualRule = String(body.accrualRule || "").trim();
      const maxDays = Number(body.maxDays);
      if (!name || !accrualRule || !Number.isFinite(maxDays) || maxDays <= 0) {
        return NextResponse.json({ error: "Name, accrual rule, and a positive annual allowance are required." }, { status: 400 });
      }
      const existing = await prisma.leaveType.findFirst({ where: { name } });
      if (existing) return NextResponse.json({ error: "A leave type with this name already exists." }, { status: 409 });
      const leaveType = await prisma.leaveType.create({ data: { name, accrualRule, maxDays } });
      const employees = await prisma.employee.findMany({ where: { active: true }, select: { id: true } });
      for (const employee of employees) {
        await prisma.leaveBalance.create({
          data: { employeeId: employee.id, leaveTypeId: leaveType.id, accrued: maxDays, taken: 0, balance: maxDays },
        });
      }
      return NextResponse.json({ leaveType }, { status: 201 });
    } else if (action === "create_holiday") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can configure holidays." }, { status: 403 });
      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim();
      const date = new Date(`${String(body.date || "").slice(0, 10)}T00:00:00.000Z`);
      if (!name || Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Holiday name and date are required." }, { status: 400 });
      }
      const holiday = await prisma.companyHoliday.create({ data: { name, date, description: description || null } });
      return NextResponse.json({ holiday }, { status: 201 });
    } else if (action === "request") {
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
