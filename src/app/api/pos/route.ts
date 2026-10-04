export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { AuditService } from "@/lib/services/AuditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "catalog";

    if (action === "catalog") {
      // 1. Fetch live product inventory catalog
      const products = await prisma.product.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          unitPrice: true,
          costPrice: true,
          stockQuantity: true,
          reorderLevel: true,
        },
      });

      // 2. Fetch customer directory for counter selector
      const customers = await prisma.customer.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          addressText: true,
        },
      });

      // 3. Fetch active register session
      const activeSession = await (prisma as any).posRegisterSession.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });

      // 4. Fetch recent POS sales
      const recentSales = await (prisma as any).posSale.findMany({
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      return NextResponse.json({
        success: true,
        products,
        customers,
        activeSession,
        recentSales,
      });
    }

    if (action === "sales_history") {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "50", 10);
      const query = searchParams.get("q") || "";

      const where: any = {};
      if (query.trim()) {
        where.OR = [
          { saleNumber: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { customerPhone: { contains: query, mode: "insensitive" } },
        ];
      }

      const [sales, totalCount] = await Promise.all([
        (prisma as any).posSale.findMany({
          where,
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, unit: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        (prisma as any).posSale.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        sales,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    console.error("GET /api/pos error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch POS data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "checkout") {
      const {
        items,
        paymentMethod = "cash",
        amountTendered,
        changeGiven = 0,
        subtotal,
        discountAmount = 0,
        taxAmount = 0,
        totalAmount,
        customerName = "Walk-in Customer",
        customerPhone,
        cashierName = "Counter Cashier",
        notes,
        splitDetails,
      } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "No items in cart for checkout" }, { status: 400 });
      }

      const parsedTotal = Number(totalAmount);
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return NextResponse.json({ error: "Invalid total sale amount" }, { status: 400 });
      }

      // Step 1: Validate Item Quantities & Calculate Server-Side Subtotal
      let calculatedSubtotal = 0;
      for (const it of items) {
        const q = Number(it.quantity);
        const rate = Number(it.unitPrice);
        if (!q || q <= 0 || isNaN(q)) {
          return NextResponse.json({ error: "Each item must have a valid quantity greater than zero" }, { status: 400 });
        }
        if (isNaN(rate) || rate < 0) {
          return NextResponse.json({ error: "Item unit price cannot be negative" }, { status: 400 });
        }
        calculatedSubtotal += q * rate;
      }
      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;

      const numDiscount = Math.max(0, Math.min(Number(discountAmount) || 0, calculatedSubtotal));
      const numTax = Math.max(0, Number(taxAmount) || 0);
      const computedTotal = Math.round((calculatedSubtotal - numDiscount + numTax) * 100) / 100;

      if (paymentMethod === "cash") {
        const tendered = Number(amountTendered) || computedTotal;
        if (tendered < computedTotal - 0.01) {
          return NextResponse.json(
            { error: `Amount tendered ($${tendered}) is less than total amount due ($${computedTotal}).` },
            { status: 400 }
          );
        }
      }

      // Step 2: Generate Unique POS Receipt Number
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const saleNumber = `POS-${datePart}-${randomPart}`;

      // Step 3: Atomic Stock Depletion and POS Sale Creation in a Single Transaction
      const { sale, totalCostOfGoods } = await prisma.$transaction(async (tx) => {
        let costSum = 0;

        for (const item of items) {
          const qty = Number(item.quantity);
          const decremented = await tx.product.updateMany({
            where: { id: item.productId, stockQuantity: { gte: qty } },
            data: { stockQuantity: { decrement: qty } },
          });
          if (decremented.count === 0) {
            const current = await tx.product.findUnique({ where: { id: item.productId } });
            throw new Error(
              `Insufficient stock for '${current?.name || item.productId}'. Available: ${current?.stockQuantity ?? 0}, Requested: ${qty}`
            );
          }
          const current = await tx.product.findUnique({ where: { id: item.productId } });
          costSum += (current?.costPrice || 0) * qty;
        }

        const createdSale = await (tx as any).posSale.create({
          data: {
            saleNumber,
            totalAmount: computedTotal,
            subtotal: calculatedSubtotal,
            discountAmount: numDiscount,
            taxAmount: numTax,
            amountTendered: Number(amountTendered) || computedTotal,
            changeGiven: paymentMethod === "cash" ? Math.max(0, (Number(amountTendered) || computedTotal) - computedTotal) : 0,
            paymentMethod,
            customerName: customerName.trim() || "Walk-in Customer",
            customerPhone: customerPhone ? customerPhone.trim() : null,
            cashierName: cashierName.trim() || "Counter Cashier",
            notes: notes ? notes.trim() : null,
            status: "completed",
            items: {
              create: items.map((it: any) => ({
                productId: it.productId,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
              })),
            },
          },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, unit: true, unitPrice: true },
                },
              },
            },
          },
        });

        for (const item of items) {
          await tx.stockLedger.create({
            data: {
              productId: item.productId,
              qty: Number(item.quantity),
              direction: "out",
              refType: "pos_sale",
              refId: createdSale.id,
              notes: `POS Receipt #${saleNumber} - Customer: ${customerName}`,
            },
          });
        }

        return { sale: createdSale, totalCostOfGoods: costSum };
      });

      // Step 5: GAAP Double-Entry Accounting Postings
      try {
        // Find Accounts via central AccountMappingService
        const cashAccount = await AccountMappingService.resolveAccount({ transactionType: "pos_sale_cash" });
        const bankAccount = await AccountMappingService.resolveAccount({ transactionType: "pos_sale_bank" });
        const arAccount = await AccountMappingService.resolveAccount({ transactionType: "pos_sale_receivable" });
        const revenueAccount = await AccountMappingService.resolveAccount({ transactionType: "pos_sale_revenue" });
        const cogsAccount = await AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_expense" });
        const inventoryAccount = await AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_asset" });

        // Journal Entry A: Sales Revenue & Payment Received
        const revenueLines: Array<{ accountId: string; debit: number; credit: number }> = [];

        if (paymentMethod === "cash") {
          revenueLines.push({ accountId: cashAccount.id, debit: parsedTotal, credit: 0 });
        } else if (paymentMethod === "card" || paymentMethod === "transfer") {
          revenueLines.push({ accountId: bankAccount.id, debit: parsedTotal, credit: 0 });
        } else if (paymentMethod === "credit") {
          revenueLines.push({ accountId: arAccount.id, debit: parsedTotal, credit: 0 });
        } else if (paymentMethod === "split") {
          const cashPortion = Number(splitDetails?.cashAmount) || 0;
          const cardPortion = Number(splitDetails?.cardAmount) || 0;
          if (cashPortion > 0) revenueLines.push({ accountId: cashAccount.id, debit: cashPortion, credit: 0 });
          if (cardPortion > 0) revenueLines.push({ accountId: bankAccount.id, debit: cardPortion, credit: 0 });
          // Fallback if split amounts don't sum to parsedTotal
          const sumSplit = cashPortion + cardPortion;
          if (Math.abs(sumSplit - parsedTotal) > 0.01) {
            revenueLines.length = 0;
            revenueLines.push({ accountId: cashAccount.id, debit: parsedTotal, credit: 0 });
          }
        } else {
          revenueLines.push({ accountId: cashAccount.id, debit: parsedTotal, credit: 0 });
        }

        revenueLines.push({ accountId: revenueAccount.id, debit: 0, credit: parsedTotal });

        await AccountsPostingService.post({
          memo: `POS Counter Sale #${saleNumber} (${paymentMethod.toUpperCase()}) - ${customerName}`,
          refType: "pos_sale",
          refId: sale.id,
          lines: revenueLines,
        });

        // Journal Entry B: Cost of Goods Sold & Inventory Asset Relinquishment
        const roundedCost = Math.round(totalCostOfGoods * 100) / 100;
        if (roundedCost > 0) {
          await AccountsPostingService.post({
            memo: `POS COGS for Receipt #${saleNumber} (${items.length} items)`,
            refType: "inventory_cogs",
            refId: sale.id,
            lines: [
              { accountId: cogsAccount.id, debit: roundedCost, credit: 0 },
              { accountId: inventoryAccount.id, debit: 0, credit: roundedCost },
            ],
          });
        }
      } catch (accErr: any) {
        console.error("Accounts posting failed for POS sale:", accErr);
        // Non-blocking: sale is logged, financial warning can be investigated
      }

      // Step 6: Update Active Register Shift Session (if open)
      try {
        const activeSession = await (prisma as any).posRegisterSession.findFirst({
          where: { status: "open" },
          orderBy: { openedAt: "desc" },
        });

        if (activeSession) {
          const isCash = paymentMethod === "cash" || paymentMethod === "split";
          const isCard = paymentMethod === "card" || paymentMethod === "transfer";

          await (prisma as any).posRegisterSession.update({
            where: { id: activeSession.id },
            data: {
              totalSalesCount: { increment: 1 },
              totalSalesAmount: { increment: parsedTotal },
              cashSalesAmount: isCash ? { increment: parsedTotal } : undefined,
              cardSalesAmount: isCard ? { increment: parsedTotal } : undefined,
            },
          });
        }
      } catch (sessErr: any) {
        console.warn("Register session update warning:", sessErr);
      }

      // Step 7: Log Audit Activity
      await AuditService.logActivity({
        actorName: cashierName,
        actorRole: "cashier",
        category: "DATA_MUTATION",
        action: `Processed POS Sale #${saleNumber} for PKR ${parsedTotal.toLocaleString()} (${paymentMethod})`,
        target: `PosSale:${sale.id}`,
        metadata: {
          saleNumber,
          totalAmount: parsedTotal,
          itemsCount: items.length,
          paymentMethod,
          customerName,
        },
      });

      return NextResponse.json({
        success: true,
        sale,
        message: `Sale #${saleNumber} completed successfully`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/pos error:", err);
    return NextResponse.json({ error: err.message || "Failed to process POS sale" }, { status: 500 });
  }
}
