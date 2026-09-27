"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
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
import { formatCurrency, cn } from "@/lib/utils";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";
import { procurementActorHeaders } from "@/lib/procurementClient";
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
  AlertTriangle,
  Inbox,
} from "lucide-react";

/** Tab visibility keyed by any-of permissions */
const TAB_PERMS: Record<ProcurementStage, string[]> = {
  approvals: ["procurement.pr.approve", "procurement.po.approve", "procurement.invoice.approve"],
  prs: ["procurement.pr.create", "procurement.pr.submit", "procurement.pr.approve", "procurement.view_pr", "procurement.po.create", "procurement.rfq.manage"],
  rfqs: ["procurement.rfq.manage", "procurement.rfq.award"],
  pos: ["procurement.po.create", "procurement.po.approve", "procurement.po.send", "procurement.costs.view"],
  grns: ["procurement.grn.create", "procurement.grn.quality"],
  invoices: ["procurement.invoice.create", "procurement.invoice.match", "procurement.invoice.approve"],
  payments: ["procurement.payment.record"],
  vendors: ["procurement.vendor.manage", "procurement.view_pr", "procurement.rfq.manage", "procurement.po.create"],
  reports: ["procurement.reports.view"],
};

export default function ProcurementPage() {
  const { activeRole, currentPersona, hasPermission, activeUser } = useRole();
  const [activeTab, setActiveTab] = useState<ProcurementStage>("prs");
  const [loading, setLoading] = useState(true);

  const [vendors, setVendors] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const [kpi, setKpi] = useState({
    totalSpend: 0 as number | null,
    activeVendorsCount: 0,
    openPosCount: 0,
    pendingPrsCount: 0,
    overdueDeliveriesCount: 0,
    grnPendingInvoiceCount: 0,
    matchAccuracyRate: 100,
    totalPos: 0,
    masked: false,
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

  const [initialPrForRfq, setInitialPrForRfq] = useState<any | null>(null);
  const [presetPoForGrn, setPresetPoForGrn] = useState<any | null>(null);
  const [presetInvoiceForPay, setPresetInvoiceForPay] = useState<any | null>(null);

  const canSeeTab = useCallback(
    (tab: ProcurementStage) => {
      if (activeRole === "admin") return true;
      const keys = TAB_PERMS[tab] || [];
      return keys.some((k) => hasPermission(k));
    },
    [activeRole, hasPermission]
  );

  const visibleTabs = useMemo(
    () => (Object.keys(TAB_PERMS) as ProcurementStage[]).filter(canSeeTab),
    [canSeeTab]
  );

  const canViewCosts = hasPermission("procurement.costs.view") || activeRole === "admin";

  const loadAllData = useCallback(async () => {
    try {
      const res = await fetch("/api/procurement?view=all", {
        headers: procurementActorHeaders(
          activeRole,
          currentPersona?.name || activeUser?.name,
          activeUser?.id
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch procurement data");
      }
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
  }, [activeRole, currentPersona?.name, activeUser?.name, activeUser?.id]);

  useEffect(() => {
    setLoading(true);
    loadAllData();

    const unsubscribe = realtimeSync.subscribe(() => {
      loadAllData();
    });
    return () => unsubscribe();
  }, [loadAllData]);

  // Keep active tab within visible set
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      // Prefer role home default tabs
      const roleDefault: Record<string, ProcurementStage> = {
        storekeeper: "prs",
        purchasing: "prs",
        accountant: "invoices",
        manager: "approvals",
        auditor: "reports",
      };
      const prefer = roleDefault[activeRole];
      setActiveTab(
        prefer && visibleTabs.includes(prefer) ? prefer : visibleTabs[0]
      );
    }
  }, [visibleTabs, activeTab, activeRole]);

  const handleNavigateToRfq = (pr: any) => {
    setInitialPrForRfq(pr);
    if (canSeeTab("rfqs")) setActiveTab("rfqs");
  };

  const handleOpenGrnModal = (po: any) => {
    setPresetPoForGrn(po);
    if (canSeeTab("grns")) setActiveTab("grns");
  };

  const handleNavigateToPayment = (inv: any) => {
    setPresetInvoiceForPay(inv);
    if (canSeeTab("payments")) setActiveTab("payments");
  };

  const handleSelectVendorForPo = (_vendor: any) => {
    if (canSeeTab("pos")) setActiveTab("pos");
  };

  const pendingApprovalsCount =
    prs.filter((p) => p.status === "submitted").length +
    pos.filter((p) => p.status === "draft").length +
    invoices.filter((i) =>
      ["matched", "discrepancy", "pending_match"].includes(i.matchStatus)
    ).length;

  const allSubTabButtons: { id: ProcurementStage; label: string; icon: any; count?: number }[] = [
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

  const subTabButtons = allSubTabButtons.filter((t) => canSeeTab(t.id));

  // Role home queues (reuse loaded lists)
  const myPrs = prs.filter((p) =>
    ["draft", "submitted", "approved", "partially_converted"].includes(p.status)
  );
  const posAwaitingGrn = pos.filter((p) =>
    ["approved", "sent", "partially_received"].includes(p.status)
  );
  const approvedPrs = prs.filter((p) => p.status === "approved");
  const openRfqs = rfqs.filter((r) => !["awarded", "cancelled", "closed"].includes(r.status));
  const draftSentPos = pos.filter((p) => ["draft", "sent", "approved"].includes(p.status));
  const unmatchedBills = invoices.filter((i) =>
    ["pending_match", "matched", "discrepancy"].includes(i.matchStatus)
  );
  const approvedForPayment = invoices.filter((i) => i.matchStatus === "approved_for_payment");
  const submittedPrs = prs.filter((p) => p.status === "submitted");
  const draftPos = pos.filter((p) => p.status === "draft");
  const discrepancyBills = invoices.filter((i) => i.matchStatus === "discrepancy");

  const RoleHome = () => {
    const card = (title: string, items: { label: string; onClick?: () => void }[], empty: string) => (
      <div className="bg-white border border-[#EDEDED] rounded-xl p-4 shadow-2xs">
        <div className="flex items-center gap-2 mb-2">
          <Inbox className="w-4 h-4 text-[#0D7A5F]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717A]">{title}</h3>
          <span className="ml-auto text-[10px] font-mono bg-[#F4F4F5] px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-[#A1A1AA]">{empty}</p>
        ) : (
          <ul className="space-y-1 max-h-36 overflow-y-auto">
            {items.slice(0, 8).map((it, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={it.onClick}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-[#F4F4F5] text-[#18181B] font-medium"
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );

    if (activeRole === "storekeeper") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {card(
            "My PRs",
            myPrs.map((p) => ({
              label: `${p.prNumber || p.id} · ${p.status}`,
              onClick: () => canSeeTab("prs") && setActiveTab("prs"),
            })),
            "No open requisitions"
          )}
          {card(
            "POs awaiting GRN",
            posAwaitingGrn.map((p) => ({
              label: `${p.poNumber} · ${p.status}`,
              onClick: () => {
                setPresetPoForGrn(p);
                if (canSeeTab("grns")) setActiveTab("grns");
              },
            })),
            "No POs waiting for receipt"
          )}
        </div>
      );
    }

    if (activeRole === "purchasing") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {card(
            "Approved PRs",
            approvedPrs.map((p) => ({
              label: `${p.prNumber || p.id}`,
              onClick: () => setActiveTab("prs"),
            })),
            "No approved PRs"
          )}
          {card(
            "Open RFQs",
            openRfqs.map((r) => ({
              label: `${r.rfqNumber || r.id} · ${r.status}`,
              onClick: () => canSeeTab("rfqs") && setActiveTab("rfqs"),
            })),
            "No open RFQs"
          )}
          {card(
            "Draft / Sent POs",
            draftSentPos.map((p) => ({
              label: `${p.poNumber} · ${p.status}`,
              onClick: () => canSeeTab("pos") && setActiveTab("pos"),
            })),
            "No draft/sent POs"
          )}
        </div>
      );
    }

    if (activeRole === "accountant") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {card(
            "Unmatched GRNs / Bills",
            unmatchedBills.map((i) => ({
              label: `${i.invoiceNumber} · ${i.matchStatus}`,
              onClick: () => canSeeTab("invoices") && setActiveTab("invoices"),
            })),
            "No unmatched bills"
          )}
          {card(
            "Approved for payment",
            approvedForPayment.map((i) => ({
              label: `${i.invoiceNumber}`,
              onClick: () => {
                setPresetInvoiceForPay(i);
                if (canSeeTab("payments")) setActiveTab("payments");
              },
            })),
            "Nothing queued for payment"
          )}
        </div>
      );
    }

    if (activeRole === "manager") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {card(
            "Submitted PRs",
            submittedPrs.map((p) => ({
              label: `${p.prNumber || p.id}`,
              onClick: () => canSeeTab("approvals") && setActiveTab("approvals"),
            })),
            "No PRs awaiting approval"
          )}
          {card(
            "Draft POs",
            draftPos.map((p) => ({
              label: `${p.poNumber}`,
              onClick: () => canSeeTab("approvals") && setActiveTab("approvals"),
            })),
            "No draft POs"
          )}
          {card(
            "Discrepancy bills",
            discrepancyBills.map((i) => ({
              label: `${i.invoiceNumber}`,
              onClick: () => canSeeTab("invoices") && setActiveTab("invoices"),
            })),
            "No discrepancy invoices"
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        moduleName="Procurement & Sourcing"
        breadcrumbs={[{ label: "Operations", href: "/dashboards" }, { label: "Procurement" }]}
        title="Enterprise Sourcing & Procurement Console"
        subtitle={`Role: ${currentPersona?.designation || activeRole} — multi-party PR → RFQ → PO → GRN → Match → Pay with server RBAC.`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            RBAC gated · Double-Entry GL
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
        <RoleHome />

        {/* KPI cards — hidden for storekeeper view, and spend masked when no costs.view */}
        {activeRole !== "storekeeper" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white border border-[#EDEDED] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
                Total Spend (PKR)
              </span>
              <div className="my-2">
                <span className="text-xl sm:text-2xl font-black font-mono text-[#18181B]">
                  {canViewCosts && kpi.totalSpend != null ? formatCurrency(kpi.totalSpend) : "••••"}
                </span>
              </div>
              <span className="text-[10px] text-[#A1A1AA] font-mono">
                {canViewCosts ? `Across ${kpi.totalPos} Issued POs` : "Costs masked for role"}
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
        )}

        <ProcurementProcessPipeline
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (canSeeTab(tab)) setActiveTab(tab);
          }}
          allowedStages={visibleTabs}
          metrics={{
            pendingPrsCount: kpi.pendingPrsCount,
            openPosCount: kpi.openPosCount,
            overdueDeliveriesCount: kpi.overdueDeliveriesCount,
            grnPendingInvoiceCount: kpi.grnPendingInvoiceCount,
            activeVendorsCount: kpi.activeVendorsCount,
            pendingApprovalsCount,
          }}
        />

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

        {loading ? (
          <div className="bg-white border border-[#EDEDED] rounded-2xl p-12 text-center text-[#71717A] shadow-2xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0D7A5F] mb-3" />
            <span className="text-xs font-mono">Loading procurement datasets & ledgers...</span>
          </div>
        ) : (
          <div>
            {activeTab === "approvals" && canSeeTab("approvals") && (
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

            {activeTab === "prs" && canSeeTab("prs") && (
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

            {activeTab === "rfqs" && canSeeTab("rfqs") && (
              <RfqSourcingTab
                rfqs={rfqs}
                prs={prs}
                vendors={vendors}
                onRefresh={loadAllData}
                onNavigateToPo={() => setActiveTab("pos")}
                initialPrForRfq={initialPrForRfq}
              />
            )}

            {activeTab === "pos" && canSeeTab("pos") && (
              <PurchaseOrdersTab
                pos={pos}
                vendors={vendors}
                products={products}
                onRefresh={loadAllData}
                onOpenGrnModal={handleOpenGrnModal}
              />
            )}

            {activeTab === "grns" && canSeeTab("grns") && (
              <GoodsReceiptTab
                grns={grns}
                pos={pos}
                onRefresh={loadAllData}
                presetPoForGrn={presetPoForGrn}
              />
            )}

            {activeTab === "invoices" && canSeeTab("invoices") && (
              <ThreeWayMatchTab
                invoices={invoices}
                pos={pos}
                grns={grns}
                vendors={vendors}
                onRefresh={loadAllData}
                onNavigateToPayment={handleNavigateToPayment}
              />
            )}

            {activeTab === "payments" && canSeeTab("payments") && (
              <PaymentsTab
                invoices={invoices}
                onRefresh={loadAllData}
                presetInvoiceForPay={presetInvoiceForPay}
              />
            )}

            {activeTab === "vendors" && canSeeTab("vendors") && (
              <VendorsTab
                vendors={vendors}
                onRefresh={loadAllData}
                onSelectVendorForPo={handleSelectVendorForPo}
              />
            )}

            {activeTab === "reports" && canSeeTab("reports") && (
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
