import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await HrmService.updateEmployee(params.id, body);
    return NextResponse.json({ employee: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
