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
    const category = searchParams.get("category") || undefined;

    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const canManage = roleHasPermission(resolved.actor.role, "hrm.manage_employees");
    if (!canManage) {
      if (employeeId && employeeId !== resolved.actor.id) {
        return NextResponse.json({ error: "You can only view your own grievance tickets." }, { status: 403 });
      }
      employeeId = resolved.actor.id;
    }

    const tickets = await HrmService.listGrievanceTickets({ employeeId, status, category });
    return NextResponse.json({ tickets });
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
    const action = body.action || "raise";

    if (action === "raise") {
      const ticket = await HrmService.raiseGrievanceTicket({
        employeeId: canManage && typeof body.employeeId === "string" ? body.employeeId : resolved.actor.id,
        category: body.category,
        description: body.description,
      });
      return NextResponse.json({ ticket }, { status: 201 });
    } else if (action === "comment") {
      const ticket = await prisma.grievanceTicket.findUnique({
        where: { id: body.ticketId },
        select: { employeeId: true },
      });
      if (!ticket) return NextResponse.json({ error: "Grievance ticket not found." }, { status: 404 });
      if (!canManage && ticket.employeeId !== resolved.actor.id) {
        return NextResponse.json({ error: "You can only comment on your own grievance." }, { status: 403 });
      }
      const comment = await HrmService.addGrievanceComment({
        ticketId: body.ticketId,
        authorId: resolved.actor.id,
        authorName: resolved.actor.name,
        comment: body.comment,
      });
      return NextResponse.json({ comment }, { status: 201 });
    } else if (action === "update_status") {
      if (!canManage) {
        return NextResponse.json({ error: "Only HR managers can change grievance status." }, { status: 403 });
      }
      const ticket = await HrmService.updateGrievanceStatus({
        ticketId: body.ticketId,
        newStatus: body.newStatus,
        changedBy: resolved.actor.name,
      });
      return NextResponse.json({ ticket });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
