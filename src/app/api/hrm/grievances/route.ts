import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;

    const tickets = await HrmService.listGrievanceTickets({ employeeId, status, category });
    return NextResponse.json({ tickets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "raise";

    if (action === "raise") {
      const ticket = await HrmService.raiseGrievanceTicket({
        employeeId: body.employeeId,
        category: body.category,
        description: body.description,
      });
      return NextResponse.json({ ticket }, { status: 201 });
    } else if (action === "comment") {
      const comment = await HrmService.addGrievanceComment({
        ticketId: body.ticketId,
        authorId: body.authorId,
        authorName: body.authorName,
        comment: body.comment,
      });
      return NextResponse.json({ comment }, { status: 201 });
    } else if (action === "update_status") {
      const ticket = await HrmService.updateGrievanceStatus({
        ticketId: body.ticketId,
        newStatus: body.newStatus,
        changedBy: body.changedBy || "HR Manager",
      });
      return NextResponse.json({ ticket });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
