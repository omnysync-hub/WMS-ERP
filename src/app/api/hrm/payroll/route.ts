export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/services/PayrollService";
import { requirePermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    // Read access: payroll staff (hrm.payroll) or salary-disbursement staff
    // (hrm.payroll_disburse, e.g. cashier) who must see approved runs to pay them.
    const gate = requirePermission(req, "hrm.payroll");
    if (gate.error && requirePermission(req, "hrm.payroll_disburse").error) {
      return gate.error;
    }
    const runs = await prisma.payrollRun.findMany({
      include: {
        payslips: {
          include: {
            employee: {
              include: {
                attendanceLogs: {
                  orderBy: { timestamp: "desc" },
                  take: 60,
                },
                leaveRequests: {
                  where: { status: "Approved" },
                },
                advances: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const employees = await prisma.employee.findMany({
      where: { active: true },
      include: {
        advances: { where: { status: "approved" } },
        attendanceLogs: {
          orderBy: { timestamp: "desc" },
          take: 60,
        },
        leaveRequests: {
          where: { status: "Approved" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ runs, employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, period, runId, overwrite } = body;

    // Separation of duties: creating/approving a payroll run is hrm.payroll
    // (accountant); paying the salaries out is hrm.payroll_disburse (cashier).
    const gate = requirePermission(
      req,
      action === "disburse" ? "hrm.payroll_disburse" : "hrm.payroll"
    );
    if (gate.error) return gate.error;

    switch (action) {
      case "calculate_draft": {
        const run = await PayrollService.createDraftRun(period || "Current Month", Boolean(overwrite));
        return NextResponse.json(run, { status: 201 });
      }

      case "delete_draft": {
        const run = await PayrollService.deleteDraftRun(runId);
        return NextResponse.json(run);
      }

      case "approve": {
        const run = await PayrollService.approveRun(runId, gate.actor.name);
        return NextResponse.json(run);
      }

      case "disburse": {
        // Step 2: Dr Salaries Payable / Cr the chosen bank or cash account (default: payroll_net_disbursing).
        const run = await PayrollService.disburseRun(runId, {
          paidFromAccountCode: typeof body.paidFromAccountCode === "string" && body.paidFromAccountCode.trim() ? body.paidFromAccountCode.trim() : null,
          paidBy: gate.actor.name,
        });
        return NextResponse.json(run);
      }

      default:
        return NextResponse.json({ error: `Unknown payroll action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
