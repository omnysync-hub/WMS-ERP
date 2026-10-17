"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, numberToWords } from "@/lib/utils";
import { printDocument } from "@/lib/printUtils";
import CompanyLetterhead from "@/components/company/CompanyLetterhead";

type PartyType = "customer" | "vendor" | "employee" | "care_of";
type Aging = { current: number; days31To60: number; days61To90: number; days90Plus: number };
type Party = {
  id: string;
  type: PartyType;
  name: string;
  secondary?: string;
  detail?: string;
  balance: number;
  transactionCount: number;
  aging: Aging;
};
type Transaction = {
  id: string;
  date: string;
  reference: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
  source?: string;
};
type Statement = {
  party: Record<string, string | null> & { id: string; type: PartyType; name: string };
  openingBalance: number;
  transactions: Transaction[];
  summary: { openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number; transactionCount: number };
  aging: Aging;
  asOfDate: string;
};

const TYPE_OPTIONS: Array<{ value: PartyType; label: string; icon: typeof Users; singular: string }> = [
  { value: "customer", label: "Customers", icon: Users, singular: "Customer" },
  { value: "vendor", label: "Vendors", icon: Building2, singular: "Vendor" },
  { value: "employee", label: "Employees", icon: UserRound, singular: "Employee" },
  { value: "care_of", label: "Care-of", icon: FileText, singular: "Care-of Party" },
];

const today = () => new Date().toISOString().slice(0, 10);
const safe = (value: unknown) => String(value ?? "").replaceAll('"', '""');

export default function StatementOfAccountsTab() {
  const docRef = useRef<HTMLDivElement>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [company, setCompany] = useState({ name: "Workman Services", currency: "PKR" });
  const [totals, setTotals] = useState<any>({});
  const [agingBuckets, setAgingBuckets] = useState<[number, number, number]>([30, 60, 90]);
  const [partyType, setPartyType] = useState<PartyType>("customer");
  const [selected, setSelected] = useState<Party | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "open" | "settled">("all");
  const [agingFilter, setAgingFilter] = useState<"all" | keyof Aging>("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionType, setTransactionType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(today());
  const [asOfDate, setAsOfDate] = useState(today());
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/statements?mode=directory&asOf=${asOfDate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load ledgers");
      setParties(data.parties || []);
      setCompany(data.company || { name: "Workman Services", currency: "PKR" });
      setTotals(data.totals || {});
      if (Array.isArray(data.agingBuckets) && data.agingBuckets.length === 3) setAgingBuckets(data.agingBuckets);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load ledgers");
    } finally {
      setDirectoryLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);

  useEffect(() => {
    if (selected && selected.type !== partyType) {
      setSelected(null);
      setStatement(null);
    }
  }, [partyType, selected]);

  useEffect(() => {
    if (!selected) return;
    const loadStatement = async () => {
      setStatementLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ mode: "statement", type: selected.type, id: selected.id, asOf: asOfDate });
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        const res = await fetch(`/api/accounts/statements?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load statement");
        setStatement(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not load statement");
      } finally {
        setStatementLoading(false);
      }
    };
    void loadStatement();
  }, [selected, fromDate, toDate, asOfDate]);

  const visibleParties = useMemo(() => parties.filter((party) => {
    if (party.type !== partyType) return false;
    const needle = search.trim().toLowerCase();
    if (needle && !`${party.name} ${party.secondary || ""} ${party.detail || ""}`.toLowerCase().includes(needle)) return false;
    if (balanceFilter === "open" && Math.abs(party.balance) < 0.005) return false;
    if (balanceFilter === "settled" && Math.abs(party.balance) >= 0.005) return false;
    if (agingFilter !== "all" && party.aging[agingFilter] <= 0) return false;
    return true;
  }), [parties, partyType, search, balanceFilter, agingFilter]);

  const transactionTypes = useMemo(() => [...new Set((statement?.transactions || []).map((line) => line.type))].sort(), [statement]);
  
  const visibleTransactions = useMemo(() => (statement?.transactions || []).filter((line) => {
    if (transactionType !== "all" && line.type !== transactionType) return false;
    const needle = transactionSearch.trim().toLowerCase();
    return !needle || `${line.reference} ${line.type} ${line.description} ${line.source || ""}`.toLowerCase().includes(needle);
  }), [statement, transactionType, transactionSearch]);

  const exportCsv = () => {
    if (!statement) return;
    const rows = [
      ["STATEMENT OF ACCOUNT - " + company.name.toUpperCase()],
      [`Party: ${statement.party.name}`, `Type: ${statement.party.type}`, `As Of: ${statement.asOfDate}`],
      [`Period: ${fromDate || "Opening"} to ${toDate || today()}`],
      [],
      ["Date", "Reference", "Type", "Description", "Source", "Status", "Debit", "Credit", "Balance"],
      ...visibleTransactions.map((line) => [
        line.date,
        line.reference,
        line.type,
        line.description,
        line.source || "",
        line.status || "",
        line.debit,
        line.credit,
        line.balance,
      ]),
      [],
      ["Opening Balance", "", "", "", "", "", "", "", statement.summary.openingBalance],
      ["Total Debits", "", "", "", "", "", statement.summary.totalDebit, "", ""],
      ["Total Credits", "", "", "", "", "", "", statement.summary.totalCredit, ""],
      ["Closing Balance", "", "", "", "", "", "", "", statement.summary.closingBalance],
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${safe(cell)}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Statement_of_Account_${statement.party.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}_${toDate || today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (docRef.current && statement) {
      const cleanName = statement.party.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      printDocument(docRef.current, `Statement_of_Account_${cleanName}_${toDate || today()}`);
    } else {
      window.print();
    }
  };

  const agingTotal = (aging?: Aging) => aging ? aging.current + aging.days31To60 + aging.days61To90 + aging.days90Plus : 0;

  const currentTypeLabel = TYPE_OPTIONS.find((o) => o.value === partyType)?.singular || "Party";
  const isPayableType = partyType === "vendor" || partyType === "employee";

  const getBalanceBadge = (bal: number) => {
    if (Math.abs(bal) < 0.005) {
      return { text: "SETTLED / NIL BALANCE", tone: "bg-emerald-50 text-emerald-800 border-emerald-300", label: "Nil" };
    }
    if (isPayableType) {
      if (bal > 0) return { text: "NET PAYABLE (CR)", tone: "bg-amber-50 text-amber-800 border-amber-300", label: "Cr (Payable)" };
      return { text: "ADVANCE TO PARTY (DR)", tone: "bg-blue-50 text-blue-800 border-blue-300", label: "Dr (Advance)" };
    } else {
      if (bal > 0) return { text: "OUTSTANDING RECEIVABLE (DR)", tone: "bg-rose-50 text-rose-800 border-rose-300", label: "Dr (Receivable)" };
      return { text: "CUSTOMER ADVANCE (CR)", tone: "bg-blue-50 text-blue-800 border-blue-300", label: "Cr (Advance)" };
    }
  };

  return (
    <div className="space-y-5">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-document, .printable-document * { visibility: visible !important; }
          .printable-document {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print, .soa-no-print { display: none !important; }
          @page { size: A4 portrait; margin: 8mm 10mm; }
        }
      `}</style>

      {/* Top Overview Cards */}
      <div className="soa-no-print no-print grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard label="Outstanding Receivables" value={totals.outstandingReceivables || 0} detail={`${totals.customers || 0} customers · ${totals.careOf || 0} care-of`} tone="emerald" />
        <SummaryCard label="Outstanding Payables" value={totals.outstandingPayables || 0} detail={`${totals.vendors || 0} vendors · ${totals.employees || 0} employees`} tone="amber" />
        <SummaryCard label="Total Party Ledgers" value={parties.length} detail="Active sub-ledgers in ERP" plain />
        <div className="bg-white border border-[#E4E4E7] rounded-xl p-4 shadow-xs">
          <label className="text-[10px] uppercase tracking-wider font-bold text-[#71717A] block mb-1.5">Cut-Off & Aging Date</label>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#0D7A5F] shrink-0" />
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="min-w-0 w-full text-xs font-semibold outline-none bg-transparent" />
          </div>
        </div>
      </div>

      {error && (
        <div className="soa-no-print no-print rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Directory Filter Ribbon */}
      <div className="soa-no-print no-print flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="inline-flex flex-wrap gap-1 p-1 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl shadow-xs">
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPartyType(option.value)}
                className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  partyType === option.value ? "bg-white text-[#18181B] shadow-xs" : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void loadDirectory()}
          className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white hover:bg-zinc-50 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-600 ${directoryLoading ? "animate-spin" : ""}`} />
          Refresh Ledgers
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-5 items-start">
        {/* Left Directory Pane */}
        <aside className="soa-no-print no-print bg-white border border-[#E4E4E7] rounded-xl overflow-hidden xl:sticky xl:top-4 shadow-xs">
          <div className="p-3 border-b border-[#E4E4E7] space-y-2.5 bg-[#FAFAFA]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search party by name or contact..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D4D4D8] bg-white text-xs outline-none focus:ring-1 focus:ring-[#0D7A5F]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value as any)}
                className="py-1.5 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs text-zinc-800"
              >
                <option value="all">All balances</option>
                <option value="open">Open / Active only</option>
                <option value="settled">Settled / Nil only</option>
              </select>
              <select
                value={agingFilter}
                onChange={(e) => setAgingFilter(e.target.value as any)}
                className="py-1.5 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs text-zinc-800"
              >
                <option value="all">All aging</option>
                <option value="current">0–{agingBuckets[0]} days</option>
                <option value="days31To60">{agingBuckets[0] + 1}–{agingBuckets[1]} days</option>
                <option value="days61To90">{agingBuckets[1] + 1}–{agingBuckets[2]} days</option>
                <option value="days90Plus">{agingBuckets[2]}+ days</option>
              </select>
            </div>
          </div>
          <div className="max-h-[720px] overflow-y-auto divide-y divide-[#E4E4E7]">
            {directoryLoading ? (
              <div className="p-10 text-center text-xs text-[#71717A]">Loading ledgers…</div>
            ) : visibleParties.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#71717A]">No ledgers match these filters.</div>
            ) : (
              visibleParties.map((party) => {
                const isSelected = selected?.id === party.id && selected.type === party.type;
                const isNil = Math.abs(party.balance) < 0.005;
                return (
                  <button
                    key={`${party.type}-${party.id}`}
                    type="button"
                    onClick={() => setSelected(party)}
                    className={`w-full p-3 text-left transition ${
                      isSelected
                        ? "bg-emerald-50/70 border-l-4 border-[#0D7A5F]"
                        : "hover:bg-[#FAFAFA] border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#18181B] truncate">{party.name}</p>
                        <p className="text-[10px] text-[#71717A] truncate mt-0.5">
                          {party.secondary || party.detail || "No contact info recorded"}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold shrink-0 ${
                          isNil ? "text-emerald-700" : isPayableType ? "text-amber-700" : "text-zinc-900"
                        }`}
                      >
                        {formatCurrency(party.balance)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-[#71717A]">
                      <span>{party.transactionCount} transactions</span>
                      <span>
                        {agingTotal(party.aging) > 0
                          ? `${formatCurrency(agingTotal(party.aging))} aged`
                          : "Current"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Main Content Area */}
        <div className="space-y-4">
          {!selected ? (
            <div className="bg-white border border-[#E4E4E7] rounded-xl p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[520px]">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-[#71717A] mb-4">
                <FileSpreadsheet className="w-7 h-7 text-[#0D7A5F]" />
              </div>
              <h3 className="font-bold text-base text-[#18181B]">Select a Party Ledger</h3>
              <p className="text-xs text-[#71717A] mt-1.5 max-w-sm">
                Choose any customer, vendor, employee, or care-of account from the directory to generate an official GAAP Statement of Account with full transaction ledger & aging audit.
              </p>
            </div>
          ) : statementLoading || !statement ? (
            <div className="bg-white border border-[#E4E4E7] rounded-xl p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[520px] text-xs text-[#71717A]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0D7A5F] mb-3" />
              Generating formal statement & ledger audit…
            </div>
          ) : (
            <>
              {/* Document Interactive Toolbar (Hidden from Print) */}
              <div className="soa-no-print no-print bg-white border border-[#E4E4E7] rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#0D7A5F]" /> Filter Period:
                  </span>
                  <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-lg">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">From</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="text-xs font-medium bg-transparent outline-none text-zinc-800"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-lg">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">To</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="text-xs font-medium bg-transparent outline-none text-zinc-800"
                    />
                  </div>
                  {transactionTypes.length > 1 && (
                    <select
                      value={transactionType}
                      onChange={(e) => setTransactionType(e.target.value)}
                      className="text-xs font-medium bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-lg text-zinc-800"
                    >
                      <option value="all">All Types ({transactionTypes.length})</option>
                      {transactionTypes.map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll("_", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    placeholder="Search ref / memo..."
                    className="text-xs font-medium bg-zinc-50 border border-zinc-200 px-2.5 py-1 rounded-lg text-zinc-800 outline-none w-36"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="h-8.5 px-3 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-xs font-bold text-zinc-700 inline-flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Export
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="h-8.5 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0B6851] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print / Save PDF
                  </button>
                </div>
              </div>

              {/* Printable Document Container */}
              <div
                ref={docRef}
                id="printable-statement-of-account"
                className="printable-document bg-white border border-zinc-300 rounded-2xl shadow-sm text-xs text-zinc-800 font-sans p-8 space-y-6"
              >
                {/* Formal Corporate Letterhead & Document Title Block */}
                <div className="border-b-2 border-zinc-900 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <CompanyLetterhead qualifier="Party Ledger & Statement of Account" />

                    <div className="text-right shrink-0">
                      <div className="text-xl font-black font-mono tracking-wider text-zinc-900 uppercase">
                        STATEMENT OF ACCOUNT
                      </div>
                      <div className="text-xs font-mono font-bold text-[#0D7A5F] mt-0.5 uppercase tracking-wide">
                        {currentTypeLabel} Subsidiary Ledger
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600 mt-1.5">
                        Statement Date: <strong className="text-zinc-900">{formatDate(statement.asOfDate || new Date())}</strong>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600">
                        Period: <strong className="text-zinc-900">{fromDate ? formatDate(fromDate) : "Inception / Opening"}</strong> to <strong className="text-zinc-900">{toDate ? formatDate(toDate) : "Current Date"}</strong>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-600">
                        Currency: <strong className="text-zinc-900">{company.currency || "PKR"}</strong>
                      </div>
                      <div className="mt-2">
                        {(() => {
                          const badge = getBalanceBadge(statement.summary.closingBalance);
                          return (
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badge.tone}`}>
                              {badge.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Entity Details & Ledger Specifications */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Party Details */}
                  <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/70 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-2">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
                        Account Holder / Party Profile
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 font-bold uppercase">
                        ID: #{statement.party.type.slice(0, 3).toUpperCase()}-{statement.party.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-base font-bold text-zinc-900 leading-tight">
                      {statement.party.name}
                    </div>
                    {(statement.party.contactPerson || statement.party.designation || statement.party.department) && (
                      <div className="text-xs text-zinc-700 font-medium">
                        Attention: {statement.party.contactPerson || `${statement.party.designation || ""} ${statement.party.department ? `(${statement.party.department})` : ""}`}
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-600 space-y-0.5 pt-1">
                      {statement.party.phone && <div>Phone: <strong className="font-mono text-zinc-800">{statement.party.phone}</strong></div>}
                      {statement.party.email && <div>Email: <span className="font-mono text-zinc-800">{statement.party.email}</span></div>}
                      {statement.party.address && <div>Address: <span className="text-zinc-800">{statement.party.address}</span></div>}
                      {statement.party.ntnNumber && <div>NTN / Tax ID: <span className="font-mono text-zinc-800">{statement.party.ntnNumber}</span></div>}
                    </div>
                  </div>

                  {/* Right: Statement Specifications & Audit Context */}
                  <div className="p-4 rounded-xl border border-zinc-300 bg-zinc-50/70 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 mb-2">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
                        Ledger Audit Specifications
                      </span>
                      <span className="text-[10px] font-mono text-[#0D7A5F] font-bold">
                        GAAP Verified
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Sub-Ledger Type</span>
                        <strong className="text-zinc-900 capitalize">{statement.party.type.replaceAll("_", " ")} Subsidiary Ledger</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Activity Records</span>
                        <strong className="font-mono text-zinc-900">{visibleTransactions.length} of {statement.summary.transactionCount} posted</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Reconciliation Status</span>
                        <strong className="text-emerald-700">Audit Balanced & Cleared</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Terms of Credit</span>
                        <strong className="text-zinc-900">Standard Net 30 Days</strong>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-zinc-200/80 text-[10px] text-zinc-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0D7A5F] shrink-0" />
                      <span>Ledger synchronized with Workman Services General Journal & Sub-Ledger Registry.</span>
                    </div>
                  </div>
                </div>

                {/* Executive Financial Summary Grid */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 font-bold mb-2">
                    Period Financial Balance Summary
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-zinc-300 bg-white">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Opening Balance</span>
                      <div className="text-sm font-mono font-bold text-zinc-900 mt-1">
                        {formatCurrency(statement.summary.openingBalance)}
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">As of period start</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-zinc-300 bg-white">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Period Debits (Dr)</span>
                      <div className="text-sm font-mono font-bold text-zinc-900 mt-1">
                        {formatCurrency(statement.summary.totalDebit)}
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Total debits posted</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-zinc-300 bg-white">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Period Credits (Cr)</span>
                      <div className="text-sm font-mono font-bold text-zinc-900 mt-1">
                        {formatCurrency(statement.summary.totalCredit)}
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Total credits posted</span>
                    </div>

                    <div className="p-3.5 rounded-xl border-2 border-zinc-900 bg-zinc-900 text-white">
                      <span className="text-[10px] font-mono uppercase text-zinc-300 font-bold block">Closing Net Balance</span>
                      <div className="text-base font-mono font-black text-emerald-400 mt-0.5">
                        {formatCurrency(Math.abs(statement.summary.closingBalance))}
                      </div>
                      <span className="text-[9px] font-mono text-zinc-300 block uppercase font-bold mt-0.5">
                        {getBalanceBadge(statement.summary.closingBalance).label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aging Schedule Matrix */}
                <div className="p-3.5 rounded-xl border border-zinc-300 bg-zinc-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase text-zinc-600 font-bold tracking-wider flex items-center gap-1.5">
                      <Filter className="w-3 h-3 text-[#0D7A5F]" /> Outstanding Aging Schedule (As of {formatDate(statement.asOfDate)})
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Total Aged: <strong className="text-zinc-900">{formatCurrency(agingTotal(statement.aging))}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <AgingMatrixCell label={`Current (0–${agingBuckets[0]} Days)`} value={statement.aging.current} />
                    <AgingMatrixCell label={`${agingBuckets[0] + 1}–${agingBuckets[1]} Days`} value={statement.aging.days31To60} />
                    <AgingMatrixCell label={`${agingBuckets[1] + 1}–${agingBuckets[2]} Days`} value={statement.aging.days61To90} />
                    <AgingMatrixCell label={`${agingBuckets[2]}+ Days (Overdue)`} value={statement.aging.days90Plus} danger />
                  </div>
                </div>

                {/* Itemized Transaction Ledger Activity Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-zinc-600 font-bold tracking-wider">
                      Itemized Ledger Transactions
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Showing {visibleTransactions.length} transaction entries
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-zinc-300 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-100/80 border-b border-zinc-300 text-[10px] font-mono uppercase text-zinc-700 tracking-wider">
                          <th className="py-2.5 px-3 w-8 text-center">#</th>
                          <th className="py-2.5 px-3 w-24">Date</th>
                          <th className="py-2.5 px-3 w-28">Ref / Voucher</th>
                          <th className="py-2.5 px-3">Transaction Description & Particulars</th>
                          <th className="py-2.5 px-3 text-right w-28">Debit (PKR)</th>
                          <th className="py-2.5 px-3 text-right w-28">Credit (PKR)</th>
                          <th className="py-2.5 px-3 text-right w-32">Balance (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {/* Opening Balance Row */}
                        <tr className="bg-zinc-50/60 font-medium">
                          <td className="py-2 px-3 text-center font-mono text-zinc-400 text-[10px]">—</td>
                          <td className="py-2 px-3 font-mono text-zinc-600 text-[11px] whitespace-nowrap">
                            {fromDate ? formatDate(fromDate) : "—"}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-zinc-700 text-[11px]">
                            OPENING-BAL
                          </td>
                          <td className="py-2 px-3 text-zinc-600 italic">
                            Opening Balance Brought Forward
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-zinc-400">—</td>
                          <td className="py-2 px-3 text-right font-mono text-zinc-400">—</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">
                            {formatCurrency(statement.summary.openingBalance)}
                          </td>
                        </tr>

                        {visibleTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                              No transaction records found matching the selected period and filters.
                            </td>
                          </tr>
                        ) : (
                          visibleTransactions.map((line, idx) => (
                            <tr key={line.id} className="hover:bg-zinc-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-zinc-500 text-[10px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-700 whitespace-nowrap">
                                {formatDate(line.date)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-zinc-900 text-[11px] whitespace-nowrap">
                                {line.reference}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-zinc-900 capitalize">
                                    {line.description}
                                  </span>
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 uppercase border border-zinc-200">
                                    {line.type.replaceAll("_", " ")}
                                  </span>
                                </div>
                                {line.source && (
                                  <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
                                    Source: {line.source} {line.status ? `· ${line.status}` : ""}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[11px] font-semibold text-zinc-900 whitespace-nowrap">
                                {line.debit > 0 ? formatCurrency(line.debit) : <span className="text-zinc-400 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[11px] font-semibold text-zinc-900 whitespace-nowrap">
                                {line.credit > 0 ? formatCurrency(line.credit) : <span className="text-zinc-400 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[11px] font-bold text-zinc-900 whitespace-nowrap">
                                {formatCurrency(line.balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        {/* Totals Summary Row with Double Bottom Border */}
                        <tr className="bg-zinc-100/90 font-bold border-t-2 border-b-4 border-double border-zinc-900 text-zinc-900">
                          <td colSpan={4} className="py-3 px-3 text-right uppercase font-mono text-[11px] tracking-wider">
                            Total Period Activity & Closing Net Balance:
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap text-zinc-900">
                            {formatCurrency(statement.summary.totalDebit)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap text-zinc-900">
                            {formatCurrency(statement.summary.totalCredit)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs font-black whitespace-nowrap text-zinc-900 bg-zinc-200/50">
                            {formatCurrency(statement.summary.closingBalance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Amount in Words & Terms of Settlement */}
                <div className="flex flex-col sm:flex-row items-stretch justify-between gap-4 pt-2">
                  <div className="flex-1 p-3.5 bg-zinc-50 rounded-xl border border-zinc-300 text-xs space-y-1">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">
                      Net Closing Balance in Words:
                    </span>
                    <p className="font-semibold text-zinc-900 italic text-xs">
                      {numberToWords(Math.abs(statement.summary.closingBalance))}
                    </p>
                    <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200 mt-2">
                      Please remit balance via crossed cheque or online transfer in favor of <strong>Workman Services</strong>. For queries, contact accounts@workmanservices.com.
                    </div>
                  </div>

                  <div className="w-full sm:w-72 p-3.5 bg-zinc-50 rounded-xl border border-zinc-300 text-xs space-y-1">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">
                      Account Reconciliation Notice
                    </span>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Please inspect all transactions. Discrepancies must be notified within <strong>7 working days</strong>. Unreported balances are deemed acknowledged and confirmed.
                    </p>
                  </div>
                </div>

                {/* Formal Signature & Authorization Block */}
                <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-300 text-center text-xs">
                  <div>
                    <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-700 font-semibold">
                      ERP Automated System
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                      Prepared By (Accountant)
                    </span>
                  </div>

                  <div>
                    <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-700 font-semibold">
                      Finance & Accounts Dept.
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                      Verified & Audited By
                    </span>
                  </div>

                  <div>
                    <div className="border-b border-zinc-400 pb-1 mb-1 font-mono text-zinc-900 font-bold">
                      Chief Executive / Signatory
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                      Authorized Signatory
                    </span>
                  </div>
                </div>

                {/* System Watermark Footer */}
                <div className="pt-3 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono text-zinc-500">
                  <span>Workman Services ERP · Financial Accounting Subsystem · Statement of Account</span>
                  <span>Generated: {formatDateTime(new Date())} · Certified Authentic Copy</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail, tone, plain }: { label: string; value: number; detail: string; tone?: "emerald" | "amber"; plain?: boolean }) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-xl p-4 shadow-xs">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[#71717A]">{label}</p>
      <p className={`text-xl font-mono font-bold mt-1 ${plain ? "text-[#18181B]" : tone === "emerald" ? "text-[#0D7A5F]" : "text-amber-700"}`}>
        {plain ? value.toLocaleString() : formatCurrency(value)}
      </p>
      <p className="text-[10px] text-[#71717A] mt-1">{detail}</p>
    </div>
  );
}

function AgingMatrixCell({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  const hasValue = value > 0;
  return (
    <div className={`rounded-lg border p-2.5 ${danger && hasValue ? "border-rose-200 bg-rose-50" : "border-zinc-200 bg-white"}`}>
      <span className="text-[9px] font-mono uppercase text-zinc-500 block truncate">{label}</span>
      <span className={`font-mono text-xs font-bold mt-0.5 block ${danger && hasValue ? "text-rose-700 font-black" : "text-zinc-900"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
