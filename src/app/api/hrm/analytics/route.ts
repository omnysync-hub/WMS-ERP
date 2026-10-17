export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { requireJobsPermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  const gate = await requireJobsPermission(req, ["hrm.view_employees", "hrm.manage_employees"]);
  if (gate.error) return gate.error;
  try {
    const analytics = await HrmService.getHrAnalytics();
    return NextResponse.json({ analytics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
