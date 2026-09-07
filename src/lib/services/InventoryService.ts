import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";

export class InventoryService {
  /**
   * Consume stock for a job or general usage.
   * Decrements product quantity, writes to stock_ledger, and posts to Accounts Posting Engine.
   */
  static async consumeStock(
    productId: string,
    quantity: number,
    refType: "job_consumption" | "pos_sale",
    refId?: string,
    notes?: string
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    if (product.stockQuantity < quantity) {
      throw new Error(`Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}, Requested: ${quantity}`);
    }

    // 1. Decrement stock
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: { decrement: quantity } },
    });

    // 2. Add Stock Ledger entry
    const ledger = await prisma.stockLedger.create({
      data: {
        productId,
        qty: quantity,
        direction: "out",
        refType,
        refId,
        notes,
      },
    });

    // 3. Post to Accounts Posting Engine: Debit COGS, Credit Inventory Asset
    const cogsAccount = await AccountsPostingService.getAccountByCode("5000"); // Cost of Goods Sold
    const inventoryAccount = await AccountsPostingService.getAccountByCode("1200"); // Inventory Asset

    const costAmount = Math.round(quantity * product.costPrice * 100) / 100;
    if (costAmount > 0) {
      await AccountsPostingService.post({
        memo: `COGS posting for ${quantity}x ${product.name} (${refType})`,
        refType: "inventory_cogs",
        refId: ledger.id,
        lines: [
          { accountId: cogsAccount.id, debit: costAmount, credit: 0 },
          { accountId: inventoryAccount.id, debit: 0, credit: costAmount },
        ],
      });
    }

    return ledger;
  }

  /**
   * Acknowledge technician stock return.
   * Increments product quantity, records acknowledgedAt, and posts stock restoration.
   */
  static async acknowledgeStockReturn(stockReturnId: string, storeKeeperName: string) {
    const stockReturn = await prisma.stockReturn.findUnique({
      where: { id: stockReturnId },
      include: { job: true },
    });
    if (!stockReturn) throw new Error("Stock return record not found");
    if (stockReturn.acknowledgedAt) {
      throw new Error("Stock return has already been acknowledged.");
    }

    // Find matching product by name or SKU
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: stockReturn.item } },
          { sku: stockReturn.item },
        ],
      },
    });

    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: stockReturn.qtyReturned } },
      });

      await prisma.stockLedger.create({
        data: {
          productId: product.id,
          qty: stockReturn.qtyReturned,
          direction: "in",
          refType: "stock_return",
          refId: stockReturn.jobId,
          notes: `Returned from Job ${stockReturn.job.jobNumber}`,
        },
      });

      // Restore inventory asset from COGS
      const cogsAccount = await AccountsPostingService.getAccountByCode("5000");
      const inventoryAccount = await AccountsPostingService.getAccountByCode("1200");
      const value = Math.round(stockReturn.qtyReturned * product.costPrice * 100) / 100;

      if (value > 0) {
        await AccountsPostingService.post({
          memo: `Stock return from Job ${stockReturn.job.jobNumber} (${stockReturn.qtyReturned}x ${product.name})`,
          refType: "inventory_return",
          refId: stockReturn.id,
          lines: [
            { accountId: inventoryAccount.id, debit: value, credit: 0 },
            { accountId: cogsAccount.id, debit: 0, credit: value },
          ],
        });
      }
    }

    return await prisma.stockReturn.update({
      where: { id: stockReturnId },
      data: {
        acknowledgedBy: storeKeeperName,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Process Goods Receipt (GRN) from Purchase Order.
   * Increments stock levels and posts Debit Inventory Asset / Credit Accounts Payable.
   */
  static async processGRN(poId: string, receivedBy: string, items: { productId: string; quantityReceived: number }[]) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) throw new Error("Purchase Order not found");

    const grnCount = await prisma.goodsReceipt.count();
    const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(4, "0")}`;

    let totalReceiptValue = 0;

    const grn = await prisma.goodsReceipt.create({
      data: {
        grnNumber,
        poId,
        receivedBy,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            quantityReceived: it.quantityReceived,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantityReceived } },
        });

        await prisma.stockLedger.create({
          data: {
            productId: item.productId,
            qty: item.quantityReceived,
            direction: "in",
            refType: "grn",
            refId: grn.id,
            notes: `Receipt under ${grnNumber} for PO ${po.poNumber}`,
          },
        });

        totalReceiptValue += item.quantityReceived * product.costPrice;
      }
    }

    // Post to accounts: Debit Inventory Asset, Credit Accounts Payable
    const inventoryAccount = await AccountsPostingService.getAccountByCode("1200");
    const apAccount = await AccountsPostingService.getAccountByCode("2000");
    const roundedValue = Math.round(totalReceiptValue * 100) / 100;

    if (roundedValue > 0) {
      await AccountsPostingService.post({
        memo: `Goods receipt ${grnNumber} for PO ${po.poNumber} (${po.supplierName})`,
        refType: "grn_receipt",
        refId: grn.id,
        lines: [
          { accountId: inventoryAccount.id, debit: roundedValue, credit: 0 },
          { accountId: apAccount.id, debit: 0, credit: roundedValue },
        ],
      });
    }

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "completed" },
    });

    return grn;
  }

  /**
   * Add stock to an existing product (Direct Inward / Adjustment)
   */
  static async addStock(params: {
    productId: string;
    quantity: number;
    unitCost?: number;
    notes?: string;
    source?: string;
  }) {
    const { productId, quantity, unitCost, notes, source } = params;
    if (quantity <= 0) throw new Error("Quantity must be greater than 0");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    const effectiveCost = unitCost !== undefined && unitCost > 0 ? unitCost : product.costPrice;

    // 1. Increment product stockQuantity
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: { increment: quantity },
        costPrice: effectiveCost,
      },
    });

    // 2. Add Stock Ledger entry
    const ledger = await prisma.stockLedger.create({
      data: {
        productId,
        qty: quantity,
        direction: "in",
        refType: "stock_in",
        notes: notes || `Direct stock added (${source || "Warehouse Restock"})`,
      },
    });

    // 3. Post to Accounts: Debit Inventory Asset, Credit Cash / Bank
    try {
      const inventoryAccount = await AccountsPostingService.getAccountByCode("1200");
      const cashAccount = await AccountsPostingService.getAccountByCode("1000");
      const totalVal = Math.round(quantity * effectiveCost);
      if (totalVal > 0) {
        await AccountsPostingService.post({
          memo: `Inventory stock inward for ${quantity}x ${product.name} (${source || "Direct Restock"})`,
          refType: "stock_in",
          refId: ledger.id,
          lines: [
            { accountId: inventoryAccount.id, debit: totalVal, credit: 0 },
            { accountId: cashAccount.id, debit: 0, credit: totalVal },
          ],
        });
      }
    } catch (e) {
      console.warn("Could not post ledger for manual stock add:", e);
    }

    return { product: updatedProduct, ledger };
  }

  /**
   * Create a new product with optional initial opening stock
   */
  static async createProduct(params: {
    sku: string;
    name: string;
    unit?: string;
    unitPrice: number;
    costPrice: number;
    stockQuantity: number;
    reorderLevel?: number;
    notes?: string;
  }) {
    const existing = await prisma.product.findUnique({ where: { sku: params.sku } });
    if (existing) throw new Error(`Product with SKU '${params.sku}' already exists.`);

    const product = await prisma.product.create({
      data: {
        sku: params.sku,
        name: params.name,
        unit: params.unit || "unit",
        unitPrice: Number(params.unitPrice) || 0,
        costPrice: Number(params.costPrice) || 0,
        stockQuantity: Number(params.stockQuantity) || 0,
        reorderLevel: Number(params.reorderLevel) || 5,
      },
    });

    if (product.stockQuantity > 0) {
      await prisma.stockLedger.create({
        data: {
          productId: product.id,
          qty: product.stockQuantity,
          direction: "in",
          refType: "opening_stock",
          notes: params.notes || "Initial opening stock upon product creation",
        },
      });

      // Post to accounts: Debit Inventory Asset, Credit Owner Capital
      try {
        const inventoryAccount = await AccountsPostingService.getAccountByCode("1200");
        const capitalAccount = await AccountsPostingService.getAccountByCode("3000");
        const totalVal = Math.round(product.stockQuantity * product.costPrice);
        if (totalVal > 0) {
          await AccountsPostingService.post({
            memo: `Initial opening inventory asset for ${product.name} (${product.sku})`,
            refType: "opening_stock",
            refId: product.id,
            lines: [
              { accountId: inventoryAccount.id, debit: totalVal, credit: 0 },
              { accountId: capitalAccount.id, debit: 0, credit: totalVal },
            ],
          });
        }
      } catch (e) {
        console.warn("Could not post opening stock entry:", e);
      }
    }

    return product;
  }
}

