export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, amount, approvedBy = "HR Manager" } = body;

    const advAmount = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(advAmount) || advAmount <= 0) {
      return NextResponse.json({ error: "Advance amount must be greater than 0" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const advance = await prisma.$transaction(async (tx) => {
      const [advAccount, cashAccount] = await Promise.all([
        AccountMappingService.resolveAccount({
          transactionType: "advance_granted_receivable",
          prismaClient: tx,
        }),
        AccountMappingService.resolveAccount({
          transactionType: "advance_granted_disbursing",
          prismaClient: tx,
        }),
      ]);
      const created = await tx.employeeAdvance.create({
        data: { employeeId, amount: advAmount, status: "approved", approvedBy },
      });
      if (employee.role === "technician") {
        await tx.technicianLedgerEntry.create({
          data: {
            technicianId: employee.id,
            type: "advance",
            amount: advAmount,
            notes: `Advance granted by ${approvedBy}`,
          },
        });
      }
      await AccountsPostingService.post({
        memo: `Salary/Field Advance granted to ${employee.name} (${employee.role})`,
        refType: "advance_granted",
        refId: created.id,
        lines: [
          { accountId: advAccount.id, debit: advAmount, credit: 0 },
          { accountId: cashAccount.id, debit: 0, credit: advAmount },
        ],
        tx,
      });
      return created;
    });

    return NextResponse.json(advance, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
