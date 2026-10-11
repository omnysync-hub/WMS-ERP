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

    const foundations = searchParams.get("foundations") === "true";

    if (holidaysOnly) {
      const holidays = await HrmService.getCompanyHolidays();
      return NextResponse.json({ holidays });
    }

    if (typesOnly) {
      const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });
      return NextResponse.json({ leaveTypes });
    }

    if (foundations) {
      const [leaveTypes, holidays] = await Promise.all([
        prisma.leaveType.findMany({ orderBy: { name: "asc" } }),
        HrmService.getCompanyHolidays(),
      ]);
      return NextResponse.json({ leaveTypes, holidays });
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
      prisma.leaveType.findMany({ orderBy: { name: "asc" } }),
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
    } else if (action === "update_leave_type") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can configure leave types." }, { status: 403 });
      const id = String(body.id || "").trim();
      const name = String(body.name || "").trim();
      const accrualRule = String(body.accrualRule || "").trim();
      const maxDays = Number(body.maxDays);
      if (!id || !name || !accrualRule || !Number.isFinite(maxDays) || maxDays <= 0) {
        return NextResponse.json({ error: "ID, name, accrual rule, and a positive annual allowance are required." }, { status: 400 });
      }
      const duplicate = await prisma.leaveType.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) return NextResponse.json({ error: "Another leave type with this name already exists." }, { status: 409 });
      const leaveType = await prisma.leaveType.update({
        where: { id },
        data: { name, accrualRule, maxDays },
      });
      return NextResponse.json({ leaveType });
    } else if (action === "delete_leave_type") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can delete leave types." }, { status: 403 });
      const id = String(body.id || "").trim();
      if (!id) return NextResponse.json({ error: "Leave type ID is required." }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        await tx.leaveRequest.deleteMany({ where: { leaveTypeId: id } });
        await tx.leaveBalance.deleteMany({ where: { leaveTypeId: id } });
        await tx.leaveType.delete({ where: { id } });
      });
      return NextResponse.json({ success: true, deletedId: id });
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
    } else if (action === "update_holiday") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can configure holidays." }, { status: 403 });
      const id = String(body.id || "").trim();
      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim();
      const date = new Date(`${String(body.date || "").slice(0, 10)}T00:00:00.000Z`);
      if (!id || !name || Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Holiday ID, name, and valid date are required." }, { status: 400 });
      }
      const holiday = await prisma.companyHoliday.update({
        where: { id },
        data: { name, date, description: description || null },
      });
      return NextResponse.json({ holiday });
    } else if (action === "delete_holiday") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can delete holidays." }, { status: 403 });
      const id = String(body.id || "").trim();
      if (!id) return NextResponse.json({ error: "Holiday ID is required." }, { status: 400 });
      await prisma.companyHoliday.delete({ where: { id } });
      return NextResponse.json({ success: true, deletedId: id });
    } else if (action === "seed_defaults") {
      if (!canManage) return NextResponse.json({ error: "Only HR managers can restore defaults." }, { status: 403 });
      const defaultTypes = [
        { name: "Annual Leave", accrualRule: "22 days/year (prorated)", maxDays: 22 },
        { name: "Sick Leave", accrualRule: "15 days/year (certified)", maxDays: 15 },
        { name: "Casual Leave", accrualRule: "7 days/year", maxDays: 7 },
        { name: "Emergency Leave", accrualRule: "5 days/year", maxDays: 5 },
      ];
      const employees = await prisma.employee.findMany({ where: { active: true }, select: { id: true } });
      for (const dt of defaultTypes) {
        const existing = await prisma.leaveType.findFirst({ where: { name: dt.name } });
        if (!existing) {
          const created = await prisma.leaveType.create({ data: dt });
          for (const emp of employees) {
            await prisma.leaveBalance.create({
              data: { employeeId: emp.id, leaveTypeId: created.id, accrued: dt.maxDays, taken: 0, balance: dt.maxDays },
            });
          }
        }
      }
      const existingHolidaysCount = await prisma.companyHoliday.count();
      if (existingHolidaysCount === 0) {
        const year = new Date().getFullYear();
        const defaultHolidays = [
          { name: "New Year's Day", date: new Date(`${year}-01-01T00:00:00.000Z`), description: "Federal Holiday" },
          { name: "Eid Al-Fitr Holiday 1", date: new Date(`${year}-03-20T00:00:00.000Z`), description: "National Public Holiday" },
          { name: "Eid Al-Fitr Holiday 2", date: new Date(`${year}-03-21T00:00:00.000Z`), description: "National Public Holiday" },
          { name: "Eid Al-Adha Holiday", date: new Date(`${year}-05-27T00:00:00.000Z`), description: "National Public Holiday" },
          { name: "Independence Day", date: new Date(`${year}-08-14T00:00:00.000Z`), description: "National Holiday" },
        ];
        for (const h of defaultHolidays) {
          await prisma.companyHoliday.create({ data: h });
        }
      }
      const [leaveTypes, holidays] = await Promise.all([
        prisma.leaveType.findMany({ orderBy: { name: "asc" } }),
        HrmService.getCompanyHolidays(),
      ]);
      return NextResponse.json({ success: true, leaveTypes, holidays });
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
