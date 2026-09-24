export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ProcurementService } from "@/lib/services/ProcurementService";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "all";

    if (view === "vendors") {
      const vendors = await ProcurementService.getVendors({
        status: searchParams.get("status") || undefined,
        category: searchParams.get("category") || undefined,
        search: searchParams.get("search") || undefined,
      });
      return NextResponse.json(vendors);
    }

    if (view === "prs") {
      const prs = await ProcurementService.getPurchaseRequisitions({
        status: searchParams.get("status") || undefined,
        priority: searchParams.get("priority") || undefined,
      });
      return NextResponse.json(prs);
    }

    if (view === "rfqs") {
      const rfqs = await ProcurementService.getRfqs();
      return NextResponse.json(rfqs);
    }

    if (view === "pos") {
      const pos = await ProcurementService.getPurchaseOrders({
        status: searchParams.get("status") || undefined,
        poType: searchParams.get("poType") || undefined,
      });
      return NextResponse.json(pos);
    }

    if (view === "grns") {
      const grns = await ProcurementService.getGoodsReceipts();
      return NextResponse.json(grns);
    }

    if (view === "invoices") {
      const invoices = await ProcurementService.getSupplierInvoices();
      return NextResponse.json(invoices);
    }

    if (view === "reports") {
      const reports = await ProcurementService.getProcurementReports();
      return NextResponse.json(reports);
    }

    // Default "all" view: fetch all module datasets for fast unified dashboard initialization
    const [vendors, prs, rfqs, pos, grns, invoices, reportsData, products, employees, jobs] = await Promise.all([
      ProcurementService.getVendors(),
      ProcurementService.getPurchaseRequisitions(),
      ProcurementService.getRfqs(),
      ProcurementService.getPurchaseOrders(),
      ProcurementService.getGoodsReceipts(),
      ProcurementService.getSupplierInvoices(),
      ProcurementService.getProcurementReports(),
      prisma.product.findMany({ select: { id: true, name: true, sku: true, costPrice: true, unit: true, stockQuantity: true } }),
      prisma.employee.findMany({
        where: { status: "Active" },
        select: { id: true, name: true, role: true, department: true },
        orderBy: { name: "asc" },
      }),
      prisma.job.findMany({
        where: { status: { notIn: ["Verified", "Cancelled"] } },
        select: {
          id: true,
          jobNumber: true,
          jobType: true,
          customer: { select: { name: true, addressText: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return NextResponse.json({
      vendors,
      prs,
      rfqs,
      pos,
      grns,
      invoices,
      products,
      employees,
      jobs,
      kpi: reportsData.kpi,
      reports: reportsData.reports,
    });
  } catch (err: any) {
    console.error("Procurement API GET Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load procurement data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      // 1. Vendor Actions
      case "create_vendor": {
        const vendor = await ProcurementService.createVendor(payload);
        return NextResponse.json(vendor, { status: 201 });
      }

      case "update_vendor": {
        const vendor = await ProcurementService.updateVendor(payload.id, payload.data);
        return NextResponse.json(vendor);
      }

      // 2. PR Actions
      case "create_pr": {
        const pr = await ProcurementService.createPurchaseRequisition(payload);
        return NextResponse.json(pr, { status: 201 });
      }

      case "submit_pr": {
        const pr = await ProcurementService.updateRequisitionStatus(payload.id, "submitted", payload.actorName || "Requester");
        return NextResponse.json(pr);
      }

      case "approve_pr": {
        const pr = await ProcurementService.updateRequisitionStatus(payload.id, "approved", payload.actorName || "Procurement Approver");
        return NextResponse.json(pr);
      }

      case "reject_pr": {
        const pr = await ProcurementService.updateRequisitionStatus(
          payload.id,
          "rejected",
          payload.actorName || "Procurement Approver",
          payload.reason
        );
        return NextResponse.json(pr);
      }

      case "convert_pr_to_po": {
        const po = await ProcurementService.convertPrsToPo({
          prIds: payload.prIds,
          vendorId: payload.vendorId,
          poType: payload.poType,
          expectedDeliveryDate: payload.expectedDeliveryDate,
          items: payload.items,
        });
        return NextResponse.json(po, { status: 201 });
      }

      // 3. RFQ Actions
      case "create_rfq": {
        const rfq = await ProcurementService.createRfq(payload);
        return NextResponse.json(rfq, { status: 201 });
      }

      case "submit_vendor_quote": {
        const quote = await ProcurementService.submitVendorQuote(payload);
        return NextResponse.json(quote);
      }

      case "award_rfq": {
        const result = await ProcurementService.awardRfqAndGeneratePo(
          payload.rfqId,
          payload.winnerVendorId,
          payload.actorName || "Procurement Manager"
        );
        return NextResponse.json(result);
      }

      // 4. PO Actions
      case "create_po": {
        const po = await ProcurementService.createPurchaseOrder(payload);
        return NextResponse.json(po, { status: 201 });
      }

      case "approve_po": {
        const po = await ProcurementService.approvePurchaseOrder(payload.id, payload.actorName || "Haris Qureshi");
        return NextResponse.json(po);
      }

      case "send_po": {
        const po = await ProcurementService.sendPoToVendor(payload.id);
        return NextResponse.json(po);
      }

      // 5. GRN Actions
      case "create_grn": {
        const grn = await ProcurementService.createGoodsReceipt(payload);
        return NextResponse.json(grn, { status: 201 });
      }

      // 6. Supplier Invoice & 3-Way Matching Actions
      case "create_supplier_invoice": {
        const invoice = await ProcurementService.createSupplierInvoice(payload);
        return NextResponse.json(invoice, { status: 201 });
      }

      case "approve_supplier_invoice": {
        const invoice = await ProcurementService.approveSupplierInvoice(payload.invoiceId, payload.actorName || "Fatima Noor");
        return NextResponse.json(invoice);
      }

      // 7. Payment Actions
      case "record_payment": {
        const payment = await ProcurementService.recordSupplierPayment(payload, payload.actorName || "Fatima Noor");
        return NextResponse.json(payment, { status: 201 });
      }

      default:
        return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Procurement API POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute procurement action" }, { status: 500 });
  }
}
