"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import type { ProcurementStage } from "@/components/procurement/ProcurementProcessPipeline";
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
  Boxes,
  Clock,
  AlertTriangle,
  CheckCircle2,
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
  vendors: ["procurement.vendor.manage", "procurement.rfq.manage", "procurement.po.create"],
  reports: ["procurement.reports.view"],
};

type QueueFilter = string | null;

type MetricChip = {
  key: string;
  label: string;
  value: number | string;
  tone?: "slate" | "amber" | "red"; // secondary tabs use slate — keep quiet
  tab: ProcurementStage;
  filter?: string;
  hint?: string;
  icon?: any;
};

function ProcurementPageContent() {
  const { activeRole, currentPersona, hasPermission, activeUser } = useRole();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ProcurementStage | null;
  const actionParam = searchParams.get("action");

  const [activeTab, setActiveTab] = useState<ProcurementStage>(() => {
    if (tabParam && (Object.keys(TAB_PERMS) as ProcurementStage[]).includes(tabParam)) {
      return tabParam;
    }
    return "prs";
  });
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(null);
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

  // Keep active tab within visible set; prefer role home default
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      const roleDefault: Record<string, ProcurementStage> = {
        storekeeper: "prs",
        purchasing: "prs",
        accountant: "invoices",
        manager: "approvals",
        auditor: "reports",
        admin: "approvals",
      };
      const prefer = roleDefault[activeRole];
      setActiveTab(
        prefer && visibleTabs.includes(prefer) ? prefer : visibleTabs[0]
      );
    }
  }, [visibleTabs, activeTab, activeRole]);

  useEffect(() => {
    if (tabParam && (Object.keys(TAB_PERMS) as ProcurementStage[]).includes(tabParam) && canSeeTab(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam, canSeeTab]);

  const goQueue = (tab: ProcurementStage, filter?: string) => {
    if (!canSeeTab(tab)) return;
    setQueueFilter(filter || null);
    setActiveTab(tab);
  };

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

  const allSubTabButtons: {
    id: ProcurementStage;
    label: string;
    icon: any;
    count?: number;
  }[] = [
    { id: "approvals", label: "Approvals", icon: ShieldAlert, count: pendingApprovalsCount },
    { id: "prs", label: "Requisitions", icon: FileText, count: kpi.pendingPrsCount },
    { id: "rfqs", label: "RFQ", icon: Scale, count: rfqs.filter((r) => !["awarded", "cancelled", "closed"].includes(r.status)).length },
    { id: "pos", label: "Purchase Orders", icon: ShoppingCart, count: kpi.openPosCount },
    { id: "grns", label: "Goods Receipt", icon: PackageCheck, count: kpi.grnPendingInvoiceCount },
    { id: "invoices", label: "3-Way Match", icon: ShieldAlert, count: invoices.filter((i) => ["pending_match", "matched", "discrepancy"].includes(i.matchStatus)).length },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "vendors", label: "Vendors", icon: Building2, count: kpi.activeVendorsCount },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ];

  const subTabButtons = allSubTabButtons.filter((t) => canSeeTab(t.id));

  // Role home queues (reuse loaded lists)
  const myPrs = prs.filter((p) =>
    ["draft", "submitted", "approved", "partially_converted"].includes(p.status)
  );
  const posAwaitingGrn = pos.filter((p) =>
    ["approved", "sent", "partially_received", "sent_to_vendor"].includes(p.status)
  );
  const approvedPrs = prs.filter((p) => p.status === "approved");
  const openRfqs = rfqs.filter((r) => !["awarded", "cancelled", "closed"].includes(r.status));
  const draftSentPos = pos.filter((p) => ["draft", "sent", "approved", "sent_to_vendor"].includes(p.status));
  const unmatchedBills = invoices.filter((i) =>
    ["pending_match", "matched", "discrepancy"].includes(i.matchStatus)
  );
  const approvedForPayment = invoices.filter((i) => i.matchStatus === "approved_for_payment");
  const submittedPrs = prs.filter((p) => p.status === "submitted");
  const draftPos = pos.filter((p) => p.status === "draft");
  const discrepancyBills = invoices.filter((i) => i.matchStatus === "discrepancy");

  const roleChips = useMemo((): MetricChip[] => {
    if (activeRole === "storekeeper") {
      return [
        { key: "my-prs", label: "My Requisitions", value: myPrs.length, tab: "prs", hint: "Draft & open requisitions", icon: FileText },
        { key: "await-grn", label: "Awaiting Receipt", value: posAwaitingGrn.length, tone: posAwaitingGrn.length ? "amber" : "slate", tab: "grns", hint: "POs awaiting delivery", icon: PackageCheck },
        { key: "grns", label: "GRNs Logged", value: grns.length, tab: "grns", hint: "Completed goods receipts", icon: Boxes },
      ];
    }
    if (activeRole === "purchasing") {
      return [
        { key: "apr", label: "Approved PRs", value: approvedPrs.length, tone: approvedPrs.length ? "amber" : "slate", tab: "prs", filter: "approved", hint: "Ready to source into PO", icon: CheckCircle2 },
        { key: "rfq", label: "Open RFQs", value: openRfqs.length, tab: "rfqs", hint: "Vendor quotations active", icon: Scale },
        { key: "pos", label: "Active Orders", value: draftSentPos.length, tab: "pos", hint: "Draft & issued POs", icon: ShoppingCart },
        ...(canViewCosts
          ? [{ key: "spend", label: "Procurement Spend", value: kpi.totalSpend != null ? formatCurrency(kpi.totalSpend) : "—", tab: "reports" as ProcurementStage, hint: "Issued order commitment", icon: CreditCard }]
          : []),
      ];
    }
    if (activeRole === "accountant") {
      return [
        { key: "unmatched", label: "Unmatched Bills", value: unmatchedBills.length, tone: unmatchedBills.length ? "amber" : "slate", tab: "invoices", filter: "pending_match", hint: "Awaiting 3-way match", icon: AlertTriangle },
        { key: "ready", label: "Ready to Pay", value: approvedForPayment.length, tab: "payments", filter: "approved_for_payment", hint: "Approved vendor settlements", icon: CreditCard },
        { key: "disc", label: "Discrepancy Invoices", value: discrepancyBills.length, tone: discrepancyBills.length ? "red" : "slate", tab: "invoices", filter: "discrepancy", hint: "Price / qty variance", icon: ShieldAlert },
        ...(canViewCosts
          ? [{ key: "spend", label: "Total Spend", value: kpi.totalSpend != null ? formatCurrency(kpi.totalSpend) : "—", tab: "reports" as ProcurementStage, hint: "Procurement expenditure", icon: BarChart3 }]
          : []),
      ];
    }
    if (activeRole === "manager") {
      return [
        { key: "pr-appr", label: "PR Approvals", value: submittedPrs.length, tone: submittedPrs.length ? "amber" : "slate", tab: "approvals", hint: "Requisitions needing sign-off", icon: FileText },
        { key: "po-appr", label: "Draft POs", value: draftPos.length, tone: draftPos.length ? "amber" : "slate", tab: "approvals", hint: "Orders awaiting authorization", icon: ShoppingCart },
        { key: "disc", label: "Discrepancy Bills", value: discrepancyBills.length, tone: discrepancyBills.length ? "red" : "slate", tab: "invoices", filter: "discrepancy", hint: "Flagged invoices", icon: AlertTriangle },
        { key: "overdue", label: "Overdue Deliveries", value: kpi.overdueDeliveriesCount, tone: kpi.overdueDeliveriesCount ? "red" : "slate", tab: "pos", hint: "Delayed vendor deliveries", icon: Clock },
      ];
    }
    // admin / auditor / default overview
    return [
      { key: "pending", label: "Pending PRs", value: kpi.pendingPrsCount, tone: kpi.pendingPrsCount ? "amber" : "slate", tab: "prs", filter: "submitted", hint: "Requisitions in queue", icon: FileText },
      { key: "open-po", label: "Open Orders", value: kpi.openPosCount, tab: "pos", hint: "Active purchase orders", icon: ShoppingCart },
      { key: "approvals", label: "Approvals Inbox", value: pendingApprovalsCount, tone: pendingApprovalsCount ? "amber" : "slate", tab: "approvals", hint: "Items requiring review", icon: ShieldAlert },
      {
        key: "overdue",
        label: "Overdue Deliveries",
        value: kpi.overdueDeliveriesCount,
        tone: kpi.overdueDeliveriesCount ? "red" : "slate",
        tab: "pos",
        hint: "Supplier delays",
        icon: Clock,
      },
    ];
  }, [
    activeRole,
    myPrs.length,
    posAwaitingGrn.length,
    grns.length,
    approvedPrs.length,
    openRfqs.length,
    draftSentPos.length,
    canViewCosts,
    kpi.totalSpend,
    kpi.pendingPrsCount,
    kpi.openPosCount,
    kpi.overdueDeliveriesCount,
    unmatchedBills.length,
    approvedForPayment.length,
    discrepancyBills.length,
    submittedPrs.length,
    draftPos.length,
    pendingApprovalsCount,
  ]);

  const roleSubtitle = (() => {
    switch (activeRole) {
      case "storekeeper":
        return "Your requisitions and goods receipts.";
      case "purchasing":
        return "Source approved needs into POs and RFQs.";
      case "accountant":
        return "Match vendor bills and settle payables.";
      case "manager":
        return "Approve PRs, POs, and discrepancy bills.";
      case "admin":
        return "Full procurement overview across all queues.";
      default:
        return "Requisitions through payment — role-filtered.";
    }
  })();

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      <PageHeader
        moduleName="Procurement"
        breadcrumbs={[
          { label: "Operations", href: "/dashboards" },
          { label: "Procurement" },
        ]}
        title="Procurement"
        subtitle={roleSubtitle}
        actions={
          <button
            type="button"
            onClick={() => loadAllData()}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#EDEDED] transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            Refresh
          </button>
        }
      />

      <div className="space-y-4">
        {/* Role-specific Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {roleChips.map((chip) => {
            const isSelected = activeTab === chip.tab && (!chip.filter || queueFilter === chip.filter);
            const Icon = chip.icon || FileText;
            const isAlert = chip.tone === "red" && Number(chip.value) > 0;
            const isWarning = chip.tone === "amber" && Number(chip.value) > 0;

            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => goQueue(chip.tab, chip.filter)}
                className={cn(
                  "group relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer overflow-hidden",
                  "bg-white shadow-2xs hover:shadow-md hover:-translate-y-0.5",
                  isSelected
                    ? "border-[#0D7A5F] ring-2 ring-[#0D7A5F]/20 bg-gradient-to-br from-emerald-50/40 via-white to-white"
                    : isAlert
                    ? "border-rose-200 hover:border-rose-300"
                    : isWarning
                    ? "border-amber-200 hover:border-amber-300"
                    : "border-slate-200/90 hover:border-slate-300"
                )}
              >
                {/* Active Indicator Top Accent Bar */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0D7A5F] to-[#0A624C]" />
                )}

                {/* Card Header: Label & Icon */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    {chip.label}
                  </span>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0",
                      isSelected
                        ? "bg-[#0D7A5F] text-white shadow-xs"
                        : isAlert
                        ? "bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white"
                        : isWarning
                        ? "bg-amber-100 text-amber-800 group-hover:bg-amber-600 group-hover:text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-[#0D7A5F]"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Card Body: Metric Value */}
                <div className="flex items-baseline justify-between gap-2 mt-auto">
                  <div
                    className={cn(
                      "text-3xl font-black font-mono tracking-tight leading-none",
                      isAlert
                        ? "text-rose-600"
                        : isWarning
                        ? "text-amber-700"
                        : isSelected
                        ? "text-[#0D7A5F]"
                        : "text-slate-900 group-hover:text-[#0D7A5F]"
                    )}
                  >
                    {chip.value}
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-[#0D7A5F] bg-[#0D7A5F]/10 px-2 py-0.5 rounded-full font-mono">
                      Active
                    </span>
                  )}
                </div>

                {/* Card Footer: Hint */}
                {chip.hint && (
                  <div className="text-[11px] text-slate-500 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>{chip.hint}</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-[#0D7A5F] group-hover:translate-x-0.5 transition-all">
                      &rarr;
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {queueFilter && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-fit">
            <span>Filter active: <strong className="font-mono text-slate-800">{queueFilter}</strong></span>
            <button
              type="button"
              onClick={() => setQueueFilter(null)}
              className="text-[#0D7A5F] hover:underline font-semibold ml-1"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Single Navigation Tabs Bar */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[#EDEDED] pt-1">
          {subTabButtons.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setQueueFilter(null);
                  setActiveTab(tab.id);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-all font-medium",
                  isActive
                    ? "border-[#0D7A5F] text-[#0D7A5F] font-bold bg-[#0D7A5F]/5 rounded-t-lg"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-[#0D7A5F]" : "text-slate-400")} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ml-0.5",
                      isActive
                        ? "bg-[#0D7A5F] text-white"
                        : "bg-slate-100 text-slate-600"
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
          <div className="bg-white border border-[#EDEDED] rounded-xl p-12 text-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0D7A5F] mb-3" />
            <span className="text-xs">Loading procurement…</span>
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
                queueFilter={queueFilter}
                initialAction={actionParam}
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
                queueFilter={queueFilter}
                initialAction={actionParam}
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
                queueFilter={queueFilter}
              />
            )}

            {activeTab === "payments" && canSeeTab("payments") && (
              <PaymentsTab
                invoices={invoices}
                onRefresh={loadAllData}
                presetInvoiceForPay={presetInvoiceForPay}
                queueFilter={queueFilter}
              />
            )}

            {activeTab === "vendors" && canSeeTab("vendors") && (
              <VendorsTab
                vendors={vendors}
                onRefresh={loadAllData}
                onSelectVendorForPo={handleSelectVendorForPo}
                initialAction={actionParam}
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

        <p className="text-[10px] text-slate-400 text-center pt-2" title="Double-entry GL postings apply on GRN, match, and payment">
          GL postings apply on GRN · match · payment
        </p>
      </div>
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#0D7A5F]" />
            <span>Loading Procurement Workspace…</span>
          </div>
        </div>
      }
    >
      <ProcurementPageContent />
    </Suspense>
  );
}
