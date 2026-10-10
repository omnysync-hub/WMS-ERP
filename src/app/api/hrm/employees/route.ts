export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { requirePermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const gate = requirePermission(req, "hrm.view_employees");
    if (gate.error) return gate.error;
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") as any;
    const department = searchParams.get("department") || undefined;
    const search = searchParams.get("search") || undefined;
    const hierarchy = searchParams.get("hierarchy");

    if (hierarchy === "true") {
      const tree = await HrmService.getOrgHierarchy();
      return NextResponse.json({ hierarchy: tree });
    }

    const employees = await HrmService.listEmployees({ tab, department, search });
    return NextResponse.json({ employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = requirePermission(req, "hrm.manage_employees");
    if (gate.error) return gate.error;
    const body = await req.json();
    const employee = await HrmService.createEmployee(body);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
