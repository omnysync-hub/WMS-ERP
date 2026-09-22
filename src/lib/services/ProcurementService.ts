/**
 * Enterprise Procurement Service
 * Handles End-to-End Requisition, RFQ/Sourcing, PO, GRN, 3-Way Match & Reports
 */
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { AccountMappingService } from "./AccountMappingService";


export interface CreateVendorInput {
  name: string;
  vendorCode?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  addressText?: string;
  ntnNumber?: string;
  strnNumber?: string;
  taxId?: string;
  paymentTerms?: string;
  currency?: string;
  bankName?: string;
  bankAccountTitle?: string;
  bankAccountNumber?: string;
  category?: string;
  status?: string;
  whtRate?: number;
  whtExempt?: boolean;
  paymentTermsDays?: number;
}

export interface CreatePrItemInput {
  productId?: string;
  itemCode?: string;
  description?: string;
  quantity: number;
  unit?: string;
  estimatedPrice?: number;
}

export interface CreatePrInput {
  requestedBy: string;
  department?: string;
  site?: string;
  dateRequired?: string | Date;
  costCenter?: string;
  projectCode?: string;
  budgetCode?: string;
  priority?: "Normal" | "Urgent";
  notes?: string;
  attachments?: string;
  items: CreatePrItemInput[];
}

export interface CreateRfqInput {
  title: string;
  dueDate: string | Date;
  notes?: string;
  prIds?: string[];
  invitedVendorIds: string[];
  items: {
    productId?: string;
    itemCode?: string;
    description: string;
    quantity: number;
    unit?: string;
    targetPrice?: number;
  }[];
}

export interface SubmitQuoteInput {
  rfqVendorId: string;
  deliveryDays?: number;
  paymentTerms?: string;
  quotationReference?: string;
  qualityScore?: number;
  remarks?: string;
  items: {
    rfqItemId: string;
    unitPrice: number;
    taxRate?: number;
    notes?: string;
  }[];
}

export interface CreatePoItemInput {
  productId?: string;
  itemCode?: string;
  description?: string;
  quantity: number;
  unitCost: number;
  unit?: string;
  discountPercent?: number;
  taxPercent?: number;
  deliverySchedule?: string;
  prItemId?: string;
}

export interface CreatePoInput {
  poType?: "standard" | "blanket" | "service";
  vendorId?: string;
  supplierName: string;
  supplierEmail: string;
  prId?: string;
  rfqId?: string;
  poDate?: string | Date;
  expectedDeliveryDate?: string | Date;
  paymentTerms?: string;
  currency?: string;
  shippingAddress?: string;
  termsAndConditions?: string;
  items: CreatePoItemInput[];
}

export interface CreateGrnItemInput {
  poItemId?: string;
  productId?: string;
  itemCode?: string;
  description?: string;
  unit?: string;
  quantityReceived: number;
  quantityAccepted?: number;
  quantityRejected?: number;
  qualityStatus?: "Accepted" | "Rejected" | "Hold";
  rejectionReason?: string;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string | Date;
}

export interface CreateGrnInput {
  poId: string;
  receivedBy: string;
  receivedDate?: string | Date;
  warehouseLocation?: string;
  deliveryChallan?: string;
  qualityStatus?: "Accepted" | "Rejected" | "Hold";
  notes?: string;
  items: CreateGrnItemInput[];
}

export interface CreateSupplierInvoiceInput {
  invoiceNumber: string;
  vendorId: string;
  poId?: string;
  grnId?: string;
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  matchNotes?: string;
  items: {
    poItemId?: string;
    grnItemId?: string;
    productId?: string;
    description: string;
    billedQuantity: number;
    billedUnitPrice: number;
  }[];
}

export interface RecordPaymentInput {
  supplierInvoiceId: string;
  amount: number;
  paymentMethod?: "bank_transfer" | "cheque" | "cash";
  reference?: string;
  bankAccountId?: string;
  whtAmount?: number;
  notes?: string;
}

export class ProcurementService {
  // ==========================================
  // 1. VENDOR MASTER (Supplier Management)
  // ==========================================

  static async getVendors(filter?: { status?: string; category?: string; search?: string }) {
    const where: any = {};
    if (filter?.status && filter.status !== "all") where.status = filter.status;
    if (filter?.category && filter.category !== "all") where.category = filter.category;
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { vendorCode: { contains: filter.search, mode: "insensitive" } },
        { contactPerson: { contains: filter.search, mode: "insensitive" } },
        { email: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        purchaseOrders: {
          select: { id: true, totalAmount: true, status: true },
        },
        vendorLedgerEntries: {
          orderBy: { postingDate: "desc" },
          take: 1,
          select: { runningBalance: true },
        },
        supplierInvoices: {
          select: { id: true, totalAmount: true, paidAmount: true, paymentStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return vendors.map((v) => {
      const totalPoSpend = v.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
      const totalInvoiced = v.supplierInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const totalPaid = v.supplierInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
      const outstandingPayable = totalInvoiced - totalPaid;
      const runningBalance = v.vendorLedgerEntries[0]?.runningBalance ?? outstandingPayable;

      return {
        ...v,
        totalPoSpend,
        totalInvoiced,
        totalPaid,
        outstandingPayable,
        runningBalance,
        poCount: v.purchaseOrders.length,
      };
    });
  }

  static async createVendor(data: CreateVendorInput) {
    let vendorCode = data.vendorCode;
    if (!vendorCode) {
      const count = await prisma.vendor.count();
      vendorCode = `VND-${String(count + 1).padStart(4, "0")}`;
    }

    return await prisma.vendor.create({
      data: {
        vendorCode,
        name: data.name.trim(),
        contactPerson: data.contactPerson?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        addressText: data.addressText?.trim() || null,
        ntnNumber: data.ntnNumber?.trim() || null,
        strnNumber: data.strnNumber?.trim() || null,
        taxId: data.taxId?.trim() || data.ntnNumber?.trim() || null,
        paymentTerms: data.paymentTerms || "Net 30",
        paymentTermsDays: data.paymentTermsDays ?? 30,
        currency: data.currency || "PKR",
        bankName: data.bankName?.trim() || null,
        bankAccountTitle: data.bankAccountTitle?.trim() || null,
        bankAccountNumber: data.bankAccountNumber?.trim() || null,
        category: data.category || "Spares & Raw Material",
        status: data.status || "Active",
        whtRate: data.whtRate ?? 0,
        whtExempt: Boolean(data.whtExempt),
      },
    });
  }

  static async updateVendor(id: string, data: Partial<CreateVendorInput>) {
    return await prisma.vendor.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson?.trim() || null }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        ...(data.email !== undefined && { email: data.email?.trim() || null }),
        ...(data.addressText !== undefined && { addressText: data.addressText?.trim() || null }),
        ...(data.ntnNumber !== undefined && { ntnNumber: data.ntnNumber?.trim() || null }),
        ...(data.strnNumber !== undefined && { strnNumber: data.strnNumber?.trim() || null }),
        ...(data.taxId !== undefined && { taxId: data.taxId?.trim() || null }),
        ...(data.paymentTerms && { paymentTerms: data.paymentTerms }),
        ...(data.paymentTermsDays !== undefined && { paymentTermsDays: data.paymentTermsDays }),
        ...(data.currency && { currency: data.currency }),
        ...(data.bankName !== undefined && { bankName: data.bankName?.trim() || null }),
        ...(data.bankAccountTitle !== undefined && { bankAccountTitle: data.bankAccountTitle?.trim() || null }),
        ...(data.bankAccountNumber !== undefined && { bankAccountNumber: data.bankAccountNumber?.trim() || null }),
        ...(data.category && { category: data.category }),
        ...(data.status && { status: data.status }),
        ...(data.whtRate !== undefined && { whtRate: data.whtRate }),
        ...(data.whtExempt !== undefined && { whtExempt: data.whtExempt }),
      },
    });
  }

  // ==========================================
  // 2. PURCHASE REQUISITION (PR) & APPROVAL
  // ==========================================

  static async getPurchaseRequisitions(filter?: { status?: string; priority?: string }) {
    const where: any = {};
    if (filter?.status && filter.status !== "all") where.status = filter.status;
    if (filter?.priority && filter.priority !== "all") where.priority = filter.priority;

    return await prisma.purchaseRequisition.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
        purchaseOrders: {
          select: { id: true, poNumber: true, status: true, totalAmount: true },
        },
        rfqLinks: {
          include: {
            rfq: { select: { id: true, rfqNumber: true, title: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createPurchaseRequisition(data: CreatePrInput) {
    const count = await prisma.purchaseRequisition.count();
    const prNumber = `PR-2026-${String(count + 1).padStart(4, "0")}`;

    const itemsData = [];
    for (const it of data.items) {
      let desc = it.description;
      let unit = it.unit || "unit";
      let price = it.estimatedPrice || 0;
      let code = it.itemCode;

      if (it.productId) {
        const prod = await prisma.product.findUnique({ where: { id: it.productId } });
        if (prod) {
          desc = desc || prod.name;
          unit = unit || prod.unit;
          price = price || prod.costPrice;
          code = code || prod.sku;
        }
      }

      itemsData.push({
        productId: it.productId || null,
        itemCode: code || null,
        description: desc || "Procurement Item",
        quantity: Number(it.quantity) || 1,
        unit,
        estimatedPrice: price,
        convertedQuantity: 0,
      });
    }

    return await prisma.purchaseRequisition.create({
      data: {
        prNumber,
        requestedBy: data.requestedBy.trim(),
        department: data.department || "HVAC Operations",
        site: data.site || "Head Office / Central Workshop",
        dateRequired: data.dateRequired ? new Date(data.dateRequired) : null,
        costCenter: data.costCenter || null,
        projectCode: data.projectCode || null,
        budgetCode: data.budgetCode || null,
        priority: data.priority || "Normal",
        status: "draft",
        notes: data.notes || null,
        attachments: data.attachments || null,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });
  }

  static async updateRequisitionStatus(
    id: string,
    status: "submitted" | "approved" | "rejected",
    actorName: string,
    reason?: string
  ) {
    const pr = await prisma.purchaseRequisition.findUnique({ where: { id } });
    if (!pr) throw new Error("Purchase requisition not found");

    const now = new Date();
    const updateData: any = { status };

    if (status === "approved") {
      updateData.approvedBy = actorName;
      updateData.approvedAt = now;
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
      updateData.rejectionReason = null;
    } else if (status === "rejected") {
      updateData.rejectedBy = actorName;
      updateData.rejectedAt = now;
      updateData.rejectionReason = reason || "Requisition was not approved.";
    }

    return await prisma.purchaseRequisition.update({
      where: { id },
      data: updateData,
      include: { items: { include: { product: true } } },
    });
  }

  // ==========================================
  // 3. REQUEST FOR QUOTATION (RFQ) & SOURCING
  // ==========================================

  static async getRfqs() {
    return await prisma.requestForQuotation.findMany({
      include: {
        items: {
          include: { product: true },
        },
        vendors: {
          include: {
            vendor: true,
            quotationItems: {
              include: { rfqItem: true },
            },
          },
        },
        prLinks: {
          include: { pr: true },
        },
        purchaseOrders: {
          select: { id: true, poNumber: true, totalAmount: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createRfq(data: CreateRfqInput) {
    const count = await prisma.requestForQuotation.count();
    const rfqNumber = `RFQ-2026-${String(count + 1).padStart(4, "0")}`;

    const itemsData = [];
    for (const it of data.items) {
      let code = it.itemCode;
      let desc = it.description;
      let unit = it.unit || "unit";

      if (it.productId) {
        const prod = await prisma.product.findUnique({ where: { id: it.productId } });
        if (prod) {
          code = code || prod.sku;
          desc = desc || prod.name;
          unit = unit || prod.unit;
        }
      }

      itemsData.push({
        productId: it.productId || null,
        itemCode: code || null,
        description: desc,
        quantity: Number(it.quantity) || 1,
        unit,
        targetPrice: it.targetPrice ? Number(it.targetPrice) : null,
      });
    }

    const vendorsData = (data.invitedVendorIds || []).map((vId) => ({
      vendorId: vId,
      status: "invited",
      qualityScore: 85,
    }));

    const prLinksData = (data.prIds || []).map((prId) => ({
      prId,
    }));

    return await prisma.requestForQuotation.create({
      data: {
        rfqNumber,
        title: data.title.trim(),
        dueDate: new Date(data.dueDate),
        status: "sent",
        notes: data.notes || null,
        items: {
          create: itemsData,
        },
        vendors: {
          create: vendorsData,
        },
        prLinks: {
          create: prLinksData,
        },
      },
      include: {
        items: true,
        vendors: { include: { vendor: true } },
        prLinks: { include: { pr: true } },
      },
    });
  }

  static async submitVendorQuote(input: SubmitQuoteInput) {
    const rfqVendor = await prisma.rfqVendor.findUnique({
      where: { id: input.rfqVendorId },
      include: { rfq: { include: { items: true } } },
    });
    if (!rfqVendor) throw new Error("RFQ Vendor entry not found");

    // Clear any previous quotation items for this vendor
    await prisma.vendorQuotationItem.deleteMany({
      where: { rfqVendorId: input.rfqVendorId },
    });

    let totalQuoted = 0;
    const quoteItemsData = [];

    for (const item of input.items) {
      const lineTotal = Number(item.unitPrice) * (rfqVendor.rfq.items.find((i) => i.id === item.rfqItemId)?.quantity || 1);
      totalQuoted += lineTotal;
      quoteItemsData.push({
        rfqItemId: item.rfqItemId,
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate) || 0,
        lineTotal,
        notes: item.notes || null,
      });
    }

    const updatedVendor = await prisma.rfqVendor.update({
      where: { id: input.rfqVendorId },
      data: {
        status: "quoted",
        deliveryDays: input.deliveryDays !== undefined ? Number(input.deliveryDays) : null,
        paymentTerms: input.paymentTerms || null,
        quotationReference: input.quotationReference || null,
        qualityScore: input.qualityScore !== undefined ? Number(input.qualityScore) : 85,
        remarks: input.remarks || null,
        totalQuoted,
        submittedAt: new Date(),
        quotationItems: {
          create: quoteItemsData,
        },
      },
      include: {
        vendor: true,
        quotationItems: true,
      },
    });

    // Update parent RFQ status to quotes_received
    await prisma.requestForQuotation.update({
      where: { id: rfqVendor.rfqId },
      data: { status: "quotes_received" },
    });

    return updatedVendor;
  }

  static async awardRfqAndGeneratePo(rfqId: string, winnerVendorId: string, actorName = "Procurement Lead") {
    const rfq = await prisma.requestForQuotation.findUnique({
      where: { id: rfqId },
      include: {
        items: { include: { product: true } },
        vendors: {
          include: { vendor: true, quotationItems: true },
        },
        prLinks: true,
      },
    });
    if (!rfq) throw new Error("RFQ not found");

    const winnerRfqVendor = rfq.vendors.find((v) => v.vendorId === winnerVendorId || v.id === winnerVendorId);
    if (!winnerRfqVendor) throw new Error("Winner vendor quote not found for this RFQ");

    // Reset winner flag for others and set for winner
    await prisma.rfqVendor.updateMany({
      where: { rfqId },
      data: { isWinner: false, status: "declined" },
    });
    await prisma.rfqVendor.update({
      where: { id: winnerRfqVendor.id },
      data: { isWinner: true, status: "winner" },
    });

    const now = new Date();
    await prisma.requestForQuotation.update({
      where: { id: rfqId },
      data: {
        status: "awarded",
        winnerVendorId: winnerRfqVendor.vendorId,
        awardedAt: now,
      },
    });

    // Generate PO automatically
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-2026-${String(count + 1).padStart(4, "0")}`;

    let totalAmount = 0;
    const poItemsData = [];

    for (const rfqItem of rfq.items) {
      const quoteItem = winnerRfqVendor.quotationItems.find((qi) => qi.rfqItemId === rfqItem.id);
      const unitCost = quoteItem?.unitPrice ?? (rfqItem.product?.costPrice || 0);
      const lineTotal = unitCost * rfqItem.quantity;
      totalAmount += lineTotal;

      poItemsData.push({
        productId: rfqItem.productId || null,
        itemCode: rfqItem.itemCode || rfqItem.product?.sku || null,
        description: rfqItem.description || rfqItem.product?.name || "RFQ Item",
        quantity: rfqItem.quantity,
        unit: rfqItem.unit,
        unitCost,
        discountPercent: 0,
        taxPercent: quoteItem?.taxRate || 0,
        lineTotal,
      });
    }

    const expectedDate = new Date();
    if (winnerRfqVendor.deliveryDays) {
      expectedDate.setDate(expectedDate.getDate() + winnerRfqVendor.deliveryDays);
    } else {
      expectedDate.setDate(expectedDate.getDate() + 7);
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        poType: "standard",
        vendorId: winnerRfqVendor.vendorId,
        rfqId: rfq.id,
        prId: rfq.prLinks[0]?.prId || null,
        supplierName: winnerRfqVendor.vendor.name,
        supplierEmail: winnerRfqVendor.vendor.email || "orders@vendor.pk",
        poDate: now,
        expectedDeliveryDate: expectedDate,
        paymentTerms: winnerRfqVendor.paymentTerms || winnerRfqVendor.vendor.paymentTerms || "Net 30",
        currency: winnerRfqVendor.vendor.currency || "PKR",
        shippingAddress: "Central Warehouse, Workshop St, Gulberg III, Lahore, Pakistan",
        termsAndConditions: "Standard Commercial Terms: Goods subject to Quality Inspection upon receipt. 3-Way Invoice Matching strictly enforced before disbursement.",
        status: "approved",
        approvedBy: actorName,
        approvedAt: now,
        totalAmount,
        whtAmount: Math.round((totalAmount * (winnerRfqVendor.vendor.whtRate || 0)) / 100),
        netPayable: Math.round(totalAmount - (totalAmount * (winnerRfqVendor.vendor.whtRate || 0)) / 100),
        items: {
          create: poItemsData,
        },
      },
      include: {
        items: true,
        vendor: true,
      },
    });

    return { rfq, winner: winnerRfqVendor, po };
  }

  // ==========================================
  // 4. PURCHASE ORDER (PO) LIFECYCLE
  // ==========================================

  static async getPurchaseOrders(filter?: { status?: string; poType?: string }) {
    const where: any = {};
    if (filter?.status && filter.status !== "all") where.status = filter.status;
    if (filter?.poType && filter.poType !== "all") where.poType = filter.poType;

    return await prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: true,
        pr: true,
        rfq: true,
        items: {
          include: { product: true },
        },
        goodsReceipts: {
          include: { items: true },
        },
        supplierInvoices: {
          include: { payments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createPurchaseOrder(data: CreatePoInput) {
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-2026-${String(count + 1).padStart(4, "0")}`;

    let vendor = null;
    if (data.vendorId) {
      vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
    }

    let totalAmount = 0;
    const poItemsData = [];

    for (const it of data.items) {
      let code = it.itemCode;
      let desc = it.description;
      let unit = it.unit || "unit";
      let cost = Number(it.unitCost) || 0;

      if (it.productId) {
        const prod = await prisma.product.findUnique({ where: { id: it.productId } });
        if (prod) {
          code = code || prod.sku;
          desc = desc || prod.name;
          unit = unit || prod.unit;
          if (!cost) cost = prod.costPrice;
        }
      }

      const qty = Number(it.quantity) || 1;
      const discount = Number(it.discountPercent) || 0;
      const tax = Number(it.taxPercent) || 0;
      const sub = cost * qty * (1 - discount / 100);
      const lineTot = sub * (1 + tax / 100);
      totalAmount += lineTot;

      poItemsData.push({
        productId: it.productId || null,
        itemCode: code || null,
        description: desc || "Ordered Material",
        quantity: qty,
        unitCost: cost,
        unit,
        discountPercent: discount,
        taxPercent: tax,
        lineTotal: Math.round(lineTot * 100) / 100,
        deliverySchedule: it.deliverySchedule || null,
        prItemId: it.prItemId || null,
        quantityReceived: 0,
        quantityInvoiced: 0,
      });

      // Update PR item converted quantity if linked
      if (it.prItemId) {
        await prisma.purchaseRequisitionItem.update({
          where: { id: it.prItemId },
          data: { convertedQuantity: { increment: qty } },
        });
      }
    }

    const whtRate = vendor?.whtRate || 0;
    const whtAmount = Math.round((totalAmount * whtRate) / 100);
    const netPayable = Math.round(totalAmount - whtAmount);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        poType: data.poType || "standard",
        vendorId: data.vendorId || null,
        supplierName: data.supplierName || vendor?.name || "Direct Supplier",
        supplierEmail: data.supplierEmail || vendor?.email || "orders@vendor.pk",
        prId: data.prId || null,
        rfqId: data.rfqId || null,
        poDate: data.poDate ? new Date(data.poDate) : new Date(),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        paymentTerms: data.paymentTerms || vendor?.paymentTerms || "Net 30",
        currency: data.currency || vendor?.currency || "PKR",
        shippingAddress: data.shippingAddress || "Central Warehouse, Workshop St, Gulberg III, Lahore, Pakistan",
        termsAndConditions: data.termsAndConditions || "Standard Purchase Terms: 100% inspection upon receipt. Discrepancies reportable within 48h.",
        status: "draft",
        totalAmount,
        whtAmount,
        netPayable,
        items: {
          create: poItemsData,
        },
      },
      include: {
        items: { include: { product: true } },
        vendor: true,
      },
    });

    // If linked to a PR, mark PR as converted or partially converted
    if (data.prId) {
      await prisma.purchaseRequisition.update({
        where: { id: data.prId },
        data: { status: "converted_to_po" },
      });
    }

    return po;
  }

  static async approvePurchaseOrder(id: string, actorName = "Admin") {
    return await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "approved",
        approvedBy: actorName,
        approvedAt: new Date(),
      },
      include: { items: true, vendor: true },
    });
  }

  static async sendPoToVendor(id: string) {
    return await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "sent_to_vendor",
        sentAt: new Date(),
      },
      include: { items: true, vendor: true },
    });
  }

  // Convert multiple PRs or single PR into a single PO
  static async convertPrsToPo(params: {
    prIds: string[];
    vendorId: string;
    poType?: "standard" | "blanket" | "service";
    expectedDeliveryDate?: string | Date;
  }) {
    const prs = await prisma.purchaseRequisition.findMany({
      where: { id: { in: params.prIds } },
      include: { items: { include: { product: true } } },
    });
    if (prs.length === 0) throw new Error("No purchase requisitions found");

    const vendor = await prisma.vendor.findUnique({ where: { id: params.vendorId } });
    if (!vendor) throw new Error("Vendor not found");

    const poItems: CreatePoItemInput[] = [];
    for (const pr of prs) {
      for (const it of pr.items) {
        const remainingQty = Math.max(0, it.quantity - it.convertedQuantity);
        if (remainingQty > 0) {
          poItems.push({
            productId: it.productId || undefined,
            itemCode: it.itemCode || it.product?.sku || undefined,
            description: it.description || it.product?.name || "PR Item",
            quantity: remainingQty,
            unitCost: it.estimatedPrice || it.product?.costPrice || 0,
            unit: it.unit,
            prItemId: it.id,
          });
        }
      }
    }

    if (poItems.length === 0) {
      throw new Error("All items from selected PRs have already been converted to POs.");
    }

    return await this.createPurchaseOrder({
      poType: params.poType || "standard",
      vendorId: vendor.id,
      supplierName: vendor.name,
      supplierEmail: vendor.email || "orders@vendor.pk",
      prId: prs[0]?.id,
      expectedDeliveryDate: params.expectedDeliveryDate,
      paymentTerms: vendor.paymentTerms || "Net 30",
      items: poItems,
    });
  }

  // ==========================================
  // 5. GOODS RECEIPT NOTE (GRN) & INVENTORY RECEIPT
  // ==========================================

  static async getGoodsReceipts() {
    return await prisma.goodsReceipt.findMany({
      include: {
        po: { include: { vendor: true } },
        items: { include: { product: true, poItem: true } },
        supplierInvoices: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createGoodsReceipt(data: CreateGrnInput) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.poId },
      include: { items: { include: { product: true } }, vendor: true },
    });
    if (!po) throw new Error("Purchase order not found");

    const count = await prisma.goodsReceipt.count();
    const grnNumber = `GRN-2026-${String(count + 1).padStart(4, "0")}`;

    const grnItemsData = [];
    let totalAcceptedValue = 0;

    for (const item of data.items) {
      const poItem = po.items.find((pi) => pi.id === item.poItemId);
      const pId = item.productId || poItem?.productId;
      const unitCost = poItem?.unitCost || 0;

      const qtyRec = Number(item.quantityReceived) || 0;
      const quality = item.qualityStatus || "Accepted";
      const qtyAcc = quality === "Accepted" ? (item.quantityAccepted ?? qtyRec) : 0;
      const qtyRej = qtyRec - qtyAcc;

      totalAcceptedValue += qtyAcc * unitCost;

      grnItemsData.push({
        poItemId: item.poItemId || null,
        productId: pId || null,
        itemCode: item.itemCode || poItem?.itemCode || null,
        description: item.description || poItem?.description || "Received Material",
        unit: item.unit || poItem?.unit || "unit",
        quantityReceived: qtyRec,
        quantityAccepted: qtyAcc,
        quantityRejected: qtyRej,
        qualityStatus: quality,
        rejectionReason: qtyRej > 0 ? (item.rejectionReason || "Failed QA inspection") : null,
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      });

      // Update PO item quantityReceived
      if (poItem) {
        await prisma.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: { increment: qtyAcc } },
        });
      }

      // Update Product physical stock if item has Product link and accepted > 0
      if (pId && qtyAcc > 0) {
        await prisma.product.update({
          where: { id: pId },
          data: { stockQuantity: { increment: qtyAcc } },
        });

        await prisma.stockLedger.create({
          data: {
            productId: pId,
            qty: qtyAcc,
            direction: "in",
            refType: "grn",
            refId: grnNumber,
            notes: `Inward GRN ${grnNumber} under PO ${po.poNumber} (${quality})`,
          },
        });
      }
    }

    // 1. Create GRN Record
    const grn = await prisma.goodsReceipt.create({
      data: {
        grnNumber,
        poId: po.id,
        receivedBy: data.receivedBy.trim(),
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
        warehouseLocation: data.warehouseLocation || "Central Warehouse",
        deliveryChallan: data.deliveryChallan || null,
        qualityStatus: data.qualityStatus || "Accepted",
        status: "received",
        notes: data.notes || null,
        items: {
          create: grnItemsData,
        },
      },
      include: {
        items: true,
        po: { include: { vendor: true } },
      },
    });

    // 2. Double-Entry General Ledger Posting
    // Debit: 1200 Inventory Asset
    // Credit: 2050 GR/IR Clearing Account (Unbilled Receipts)
    const roundedValue = Math.round(totalAcceptedValue * 100) / 100;
    if (roundedValue > 0) {
      try {
        const inventoryAccount = await AccountMappingService.resolveAccount({
          transactionType: "grn_receipt_asset",
        });
        const grirAccount = await AccountMappingService.resolveAccount({
          transactionType: "grn_receipt_clearing",
        });

        const journal = await AccountsPostingService.post({
          memo: `Goods Receipt ${grnNumber} for PO ${po.poNumber} (${po.supplierName}) [Accepted Val: PKR ${roundedValue.toLocaleString()}]`,
          refType: "grn_receipt",
          refId: grn.id,
          postedBy: data.receivedBy,
          lines: [
            { accountId: inventoryAccount.id, debit: roundedValue, credit: 0 },
            { accountId: grirAccount.id, debit: 0, credit: roundedValue },
          ],
        });

        await prisma.goodsReceipt.update({
          where: { id: grn.id },
          data: { accountingJournalId: journal.id },
        });
      } catch (err: any) {
        console.error("Failed to post GRN accounting voucher:", err.message);
      }
    }

    // 3. Update PO Overall Status (partially_received or fully_received)
    const updatedPo = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { items: true },
    });

    const isFullyReceived = updatedPo?.items.every((it) => it.quantityReceived >= it.quantity);
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: isFullyReceived ? "fully_received" : "partially_received",
      },
    });

    return grn;
  }

  static processGrn = this.createGoodsReceipt;

  // ==========================================
  // 6. INVOICE VERIFICATION (3-WAY MATCHING)
  // ==========================================

  static async getSupplierInvoices() {
    return await prisma.supplierInvoice.findMany({
      include: {
        vendor: true,
        po: { include: { items: true } },
        grn: { include: { items: true } },
        items: {
          include: { product: true, poItem: true, grnItem: true },
        },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createSupplierInvoice(data: CreateSupplierInvoiceInput) {
    const count = await prisma.supplierInvoice.count();
    const referenceNumber = `VINV-2026-${String(count + 1).padStart(4, "0")}`;

    const po = data.poId
      ? await prisma.purchaseOrder.findUnique({
          where: { id: data.poId },
          include: { items: true, vendor: true },
        })
      : null;

    const grn = data.grnId
      ? await prisma.goodsReceipt.findUnique({
          where: { id: data.grnId },
          include: { items: true },
        })
      : null;

    let subtotal = 0;
    let totalQuantityVariance = 0;
    let totalPriceVariance = 0;
    let hasDiscrepancy = false;

    const invoiceItemsData = [];

    for (const item of data.items) {
      const poItem = po?.items.find((p) => p.id === item.poItemId);
      const grnItem = grn?.items.find((g) => g.id === item.grnItemId);

      const billedQty = Number(item.billedQuantity) || 0;
      const billedPrice = Number(item.billedUnitPrice) || 0;
      const lineTotal = Math.round(billedQty * billedPrice * 100) / 100;
      subtotal += lineTotal;

      const expectedPoPrice = poItem ? poItem.unitCost : billedPrice;
      const expectedGrnQty = grnItem ? grnItem.quantityAccepted : billedQty;

      // Variances
      const qtyVar = billedQty - expectedGrnQty;
      const priceVar = Math.round((billedPrice - expectedPoPrice) * billedQty * 100) / 100;

      totalQuantityVariance += qtyVar;
      totalPriceVariance += priceVar;

      // Flag discrepancy if vendor billed more than received OR price exceeds PO agreed price
      if (qtyVar > 0.001 || priceVar > 0.01) {
        hasDiscrepancy = true;
      }

      invoiceItemsData.push({
        poItemId: item.poItemId || null,
        grnItemId: item.grnItemId || null,
        productId: item.productId || poItem?.productId || null,
        description: item.description || poItem?.description || "Invoiced Product/Service",
        billedQuantity: billedQty,
        billedUnitPrice: billedPrice,
        poUnitPrice: expectedPoPrice,
        grnQuantity: expectedGrnQty,
        lineTotal,
        variance: priceVar,
      });

      // Update PO item invoiced quantity
      if (poItem) {
        await prisma.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityInvoiced: { increment: billedQty } },
        });
      }
    }

    const taxAmount = Number(data.taxAmount) || 0;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const matchStatus = hasDiscrepancy ? "discrepancy" : "matched";

    return await prisma.supplierInvoice.create({
      data: {
        invoiceNumber: data.invoiceNumber.trim(),
        referenceNumber,
        vendorId: data.vendorId,
        poId: data.poId || null,
        grnId: data.grnId || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        subtotal,
        taxAmount,
        totalAmount,
        matchStatus,
        priceVariance: totalPriceVariance,
        quantityVariance: totalQuantityVariance,
        matchNotes: data.matchNotes || (hasDiscrepancy ? "Discrepancy detected during 3-Way Match calculation." : "3-Way Match Passed successfully."),
        items: {
          create: invoiceItemsData,
        },
      },
      include: {
        items: true,
        vendor: true,
        po: true,
        grn: true,
      },
    });
  }

  // Approve invoice for payment & post to General Ledger & Vendor Sub-Ledger
  static async approveSupplierInvoice(invoiceId: string, actorName = "Chief Financial Accountant") {
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        vendor: true,
        items: true,
        po: true,
      },
    });
    if (!invoice) throw new Error("Supplier invoice not found");

    const now = new Date();

    // 1. Post to General Ledger:
    // Debit: 2050 GR/IR Clearing Account (for received PO value cleared)
    // Debit/Credit: 5050 Purchase Price Variance (if price varied from PO)
    // Credit: 2000 Accounts Payable (for total amount vendor is owed)
    let journalEntryId: string | null = null;
    try {
      const grirAccount = await AccountMappingService.resolveAccount({
        transactionType: "vendor_bill_clearing",
      });
      const apAccount = await AccountMappingService.resolveAccount({
        transactionType: "vendor_bill_payable",
      });
      const ppvAccount = await AccountMappingService.resolveAccount({
        transactionType: "vendor_bill_ppv",
      });

      const totalPayable = invoice.totalAmount;
      const priceVariance = invoice.priceVariance; // Positive means invoice > PO (Debit PPV expense)
      const grirDebit = Math.round((totalPayable - priceVariance) * 100) / 100;

      const lines: any[] = [];
      if (grirDebit > 0) {
        lines.push({ accountId: grirAccount.id, debit: grirDebit, credit: 0 });
      }

      if (priceVariance > 0.01) {
        // Price surge: Debit PPV Expense
        lines.push({ accountId: ppvAccount.id, debit: priceVariance, credit: 0 });
      } else if (priceVariance < -0.01) {
        // Price discount: Credit PPV
        lines.push({ accountId: ppvAccount.id, debit: 0, credit: Math.abs(priceVariance) });
      }

      lines.push({ accountId: apAccount.id, debit: 0, credit: totalPayable });

      const journal = await AccountsPostingService.post({
        memo: `3-Way Match Approved: Vendor Bill ${invoice.invoiceNumber} (${invoice.vendor.name}) for PO ${invoice.po?.poNumber || "Direct"}`,
        refType: "vendor_bill",
        refId: invoice.id,
        postedBy: actorName,
        lines,
      });

      journalEntryId = journal.id;
    } catch (err: any) {
      console.error("Failed to post 3-Way Match accounting entry:", err.message);
    }

    // 2. Post to Vendor Sub-Ledger (Accounts Payable Credit)
    const latestVendorLedger = await prisma.vendorLedgerEntry.findFirst({
      where: { vendorId: invoice.vendorId },
      orderBy: { postingDate: "desc" },
    });
    const prevBalance = latestVendorLedger?.runningBalance || 0;
    const newBalance = prevBalance + invoice.totalAmount;

    await prisma.vendorLedgerEntry.create({
      data: {
        vendorId: invoice.vendorId,
        postingDate: now,
        entryType: "bill",
        documentNumber: invoice.referenceNumber,
        journalEntryId,
        debit: 0,
        credit: invoice.totalAmount,
        runningBalance: newBalance,
        dueDate: invoice.dueDate,
        notes: `3-Way Matched Bill ${invoice.invoiceNumber}`,
      },
    });

    // 3. Update Invoice Status
    return await prisma.supplierInvoice.update({
      where: { id: invoiceId },
      data: {
        matchStatus: "approved_for_payment",
        approvedBy: actorName,
        approvedAt: now,
        journalEntryId,
      },
      include: { vendor: true, items: true, payments: true },
    });
  }

  static async processVendorBill(data: any, actorName = "Chief Financial Accountant") {
    const invoice = await this.createSupplierInvoice(data);
    return await this.approveSupplierInvoice(invoice.id, actorName);
  }

  static recordSupplierInvoice = this.createSupplierInvoice;

  // ==========================================
  // 7. VENDOR PAYMENT & DISBURSEMENT
  // ==========================================

  static async recordSupplierPayment(data: RecordPaymentInput, actorName = "Fatima Noor") {
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: data.supplierInvoiceId },
      include: { vendor: true },
    });
    if (!invoice) throw new Error("Supplier invoice not found");

    const count = await prisma.supplierPayment.count();
    const paymentNumber = `SPAY-2026-${String(count + 1).padStart(4, "0")}`;

    const amountPaid = Number(data.amount) || 0;
    const whtAmount = Number(data.whtAmount) || 0;
    const netDisbursed = amountPaid - whtAmount;

    const now = new Date();

    // 1. Post to General Ledger
    // Debit: 2000 Accounts Payable (amountPaid)
    // Credit: 1010 Operating Bank Account (netDisbursed)
    // Credit: 2200 WHT Payable (whtAmount)
    let journalEntryId: string | null = null;
    try {
      const apAccount = await AccountMappingService.resolveAccount({
        transactionType: "vendor_payment_payable",
      });
      let bankAccount = null;
      if (data.bankAccountId) {
        bankAccount = await prisma.account.findFirst({
          where: {
            OR: [
              { code: data.bankAccountId },
              { id: data.bankAccountId },
            ],
            isActive: true,
          },
        });
      }
      if (!bankAccount) {
        bankAccount = await AccountMappingService.resolveAccount({
          transactionType: "vendor_payment_disbursing",
        });
      }
      const whtAccount = await AccountMappingService.resolveAccount({
        transactionType: "vendor_payment_wht",
      });

      const lines: any[] = [
        { accountId: apAccount.id, debit: amountPaid, credit: 0 },
        { accountId: bankAccount.id, debit: 0, credit: netDisbursed },
      ];

      if (whtAmount > 0) {
        lines.push({ accountId: whtAccount.id, debit: 0, credit: whtAmount });
      }

      const journal = await AccountsPostingService.post({
        memo: `Vendor Payment ${paymentNumber} to ${invoice.vendor.name} for Bill ${invoice.invoiceNumber}`,
        refType: "vendor_payment",
        refId: paymentNumber,
        postedBy: actorName,
        lines,
      });

      journalEntryId = journal.id;
    } catch (err: any) {
      console.error("Failed to post vendor payment accounting voucher:", err.message);
    }

    // 2. Post to Vendor Sub-Ledger (Debit entry)
    const latestLedger = await prisma.vendorLedgerEntry.findFirst({
      where: { vendorId: invoice.vendorId },
      orderBy: { postingDate: "desc" },
    });
    const prevBalance = latestLedger?.runningBalance || 0;
    const newBalance = prevBalance - amountPaid;

    await prisma.vendorLedgerEntry.create({
      data: {
        vendorId: invoice.vendorId,
        postingDate: now,
        entryType: "payment",
        documentNumber: paymentNumber,
        journalEntryId,
        debit: amountPaid,
        credit: 0,
        runningBalance: newBalance,
        whtWithheld: whtAmount,
        notes: `Disbursement against Invoice ${invoice.invoiceNumber} (${data.paymentMethod || "bank_transfer"})`,
      },
    });

    // 3. Create Payment Record
    const payment = await prisma.supplierPayment.create({
      data: {
        paymentNumber,
        supplierInvoiceId: invoice.id,
        vendorId: invoice.vendorId,
        paymentDate: now,
        amount: amountPaid,
        paymentMethod: data.paymentMethod || "bank_transfer",
        reference: data.reference || null,
        bankAccountId: data.bankAccountId || "1010",
        whtAmount,
        journalEntryId,
        notes: data.notes || null,
      },
    });

    // 4. Update Invoice Paid Status
    const newPaidAmount = invoice.paidAmount + amountPaid;
    const isFullyPaid = newPaidAmount >= invoice.totalAmount - 0.01;

    await prisma.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        paymentStatus: isFullyPaid ? "paid" : "partially_paid",
      },
    });

    return payment;
  }

  static payVendorBill = this.recordSupplierPayment;

  // ==========================================
  // 8. PROCUREMENT REPORTS & DASHBOARDS
  // ==========================================

  static async getProcurementReports() {
    const today = new Date();

    // 1. Pending Requisitions: draft or submitted, or approved without full PO conversion
    const pendingPrs = await prisma.purchaseRequisition.findMany({
      where: {
        status: { in: ["draft", "submitted", "approved", "partially_converted"] },
      },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Open Purchase Orders: approved, sent_to_vendor, partially_received
    const openPos = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ["approved", "sent_to_vendor", "partially_received"] },
      },
      include: {
        vendor: true,
        items: { include: { product: true } },
        goodsReceipts: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Overdue Deliveries: expectedDeliveryDate < today and not fully_received
    const overdueDeliveries = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ["draft", "approved", "sent_to_vendor", "partially_received"] },
        expectedDeliveryDate: { lt: today },
      },
      include: {
        vendor: true,
        items: { include: { product: true } },
      },
      orderBy: { expectedDeliveryDate: "asc" },
    });

    // 4. GRN Pending Invoice: Goods Receipts without matched/cleared supplier invoices
    const allGrns = await prisma.goodsReceipt.findMany({
      include: {
        po: { include: { vendor: true } },
        items: { include: { product: true } },
        supplierInvoices: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const grnPendingInvoice = allGrns.filter(
      (g) => g.supplierInvoices.length === 0 || g.supplierInvoices.every((inv) => inv.matchStatus === "pending_match")
    );

    // 5. Vendor-wise Spend
    const allVendors = await prisma.vendor.findMany({
      include: {
        purchaseOrders: { select: { totalAmount: true } },
        supplierInvoices: { select: { totalAmount: true, paidAmount: true } },
      },
    });

    let globalSpend = 0;
    const vendorSpendList = allVendors.map((v) => {
      const poTotal = v.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
      const invoicedTotal = v.supplierInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const paidTotal = v.supplierInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
      globalSpend += poTotal;

      return {
        vendorId: v.id,
        vendorCode: v.vendorCode,
        vendorName: v.name,
        category: v.category,
        status: v.status,
        paymentTerms: v.paymentTerms,
        orderCount: v.purchaseOrders.length,
        totalPoAmount: poTotal,
        totalInvoiced: invoicedTotal,
        totalPaid: paidTotal,
        outstanding: invoicedTotal - paidTotal,
      };
    });

    const vendorSpendWithShare = vendorSpendList
      .map((v) => ({
        ...v,
        spendSharePercent: globalSpend > 0 ? Math.round((v.totalPoAmount / globalSpend) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalPoAmount - a.totalPoAmount);

    // 6. Price Variance Analysis: Compare PO unitCost vs Invoiced unitPrice
    const invoiceItemsWithVariance = await prisma.supplierInvoiceItem.findMany({
      where: { variance: { not: 0 } },
      include: {
        invoice: { include: { vendor: true, po: true } },
        product: true,
        poItem: true,
      },
      orderBy: { variance: "desc" },
      take: 50,
    });

    const priceVarianceAnalysis = invoiceItemsWithVariance.map((it) => {
      const poPrice = it.poUnitPrice || 0;
      const billedPrice = it.billedUnitPrice;
      const variancePercent = poPrice > 0 ? Math.round(((billedPrice - poPrice) / poPrice) * 1000) / 10 : 0;

      return {
        id: it.id,
        invoiceNumber: it.invoice.invoiceNumber,
        referenceNumber: it.invoice.referenceNumber,
        vendorName: it.invoice.vendor.name,
        poNumber: it.invoice.po?.poNumber || "N/A",
        itemDescription: it.description,
        billedQuantity: it.billedQuantity,
        poUnitPrice: poPrice,
        billedUnitPrice: billedPrice,
        varianceAmount: it.variance,
        variancePercent,
      };
    });

    // 7. Purchase Cycle Time Analysis
    const completedCyclePos = await prisma.purchaseOrder.findMany({
      where: {
        prId: { not: null },
        goodsReceipts: { some: {} },
        supplierInvoices: { some: { matchStatus: "approved_for_payment" } },
      },
      include: {
        pr: true,
        goodsReceipts: { orderBy: { createdAt: "asc" }, take: 1 },
        supplierInvoices: { where: { matchStatus: "approved_for_payment" }, take: 1 },
      },
      take: 20,
    });

    const cycleTimeRecords = completedCyclePos.map((po) => {
      const prCreated = po.pr?.createdAt ? new Date(po.pr.createdAt).getTime() : 0;
      const prApproved = po.pr?.approvedAt ? new Date(po.pr.approvedAt).getTime() : prCreated;
      const poIssued = new Date(po.createdAt).getTime();
      const grnReceived = po.goodsReceipts[0]?.createdAt ? new Date(po.goodsReceipts[0].createdAt).getTime() : poIssued;
      const invoiceApproved = po.supplierInvoices[0]?.approvedAt ? new Date(po.supplierInvoices[0].approvedAt).getTime() : grnReceived;

      const prApprovalHours = prApproved > prCreated ? Math.round((prApproved - prCreated) / (1000 * 3600)) : 2;
      const poIssuanceHours = poIssued > prApproved ? Math.round((poIssued - prApproved) / (1000 * 3600)) : 4;
      const deliveryDays = grnReceived > poIssued ? Math.round((grnReceived - poIssued) / (1000 * 3600 * 24)) : 3;
      const matchingHours = invoiceApproved > grnReceived ? Math.round((invoiceApproved - grnReceived) / (1000 * 3600)) : 6;
      const totalCycleDays = Math.round((invoiceApproved - prCreated) / (1000 * 3600 * 24)) || 4;

      return {
        poNumber: po.poNumber,
        prNumber: po.pr?.prNumber || "N/A",
        vendorName: po.supplierName,
        prApprovalHours,
        poIssuanceHours,
        deliveryDays,
        matchingHours,
        totalCycleDays,
      };
    });

    // KPI Summary
    const totalPos = await prisma.purchaseOrder.count();
    const activeVendorsCount = allVendors.filter((v) => v.status === "Active").length;
    const totalInvoices = await prisma.supplierInvoice.count();
    const matchedInvoices = await prisma.supplierInvoice.count({
      where: { matchStatus: { in: ["matched", "approved_for_payment", "paid"] } },
    });
    const matchAccuracyRate = totalInvoices > 0 ? Math.round((matchedInvoices / totalInvoices) * 100) : 100;

    return {
      kpi: {
        totalSpend: globalSpend,
        activeVendorsCount,
        openPosCount: openPos.length,
        pendingPrsCount: pendingPrs.length,
        overdueDeliveriesCount: overdueDeliveries.length,
        grnPendingInvoiceCount: grnPendingInvoice.length,
        matchAccuracyRate,
        totalPos,
      },
      reports: {
        pendingRequisitions: pendingPrs,
        openPurchaseOrders: openPos,
        overdueDeliveries,
        grnPendingInvoice,
        vendorWiseSpend: vendorSpendWithShare,
        priceVarianceAnalysis,
        purchaseCycleTime: cycleTimeRecords,
      },
    };
  }
}
