"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import QuickExpenseDrawer from "@/components/drawers/QuickExpenseDrawer";
import FinancialStatementsTab from "@/components/accounts/FinancialStatementsTab";
import BankReconciliationTab from "@/components/accounts/BankReconciliationTab";
import FixedAssetsTab from "@/components/accounts/FixedAssetsTab";
import SubLedgerReconciliationTab from "@/components/accounts/SubLedgerReconciliationTab";
import ReverseJournalEntryModal from "@/components/accounts/ReverseJournalEntryModal";
import AccountMappingTab from "@/components/accounts/AccountMappingTab";
import CoaManagerModal from "@/components/accounts/CoaManagerModal";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { realtimeSync } from "@/lib/realtimeSync";
import {
  CreditCard,
  User,
  BookOpen,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Scale,
  Calendar,
  X,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Check,
  Percent,
  Search,
  FileText,
  ShoppingBag,
  ExternalLink,
  Users,
  Wallet,
  Building,
  RefreshCw,
  FolderTree,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Layers,
  Table as TableIcon,
  Sparkles,
  RotateCcw,
  Sliders,
  Upload,
  Download,
  Edit2,
} from "lucide-react";

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<
    | "ledgers"
    | "expenses"
    | "pos"
    | "cashbook"
    | "chart"
    | "mapping"
    | "journal"
    | "reports"
    | "bankrec"
    | "fixedassets"
    | "subledgers"
  >("ledgers");

  // Sync tab with URL query parameter (?tab=...)
  useEffect(() => {
    const syncTabFromUrl = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (
          tab &&
          [
            "ledgers",
            "expenses",
            "pos",
            "cashbook",
            "chart",
            "mapping",
            "journal",
            "reports",
            "bankrec",
            "fixedassets",
            "subledgers",
          ].includes(tab)
        ) {
          setActiveTab(tab as any);
        }
      }
    };
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  // Sub-tabs for Party Ledgers
  const [partySubTab, setPartySubTab] = useState<"customers" | "technicians" | "vendors">("customers");

  // Data states
  const [pendingDiscounts, setPendingDiscounts] = useState<any[]>([]);
  const [discountLoading, setDiscountLoading] = useState(false);

  const [partiesData, setPartiesData] = useState<{
    customers: any[];
    technicians: any[];
    vendors: any[];
  }>({ customers: [], technicians: [], vendors: [] });
  const [partySearch, setPartySearch] = useState("");

  // Customer Statement Drawer state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerStatement, setCustomerStatement] = useState<any[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Technician Ledger state
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [detailedTechEntries, setDetailedTechEntries] = useState<any[]>([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");

  // Vendor Payment state
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showVendorPayModal, setShowVendorPayModal] = useState(false);
  const [vendorPayAmount, setVendorPayAmount] = useState("");
  const [vendorPayMemo, setVendorPayMemo] = useState("");

  // Expenses & Outflows state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseType, setNewExpenseType] = useState<"company" | "technician">("company");
  const [newExpensePayee, setNewExpensePayee] = useState("");
  const [newExpenseTechId, setNewExpenseTechId] = useState("");
  const [newExpenseAccount, setNewExpenseAccount] = useState("6100");
  const [newExpenseDisbursing, setNewExpenseDisbursing] = useState("1000");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseMemo, setNewExpenseMemo] = useState("");
  const [newExpenseRef, setNewExpenseRef] = useState("");

  // POS Sales state
  const [posSales, setPosSales] = useState<any[]>([]);
  const [posStats, setPosStats] = useState<any>({ totalCount: 0, totalRevenue: 0, cashSales: 0, cardSales: 0 });

  // Chart of Accounts Drilldown Drawer state & Level 4 Hierarchy
  const [accounts, setAccounts] = useState<any[]>([]);
  const [coaTree, setCoaTree] = useState<any[]>([]);
  const [coaFlat, setCoaFlat] = useState<any[]>([]);  // COA Hierarchy Manager Modal
  const [showCoaModal, setShowCoaModal] = useState(false);
  const [coaModalMode, setCoaModalMode] = useState<"create" | "edit" | "import">("create");
  const [selectedAccountToEdit, setSelectedAccountToEdit] = useState<any>(null);

  const handleExportCoaCsv = () => {
    if (coaFlat.length === 0) return;
    const headers = "code,name,type,parentCode,level,balance,entriesCount";
    const rows = coaFlat.map(
      (a) =>
        `"${a.code}","${a.name}","${a.type}","${a.parentCode || ""}","${a.level}","${a.balance}","${a.entriesCount || 0}"`
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `chart_of_accounts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [coaViewMode, setCoaViewMode] = useState<"tree" | "table">("tree");
  const [coaSearch, setCoaSearch] = useState("");
  const [coaLevelFilter, setCoaLevelFilter] = useState<"ALL" | "1" | "2" | "3" | "4">("ALL");
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>("ALL");
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Set<string>>(
    new Set(["1000-GRP", "1100", "2000-GRP", "2100-GRP", "3000-GRP", "4000-GRP", "5000-GRP", "6000-GRP"])
  );
  const [selectedAccountDrilldown, setSelectedAccountDrilldown] = useState<any>(null);
  const [accountLedgerLines, setAccountLedgerLines] = useState<any[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Cashbook State
  const [cashbookEntries, setCashbookEntries] = useState<any[]>([]);
  const [cashbookSummary, setCashbookSummary] = useState<any>({
    totalReceipts: 0,
    totalPayments: 0,
    netClosingBalance: 0,
    totalTransactions: 0,
  });
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [cashbookFilterAccount, setCashbookFilterAccount] = useState("ALL");
  const [cashbookPeriod, setCashbookPeriod] = useState<"all" | "today" | "7d" | "month">("all");
  const [cashbookSearch, setCashbookSearch] = useState("");
  const [cashbookLoading, setCashbookLoading] = useState(false);
  const [showRecordCashModal, setShowRecordCashModal] = useState(false);
  const [cashFormType, setCashFormType] = useState<"receipt" | "payment" | "transfer">("receipt");
  const [cashFormAccount, setCashFormAccount] = useState("1000");
  const [cashFormContra, setCashFormContra] = useState("4000");
  const [cashFormTransferTo, setCashFormTransferTo] = useState("1010");
  const [cashFormAmount, setCashFormAmount] = useState("");
  const [cashFormMemo, setCashFormMemo] = useState("");
  const [cashFormParty, setCashFormParty] = useState("");
  const [cashFormSubmitting, setCashFormSubmitting] = useState(false);

  // General Journal & Manual Entry state
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [showManualJournalModal, setShowManualJournalModal] = useState(false);
  const [manualMemo, setManualMemo] = useState("");
  const [manualLines, setManualLines] = useState<Array<{ accountId: string; debit: string; credit: string }>>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);

  // Settlements queue state
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([]);
  const [settlementJob, setSettlementJob] = useState<any>(null);
  const [amountCollected, setAmountCollected] = useState("");
  const [customerPaymentMeans, setCustomerPaymentMeans] = useState("cash");
  const [selectedPaidExpenses, setSelectedPaidExpenses] = useState<string[]>([]);
  const [disbursingAccountCode, setDisbursingAccountCode] = useState("1000");
  const [adhocExpenses, setAdhocExpenses] = useState<{ amount: number; note: string }[]>([]);
  const [newAdhocAmount, setNewAdhocAmount] = useState("");
  const [newAdhocNote, setNewAdhocNote] = useState("");
  const [isPartialPayoutEnabled, setIsPartialPayoutEnabled] = useState(false);
  const [partialPayoutAmount, setPartialPayoutAmount] = useState("");
  const [syncAndLockJob, setSyncAndLockJob] = useState(true);
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Counter-offer / Modify discount modal
  const [modifyingDiscount, setModifyingDiscount] = useState<any>(null);
  const [modifiedDiscountAmount, setModifiedDiscountAmount] = useState("");

  // Drawers & Notifications
  const [showExpenseDrawer, setShowExpenseDrawer] = useState(false);
  const [drawerTechId, setDrawerTechId] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [actionErrorMsg, setActionErrorMsg] = useState("");

  // Enterprise Features State
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [reversingEntry, setReversingEntry] = useState<any>(null);
  const [vendorCprNumber, setVendorCprNumber] = useState("");

  useEffect(() => {
    fetch("/api/accounts?view=company_settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setCompanySettings(data.settings);
      })
      .catch(() => null);
  }, []);

  // 1. DATA LOADER
  const loadData = useCallback(async () => {
    try {
      if (activeTab === "ledgers") {
        const res = await fetch("/api/accounts?view=parties");
        const data = await res.json();
        if (data.success) {
          setPartiesData({
            customers: data.customers || [],
            technicians: data.technicians || [],
            vendors: data.vendors || [],
          });
        }
      } else if (activeTab === "expenses") {
        const res = await fetch("/api/accounts?view=expenses");
        const data = await res.json();
        if (data.expenses) setExpenses(data.expenses);
      } else if (activeTab === "pos") {
        const res = await fetch("/api/accounts?view=pos_sales");
        const data = await res.json();
        if (data.sales) setPosSales(data.sales);
        if (data.stats) setPosStats(data.stats);
      } else if (activeTab === "chart") {
        const res = await fetch("/api/accounts?view=chart");
        const data = await res.json();
        if (data.tree) setCoaTree(data.tree);
        if (data.flat) setCoaFlat(data.flat);
        if (data.rawAccounts) setAccounts(data.rawAccounts);
        else if (Array.isArray(data)) setAccounts(data);
      } else if (activeTab === "cashbook") {
        setCashbookLoading(true);
        const queryParams = new URLSearchParams({
          view: "cashbook",
          accountCode: cashbookFilterAccount,
        });
        if (cashbookPeriod === "today") {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          queryParams.set("from", start.toISOString());
        } else if (cashbookPeriod === "7d") {
          const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          queryParams.set("from", start.toISOString());
        } else if (cashbookPeriod === "month") {
          const start = new Date();
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          queryParams.set("from", start.toISOString());
        }
        const res = await fetch(`/api/accounts?${queryParams.toString()}`);
        const data = await res.json();
        if (data.entries) setCashbookEntries(data.entries);
        if (data.summary) setCashbookSummary(data.summary);
        if (data.cashAccounts) setCashAccounts(data.cashAccounts);
        setCashbookLoading(false);
      } else if (activeTab === "journal") {
        const res = await fetch("/api/accounts?view=journal");
        const data = await res.json();
        if (Array.isArray(data)) setJournalEntries(data);
      }
    } catch (e: any) {
      console.error("Failed to load accounts data", e);
    }
  }, [activeTab, cashbookFilterAccount, cashbookPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization
  useEffect(() => {
    const unsub = realtimeSync.subscribe((event) => {
      if (
        event.type === "DISCOUNT_REQUESTED" ||
        event.type === "DISCOUNT_GRANTED" ||
        event.type === "JOB_UPDATED" ||
        event.type === "INVENTORY_SYNC"
      ) {
        loadData();
      }
    });
    return () => unsub();
  }, [loadData]);

  // Load customer statement
  const handleOpenCustomerStatement = async (cust: any) => {
    setSelectedCustomer(cust);
    setStatementLoading(true);
    try {
      const res = await fetch(`/api/accounts?view=party_ledger&partyType=customer&partyId=${cust.id}`);
      const data = await res.json();
      if (data.statement) {
        setCustomerStatement(data.statement);
      }
    } catch (e) {
      console.error("Customer statement fetch failed", e);
    } finally {
      setStatementLoading(false);
    }
  };

  // Load account general ledger drilldown
  const handleOpenAccountDrilldown = async (acc: any) => {
    setSelectedAccountDrilldown(acc);
    setDrilldownLoading(true);
    try {
      const res = await fetch(`/api/accounts?view=account_drilldown&accountId=${acc.id}`);
      const data = await res.json();
      if (data.lines) {
        setAccountLedgerLines(data.lines);
      }
    } catch (e) {
      console.error("Account drilldown fetch failed", e);
    } finally {
      setDrilldownLoading(false);
    }
  };

  // Load technician specific ledger
  const handleSelectTech = async (techId: string) => {
    setSelectedTechId(techId);
    if (!techId) {
      setDetailedTechEntries([]);
      return;
    }
    try {
      const res = await fetch(`/api/accounts?view=party_ledger&partyType=technician&partyId=${techId}`);
      const data = await res.json();
      if (data.statement) setDetailedTechEntries(data.statement);
    } catch (e) {
      console.error("Tech statement error", e);
    }
  };

  // 2. ACTIONS: APPROVE / REJECT DISCOUNT
  const handleApproveDiscount = async (discount: any, overrideAmount?: number) => {
    try {
      const amountToApprove = overrideAmount !== undefined ? overrideAmount : discount.requestedDiscount;
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_item_discount",
          jobId: discount.jobId,
          itemId: discount.itemId,
          discountAmount: amountToApprove,
          accountantName: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }

      realtimeSync.publish("DISCOUNT_GRANTED", {
        actor: "Fatima Noor (Accountant)",
        message: `Accountant approved $${amountToApprove} discount on Job #${discount.jobNumber}`,
        jobId: discount.jobId,
        payload: {
          itemId: discount.itemId,
          amount: amountToApprove,
        },
      });

      setActionSuccessMsg(`Approved discount of $${amountToApprove} for ${discount.customerName} on Job #${discount.jobNumber}.`);
      setModifyingDiscount(null);
      loadData();
    } catch (e: any) {
      setActionErrorMsg(e.message);
    }
  };

  const handleRejectDiscount = async (discount: any) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_item_discount",
          jobId: discount.jobId,
          itemId: discount.itemId,
          reason: "Discount declined by accounting department",
          accountantName: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rejection failed");
      }

      realtimeSync.publish("JOB_UPDATED", {
        actor: "Fatima Noor (Accountant)",
        jobId: discount.jobId,
        message: `Discount request declined on Job #${discount.jobNumber}`,
      });

      setActionSuccessMsg(`Discount request declined on Job #${discount.jobNumber}.`);
      loadData();
    } catch (e: any) {
      setActionErrorMsg(e.message);
    }
  };

  // 3. ACTION: RECORD CUSTOMER PAYMENT
  const handleRecordCustomerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount || Number(paymentAmount) <= 0) return;

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_customer_payment",
          customerId: selectedCustomer.id,
          amount: Number(paymentAmount),
          paymentMethod,
          notes: paymentNotes || `Customer payment from ${selectedCustomer.name}`,
          actorName: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) throw new Error("Payment recording failed");

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setActionSuccessMsg(`Recorded payment of ${formatCurrency(Number(paymentAmount))} from ${selectedCustomer.name}.`);
      handleOpenCustomerStatement(selectedCustomer);
      loadData();
    } catch (err: any) {
      setActionErrorMsg(err.message);
    }
  };

  // 4. ACTION: GIVE CASH ADVANCE TO TECH
  const handleGiveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId || !advanceAmount || Number(advanceAmount) <= 0) return;

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "give_tech_advance",
          technicianId: selectedTechId,
          amount: Number(advanceAmount),
          notes: advanceNotes || "Cash advance float disbursed by accountant",
          actorName: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) throw new Error("Cash advance disbursement failed");

      setShowAdvanceModal(false);
      setAdvanceAmount("");
      setAdvanceNotes("");
      setActionSuccessMsg(`Disbursed cash advance of ${formatCurrency(Number(advanceAmount))} to technician.`);
      handleSelectTech(selectedTechId);
      loadData();
    } catch (err: any) {
      setActionErrorMsg(err.message);
    }
  };

  // 5. ACTION: RECORD VENDOR PAYMENT WITH CUSTOM WHT & CPR LOGGING
  const handleRecordVendorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !vendorPayAmount || Number(vendorPayAmount) <= 0) return;

    try {
      const isDbVendor = Boolean(selectedVendor.id);
      const actionName = isDbVendor ? "vendor_payment" : "record_vendor_payment";
      const payload: any = {
        action: actionName,
        vendorName: selectedVendor.name,
        memo: vendorPayMemo || `Supplier payment to ${selectedVendor.name}`,
        actorName: "Fatima Noor (Accountant)",
      };

      if (isDbVendor) {
        payload.vendorId = selectedVendor.id;
        payload.grossAmount = Number(vendorPayAmount);
        payload.paymentAccountCode = "1000";
        payload.cprNumber = vendorCprNumber || undefined;
      } else {
        payload.amount = Number(vendorPayAmount);
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Vendor payment failed");
      }

      const result = await res.json();
      setShowVendorPayModal(false);
      setVendorPayAmount("");
      setVendorPayMemo("");
      setVendorCprNumber("");

      const whtInfo = result.taxCalculation
        ? ` (Net disbursed: ${formatCurrency(result.taxCalculation.netPayable)}, WHT: ${formatCurrency(result.taxCalculation.whtAmount)})`
        : "";
      setActionSuccessMsg(
        `Disbursed supplier payment of ${formatCurrency(Number(vendorPayAmount))} to ${selectedVendor.name}${whtInfo}.`
      );
      loadData();
    } catch (err: any) {
      setActionErrorMsg(err.message);
    }
  };

  // 6. ACTION: ADD GENERAL EXPENSE
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseAmount || Number(newExpenseAmount) <= 0) return;

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_expense",
          payeeType: newExpenseType,
          payeeName: newExpensePayee || (newExpenseType === "technician" ? "Technician Field Claim" : "Operations"),
          technicianId: newExpenseType === "technician" ? newExpenseTechId : undefined,
          expenseAccountCode: newExpenseAccount,
          disbursingAccountCode: newExpenseDisbursing,
          amount: Number(newExpenseAmount),
          memo: newExpenseMemo || "Operating business expense",
          receiptRef: newExpenseRef || undefined,
          actorName: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) throw new Error("Expense posting failed");

      setShowAddExpenseModal(false);
      setNewExpenseAmount("");
      setNewExpenseMemo("");
      setNewExpenseRef("");
      setNewExpensePayee("");
      setActionSuccessMsg(`Expense voucher recorded and posted to General Ledger.`);
      loadData();
    } catch (err: any) {
      setActionErrorMsg(err.message);
    }
  };

  // 7. ACTION: MANUAL BALANCED JOURNAL ENTRY
  const handlePostManualJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebit = manualLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = manualLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      alert(`Journal entry is unbalanced! Total Debit: ${formatCurrency(totalDebit)} vs Total Credit: ${formatCurrency(totalCredit)}`);
      return;
    }

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_journal_entry",
          memo: manualMemo || "Manual General Journal Adjustment",
          lines: manualLines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0)),
          actorName: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Posting failed");
      }

      setShowManualJournalModal(false);
      setManualMemo("");
      setManualLines([
        { accountId: "", debit: "", credit: "" },
        { accountId: "", debit: "", credit: "" },
      ]);
      setActionSuccessMsg("Manual balanced journal entry posted successfully to General Ledger.");
      loadData();
    } catch (err: any) {
      setActionErrorMsg(err.message);
    }
  };

  // Settlement Handlers
  const handleStorekeeperAcknowledge = async (stockReturnId: string) => {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge_return",
          stockReturnId,
          storeKeeperName: "Bilal Sheikh (Storekeeper)",
        }),
      });
      if (!res.ok) throw new Error("Failed to acknowledge stock return");

      if (settlementJob) {
        const updatedReturns = settlementJob.stockReturns?.map((sr: any) =>
          sr.id === stockReturnId
            ? { ...sr, acknowledgedAt: new Date().toISOString(), acknowledgedBy: "Bilal Sheikh (Storekeeper)" }
            : sr
        );
        setSettlementJob({ ...settlementJob, stockReturns: updatedReturns });
      }
      setActionSuccessMsg("Stock return acknowledged by Storekeeper Bilal Sheikh. Settlement clearance unlocked.");
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenSettlement = (job: any) => {
    setSettlementJob(job);
    let expected = 0;
    for (const item of job.items || []) {
      const qty = item.quantityActual ?? item.quantityPlanned;
      expected += qty * item.unitRate;
    }
    const finalExpected = Math.max(0, expected - (job.discountAmount || 0));

    if (job.remarks?.toLowerCase().includes("unmarked")) {
      setAmountCollected("0");
      setCustomerPaymentMeans("unmarked");
    } else if (job.remarks?.toLowerCase().includes("online")) {
      setAmountCollected(String(finalExpected));
      setCustomerPaymentMeans("online");
    } else {
      setAmountCollected(String(finalExpected));
      setCustomerPaymentMeans("cash");
    }

    if (job.expenseClaims) {
      setSelectedPaidExpenses(job.expenseClaims.map((c: any) => c.id));
    } else {
      setSelectedPaidExpenses([]);
    }

    setAdhocExpenses([]);
    setNewAdhocAmount("");
    setNewAdhocNote("");
    setDisbursingAccountCode("1000");
    setIsPartialPayoutEnabled(false);
    setSyncAndLockJob(true);

    const initialTotalExpenses = (job.expenseClaims || []).reduce((s: number, c: any) => s + c.amount, 0);
    setPartialPayoutAmount(String(initialTotalExpenses));
  };

  const handleAddAdhocExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdhocAmount || Number(newAdhocAmount) <= 0) return;
    setAdhocExpenses([
      ...adhocExpenses,
      {
        amount: Number(newAdhocAmount),
        note: newAdhocNote || "Ad-hoc field expense reported verbally to accountant",
      },
    ]);
    setNewAdhocAmount("");
    setNewAdhocNote("");
  };

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementJob) return;

    try {
      setIsSubmittingSettlement(true);
      let expected = 0;
      for (const item of settlementJob.items || []) {
        const qty = item.quantityActual ?? item.quantityPlanned;
        expected += qty * item.unitRate;
      }
      const finalExpected = Math.max(0, expected - (settlementJob.discountAmount || 0));

      const pendingClaimIds = (settlementJob.expenseClaims || [])
        .filter((c: any) => !selectedPaidExpenses.includes(c.id))
        .map((c: any) => c.id);

      const res = await fetch("/api/hisaab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: settlementJob.id,
          technicianId: settlementJob.assignedTechnicianId,
          amountExpected: finalExpected,
          amountCollected: customerPaymentMeans === "unmarked" ? 0 : Number(amountCollected) || 0,
          paymentMeans: customerPaymentMeans,
          nextVisitDate: nextVisitDate || null,
          paidExpenseClaimIds: selectedPaidExpenses,
          pendingExpenseClaimIds: pendingClaimIds,
          disbursingAccountCode,
          partialPayoutAmount: isPartialPayoutEnabled ? Number(partialPayoutAmount) : undefined,
          adhocExpenses,
          finalizeAndLock: syncAndLockJob,
          settledBy: "Fatima Noor (Accountant)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setActionSuccessMsg(
        `Settlement clearance recorded successfully for Job ${settlementJob.jobNumber}.${
          syncAndLockJob ? " Work order synced and locked in read-only mode with official invoice generated." : ""
        }`
      );
      setSettlementJob(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  // Record Cashbook Transaction (Receipt, Payment, Transfer)
  const handleRecordCashTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashFormAmount || Number(cashFormAmount) <= 0) {
      alert("Please enter a valid positive transaction amount");
      return;
    }
    try {
      setCashFormSubmitting(true);
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_cash_transaction",
          transactionType: cashFormType,
          cashAccountCode: cashFormAccount,
          contraAccountCode: cashFormContra,
          transferToAccountCode: cashFormTransferTo,
          amount: Number(cashFormAmount),
          memo: cashFormMemo,
          partyName: cashFormParty,
          actorName: "Fatima Noor (Accountant)",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record cash transaction");

      setActionSuccessMsg(
        `Successfully recorded Cashbook ${cashFormType.toUpperCase()} of ${formatCurrency(
          Number(cashFormAmount)
        )}`
      );
      setShowRecordCashModal(false);
      setCashFormAmount("");
      setCashFormMemo("");
      setCashFormParty("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCashFormSubmitting(false);
    }
  };

  // Tree View Expand/Collapse Handlers
  const toggleTreeNode = (code: string) => {
    setExpandedTreeNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const expandAllTreeNodes = () => {
    const allCodes = new Set<string>();
    coaFlat.forEach((n) => allCodes.add(n.code));
    setExpandedTreeNodes(allCodes);
  };

  const collapseAllTreeNodes = () => {
    setExpandedTreeNodes(new Set());
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Finance & Accounts" }]}
        title="Accountant Workstation & Financial Suite"
        subtitle="Complete GAAP double-entry ledger, multi-party statements (AR/AP/Hisaab), cash book, and financial statements"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Double-Entry Balanced
          </span>
        }
      />

      {/* Enterprise Onboarding Banner */}
      {companySettings && !companySettings.isSetupCompleted && (
        <div className="p-4 bg-gradient-to-r from-emerald-950 via-teal-950 to-zinc-900 text-white rounded-2xl shadow-lg border border-emerald-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                Enterprise SAP-FICO Accounting Onboarding Incomplete
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Step-by-Step Guided Setup
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Configure legal tenant profile, FBR tax credentials (NTN/STRN), fiscal periods, and 4-Level Chart of Accounts opening balances (offset to 3900 Opening Balance Equity).
              </p>
            </div>
          </div>
          <Link
            href="/setup"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition shadow-sm shrink-0"
          >
            Launch Setup Wizard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {actionSuccessMsg}
          </span>
          <button onClick={() => setActionSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {actionErrorMsg}
          </span>
          <button onClick={() => setActionErrorMsg("")} className="text-rose-700 hover:text-rose-900 font-bold">
            ✕
          </button>
        </div>
      )}


      {/* ========================================================================= */}
      {/* TAB 1: PENDING TECHNICIAN DISCOUNT APPROVALS QUEUE */}
      {/* ========================================================================= */}
      {(activeTab as string) === "discounts" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3">
            <Percent className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950">
              <p className="font-bold text-sm">Technician On-Site Discount Requests Queue</p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                When technicians in the field negotiate price concessions with clients and tap <strong>"Ask Discount"</strong> on their mobile app, requests queue here.
                Approving automatically reduces the line item rate, updates the job invoice, posts to the audit log, and pushes a real-time notification to the technician's phone.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Pending Discount Requests
                </h3>
                <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {pendingDiscounts.length} Pending
                </span>
              </div>
              <button
                onClick={loadData}
                className="text-xs text-[#0D7A5F] hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {pendingDiscounts.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-sm text-[#18181B]">No pending discount requests</p>
                <p className="text-[#71717A] mt-1">All field pricing is currently approved and aligned with standard price lists.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Job & Customer</th>
                      <th className="py-2.5 px-4">Technician</th>
                      <th className="py-2.5 px-4">Line Item Scope</th>
                      <th className="py-2.5 px-4 text-right">Current Rate</th>
                      <th className="py-2.5 px-4 text-right">Discount Requested</th>
                      <th className="py-2.5 px-4 text-right">Proposed Rate</th>
                      <th className="py-2.5 px-4">Reason / Notes</th>
                      <th className="py-2.5 px-4 text-right">Decisions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {pendingDiscounts.map((disc, idx) => (
                      <tr key={idx} className="hover:bg-[#FAFAFA] transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#0D7A5F] block">
                            {disc.jobNumber}
                          </span>
                          <span className="font-medium text-[#18181B] block">
                            {disc.customerName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#18181B] block">{disc.technicianName}</span>
                          <span className="text-[10px] text-[#71717A] font-mono">{disc.technicianPhone}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-[#18181B]">{disc.itemDescription}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#71717A]">
                          {formatCurrency(disc.currentRate)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            -{formatCurrency(disc.requestedDiscount)} ({disc.discountPercent}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#0D7A5F]">
                          {formatCurrency(disc.proposedRate)}
                        </td>
                        <td className="py-3 px-4 text-[#52525B] max-w-xs">
                          <span className="italic">"{disc.reason}"</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveDiscount(disc)}
                              className="px-2.5 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition shadow-xs"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModifyingDiscount(disc);
                                setModifiedDiscountAmount(String(disc.requestedDiscount));
                              }}
                              className="px-2 py-1.5 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg font-bold text-[11px] transition"
                            >
                              Counter
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectDiscount(disc)}
                              className="px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold text-[11px] transition"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PARTY LEDGERS (Customers, Technicians, Vendors) */}
      {/* ========================================================================= */}
      {activeTab === "ledgers" && (
        <div className="space-y-5">
          {/* Party Sub-Navigation */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex p-1 bg-[#F4F4F5] rounded-xl border border-[#E4E4E7]">
              <button
                onClick={() => setPartySubTab("customers")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  partySubTab === "customers"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Customers (Receivables / AR)
              </button>
              <button
                onClick={() => setPartySubTab("technicians")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  partySubTab === "technicians"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Technicians (Hisaab Netted)
              </button>
              <button
                onClick={() => setPartySubTab("vendors")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  partySubTab === "vendors"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Vendors & Suppliers (Payables / AP)
              </button>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search party by name or phone..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="w-full bg-white pl-8 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs focus:ring-1 focus:ring-[#0D7A5F] focus:outline-none"
              />
            </div>
          </div>

          {/* SUB-VIEW A: CUSTOMER RECEIVABLES */}
          {partySubTab === "customers" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Customer Statements of Account (Accounts Receivable)
                  </h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Live balance due from clients for HVAC work orders and preventive maintenance agreements.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Customer Name</th>
                      <th className="py-2.5 px-4">Phone / Contact</th>
                      <th className="py-2.5 px-4 text-right">Total Invoiced</th>
                      <th className="py-2.5 px-4 text-right">Total Paid</th>
                      <th className="py-2.5 px-4 text-right">Outstanding Balance</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Statement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {partiesData.customers
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(partySearch.toLowerCase()) ||
                          c.phone.includes(partySearch)
                      )
                      .map((cust) => (
                        <tr key={cust.id} className="hover:bg-[#FAFAFA] transition">
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#18181B] block">{cust.name}</span>
                            <span className="text-[10px] text-[#71717A]">{cust.address}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#52525B]">{cust.phone}</td>
                          <td className="py-3 px-4 text-right font-mono text-[#71717A]">
                            {formatCurrency(cust.totalBilled)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700">
                            {formatCurrency(cust.totalPaid)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                                cust.balanceDue > 0
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {formatCurrency(cust.balanceDue)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {cust.balanceDue > 0 ? (
                              <span className="text-amber-700 font-bold text-[11px]">Due</span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px]">Paid Up</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenCustomerStatement(cust)}
                              className="px-3 py-1.5 bg-[#18181B] hover:bg-black text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                            >
                              <FileText className="w-3 h-3" /> View Statement
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW B: TECHNICIAN HISAAB */}
          {partySubTab === "technicians" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Technician Running Hisaab Balances
                    </h3>
                    <p className="text-[11px] text-[#71717A] mt-0.5">
                      Single netted balance: Advances (+ owed to co.) balanced against verified expenses (- co. owes tech).
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                        <th className="py-2.5 px-4">Technician</th>
                        <th className="py-2.5 px-4">Phone</th>
                        <th className="py-2.5 px-4 text-right">Total Advances</th>
                        <th className="py-2.5 px-4 text-right">Expenses Pending</th>
                        <th className="py-2.5 px-4 text-right">Netted Running Balance</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Hisaab Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E4E7]">
                      {partiesData.technicians
                        .filter((t) => t.name.toLowerCase().includes(partySearch.toLowerCase()))
                        .map((tech) => {
                          const isSelected = selectedTechId === tech.id;
                          return (
                            <tr
                              key={tech.id}
                              onClick={() => handleSelectTech(isSelected ? "" : tech.id)}
                              className={`cursor-pointer transition ${
                                isSelected ? "bg-emerald-50/50" : "hover:bg-[#FAFAFA]"
                              }`}
                            >
                              <td className="py-3 px-4">
                                <span className="font-bold text-[#18181B] block">{tech.name}</span>
                                <span className="text-[10px] text-[#71717A]">{tech.email}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[#52525B]">{tech.phone}</td>
                              <td className="py-3 px-4 text-right font-mono text-[#71717A]">
                                {formatCurrency(tech.totalAdvances)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-[#71717A]">
                                {formatCurrency(tech.totalExpensesOwed)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                                    tech.netBalance > 0
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : tech.netBalance < 0
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7]"
                                  }`}
                                >
                                  {formatCurrency(Math.abs(tech.netBalance))}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center text-[11px] font-semibold">
                                {tech.netBalance > 0 ? (
                                  <span className="text-rose-600">Owes Co.</span>
                                ) : tech.netBalance < 0 ? (
                                  <span className="text-emerald-600">Co. Owes Tech</span>
                                ) : (
                                  <span className="text-[#71717A]">Settled Clean</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTechId(tech.id);
                                      setShowAdvanceModal(true);
                                    }}
                                    className="px-2 py-1 bg-[#F4F4F5] hover:bg-[#E4E4E7] rounded text-[11px] font-bold text-[#18181B] transition"
                                  >
                                    + Advance
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDrawerTechId(tech.id);
                                      setShowExpenseDrawer(true);
                                    }}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded text-[11px] font-bold text-[#0D7A5F] transition"
                                  >
                                    + Expense
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Technician Detailed Hisaab Drawer */}
              {selectedTechId && (
                <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Individual Transaction Ledger for Selected Technician
                    </h3>
                    <button
                      onClick={() => setSelectedTechId("")}
                      className="text-xs font-bold text-[#0D7A5F] hover:underline"
                    >
                      Close Ledger View
                    </button>
                  </div>

                  {detailedTechEntries.length === 0 ? (
                    <p className="text-xs text-[#71717A] py-4 text-center">No ledger entries recorded.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Entry Type</th>
                            <th className="py-2 px-3">Notes & Reference</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E7]">
                          {detailedTechEntries.map((e) => (
                            <tr key={e.id} className="hover:bg-[#FAFAFA]">
                              <td className="py-2 px-3 text-[#71717A] font-mono text-[11px]">
                                {formatDateTime(e.date)}
                              </td>
                              <td className="py-2 px-3 capitalize font-bold text-[#18181B]">
                                {e.type.replace("_", " ")}
                              </td>
                              <td className="py-2 px-3 text-[#52525B]">{e.notes || "—"}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                <span className={e.isAdvance ? "text-rose-600" : "text-emerald-600"}>
                                  {e.isAdvance ? "+" : "-"}
                                  {formatCurrency(e.amount)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW C: VENDOR PAYABLES */}
          {partySubTab === "vendors" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Vendor & Supplier Ledgers (Accounts Payable)
                  </h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Spare parts suppliers, refrigerant distributors, and equipment wholesalers.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Supplier / Vendor</th>
                      <th className="py-2.5 px-4 text-right">Total Purchases</th>
                      <th className="py-2.5 px-4 text-right">Total Disbursed</th>
                      <th className="py-2.5 px-4 text-right">Balance Payable</th>
                      <th className="py-2.5 px-4 text-center">Orders</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {partiesData.vendors
                      .filter((v) => v.name.toLowerCase().includes(partySearch.toLowerCase()))
                      .map((vnd, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAFA] transition">
                          <td className="py-3 px-4 font-bold text-[#18181B]">{vnd.name}</td>
                          <td className="py-3 px-4 text-right font-mono text-[#71717A]">
                            {formatCurrency(vnd.totalPurchases)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700">
                            {formatCurrency(vnd.totalPaid)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                                vnd.balanceDue > 0
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {formatCurrency(vnd.balanceDue)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs">{vnd.ordersCount} POs</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVendor(vnd);
                                setVendorPayAmount(String(vnd.balanceDue));
                                setShowVendorPayModal(true);
                              }}
                              className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1"
                            >
                              <DollarSign className="w-3 h-3" /> Disburse Payment
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FIELD SETTLEMENTS & CLEARANCE QUEUE */}
      {/* ========================================================================= */}
      {(activeTab as string) === "settlements" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Pending Expense & Field Clearance Queue
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Completed work orders awaiting cash reconciliation, customer payment verification, and field expense clearances.
                </p>
              </div>
            </div>

            {pendingSettlements.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No jobs pending settlement. All customer payments and field expenses are fully cleared.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Job Number</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Technician</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Expected Revenue</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {pendingSettlements.map((job) => {
                      let expected = 0;
                      for (const item of job.items || []) {
                        const qty = item.quantityActual ?? item.quantityPlanned;
                        expected += qty * item.unitRate;
                      }
                      const net = Math.max(0, expected - (job.discountAmount || 0));

                      return (
                        <tr key={job.id} className="hover:bg-[#FAFAFA] transition">
                          <td className="py-3 px-4 font-mono font-bold text-[#0D7A5F]">{job.jobNumber}</td>
                          <td className="py-3 px-4 font-medium text-[#18181B]">{job.customer?.name}</td>
                          <td className="py-3 px-4 text-[#52525B]">{job.assignedTechnician?.name || "Unassigned"}</td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={job.status} />
                            {job.stockReturns?.some((sr: any) => !sr.acknowledgedAt) && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Unreturned Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#18181B]">
                            {formatCurrency(net)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenSettlement(job)}
                              className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              Open Clearance Session
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXPENSES & OUTFLOWS */}
      {/* ========================================================================= */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">Company & Field Expenses Register</h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Every operating expense, tool purchase, vehicle fuel, and technician field reimbursement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" /> + Add Expense Voucher
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Voucher / JV #</th>
                    <th className="py-2.5 px-4">Payee / Entity</th>
                    <th className="py-2.5 px-4">Account & Category</th>
                    <th className="py-2.5 px-4">Description / Notes</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#71717A]">
                        No expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[#FAFAFA] transition">
                        <td className="py-3 px-4 font-mono text-[#71717A] text-[11px]">
                          {formatDateTime(exp.date)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#18181B]">{exp.voucherNumber}</td>
                        <td className="py-3 px-4 font-medium text-[#18181B]">{exp.payee}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#18181B] block">{exp.category}</span>
                          <span className="text-[10px] text-[#71717A] font-mono">Code {exp.accountCode}</span>
                        </td>
                        <td className="py-3 px-4 text-[#52525B] max-w-xs">{exp.notes || "—"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {exp.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: POINT OF SALE (POS) SALES REGISTER */}
      {/* ========================================================================= */}
      {activeTab === "pos" && (
        <div className="space-y-4">
          {/* POS Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-xs font-semibold text-[#71717A] block">Total POS Revenue</span>
              <span className="text-xl font-bold font-mono text-[#0D7A5F] block mt-1">
                {formatCurrency(posStats.totalRevenue)}
              </span>
              <span className="text-[10px] text-[#71717A]">{posStats.totalCount} counter transactions</span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-xs font-semibold text-[#71717A] block">Cash on Hand Collected</span>
              <span className="text-xl font-bold font-mono text-[#18181B] block mt-1">
                {formatCurrency(posStats.cashSales)}
              </span>
              <span className="text-[10px] text-emerald-700">Debited to Account 1000</span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-xs font-semibold text-[#71717A] block">POS Card / Bank Receipts</span>
              <span className="text-xl font-bold font-mono text-[#18181B] block mt-1">
                {formatCurrency(posStats.cardSales)}
              </span>
              <span className="text-[10px] text-emerald-700">Debited to Operating Bank</span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#E4E4E7] shadow-xs">
              <span className="text-xs font-semibold text-[#71717A] block">Automatic Postings</span>
              <span className="text-xl font-bold text-emerald-700 flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-5 h-5" /> 100% Synced
              </span>
              <span className="text-[10px] text-[#71717A]">Auto COGS & Inventory offset</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#0D7A5F]" />
                  Over-the-Counter POS Sales Register & Terminal
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Full-featured countertop point of sale with barcode scanning, cash drawer shift sessions, and thermal receipts.
                </p>
              </div>

              <a
                href="/pos"
                className="px-4 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-2 self-start sm:self-auto"
              >
                <ShoppingBag className="w-4 h-4" />
                Launch Full POS Terminal
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">Receipt #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Items Sold</th>
                    <th className="py-2.5 px-4 text-center">Payment Method</th>
                    <th className="py-2.5 px-4 text-right">Total Amount</th>
                    <th className="py-2.5 px-4 text-center">Journal Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {posSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#71717A]">
                        No POS counter sales logged yet.
                      </td>
                    </tr>
                  ) : (
                    posSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-[#FAFAFA] transition">
                        <td className="py-3 px-4 font-mono font-bold text-[#0D7A5F]">{sale.saleNumber}</td>
                        <td className="py-3 px-4 font-mono text-[#71717A] text-[11px]">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {sale.items?.map((it: any, i: number) => (
                              <div key={i} className="text-[11px]">
                                <span className="font-semibold text-[#18181B]">
                                  {it.quantity}x {it.product?.name}
                                </span>{" "}
                                <span className="text-[#71717A]">@ {formatCurrency(it.unitPrice)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7]">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#18181B]">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ✓ Balanced Posted
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 5.5: CASHBOOK (CASH & BANK BOOK) */}
      {/* ========================================================================= */}
      {activeTab === "cashbook" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Cashbook Header & Controls */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E4E7]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Cash & Bank Book Register
                    </h3>
                    <p className="text-[11px] text-[#71717A]">
                      Real-time chronological record of all cash collections, bank receipts, field disbursements, and running liquidity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCashFormType("receipt");
                    setShowRecordCashModal(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] border border-emerald-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
                  + Cash Receipt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashFormType("payment");
                    setShowRecordCashModal(true);
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />
                  + Cash Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashFormType("transfer");
                    setShowRecordCashModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] border border-[#D4D4D8] rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-[#52525B]" />
                  Transfer
                </button>
              </div>
            </div>

            {/* Cashbook Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                  Total Cash Inflows (Receipts)
                </span>
                <span className="font-mono text-base font-extrabold text-[#0D7A5F] block mt-1">
                  +{formatCurrency(cashbookSummary.totalReceipts)}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-0.5">Collections & Counter Sales</span>
              </div>

              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED]">
                <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                  Total Cash Outflows (Payments)
                </span>
                <span className="font-mono text-base font-extrabold text-rose-700 block mt-1">
                  -{formatCurrency(cashbookSummary.totalPayments)}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-0.5">Expenses & Vendor Payouts</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-[#065F46] tracking-wider block">
                  Net Closing Cash on Hand
                </span>
                <span className="font-mono text-base font-extrabold text-[#0D7A5F] block mt-1">
                  {formatCurrency(cashbookSummary.netClosingBalance)}
                </span>
                <span className="text-[10px] text-[#065F46] block mt-0.5 font-medium">Reconciled Ledger Balance</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#EDEDED]">
                <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider block">
                  Active Vouchers Logged
                </span>
                <span className="font-mono text-base font-extrabold text-[#18181B] block mt-1">
                  {cashbookSummary.totalTransactions || cashbookEntries.length}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-0.5">Double-entry cash postings</span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Account Filter */}
                <select
                  value={cashbookFilterAccount}
                  onChange={(e) => setCashbookFilterAccount(e.target.value)}
                  className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#18181B] focus:bg-white focus:outline-none"
                >
                  <option value="ALL">All Cash & Bank Accounts</option>
                  {cashAccounts.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} — {acc.name}
                    </option>
                  ))}
                </select>

                {/* Period Chips */}
                <div className="inline-flex rounded-lg border border-[#EDEDED] p-0.5 bg-[#F4F4F5]">
                  {(["all", "today", "7d", "month"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCashbookPeriod(p)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition",
                        cashbookPeriod === p
                          ? "bg-white text-[#18181B] shadow-2xs"
                          : "text-[#71717A] hover:text-[#18181B]"
                      )}
                    >
                      {p === "7d" ? "7 Days" : p === "month" ? "This Month" : p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  placeholder="Search voucher, memo, contra..."
                  value={cashbookSearch}
                  onChange={(e) => setCashbookSearch(e.target.value)}
                  className="w-full bg-[#F4F4F5] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* Cashbook Ledger Table */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[10px] font-bold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-3">Voucher Ref</th>
                    <th className="py-2.5 px-3">Cash/Bank A/C</th>
                    <th className="py-2.5 px-4">Particulars / Contra Account & Narration</th>
                    <th className="py-2.5 px-4 text-right">Receipt (Dr +)</th>
                    <th className="py-2.5 px-4 text-right">Payment (Cr -)</th>
                    <th className="py-2.5 px-4 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {cashbookLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#71717A]">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
                          Loading Cashbook entries...
                        </div>
                      </td>
                    </tr>
                  ) : cashbookEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#71717A]">
                        No cash transactions recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    cashbookEntries
                      .filter((entry) => {
                        if (!cashbookSearch.trim()) return true;
                        const query = cashbookSearch.toLowerCase().trim();
                        return (
                          entry.voucherRef?.toLowerCase().includes(query) ||
                          entry.memo?.toLowerCase().includes(query) ||
                          entry.contraAccount?.toLowerCase().includes(query) ||
                          entry.cashAccount?.name?.toLowerCase().includes(query)
                        );
                      })
                      .map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#F9FAFB] transition">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-[#52525B]">
                            {formatDateTime(entry.date)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-[10px] bg-[#F4F4F5] px-1.5 py-0.5 rounded border border-[#EDEDED] text-[#18181B]">
                              {entry.voucherRef}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-xs font-semibold text-[#18181B] block">
                              {entry.cashAccount?.code}
                            </span>
                            <span className="text-[10px] text-[#71717A] block truncate max-w-[140px]">
                              {entry.cashAccount?.name}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <p className="font-medium text-[#18181B] text-xs">
                              {entry.memo}
                            </p>
                            <p className="text-[10px] text-[#71717A] mt-0.5 font-mono">
                              Contra: {entry.contraAccount}
                            </p>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            {entry.receiptAmount > 0 ? (
                              <span className="text-[#0D7A5F]">
                                +{formatCurrency(entry.receiptAmount)}
                              </span>
                            ) : (
                              <span className="text-[#D4D4D8]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            {entry.paymentAmount > 0 ? (
                              <span className="text-rose-700">
                                -{formatCurrency(entry.paymentAmount)}
                              </span>
                            ) : (
                              <span className="text-[#D4D4D8]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                            {formatCurrency(entry.runningBalance)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CHART OF ACCOUNTS (COA) — LEVEL 1 TO LEVEL 4 (TREE & TABULAR)      */}
      {/* ========================================================================= */}
      {activeTab === "chart" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header & View Mode Switcher */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E4E4E7]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Chart of Accounts (COA) — 4-Level Accounting Hierarchy
                    </h3>
                    <p className="text-[11px] text-[#71717A]">
                      Tree-like hierarchy from broad financial elements down to granular Level 4 posting ledgers with automated reporting roll-up.
                    </p>
                  </div>
                </div>
              </div>

              {/* View Switcher & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-[#EDEDED] p-1 bg-[#F4F4F5]">
                  <button
                    type="button"
                    onClick={() => setCoaViewMode("tree")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                      coaViewMode === "tree"
                        ? "bg-white text-[#0D7A5F] shadow-xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    Tree View
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoaViewMode("table")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                      coaViewMode === "table"
                        ? "bg-white text-[#0D7A5F] shadow-xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    Tabular View
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountToEdit(null);
                      setCoaModalMode("create");
                      setShowCoaModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoaModalMode("import");
                      setShowCoaModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EDEDED] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCoaCsv}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EDEDED] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* 4-Level Architecture Explainer Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                <div className="flex items-center justify-between font-bold text-blue-950 mb-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Level 1 (Category)
                  </span>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-200/80 text-blue-900">
                    Header
                  </span>
                </div>
                <p className="text-[11px] text-blue-900 leading-snug">
                  Main elements: Assets, Liabilities, Equity, Revenue, Expenses. Summary roll-up container.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
                <div className="flex items-center justify-between font-bold text-purple-950 mb-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Level 2 (Type)
                  </span>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-200/80 text-purple-900">
                    Sub-Group
                  </span>
                </div>
                <p className="text-[11px] text-purple-900 leading-snug">
                  Sub-groupings: Current Assets vs Fixed Assets, Operating Expenses vs Field Fleet.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                <div className="flex items-center justify-between font-bold text-amber-950 mb-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    Level 3 (Sub-Type)
                  </span>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900">
                    Parent Group
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-snug">
                  Specific control parent: Bank Accounts, Trade Receivables, Utilities & Office Costs.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs shadow-2xs">
                <div className="flex items-center justify-between font-bold text-emerald-950 mb-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Level 4 (Transactional)
                  </span>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-200 text-[#065F46] font-bold">
                    ✓ Posting Ready
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-snug font-medium">
                  Active ledgers (Printer Ink, Meezan Bank, Drawer). Real-time double-entry posting target.
                </p>
              </div>
            </div>

            {/* Tree View Controls */}
            {coaViewMode === "tree" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAllTreeNodes}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg transition"
                  >
                    + Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllTreeNodes}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg transition"
                  >
                    - Collapse All
                  </button>

                  <div className="hidden lg:flex items-center gap-2 ml-3 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                      L1 · Category
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                      L2 · Type
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      L3 · Sub-Type / Parent
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                      L4 · Transactional (Posting Ready)
                    </span>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="text"
                    placeholder="Search accounts in tree..."
                    value={coaSearch}
                    onChange={(e) => setCoaSearch(e.target.value)}
                    className="w-full bg-[#F4F4F5] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium"
                  />
                </div>
              </div>
            ) : (
              /* Tabular View Controls */
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Level Filter */}
                  <select
                    value={coaLevelFilter}
                    onChange={(e) => setCoaLevelFilter(e.target.value as any)}
                    className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#18181B] focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Hierarchy Levels (L1-L4)</option>
                    <option value="1">Level 1: Main Heads</option>
                    <option value="2">Level 2: Groups</option>
                    <option value="3">Level 3: Control Accounts</option>
                    <option value="4">Level 4: Posting Ledgers</option>
                  </select>

                  {/* Classification Filter */}
                  <select
                    value={coaTypeFilter}
                    onChange={(e) => setCoaTypeFilter(e.target.value)}
                    className="bg-[#F4F4F5] border border-[#EDEDED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#18181B] focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Classifications</option>
                    <option value="asset">Assets</option>
                    <option value="liability">Liabilities</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expenses</option>
                    <option value="contra_revenue">Contra-Revenue</option>
                  </select>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="text"
                    placeholder="Search code or account title..."
                    value={coaSearch}
                    onChange={(e) => setCoaSearch(e.target.value)}
                    className="w-full bg-[#F4F4F5] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* VIEW MODE 1: TREE VIEW */}
          {coaViewMode === "tree" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-[#F4F4F5] border-b border-[#E4E4E7] flex items-center justify-between text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                <span>Account Hierarchy & Code</span>
                <span>Rolled-up Balance & Actions</span>
              </div>

              <div className="divide-y divide-[#EDEDED]">
                {coaTree.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[#71717A]">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
                      Building Chart of Accounts hierarchy...
                    </div>
                  </div>
                ) : (
                  coaTree.map((rootNode) => {
                    const renderNode = (node: any): React.ReactNode => {
                      const isExpanded = expandedTreeNodes.has(node.code);
                      const hasChildren = node.children && node.children.length > 0;

                      const matchesSearch =
                        !coaSearch.trim() ||
                        node.code.toLowerCase().includes(coaSearch.toLowerCase().trim()) ||
                        node.name.toLowerCase().includes(coaSearch.toLowerCase().trim());

                      const hasMatchingDescendant = (n: any): boolean => {
                        if (!coaSearch.trim()) return true;
                        if (
                          n.code.toLowerCase().includes(coaSearch.toLowerCase().trim()) ||
                          n.name.toLowerCase().includes(coaSearch.toLowerCase().trim())
                        ) {
                          return true;
                        }
                        return n.children?.some((c: any) => hasMatchingDescendant(c)) || false;
                      };

                      if (!hasMatchingDescendant(node)) return null;

                      const levelColors: Record<number, { bg: string; border: string; badge: string; label: string }> = {
                        1: {
                          bg: "bg-[#F4F4F5] font-bold text-[#18181B]",
                          border: "border-l-4 border-l-blue-600",
                          badge: "bg-blue-100 text-blue-900 border-blue-200",
                          label: "L1 · Category",
                        },
                        2: {
                          bg: "bg-[#FAFAFA] font-semibold text-[#27272A]",
                          border: "border-l-4 border-l-purple-500",
                          badge: "bg-purple-100 text-purple-900 border-purple-200",
                          label: "L2 · Type",
                        },
                        3: {
                          bg: "bg-white font-medium text-[#3F3F46]",
                          border: "border-l-4 border-l-amber-500",
                          badge: "bg-amber-100 text-amber-900 border-amber-200",
                          label: "L3 · Sub-Type / Parent",
                        },
                        4: {
                          bg: "bg-[#F9FAFB]/60 hover:bg-emerald-50/50 text-[#18181B]",
                          border: "border-l-4 border-l-emerald-600",
                          badge: "bg-emerald-100 text-emerald-900 border-emerald-200 font-bold",
                          label: "L4 · Transactional (Data-Entry Ready)",
                        },
                      };

                      const style = levelColors[node.level] || levelColors[4];
                      const indentPadding =
                        node.level === 1 ? "pl-3" : node.level === 2 ? "pl-8" : node.level === 3 ? "pl-14" : "pl-20";

                      return (
                        <div key={node.code} className="border-b border-[#EDEDED] last:border-b-0 animate-in fade-in duration-100">
                          <div
                            className={cn(
                              "flex items-center justify-between text-xs transition pr-4 py-2.5",
                              style.bg,
                              style.border,
                              indentPadding
                            )}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleTreeNode(node.code)}
                                  className="p-1 hover:bg-[#E4E4E7] rounded text-[#71717A] transition"
                                  title={isExpanded ? "Collapse" : "Expand"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-5 h-5 flex items-center justify-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                </div>
                              )}

                              <span className="font-mono font-bold text-[11px] text-[#18181B] bg-white border border-[#EDEDED] px-2 py-0.5 rounded shadow-2xs">
                                {node.code}
                              </span>

                              <span className="truncate font-medium text-[#18181B]">{node.name}</span>

                              <span
                                className={cn(
                                  "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono shrink-0",
                                  style.badge
                                )}
                              >
                                {style.label}
                              </span>

                              <span className="text-[10px] text-[#71717A] capitalize font-medium hidden md:inline">
                                ({node.type})
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-right shrink-0">
                              <span className="font-mono font-bold text-xs text-[#18181B]">
                                {formatCurrency(node.balance)}
                              </span>

                              {node.level === 4 ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAccountDrilldown(node)}
                                  className="text-[11px] font-bold text-[#0D7A5F] hover:underline inline-flex items-center gap-0.5 px-2 py-1 bg-white rounded border border-emerald-200 hover:bg-emerald-50 transition"
                                >
                                  Inspect <ChevronRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#A1A1AA] w-16 text-right font-mono">
                                  Rollup
                                </span>
                              )}
                            </div>
                          </div>

                          {hasChildren && (isExpanded || Boolean(coaSearch.trim())) && (
                            <div>
                              {node.children.map((child: any) => renderNode(child))}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return renderNode(rootNode);
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: TABULAR VIEW */}
          {coaViewMode === "table" && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Account Code</th>
                      <th className="py-2.5 px-4">Account Name</th>
                      <th className="py-2.5 px-3 text-center">Level & Role</th>
                      <th className="py-2.5 px-3">Parent Group</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-4 text-right">Journal Lines</th>
                      <th className="py-2.5 px-4 text-right">Balance</th>
                      <th className="py-2.5 px-4 text-right">Posting / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {coaFlat.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[#71717A]">
                          Loading tabular chart of accounts...
                        </td>
                      </tr>
                    ) : (
                      coaFlat
                        .filter((acc) => {
                          if (coaLevelFilter !== "ALL" && String(acc.level) !== coaLevelFilter) {
                            return false;
                          }
                          if (coaTypeFilter !== "ALL" && acc.type !== coaTypeFilter) {
                            return false;
                          }
                          if (coaSearch.trim()) {
                            const query = coaSearch.toLowerCase().trim();
                            return (
                              acc.code.toLowerCase().includes(query) ||
                              acc.name.toLowerCase().includes(query)
                            );
                          }
                          return true;
                        })
                        .map((acc) => {
                          const levelBadge =
                            acc.level === 1
                              ? { badge: "bg-blue-100 text-blue-900 border-blue-200", label: "L1 · Category" }
                              : acc.level === 2
                              ? { badge: "bg-purple-100 text-purple-900 border-purple-200", label: "L2 · Type" }
                              : acc.level === 3
                              ? { badge: "bg-amber-100 text-amber-900 border-amber-200", label: "L3 · Sub-Type" }
                              : { badge: "bg-emerald-100 text-emerald-900 border-emerald-200 font-bold", label: "L4 · Transactional" };

                          return (
                            <tr
                              key={acc.code}
                              className={cn(
                                "hover:bg-[#F9FAFB] transition",
                                acc.level === 1
                                  ? "bg-[#FAFAFA] font-bold"
                                  : acc.level === 2
                                  ? "font-semibold"
                                  : ""
                              )}
                            >
                              <td className="py-2.5 px-4 font-mono font-bold text-[#18181B]">
                                {acc.code}
                              </td>
                              <td className="py-2.5 px-4 text-[#18181B]">
                                <span
                                  style={{
                                    paddingLeft: `${(acc.level - 1) * 16}px`,
                                  }}
                                  className="inline-flex items-center gap-1.5"
                                >
                                  {acc.level > 1 && (
                                    <span className="text-[#A1A1AA] font-mono text-[10px]">
                                      └──
                                    </span>
                                  )}
                                  {acc.name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-mono border whitespace-nowrap",
                                    levelBadge.badge
                                  )}
                                >
                                  {levelBadge.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-[#71717A]">
                                {acc.parentCode || "—"}
                              </td>
                              <td className="py-2.5 px-3 capitalize text-[#71717A]">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F4F5] text-[#3F3F46] border border-[#E4E4E7]">
                                  {acc.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-[#71717A]">
                                {acc.entriesCount || 0}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-[#18181B]">
                                {formatCurrency(acc.balance)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {acc.level === 4 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAccountDrilldown(acc)}
                                    className="text-[#0D7A5F] hover:underline font-bold text-[11px] inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200 hover:bg-emerald-100 transition"
                                  >
                                    Data-Entry Ready <ChevronRight className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-[#A1A1AA] font-mono px-2 py-0.5 rounded bg-[#F4F4F5]">
                                    Summary Rollup
                                  </span>
                                )}
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
        </div>
      )}

      {/* TAB: ACCOUNT MAPPING SETTINGS */}
      {activeTab === "mapping" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-emerald-950 via-[#18181B] to-[#18181B] border border-emerald-800/40 rounded-xl text-white shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">Consolidated Accounting Settings Available</p>
                <p className="text-[11px] text-zinc-400">Manage 4-Level Chart of Accounts, system protections, deactivation guards, and transaction mappings in one place.</p>
              </div>
            </div>
            <Link
              href="/settings/accounting"
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto"
            >
              Open Settings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <AccountMappingTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: GENERAL JOURNAL & MANUAL BALANCED POSTINGS */}
      {/* ========================================================================= */}
      {activeTab === "journal" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">General Journal Entries Log</h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Strictly enforced mathematical parity: sum(debit) == sum(credit) for every voucher.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManualJournalModal(true)}
              className="px-4 py-2 bg-[#18181B] hover:bg-black text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" /> + New Journal Entry
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden divide-y divide-[#E4E4E7]">
            {journalEntries.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#71717A]">No journal entries posted yet.</div>
            ) : (
              journalEntries.map((je) => {
                const totalDebit = je.lines?.reduce((s: number, l: any) => s + (l.debit || 0), 0) || 0;
                const totalCredit = je.lines?.reduce((s: number, l: any) => s + (l.credit || 0), 0) || 0;
                const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

                return (
                  <div key={je.id} className="p-4 hover:bg-[#FAFAFA] transition space-y-2">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E4E4E7]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#18181B]">{je.memo}</span>
                        <span className="text-[10px] text-[#71717A] font-mono px-1.5 py-0.5 rounded bg-[#F4F4F5]">
                          {je.refType}
                        </span>
                        {isBalanced && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Balanced
                          </span>
                        )}
                        {je.status === "reversed" && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Reversed
                          </span>
                        )}
                        {je.status === "reversal" && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Reversal Voucher
                          </span>
                        )}
                        {je.reversalOfId && (
                          <span className="text-[10px] font-mono text-purple-700">
                            Reverses #{je.reversalOfId.slice(0, 8).toUpperCase()}
                          </span>
                        )}
                        {je.reversedById && (
                          <span className="text-[10px] font-mono text-rose-700">
                            Reversed by #{je.reversedById.slice(0, 8).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#71717A] font-mono">{formatDateTime(je.date)}</span>
                        {(!je.status || je.status === "posted") && (
                          <button
                            type="button"
                            onClick={() => setReversingEntry(je)}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 inline-flex items-center gap-1 transition"
                          >
                            <RotateCcw className="w-3 h-3" /> Reverse Voucher
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      {je.lines?.map((line: any) => (
                        <div key={line.id} className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="text-[#52525B]">
                            {line.account?.code} — {line.account?.name}
                          </span>
                          <div className="flex items-center gap-6 font-mono">
                            <span className={line.debit > 0 ? "text-[#18181B] font-semibold" : "text-[#D4D4D8]"}>
                              Dr: {formatCurrency(line.debit)}
                            </span>
                            <span className={line.credit > 0 ? "text-[#18181B] font-semibold" : "text-[#D4D4D8]"}>
                              Cr: {formatCurrency(line.credit)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ENTERPRISE TAB 8: FINANCIAL STATEMENTS */}
      {/* ========================================================================= */}
      {activeTab === "reports" && <FinancialStatementsTab />}

      {/* ========================================================================= */}
      {/* ENTERPRISE TAB 9: BANK RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === "bankrec" && <BankReconciliationTab />}

      {/* ========================================================================= */}
      {/* ENTERPRISE TAB 10: FIXED ASSETS & DEPRECIATION */}
      {/* ========================================================================= */}
      {activeTab === "fixedassets" && <FixedAssetsTab />}

      {/* ========================================================================= */}
      {/* ENTERPRISE TAB 11: SUB-LEDGER DRIFT & AGING */}
      {/* ========================================================================= */}
      {activeTab === "subledgers" && <SubLedgerReconciliationTab />}

      {/* ========================================================================= */}
      {/* DRAWER 1: CUSTOMER STATEMENT OF ACCOUNT */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white w-full max-w-2xl h-full p-6 space-y-4 shadow-2xl border-l border-[#E4E4E7] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">Customer Statement of Account</h3>
                <p className="text-xs text-[#71717A]">{selectedCustomer.name} • {selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7]">
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Total Billed</span>
                <span className="text-sm font-bold font-mono text-[#18181B]">
                  {formatCurrency(selectedCustomer.totalBilled || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Total Paid</span>
                <span className="text-sm font-bold font-mono text-emerald-700">
                  {formatCurrency(selectedCustomer.totalPaid || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#71717A] uppercase font-bold block">Balance Due</span>
                <span className="text-sm font-bold font-mono text-amber-700">
                  {formatCurrency(selectedCustomer.balanceDue || 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#18181B]">Chronological Statement Ledger</span>
              <button
                type="button"
                onClick={() => {
                  setPaymentAmount(String(selectedCustomer.balanceDue || ""));
                  setShowPaymentModal(true);
                }}
                className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs inline-flex items-center gap-1"
              >
                <DollarSign className="w-3.5 h-3.5" /> Record Payment
              </button>
            </div>

            <div className="overflow-x-auto border border-[#E4E4E7] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] bg-[#F4F4F5]">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Ref #</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Debit (Billed)</th>
                    <th className="p-2.5 text-right">Credit (Paid)</th>
                    <th className="p-2.5 text-right">Running Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {statementLoading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#71717A]">
                        Loading customer statement...
                      </td>
                    </tr>
                  ) : customerStatement.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#71717A]">
                        No billing transactions found for this customer.
                      </td>
                    </tr>
                  ) : (
                    customerStatement.map((st, i) => (
                      <tr key={i} className="hover:bg-[#FAFAFA]">
                        <td className="p-2.5 font-mono text-[11px] text-[#71717A]">{formatDateTime(st.date)}</td>
                        <td className="p-2.5 font-mono font-bold text-[#0D7A5F]">{st.refNumber}</td>
                        <td className="p-2.5 text-[#18181B]">{st.description}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-[#18181B]">
                          {st.debit > 0 ? formatCurrency(st.debit) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          {st.credit > 0 ? formatCurrency(st.credit) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-800">
                          {formatCurrency(st.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER 2: ACCOUNT DRILLDOWN GENERAL LEDGER */}
      {/* ========================================================================= */}
      {selectedAccountDrilldown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white w-full max-w-2xl h-full p-6 space-y-4 shadow-2xl border-l border-[#E4E4E7] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0D7A5F]" />
                  General Ledger Drilldown: {selectedAccountDrilldown.code} — {selectedAccountDrilldown.name}
                </h3>
                <p className="text-xs text-[#71717A] uppercase font-mono mt-0.5">
                  Classification: {selectedAccountDrilldown.type}
                </p>
              </div>
              <button
                onClick={() => setSelectedAccountDrilldown(null)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Current Account Balance</span>
                <span className="text-[11px] text-emerald-800">Calculated from all posted double-entry journal vouchers</span>
              </div>
              <span className="text-xl font-mono font-bold text-[#0D7A5F]">
                {formatCurrency(selectedAccountDrilldown.balance)}
              </span>
            </div>

            <div className="overflow-x-auto border border-[#E4E4E7] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] bg-[#F4F4F5]">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Memo / Particulars</th>
                    <th className="p-2.5">Ref Type</th>
                    <th className="p-2.5 text-right">Debit</th>
                    <th className="p-2.5 text-right">Credit</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {drilldownLoading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#71717A]">
                        Loading account transactions...
                      </td>
                    </tr>
                  ) : accountLedgerLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#71717A]">
                        No transactions recorded for this account.
                      </td>
                    </tr>
                  ) : (
                    accountLedgerLines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-[#FAFAFA]">
                        <td className="p-2.5 font-mono text-[11px] text-[#71717A]">{formatDateTime(line.date)}</td>
                        <td className="p-2.5 font-medium text-[#18181B]">{line.memo}</td>
                        <td className="p-2.5 font-mono text-[10px] text-[#71717A]">{line.refType}</td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-[#18181B]">
                          {formatCurrency(line.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD EXPENSE VOUCHER */}
      {/* ========================================================================= */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                Record Expense Voucher
              </h3>
              <button onClick={() => setShowAddExpenseModal(false)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Expense Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewExpenseType("company")}
                    className={`py-2 rounded-lg font-bold border text-xs ${
                      newExpenseType === "company"
                        ? "bg-[#18181B] text-white border-black"
                        : "bg-white text-[#71717A] border-[#D4D4D8]"
                    }`}
                  >
                    Company Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExpenseType("technician")}
                    className={`py-2 rounded-lg font-bold border text-xs ${
                      newExpenseType === "technician"
                        ? "bg-[#18181B] text-white border-black"
                        : "bg-white text-[#71717A] border-[#D4D4D8]"
                    }`}
                  >
                    Technician Field Claim
                  </button>
                </div>
              </div>

              {newExpenseType === "technician" ? (
                <div>
                  <label className="text-xs font-semibold text-[#71717A] block mb-1">Technician *</label>
                  <select
                    value={newExpenseTechId}
                    onChange={(e) => setNewExpenseTechId(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-semibold"
                    required
                  >
                    <option value="">Select Technician...</option>
                    {partiesData.technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.phone})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-[#71717A] block mb-1">Payee / Beneficiary</label>
                  <input
                    type="text"
                    placeholder="e.g. Shell Petrol Station, DEWA Electricity, Office Supplies"
                    value={newExpensePayee}
                    onChange={(e) => setNewExpensePayee(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#71717A] block mb-1">Expense Account (Debit)</label>
                  <select
                    value={newExpenseAccount}
                    onChange={(e) => setNewExpenseAccount(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-semibold"
                  >
                    <option value="6100">6100 — Technician Travel & Field Expenses</option>
                    <option value="5000">5000 — Parts & Materials Cost (COGS)</option>
                    <option value="6200">6200 — Office & Utilities</option>
                    <option value="6000">6000 — Salaries & Wages</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#71717A] block mb-1">Payment Source (Credit)</label>
                  <select
                    value={newExpenseDisbursing}
                    onChange={(e) => setNewExpenseDisbursing(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-semibold"
                  >
                    <option value="1000">1000 — Cash Drawer</option>
                    <option value="1010">1010 — Operating Bank Account</option>
                    <option value="1020">1020 — Petty Cash Float</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#71717A] block mb-1">Amount ($) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#71717A] block mb-1">Receipt / Invoice Ref #</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-8921"
                    value={newExpenseRef}
                    onChange={(e) => setNewExpenseRef(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Memo / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency copper tubing purchased on job site"
                  value={newExpenseMemo}
                  onChange={(e) => setNewExpenseMemo(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Post Expense to General Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD CUSTOMER PAYMENT */}
      {/* ========================================================================= */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B]">Record Customer Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordCustomerPayment} className="space-y-3">
              <p className="text-[#71717A]">
                Record cash or bank receipt from <strong>{selectedCustomer.name}</strong> to reduce outstanding balance.
              </p>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Amount ($) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-semibold"
                >
                  <option value="cash">Cash on Hand (Account 1000)</option>
                  <option value="bank">Bank Transfer (Operating Bank Account)</option>
                  <option value="cheque">Cheque Deposit</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Reference Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Cheque #49281 cleared"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Confirm & Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISBURSE TECH ADVANCE */}
      {/* ========================================================================= */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-2xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B]">Disburse Technician Advance</h3>
              <button onClick={() => setShowAdvanceModal(false)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <form onSubmit={handleGiveAdvance} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Advance Amount ($) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Disbursement Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Fuel float for Ras Al Khaimah job"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Disburse & Update Hisaab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISBURSE VENDOR PAYMENT */}
      {/* ========================================================================= */}
      {showVendorPayModal && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-2xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B]">Disburse Supplier Payment</h3>
              <button onClick={() => setShowVendorPayModal(false)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordVendorPayment} className="space-y-3">
              <div className="p-3 bg-[#FAFAFA] rounded-xl border border-[#E4E4E7] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Supplier:</span>
                  <span className="font-bold text-[#18181B]">{selectedVendor.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">NTN / STRN:</span>
                  <span className="font-mono">{selectedVendor.ntnNumber || "Unregistered / Individual"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">WHT Rate (Sec 153):</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {selectedVendor.whtExempt ? "0% (Exempt)" : `${selectedVendor.whtRate || 0}%`}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Gross Bill Amount (PKR) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={vendorPayAmount}
                  onChange={(e) => setVendorPayAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm"
                  required
                />
              </div>

              {/* Tax Deduction Breakdown */}
              {Number(vendorPayAmount) > 0 && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-[11px]">
                  <span className="font-bold text-emerald-950 block uppercase tracking-wide">
                    Double-Entry Tax Breakdown
                  </span>
                  <div className="flex justify-between text-emerald-900">
                    <span>Dr 2000 Accounts Payable (Gross):</span>
                    <span className="font-mono font-bold">{formatCurrency(Number(vendorPayAmount))}</span>
                  </div>
                  <div className="flex justify-between text-rose-800">
                    <span>Cr 2200 WHT Payable to FBR ({selectedVendor.whtRate || 0}%):</span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(
                        Math.round((Number(vendorPayAmount) * (selectedVendor.whtExempt ? 0 : (selectedVendor.whtRate || 0))) / 100 * 100) / 100
                      )}
                    </span>
                  </div>
                  <div className="border-t border-emerald-200 pt-1 flex justify-between font-bold text-emerald-950">
                    <span>Cr 1000/1010 Net Payable Disbursed:</span>
                    <span className="font-mono text-xs">
                      {formatCurrency(
                        Math.round(
                          (Number(vendorPayAmount) -
                            Math.round((Number(vendorPayAmount) * (selectedVendor.whtExempt ? 0 : (selectedVendor.whtRate || 0))) / 100 * 100) / 100) *
                            100
                        ) / 100
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  FBR CPR Number (Computerized Payment Receipt)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CPR-IT-2026-009124"
                  value={vendorCprNumber}
                  onChange={(e) => setVendorCprNumber(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Payment Reference / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Bank wire ref #99821 / Cheque clearance"
                  value={vendorPayMemo}
                  onChange={(e) => setVendorPayMemo(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowVendorPayModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Disburse & Deduct WHT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COUNTER-OFFER / MODIFY DISCOUNT */}
      {/* ========================================================================= */}
      {modifyingDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-2xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B]">Counter-Offer / Adjust Discount</h3>
              <button onClick={() => setModifyingDiscount(null)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[#71717A]">
                Tech requested: <strong>${modifyingDiscount.requestedDiscount}</strong> on{" "}
                <strong>{modifyingDiscount.itemDescription}</strong>.
              </p>
              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Approved Discount Amount ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={modifyingDiscount.currentRate}
                  value={modifiedDiscountAmount}
                  onChange={(e) => setModifiedDiscountAmount(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setModifyingDiscount(null)}
                  className="px-3 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveDiscount(modifyingDiscount, Number(modifiedDiscountAmount))}
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Approve Adjusted Amount
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL BALANCED JOURNAL ENTRY BUILDER */}
      {/* ========================================================================= */}
      {showManualJournalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-[#E4E4E7] text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#0D7A5F]" />
                New Balanced Double-Entry Journal Voucher
              </h3>
              <button onClick={() => setShowManualJournalModal(false)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <form onSubmit={handlePostManualJournal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">Entry Memo / Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g. Year-end tool depreciation, accrued utility expense, bank charge adjustment"
                  value={manualMemo}
                  onChange={(e) => setManualMemo(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18181B]">Voucher Lines (Dr / Cr)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setManualLines([...manualLines, { accountId: "", debit: "", credit: "" }])
                    }
                    className="text-[11px] font-bold text-[#0D7A5F] hover:underline"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {manualLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={line.accountId}
                        onChange={(e) => {
                          const updated = [...manualLines];
                          updated[idx].accountId = e.target.value;
                          setManualLines(updated);
                        }}
                        className="flex-1 bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs font-semibold"
                        required
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Debit ($)"
                        value={line.debit}
                        onChange={(e) => {
                          const updated = [...manualLines];
                          updated[idx].debit = e.target.value;
                          if (e.target.value) updated[idx].credit = "";
                          setManualLines(updated);
                        }}
                        className="w-24 bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono text-xs"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Credit ($)"
                        value={line.credit}
                        onChange={(e) => {
                          const updated = [...manualLines];
                          updated[idx].credit = e.target.value;
                          if (e.target.value) updated[idx].debit = "";
                          setManualLines(updated);
                        }}
                        className="w-24 bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono text-xs"
                      />
                      {manualLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setManualLines(manualLines.filter((_, i) => i !== idx))}
                          className="text-rose-600 font-bold p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Mathematical Parity Checker */}
                {(() => {
                  const deb = manualLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                  const cred = manualLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
                  const diff = Math.abs(deb - cred);
                  const isBalanced = diff < 0.01;

                  return (
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono font-bold ${
                        isBalanced
                          ? "bg-emerald-50 text-emerald-950 border-emerald-200"
                          : "bg-rose-50 text-rose-950 border-rose-200"
                      }`}
                    >
                      <span>Total Debit: {formatCurrency(deb)}</span>
                      <span>Total Credit: {formatCurrency(cred)}</span>
                      <span>{isBalanced ? "✓ Parity Balanced" : `⚠️ Difference: ${formatCurrency(diff)}`}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowManualJournalModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  Post Journal Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK EXPENSE DRAWER */}
      <QuickExpenseDrawer
        isOpen={showExpenseDrawer}
        onClose={() => setShowExpenseDrawer(false)}
        jobId="direct_account_entry"
        technicianId={drawerTechId}
        onExpenseLogged={() => {
          setActionSuccessMsg("Field expense voucher logged and netted to technician ledger.");
          loadData();
        }}
      />

      {/* FIELD SETTLEMENT & EXPENSE CLEARANCE SESSION MODAL */}
      {settlementJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-[#E4E4E7] max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0D7A5F]" />
                  Field Settlement & Expense Clearance — {settlementJob.jobNumber}
                </h3>
                <p className="text-xs text-[#71717A] mt-0.5">
                  Customer: {settlementJob.customer?.name} • Technician: {settlementJob.assignedTechnician?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettlementJob(null)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compulsory Store Return Clearance Check */}
            {settlementJob.stockReturns?.some((sr: any) => !sr.acknowledgedAt) ? (
              <div className="space-y-3">
                <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#991B1B]">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Accountant Clearance Locked — Store Return Required</span>
                  </div>
                  <p className="text-[11px] text-[#B91C1C] leading-relaxed">
                    Technician <strong>{settlementJob.assignedTechnician?.name || "Technician"}</strong> has unused items that must be checked in with Storekeeper Bilal Sheikh.
                  </p>

                  <div className="p-2.5 bg-white rounded-lg border border-rose-200 text-[#18181B] space-y-1">
                    <span className="font-bold text-rose-900 block text-[10px] uppercase">
                      Pending Warehouse Return:
                    </span>
                    {settlementJob.stockReturns
                      ?.filter((sr: any) => !sr.acknowledgedAt)
                      .map((sr: any) => (
                        <div key={sr.id} className="text-xs">
                          <p className="font-semibold text-[#18181B]">{sr.item}</p>
                          <p className="text-[10px] text-[#71717A] font-mono">
                            Qty to return: {sr.qtyReturned} units
                          </p>
                        </div>
                      ))}
                  </div>

                  {settlementJob.stockReturns?.find((sr: any) => !sr.acknowledgedAt) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStorekeeperAcknowledge(
                          settlementJob.stockReturns.find((sr: any) => !sr.acknowledgedAt).id
                        )
                      }
                      className="w-full py-2.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Storekeeper Bilal Sheikh: Sign-Off & Acknowledge Return
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmitSettlement} className="space-y-4">
              {/* Part A: Customer Payment */}
              <div className="bg-[#FAFAFA] p-3.5 rounded-xl border border-[#E4E4E7] space-y-2.5">
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                  A. Customer Payment Collection
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#71717A] block mb-1">Payment Status *</label>
                    <select
                      disabled={settlementJob.stockReturns?.some((sr: any) => !sr.acknowledgedAt)}
                      value={customerPaymentMeans}
                      onChange={(e) => {
                        setCustomerPaymentMeans(e.target.value);
                        if (e.target.value === "unmarked") setAmountCollected("0");
                      }}
                      className="w-full bg-white p-2 rounded-lg text-xs font-semibold border border-[#D4D4D8]"
                    >
                      <option value="cash">Cash on Hand (Account 1000)</option>
                      <option value="online">Online Bank Transfer</option>
                      <option value="cheque">Cheque / POS Card</option>
                      <option value="unmarked">Unmarked / Unpaid (Formal AR Invoice)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#71717A] block mb-1">Amount Collected ($) *</label>
                    <input
                      type="number"
                      disabled={
                        customerPaymentMeans === "unmarked" ||
                        settlementJob.stockReturns?.some((sr: any) => !sr.acknowledgedAt)
                      }
                      value={amountCollected}
                      onChange={(e) => setAmountCollected(e.target.value)}
                      className="w-full bg-white p-2 rounded-lg text-sm font-mono font-bold border border-[#D4D4D8]"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Part B: Technician In-App Logged Expense Claims */}
              {settlementJob.expenseClaims?.length > 0 && (
                <div className="bg-[#FAFAFA] p-3.5 rounded-xl border border-[#E4E4E7] space-y-2">
                  <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                    B. Mobile-Logged Technician Expenses
                  </span>
                  <div className="space-y-1.5 pt-1">
                    {settlementJob.expenseClaims.map((claim: any) => (
                      <label
                        key={claim.id}
                        className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E4E4E7] text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedPaidExpenses.includes(claim.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPaidExpenses([...selectedPaidExpenses, claim.id]);
                              } else {
                                setSelectedPaidExpenses(
                                  selectedPaidExpenses.filter((id) => id !== claim.id)
                                );
                              }
                            }}
                            className="w-4 h-4 rounded text-[#0D7A5F] accent-[#0D7A5F]"
                          />
                          <span className="font-medium text-[#18181B]">{claim.note}</span>
                        </div>
                        <span className="font-mono font-bold text-[#18181B]">
                          {formatCurrency(claim.amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Part C: Verbal Expenses */}
              <div className="bg-[#FAFAFA] p-3.5 rounded-xl border border-[#E4E4E7] space-y-2.5">
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                  C. Verbal / Ad-hoc Field Expenses Told to Accountant
                </span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Amount ($)"
                    value={newAdhocAmount}
                    onChange={(e) => setNewAdhocAmount(e.target.value)}
                    className="w-24 bg-white p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Expense Description (e.g. Copper coupling, parking)"
                    value={newAdhocNote}
                    onChange={(e) => setNewAdhocNote(e.target.value)}
                    className="flex-1 bg-white p-2 rounded-lg border border-[#D4D4D8] text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddAdhocExpense}
                    className="px-3 py-1.5 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>
                {adhocExpenses.map((adhoc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border text-xs">
                    <span>{adhoc.note}</span>
                    <span className="font-mono font-bold text-[#0D7A5F]">{formatCurrency(adhoc.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Part D: Sync and Finalize */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncAndLockJob}
                    onChange={(e) => setSyncAndLockJob(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#0D7A5F] accent-[#0D7A5F]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#18181B] block">
                      Sync & Lock Record (Make Work Order Immutable & Invoiced)
                    </span>
                    <p className="text-[10px] text-[#52525B]">
                      Finalizes work order into read-only mode, posts revenue & expense debits to General Ledger, and generates official invoice INV-2026-XXXX.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setSettlementJob(null)}
                  className="px-3.5 py-1.5 text-xs text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingSettlement ||
                    settlementJob.stockReturns?.some((sr: any) => !sr.acknowledgedAt)
                  }
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  {isSubmittingSettlement ? "Recording..." : "Record Settlement Clearance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD CASHBOOK TRANSACTION (RECEIPT, PAYMENT, CONTRA TRANSFER)    */}
      {/* ========================================================================= */}
      {showRecordCashModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E4E4E7] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#0D7A5F]" />
                  Record Cashbook Entry
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Post a verified double-entry receipt, payment, or contra bank/cash transfer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordCashModal(false)}
                className="p-1 text-[#71717A] hover:text-[#18181B] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type Selector (Receipt, Payment, Transfer) */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-[#F4F4F5] rounded-xl">
              <button
                type="button"
                onClick={() => setCashFormType("receipt")}
                className={cn(
                  "py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition",
                  cashFormType === "receipt"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                Receipt (In)
              </button>
              <button
                type="button"
                onClick={() => setCashFormType("payment")}
                className={cn(
                  "py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition",
                  cashFormType === "payment"
                    ? "bg-white text-rose-800 shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                Payment (Out)
              </button>
              <button
                type="button"
                onClick={() => setCashFormType("transfer")}
                className={cn(
                  "py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition",
                  cashFormType === "transfer"
                    ? "bg-white text-[#18181B] shadow-xs"
                    : "text-[#71717A] hover:text-[#18181B]"
                )}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#52525B]" />
                Transfer
              </button>
            </div>

            <form onSubmit={handleRecordCashTransaction} className="space-y-3.5 pt-1">
              {/* Cash Account Selection */}
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  {cashFormType === "transfer" ? "Source Cash / Bank Account *" : "Cash / Bank Account *"}
                </label>
                <select
                  value={cashFormAccount}
                  onChange={(e) => setCashFormAccount(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium text-[#18181B]"
                >
                  <option value="1000">1000 — Cash on Hand / Main Drawer</option>
                  <option value="1010">1010 — Operating Bank Account (Meezan Bank)</option>
                  <option value="1011">1011 — Secondary Bank Account (HBL)</option>
                  <option value="1020">1020 — Petty Cash Float</option>
                </select>
              </div>

              {/* Transfer Target OR Contra Account */}
              {cashFormType === "transfer" ? (
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Destination Cash / Bank Account *
                  </label>
                  <select
                    value={cashFormTransferTo}
                    onChange={(e) => setCashFormTransferTo(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium text-[#18181B]"
                  >
                    <option value="1010">1010 — Operating Bank Account (Meezan Bank)</option>
                    <option value="1000">1000 — Cash on Hand / Main Drawer</option>
                    <option value="1011">1011 — Secondary Bank Account (HBL)</option>
                    <option value="1020">1020 — Petty Cash Float</option>
                  </select>
                  <p className="text-[10px] text-[#71717A] mt-1">
                    Contra entry: will debit destination account and credit source account.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Contra General Ledger Account (Reason / Allocation) *
                  </label>
                  <select
                    value={cashFormContra}
                    onChange={(e) => setCashFormContra(e.target.value)}
                    className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-medium text-[#18181B]"
                  >
                    {cashFormType === "receipt" ? (
                      <>
                        <option value="4000">4000 — HVAC Service & Installation Revenue</option>
                        <option value="1100">1100 — Accounts Receivable (Customer Clearance)</option>
                        <option value="4002">4002 — POS Counter Sales Revenue</option>
                        <option value="3000">3000 — Owner Capital / Equity Injection</option>
                      </>
                    ) : (
                      <>
                        <option value="6100">6100 — Technician Travel & Fuel Expenses</option>
                        <option value="6200">6200 — Office & Utility Expenses</option>
                        <option value="6000">6000 — Salaries & Wages Expense</option>
                        <option value="2000">2000 — Accounts Payable (Vendor Payment)</option>
                        <option value="2100">2100 — Technician Reimbursement Settlement</option>
                        <option value="3010">3010 — Owner Profit Drawings</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="50"
                  placeholder="e.g. 15000"
                  value={cashFormAmount}
                  onChange={(e) => setCashFormAmount(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none font-mono font-bold text-sm text-[#18181B]"
                  required
                />
              </div>

              {/* Counterparty Name */}
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Counterparty / Person (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Packages Mall, Ali Raza (Tech), Lahore Electric..."
                  value={cashFormParty}
                  onChange={(e) => setCashFormParty(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
                />
              </div>

              {/* Memo */}
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Narration / Description *
                </label>
                <input
                  type="text"
                  placeholder="Detailed description for the Cashbook journal voucher..."
                  value={cashFormMemo}
                  onChange={(e) => setCashFormMemo(e.target.value)}
                  className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-[#18181B]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowRecordCashModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cashFormSubmitting}
                  className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {cashFormSubmitting ? "Posting..." : "Post Cashbook Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ENTERPRISE MODAL: REVERSE JOURNAL ENTRY */}
      {/* ========================================================================= */}
      {reversingEntry && (
        <ReverseJournalEntryModal
          entry={reversingEntry}
          onClose={() => setReversingEntry(null)}
          onSuccess={(reversal) => {
            setReversingEntry(null);
            setActionSuccessMsg(
              `Journal Entry reversed. Reversal voucher #${reversal.id.slice(0, 8).toUpperCase()} posted to General Ledger.`
            );
            loadData();
          }}
        />
      )}

      {/* COA HIERARCHY MANAGER MODAL */}
      <CoaManagerModal
        isOpen={showCoaModal}
        mode={coaModalMode}
        accountToEdit={selectedAccountToEdit}
        allAccounts={coaFlat}
        onClose={() => setShowCoaModal(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
