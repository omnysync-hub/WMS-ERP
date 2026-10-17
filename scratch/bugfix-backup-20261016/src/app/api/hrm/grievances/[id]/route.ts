export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { resolveJobsActor, roleHasPermission } from "@/lib/auth/erpActor";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const ticket = await HrmService.getGrievanceTicket(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!roleHasPermission(resolved.actor.role, "hrm.manage_employees") && ticket.employeeId !== resolved.actor.id) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
