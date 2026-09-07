import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/lib/services/InventoryService";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // "products", "requests", "returns", "purchasing", "pos"
    const productId = searchParams.get("productId");

    if (view === "requests") {
      const requests = await prisma.inventoryRequest.findMany({
        include: { job: { include: { customer: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(requests);
    }

    if (view === "returns") {
      const returns = await prisma.stockReturn.findMany({
        include: { job: { include: { customer: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(returns);
    }

    if (view === "purchasing") {
      const prs = await prisma.purchaseRequisition.findMany({
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      });
      const pos = await prisma.purchaseOrder.findMany({
        include: { items: { include: { product: true } }, goodsReceipts: true },
        orderBy: { createdAt: "desc" },
      });
      const grns = await prisma.goodsReceipt.findMany({
        include: { items: { include: { product: true } }, po: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ prs, pos, grns });
    }

    if (productId) {
      // Return single product with its full movement timeline
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          stockEntries: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
      return NextResponse.json(product);
    }

    // Default: products list with low-stock alerts
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(products);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      case "acknowledge_return": {
        const result = await InventoryService.acknowledgeStockReturn(
          payload.stockReturnId,
          payload.storeKeeperName || "Storekeeper"
        );
        return NextResponse.json(result);
      }

      case "fulfill_request": {
        const { requestId, productId, quantity } = payload;
        await InventoryService.consumeStock(
          productId,
          Number(quantity),
          "job_consumption",
          requestId,
          `Fulfilled tech request`
        );
        const invReq = await prisma.inventoryRequest.update({
          where: { id: requestId },
          data: { status: "issued" },
          include: { job: true },
        });

        // Automatically add the issued physical inventory item to the job's line items
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (product && invReq.jobId) {
          await prisma.jobItem.create({
            data: {
              jobId: invReq.jobId,
              description: `${product.name} (${product.sku}) [Issued by Storekeeper]`,
              quantityPlanned: Number(quantity),
              quantityActual: Number(quantity),
              unitRate: product.unitPrice,
            },
          });
        }

        return NextResponse.json({ success: true, request: invReq });
      }

      case "create_pr": {
        const { requestedBy, items, notes } = payload;
        const count = await prisma.purchaseRequisition.count();
        const prNumber = `PR-2026-${String(count + 1).padStart(4, "0")}`;
        const pr = await prisma.purchaseRequisition.create({
          data: {
            prNumber,
            requestedBy,
            notes,
            items: {
              create: items.map((it: any) => ({
                productId: it.productId,
                quantity: Number(it.quantity) || 1,
              })),
            },
          },
        });
        return NextResponse.json(pr, { status: 201 });
      }

      case "approve_pr_to_po": {
        const { prId, supplierName, supplierEmail, items } = payload;
        const count = await prisma.purchaseOrder.count();
        const poNumber = `PO-2026-${String(count + 1).padStart(4, "0")}`;

        let totalAmount = 0;
        const poItemsData = [];

        for (const it of items) {
          const product = await prisma.product.findUnique({ where: { id: it.productId } });
          const cost = Number(it.unitCost) || product?.costPrice || 0;
          const qty = Number(it.quantity) || 1;
          totalAmount += cost * qty;
          poItemsData.push({
            productId: it.productId,
            quantity: qty,
            unitCost: cost,
          });
        }

        const po = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            prId,
            supplierName,
            supplierEmail,
            totalAmount,
            status: "issued",
            items: {
              create: poItemsData,
            },
          },
        });

        await prisma.purchaseRequisition.update({
          where: { id: prId },
          data: { status: "approved" },
        });

        return NextResponse.json(po, { status: 201 });
      }

      case "receive_grn": {
        const { poId, receivedBy, items } = payload;
        const grn = await InventoryService.processGRN(poId, receivedBy, items);
        return NextResponse.json(grn);
      }

      case "pos_sale": {
        // Fast POS Sale: instant invoice + inventory deduction + Accounts Posting
        const { items, paymentMethod = "cash" } = payload;
        const count = await prisma.posSale.count();
        const saleNumber = `POS-${Date.now().toString().slice(-6)}`;

        let totalAmount = 0;
        for (const item of items) {
          totalAmount += item.quantity * item.unitPrice;
        }

        const sale = await prisma.posSale.create({
          data: {
            saleNumber,
            totalAmount,
            paymentMethod,
            items: {
              create: items.map((it: any) => ({
                productId: it.productId,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
              })),
            },
          },
        });

        // Deduct inventory for each item
        for (const item of items) {
          await InventoryService.consumeStock(
            item.productId,
            item.quantity,
            "pos_sale",
            sale.id,
            `POS Sale #${saleNumber}`
          );
        }

        // Post Revenue through Accounts Posting Engine
        const cashAccount = await AccountsPostingService.getAccountByCode("1000");
        const revAccount = await AccountsPostingService.getAccountByCode("4000");

        await AccountsPostingService.post({
          memo: `POS Over-the-counter sale #${saleNumber}`,
          refType: "pos_sale",
          refId: sale.id,
          lines: [
            { accountId: cashAccount.id, debit: totalAmount, credit: 0 },
            { accountId: revAccount.id, debit: 0, credit: totalAmount },
          ],
        });

        return NextResponse.json(sale, { status: 201 });
      }

      case "add_stock": {
        const { productId, quantity, unitCost, notes, source } = payload;
        const result = await InventoryService.addStock({
          productId,
          quantity: Number(quantity),
          unitCost: unitCost !== undefined ? Number(unitCost) : undefined,
          notes,
          source,
        });
        return NextResponse.json(result, { status: 200 });
      }

      case "create_product": {
        const product = await InventoryService.createProduct({
          sku: payload.sku,
          name: payload.name,
          unit: payload.unit || "unit",
          unitPrice: Number(payload.unitPrice) || 0,
          costPrice: Number(payload.costPrice) || 0,
          stockQuantity: Number(payload.stockQuantity) || 0,
          reorderLevel: Number(payload.reorderLevel) || 5,
          notes: payload.notes,
        });
        return NextResponse.json(product, { status: 201 });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
