export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const ticket = await HrmService.getGrievanceTicket(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
