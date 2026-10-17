"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Scale, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Props = {
  config: any;
  postingDate: string;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  onBack: () => void;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

const key = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blank = () => ({ _key: key(), partyType: "customer", partyId: "", debit: "", credit: "", dueDate: "", notes: "" });

export default function PartyOpeningBalancesStep(props: Props) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    setRows((props.config?.partyOpeningBalances || []).map((item: any) => ({ ...item, _key: item.id, debit: item.debit || "", credit: item.credit || "", dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : "" })));
  }, [props.config]);

  const parties = props.config?.parties || { customers: [], vendors: [], employees: [] };
  const update = (index: number, field: string, value: unknown) => setRows((items) => items.map((item, i) => {
    if (i !== index) return item;
    if (field === "debit" && value) return { ...item, debit: value, credit: "" };
    if (field === "credit" && value) return { ...item, credit: value, debit: "" };
    if (field === "partyType") return { ...item, partyType: value, partyId: "" };
    return { ...item, [field]: value };
  }));
  const options = (type: string) => type === "vendor" ? parties.vendors || [] : type === "employee" ? parties.employees || [] : parties.customers || [];
  const totals = useMemo(() => rows.reduce((sum, item) => ({ debit: sum.debit + (Number(item.debit) || 0), credit: sum.credit + (Number(item.credit) || 0) }), { debit: 0, credit: 0 }), [rows]);

  const save = async () => {
    try {
      props.setIsSubmitting(true);
      props.onError("");
      const balances = rows.filter((item) => item.partyId && (Number(item.debit) > 0 || Number(item.credit) > 0));
      const res = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_party_opening_balances", postingDate: props.postingDate, balances }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save party opening balances.");
      await props.onSaved(data.message);
    } catch (error: any) {
      props.onError(error.message);
    } finally {
      props.setIsSubmitting(false);
    }
  };
  const field = "w-full rounded-lg border border-[#D4D4D8] bg-[#F9FAFB] px-2.5 py-2 text-xs outline-none focus:border-[#0D7A5F] focus:bg-white";

  return <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
    <div className="border-b border-[#E4E4E7] pb-4 flex items-start justify-between"><div><h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Scale className="w-4 h-4 text-[#0D7A5F]" />Step 6: Party Opening Balances</h2><p className="text-xs text-[#71717A] mt-1">Allocate opening receivables and payables to individual customer, vendor, and employee ledgers. These must reconcile to the GL control totals entered next.</p></div><button type="button" onClick={() => setRows((items) => [...items, blank()])} className="text-[11px] font-bold text-[#0D7A5F] flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add balance</button></div>

    <div className="grid sm:grid-cols-2 gap-3"><div className="p-3 rounded-xl bg-blue-50 border border-blue-200"><span className="text-[10px] uppercase font-bold text-blue-800">Total debit balances</span><strong className="block text-lg font-mono text-blue-950">{formatCurrency(totals.debit)}</strong></div><div className="p-3 rounded-xl bg-amber-50 border border-amber-200"><span className="text-[10px] uppercase font-bold text-amber-800">Total credit balances</span><strong className="block text-lg font-mono text-amber-950">{formatCurrency(totals.credit)}</strong></div></div>

    {rows.length === 0 ? <div className="p-8 rounded-xl border border-dashed border-[#D4D4D8] text-center text-xs text-[#71717A]">No party balances entered. Save to explicitly confirm all customer, vendor, and employee opening balances are zero.</div> : <div className="space-y-2">{rows.map((row, index) => <div key={row._key || row.id} className="grid lg:grid-cols-[.8fr_1.3fr_.7fr_.7fr_.9fr_1.2fr_auto] gap-2 p-3 rounded-xl border border-[#E4E4E7]"><select className={field} value={row.partyType} onChange={(e) => update(index, "partyType", e.target.value)}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="employee">Employee</option></select><select className={field} value={row.partyId} onChange={(e) => update(index, "partyId", e.target.value)}><option value="">Select party…</option>{options(row.partyType).map((party: any) => <option key={party.id} value={party.id}>{party.name}</option>)}</select><input className={field} type="number" min={0} step="0.01" value={row.debit} onChange={(e) => update(index, "debit", e.target.value)} placeholder="Debit" /><input className={field} type="number" min={0} step="0.01" value={row.credit} onChange={(e) => update(index, "credit", e.target.value)} placeholder="Credit" /><input className={field} type="date" value={row.dueDate || ""} onChange={(e) => update(index, "dueDate", e.target.value)} /><input className={field} value={row.notes || ""} onChange={(e) => update(index, "notes", e.target.value)} placeholder="Reference / notes" /><button type="button" onClick={() => setRows((items) => items.filter((_, i) => i !== index))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button></div>)}</div>}

    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900"><strong>Accounting control:</strong> this stage allocates subledger balances only. In the next stage, enter the matching AR, AP, employee-receivable, and employee-payable control totals in the general ledger opening voucher.</div>
    <div className="flex justify-between pt-3 border-t border-[#E4E4E7]"><button type="button" onClick={props.onBack} className="px-4 py-2 border rounded-xl text-xs font-bold text-[#71717A] flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Back</button><button type="button" onClick={save} disabled={props.isSubmitting} className="px-5 py-2.5 bg-[#0D7A5F] text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">{props.isSubmitting ? "Saving…" : rows.length ? "Save party balances & continue" : "Confirm zero balances & continue"}<ArrowRight className="w-4 h-4" /></button></div>
  </div>;
}
