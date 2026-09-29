export const dynamic = "force-dynamic";
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
          if (
            hasReturnLedger ||
            itemText.includes(pSku) ||
            itemText.includes(pName)
          ) {
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
    let products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    // Auto-seed standard predefined HVAC services if none exist in the database
    const hasServices = products.some(
      (p) =>
        (p.sku && (p.sku.startsWith("SRV-") || p.sku.startsWith("SVC-"))) ||
        p.unit === "service" ||
        p.unit === "visit" ||
        p.unit === "job"
    );

    if (!hasServices) {
      const defaultServices = [
        {
          sku: "SRV-AC-WASH",
          name: "Master Split AC Deep Chemical Jet Wash",
          unit: "service",
          unitPrice: 3500,
          costPrice: 1200,
          stockQuantity: 0,
          reorderLevel: 0,
        },
        {
          sku: "SRV-LEAK-DIAG",
          name: "Refrigerant Leakage Pressure Test & Diagnostic",
          unit: "service",
          unitPrice: 2500,
          costPrice: 800,
          stockQuantity: 0,
          reorderLevel: 0,
        },
        {
          sku: "SRV-PCB-REP",
          name: "Inverter PCB Diagnostic & Circuit Component Repair",
          unit: "job",
          unitPrice: 6500,
          costPrice: 2500,
          stockQuantity: 0,
          reorderLevel: 0,
        },
        {
          sku: "SRV-COMP-REP",
          name: "AC Compressor Replacement & Brazing Labor",
          unit: "service",
          unitPrice: 5000,
          costPrice: 2000,
          stockQuantity: 0,
          reorderLevel: 0,
        },
        {
          sku: "SRV-ELEC-CK",
          name: "Electrical Distribution & Voltage Stabilizer Inspection",
          unit: "visit",
          unitPrice: 1800,
          costPrice: 600,
          stockQuantity: 0,
          reorderLevel: 0,
        },
      ];

      for (const srv of defaultServices) {
        const existing = await prisma.product.findUnique({ where: { sku: srv.sku } });
        if (!existing) {
          await prisma.product.create({ data: srv });
        }
      }

      products = await prisma.product.findMany({
        orderBy: { name: "asc" },
      });
    }

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
        const direction = type === "increase" ? "in" : "out";
        await prisma.product.update({
          where: { id: productId },
          data: {
            stockQuantity: type === "increase" ? { increment: qtyNum } : { decrement: qtyNum },
          },
        });
        const ledger = await prisma.stockLedger.create({
          data: {
            productId,
            qty: qtyNum,
            direction,
            refType: "stock_adjustment",
            notes: `[Audit Adjustment (${type === "increase" ? "+" : "-"}${qtyNum}): ${reason || "Variance"}] ${notes || ""}`.trim(),
          },
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
        await prisma.product.update({
          where: { id: productId },
          data: { stockQuantity: { decrement: qtyNum } },
        });
        const ledger = await prisma.stockLedger.create({
          data: {
            productId,
            qty: qtyNum,
            direction: "out",
            refType: "workshop_consumption",
            notes: `[Workshop Internal: ${workshopUnit || "Fabrication Bench"}] Tech: ${technicianName || "Shop Tech"}. ${notes || ""}`.trim(),
          },
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
