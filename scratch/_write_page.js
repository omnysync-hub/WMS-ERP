const fs = require("fs");
const path = require("path");
const root = "D:\\WORKMAN SERVICES";

const page = `"use client";

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
  vendors: ["procurement.vendor.manage", "procurement.view_pr", "procurement.rfq.manage", "procurement.po.create"],
  reports: ["procurement.reports.view"],
};

type QueueFilter = string | null;

type MetricChip = {
  key: string;
  label: string;
  value: number | string;
  tone?: "slate" | "amber" | "red";
  tab: ProcurementStage;
  filter?: string;
  hint?: string;
};

export default function ProcurementPage() {
  const { activeRole, currentPersona, hasPermission, activeUser } = useRole();
  const [activeTab, setActiveTab] = useState<ProcurementStage>("prs");
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
        { key: "my-prs", label: "My PRs", value: myPrs.length, tab: "prs", filter: "draft", hint: "Draft & open" },
        { key: "await-grn", label: "Awaiting GRN", value: posAwaitingGrn.length, tone: posAwaitingGrn.length ? "amber" : "slate", tab: "grns", hint: "POs to receive" },
        { key: "grns", label: "GRNs logged", value: grns.length, tab: "grns" },
      ];
    }
    if (activeRole === "purchasing") {
      return [
        { key: "apr", label: "Approved PRs", value: approvedPrs.length, tone: approvedPrs.length ? "amber" : "slate", tab: "prs", filter: "approved" },
        { key: "rfq", label: "Open RFQs", value: openRfqs.length, tab: "rfqs" },
        { key: "pos", label: "Draft / Sent POs", value: draftSentPos.length, tab: "pos", filter: "draft" },
        ...(canViewCosts
          ? [{ key: "spend", label: "Spend", value: kpi.totalSpend != null ? formatCurrency(kpi.totalSpend) : "—", tab: "reports" as ProcurementStage, hint: "Issued POs" }]
          : []),
      ];
    }
    if (activeRole === "accountant") {
      return [
        { key: "unmatched", label: "Unmatched", value: unmatchedBills.length, tone: unmatchedBills.length ? "amber" : "slate", tab: "invoices", filter: "pending_match" },
        { key: "ready", label: "Ready to pay", value: approvedForPayment.length, tab: "payments", filter: "approved_for_payment" },
        { key: "disc", label: "Discrepancies", value: discrepancyBills.length, tone: discrepancyBills.length ? "red" : "slate", tab: "invoices", filter: "discrepancy" },
        ...(canViewCosts
          ? [{ key: "spend", label: "Spend", value: kpi.totalSpend != null ? formatCurrency(kpi.totalSpend) : "—", tab: "reports" as ProcurementStage }]
          : []),
      ];
    }
    if (activeRole === "manager") {
      return [
        { key: "pr-appr", label: "PR approvals", value: submittedPrs.length, tone: submittedPrs.length ? "amber" : "slate", tab: "approvals" },
        { key: "po-appr", label: "Draft POs", value: draftPos.length, tone: draftPos.length ? "amber" : "slate", tab: "approvals" },
        { key: "disc", label: "Discrepancy bills", value: discrepancyBills.length, tone: discrepancyBills.length ? "red" : "slate", tab: "invoices", filter: "discrepancy" },
        { key: "overdue", label: "Overdue", value: kpi.overdueDeliveriesCount, tone: kpi.overdueDeliveriesCount ? "red" : "slate", tab: "pos" },
      ];
    }
    // admin / auditor / default overview
    return [
      { key: "pending", label: "Pending PRs", value: kpi.pendingPrsCount, tone: kpi.pendingPrsCount ? "amber" : "slate", tab: "prs", filter: "submitted" },
      { key: "open-po", label: "Open POs", value: kpi.openPosCount, tab: "pos" },
      { key: "approvals", label: "Approvals inbox", value: pendingApprovalsCount, tone: pendingApprovalsCount ? "amber" : "slate", tab: "approvals" },
      {
        key: "overdue",
        label: "Overdue",
        value: kpi.overdueDeliveriesCount,
        tone: kpi.overdueDeliveriesCount ? "red" : "slate",
        tab: "pos",
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

  const RoleHome = () => {
    const card = (
      title: string,
      items: { label: string; onClick?: () => void }[],
      empty: string,
      cta?: { label: string; onClick: () => void }
    ) => (
      <div className="bg-white border border-[#EDEDED] rounded-xl p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Inbox className="w-3.5 h-3.5 text-slate-400" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h3>
          <span className="ml-auto text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="py-2">
            <p className="text-xs text-slate-400">{empty}</p>
            {cta && (
              <button
                type="button"
                onClick={cta.onClick}
                className="mt-2 text-xs font-semibold text-[#0D7A5F] hover:underline"
              >
                {cta.label}
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {items.slice(0, 6).map((it, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={it.onClick}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-slate-50 text-slate-800 font-medium"
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
            "My draft / submitted PRs",
            myPrs.map((p) => ({
              label: \`\${p.prNumber || p.id} · \${p.status}\`,
              onClick: () => goQueue("prs", p.status),
            })),
            "No open requisitions",
            canSeeTab("prs")
              ? { label: "Open requisitions", onClick: () => goQueue("prs") }
              : undefined
          )}
          {card(
            "POs awaiting GRN",
            posAwaitingGrn.map((p) => ({
              label: \`\${p.poNumber} · \${p.status}\`,
              onClick: () => {
                setPresetPoForGrn(p);
                goQueue("grns");
              },
            })),
            "Nothing waiting for receipt",
            canSeeTab("grns")
              ? { label: "Go to goods receipt", onClick: () => goQueue("grns") }
              : undefined
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
              label: \`\${p.prNumber || p.id}\`,
              onClick: () => goQueue("prs", "approved"),
            })),
            "No approved PRs to source",
            { label: "View requisitions", onClick: () => goQueue("prs", "approved") }
          )}
          {card(
            "Open RFQs",
            openRfqs.map((r) => ({
              label: \`\${r.rfqNumber || r.id} · \${r.status}\`,
              onClick: () => goQueue("rfqs"),
            })),
            "No open RFQs",
            canSeeTab("rfqs")
              ? { label: "Open RFQ board", onClick: () => goQueue("rfqs") }
              : undefined
          )}
          {card(
            "Draft / sent POs",
            draftSentPos.map((p) => ({
              label: \`\${p.poNumber} · \${p.status}\`,
              onClick: () => goQueue("pos", p.status),
            })),
            "No draft or sent POs",
            { label: "View purchase orders", onClick: () => goQueue("pos") }
          )}
        </div>
      );
    }

    if (activeRole === "accountant") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {card(
            "Unmatched / pending match",
            unmatchedBills.map((i) => ({
              label: \`\${i.invoiceNumber} · \${i.matchStatus}\`,
              onClick: () => goQueue("invoices", i.matchStatus),
            })),
            "No unmatched bills",
            { label: "Open 3-way match", onClick: () => goQueue("invoices") }
          )}
          {card(
            "Ready to pay",
            approvedForPayment.map((i) => ({
              label: \`\${i.invoiceNumber}\`,
              onClick: () => {
                setPresetInvoiceForPay(i);
                goQueue("payments", "approved_for_payment");
              },
            })),
            "Nothing queued for payment",
            canSeeTab("payments")
              ? { label: "Open payments", onClick: () => goQueue("payments") }
              : undefined
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
              label: \`\${p.prNumber || p.id}\`,
              onClick: () => goQueue("approvals"),
            })),
            "No PRs awaiting approval",
            { label: "Approvals inbox", onClick: () => goQueue("approvals") }
          )}
          {card(
            "Draft POs",
            draftPos.map((p) => ({
              label: \`\${p.poNumber}\`,
              onClick: () => goQueue("approvals"),
            })),
            "No draft POs",
            { label: "Approvals inbox", onClick: () => goQueue("approvals") }
          )}
          {card(
            "Discrepancy bills",
            discrepancyBills.map((i) => ({
              label: \`\${i.invoiceNumber}\`,
              onClick: () => goQueue("invoices", "discrepancy"),
            })),
            "No discrepancy invoices",
            { label: "Review invoices", onClick: () => goQueue("invoices", "discrepancy") }
          )}
        </div>
      );
    }

    // admin / others — overview of all queues
    if (activeRole === "admin" || activeRole === "auditor") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {card(
            "Approvals inbox",
            [
              ...submittedPrs.slice(0, 3).map((p) => ({
                label: \`PR \${p.prNumber || p.id}\`,
                onClick: () => goQueue("approvals"),
              })),
              ...draftPos.slice(0, 2).map((p) => ({
                label: \`PO \${p.poNumber}\`,
                onClick: () => goQueue("approvals"),
              })),
            ],
            "Inbox clear",
            { label: "Open approvals", onClick: () => goQueue("approvals") }
          )}
          {card(
            "Pending PRs",
            myPrs.slice(0, 5).map((p) => ({
              label: \`\${p.prNumber || p.id} · \${p.status}\`,
              onClick: () => goQueue("prs", p.status),
            })),
            "No open PRs",
            { label: "View PRs", onClick: () => goQueue("prs") }
          )}
          {card(
            "Open POs / GRN",
            posAwaitingGrn.slice(0, 5).map((p) => ({
              label: \`\${p.poNumber} · \${p.status}\`,
              onClick: () => goQueue("pos"),
            })),
            "No open receipts",
            { label: "View POs", onClick: () => goQueue("pos") }
          )}
          {card(
            "Match & pay",
            [
              ...unmatchedBills.slice(0, 3).map((i) => ({
                label: \`\${i.invoiceNumber} · match\`,
                onClick: () => goQueue("invoices", i.matchStatus),
              })),
              ...approvedForPayment.slice(0, 2).map((i) => ({
                label: \`\${i.invoiceNumber} · pay\`,
                onClick: () => goQueue("payments"),
              })),
            ],
            "No bills in queue",
            { label: "Open match", onClick: () => goQueue("invoices") }
          )}
        </div>
      );
    }

    return null;
  };

  const chipTone = (tone?: MetricChip["tone"], active?: boolean) => {
    if (active) return "border-[#0D7A5F] bg-primary-light ring-1 ring-[#0D7A5F]/30";
    if (tone === "red") return "border-red-200 bg-red-50/60 hover:border-red-300";
    if (tone === "amber") return "border-amber-200 bg-amber-50/50 hover:border-amber-300";
    return "border-[#EDEDED] bg-white hover:border-slate-300";
  };

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
        <RoleHome />

        {/* Role-specific metric chips — click filters the active queue */}
        <div className="flex flex-wrap gap-2">
          {roleChips.map((chip) => {
            const isActive =
              activeTab === chip.tab &&
              (chip.filter ? queueFilter === chip.filter : !queueFilter || queueFilter === chip.filter);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => goQueue(chip.tab, chip.filter)}
                className={cn(
                  "inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition min-w-[7.5rem]",
                  chipTone(chip.tone, activeTab === chip.tab && (!chip.filter || queueFilter === chip.filter))
                )}
              >
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    {chip.label}
                  </div>
                  <div
                    className={cn(
                      "text-base font-bold font-mono leading-tight mt-0.5",
                      chip.tone === "red"
                        ? "text-red-700"
                        : chip.tone === "amber"
                        ? "text-amber-800"
                        : "text-slate-800"
                    )}
                  >
                    {chip.value}
                  </div>
                  {chip.hint && (
                    <div className="text-[10px] text-slate-400 mt-0.5">{chip.hint}</div>
                  )}
                </div>
              </button>
            );
          })}
          {queueFilter && (
            <button
              type="button"
              onClick={() => setQueueFilter(null)}
              className="self-center text-xs text-slate-500 hover:text-slate-800 underline px-2"
            >
              Clear filter
            </button>
          )}
        </div>

        <ProcurementProcessPipeline
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (canSeeTab(tab)) {
              setQueueFilter(null);
              setActiveTab(tab);
            }
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

        {/* Quieter permission-filtered tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[#EDEDED]">
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
                  "flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors",
                  isActive
                    ? "border-[#0D7A5F] text-[#0D7A5F] font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
                )}
              >
                <Icon className="w-3.5 h-3.5 opacity-70" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                      isActive
                        ? "bg-primary-light text-[#0D7A5F]"
                        : "bg-slate-100 text-slate-500"
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
`;

fs.writeFileSync(path.join(root, "src/app/procurement/page.tsx"), page, "utf8");
console.log("page written", page.length);