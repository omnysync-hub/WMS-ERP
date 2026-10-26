export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HrmService } from "@/lib/services/HrmService";
import { resolveJobsActor, actorHasPermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    const actor = resolved.actor;
    if (!actor || actor.role === "anonymous" || !actor.id || actor.id === "anonymous") {
      return NextResponse.json({ error: "Unauthorized: login required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryEmpId = searchParams.get("employeeId") || searchParams.get("technicianId");

    // Only HR managers or admins can view other employees' profiles
    const canViewOthers = actorHasPermission(actor, "hrm.view_employees") || actor.role === "admin" || actor.role === "manager";

    let targetEmployeeId: string | null = null;

    if (queryEmpId) {
      if (!canViewOthers && queryEmpId !== actor.id) {
        // Also check if actor's linked employee ID matches queryEmpId
        const callerEmp = await prisma.employee.findFirst({
          where: { OR: [{ id: actor.id }, { erpUserId: actor.id }] },
          select: { id: true },
        });
        if (!callerEmp || callerEmp.id !== queryEmpId) {
          return NextResponse.json(
            { error: "Forbidden: You are not authorized to view other employee profiles." },
            { status: 403 }
          );
        }
      }
      targetEmployeeId = queryEmpId;
    }

    if (!targetEmployeeId) {
      // Find caller's own employee profile
      const emp = await prisma.employee.findFirst({
        where: {
          OR: [
            { id: actor.id },
            { erpUserId: actor.id },
          ],
        },
        select: { id: true },
      });
      if (emp) {
        targetEmployeeId = emp.id;
      }
    }

    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: "Employee profile not found for the authenticated user." },
        { status: 404 }
      );
    }

    const employee = await HrmService.getEmployee(targetEmployeeId);
    if (!employee) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
