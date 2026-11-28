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
 * Post the GL side of a stock count adjustment / workshop use valued at the product's cost price.
 * These are NOT job costs, so they go to 5040 Stock Adjustments & Workshop Consumption
 * (inventory_adjustment_expense), never to job COGS (5000).
 * Stock going out (shrinkage, workshop use): Dr inventory_adjustment_expense / Cr inventory asset.
 * Stock coming back in (count gain):        Dr inventory asset / Cr inventory_adjustment_expense.
 */
async function postStockValueChange(
  tx: Prisma.TransactionClient,
  params: {
    direction: "in" | "out";
    value: number;
    memo: string;
    refType: string;
    refId: string;
    postedBy: string;
    product?: { forDirectSale?: boolean | null } | null;
  }
) {
  const value = Math.round(params.value * 100) / 100;
  if (value <= 0) return;
  const adjAcc = await AccountMappingService.resolveAccount({ transactionType: "inventory_adjustment_expense", prismaClient: tx });
  const stockAcc = await InventoryService.stockAccountFor(tx, params.product, "inventory_cogs_asset");
  const [debitAcc, creditAcc] = params.direction === "out" ? [adjAcc, stockAcc] : [stockAcc, adjAcc];
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
      // Select-whitelist (perf round 2): the only consumers — the inventory
      // page's Storekeeper Queue and the RealtimeRequestWatcher — read the
      // request scalars plus job.jobNumber and job.customer.name. The old
      // full include shipped the whole job row (incl. completionPhotos
      // base64, ~99% of the payload) and the whole customer row.
      const requests = await prisma.inventoryRequest.findMany({
        select: {
          id: true,
          jobId: true,
          technicianId: true,
          item: true,
          productId: true,
          qtyRequested: true,
          qtyIssued: true,
          status: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              jobNumber: true,
              assignedTechnicianId: true,
              assignedTechnician: { select: { id: true, name: true } },
              assignments: {
                where: { status: { not: "Removed" } },
                select: { id: true },
                take: 1,
              },
              customer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      // InventoryRequest carries only a technicianId string (no relation),
      // so the Storekeeper Queue's technician column needs the name resolved
      // here — one batch lookup for the page of requests, attached additively
      // as `technician: { id, name }` (null when the employee is gone).
      const technicianIds = [...new Set(requests.map((r) => r.technicianId).filter(Boolean))];
      const technicians = technicianIds.length
        ? await prisma.employee.findMany({
            where: { id: { in: technicianIds } },
            select: { id: true, name: true },
          })
        : [];
      const nameById = new Map(technicians.map((t) => [t.id, t.name]));
      return NextResponse.json(
        requests.map((r) => {
          const { job, ...rest } = r;
          // Stock may only be issued to a job with a technician (the
          // fulfill gate enforces it server-side); the queue needs the same
          // fact up front to disable the Issue action and to name the
          // assignee in its confirmation dialog. Derived here from the
          // job's lead technician or any live JobAssignment — the raw
          // assignments array itself is not shipped.
          const hasAssignedTechnician =
            Boolean(job.assignedTechnicianId) || (job.assignments?.length ?? 0) > 0;
          return {
            ...rest,
            job: {
              id: job.id,
              jobNumber: job.jobNumber,
              customer: job.customer,
              assignedTechnicianId: job.assignedTechnicianId,
              assignedTechnicianName: job.assignedTechnician?.name ?? null,
              hasAssignedTechnician,
            },
            technician: nameById.has(r.technicianId)
              ? { id: r.technicianId, name: nameById.get(r.technicianId) }
              : null,
          };
        })
      );
    }

    if (view === "returns") {
      // Same select-whitelist treatment as requests: consumers (the
      // inventory page's returns tab) read the return scalars plus
      // job.jobNumber / job.customer.name — not the whole job + customer rows.
      const returns = await prisma.stockReturn.findMany({
        select: {
          id: true,
          jobId: true,
          technicianId: true,
          item: true,
          productId: true,
          qtyReturned: true,
          acknowledgedBy: true,
          acknowledgedAt: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              jobNumber: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      // StockReturn has no status column and no technician relation, but the
      // returns tab renders both: derive `status` from the acknowledgement
      // (the tab's exact contract: "Pending" until acknowledged) and resolve
      // the technician name in one batch lookup, same as the requests view.
      const technicianIds = [...new Set(returns.map((r) => r.technicianId).filter(Boolean))];
      const technicians = technicianIds.length
        ? await prisma.employee.findMany({
            where: { id: { in: technicianIds } },
            select: { id: true, name: true },
          })
        : [];
      const nameById = new Map(technicians.map((t) => [t.id, t.name]));
      return NextResponse.json(
        returns.map((r) => ({
          ...r,
          status: r.acknowledgedAt ? "Acknowledged" : "Pending",
          technician: nameById.has(r.technicianId)
            ? { id: r.technicianId, name: nameById.get(r.technicianId) }
            : null,
        }))
      );
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
        const qty = Number(quantity);

        // Validate EVERYTHING before any stock or GL mutation. Previously the
        // stock consume ran first and a bad requestId only failed afterwards at
        // the request update — leaving stock decremented and a COGS journal
        // posted for a request that does not exist.
        if (!requestId || typeof requestId !== "string") {
          return NextResponse.json({ error: "requestId is required." }, { status: 400 });
        }
        if (!productId || typeof productId !== "string") {
          return NextResponse.json({ error: "productId is required." }, { status: 400 });
        }
        if (!Number.isFinite(qty) || qty <= 0) {
          return NextResponse.json({ error: "quantity must be a positive number." }, { status: 400 });
        }
        const existingRequest = await prisma.inventoryRequest.findUnique({
          where: { id: requestId },
        });
        if (!existingRequest) {
          return NextResponse.json(
            { error: `Inventory request '${requestId}' not found.` },
            { status: 400 }
          );
        }
        if (existingRequest.status === "issued") {
          return NextResponse.json(
            { error: "This inventory request has already been fulfilled." },
            { status: 400 }
          );
        }
        if (existingRequest.status === "rejected") {
          return NextResponse.json(
            { error: "This inventory request was rejected and cannot be fulfilled." },
            { status: 400 }
          );
        }
        if (existingRequest.status !== "pending" && existingRequest.status !== "partially_issued") {
          return NextResponse.json(
            { error: `Inventory request cannot be fulfilled from status '${existingRequest.status}'.` },
            { status: 400 }
          );
        }
        // The product being issued must be the product the request names.
        // The queue row, its confirmation dialog and this deduction all key
        // off the request's own productId — a client that re-derives the
        // product from the display string (or guesses) is rejected here
        // instead of silently deducting a different item.
        if (existingRequest.productId && existingRequest.productId !== productId) {
          return NextResponse.json(
            {
              error: "The selected product does not match the product on this inventory request. Refresh the queue and retry.",
              code: "REQUEST_PRODUCT_MISMATCH",
            },
            { status: 400 }
          );
        }
        // Never issue more than the request still needs.
        const remainingQty =
          Math.round((Number(existingRequest.qtyRequested) - Number(existingRequest.qtyIssued)) * 1000) / 1000;
        if (qty > remainingQty) {
          return NextResponse.json(
            {
              error: `Only ${remainingQty} unit(s) remain on this request (${existingRequest.qtyIssued} of ${existingRequest.qtyRequested} already issued).`,
              code: "REQUEST_QTY_EXCEEDS_REMAINING",
            },
            { status: 400 }
          );
        }
        const productCheck = await prisma.product.findUnique({ where: { id: productId } });
        if (!productCheck) {
          return NextResponse.json({ error: "Product not found" }, { status: 400 });
        }

        // Consume + COGS posting + request status + job line item commit or
        // roll back together in a single transaction.
        let txResult: { invReq: any; product: any; createdJobItem: any };
        try {
          txResult = await prisma.$transaction(
            async (tx) => {
              // Assignment gate, inside the transaction before any stock
              // moves: stock is never issued to a job with no technician —
              // neither a lead assignedTechnicianId nor a live JobAssignment.
              const jobForGate = await tx.job.findUnique({
                where: { id: existingRequest.jobId },
                select: {
                  assignedTechnicianId: true,
                  assignments: {
                    where: { status: { not: "Removed" } },
                    select: { id: true },
                    take: 1,
                  },
                },
              });
              if (!jobForGate?.assignedTechnicianId && !(jobForGate?.assignments.length)) {
                const gateError: any = new Error(
                  "Assign a technician before issuing stock to this job"
                );
                gateError.code = "JOB_NOT_ASSIGNED";
                throw gateError;
              }

              // Claim the request first (status-guarded) so a concurrent fulfill
              // of the same request cannot double-issue stock.
              const claimed = await tx.inventoryRequest.updateMany({
                where: { id: requestId, status: { in: ["pending", "partially_issued"] } },
                data: { status: "issued" },
              });
              if (claimed.count === 0) {
                throw new Error(
                  "Inventory request changed state before it could be fulfilled. Refresh and retry."
                );
              }

              await InventoryService.consumeStock(
                productId,
                qty,
                "job_consumption",
                requestId,
                `Fulfilled tech request`,
                tx
              );

              // Record how much has now been issued and settle the status:
              // fully covered -> issued, otherwise it stays partially_issued
              // with an accurate qtyIssued (previously qtyIssued was never
              // updated on this path, so a partial issue looked untouched).
              const newQtyIssued =
                Math.round((Number(existingRequest.qtyIssued) + qty) * 1000) / 1000;
              await tx.inventoryRequest.update({
                where: { id: requestId },
                data: {
                  qtyIssued: newQtyIssued,
                  status:
                    newQtyIssued >= Number(existingRequest.qtyRequested)
                      ? "issued"
                      : "partially_issued",
                },
              });

              const updatedReq = await tx.inventoryRequest.findUnique({
                where: { id: requestId },
                include: { job: true },
              });

              // Automatically add the issued physical inventory item to the job's line items
              const prod = await tx.product.findUnique({ where: { id: productId } });
              let jobItem = null;
              if (prod && updatedReq?.jobId) {
                jobItem = await tx.jobItem.create({
                  data: {
                    jobId: updatedReq.jobId,
                    description: `${prod.name}${prod.sku ? ` - ${prod.sku}` : ""} - Issued by Storekeeper`,
                    quantityPlanned: qty,
                    quantityActual: qty,
                    unitRate: prod.unitPrice,
                  },
                });
              }

              return { invReq: updatedReq, product: prod, createdJobItem: jobItem };
            },
            { maxWait: 10000, timeout: 30000 }
          );
        } catch (txError: any) {
          if (txError?.code === "JOB_NOT_ASSIGNED") {
            return NextResponse.json(
              { error: txError.message, code: "JOB_NOT_ASSIGNED" },
              { status: 400 }
            );
          }
          throw txError;
        }
        const { invReq, product, createdJobItem } = txResult;

        await AuditService.recordCrudAction({
          actorName: payload.storeKeeperName || "Storekeeper",
          actorRole: "storekeeper",
          entityType: "InventoryRequest",
          entityId: requestId,
          entityNumber: invReq?.job?.jobNumber || `REQ-${requestId.slice(0, 8)}`,
          actionType: "INVENTORY",
          description: `Storekeeper issued ${qty}x ${product?.name || "item"} for Job #${invReq?.job?.jobNumber || ""}`,
          stateBefore: { status: existingRequest.status, productId, quantity: qty },
          stateAfter: { status: invReq?.status || "issued", productId, quantity: qty, jobItemId: createdJobItem?.id },
          canRollback: true,
        });

        return NextResponse.json({ success: true, request: invReq });
      }



      case "add_stock": {
        const { productId, quantity, unitCost, notes, source, paidFromAccountCode } = payload;
        const result = await InventoryService.addStock({
          productId,
          quantity: Number(quantity),
          unitCost: unitCost !== undefined ? Number(unitCost) : undefined,
          notes,
          source,
          paidFromAccountCode: paidFromAccountCode || null,
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
          forDirectSale: !isService && Boolean(payload.forDirectSale),
        });
        return NextResponse.json(product, { status: 201 });
      }

      case "update_product": {
        const { id, unitPrice, costPrice, name, unit, forDirectSale } = payload;
        const current = await prisma.product.findUnique({ where: { id } });
        if (!current) throw new Error("Product not found");
        // Stock value sits in 1200 or 1210 depending on this flag, so it can only flip while no stock is on hand.
        if (forDirectSale !== undefined && Boolean(forDirectSale) !== current.forDirectSale && Math.abs(current.stockQuantity) > 1e-9) {
          return NextResponse.json(
            { error: "Direct-sale flag can only be changed when the product has no stock on hand (its value would sit in the wrong inventory account)." },
            { status: 400 }
          );
        }
        // Cost changes with stock on hand would make the GL inventory value drift from qty x cost.
        if (costPrice !== undefined && Math.abs(Number(costPrice) - current.costPrice) > 1e-9 && current.stockQuantity > 1e-9) {
          return NextResponse.json(
            { error: "Cost price is a moving average of purchases and cannot be edited while stock is on hand. Use a stock adjustment instead." },
            { status: 400 }
          );
        }
        const updated = await prisma.product.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(unit && { unit }),
            ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
            ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
            ...(forDirectSale !== undefined && { forDirectSale: Boolean(forDirectSale) }),
          },
        });
        return NextResponse.json(updated, { status: 200 });
      }

      case "branch_transfer": {
        const { productId, quantity, fromBranch, toBranch, challanNumber, notes } = payload;
        const qtyNum = Number(quantity);
        if (!qtyNum || qtyNum <= 0) {
          return NextResponse.json({ error: "Transfer quantity must be greater than zero." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Product not found");

          // Resolve accounts first: if the GL entry cannot be posted, no stock is moved.
          const transferVal = Math.round(qtyNum * (product.costPrice || 0) * 100) / 100;
          const invAssetAcc = await InventoryService.stockAccountFor(tx, product, "inventory_cogs_asset"); // 1200 or 1210
          const transitAcc = await AccountMappingService.resolveAccount({
            transactionType: "inventory_in_transit",
            prismaClient: tx,
          });
          if (invAssetAcc.id === transitAcc.id) {
            throw new Error("Stock-in-transit account must differ from the stock account. Fix it in Accounts > Account Mapping.");
          }

          // Atomic decrement (same guard as consumeStock): never goes below zero under concurrency.
          const dec = await tx.product.updateMany({
            where: { id: productId, stockQuantity: { gte: qtyNum } },
            data: { stockQuantity: { decrement: qtyNum } },
          });
          if (dec.count === 0) {
            const live = await tx.product.findUnique({ where: { id: productId } });
            throw new Error(`Insufficient stock for branch transfer. Available: ${live?.stockQuantity ?? 0}`);
          }

          const ledger = await tx.stockLedger.create({
            data: {
              productId,
              qty: qtyNum,
              direction: "out",
              refType: "branch_transfer",
              notes: `[Transfer: ${fromBranch || "Central Warehouse"} ➔ ${toBranch || "Branch Depot"}] Challan #${challanNumber || "TRF-" + Date.now().toString().slice(-4)}: ${notes || ""}`.trim(),
            },
          });

          // Dr Stock in Transit / Cr Inventory (1200 or 1210). Failure rolls back the stock move.
          if (transferVal > 0) {
            await AccountsPostingService.post({
              memo: `Branch Stock Transfer: ${product.name} (${qtyNum} units) [${fromBranch || "Central"} -> ${toBranch || "Branch"}]`,
              refType: "branch_transfer",
              refId: ledger.id,
              lines: [
                { accountId: transitAcc.id, debit: transferVal, credit: 0 },
                { accountId: invAssetAcc.id, debit: 0, credit: transferVal },
              ],
              tx,
            });
          }

          return ledger;
        }, { maxWait: 10000, timeout: 30000 });

        return NextResponse.json({ success: true, ledger: result });
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
            product,
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
            product,
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
