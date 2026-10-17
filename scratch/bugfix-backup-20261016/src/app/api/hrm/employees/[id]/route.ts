export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { requirePermission, resolveJobsActor, roleHasPermission } from "@/lib/auth/erpActor";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const canViewAll = roleHasPermission(resolved.actor.role, "hrm.view_employees");
    if (!canViewAll && resolved.actor.id !== params.id) {
      return NextResponse.json({ error: "You can only view your own employee profile." }, { status: 403 });
    }
    const employee = await HrmService.getEmployee(params.id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = requirePermission(req, "hrm.manage_employees");
    if (gate.error) return gate.error;
    const params = await context.params;
    const body = await req.json();
    const updated = await HrmService.updateEmployee(params.id, body);
    return NextResponse.json({ employee: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
