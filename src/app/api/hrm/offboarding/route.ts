import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "toggle";

    if (action === "toggle") {
      const updated = await HrmService.toggleChecklistItem(
        "offboarding",
        body.itemId,
        body.isDone
      );
      return NextResponse.json({ item: updated });
    } else if (action === "seed") {
      await HrmService.seedOffboardingChecklist(body.employeeId);
      return NextResponse.json({ success: true });
    } else if (action === "exit_interview") {
      const interview = await HrmService.recordExitInterview({
        employeeId: body.employeeId,
        reason: body.reason,
        feedback: body.feedback,
        rehireEligible: body.rehireEligible ?? true,
      });
      return NextResponse.json({ exitInterview: interview });
    } else if (action === "final_settlement") {
      const settlement = await HrmService.calculateAndPostFinalSettlement({
        employeeId: body.employeeId,
        proRatedSalary: Number(body.proRatedSalary) || 0,
        leaveEncashmentDays: Number(body.leaveEncashmentDays) || 0,
        dailyRate: Number(body.dailyRate) || 0,
        advanceDeduction: Number(body.advanceDeduction) || 0,
        expenseAdjustment: Number(body.expenseAdjustment) || 0,
        disbursingAccountCode: body.disbursingAccountCode || "1010",
        settledBy: body.settledBy || "Fatima Noor (Accountant)",
      });
      return NextResponse.json({ settlement });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
