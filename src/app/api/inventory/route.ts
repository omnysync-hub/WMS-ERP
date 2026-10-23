export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/lib/services/InventoryService";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AuditService } from "@/lib/services/AuditService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import type { Prisma } from "@prisma/client";

/**
 * Post the GL side of a stock quantity change valued at the product's cost price.
 * Stock going out (shrinkage, workshop use): Dr inventory_cogs_expense / Cr inventory_cogs_asset.
 * Stock coming back in (count gain):        Dr inventory_return_asset / Cr inventory_return_cogs.
 */
async function postStockValueChange(
  tx: Prisma.TransactionClient,
  params: { direction: "in" | "out"; value: number; memo: string; refType: string; refId: string; postedBy: string }
) {
  const value = Math.round(params.value * 100) / 100;
  if (value <= 0) return;
  const [debitRole, creditRole] =
    params.direction === "out" ? ["inventory_cogs_expense", "inventory_cogs_asset"] : ["inventory_return_asset", "inventory_return_cogs"];
  const debitAcc = await AccountMappingService.resolveAccount({ transactionType: debitRole, prismaClient: tx });
  const creditAcc = await AccountMappingService.resolveAccount({ transactionType: creditRole, prismaClient: tx });
  await AccountsPostingService.post({
    memo: params.memo,
    refType: params.refType,
    refId: params.refId,
    postedBy: params.postedBy,
    lines: [
      { accountId: debitAcc.id, debit: value, credit: 0 },
      { accountId: creditAcc.id, debit: 0, credit: value },
    ],
    tx,
  });
}

export async function GET(req: NextRequest) {
  const gate = await requireJobsPermission(req, [
    "inventory.view_stock",
    "inventory.storekeeper_queue",
    "jobs.issue_stock",
    "jobs.create_job",
    "jobs.view_directory",
  ]);
  if (gate.error) return gate.error;
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



    if (view === "equipment") {
      let assets = await prisma.asset.findMany({
        where: {
          category: { in: ["HVAC Gauges", "Hand Tools", "Vacuum Pump", "Equipment", "Recovery Unit", "Brazing Kit"] },
        },
        include: {
          assignments: {
            include: { employee: true },
            orderBy: { assignedAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Auto-seed default HVAC field equipment if none found
      if (assets.length === 0) {
        const seedItems = [
          { tag: "EQ-VP-01", name: "Value 2-Stage Vacuum Pump 1/2 HP", category: "Vacuum Pump", status: "In Storage" },
          { tag: "EQ-VP-02", name: "Yellow Jacket SuperEvac Vacuum Pump", category: "Vacuum Pump", status: "In Storage" },
          { tag: "EQ-RU-01", name: "Appion G5Twin Refrigerant Recovery Unit", category: "Recovery Unit", status: "In Storage" },
          { tag: "EQ-MN-01", name: "Testo 550s Digital Manifold Gauge Set", category: "HVAC Gauges", status: "In Storage" },
          { tag: "EQ-BZ-01", name: "Oxygen/Acetylene Portable Brazing Torch Kit", category: "Brazing Kit", status: "In Storage" },
        ];
        for (const item of seedItems) {
          await prisma.asset.create({ data: item });
        }
        assets = await prisma.asset.findMany({
          where: {
            category: { in: ["HVAC Gauges", "Hand Tools", "Vacuum Pump", "Equipment", "Recovery Unit", "Brazing Kit"] },
          },
          include: {
            assignments: {
              include: { employee: true },
              orderBy: { assignedAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      }

      return NextResponse.json(assets);
    }

    if (view === "movements") {
      const movements = await prisma.stockLedger.findMany({
        where: {
          refType: { in: ["branch_transfer", "stock_adjustment", "workshop_consumption"] },
        },
        include: { product: true },
        orderBy: { createdAt: "desc" },
        take: 60,
      });
      return NextResponse.json(movements);
    }

    // Query active jobs and their issued inventory requests & acknowledged stock returns for field stock computation
    const activeJobs = await prisma.job.findMany({
      where: {
        status: {
          notIn: ["Finalized", "Verified"],
        },
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        customer: { select: { name: true } },
        assignedTechnician: { select: { id: true, name: true } },
        inventoryRequests: {
          where: { status: "issued" },
          select: {
            id: true,
            item: true,
            qtyRequested: true,
            createdAt: true,
          },
        },
        stockReturns: {
          where: { acknowledgedAt: { not: null } },
          select: {
            id: true,
            item: true,
            qtyReturned: true,
            acknowledgedAt: true,
          },
        },
      },
    });

    const consumptionLedgers = await prisma.stockLedger.findMany({
      where: {
        refType: "job_consumption",
      },
      select: {
        id: true,
        productId: true,
        qty: true,
        refId: true,
      },
    });

    const returnLedgers = await prisma.stockLedger.findMany({
      where: {
        refType: "stock_return",
      },
      select: {
        id: true,
        productId: true,
        qty: true,
        refId: true,
      },
    });

    const calculateAllocations = (product: any) => {
      const pId = product.id;
      const pName = (product.name || "").toLowerCase();
      const pSku = (product.sku || "").toLowerCase();

      // Find all ledger refIds that belong to this product
      const productConsumptionReqIds = new Set(
        consumptionLedgers
          .filter((cl) => cl.productId === pId && cl.refId)
          .map((cl) => cl.refId as string)
      );

      const allocations: Array<{
        jobId: string;
        jobNumber: string;
        customerName: string;
        technicianName: string;
        jobStatus: string;
        quantity: number;
      }> = [];

      for (const job of activeJobs) {
        let jobIssued = 0;
        for (const req of job.inventoryRequests) {
          const itemText = (req.item || "").toLowerCase();
          if (
            productConsumptionReqIds.has(req.id) ||
            itemText.includes(pSku) ||
            itemText.includes(pName) ||
            (pSku && itemText === pSku)
          ) {
            jobIssued += req.qtyRequested;
          }
        }

        let jobReturned = 0;
        for (const ret of job.stockReturns) {
          const itemText = (ret.item || "").toLowerCase();
          const hasReturnLedger = returnLedgers.some(
            (rl) => rl.productId === pId && rl.refId === job.id
          );
          const matchesProduct = (ret as any).productId
            ? (ret as any).productId === pId
            : hasReturnLedger || itemText.includes(pSku) || itemText.includes(pName);
          if (matchesProduct) {
            jobReturned += ret.qtyReturned;
          }
        }

        const netOnJob = Math.max(0, jobIssued - jobReturned);
        if (netOnJob > 0) {
          allocations.push({
            jobId: job.id,
            jobNumber: job.jobNumber,
            customerName: job.customer?.name || "Unassigned Customer",
            technicianName: job.assignedTechnician?.name || "Field Technician",
            jobStatus: job.status,
            quantity: netOnJob,
          });
        }
      }

      return allocations;
    };

    if (productId) {
      // Return single product with its full movement timeline and field allocations
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          stockEntries: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      const allocations = calculateAllocations(product);
      const stockOnJob = allocations.reduce((sum, a) => sum + a.quantity, 0);

      return NextResponse.json({
        ...product,
        stockOnJob,
        totalStock: product.stockQuantity + stockOnJob,
        jobAllocations: allocations,
      });
    }

    // Default: products list with low-stock alerts, warehouse stock, and stock on jobs
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    // No sample services are seeded: the product list contains only the client's own items.

    const enrichedProducts = products.map((p) => {
      const isService =
        (p.sku && (p.sku.startsWith("SRV-") || p.sku.startsWith("SVC-"))) ||
        ["service", "visit", "job", "hr", "hour"].includes((p.unit || "").toLowerCase());

      const allocations = isService ? [] : calculateAllocations(p);
      const stockOnJob = allocations.reduce((sum, a) => sum + a.quantity, 0);

      return {
        ...p,
        isService,
        stockOnJob,
        totalStock: isService ? 0 : p.stockQuantity + stockOnJob,
        jobAllocations: allocations,
      };
    });

    return NextResponse.json(enrichedProducts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Server-side permission per inventory action (any one of the listed keys). */
const INVENTORY_ACTION_PERMISSIONS: Record<string, string[]> = {
  acknowledge_return: ["jobs.stock_return", "inventory.storekeeper_queue"],
  fulfill_request: ["inventory.storekeeper_queue", "jobs.issue_stock"],
  add_stock: ["inventory.restock"],
  set_opening_stock: ["inventory.opening_stock"],
  create_product: ["inventory.restock", "inventory.stock_units"],
  update_product: ["inventory.restock", "inventory.stock_units"],
  branch_transfer: ["inventory.branch_transfers"],
  stock_adjustment: ["inventory.adjustments"],
  workshop_consumption: ["inventory.workshop_consumption"],
  checkout_equipment: ["inventory.tool_crib"],
  return_equipment: ["inventory.tool_crib"],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    const required = INVENTORY_ACTION_PERMISSIONS[String(action)];
    if (!required) return NextResponse.json({ error: `Unknown inventory action: ${action}` }, { status: 400 });
    const actionGate = await requireJobsPermission(req, required);
    if (actionGate.error) return actionGate.error;

    switch (action) {
      case "acknowledge_return": {
        const gate = await requireJobsPermission(req, ["jobs.stock_return", "inventory.storekeeper_queue"]);
        if (gate.error) return gate.error;
        const result = await InventoryService.acknowledgeStockReturn(
          payload.stockReturnId,
          payload.storeKeeperName || gate.actor.name || "Storekeeper",
          { productId: payload.productId || null }
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
        let createdJobItem = null;
        if (product && invReq.jobId) {
          createdJobItem = await prisma.jobItem.create({
            data: {
              jobId: invReq.jobId,
              description: `${product.name} (${product.sku}) [Issued by Storekeeper]`,
              quantityPlanned: Number(quantity),
              quantityActual: Number(quantity),
              unitRate: product.unitPrice,
            },
          });
        }

        await AuditService.recordCrudAction({
          actorName: payload.storeKeeperName || "Storekeeper",
          actorRole: "storekeeper",
          entityType: "InventoryRequest",
          entityId: requestId,
          entityNumber: invReq.job?.jobNumber || `REQ-${requestId.slice(0, 8)}`,
          actionType: "INVENTORY",
          description: `Storekeeper issued ${quantity}x ${product?.name || "item"} for Job #${invReq.job?.jobNumber || ""}`,
          stateBefore: { status: "pending", productId, quantity: Number(quantity) },
          stateAfter: { status: "issued", productId, quantity: Number(quantity), jobItemId: createdJobItem?.id },
          canRollback: true,
        });

        return NextResponse.json({ success: true, request: invReq });
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

      case "set_opening_stock": {
        const { productId, quantity, unitCost, notes, openingDate } = payload;
        const result = await InventoryService.setOpeningStock({
          productId,
          quantity: Number(quantity),
          unitCost: Number(unitCost),
          notes,
          openingDate,
        });
        return NextResponse.json(result, { status: 200 });
      }

      case "create_product": {
        const isService =
          payload.itemType === "service" ||
          (payload.sku && (payload.sku.startsWith("SRV-") || payload.sku.startsWith("SVC-"))) ||
          ["service", "visit", "job", "hr", "hour"].includes((payload.unit || "").toLowerCase());

        const product = await InventoryService.createProduct({
          sku: payload.sku,
          name: payload.name,
          unit: payload.unit || (isService ? "service" : "unit"),
          unitPrice: Number(payload.unitPrice) || 0,
          costPrice: Number(payload.costPrice) || 0,
          stockQuantity: isService ? 0 : Number(payload.stockQuantity) || 0,
          reorderLevel: isService ? 0 : Number(payload.reorderLevel) || 5,
          notes: payload.notes || (isService ? "Predefined billable service" : "Inventory product setup"),
        });
        return NextResponse.json(product, { status: 201 });
      }

      case "update_product": {
        const { id, unitPrice, costPrice, name, unit } = payload;
        const updated = await prisma.product.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(unit && { unit }),
            ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
            ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
          },
        });
        return NextResponse.json(updated, { status: 200 });
      }

      case "branch_transfer": {
        const { productId, quantity, fromBranch, toBranch, challanNumber, notes } = payload;
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("Product not found");
        if (product.stockQuantity < Number(quantity)) {
          throw new Error(`Insufficient stock for branch transfer. Available: ${product.stockQuantity}`);
        }
        await prisma.product.update({
          where: { id: productId },
          data: { stockQuantity: { decrement: Number(quantity) } },
        });
        const ledger = await prisma.stockLedger.create({
          data: {
            productId,
            qty: Number(quantity),
            direction: "out",
            refType: "branch_transfer",
            notes: `[Transfer: ${fromBranch || "Central Warehouse"} ➔ ${toBranch || "Branch Depot"}] Challan #${challanNumber || "TRF-" + Date.now().toString().slice(-4)}: ${notes || ""}`.trim(),
          },
        });
        return NextResponse.json({ success: true, ledger });
      }

      case "stock_adjustment": {
        const { productId, quantity, type, reason, notes } = payload;
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("Product not found");
        const qtyNum = Math.abs(Number(quantity));
        if (!qtyNum) return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 });
        const direction = type === "increase" ? "in" : "out";
        if (direction === "out" && product.stockQuantity < qtyNum) {
          return NextResponse.json({ error: `Cannot reduce below zero. Available: ${product.stockQuantity}` }, { status: 400 });
        }
        // Quantity, stock ledger and the inventory value in the GL change together.
        const ledger = await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: productId },
            data: {
              stockQuantity: type === "increase" ? { increment: qtyNum } : { decrement: qtyNum },
            },
          });
          const row = await tx.stockLedger.create({
            data: {
              productId,
              qty: qtyNum,
              direction,
              refType: "stock_adjustment",
              notes: `[Audit Adjustment (${type === "increase" ? "+" : "-"}${qtyNum}): ${reason || "Variance"}] ${notes || ""}`.trim(),
            },
          });
          await postStockValueChange(tx, {
            direction,
            value: qtyNum * (Number(product.costPrice) || 0),
            memo: `Stock count adjustment ${direction === "in" ? "+" : "-"}${qtyNum} ${product.name} (${reason || "Variance"})`,
            refType: "stock_adjustment",
            refId: row.id,
            postedBy: actionGate.actor.name || "Storekeeper",
          });
          return row;
        });
        return NextResponse.json({ success: true, ledger });
      }

      case "workshop_consumption": {
        const { productId, quantity, workshopUnit, technicianName, notes } = payload;
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("Product not found");
        const qtyNum = Number(quantity);
        if (product.stockQuantity < qtyNum) {
          throw new Error(`Insufficient stock for workshop consumption. Available: ${product.stockQuantity}`);
        }
        const ledger = await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { decrement: qtyNum } },
          });
          const row = await tx.stockLedger.create({
            data: {
              productId,
              qty: qtyNum,
              direction: "out",
              refType: "workshop_consumption",
              notes: `[Workshop Internal: ${workshopUnit || "Fabrication Bench"}] Tech: ${technicianName || "Shop Tech"}. ${notes || ""}`.trim(),
            },
          });
          await postStockValueChange(tx, {
            direction: "out",
            value: qtyNum * (Number(product.costPrice) || 0),
            memo: `Workshop consumption ${qtyNum} x ${product.name}`,
            refType: "workshop_consumption",
            refId: row.id,
            postedBy: actionGate.actor.name || "Storekeeper",
          });
          return row;
        });
        return NextResponse.json({ success: true, ledger });
      }

      case "checkout_equipment": {
        const { assetId, employeeId, assignedBy, conditionNotes } = payload;
        const assignment = await prisma.assetAssignment.create({
          data: {
            assetId,
            employeeId,
            assignedBy: assignedBy || "Storekeeper",
            conditionNotes: conditionNotes || "Normal functional check pass / calibrated",
          },
        });
        await prisma.asset.update({
          where: { id: assetId },
          data: {
            status: "Assigned",
            currentEmployeeId: employeeId,
          },
        });
        return NextResponse.json(assignment);
      }

      case "return_equipment": {
        const { assetId, assignmentId, conditionNotes } = payload;
        if (assignmentId) {
          await prisma.assetAssignment.update({
            where: { id: assignmentId },
            data: {
              returnedAt: new Date(),
              conditionNotes: conditionNotes ? `Returned: ${conditionNotes}` : undefined,
            },
          });
        }
        await prisma.asset.update({
          where: { id: assetId },
          data: {
            status: "In Storage",
            currentEmployeeId: null,
          },
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
