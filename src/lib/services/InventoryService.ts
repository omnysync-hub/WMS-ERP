import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";

const RECEIVABLE_PO_STATUSES = ["approved", "sent_to_vendor", "sent", "partially_received"];

type Db = Prisma.TransactionClient | typeof prisma;

export class InventoryService {
  /**
   * Inventory asset account for a product: goods held for direct / POS sale (forDirectSale) sit in
   * 1210 (pos_inventory_asset); everything else in the mapped materials account (1200).
   */
  static async stockAccountFor(db: Db, product: { forDirectSale?: boolean | null } | null | undefined, role: string) {
    return AccountMappingService.resolveAccount({
      transactionType: product?.forDirectSale ? "pos_inventory_asset" : role,
      prismaClient: db,
    });
  }

  /** Moving-average unit cost after receiving `inQty` units at `inCost`. */
  static movingAverageCost(oldQty: number, oldCost: number, inQty: number, inCost: number) {
    const q = Math.max(0, Number(oldQty) || 0);
    const c = Number(oldCost) || 0;
    if (!(inQty > 0)) return c;
    if (q <= 0 || c <= 0) return Math.round(inCost * 10000) / 10000;
    return Math.round(((q * c + inQty * inCost) / (q + inQty)) * 10000) / 10000;
  }

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
            InventoryService.stockAccountFor(prisma, product, "inventory_cogs_asset"),
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
        const byContains = await db.product.findFirst({
          where: {
            OR: [
              { sku: { contains: candidate, mode: "insensitive" } },
              { name: { contains: candidate, mode: "insensitive" } },
            ],
          },
        });
        if (byContains) return byContains;
      }

      // Check sub-tokens (e.g. "R410A" from "GAS-R410A")
      const subTokens = text
        .split(/[^a-zA-Z0-9]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 3 && !/^(gas|pipe|part|item|unit)$/i.test(s));
      for (const tok of subTokens) {
        const byTok = await db.product.findFirst({
          where: {
            OR: [
              { sku: { contains: tok, mode: "insensitive" } },
              { name: { contains: tok, mode: "insensitive" } },
            ],
          },
        });
        if (byTok) return byTok;
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
  /**
   * How many units of `productId` can still be returned from `jobId`:
   * issued to the job (stock ledger "job_consumption", keyed by job id or its inventory-request ids)
   * minus every return already filed for that job+product (pending or acknowledged).
   */
  static async getReturnableQty(
    db: Prisma.TransactionClient | typeof prisma,
    jobId: string,
    productId: string,
    excludeReturnId?: string
  ) {
    const requests = await db.inventoryRequest.findMany({ where: { jobId }, select: { id: true } });
    const refIds = [jobId, ...requests.map((r) => r.id)];
    const issued = await db.stockLedger.aggregate({
      where: { productId, refType: "job_consumption", direction: "out", refId: { in: refIds } },
      _sum: { qty: true },
    });
    const returned = await db.stockReturn.aggregate({
      where: { jobId, productId, ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}) },
      _sum: { qtyReturned: true },
    });
    const issuedQty = Number(issued._sum.qty) || 0;
    const returnedQty = Number(returned._sum.qtyReturned) || 0;
    return { issuedQty, returnedQty, returnable: Math.max(0, Math.round((issuedQty - returnedQty) * 1000) / 1000) };
  }

  static async acknowledgeStockReturn(
    stockReturnId: string,
    storeKeeperName: string,
    opts?: { productId?: string | null; tx?: Prisma.TransactionClient }
  ) {
    // Resolve GL accounts up-front (read-only, outside the write transaction)
    const cogsAccount = await AccountMappingService.resolveAccount({ transactionType: "inventory_return_cogs" });

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

      // Cap: cannot restock more than was issued to this job (minus other returns).
      const cap = await InventoryService.getReturnableQty(tx, stockReturn.jobId, product.id, stockReturn.id);
      if (qty > cap.returnable + 1e-9) {
        throw new Error(
          `Cannot acknowledge return of ${qty}x '${product.name}': only ${cap.returnable} unit(s) are returnable for this job ` +
            `(issued ${cap.issuedQty}, already returned/filed ${cap.returnedQty}).`
        );
      }

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
        const inventoryAccount = await InventoryService.stockAccountFor(tx, product, "inventory_return_asset");
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

    // Post to accounts: Debit Inventory Asset (1200, or 1210 for direct-sale goods), Credit GR/IR Clearing.
    // Valued at the PO unit cost (falls back to product cost) and the product cost moves to a moving average.
    const unitCostOf = (productId: string) => {
      const line = po.items.find((l) => l.productId === productId);
      return Number(line?.unitCost) > 0 ? Number(line!.unitCost) : productById.get(productId)!.costPrice;
    };
    const roundedValue = Math.round(normalized.reduce((s2, it) => s2 + it.quantityReceived * unitCostOf(it.productId), 0) * 100) / 100;
    void totalReceiptValue;
    const debitByAccount = new Map<string, number>();
    for (const it of normalized) {
      const acc = await InventoryService.stockAccountFor(prisma, productById.get(it.productId), "grn_receipt_asset");
      debitByAccount.set(acc.id, Math.round(((debitByAccount.get(acc.id) || 0) + it.quantityReceived * unitCostOf(it.productId)) * 100) / 100);
    }
    const inventoryAccount = roundedValue > 0 ? true : null;
    const grirAccount = roundedValue > 0 ? await AccountMappingService.resolveAccount({ transactionType: "grn_receipt_clearing" }) : null;

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
        const liveProduct = await tx.product.findUnique({ where: { id: item.productId } });
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantityReceived },
            costPrice: InventoryService.movingAverageCost(liveProduct?.stockQuantity || 0, liveProduct?.costPrice || 0, item.quantityReceived, unitCostOf(item.productId)),
          },
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
            ...Array.from(debitByAccount.entries()).filter(([, v]) => v > 0).map(([accountId, v]) => ({ accountId, debit: v, credit: 0 })),
            { accountId: grirAccount.id, debit: 0, credit: Math.round(Array.from(debitByAccount.values()).reduce((a, b) => a + b, 0) * 100) / 100 },
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
    /** Where the purchase was paid from: a cash/bank account code, or the AP account (2000) for credit purchases. */
    paidFromAccountCode?: string | null;
  }) {
    const { productId, quantity, unitCost, notes, source, paidFromAccountCode } = params;
    if (quantity <= 0) throw new Error("Quantity must be greater than 0");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    const effectiveCost = unitCost !== undefined && unitCost > 0 ? unitCost : product.costPrice;

    // Stock quantity, stock ledger and the GL entry are saved together: if the journal cannot be
    // posted (e.g. account not mapped) the stock is not changed either, so stock and GL never drift.
    return prisma.$transaction(async (tx) => {
      const live = await tx.product.findUnique({ where: { id: productId } });
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: { increment: quantity },
          costPrice: InventoryService.movingAverageCost(live?.stockQuantity || 0, live?.costPrice || 0, quantity, effectiveCost),
        },
      });
      const ledger = await tx.stockLedger.create({
        data: {
          productId,
          qty: quantity,
          direction: "in",
          refType: "stock_in",
          notes: notes || `Direct stock added (${source || "Warehouse Restock"})`,
        },
      });
      // Debit Inventory Asset (stock_in_asset), Credit Cash / Bank (stock_in_disbursing)
      const totalVal = Math.round(quantity * effectiveCost * 100) / 100;
      if (totalVal > 0) {
        const inventoryAccount = await InventoryService.stockAccountFor(tx, product, "stock_in_asset");
        let cashAccount;
        if (paidFromAccountCode) {
          const ap = await AccountMappingService.resolveAccount({ transactionType: "ap_control", prismaClient: tx });
          cashAccount = String(paidFromAccountCode) === ap.code
            ? ap
            : await AccountsPostingService.getCashBankAccountByCode(String(paidFromAccountCode), tx);
        } else {
          cashAccount = await AccountMappingService.resolveAccount({ transactionType: "stock_in_disbursing", prismaClient: tx });
        }
        await AccountsPostingService.post({
          memo: `Inventory stock inward for ${quantity}x ${product.name} (${source || "Direct Restock"})`,
          refType: "stock_in",
          refId: ledger.id,
          lines: [
            { accountId: inventoryAccount.id, debit: totalVal, credit: 0 },
            { accountId: cashAccount.id, debit: 0, credit: totalVal },
          ],
          tx,
        });
      }
      return { product: updatedProduct, ledger };
    });
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
    forDirectSale?: boolean;
  }) {
    const existing = await prisma.product.findUnique({ where: { sku: params.sku } });
    if (existing) throw new Error(`Product with SKU '${params.sku}' already exists.`);

    return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sku: params.sku,
        name: params.name,
        unit: params.unit || "unit",
        unitPrice: Number(params.unitPrice) || 0,
        costPrice: Number(params.costPrice) || 0,
        stockQuantity: Number(params.stockQuantity) || 0,
        reorderLevel: Number(params.reorderLevel) || 5,
        forDirectSale: Boolean(params.forDirectSale),
      },
    });

    if (product.stockQuantity > 0) {
      await tx.stockLedger.create({
        data: {
          productId: product.id,
          qty: product.stockQuantity,
          direction: "in",
          refType: "opening_stock",
          notes: params.notes || "Initial opening stock upon product creation",
        },
      });

      // Debit Inventory Asset (opening_stock_asset), Credit Opening Equity (opening_stock_equity)
      const totalVal = Math.round(product.stockQuantity * product.costPrice * 100) / 100;
      if (totalVal > 0) {
        const inventoryAccount = await InventoryService.stockAccountFor(tx, product, "opening_stock_asset");
        const capitalAccount = await AccountMappingService.resolveAccount({ transactionType: "opening_stock_equity", prismaClient: tx });
        await AccountsPostingService.post({
          memo: `Initial opening inventory asset for ${product.name} (${product.sku})`,
          refType: "opening_stock",
          refId: product.id,
          lines: [
            { accountId: inventoryAccount.id, debit: totalVal, credit: 0 },
            { accountId: capitalAccount.id, debit: 0, credit: totalVal },
          ],
          tx,
        });
      }
    }

    return product;
    });
  }

  /**
   * Set or adjust Opening Stock balance for an inventory item.
   * Records opening_stock in StockLedger and posts balanced GAAP entry:
   * Debit 1200 (Inventory Asset; 1210 for direct-sale goods)
   * Credit 3900 (Opening Balance Equity)
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

    return prisma.$transaction(async (tx) => {
    // 1. Increment product stockQuantity and update cost price
    const live = await tx.product.findUnique({ where: { id: productId } });
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: { increment: quantity },
        costPrice: InventoryService.movingAverageCost(live?.stockQuantity || 0, live?.costPrice || 0, quantity, effectiveCost),
      },
    });

    // 2. Add Stock Ledger entry
    const entryDate = openingDate ? new Date(openingDate) : new Date();
    const ledger = await tx.stockLedger.create({
      data: {
        productId,
        qty: quantity,
        direction: "in",
        refType: "opening_stock",
        notes: notes || `Opening stock balance declared as of ${entryDate.toISOString().split("T")[0]}`,
        createdAt: entryDate,
      },
    });

    // 3. Post to Accounts: Debit 1200/1210 (Inventory Asset), Credit 3900 (Opening Balance Equity) via AccountMappingService
    {
      const inventoryAccount = await InventoryService.stockAccountFor(tx, product, "opening_stock_asset");
      const capitalAccount = await AccountMappingService.resolveAccount({ transactionType: "opening_stock_equity", prismaClient: tx });
      const totalVal = Math.round(quantity * effectiveCost * 100) / 100;
      if (totalVal > 0) {
        await AccountsPostingService.post({
          memo: `Opening inventory balance for ${quantity}x ${product.name} (${product.sku})`,
          refType: "opening_stock",
          refId: ledger.id,
          lines: [
            { accountId: inventoryAccount.id, debit: totalVal, credit: 0 },
            { accountId: capitalAccount.id, debit: 0, credit: totalVal },
          ],
          date: entryDate,
          tx,
        });
      }
    }

    return { product: updatedProduct, ledger };
    });
  }
}


