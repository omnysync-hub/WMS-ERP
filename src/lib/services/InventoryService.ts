import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

const RECEIVABLE_PO_STATUSES = ["approved", "sent_to_vendor", "sent", "partially_received"];

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
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Consumed stock quantity must be a positive number.");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    const costAmount = Math.round(qty * product.costPrice * 100) / 100;
    const [cogsAccount, inventoryAccount] =
      costAmount > 0
        ? await Promise.all([
            AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_expense" }),
            AccountMappingService.resolveAccount({ transactionType: "inventory_cogs_asset" }),
          ])
        : [null, null];

    // Stock, ledger and GL must either all succeed or all roll back.
    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id: productId, stockQuantity: { gte: qty } },
        data: { stockQuantity: { decrement: qty } },
      });
      if (updated.count === 0) {
        const live = await tx.product.findUnique({ where: { id: productId } });
        throw new Error(
          `Insufficient stock for product '${product.name}'. Available: ${live?.stockQuantity ?? 0}, Requested: ${qty}`
        );
      }

      const ledger = await tx.stockLedger.create({
        data: { productId, qty, direction: "out", refType, refId, notes },
      });

      if (costAmount > 0 && cogsAccount && inventoryAccount) {
        await AccountsPostingService.post({
          memo: `COGS posting for ${qty}x ${product.name} (${refType})`,
          refType: "inventory_cogs",
          refId: ledger.id,
          lines: [
            { accountId: cogsAccount.id, debit: costAmount, credit: 0 },
            { accountId: inventoryAccount.id, debit: 0, credit: costAmount },
          ],
          tx,
        });
      }

      return ledger;
    }, { maxWait: 10000, timeout: 30000 });
  }

  /**
   * Resolve the warehouse Product for a stock return.
   * Order: explicit productId -> linked JobItem "(SKU)" -> "(SKU)" token in item text -> exact SKU -> exact name.
   * Never uses fuzzy `contains` matching (that silently restocked the wrong product).
   * Returns null when nothing resolves; callers decide whether that is an error.
   */
  static async resolveReturnProduct(
    db: Prisma.TransactionClient | typeof prisma,
    input: { productId?: string | null; item?: string | null; jobItemId?: string | null }
  ) {
    if (input.productId) {
      const byId = await db.product.findUnique({ where: { id: input.productId } });
      if (!byId) {
        throw new Error(`Stock return product '${input.productId}' was not found in warehouse inventory.`);
      }
      return byId;
    }

    const texts: string[] = [];
    if (input.jobItemId) {
      const ji = await db.jobItem.findUnique({ where: { id: input.jobItemId } });
      if (ji?.description) texts.push(ji.description);
    }
    if (input.item) texts.push(input.item);

    for (const text of texts) {
      // "(SKU)" tokens, e.g. "Copper Pipe 1/4 (CP-014) [Issued by Storekeeper]"
      const tokens = Array.from(text.matchAll(/\(([^()]+)\)/g)).map((m) => m[1].trim()).filter(Boolean);
      for (const tok of tokens) {
        const bySku = await db.product.findUnique({ where: { sku: tok } });
        if (bySku) return bySku;
      }
      const bare = text
        .replace(/\s*\[[^\]]*\]/g, "")
        .replace(/\s*\([^()]*\)/g, "")
        .trim();
      for (const candidate of Array.from(new Set([text.trim(), bare])).filter(Boolean)) {
        const bySku = await db.product.findUnique({ where: { sku: candidate } });
        if (bySku) return bySku;
        const byName = await db.product.findFirst({
          where: { name: { equals: candidate, mode: "insensitive" } },
        });
        if (byName) return byName;
      }
    }
    return null;
  }

  /**
   * Acknowledge technician stock return (storekeeper check-in).
   * One transaction: claim acknowledgedAt + restock + stock ledger + GL (inventory asset / COGS reversal).
   * Idempotent: an already-acknowledged return is returned unchanged (no second movement).
   * Requires a resolvable product; unmatched items fail with a clear error instead of
   * being marked acknowledged with no stock movement.
   */
  static async acknowledgeStockReturn(
    stockReturnId: string,
    storeKeeperName: string,
    opts?: { productId?: string | null; tx?: Prisma.TransactionClient }
  ) {
    // Resolve GL accounts up-front (read-only, outside the write transaction)
    const [cogsAccount, inventoryAccount] = await Promise.all([
      AccountMappingService.resolveAccount({ transactionType: "inventory_return_cogs" }),
      AccountMappingService.resolveAccount({ transactionType: "inventory_return_asset" }),
    ]);

    const run = async (tx: Prisma.TransactionClient) => {
      const stockReturn = await tx.stockReturn.findUnique({
        where: { id: stockReturnId },
        include: { job: true },
      });
      if (!stockReturn) throw new Error("Stock return record not found");
      if (stockReturn.acknowledgedAt) {
        return stockReturn; // idempotent no-op
      }

      const product = await InventoryService.resolveReturnProduct(tx, {
        productId: opts?.productId || stockReturn.productId,
        item: stockReturn.item,
      });
      if (!product) {
        throw new Error(
          `Cannot acknowledge stock return: '${stockReturn.item}' does not match any warehouse product (by id, SKU or exact name). ` +
            `Select the product (productId) and retry — nothing was restocked.`
        );
      }

      const qty = Number(stockReturn.qtyReturned) || 0;
      if (qty <= 0) throw new Error("Stock return quantity must be greater than zero.");

      // Claim the row first (guards concurrent double-acknowledge)
      const claimed = await tx.stockReturn.updateMany({
        where: { id: stockReturnId, acknowledgedAt: null },
        data: {
          acknowledgedBy: storeKeeperName,
          acknowledgedAt: new Date(),
          productId: product.id,
        },
      });
      if (claimed.count === 0) {
        return (await tx.stockReturn.findUnique({ where: { id: stockReturnId } }))!;
      }

      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: qty } },
      });

      await tx.stockLedger.create({
        data: {
          productId: product.id,
          qty,
          direction: "in",
          refType: "stock_return",
          // refId stays jobId (field-allocation report in /api/inventory keys on it)
          refId: stockReturn.jobId,
          notes: `Returned from Job ${stockReturn.job.jobNumber} (return ${stockReturn.id}, ack by ${storeKeeperName})`,
        },
      });

      const value = Math.round(qty * product.costPrice * 100) / 100;
      if (value > 0) {
        await AccountsPostingService.post({
          memo: `Stock return from Job ${stockReturn.job.jobNumber} (${qty}x ${product.name})`,
          refType: "inventory_return",
          refId: stockReturn.id,
          postedBy: storeKeeperName,
          lines: [
            { accountId: inventoryAccount.id, debit: value, credit: 0 },
            { accountId: cogsAccount.id, debit: 0, credit: value },
          ],
          tx,
        });
      }

      return (await tx.stockReturn.findUnique({ where: { id: stockReturnId } }))!;
    };

    if (opts?.tx) return run(opts.tx);
    return prisma.$transaction(run, { maxWait: 10000, timeout: 30000 });
  }

  /**
   * Process Goods Receipt (GRN) from Purchase Order.
   * Increments stock levels and posts Debit Inventory Asset / Credit Accounts Payable.
   */
  static async processGRN(poId: string, receivedBy: string, items: { productId: string; quantityReceived: number }[]) {
    if (!receivedBy?.trim()) throw new Error("Received-by name is required.");
    if (!Array.isArray(items) || items.length === 0) throw new Error("At least one received item is required.");

    const normalized = items.map((item) => ({
      productId: item.productId,
      quantityReceived: Number(item.quantityReceived),
    }));
    if (normalized.some((item) => !item.productId || !Number.isFinite(item.quantityReceived) || item.quantityReceived <= 0)) {
      throw new Error("Every received item must have a product and a positive numeric quantity.");
    }
    if (new Set(normalized.map((item) => item.productId)).size !== normalized.length) {
      throw new Error("A product may appear only once in a goods receipt.");
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) throw new Error("Purchase Order not found");
    if (!RECEIVABLE_PO_STATUSES.includes(po.status)) {
      throw new Error(`Purchase Order ${po.poNumber} cannot receive goods in status '${po.status}'.`);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: normalized.map((item) => item.productId) } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const item of normalized) {
      const product = productById.get(item.productId);
      if (!product) throw new Error(`Product '${item.productId}' was not found.`);
      const poItem = po.items.find((line) => line.productId === item.productId);
      if (!poItem) throw new Error(`Product '${product.name}' is not part of PO ${po.poNumber}.`);
      const remaining = Math.max(0, poItem.quantity - poItem.quantityReceived);
      if (item.quantityReceived > remaining + 1e-9) {
        throw new Error(`Cannot receive ${item.quantityReceived} of '${product.name}'; only ${remaining} remains on the PO.`);
      }
    }

    const totalReceiptValue = normalized.reduce(
      (sum, item) => sum + item.quantityReceived * productById.get(item.productId)!.costPrice,
      0
    );

    // Post to accounts: Debit Inventory Asset, Credit GR/IR Clearing via AccountMappingService
    const roundedValue = Math.round(totalReceiptValue * 100) / 100;
    const [inventoryAccount, grirAccount] = roundedValue > 0
      ? await Promise.all([
          AccountMappingService.resolveAccount({ transactionType: "grn_receipt_asset" }),
          AccountMappingService.resolveAccount({ transactionType: "grn_receipt_clearing" }),
        ])
      : [null, null];

    return prisma.$transaction(async (tx) => {
      const livePo = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
      if (!livePo || !RECEIVABLE_PO_STATUSES.includes(livePo.status)) {
        throw new Error(`Purchase Order ${po.poNumber} is no longer receivable.`);
      }
      for (const item of normalized) {
        const line = livePo.items.find((poItem) => poItem.productId === item.productId);
        const remaining = line ? Math.max(0, line.quantity - line.quantityReceived) : 0;
        if (!line || item.quantityReceived > remaining + 1e-9) {
          throw new Error("Purchase order quantities changed while the receipt was being prepared. Refresh and retry.");
        }
      }

      const grnCount = await tx.goodsReceipt.count();
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(4, "0")}`;
      const grn = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          poId,
          receivedBy: receivedBy.trim(),
          items: {
            create: normalized.map((item) => {
              const poItem = livePo.items.find((line) => line.productId === item.productId)!;
              const product = productById.get(item.productId)!;
              return {
                poItemId: poItem.id,
                productId: item.productId,
                itemCode: product.sku,
                description: product.name,
                quantityReceived: item.quantityReceived,
                quantityAccepted: item.quantityReceived,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const item of normalized) {
        const poItem = livePo.items.find((line) => line.productId === item.productId)!;
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: { increment: item.quantityReceived } },
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantityReceived } },
        });
        await tx.stockLedger.create({
          data: {
            productId: item.productId,
            qty: item.quantityReceived,
            direction: "in",
            refType: "grn",
            refId: grn.id,
            notes: `Receipt under ${grnNumber} for PO ${po.poNumber}`,
          },
        });
      }

      if (roundedValue > 0 && inventoryAccount && grirAccount) {
        await AccountsPostingService.post({
          memo: `Goods receipt ${grnNumber} for PO ${po.poNumber} (${po.supplierName})`,
          refType: "grn_receipt",
          refId: grn.id,
          lines: [
            { accountId: inventoryAccount.id, debit: roundedValue, credit: 0 },
            { accountId: grirAccount.id, debit: 0, credit: roundedValue },
          ],
          tx,
        });
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: updatedItems.every((line) => line.quantityReceived >= line.quantity) ? "fully_received" : "partially_received" },
      });
      return grn;
    }, { maxWait: 10000, timeout: 30000 });
  }

  /**
   * Alias for processGRN conforming to recordGrnStock naming
   */
  static async recordGrnStock(
    poId: string,
    items: { productId: string; quantityReceived: number }[],
    receivedBy: string = "Storekeeper"
  ) {
    return this.processGRN(poId, receivedBy, items);
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

    // 3. Post to Accounts: Debit Inventory Asset, Credit Cash / Bank via AccountMappingService
    try {
      const inventoryAccount = await AccountMappingService.resolveAccount({
        transactionType: "stock_in_asset",
        });
      const cashAccount = await AccountMappingService.resolveAccount({
        transactionType: "stock_in_disbursing",
      });
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

      // Post to accounts: Debit Inventory Asset, Credit Owner Capital via AccountMappingService
      try {
        const inventoryAccount = await AccountMappingService.resolveAccount({
          transactionType: "opening_stock_asset",
            });
        const capitalAccount = await AccountMappingService.resolveAccount({
          transactionType: "opening_stock_equity",
        });
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

  /**
   * Set or adjust Opening Stock balance for an inventory item.
   * Records opening_stock in StockLedger and posts balanced GAAP entry:
   * Debit 1200 (Inventory Asset)
   * Credit 3000 (Owner Capital / Equity)
   */
  static async setOpeningStock(params: {
    productId: string;
    quantity: number;
    unitCost?: number;
    notes?: string;
    openingDate?: string;
  }) {
    const { productId, quantity, unitCost, notes, openingDate } = params;
    if (quantity <= 0) throw new Error("Opening stock quantity must be greater than 0");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    const effectiveCost = unitCost !== undefined && unitCost > 0 ? unitCost : product.costPrice;

    // 1. Increment product stockQuantity and update cost price
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: { increment: quantity },
        costPrice: effectiveCost,
      },
    });

    // 2. Add Stock Ledger entry
    const entryDate = openingDate ? new Date(openingDate) : new Date();
    const ledger = await prisma.stockLedger.create({
      data: {
        productId,
        qty: quantity,
        direction: "in",
        refType: "opening_stock",
        notes: notes || `Opening stock balance declared as of ${entryDate.toISOString().split("T")[0]}`,
        createdAt: entryDate,
      },
    });

    // 3. Post to Accounts: Debit 1200 (Inventory Asset), Credit 3000 (Owner Capital / Equity) via AccountMappingService
    try {
      const inventoryAccount = await AccountMappingService.resolveAccount({
        transactionType: "opening_stock_asset",
        });
      const capitalAccount = await AccountMappingService.resolveAccount({
        transactionType: "opening_stock_equity",
      });
      const totalVal = Math.round(quantity * effectiveCost);
      if (totalVal > 0) {
        await AccountsPostingService.post({
          memo: `Opening inventory balance for ${quantity}x ${product.name} (${product.sku})`,
          refType: "opening_stock",
          refId: ledger.id,
          lines: [
            { accountId: inventoryAccount.id, debit: totalVal, credit: 0 },
            { accountId: capitalAccount.id, debit: 0, credit: totalVal },
          ],
        });
      }
    } catch (e) {
      console.warn("Could not post opening stock journal entry:", e);
    }

    return { product: updatedProduct, ledger };
  }
}


