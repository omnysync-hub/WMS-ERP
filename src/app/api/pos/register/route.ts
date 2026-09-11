import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";

export async function GET(req: NextRequest) {
  try {
    const activeSession = await (prisma as any).posRegisterSession.findFirst({
      where: { status: "open" },
      orderBy: { openedAt: "desc" },
    });

    let currentSessionData = null;
    if (activeSession) {
      const expectedCash =
        activeSession.openingFloat +
        activeSession.cashSalesAmount +
        activeSession.cashInTotal -
        activeSession.cashOutTotal;

      currentSessionData = {
        ...activeSession,
        expectedCash,
      };
    }

    const pastSessions = await (prisma as any).posRegisterSession.findMany({
      orderBy: { openedAt: "desc" },
      take: 15,
    });

    return NextResponse.json({
      success: true,
      activeSession: currentSessionData,
      pastSessions,
    });
  } catch (err: any) {
    console.error("GET /api/pos/register error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch register shift" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. OPEN REGISTER SHIFT
    if (action === "open") {
      const { cashierName = "Counter Cashier", openingFloat = 0, notes } = body;

      const existingOpen = await (prisma as any).posRegisterSession.findFirst({
        where: { status: "open" },
      });

      if (existingOpen) {
        return NextResponse.json(
          { error: `Register session #${existingOpen.sessionNumber} is already open by ${existingOpen.cashierName}` },
          { status: 400 }
        );
      }

      const sessionNumber = `REG-${Date.now().toString().slice(-6)}`;
      const numFloat = Number(openingFloat) || 0;

      const session = await (prisma as any).posRegisterSession.create({
        data: {
          sessionNumber,
          cashierName: cashierName.trim(),
          openingFloat: numFloat,
          status: "open",
          notes: notes ? notes.trim() : null,
        },
      });

      await AuditService.logActivity({
        actorName: cashierName,
        actorRole: "cashier",
        category: "DATA_MUTATION",
        action: `Opened Register Shift #${sessionNumber} with PKR ${numFloat.toLocaleString()} Float`,
        target: `PosRegisterSession:${session.id}`,
      });

      return NextResponse.json({
        success: true,
        session,
        message: `Register Shift #${sessionNumber} opened successfully`,
      });
    }

    // 2. CASH IN / CASH OUT (DRAWER DROPS & PETTY DRAWER PAYMENTS)
    if (action === "cash_drop") {
      const { dropType, amount, reason, cashierName = "Counter Cashier" } = body; // dropType: "cash_in" | "cash_out"
      const numAmount = Number(amount);

      if (!numAmount || numAmount <= 0) {
        return NextResponse.json({ error: "A valid positive amount is required" }, { status: 400 });
      }

      const activeSession = await (prisma as any).posRegisterSession.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });

      if (!activeSession) {
        return NextResponse.json({ error: "No active register session is currently open" }, { status: 400 });
      }

      const isCashIn = dropType === "cash_in";
      const updatedSession = await (prisma as any).posRegisterSession.update({
        where: { id: activeSession.id },
        data: isCashIn
          ? { cashInTotal: { increment: numAmount } }
          : { cashOutTotal: { increment: numAmount } },
      });

      await AuditService.logActivity({
        actorName: cashierName,
        actorRole: "cashier",
        category: "DATA_MUTATION",
        action: `Cash Drawer ${isCashIn ? "Cash-In Deposit" : "Payout Drop"}: PKR ${numAmount.toLocaleString()} (${reason || "No reason given"})`,
        target: `PosRegisterSession:${activeSession.id}`,
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        message: `Recorded ${isCashIn ? "Cash In" : "Cash Out"} of PKR ${numAmount.toLocaleString()}`,
      });
    }

    // 3. CLOSE REGISTER SHIFT (END OF DAY / Z-REPORT)
    if (action === "close") {
      const { closingCash, cashierName = "Counter Cashier", notes } = body;
      const numClosingCash = Number(closingCash);

      if (isNaN(numClosingCash) || numClosingCash < 0) {
        return NextResponse.json({ error: "A valid closing cash count is required" }, { status: 400 });
      }

      const activeSession = await (prisma as any).posRegisterSession.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });

      if (!activeSession) {
        return NextResponse.json({ error: "No open register session found to close" }, { status: 400 });
      }

      const expectedCash =
        activeSession.openingFloat +
        activeSession.cashSalesAmount +
        activeSession.cashInTotal -
        activeSession.cashOutTotal;

      const discrepancy = numClosingCash - expectedCash;

      const closedSession = await (prisma as any).posRegisterSession.update({
        where: { id: activeSession.id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closingCash: numClosingCash,
          expectedCash,
          discrepancy,
          notes: notes ? notes.trim() : activeSession.notes,
        },
      });

      await AuditService.logActivity({
        actorName: cashierName,
        actorRole: "cashier",
        category: "DATA_MUTATION",
        action: `Closed Register Shift #${activeSession.sessionNumber}: Counted PKR ${numClosingCash.toLocaleString()} (Discrepancy: PKR ${discrepancy.toLocaleString()})`,
        target: `PosRegisterSession:${activeSession.id}`,
      });

      return NextResponse.json({
        success: true,
        session: closedSession,
        zReport: {
          sessionNumber: closedSession.sessionNumber,
          openedAt: closedSession.openedAt,
          closedAt: closedSession.closedAt,
          cashierName: closedSession.cashierName,
          openingFloat: closedSession.openingFloat,
          totalSalesCount: closedSession.totalSalesCount,
          totalSalesAmount: closedSession.totalSalesAmount,
          cashSalesAmount: closedSession.cashSalesAmount,
          cardSalesAmount: closedSession.cardSalesAmount,
          cashInTotal: closedSession.cashInTotal,
          cashOutTotal: closedSession.cashOutTotal,
          expectedCash,
          closingCash: numClosingCash,
          discrepancy,
        },
        message: `Shift #${closedSession.sessionNumber} closed successfully.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/pos/register error:", err);
    return NextResponse.json({ error: err.message || "Failed to process register action" }, { status: 500 });
  }
}
