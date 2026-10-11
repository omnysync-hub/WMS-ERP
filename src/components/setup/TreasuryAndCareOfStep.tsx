"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Plus, Trash2 } from "lucide-react";

type Props = {
  config: any;
  accounts: any[];
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  onBack: () => void;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

const key = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankFinancial = () => ({ _key: key(), name: "", kind: "bank", accountCode: "", bankName: "", accountTitle: "", accountNumberMasked: "", iban: "", branchCode: "", isDefault: false });
const blankCareOf = (ledgerAccountId = "") => ({ _key: key(), id: "", companyName: "", personName: "", phone: "", ledgerAccountId });

export default function TreasuryAndCareOfStep(props: Props) {
  const assetAccounts = props.accounts.filter((account) => account.type === "asset" && account.level >= 4 && account.isActive);
  const defaultAr = assetAccounts.find((account) => account.code === "1100")?.id || "";
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([blankFinancial()]);
  const [careOfParties, setCareOfParties] = useState<any[]>([]);

  useEffect(() => {
    const existingFinancial = props.config?.financialAccounts?.filter((item: any) => item.isActive).map((item: any) => ({
      ...item,
      _key: item.id,
      accountCode: item.ledgerAccount?.code || "",
    }));
    setFinancialAccounts(existingFinancial?.length ? existingFinancial : [blankFinancial()]);
    setCareOfParties((props.config?.careOfParties || []).map((item: any) => ({ ...item, _key: item.id })));
  }, [props.config]);

  const update = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number, field: string, value: unknown) =>
    setter((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));

  const save = async () => {
    try {
      props.setIsSubmitting(true);
      props.onError("");
      const treasuryRes = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_financial_accounts", accounts: financialAccounts }) });
      const treasuryData = await treasuryRes.json();
      if (!treasuryRes.ok) throw new Error(treasuryData.error || "Could not save cash and bank accounts.");

      const careRows = careOfParties.filter((item) => item.companyName.trim());
      const careRes = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_care_of_setup", parties: careRows }) });
      const careData = await careRes.json();
      if (!careRes.ok) throw new Error(careData.error || "Could not save care-of ledgers.");
      await props.onSaved(`${treasuryData.message} ${careData.message}`);
    } catch (error: any) {
      props.onError(error.message);
    } finally {
      props.setIsSubmitting(false);
    }
  };

  const field = "w-full rounded-lg border border-[#D4D4D8] bg-[#F9FAFB] px-2.5 py-2 text-xs outline-none focus:border-[#0D7A5F] focus:bg-white";

  return <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-6 space-y-6">
    <div className="border-b border-[#E4E4E7] pb-4"><h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Building2 className="w-4 h-4 text-[#0D7A5F]" />Step 5: Cash, Banks & Care-of Ledgers</h2><p className="text-xs text-[#71717A] mt-1">Create operational cash/bank ledgers and connect every care-of party to an Accounts Receivable control ledger.</p></div>

    <section className="space-y-3">
      <div className="flex items-center justify-between"><div><h3 className="text-xs font-black uppercase tracking-wide">Cash and bank accounts</h3><p className="text-[11px] text-[#71717A] mt-1">These become real active leaf accounts in the chart of accounts.</p></div><button type="button" onClick={() => setFinancialAccounts((rows) => [...rows, blankFinancial()])} className="text-[11px] font-bold text-[#0D7A5F] flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add account</button></div>
      <div className="space-y-3">{financialAccounts.map((row, index) => <div key={row._key || row.id} className="p-4 rounded-xl border border-[#E4E4E7] space-y-3">
        <div className="grid md:grid-cols-[1.4fr_.8fr_.8fr_auto] gap-2"><input className={field} value={row.name} onChange={(e) => update(setFinancialAccounts, index, "name", e.target.value)} placeholder="Account display name" /><select className={field} value={row.kind} onChange={(e) => update(setFinancialAccounts, index, "kind", e.target.value)}><option value="bank">Bank</option><option value="cash">Cash</option><option value="card_clearing">Card clearing</option><option value="digital_wallet">Digital wallet</option></select><input className={field} value={row.accountCode} onChange={(e) => update(setFinancialAccounts, index, "accountCode", e.target.value)} placeholder="GL code" /><button type="button" onClick={() => setFinancialAccounts((rows) => rows.filter((_, i) => i !== index))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button></div>
        {row.kind !== "cash" && <div className="grid md:grid-cols-3 gap-2"><input className={field} value={row.bankName || ""} onChange={(e) => update(setFinancialAccounts, index, "bankName", e.target.value)} placeholder="Bank / provider" /><input className={field} value={row.accountTitle || ""} onChange={(e) => update(setFinancialAccounts, index, "accountTitle", e.target.value)} placeholder="Account title" /><input className={field} value={row.accountNumberMasked || ""} onChange={(e) => update(setFinancialAccounts, index, "accountNumberMasked", e.target.value)} placeholder="Account number (masked if preferred)" /><input className={field} value={row.iban || ""} onChange={(e) => update(setFinancialAccounts, index, "iban", e.target.value)} placeholder="IBAN" /><input className={field} value={row.branchCode || ""} onChange={(e) => update(setFinancialAccounts, index, "branchCode", e.target.value)} placeholder="Branch code" /></div>}
        <label className="text-[11px] font-semibold flex items-center gap-2"><input type="radio" name="default-financial" checked={row.isDefault} onChange={() => setFinancialAccounts((rows) => rows.map((item, i) => ({ ...item, isDefault: i === index })))} />Default operating account</label>
      </div>)}</div>
    </section>

    <section className="space-y-3 border-t border-[#E4E4E7] pt-5">
      <div className="flex items-center justify-between"><div><h3 className="text-xs font-black uppercase tracking-wide">Care-of ledger configuration</h3><p className="text-[11px] text-[#71717A] mt-1">If none are used, leave the list empty and save to confirm.</p></div><button type="button" onClick={() => setCareOfParties((rows) => [...rows, blankCareOf(defaultAr)])} className="text-[11px] font-bold text-[#0D7A5F] flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add care-of party</button></div>
      {careOfParties.length === 0 ? <div className="p-4 rounded-xl border border-dashed border-[#D4D4D8] text-xs text-[#71717A] text-center">No care-of parties added. Saving will explicitly confirm that none are required.</div> : <div className="space-y-2">{careOfParties.map((row, index) => <div key={row._key || row.id} className="grid md:grid-cols-[1.2fr_1fr_.8fr_1.4fr_auto] gap-2 p-3 rounded-xl border border-[#E4E4E7]"><input className={field} value={row.companyName} onChange={(e) => update(setCareOfParties, index, "companyName", e.target.value)} placeholder="Company / institution" /><input className={field} value={row.personName || ""} onChange={(e) => update(setCareOfParties, index, "personName", e.target.value)} placeholder="Contact person" /><input className={field} value={row.phone || ""} onChange={(e) => update(setCareOfParties, index, "phone", e.target.value)} placeholder="Phone" /><select className={field} value={row.ledgerAccountId || ""} onChange={(e) => update(setCareOfParties, index, "ledgerAccountId", e.target.value)}><option value="">Select AR control ledger…</option>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select>{row.id ? <span className="px-2 py-2 text-[10px] text-[#71717A]">Existing</span> : <button type="button" onClick={() => setCareOfParties((rows) => rows.filter((_, i) => i !== index))} className="p-2 text-rose-600"><Trash2 className="w-4 h-4" /></button>}</div>)}</div>}
    </section>

    <div className="flex justify-between pt-3 border-t border-[#E4E4E7]"><button type="button" onClick={props.onBack} className="px-4 py-2 border rounded-xl text-xs font-bold text-[#71717A] flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Back</button><button type="button" onClick={save} disabled={props.isSubmitting} className="px-5 py-2.5 bg-[#0D7A5F] text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">{props.isSubmitting ? "Saving…" : "Save treasury setup & continue"}<ArrowRight className="w-4 h-4" /></button></div>
  </div>;
}
