"use client";

import React, { useState } from "react";
import {
  BarChart3,
  FileText,
  ShoppingCart,
  AlertTriangle,
  PackageCheck,
  Building2,
  Scale,
  Clock,
  Printer,
  Calendar,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";

interface ProcurementReportsTabProps {
  reportsData: {
    pendingRequisitions: any[];
    openPurchaseOrders: any[];
    overdueDeliveries: any[];
    grnPendingInvoice: any[];
    vendorWiseSpend: any[];
    priceVarianceAnalysis: any[];
    purchaseCycleTime: any[];
  };
  onRefresh: () => void;
}

export default function ProcurementReportsTab({
  reportsData,
  onRefresh,
}: ProcurementReportsTabProps) {
  const [activeReport, setActiveReport] = useState<
    | "pending_prs"
    | "open_pos"
    | "overdue_deliveries"
    | "grn_pending_invoice"
    | "vendor_spend"
    | "price_variance"
    | "cycle_time"
  >("pending_prs");

  const reportTabs = [
    { id: "pending_prs", label: "a. Pending Requisitions", count: reportsData.pendingRequisitions.length, icon: FileText },
    { id: "open_pos", label: "b. Open Purchase Orders", count: reportsData.openPurchaseOrders.length, icon: ShoppingCart },
    { id: "overdue_deliveries", label: "c. Overdue Deliveries", count: reportsData.overdueDeliveries.length, icon: AlertTriangle, isAlert: reportsData.overdueDeliveries.length > 0 },
    { id: "grn_pending_invoice", label: "d. GRN Pending Invoice", count: reportsData.grnPendingInvoice.length, icon: PackageCheck },
    { id: "vendor_spend", label: "e. Vendor-wise Spend", count: reportsData.vendorWiseSpend.length, icon: Building2 },
    { id: "price_variance", label: "f. Price Variance Analysis", count: reportsData.priceVarianceAnalysis.length, icon: Scale },
    { id: "cycle_time", label: "g. Purchase Cycle Time", count: reportsData.purchaseCycleTime.length, icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Report Selector Header */}
      <div className="bg-white border border-[#EDEDED] rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {reportTabs.map((tab) => {
            const isActive = activeReport === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition",
                  isActive
                    ? "bg-[#0D7A5F] text-white shadow-2xs"
                    : "bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#F8FAFC] border border-[#EDEDED]"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : tab.isAlert
                      ? "bg-rose-50 text-rose-700"
                      : "bg-zinc-100 text-[#71717A]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D4D4D8] hover:bg-zinc-100 text-xs font-semibold text-[#18181B] transition shrink-0"
        >
          <Printer className="w-3.5 h-3.5" /> Print Report
        </button>
      </div>

      {/* Report 1: Pending Requisitions */}
      {activeReport === "pending_prs" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0D7A5F]" />
                Report A: Pending Purchase Requisitions
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Requisitions awaiting approval or conversion to binding Purchase Orders
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {reportsData.pendingRequisitions.length} Pending PR(s)
            </span>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">PR Number</th>
                  <th className="py-2.5 px-3">Date Raised</th>
                  <th className="py-2.5 px-3">Department & Site</th>
                  <th className="py-2.5 px-3">Requester</th>
                  <th className="py-2.5 px-3 text-center">Priority</th>
                  <th className="py-2.5 px-3">Date Required</th>
                  <th className="py-2.5 px-3 text-right">Est. Value</th>
                  <th className="py-2.5 px-3.5 text-center">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.pendingRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-[#71717A]">
                      No pending purchase requisitions.
                    </td>
                  </tr>
                ) : (
                  reportsData.pendingRequisitions.map((pr) => {
                    const est = (pr.items || []).reduce(
                      (s: number, i: any) => s + (i.quantity || 0) * (i.estimatedPrice || 0),
                      0
                    );

                    return (
                      <tr key={pr.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-[#18181B]">
                          {pr.prNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A]">
                          {new Date(pr.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#18181B]">
                          {pr.department} ({pr.site || "Central"})
                        </td>
                        <td className="py-2.5 px-3 text-[#18181B]">{pr.requestedBy}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded font-bold border uppercase",
                              pr.priority === "Urgent"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200"
                            )}
                          >
                            {pr.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#71717A]">
                          {pr.dateRequired ? new Date(pr.dateRequired).toLocaleDateString() : "Flexible"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(est)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                            {pr.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 2: Open Purchase Orders */}
      {activeReport === "open_pos" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#0D7A5F]" />
                Report B: Open Purchase Orders
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Active orders issued to vendors pending complete physical goods receipt
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {reportsData.openPurchaseOrders.length} Open Order(s)
            </span>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">PO Number</th>
                  <th className="py-2.5 px-3">Vendor / Supplier</th>
                  <th className="py-2.5 px-3">Date Issued</th>
                  <th className="py-2.5 px-3">Expected Date</th>
                  <th className="py-2.5 px-3">Progress</th>
                  <th className="py-2.5 px-3 text-right">Order Value</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.openPurchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#71717A]">
                      No open purchase orders pending delivery.
                    </td>
                  </tr>
                ) : (
                  reportsData.openPurchaseOrders.map((po) => {
                    const totalOrd = (po.items || []).reduce((s: number, i: any) => s + i.quantity, 0);
                    const totalRec = (po.items || []).reduce((s: number, i: any) => s + (i.quantityReceived || 0), 0);
                    const pct = totalOrd > 0 ? Math.round((totalRec / totalOrd) * 100) : 0;

                    return (
                      <tr key={po.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-[#18181B]">
                          {po.poNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#18181B]">
                          {po.supplierName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#71717A]">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#18181B]">
                          {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "Flexible"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A]">
                          {totalRec} / {totalOrd} units ({pct}%)
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(po.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                            {po.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Overdue Deliveries */}
      {activeReport === "overdue_deliveries" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Report C: Overdue Deliveries
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Suppliers whose promised delivery dates have elapsed without complete physical fulfillment
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-600">
              {reportsData.overdueDeliveries.length} Overdue Order(s)
            </span>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">PO Number</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Contact Details</th>
                  <th className="py-2.5 px-3 font-mono">Promised Delivery</th>
                  <th className="py-2.5 px-3 font-mono text-center">Days Overdue</th>
                  <th className="py-2.5 px-3 text-right">Order Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.overdueDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-emerald-700 font-semibold">
                      ✓ No overdue deliveries! All active purchase orders are on schedule.
                    </td>
                  </tr>
                ) : (
                  reportsData.overdueDeliveries.map((po) => {
                    const daysOver = Math.max(
                      1,
                      Math.round(
                        (new Date().getTime() - new Date(po.expectedDeliveryDate).getTime()) /
                          (1000 * 3600 * 24)
                      )
                    );

                    return (
                      <tr key={po.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-rose-600">
                          {po.poNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#18181B]">
                          {po.supplierName}
                        </td>
                        <td className="py-2.5 px-3 text-[#71717A]">
                          {po.vendor?.phone || po.supplierEmail}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-rose-700">
                          {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200">
                            +{daysOver} Days Overdue
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#18181B]">
                          {formatCurrency(po.totalAmount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 4: GRN Pending Invoice */}
      {activeReport === "grn_pending_invoice" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-[#0D7A5F]" />
                Report D: GRN Pending Invoice (Unbilled Receipts)
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Physical stock received in warehouse sitting in GR/IR clearing account awaiting vendor bill matching
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600">
              {reportsData.grnPendingInvoice.length} Unbilled GRN(s)
            </span>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">GRN Number</th>
                  <th className="py-2.5 px-3">Receipt Date</th>
                  <th className="py-2.5 px-3">Originating PO</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Warehouse Location</th>
                  <th className="py-2.5 px-3 text-center">QA Status</th>
                  <th className="py-2.5 px-3.5">Unbilled Clearing Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.grnPendingInvoice.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#71717A]">
                      Zero unbilled receipts! All goods received have been verified against vendor bills.
                    </td>
                  </tr>
                ) : (
                  reportsData.grnPendingInvoice.map((grn) => (
                    <tr key={grn.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-[#18181B]">
                        {grn.grnNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#71717A]">
                        {new Date(grn.receivedDate || grn.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#0D7A5F] font-semibold">
                        {grn.po?.poNumber || "PO-Direct"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#18181B]">
                        {grn.po?.supplierName}
                      </td>
                      <td className="py-2.5 px-3 text-[#71717A]">
                        {grn.warehouseLocation}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {grn.qualityStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[10px] text-amber-700">
                        Credit held in Account 2050 (GR/IR)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 5: Vendor-wise Spend */}
      {activeReport === "vendor_spend" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0D7A5F]" />
                Report E: Vendor-wise Spend Breakdown
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Aggregate procurement disbursements, order frequency, and percentage share across supplier base
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">Vendor Name & Code</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Orders Count</th>
                  <th className="py-2.5 px-3 text-right">Total Invoiced</th>
                  <th className="py-2.5 px-3 text-right">Total Paid</th>
                  <th className="py-2.5 px-3 text-right">Outstanding</th>
                  <th className="py-2.5 px-3.5 text-right">Spend Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.vendorWiseSpend.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3.5">
                      <div className="font-bold text-[#18181B]">{v.vendorName}</div>
                      <div className="text-[10px] font-mono text-[#A1A1AA]">{v.vendorCode}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#71717A]">{v.category}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#18181B]">
                      {v.orderCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#18181B]">
                      {formatCurrency(v.totalInvoiced)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                      {formatCurrency(v.totalPaid)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600">
                      {formatCurrency(v.outstanding)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-2 font-mono">
                        <span className="font-bold text-[#18181B]">{v.spendSharePercent}%</span>
                        <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0D7A5F] rounded-full"
                            style={{ width: `${Math.min(100, v.spendSharePercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 6: Price Variance Analysis */}
      {activeReport === "price_variance" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#0D7A5F]" />
                Report F: Price Variance Analysis (PPV)
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Audit of differences between Purchase Order agreed price and actual invoiced rates
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">Invoice #</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">PO Reference</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-right">PO Rate</th>
                  <th className="py-2.5 px-3 text-right">Billed Rate</th>
                  <th className="py-2.5 px-3.5 text-right">Variance (PKR & %)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.priceVarianceAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-emerald-700 font-semibold">
                      ✓ Perfect price conformity! Zero purchase price variances detected.
                    </td>
                  </tr>
                ) : (
                  reportsData.priceVarianceAnalysis.map((pv) => (
                    <tr key={pv.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-[#18181B]">
                        {pv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#18181B]">{pv.vendorName}</td>
                      <td className="py-2.5 px-3 font-mono text-[#71717A]">{pv.poNumber}</td>
                      <td className="py-2.5 px-3 text-[#18181B]">{pv.itemDescription}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#71717A]">
                        {formatCurrency(pv.poUnitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#18181B]">
                        {formatCurrency(pv.billedUnitPrice)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-600">
                        +{formatCurrency(pv.varianceAmount)} ({pv.variancePercent}%)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 7: Purchase Cycle Time */}
      {activeReport === "cycle_time" && (
        <div className="bg-white border border-[#EDEDED] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex justify-between items-center border-b border-[#EDEDED] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0D7A5F]" />
                Report G: Purchase Cycle Time & Lead-Time Turnaround
              </h3>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Milestone turnaround durations: Requisition $\rightarrow$ Approval $\rightarrow$ PO Issuance $\rightarrow$ GRN $\rightarrow$ 3-Way Match
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#EDEDED] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#71717A] font-mono text-[10px] uppercase border-b border-[#EDEDED]">
                  <th className="py-2.5 px-3.5">PO & PR #</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-center">PR Approval</th>
                  <th className="py-2.5 px-3 text-center">PO Issuance</th>
                  <th className="py-2.5 px-3 text-center">Delivery Lead Time</th>
                  <th className="py-2.5 px-3 text-center">3-Way Match Clearance</th>
                  <th className="py-2.5 px-3.5 text-right">Total Turnaround</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-[#18181B]">
                {reportsData.purchaseCycleTime.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#71717A]">
                      No completed procurement cycles recorded yet.
                    </td>
                  </tr>
                ) : (
                  reportsData.purchaseCycleTime.map((c, idx) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3.5 font-mono">
                        <strong className="text-[#18181B] block">{c.poNumber}</strong>
                        <span className="text-[10px] text-[#A1A1AA]">{c.prNumber}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#18181B]">{c.vendorName}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-[#71717A]">
                        {c.prApprovalHours} hrs
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[#71717A]">
                        {c.poIssuanceHours} hrs
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[#71717A]">
                        {c.deliveryDays} days
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[#71717A]">
                        {c.matchingHours} hrs
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">
                        {c.totalCycleDays} Days Total
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
