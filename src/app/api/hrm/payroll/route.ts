import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/services/PayrollService";

export async function GET() {
  try {
    const runs = await prisma.payrollRun.findMany({
      include: {
        payslips: {
          include: { employee: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const employees = await prisma.employee.findMany({
      include: { advances: true },
    });

    return NextResponse.json({ runs, employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, period, runId, approverName = "HR Director" } = body;

    switch (action) {
      case "calculate_draft": {
        const run = await PayrollService.createDraftRun(period || "Current Month");
        return NextResponse.json(run, { status: 201 });
      }

      case "approve": {
        const run = await PayrollService.approveRun(runId, approverName);
        return NextResponse.json(run);
      }

      case "disburse": {
        const run = await PayrollService.disburseRun(runId);
        return NextResponse.json(run);
      }

      default:
        return NextResponse.json({ error: `Unknown payroll action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
