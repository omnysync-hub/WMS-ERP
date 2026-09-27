export const dynamic = "force-dynamic";

/**
 * Procurement API — server-side RBAC
 *
 * Auth approach (ERP still uses client-role demo personas):
 * - Actor resolved from request headers x-actor-role / x-user-role,
 *   x-actor-name, x-user-id (same header names as mobileAuth gateway fallback).
 * - Permissions checked against DEFAULT_ROLE_PERMISSIONS via requireProcurementPermission.
 * - UI must send headers; never trust UI alone.
 */
import { NextRequest, NextResponse } from "next/server";
import { ProcurementService } from "@/lib/services/ProcurementService";
import { prisma } from "@/lib/prisma";
import {
  requireProcurementPermission,
  requireAnyProcurementPermission,
  roleHasPermission,
} from "@/lib/auth/erpActor";

const VIEW_PERMISSION: Record<string, string | string[]> = {
  vendors: ["procurement.vendor.manage", "procurement.po.create", "procurement.rfq.manage", "procurement.invoice.create", "procurement.reports.view"],
  prs: ["procurement.view_pr", "procurement.pr.create", "procurement.pr.submit", "procurement.pr.approve", "procurement.rfq.manage", "procurement.po.create"],
  rfqs: ["procurement.rfq.manage", "procurement.rfq.award", "procurement.costs.view"],
  pos: ["procurement.po.create", "procurement.po.approve", "procurement.po.send", "procurement.costs.view", "procurement.view_pr"],
  grns: ["procurement.grn.create", "procurement.grn.quality", "procurement.invoice.create", "procurement.invoice.match"],
  invoices: ["procurement.invoice.create", "procurement.invoice.match", "procurement.invoice.approve", "procurement.payment.record"],
  reports: ["procurement.reports.view", "procurement.costs.view"],
  counts: ["procurement.view_pr", "procurement.pr.create", "procurement.rfq.manage", "procurement.po.create", "procurement.grn.create", "procurement.invoice.create", "procurement.payment.record", "procurement.reports.view", "procurement.costs.view", "procurement.vendor.manage", "procurement.pr.approve"],
  all: ["procurement.view_pr", "procurement.pr.create", "procurement.rfq.manage", "procurement.po.create", "procurement.grn.create", "procurement.invoice.create", "procurement.payment.record", "procurement.reports.view", "procurement.costs.view", "procurement.vendor.manage"],
};

const ACTION_PERMISSION: Record<string, string> = {
  create_vendor: "procurement.vendor.manage",
  update_vendor: "procurement.vendor.manage",
  create_pr: "procurement.pr.create",
  submit_pr: "procurement.pr.submit",
  submitted_pr: "procurement.pr.submit",
  approve_pr: "procurement.pr.approve",
  approved_pr: "procurement.pr.approve",
  reject_pr: "procurement.pr.approve",
  rejected_pr: "procurement.pr.approve",
  convert_pr_to_po: "procurement.po.create",
  create_rfq: "procurement.rfq.manage",
  submit_vendor_quote: "procurement.rfq.manage",
  award_rfq: "procurement.rfq.award",
  create_po: "procurement.po.create",
  approve_po: "procurement.po.approve",
  send_po: "procurement.po.send",
  create_grn: "procurement.grn.create",
  create_supplier_invoice: "procurement.invoice.create",
  approve_supplier_invoice: "procurement.invoice.approve",
  record_payment: "procurement.payment.record",
};

function gateView(req: NextRequest, view: string) {
  const keys = VIEW_PERMISSION[view] || VIEW_PERMISSION.all;
  const list = Array.isArray(keys) ? keys : [keys];
  return requireAnyProcurementPermission(req, list);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "all";

    const gated = gateView(req, view);
    if (gated.error) return gated.error;

    const actor = gated.actor;
    const canViewCosts = roleHasPermission(actor.role, "procurement.costs.view");

    if (view === "counts") {
      const [pendingPrs, activeVendors, openPos, openRfqs, pendingGrns, submittedPrs, draftPos, pendingInvoices] = await Promise.all([
        prisma.purchaseRequisition.count({ where: { status: "submitted" } }),
        prisma.vendor.count({ where: { status: "Active" } }),
        prisma.purchaseOrder.count({ where: { status: { in: ["approved", "sent_to_vendor", "partially_received", "sent"] } } }),
        prisma.requestForQuotation.count({ where: { status: { notIn: ["awarded", "cancelled", "closed"] } } }),
        prisma.goodsReceipt.count(),
        prisma.purchaseRequisition.count({ where: { status: "submitted" } }),
        prisma.purchaseOrder.count({ where: { status: "draft" } }),
        prisma.supplierInvoice.count({ where: { matchStatus: { in: ["pending_match", "matched", "discrepancy"] } } }),
      ]);
      return NextResponse.json({
        approvals: submittedPrs + draftPos + pendingInvoices,
        prs: pendingPrs,
        rfqs: openRfqs,
        pos: openPos,
        grns: pendingGrns,
        vendors: activeVendors,
      });
    }

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
      return NextResponse.json(canViewCosts ? rfqs : maskRfqCosts(rfqs));
    }

    if (view === "pos") {
      const pos = await ProcurementService.getPurchaseOrders({
        status: searchParams.get("status") || undefined,
        poType: searchParams.get("poType") || undefined,
      });
      return NextResponse.json(canViewCosts ? pos : maskPoCosts(pos));
    }

    if (view === "grns") {
      const grns = await ProcurementService.getGoodsReceipts();
      return NextResponse.json(grns);
    }

    if (view === "invoices") {
      const invoices = await ProcurementService.getSupplierInvoices();
      return NextResponse.json(canViewCosts ? invoices : maskInvoiceCosts(invoices));
    }

    if (view === "reports") {
      const reports = await ProcurementService.getProcurementReports();
      if (!canViewCosts) {
        return NextResponse.json({
          ...reports,
          kpi: { ...reports.kpi, totalSpend: null, masked: true },
          reports: { ...reports.reports, vendorWiseSpend: [], priceVarianceAnalysis: [] },
        });
      }
      return NextResponse.json(reports);
    }

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

    const safeProducts = canViewCosts
      ? products
      : products.map((p) => ({ ...p, costPrice: null }));

    return NextResponse.json({
      vendors,
      prs,
      rfqs: canViewCosts ? rfqs : maskRfqCosts(rfqs),
      pos: canViewCosts ? pos : maskPoCosts(pos),
      grns,
      invoices: canViewCosts ? invoices : maskInvoiceCosts(invoices),
      products: safeProducts,
      employees,
      jobs,
      kpi: canViewCosts
        ? reportsData.kpi
        : { ...reportsData.kpi, totalSpend: null, masked: true },
      reports: canViewCosts
        ? reportsData.reports
        : { ...reportsData.reports, vendorWiseSpend: [], priceVarianceAnalysis: [] },
      actor: { role: actor.role, name: actor.name },
    });
  } catch (err: any) {
    console.error("Procurement API GET Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load procurement data" }, { status: 500 });
  }
}

function maskPoCosts(pos: any[]) {
  return pos.map((po) => ({
    ...po,
    totalAmount: null,
    whtAmount: null,
    netPayable: null,
    items: (po.items || []).map((it: any) => ({ ...it, unitCost: null, lineTotal: null })),
  }));
}

function maskRfqCosts(rfqs: any[]) {
  return rfqs.map((rfq) => ({
    ...rfq,
    vendors: (rfq.vendors || []).map((v: any) => ({
      ...v,
      quotationItems: (v.quotationItems || []).map((qi: any) => ({
        ...qi,
        unitPrice: null,
        lineTotal: null,
      })),
    })),
  }));
}

function maskInvoiceCosts(invoices: any[]) {
  return invoices.map((inv) => ({
    ...inv,
    subtotal: null,
    taxAmount: null,
    totalAmount: null,
    priceVariance: null,
    paidAmount: null,
    items: (inv.items || []).map((it: any) => ({ ...it, unitPrice: null, lineTotal: null })),
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    const permKey = ACTION_PERMISSION[action];
    if (!permKey) {
      return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
    }

    const gated = requireProcurementPermission(req, permKey);
    if (gated.error) return gated.error;
    const actor = gated.actor;
    const actorName = payload.actorName || actor.name;

    // Extra hard gate: discrepancy invoice approve requires invoice.approve (already gated),
    // but double-check when client signals discrepancy or invoice is discrepancy.
    if (action === "approve_supplier_invoice") {
      if (payload.invoiceId) {
        const inv = await prisma.supplierInvoice.findUnique({
          where: { id: payload.invoiceId },
          select: { matchStatus: true },
        });
        if (inv?.matchStatus === "discrepancy" && !roleHasPermission(actor.role, "procurement.invoice.approve")) {
          return NextResponse.json(
            { error: "Forbidden: discrepancy invoices require procurement.invoice.approve" },
            { status: 403 }
          );
        }
      }
    }

    switch (action) {
      case "create_vendor": {
        const vendor = await ProcurementService.createVendor(payload);
        return NextResponse.json(vendor, { status: 201 });
      }

      case "update_vendor": {
        const vendor = await ProcurementService.updateVendor(payload.id, payload.data);
        return NextResponse.json(vendor);
      }

      case "create_pr": {
        const pr = await ProcurementService.createPurchaseRequisition(payload);
        return NextResponse.json(pr, { status: 201 });
      }

      case "submit_pr":
      case "submitted_pr": {
        const pr = await ProcurementService.updateRequisitionStatus(payload.id, "submitted", actorName);
        return NextResponse.json(pr);
      }

      case "approve_pr":
      case "approved_pr": {
        const pr = await ProcurementService.updateRequisitionStatus(payload.id, "approved", actorName);
        return NextResponse.json(pr);
      }

      case "reject_pr":
      case "rejected_pr": {
        const pr = await ProcurementService.updateRequisitionStatus(
          payload.id,
          "rejected",
          actorName,
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
          actorName
        );
        return NextResponse.json(result);
      }

      case "create_po": {
        const po = await ProcurementService.createPurchaseOrder(payload);
        return NextResponse.json(po, { status: 201 });
      }

      case "approve_po": {
        const po = await ProcurementService.approvePurchaseOrder(payload.id, actorName);
        return NextResponse.json(po);
      }

      case "send_po": {
        const po = await ProcurementService.sendPoToVendor(payload.id);
        return NextResponse.json(po);
      }

      case "create_grn": {
        const grn = await ProcurementService.createGoodsReceipt({
          ...payload,
          receivedBy: payload.receivedBy || actorName,
        });
        return NextResponse.json(grn, { status: 201 });
      }

      case "create_supplier_invoice": {
        const invoice = await ProcurementService.createSupplierInvoice(payload);
        return NextResponse.json(invoice, { status: 201 });
      }

      case "approve_supplier_invoice": {
        const invoice = await ProcurementService.approveSupplierInvoice(payload.invoiceId, actorName);
        return NextResponse.json(invoice);
      }

      case "record_payment": {
        const payment = await ProcurementService.recordSupplierPayment(payload, actorName);
        return NextResponse.json(payment, { status: 201 });
      }

      default:
        return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Procurement API POST Error:", err);
    const status = /forbidden|not allowed|require|must be|over-receive|over receive|approved_for_payment/i.test(
      err.message || ""
    )
      ? 400
      : 500;
    return NextResponse.json({ error: err.message || "Failed to execute procurement action" }, { status });
  }
}
