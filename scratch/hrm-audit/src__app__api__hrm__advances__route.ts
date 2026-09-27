export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, amount, approvedBy = "HR Manager" } = body;

    const advAmount = Number(amount) || 0;
    if (advAmount <= 0) {
      return NextResponse.json({ error: "Advance amount must be greater than 0" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const advance = await prisma.employeeAdvance.create({
      data: {
        employeeId,
        amount: advAmount,
        status: "approved",
        approvedBy,
      },
    });

    // If technician, also record in technician_ledger_entries (type = "advance")
    if (employee.role === "technician") {
      await prisma.technicianLedgerEntry.create({
        data: {
          technicianId: employee.id,
          type: "advance",
          amount: advAmount,
          notes: `Advance granted by ${approvedBy}`,
        },
      });
    }

    // Post to Accounts Posting Engine via AccountMappingService:
    // Debit Employee Advances Asset, Credit Cash & Bank
    const advAccount = await AccountMappingService.resolveAccount({
      transactionType: "advance_granted_receivable",
    });
    const cashAccount = await AccountMappingService.resolveAccount({
      transactionType: "advance_granted_disbursing",
    });

    await AccountsPostingService.post({
      memo: `Salary/Field Advance granted to ${employee.name} (${employee.role})`,
      refType: "advance_granted",
      refId: advance.id,
      lines: [
        { accountId: advAccount.id, debit: advAmount, credit: 0 },
        { accountId: cashAccount.id, debit: 0, credit: advAmount },
      ],
    });

    return NextResponse.json(advance, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
