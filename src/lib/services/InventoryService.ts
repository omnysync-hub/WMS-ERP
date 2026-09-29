import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

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

    // 3. Post to Accounts Posting Engine via AccountMappingService: Debit COGS, Credit Inventory Asset
    const cogsAccount = await AccountMappingService.resolveAccount({
      transactionType: "inventory_cogs_expense",
    });
    const inventoryAccount = await AccountMappingService.resolveAccount({
      transactionType: "inventory_cogs_asset",
    });

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

    // Post to accounts: Debit Inventory Asset, Credit GR/IR Clearing via AccountMappingService
    const inventoryAccount = await AccountMappingService.resolveAccount({
      transactionType: "grn_receipt_asset",
    });
    const grirAccount = await AccountMappingService.resolveAccount({
      transactionType: "grn_receipt_clearing",
    });
    const roundedValue = Math.round(totalReceiptValue * 100) / 100;

    if (roundedValue > 0) {
      await AccountsPostingService.post({
        memo: `Goods receipt ${grnNumber} for PO ${po.poNumber} (${po.supplierName})`,
        refType: "grn_receipt",
        refId: grn.id,
        lines: [
          { accountId: inventoryAccount.id, debit: roundedValue, credit: 0 },
          { accountId: grirAccount.id, debit: 0, credit: roundedValue },
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


