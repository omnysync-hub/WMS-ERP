"use client";

import React, { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ProcurementProcessPipeline, {
  ProcurementStage,
} from "@/components/procurement/ProcurementProcessPipeline";
import VendorsTab from "@/components/procurement/VendorsTab";
import RequisitionsTab from "@/components/procurement/RequisitionsTab";
import RfqSourcingTab from "@/components/procurement/RfqSourcingTab";
import PurchaseOrdersTab from "@/components/procurement/PurchaseOrdersTab";
import GoodsReceiptTab from "@/components/procurement/GoodsReceiptTab";
import ThreeWayMatchTab from "@/components/procurement/ThreeWayMatchTab";
import PaymentsTab from "@/components/procurement/PaymentsTab";
import ProcurementReportsTab from "@/components/procurement/ProcurementReportsTab";
import ProcurementApprovalsTab from "@/components/procurement/ProcurementApprovalsTab";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { realtimeSync } from "@/lib/realtimeSync";
import {
  ShoppingCart,
  Building2,
  FileText,
  Scale,
  PackageCheck,
  ShieldAlert,
  CreditCard,
  BarChart3,
  RefreshCw,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
} from "lucide-react";

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<ProcurementStage>("prs");
  const [loading, setLoading] = useState(true);

  // Data states
  const [vendors, setVendors] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  // KPI & Reports
  const [kpi, setKpi] = useState({
    totalSpend: 0,
    activeVendorsCount: 0,
    openPosCount: 0,
    pendingPrsCount: 0,
    overdueDeliveriesCount: 0,
    grnPendingInvoiceCount: 0,
    matchAccuracyRate: 100,
    totalPos: 0,
  });

  const [reportsData, setReportsData] = useState<{
    pendingRequisitions: any[];
    openPurchaseOrders: any[];
    overdueDeliveries: any[];
    grnPendingInvoice: any[];
    vendorWiseSpend: any[];
    priceVarianceAnalysis: any[];
    purchaseCycleTime: any[];
  }>({
    pendingRequisitions: [],
    openPurchaseOrders: [],
    overdueDeliveries: [],
    grnPendingInvoice: [],
    vendorWiseSpend: [],
    priceVarianceAnalysis: [],
    purchaseCycleTime: [],
  });

  // Cross-tab workflows
  const [initialPrForRfq, setInitialPrForRfq] = useState<any | null>(null);
  const [presetPoForGrn, setPresetPoForGrn] = useState<any | null>(null);
  const [presetInvoiceForPay, setPresetInvoiceForPay] = useState<any | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      const res = await fetch("/api/procurement?view=all");
      if (!res.ok) throw new Error("Failed to fetch procurement data");
      const data = await res.json();

      setVendors(data.vendors || []);
      setPrs(data.prs || []);
      setRfqs(data.rfqs || []);
      setPos(data.pos || []);
      setGrns(data.grns || []);
      setInvoices(data.invoices || []);
      setProducts(data.products || []);
      setEmployees(data.employees || []);
      setJobs(data.jobs || []);
      if (data.kpi) setKpi(data.kpi);
      if (data.reports) setReportsData(data.reports);
    } catch (err) {
      console.error("Failed to load procurement data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    const unsubscribe = realtimeSync.subscribe(() => {
      loadAllData();
    });
    return () => unsubscribe();
  }, [loadAllData]);

  // Cross-tab transitions
  const handleNavigateToRfq = (pr: any) => {
    setInitialPrForRfq(pr);
    setActiveTab("rfqs");
  };

  const handleOpenGrnModal = (po: any) => {
    setPresetPoForGrn(po);
    setActiveTab("grns");
  };

  const handleNavigateToPayment = (inv: any) => {
    setPresetInvoiceForPay(inv);
    setActiveTab("payments");
  };

  const handleSelectVendorForPo = (vendor: any) => {
    setActiveTab("pos");
  };

  const pendingApprovalsCount =
    prs.filter((p) => p.status === "submitted").length +
    pos.filter((p) => p.status === "draft").length +
    invoices.filter((i) =>
      ["matched", "discrepancy", "pending_match"].includes(i.matchStatus)
    ).length;

  const subTabButtons: { id: ProcurementStage; label: string; icon: any; count?: number }[] = [
    { id: "approvals", label: "Approvals Hub", icon: ShieldAlert, count: pendingApprovalsCount },
    { id: "prs", label: "Requisitions (PR)", icon: FileText, count: kpi.pendingPrsCount },
    { id: "rfqs", label: "RFQ & Sourcing Matrix", icon: Scale, count: rfqs.length },
    { id: "pos", label: "Purchase Orders (PO)", icon: ShoppingCart, count: kpi.openPosCount },
    { id: "grns", label: "Goods Receipt (GRN)", icon: PackageCheck, count: grns.length },
    { id: "invoices", label: "Invoice 3-Way Match", icon: ShieldAlert, count: invoices.length },
    { id: "payments", label: "Settlements & Payments", icon: CreditCard },
    { id: "vendors", label: "Vendor Master", icon: Building2, count: kpi.activeVendorsCount },
    { id: "reports", label: "Procurement Reports (7)", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <PageHeader
        moduleName="Procurement & Sourcing"
        breadcrumbs={[{ label: "Operations", href: "/dashboards" }, { label: "Procurement" }]}
        title="Enterprise Sourcing & Procurement Console"
        subtitle="End-to-end procurement lifecycle from Need Requisition to Sourcing, PO, Goods Receipt, 3-Way Invoice Matching, and AP Settlement."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Double-Entry Verified (GL 1200 / 2050 / 2000)
          </span>
        }
        actions={
          <button
            onClick={() => loadAllData()}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-[#F4F4F5] text-[#18181B] px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#D4D4D8] shadow-2xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#71717A]" />
            Refresh
          </button>
        }
      />

      <div className="space-y-6">
        {/* Executive KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
              Total Spend (PKR)
            </span>
            <div className="my-2">
              <span className="text-xl sm:text-2xl font-black font-mono text-[#18181B]">
                {formatCurrency(kpi.totalSpend)}
              </span>
            </div>
            <span className="text-[10px] text-[#A1A1AA] font-mono">
              Across {kpi.totalPos} Issued POs
            </span>
          </div>

          <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
              Active Vendors
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
                {kpi.activeVendorsCount}
              </span>
              <Building2 className="w-5 h-5 text-emerald-500/70" />
            </div>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Registered Master</span>
          </div>

          <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
              Open POs
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono text-blue-600">
                {kpi.openPosCount}
              </span>
              <ShoppingCart className="w-5 h-5 text-blue-500/70" />
            </div>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Pending Receipt</span>
          </div>

          <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
              Pending PRs
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-600">
                {kpi.pendingPrsCount}
              </span>
              <FileText className="w-5 h-5 text-amber-500/70" />
            </div>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Awaiting Approval / PO</span>
          </div>

          <div
            className={cn(
              "rounded-2xl p-4 flex flex-col justify-between border shadow-2xs transition-all",
              kpi.overdueDeliveriesCount > 0
                ? "bg-rose-50/70 border-rose-200"
                : "bg-white border-[#EDEDED]"
            )}
          >
            <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
              Overdue Deliveries
            </span>
            <div className="my-2 flex items-center justify-between">
              <span
                className={cn(
                  "text-xl sm:text-2xl font-black font-mono",
                  kpi.overdueDeliveriesCount > 0 ? "text-rose-600" : "text-[#18181B]"
                )}
              >
                {kpi.overdueDeliveriesCount}
              </span>
              <AlertTriangle
                className={cn(
                  "w-5 h-5",
                  kpi.overdueDeliveriesCount > 0 ? "text-rose-500" : "text-[#A1A1AA]"
                )}
              />
            </div>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Past Delivery Date</span>
          </div>

          <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
              3-Way Match Rate
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono text-teal-600">
                {kpi.matchAccuracyRate}%
              </span>
              <ShieldAlert className="w-5 h-5 text-teal-500/70" />
            </div>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Audit Pass Rate</span>
          </div>
        </div>

        {/* Visual Lifecycle Pipeline Stage Machine */}
        <ProcurementProcessPipeline
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          metrics={{
            pendingPrsCount: kpi.pendingPrsCount,
            openPosCount: kpi.openPosCount,
            overdueDeliveriesCount: kpi.overdueDeliveriesCount,
            grnPendingInvoiceCount: kpi.grnPendingInvoiceCount,
            activeVendorsCount: kpi.activeVendorsCount,
            pendingApprovalsCount,
          }}
        />

        {/* Sub-Tab Navigation Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 bg-white border border-[#EDEDED] rounded-xl p-1.5 shadow-2xs">
          {subTabButtons.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-[#0D7A5F] text-white shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                      isActive ? "bg-white/20 text-white" : "bg-[#F4F4F5] text-[#71717A]"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Stage Component Content */}
        {loading ? (
          <div className="bg-white border border-[#EDEDED] rounded-2xl p-12 text-center text-[#71717A] shadow-2xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0D7A5F] mb-3" />
            <span className="text-xs font-mono">Loading procurement datasets & ledgers...</span>
          </div>
        ) : (
          <div>
            {activeTab === "approvals" && (
              <ProcurementApprovalsTab
                prs={prs}
                pos={pos}
                invoices={invoices}
                onRefresh={loadAllData}
                onNavigateToPr={() => setActiveTab("prs")}
                onNavigateToPo={() => setActiveTab("pos")}
                onNavigateToInvoice={() => setActiveTab("invoices")}
              />
            )}

            {activeTab === "prs" && (
              <RequisitionsTab
                prs={prs}
                vendors={vendors}
                products={products}
                employees={employees}
                jobs={jobs}
                onRefresh={loadAllData}
                onNavigateToRfq={handleNavigateToRfq}
                onNavigateToPo={() => setActiveTab("pos")}
              />
            )}

            {activeTab === "rfqs" && (
              <RfqSourcingTab
                rfqs={rfqs}
                prs={prs}
                vendors={vendors}
                onRefresh={loadAllData}
                onNavigateToPo={() => setActiveTab("pos")}
                initialPrForRfq={initialPrForRfq}
              />
            )}

            {activeTab === "pos" && (
              <PurchaseOrdersTab
                pos={pos}
                vendors={vendors}
                products={products}
                onRefresh={loadAllData}
                onOpenGrnModal={handleOpenGrnModal}
              />
            )}

            {activeTab === "grns" && (
              <GoodsReceiptTab
                grns={grns}
                pos={pos}
                onRefresh={loadAllData}
                presetPoForGrn={presetPoForGrn}
              />
            )}

            {activeTab === "invoices" && (
              <ThreeWayMatchTab
                invoices={invoices}
                pos={pos}
                grns={grns}
                vendors={vendors}
                onRefresh={loadAllData}
                onNavigateToPayment={handleNavigateToPayment}
              />
            )}

            {activeTab === "payments" && (
              <PaymentsTab
                invoices={invoices}
                onRefresh={loadAllData}
                presetInvoiceForPay={presetInvoiceForPay}
              />
            )}

            {activeTab === "vendors" && (
              <VendorsTab
                vendors={vendors}
                onRefresh={loadAllData}
                onSelectVendorForPo={handleSelectVendorForPo}
              />
            )}

            {activeTab === "reports" && (
              <ProcurementReportsTab
                reportsData={reportsData}
                onRefresh={loadAllData}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
