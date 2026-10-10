"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Download,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

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

const TYPE_OPTIONS: Array<{ value: PartyType; label: string; icon: typeof Users }> = [
  { value: "customer", label: "Customers", icon: Users },
  { value: "vendor", label: "Vendors", icon: Building2 },
  { value: "employee", label: "Employees", icon: UserRound },
  { value: "care_of", label: "Care-of", icon: FileText },
];

const today = () => new Date().toISOString().slice(0, 10);
const safe = (value: unknown) => String(value ?? "").replaceAll('"', '""');

export default function StatementOfAccountsTab() {
  const [parties, setParties] = useState<Party[]>([]);
  const [company, setCompany] = useState({ name: "Workman Services", currency: "PKR" });
  const [totals, setTotals] = useState<any>({});
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
      ["Date", "Reference", "Type", "Description", "Source", "Status", "Debit", "Credit", "Balance"],
      ...visibleTransactions.map((line) => [line.date, line.reference, line.type, line.description, line.source || "", line.status || "", line.debit, line.credit, line.balance]),
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${safe(cell)}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${statement.party.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-statement-${toDate || today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const agingTotal = (aging?: Aging) => aging ? aging.current + aging.days31To60 + aging.days61To90 + aging.days90Plus : 0;

  return (
    <div className="space-y-5">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .soa-print-area, .soa-print-area * { visibility: visible !important; }
          .soa-print-area { position: absolute !important; inset: 0 !important; width: 100% !important; padding: 20px !important; background: white !important; }
          .soa-no-print { display: none !important; }
          .soa-print-area table { font-size: 10px !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>

      <div className="soa-no-print grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard label="Receivables" value={totals.outstandingReceivables || 0} detail={`${totals.customers || 0} customers · ${totals.careOf || 0} care-of`} tone="emerald" />
        <SummaryCard label="Payables" value={totals.outstandingPayables || 0} detail={`${totals.vendors || 0} vendors · ${totals.employees || 0} employees`} tone="amber" />
        <SummaryCard label="Total Ledgers" value={parties.length} detail="All party accounts" plain />
        <div className="bg-white border border-[#E4E4E7] rounded-xl p-4">
          <label className="text-[10px] uppercase tracking-wider font-bold text-[#71717A] block mb-1.5">Aging as of</label>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#0D7A5F]" />
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="min-w-0 w-full text-xs font-semibold outline-none" />
          </div>
        </div>
      </div>

      {error && <div className="soa-no-print rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}

      <div className="soa-no-print flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="inline-flex flex-wrap gap-1 p-1 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl">
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return <button key={option.value} type="button" onClick={() => setPartyType(option.value)} className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${partyType === option.value ? "bg-white text-[#18181B] shadow-sm" : "text-[#71717A] hover:text-[#18181B]"}`}><Icon className="w-3.5 h-3.5" />{option.label}</button>;
          })}
        </div>
        <button type="button" onClick={() => void loadDirectory()} className="h-9 px-3 rounded-lg border border-[#D4D4D8] bg-white text-xs font-bold inline-flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${directoryLoading ? "animate-spin" : ""}`} />Refresh</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        <aside className="soa-no-print bg-white border border-[#E4E4E7] rounded-xl overflow-hidden xl:sticky xl:top-4">
          <div className="p-3 border-b border-[#E4E4E7] space-y-2.5 bg-[#FAFAFA]">
            <div className="relative"><Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-2.5" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or details" className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#D4D4D8] bg-white text-xs outline-none focus:ring-1 focus:ring-[#0D7A5F]" /></div>
            <div className="grid grid-cols-2 gap-2">
              <select value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value as any)} className="py-2 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs"><option value="all">All balances</option><option value="open">Open only</option><option value="settled">Settled only</option></select>
              <select value={agingFilter} onChange={(e) => setAgingFilter(e.target.value as any)} className="py-2 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs"><option value="all">All aging</option><option value="current">0–30 days</option><option value="days31To60">31–60 days</option><option value="days61To90">61–90 days</option><option value="days90Plus">90+ days</option></select>
            </div>
          </div>
          <div className="max-h-[690px] overflow-y-auto divide-y divide-[#E4E4E7]">
            {directoryLoading ? <div className="p-10 text-center text-xs text-[#71717A]">Loading ledgers…</div> : visibleParties.length === 0 ? <div className="p-10 text-center text-xs text-[#71717A]">No ledgers match these filters.</div> : visibleParties.map((party) => (
              <button key={`${party.type}-${party.id}`} type="button" onClick={() => setSelected(party)} className={`w-full p-3 text-left transition ${selected?.id === party.id && selected.type === party.type ? "bg-emerald-50 border-l-4 border-[#0D7A5F]" : "hover:bg-[#FAFAFA] border-l-4 border-transparent"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-[#18181B] truncate">{party.name}</p><p className="text-[10px] text-[#71717A] truncate mt-0.5">{party.secondary || party.detail || "No contact"}</p></div><span className={`text-[11px] font-mono font-bold shrink-0 ${Math.abs(party.balance) < 0.005 ? "text-emerald-700" : "text-amber-700"}`}>{formatCurrency(party.balance)}</span></div>
                <div className="mt-2 flex justify-between text-[10px] text-[#71717A]"><span>{party.transactionCount} transactions</span><span>{agingTotal(party.aging) > 0 ? `${formatCurrency(agingTotal(party.aging))} aged` : "No aged balance"}</span></div>
              </button>
            ))}
          </div>
        </aside>

        <section className="soa-print-area bg-white border border-[#E4E4E7] rounded-xl overflow-hidden min-h-[520px]">
          {!selected ? <div className="h-[520px] flex flex-col items-center justify-center text-center px-8"><FileText className="w-10 h-10 text-[#A1A1AA] mb-3" /><h3 className="font-bold text-[#18181B]">Select a ledger</h3><p className="text-xs text-[#71717A] mt-1 max-w-sm">Choose any customer, vendor, employee, or care-of account to view its full transaction statement and aging.</p></div> : statementLoading || !statement ? <div className="h-[520px] flex items-center justify-center text-xs text-[#71717A]">Loading statement…</div> : (
            <>
              <header className="p-5 border-b border-[#E4E4E7]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div><p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#0D7A5F]">{company.name}</p><h2 className="text-xl font-bold text-[#18181B] mt-1">Statement of Account</h2><p className="text-xs text-[#71717A] mt-1">{TYPE_OPTIONS.find((option) => option.value === statement.party.type)?.label.slice(0, -1)} ledger · As of {new Date(statement.asOfDate).toLocaleDateString()}</p></div>
                  <div className="soa-no-print flex flex-wrap gap-2"><button type="button" onClick={exportCsv} className="h-9 px-3 rounded-lg border border-[#D4D4D8] text-xs font-bold inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />CSV</button><button type="button" onClick={() => window.print()} className="h-9 px-3 rounded-lg bg-[#18181B] text-white text-xs font-bold inline-flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />Print / Save PDF</button></div>
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"><div><p className="text-[10px] uppercase font-bold tracking-wider text-[#71717A]">Account holder</p><p className="text-base font-bold text-[#18181B] mt-1">{statement.party.name}</p><p className="text-[#52525B] mt-1">{statement.party.contactPerson || statement.party.designation || statement.party.department || ""}</p><p className="text-[#52525B]">{statement.party.phone || ""} {statement.party.email ? `· ${statement.party.email}` : ""}</p><p className="text-[#52525B]">{statement.party.address || ""}</p></div><div className="sm:text-right"><p className="text-[10px] uppercase font-bold tracking-wider text-[#71717A]">Statement period</p><p className="font-semibold text-[#18181B] mt-1">{fromDate || "Account opening"} to {toDate || "Today"}</p><p className="text-[#71717A] mt-1">Currency: {company.currency}</p></div></div>
              </header>

              <div className="soa-no-print p-4 border-b border-[#E4E4E7] bg-[#FAFAFA] space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><label className="text-[10px] font-bold text-[#71717A] uppercase">From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 block w-full p-2 rounded-lg border border-[#D4D4D8] bg-white text-xs normal-case font-medium" /></label><label className="text-[10px] font-bold text-[#71717A] uppercase">To<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 block w-full p-2 rounded-lg border border-[#D4D4D8] bg-white text-xs normal-case font-medium" /></label><label className="text-[10px] font-bold text-[#71717A] uppercase">Transaction type<select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="mt-1 block w-full p-2 rounded-lg border border-[#D4D4D8] bg-white text-xs normal-case font-medium"><option value="all">All types</option>{transactionTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label className="text-[10px] font-bold text-[#71717A] uppercase">Search<input value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} placeholder="Ref or description" className="mt-1 block w-full p-2 rounded-lg border border-[#D4D4D8] bg-white text-xs normal-case font-medium" /></label></div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 border-b border-[#E4E4E7]">
                <Metric label="Opening balance" value={statement.summary.openingBalance} />
                <Metric label="Period debits" value={statement.summary.totalDebit} />
                <Metric label="Period credits" value={statement.summary.totalCredit} />
                <Metric label="Closing balance" value={statement.summary.closingBalance} strong />
              </div>

              <div className="p-4 border-b border-[#E4E4E7]">
                <div className="flex items-center gap-1.5 mb-2"><Filter className="w-3.5 h-3.5 text-[#0D7A5F]" /><p className="text-[10px] uppercase tracking-wider font-bold text-[#71717A]">Aging analysis</p></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><AgeCell label="Current (0–30)" value={statement.aging.current} /><AgeCell label="31–60 days" value={statement.aging.days31To60} /><AgeCell label="61–90 days" value={statement.aging.days61To90} /><AgeCell label="90+ days" value={statement.aging.days90Plus} danger /></div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead><tr className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[10px] uppercase tracking-wider text-[#71717A]"><th className="p-2.5">Date</th><th className="p-2.5">Reference</th><th className="p-2.5">Transaction</th><th className="p-2.5">Description</th><th className="p-2.5 text-right">Debit</th><th className="p-2.5 text-right">Credit</th><th className="p-2.5 text-right">Balance</th></tr></thead>
                  <tbody className="divide-y divide-[#E4E4E7]">{visibleTransactions.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-[#71717A]">No transactions in this period or filter.</td></tr> : visibleTransactions.map((line) => <tr key={line.id} className="hover:bg-[#FAFAFA]"><td className="p-2.5 font-mono text-[10px] text-[#71717A] whitespace-nowrap">{formatDateTime(line.date)}</td><td className="p-2.5 font-mono font-bold text-[#18181B]">{line.reference}</td><td className="p-2.5"><span className="capitalize font-semibold text-[#18181B]">{line.type.replaceAll("_", " ")}</span><span className="block text-[9px] text-[#71717A]">{line.source}</span></td><td className="p-2.5 text-[#52525B] min-w-[180px]">{line.description}</td><td className="p-2.5 text-right font-mono">{line.debit ? formatCurrency(line.debit) : "—"}</td><td className="p-2.5 text-right font-mono">{line.credit ? formatCurrency(line.credit) : "—"}</td><td className="p-2.5 text-right font-mono font-bold text-[#18181B]">{formatCurrency(line.balance)}</td></tr>)}</tbody>
                </table>
              </div>
              <footer className="p-4 border-t border-[#E4E4E7] text-[10px] text-[#71717A] flex justify-between"><span>Generated from posted ERP sub-ledgers and source transactions.</span><span>{visibleTransactions.length} transaction(s)</span></footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail, tone, plain }: { label: string; value: number; detail: string; tone?: "emerald" | "amber"; plain?: boolean }) {
  return <div className="bg-white border border-[#E4E4E7] rounded-xl p-4"><p className="text-[10px] uppercase tracking-wider font-bold text-[#71717A]">{label}</p><p className={`text-xl font-mono font-bold mt-1 ${plain ? "text-[#18181B]" : tone === "emerald" ? "text-[#0D7A5F]" : "text-amber-700"}`}>{plain ? value.toLocaleString() : formatCurrency(value)}</p><p className="text-[10px] text-[#71717A] mt-1">{detail}</p></div>;
}

function Metric({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`p-4 border-r border-[#E4E4E7] last:border-r-0 ${strong ? "bg-emerald-50" : ""}`}><p className="text-[10px] uppercase font-bold tracking-wider text-[#71717A]">{label}</p><p className={`font-mono font-bold mt-1 ${strong ? "text-[#0D7A5F] text-base" : "text-[#18181B]"}`}>{formatCurrency(value)}</p></div>;
}

function AgeCell({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return <div className={`rounded-lg border p-2.5 ${danger && value > 0 ? "border-rose-200 bg-rose-50" : "border-[#E4E4E7] bg-[#FAFAFA]"}`}><p className="text-[10px] text-[#71717A]">{label}</p><p className={`font-mono text-xs font-bold mt-0.5 ${danger && value > 0 ? "text-rose-700" : "text-[#18181B]"}`}>{formatCurrency(value)}</p></div>;
}
