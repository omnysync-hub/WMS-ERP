export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/erpActor";
import { ReturnsService } from "@/lib/services/ReturnsService";

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission(req, "accounts.view_journal");
    if (gate.error) return gate.error;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "sales" or "purchase"
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    if (type === "sales") {
      const creditNotes = await prisma.customerLedgerEntry.findMany({
        where: { entryType: "credit_note" },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return NextResponse.json({ success: true, creditNotes });
    }

    if (type === "purchase") {
      const debitNotes = await prisma.vendorLedgerEntry.findMany({
        where: { entryType: "debit_note" },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return NextResponse.json({ success: true, debitNotes });
    }

    // Both
    const [creditNotes, debitNotes] = await Promise.all([
      prisma.customerLedgerEntry.findMany({
        where: { entryType: "credit_note" },
        include: {
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.vendorLedgerEntry.findMany({
        where: { entryType: "debit_note" },
        include: {
          vendor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    return NextResponse.json({ success: true, creditNotes, debitNotes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch returns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission(req, "accounts.manage_chart");
    if (gate.error) return gate.error;

    const body = await req.json();
    const actorName = gate.actor.name || "Accounts Officer";

    if (body.type === "sales_return" || body.type === "credit_note") {
      const { invoiceId, lines, reason } = body;
      if (!invoiceId) {
        return NextResponse.json({ error: "invoiceId is required for a sales return" }, { status: 400 });
      }
      const result = await ReturnsService.createSalesReturn({
        invoiceId,
        lines: lines || [],
        reason: reason || "Customer sales return",
        actorName,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (body.type === "purchase_return" || body.type === "debit_note") {
      const { vendorId, supplierInvoiceId, lines, reason } = body;
      if (!vendorId) {
        return NextResponse.json({ error: "vendorId is required for a purchase return" }, { status: 400 });
      }
      const result = await ReturnsService.createPurchaseReturn({
        vendorId,
        supplierInvoiceId: supplierInvoiceId || null,
        lines: lines || [],
        reason: reason || "Vendor purchase return",
        actorName,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json(
      { error: "Invalid return type. Must be 'sales_return' or 'purchase_return'." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process return" }, { status: 500 });
  }
}
