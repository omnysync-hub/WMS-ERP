export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { AuditService } from "@/lib/services/AuditService";
import { requirePermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const gate = requirePermission(req, "accounts.pos");
    if (gate.error) return gate.error;
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
    const gate = requirePermission(req, "accounts.pos");
    if (gate.error) return gate.error;
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

      const allowedPaymentMethods = new Set(["cash", "card", "transfer", "credit", "split"]);
      if (!allowedPaymentMethods.has(paymentMethod)) {
        return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 });
      }

      const parsedTotal = Number(totalAmount);
      if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
        return NextResponse.json({ error: "Invalid total sale amount" }, { status: 400 });
      }

      // Step 1: Validate quantities and price every line from the authoritative
      // product catalog. Client-provided prices are display data, not a trust boundary.
      const normalizedQuantities = new Map<string, number>();
      for (const item of items) {
        if (typeof item?.productId !== "string" || !item.productId) {
          return NextResponse.json({ error: "Every cart item must reference a product" }, { status: 400 });
        }
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return NextResponse.json({ error: "Each item must have a valid quantity greater than zero" }, { status: 400 });
        }
        normalizedQuantities.set(item.productId, (normalizedQuantities.get(item.productId) || 0) + quantity);
      }

      const products = await prisma.product.findMany({
        where: { id: { in: [...normalizedQuantities.keys()] } },
        select: { id: true, name: true, unitPrice: true, costPrice: true },
      });
      if (products.length !== normalizedQuantities.size) {
        return NextResponse.json({ error: "One or more cart products no longer exist" }, { status: 400 });
      }
      const productById = new Map(products.map((product) => [product.id, product]));
      const normalizedItems = [...normalizedQuantities.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
        unitPrice: Number(productById.get(productId)!.unitPrice),
      }));

      let calculatedSubtotal = 0;
      for (const item of normalizedItems) {
        if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
          return NextResponse.json({ error: "A cart product has an invalid catalog price" }, { status: 409 });
        }
        calculatedSubtotal += item.quantity * item.unitPrice;
      }
      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;

      const numDiscount = Math.max(0, Math.min(Number(discountAmount) || 0, calculatedSubtotal));
      const numTax = Math.max(0, Number(taxAmount) || 0);
      const computedTotal = Math.round((calculatedSubtotal - numDiscount + numTax) * 100) / 100;
      if (computedTotal <= 0 || Math.abs(parsedTotal - computedTotal) > 0.01) {
        return NextResponse.json(
          { error: "The cart total changed. Refresh the cart and try checkout again.", totalAmount: computedTotal },
          { status: 409 }
        );
      }

      if (paymentMethod === "split") {
        const cashPortion = Number(splitDetails?.cashAmount) || 0;
        const cardPortion = Number(splitDetails?.cardAmount) || 0;
        if (cashPortion < 0 || cardPortion < 0 || Math.abs(cashPortion + cardPortion - computedTotal) > 0.01) {
          return NextResponse.json({ error: "Split payment amounts must equal the sale total" }, { status: 400 });
        }
      }

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
      const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      const saleNumber = `POS-${datePart}-${randomPart}`;

      const [cashAccount, bankAccount, arAccount, revenueAccount, cogsAccount, inventoryAccount] =
        await Promise.all([
          AccountMappingService.resolveAccount({ transactionType: "pos_sale_cash" }),
          AccountMappingService.resolveAccount({ transactionType: "pos_sale_bank" }),
          AccountMappingService.resolveAccount({ transactionType: "pos_sale_receivable" }),
          AccountMappingService.resolveAccount({ transactionType: "pos_sale_revenue" }),
          AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_expense" }),
          AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_asset" }),
        ]);

      // Step 3: Atomic Stock Depletion and POS Sale Creation in a Single Transaction
      const { sale } = await prisma.$transaction(async (tx) => {
        let costSum = 0;

        for (const item of normalizedItems) {
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
          costSum += (Number(productById.get(item.productId)?.costPrice) || 0) * qty;
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
            customerName: typeof customerName === "string" ? customerName.trim() || "Walk-in Customer" : "Walk-in Customer",
            customerPhone: typeof customerPhone === "string" ? customerPhone.trim() || null : null,
            cashierName: gate.actor.name || "Counter Cashier",
            notes: typeof notes === "string" ? notes.trim() || null : null,
            status: "completed",
            items: {
              create: normalizedItems.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
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

        for (const item of normalizedItems) {
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

        const revenueLines: Array<{ accountId: string; debit: number; credit: number }> = [];
        if (paymentMethod === "cash") {
          revenueLines.push({ accountId: cashAccount.id, debit: computedTotal, credit: 0 });
        } else if (paymentMethod === "card" || paymentMethod === "transfer") {
          revenueLines.push({ accountId: bankAccount.id, debit: computedTotal, credit: 0 });
        } else if (paymentMethod === "credit") {
          revenueLines.push({ accountId: arAccount.id, debit: computedTotal, credit: 0 });
        } else {
          const cashPortion = Number(splitDetails?.cashAmount) || 0;
          const cardPortion = Number(splitDetails?.cardAmount) || 0;
          if (cashPortion > 0) revenueLines.push({ accountId: cashAccount.id, debit: cashPortion, credit: 0 });
          if (cardPortion > 0) revenueLines.push({ accountId: bankAccount.id, debit: cardPortion, credit: 0 });
        }
        revenueLines.push({ accountId: revenueAccount.id, debit: 0, credit: computedTotal });

        await AccountsPostingService.post({
          memo: `POS Counter Sale #${saleNumber} (${paymentMethod.toUpperCase()}) - ${typeof customerName === "string" ? customerName : "Walk-in Customer"}`,
          refType: "pos_sale",
          refId: createdSale.id,
          lines: revenueLines,
          tx,
        });

        const roundedCost = Math.round(costSum * 100) / 100;
        if (roundedCost > 0) {
          await AccountsPostingService.post({
            memo: `POS COGS for Receipt #${saleNumber} (${normalizedItems.length} items)`,
            refType: "inventory_cogs",
            refId: createdSale.id,
            lines: [
              { accountId: cogsAccount.id, debit: roundedCost, credit: 0 },
              { accountId: inventoryAccount.id, debit: 0, credit: roundedCost },
            ],
            tx,
          });
        }

        const activeSession = await (tx as any).posRegisterSession.findFirst({
          where: { status: "open" },
          orderBy: { openedAt: "desc" },
        });
        if (activeSession) {
          const splitCash = paymentMethod === "split" ? Number(splitDetails?.cashAmount) || 0 : 0;
          const splitCard = paymentMethod === "split" ? Number(splitDetails?.cardAmount) || 0 : 0;
          const cashAmount = paymentMethod === "cash" ? computedTotal : splitCash;
          const cardAmount = paymentMethod === "card" || paymentMethod === "transfer" ? computedTotal : splitCard;
          await (tx as any).posRegisterSession.update({
            where: { id: activeSession.id },
            data: {
              totalSalesCount: { increment: 1 },
              totalSalesAmount: { increment: computedTotal },
              cashSalesAmount: cashAmount > 0 ? { increment: cashAmount } : undefined,
              cardSalesAmount: cardAmount > 0 ? { increment: cardAmount } : undefined,
            },
          });
        }

        return { sale: createdSale };
      });

      // Step 7: Log Audit Activity
      await AuditService.logActivity({
        actorName: gate.actor.name,
        actorRole: "cashier",
        category: "DATA_MUTATION",
        action: `Processed POS Sale #${saleNumber} for PKR ${computedTotal.toLocaleString()} (${paymentMethod})`,
        target: `PosSale:${sale.id}`,
        metadata: {
          saleNumber,
          totalAmount: computedTotal,
          itemsCount: normalizedItems.length,
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
