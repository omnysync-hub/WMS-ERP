"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, ReceiptText, Trash2 } from "lucide-react";

type Props = {
  config: any;
  accounts: any[];
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  onBack: () => void;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankTax = () => ({ id: id(), name: "", code: "", type: "sales_tax", rate: 0, appliesTo: "sales", inclusive: false, isDefault: false, active: true });
const blankPayment = () => ({ id: id(), name: "", code: "", kind: "cash", requiresReference: false, active: true });
const blankExpense = () => ({ id: id(), name: "", code: "", accountId: "", active: true });

export default function AccountingPoliciesStep(props: Props) {
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [invoiceNextNumber, setInvoiceNextNumber] = useState(1);
  const [invoicePadding, setInvoicePadding] = useState(4);
  const [aging, setAging] = useState<number[]>([30, 60, 90]);
  const [taxRules, setTaxRules] = useState<any[]>([blankTax()]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([blankPayment()]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([blankExpense()]);

  useEffect(() => {
    setInvoicePrefix(props.config?.invoice?.prefix || "INV");
    setInvoiceNextNumber(Number(props.config?.invoice?.nextNumber) || 1);
    setInvoicePadding(Number(props.config?.invoice?.padding) || 4);
    setAging(props.config?.agingBuckets?.length === 3 ? props.config.agingBuckets : [30, 60, 90]);
    setTaxRules(props.config?.taxRules?.length ? props.config.taxRules : [blankTax()]);
    setPaymentMethods(props.config?.paymentMethods?.length ? props.config.paymentMethods : [blankPayment()]);
    setExpenseCategories(props.config?.expenseCategories?.length ? props.config.expenseCategories : [blankExpense()]);
  }, [props.config]);

  const update = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number, key: string, value: unknown) =>
    setter((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));

  const save = async () => {
    try {
      props.setIsSubmitting(true);
      props.onError("");
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_accounting_policies", invoicePrefix, invoiceNextNumber, invoiceNumberPadding: invoicePadding, agingBuckets: aging, taxRules, paymentMethods, expenseCategories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save accounting policies.");
      await props.onSaved(data.message);
    } catch (error: any) {
      props.onError(error.message);
    } finally {
      props.setIsSubmitting(false);
    }
  };

  const field = "w-full rounded-lg border border-[#D4D4D8] bg-[#F9FAFB] px-2.5 py-2 text-xs outline-none focus:border-[#0D7A5F] focus:bg-white";
  const expenseAccounts = props.accounts.filter((account) => account.type === "expense" && account.level >= 4 && account.isActive);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
      <div className="border-b border-[#E4E4E7] pb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><ReceiptText className="w-4 h-4 text-[#0D7A5F]" />Step 4: Accounting Policies</h2>
        <p className="text-xs text-[#71717A] mt-1">Define numbering, statutory taxes, accepted payment methods, aging cutoffs, and expense-to-ledger mappings.</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wide">Invoice numbering</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-[11px] font-semibold text-[#52525B]">Prefix<input className={field} value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())} placeholder="INV" /></label>
          <label className="text-[11px] font-semibold text-[#52525B]">Next number<input className={field} type="number" min={1} value={invoiceNextNumber} onChange={(e) => setInvoiceNextNumber(Number(e.target.value))} /></label>
          <label className="text-[11px] font-semibold text-[#52525B]">Number padding<input className={field} type="number" min={3} max={10} value={invoicePadding} onChange={(e) => setInvoicePadding(Number(e.target.value))} /></label>
        </div>
        <div className="text-[11px] rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-mono">Preview: {invoicePrefix || "PREFIX"}-{new Date().getFullYear()}-{String(Math.max(1, invoiceNextNumber)).padStart(Math.max(3, invoicePadding), "0")}</div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wide">Tax rules</h3><button type="button" onClick={() => setTaxRules((rows) => [...rows, blankTax()])} className="text-[11px] font-bold text-[#0D7A5F] flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add rule</button></div>
        <div className="space-y-2">
          {taxRules.map((row, index) => <div key={row.id} className="grid md:grid-cols-[1.4fr_.8fr_1fr_.7fr_1fr_auto] gap-2 p-3 rounded-xl border border-[#E4E4E7]">
            <input className={field} value={row.name} onChange={(e) => update(setTaxRules, index, "name", e.target.value)} placeholder="Tax name" />
            <input className={field} value={row.code} onChange={(e) => update(setTaxRules, index, "code", e.target.value.toUpperCase())} placeholder="Code" />
            <select className={field} value={row.type} onChange={(e) => update(setTaxRules, index, "type", e.target.value)}><option value="sales_tax">Sales tax</option><option value="withholding">Withholding</option><option value="other">Other</option></select>
            <input className={field} type="number" min={0} max={100} step="0.01" value={row.rate} onChange={(e) => update(setTaxRules, index, "rate", Number(e.target.value))} placeholder="Rate %" />
            <select className={field} value={row.appliesTo} onChange={(e) => update(setTaxRules, index, "appliesTo", e.target.value)}><option value="sales">Sales</option><option value="purchases">Purchases</option><option value="both">Both</option></select>
            <button type="button" onClick={() => setTaxRules((rows) => rows.filter((_, i) => i !== index))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button>
            <label className="md:col-span-2 text-[11px] flex items-center gap-2"><input type="checkbox" checked={row.inclusive} onChange={(e) => update(setTaxRules, index, "inclusive", e.target.checked)} />Tax included in price</label>
            <label className="md:col-span-2 text-[11px] flex items-center gap-2"><input type="checkbox" checked={row.isDefault} onChange={(e) => update(setTaxRules, index, "isDefault", e.target.checked)} />Default for this transaction type</label>
          </div>)}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wide">Payment methods</h3><button type="button" onClick={() => setPaymentMethods((rows) => [...rows, blankPayment()])} className="text-[11px] font-bold text-[#0D7A5F] flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add method</button></div>
        <div className="space-y-2">{paymentMethods.map((row, index) => <div key={row.id} className="grid md:grid-cols-[1.4fr_.8fr_1fr_1fr_auto] gap-2 p-3 rounded-xl border border-[#E4E4E7]">
          <input className={field} value={row.name} onChange={(e) => update(setPaymentMethods, index, "name", e.target.value)} placeholder="Display name" />
          <input className={field} value={row.code} onChange={(e) => update(setPaymentMethods, index, "code", e.target.value.toLowerCase())} placeholder="Code" />
          <select className={field} value={row.kind} onChange={(e) => update(setPaymentMethods, index, "kind", e.target.value)}><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="cheque">Cheque</option><option value="digital">Digital wallet</option><option value="credit">Credit</option><option value="split">Split payment</option></select>
          <label className="text-[11px] flex items-center gap-2 px-2"><input type="checkbox" checked={row.requiresReference} onChange={(e) => update(setPaymentMethods, index, "requiresReference", e.target.checked)} />Reference required</label>
          <button type="button" onClick={() => setPaymentMethods((rows) => rows.filter((_, i) => i !== index))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button>
        </div>)}</div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wide">Aging periods</h3>
        <div className="grid md:grid-cols-3 gap-3">{aging.map((value, index) => <label key={index} className="text-[11px] font-semibold text-[#52525B]">Cutoff {index + 1} (days)<input className={field} type="number" min={1} value={value} onChange={(e) => setAging((items) => items.map((item, i) => i === index ? Number(e.target.value) : item))} /></label>)}</div>
        <p className="text-[11px] text-[#71717A]">Reports will group balances as 0–{aging[0]}, {aging[0] + 1}–{aging[1]}, {aging[1] + 1}–{aging[2]}, and over {aging[2]} days.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wide">Expense categories</h3><button type="button" onClick={() => setExpenseCategories((rows) => [...rows, blankExpense()])} className="text-[11px] font-bold text-[#0D7A5F] flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add category</button></div>
        <div className="space-y-2">{expenseCategories.map((row, index) => <div key={row.id} className="grid md:grid-cols-[1.2fr_.7fr_1.5fr_auto] gap-2 p-3 rounded-xl border border-[#E4E4E7]">
          <input className={field} value={row.name} onChange={(e) => update(setExpenseCategories, index, "name", e.target.value)} placeholder="Category name" />
          <input className={field} value={row.code} onChange={(e) => update(setExpenseCategories, index, "code", e.target.value.toUpperCase())} placeholder="Code" />
          <select className={field} value={row.accountId} onChange={(e) => update(setExpenseCategories, index, "accountId", e.target.value)}><option value="">Map to expense account…</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select>
          <button type="button" onClick={() => setExpenseCategories((rows) => rows.filter((_, i) => i !== index))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button>
        </div>)}</div>
      </section>

      <div className="flex justify-between pt-3 border-t border-[#E4E4E7]"><button type="button" onClick={props.onBack} className="px-4 py-2 border rounded-xl text-xs font-bold text-[#71717A] flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Back</button><button type="button" onClick={save} disabled={props.isSubmitting} className="px-5 py-2.5 bg-[#0D7A5F] text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">{props.isSubmitting ? "Saving…" : "Save policies & continue"}<ArrowRight className="w-4 h-4" /></button></div>
    </div>
  );
}
