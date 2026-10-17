export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";
import { requirePermission } from "@/lib/auth/erpActor";

export async function POST(req: NextRequest) {
  try {
    const gate = requirePermission(req, "hrm.manage_employees");
    if (gate.error) return gate.error;
    const body = await req.json();
    const action = body.action || "toggle";

    if (action === "toggle") {
      const updated = await HrmService.toggleChecklistItem(
        "onboarding",
        body.itemId,
        body.isDone
      );
      return NextResponse.json({ item: updated });
    } else if (action === "seed") {
      await HrmService.seedOnboardingChecklist(body.employeeId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
